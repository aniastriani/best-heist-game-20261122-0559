// Screenshot scenes: the game playing itself.
//
// Each scene runs the real world forward from a fresh state with a fixed
// seed, steered by a small autopilot. The autopilot reads a distance field
// — a breadth-first flood from the goal over a grid of the room, flowing
// around walls and crates — so it routes around cover instead of pushing
// into it, and it weighs each candidate move by how much ground it gains
// on that field against how much alarm it raises. The frame a screenshot
// takes is therefore a frame of a real game, not a staged picture.
// `?shot=start` shows the title; `play` a mid-heist moment; `tense` the
// alarm nearly blown; `win` the getaway screen.
import { PHASE_CAUGHT, PHASE_ESCAPED, PHASE_PLAY, createWorld, stepWorld } from './world.js';

const DIRECTIONS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const CELL = 32;
const COLS = Math.ceil(1280 / CELL);
const ROWS = Math.ceil(720 / CELL);

// Where the thief wants to be: the main loot until it is taken, then the exit.
function goalOf(world) {
  if (!world.mainTaken) {
    const main = world.loot.find((item) => item.main);
    return [main.x, main.y];
  }
  return [world.room.exit.x, world.room.exit.y];
}

function cellBlocked(world, col, row) {
  // A cell is blocked when the thief's own circle, centred on it, would
  // touch a wall or a crate — the same test the world uses to move.
  const x = col * CELL + CELL / 2;
  const y = row * CELL + CELL / 2;
  const r = 14;
  for (const rect of world.room.walls.concat(world.room.crates)) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Breadth-first distances from the goal cell over the room's grid, in
// steps of one cell (diagonals cost a little more). Unreachable cells
// keep Infinity, so the autopilot never steers into a dead end.
export function distanceField(world, gx, gy) {
  const dist = new Array(COLS * ROWS).fill(Infinity);
  const goalCol = Math.max(0, Math.min(COLS - 1, Math.floor(gx / CELL)));
  const goalRow = Math.max(0, Math.min(ROWS - 1, Math.floor(gy / CELL)));
  const start = goalRow * COLS + goalCol;
  dist[start] = 0;
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    const cc = cur % COLS;
    const cr = Math.floor(cur / COLS);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        if (cellBlocked(world, nc, nr)) continue;
        const next = nr * COLS + nc;
        const cost = dist[cur] + (dr !== 0 && dc !== 0 ? 1.41 : 1);
        if (cost < dist[next]) {
          dist[next] = cost;
          queue.push(next);
        }
      }
    }
  }
  return dist;
}

function fieldAt(field, x, y) {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)));
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)));
  const centre = field[row * COLS + col];
  if (Number.isFinite(centre)) return centre;
  // The thief can stand a hair clear of a crate while its cell centre is
  // inside it: take the nearest reachable neighbour instead of giving up.
  for (let ring = 1; ring <= 2; ring += 1) {
    let best = Infinity;
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const v = field[nr * COLS + nc];
        if (Number.isFinite(v)) best = Math.min(best, v + ring);
      }
    }
    if (Number.isFinite(best)) return best;
  }
  return Infinity;
}

function clone(world) {
  return JSON.parse(JSON.stringify(world));
}

// One autopilot decision: try every direction for a quarter of a second
// on a copy of the world and keep the move that gains the most ground on
// the distance field while raising the alarm the least.
export function autopilotInput(world, field) {
  const [gx, gy] = goalOf(world);
  const distField = field || distanceField(world, gx, gy);
  const here = fieldAt(distField, world.thief.x, world.thief.y);
  const hereDist = Number.isFinite(here) ? here : Math.hypot(gx - world.thief.x, gy - world.thief.y) / CELL;
  const sneak = world.alarm > 35;
  let best = { mx: 0, my: 0, score: -Infinity };
  for (const [dx, dy] of DIRECTIONS) {
    const copy = clone(world);
    const len = Math.hypot(dx, dy) || 1;
    // Look ahead in the same small steps the live game takes, so the
    // simulation cannot tunnel through a wall corner the real thief
    // would wedge on.
    for (let s = 0; s < 8; s += 1) {
      stepWorld(copy, { mx: dx / len, my: dy / len, sneak, interact: false, smoke: false }, 1 / 30);
      if (copy.phase !== PHASE_PLAY) break;
    }
    const there = fieldAt(distField, copy.thief.x, copy.thief.y);
    const thereDist = Number.isFinite(there) ? there : Math.hypot(gx - copy.thief.x, gy - copy.thief.y) / CELL;
    const progress = hereDist - thereDist;
    const danger = (copy.alarm - world.alarm) * 6 + (copy.phase === PHASE_CAUGHT ? 100 : 0);
    const score = progress * 3 - danger - (dx === 0 && dy === 0 ? 0.2 : 0);
    if (score > best.score) best = { mx: dx / len, my: dy / len, score };
  }
  // Grab side loot on the way, and hold E to pick the main case.
  let interact = false;
  for (const item of world.loot) {
    if (!item.taken && Math.hypot(item.x - world.thief.x, item.y - world.thief.y) < 46) {
      interact = true;
    }
  }
  return { mx: best.mx, my: best.my, sneak, interact, smoke: false };
}

