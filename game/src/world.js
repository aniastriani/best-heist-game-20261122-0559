// The Gilded Vault — the world: one room, its guards, its cameras, and
// the rules that decide whether the thief is seen.
//
// The world is plain data plus one step function, so the screenshot scenes
// can run it forward without a browser event loop and the live game can
// run the same code. Nothing here touches the DOM or the canvas.
import { ALARM, CAMERA, GUARD, ROOMS, THIEF, TOOLS, VIEW } from './config.js';
import { makeRng } from './random.js';

export const PHASE_PLAY = 'play';
export const PHASE_CAUGHT = 'caught';
export const PHASE_ESCAPED = 'escaped';

// Build a fresh world for a room. `seed` only jitters patrol pauses and
// sparkle drift, so the same seed always plays the same.
export function createWorld(roomIndex, seed) {
  const room = ROOMS[roomIndex];
  const rng = makeRng(seed);
  return {
    roomIndex,
    room,
    seed,
    time: 0,
    phase: PHASE_PLAY,
    thief: {
      x: room.start[0],
      y: room.start[1],
      radius: THIEF.radius,
      facing: -Math.PI / 2,
      sneaking: false,
      moving: false,
    },
    guards: room.guards.map((g) => ({
      waypoints: g.waypoints,
      pause: g.pause,
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      target: 1,
      waiting: 0.4 + rng() * 0.6,
      angle: Math.PI / 2,
      state: 'patrol',
      chaseX: 0,
      chaseY: 0,
      seenFor: 0,
      alert: false,
    })),
    cameras: room.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.angle,
      arc: c.arc,
      phase: c.phase,
      angle: c.angle,
      seenFor: 0,
    })),
    loot: room.loot.map((item) => ({ ...item, taken: false })),
    alarm: 0,
    smokeBombs: TOOLS.smokeBombs,
    smokes: [],
    pickProgress: 0,
    picking: null,
    score: 0,
    lootValue: 0,
    mainTaken: false,
    spottedBy: null,
    caughtReason: '',
    escapedAt: 0,
    events: [],
  };
}

function rects(room) {
  return room.walls.concat(room.crates);
}

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function blocked(world, x, y, r) {
  for (const rect of rects(world.room)) {
    if (circleHitsRect(x, y, r, rect)) return true;
  }
  return false;
}

// Move a circle through the room, sliding along walls: try the full step,
// then each axis alone, so the thief never sticks on a corner.
export function moveCircle(world, x, y, r, dx, dy) {
  if (!blocked(world, x + dx, y + dy, r)) return [x + dx, y + dy];
  if (!blocked(world, x + dx, y, r)) return [x + dx, y];
  if (!blocked(world, x, y + dy, r)) return [x, y + dy];
  return [x, y];
}

// Does a straight line between two points cross a wall or a crate?
// Sampled finely enough that no gap lets a sight line leak through.
export function sightBlocked(world, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const rect of rects(world.room)) {
      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) return true;
    }
  }
  return false;
}

function inShadow(world, x, y) {
  for (const s of world.room.shadows) {
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < s.r * s.r) return true;
  }
  return false;
}