// Run the autopilot for `seconds` of game time at 30 steps a second. The
// distance field is rebuilt when the goal changes (loot taken, exit open).
export function playForward(world, seconds) {
  const steps = Math.round(seconds * 30);
  let field = null;
  let fieldGoal = '';
  for (let i = 0; i < steps; i += 1) {
    if (world.phase !== PHASE_PLAY) break;
    const [gx, gy] = goalOf(world);
    const key = `${gx},${gy}`;
    if (field === null || fieldGoal !== key) {
      field = distanceField(world, gx, gy);
      fieldGoal = key;
    }
    stepWorld(world, autopilotInput(world, field), 1 / 30);
  }
  return world;
}

// Steer the thief toward a point using the same distance field, for a
// bounded number of steps. Returns true once it arrives.
function walkToward(world, tx, ty, maxSteps) {
  const field = distanceField(world, tx, ty);
  for (let i = 0; i < maxSteps && world.phase === PHASE_PLAY; i += 1) {
    if (Math.hypot(tx - world.thief.x, ty - world.thief.y) < 40) return true;
    stepWorld(world, autopilotInput(world, field), 1 / 30);
  }
  return Math.hypot(tx - world.thief.x, ty - world.thief.y) < 40;
}

// Build the world behind one named shot. `seed` fixes the frame.
export function buildShot(name, seed) {
  if (name === 'start') return { screen: 'title', world: null };
  if (name === 'play') {
    // Job 2 takes the autopilot about ten seconds; six seconds in, the
    // thief is mid-room with cones sweeping and the case still ahead.
    const world = createWorld(1, seed);
    playForward(world, 6);
    return { screen: 'play', world };
  }
  if (name === 'tense') {
    const world = createWorld(1, seed);
    playForward(world, 6);
    // Walk up to the nearest guard, stand in its cone, and let the alarm
    // climb the way a hurried player's does — still the real rules, step
    // by step, until the meter is nearly blown.
    for (let round = 0; round < 3 && world.alarm < 68 && world.phase === PHASE_PLAY; round += 1) {
      let guard = world.guards[0];
      let bestDist = Infinity;
      for (const g of world.guards) {
        const d = Math.hypot(g.x - world.thief.x, g.y - world.thief.y);
        if (d < bestDist) {
          bestDist = d;
          guard = g;
        }
      }
      walkToward(world, guard.x, guard.y, 30 * 12);
      for (let i = 0; i < 30 * 8 && world.alarm < 68 && world.phase === PHASE_PLAY; i += 1) {
        stepWorld(world, { mx: 0, my: 0, sneak: false, interact: false, smoke: false }, 1 / 30);
      }
    }
    return { screen: 'play', world };
  }
  if (name === 'win') {
    const world = createWorld(0, seed);
    // Keep playing until the thief escapes or the autopilot runs out of road.
    for (let i = 0; i < 90 * 30 && world.phase === PHASE_PLAY; i += 1) {
      stepWorld(world, autopilotInput(world), 1 / 30);
    }
    if (world.phase === PHASE_ESCAPED) return { screen: 'escaped', world, totalScore: world.score };
    const retry = createWorld(0, seed + 7);
    for (let i = 0; i < 90 * 30 && retry.phase === PHASE_PLAY; i += 1) {
      stepWorld(retry, autopilotInput(retry), 1 / 30);
    }
    return { screen: retry.phase === PHASE_ESCAPED ? 'escaped' : 'play', world: retry, totalScore: retry.score };
  }
  return { screen: 'title', world: null };
}

export { PHASE_CAUGHT, PHASE_ESCAPED, PHASE_PLAY };