function inSmoke(world, x, y) {
  for (const s of world.smokes) {
    const dx = x - s.x;
    const dy = y - s.y;
    if (dx * dx + dy * dy < s.r * s.r) return true;
  }
  return false;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Can this eye (at x, y, facing angle, with a cone) see the thief?
// Range, cone angle, walls, smoke and shadow all count; sneaking shrinks
// the radius at which the thief is noticed at all.
function eyeSees(world, x, y, angle, range, halfAngle) {
  const thief = world.thief;
  const dx = thief.x - x;
  const dy = thief.y - y;
  const dist = Math.hypot(dx, dy);
  const notice = thief.sneaking ? THIEF.sneakNoticeRadius : THIEF.noticeRadius;
  if (dist > Math.min(range, notice)) return { seen: false, dist };
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return { seen: false, dist };
  if (sightBlocked(world, x, y, thief.x, thief.y)) return { seen: false, dist };
  if (inSmoke(world, thief.x, thief.y)) return { seen: false, dist };
  return { seen: true, dist };
}

function nearestLoot(world, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - world.thief.x, item.y - world.thief.y);
    if (d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

// One simulation step. `input` is {mx, my, sneak, interact, smoke, click}
// in the same shape the live game and the screenshot autopilot both use.
// Returns a list of event strings that happened this step (for sounds and
// the HUD), so the step itself stays free of side effects.
export function stepWorld(world, input, dt) {
  const events = [];
  if (world.phase !== PHASE_PLAY) return events;
  world.time += dt;

  // --- the thief moves -------------------------------------------------
  const thief = world.thief;
  const speed = input.sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
  let mx = input.mx || 0;
  let my = input.my || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  thief.sneaking = !!input.sneak;
  thief.moving = len > 0.1;
  if (thief.moving) {
    const [nx, ny] = moveCircle(world, thief.x, thief.y, thief.radius, mx * speed * dt, my * speed * dt);
    // Walls already stop the thief; these clamps are only a safety net.
    thief.x = Math.max(14 + thief.radius, Math.min(nx, 1266 - thief.radius));
    thief.y = Math.max(78 + thief.radius, Math.min(ny, 694 - thief.radius));
    thief.facing = Math.atan2(my, mx);
  }

  // --- smoke bombs ------------------------------------------------------
  if (input.smoke && world.smokeBombs > 0) {
    world.smokeBombs -= 1;
    world.smokes.push({ x: thief.x, y: thief.y, r: TOOLS.smokeRadius, left: TOOLS.smokeSeconds });
    events.push('smoke');
  }
  for (const s of world.smokes) s.left -= dt;
  world.smokes = world.smokes.filter((s) => s.left > 0);

  // --- loot: quick grabs, and the slow pick on the main target ---------
  const near = nearestLoot(world, 46);
  world.picking = null;
  if (input.interact && near) {
    if (near.main) {
      world.picking = near;
      world.pickProgress += dt / TOOLS.pickSeconds;
      if (world.pickProgress >= 1) {
        takeLoot(world, near, events);
        world.pickProgress = 0;
      }
    } else {
      takeLoot(world, near, events);
    }
  } else {
    world.pickProgress = 0;
  }

  // --- guards patrol, and chase when they have seen you -----------------
  for (const guard of world.guards) {
    if (guard.state === 'chase') {
      const dx = guard.chaseX - guard.x;
      const dy = guard.chaseY - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        const step = (GUARD.chaseSpeed * dt) / dist;
        const [nx, ny] = moveCircle(world, guard.x, guard.y, 12, dx * step, dy * step);
        guard.x = nx;
        guard.y = ny;
        guard.angle = Math.atan2(dy, dx);
      }
    } else {
      if (guard.waiting > 0) {
        guard.waiting -= dt;
      } else {
        const [tx, ty] = guard.waypoints[guard.target];
        const dx = tx - guard.x;
        const dy = ty - guard.y;
        const dist = Math.hypot(dx, dy);
        const step = GUARD.patrolSpeed * dt;
        if (dist <= step) {
          guard.x = tx;
          guard.y = ty;
          guard.target = (guard.target + 1) % guard.waypoints.length;
          guard.waiting = guard.pause;
        } else {
          guard.x += (dx / dist) * step;
          guard.y += (dy / dist) * step;
          guard.angle = Math.atan2(dy, dx);
        }
      }
    }
  }

  // --- cameras sweep ----------------------------------------------------
  for (const cam of world.cameras) {
    cam.angle = cam.baseAngle + Math.sin(world.time * CAMERA.sweepSpeed + cam.phase) * cam.arc;
  }

  // --- who can see the thief? -------------------------------------------
  let seen = false;
  let closest = Infinity;
  let spotter = null;
  const shadowed = inShadow(world, thief.x, thief.y);
  for (const guard of world.guards) {
    const hit = eyeSees(world, guard.x, guard.y, guard.angle, GUARD.coneRange, GUARD.coneHalfAngle);
    if (hit.seen) {
      seen = true;
      if (hit.dist < closest) {
        closest = hit.dist;
        spotter = 'guard';
      }
      guard.seenFor += dt;
      guard.alert = true;
      if (guard.seenFor > GUARD.graceSeconds && guard.state !== 'chase') {
        guard.state = 'chase';
        guard.chaseX = thief.x;
        guard.chaseY = thief.y;
        events.push('chase');
      }
      if (guard.state === 'chase') {
        guard.chaseX = thief.x;
        guard.chaseY = thief.y;
      }
    } else {
      guard.seenFor = Math.max(0, guard.seenFor - dt * 2);
      if (guard.seenFor === 0) guard.alert = false;
      if (guard.state === 'chase' && guard.seenFor === 0) {
        guard.state = 'patrol';
        events.push('lost');
      }
    }
  }
  for (const cam of world.cameras) {
    const hit = eyeSees(world, cam.x, cam.y, cam.angle, CAMERA.coneRange, CAMERA.coneHalfAngle);
    if (hit.seen) {
      seen = true;
      if (hit.dist < closest) {
        closest = hit.dist;
        spotter = 'camera';
      }
      cam.seenFor += dt;
    } else {
      cam.seenFor = Math.max(0, cam.seenFor - dt * 2);
    }
  }

  // --- the alarm ---------------------------------------------------------
  if (seen) {
    let rise = ALARM.baseRise;
    if (closest < 110) rise += ALARM.closeRise;
    if (thief.sneaking) rise *= ALARM.sneakFactor;
    if (shadowed) rise *= ALARM.shadowFactor;
    if (world.smokes.length > 0 && inSmoke(world, thief.x, thief.y)) rise *= 0.2;
    world.alarm = Math.min(ALARM.max, world.alarm + rise * dt);
    world.spottedBy = spotter;
    if (world.alarm >= ALARM.max) {
      world.phase = PHASE_CAUGHT;
      world.caughtReason = spotter === 'camera' ? 'A camera held you in its lens too long.' : 'A guard ran you down.';
      events.push('caught');
    }
  } else {
    world.alarm = Math.max(0, world.alarm - ALARM.decay * dt);
    world.spottedBy = null;
  }

  // --- the way out -------------------------------------------------------
  const exit = world.room.exit;
  if (world.mainTaken && Math.hypot(thief.x - exit.x, thief.y - exit.y) < exit.r + 6) {
    world.phase = PHASE_ESCAPED;
    world.escapedAt = world.time;
    world.score = scoreWorld(world);
    events.push('escaped');
  }

  world.events = events;
  return events;
}

function takeLoot(world, item, events) {
  item.taken = true;
  world.lootValue += item.value;
  if (item.main) {
    world.mainTaken = true;
    events.push('main-loot');
  } else {
    events.push('loot');
  }
}

// The getaway pays off the planning: loot value, a time bonus for a quick
// job, and a ghost bonus when the alarm never really climbed.
export function scoreWorld(world) {
  const timeBonus = Math.max(0, Math.round(3000 - world.time * 12));
  const ghostBonus = world.alarm < 25 ? 1500 : 0;
  return world.lootValue + timeBonus + ghostBonus;
}

// How many guards and cameras are watching right now — for the HUD.
export function watchers(world) {
  let n = 0;
  for (const g of world.guards) if (g.seenFor > 0) n += 1;
  for (const c of world.cameras) if (c.seenFor > 0) n += 1;
  return n;
}
