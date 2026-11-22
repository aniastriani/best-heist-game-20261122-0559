// The Gilded Vault — everything the player sees, drawn on one canvas.
//
// The look is a midnight gallery: deep navy floor, a crimson carpet runner
// down the middle, gold trim, and vision cones in amber (guards) and red
// (cameras) so danger reads at a glance. Safe cover is dark green, loot
// glints gold, and the alarm meter across the top turns red as it climbs.
import { ALARM, CAMERA, GUARD, VIEW } from './config.js';
import { PHASE_CAUGHT, PHASE_ESCAPED, PHASE_PLAY, watchers } from './world.js';

const FLOOR_A = '#1b2340';
const FLOOR_B = '#161c33';
const CARPET = '#5d1f2b';
const CARPET_EDGE = '#8a6d3b';
const WALL = '#3a4368';
const WALL_TOP = '#4d5878';
const CRATE = '#2c4a3a';
const CRATE_TOP = '#3a6350';

function conePath(ctx, x, y, angle, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill, edge) {
  conePath(ctx, x, y, angle, range, halfAngle);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGuard(ctx, guard) {
  // Vision cone first, so the guard draws on top of it.
  drawCone(
    ctx,
    guard.x,
    guard.y,
    guard.angle,
    GUARD.coneRange,
    GUARD.coneHalfAngle,
    guard.state === 'chase' ? 'rgba(255, 80, 60, 0.20)' : 'rgba(255, 190, 80, 0.16)',
    guard.state === 'chase' ? 'rgba(255, 80, 60, 0.45)' : 'rgba(255, 190, 80, 0.35)',
  );
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = guard.state === 'chase' ? '#c0392b' : '#2c3e50';
  ctx.fill();
  ctx.strokeStyle = '#d5d8dc';
  ctx.lineWidth = 2;
  ctx.stroke();
  // The guard's facing tick and cap brim.
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
  ctx.strokeStyle = '#f5f6fa';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#f5f6fa';
  ctx.fill();
  if (guard.alert) {
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4a';
    ctx.fillText('!', guard.x, guard.y - 22);
  }
}

function drawCamera(ctx, cam, time) {
  drawCone(
    ctx,
    cam.x,
    cam.y,
    cam.angle,
    CAMERA.coneRange,
    CAMERA.coneHalfAngle,
    'rgba(255, 70, 70, 0.13)',
    'rgba(255, 70, 70, 0.35)',
  );
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.rotate(cam.angle);
  ctx.fillStyle = '#3d4457';
  ctx.fillRect(-4, -7, 16, 14);
  ctx.fillStyle = time % 1 < 0.5 ? '#ff3b30' : '#7a1010';
  ctx.beginPath();
  ctx.arc(13, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLoot(ctx, item, time) {
  if (item.taken) return;
  const pulse = 0.6 + 0.4 * Math.sin(time * 3 + item.x);
  ctx.save();
  ctx.translate(item.x, item.y);
  if (item.main) {
    // The diamond: a gold case with a glinting stone.
    ctx.fillStyle = 'rgba(212, 175, 55, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, 30 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.strokeRect(-16, -12, 32, 24);
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = `rgba(212, 175, 55, ${0.5 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f7dc6f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7dc6f';
  ctx.fillText(item.name, item.x, item.y + 30);
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText(`$${item.value.toLocaleString('en-US')}`, item.x, item.y + 44);
}

function drawThief(ctx, thief, time) {
  const bob = thief.moving ? Math.sin(time * 12) * 1.5 : 0;
  ctx.save();
  ctx.translate(thief.x, thief.y + bob);
  // Cloak: a dark hood with a gold clasp, facing the movement direction.
  ctx.rotate(thief.facing);
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fillStyle = thief.sneaking ? '#232a4a' : '#1a1a2e';
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(thief.x, thief.y + bob, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#e8dcc3';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(thief.x, thief.y + bob, 7, 0, Math.PI * 2);
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (thief.sneaking) {
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fb3d8';
    ctx.fillText('SNEAKING', thief.x, thief.y - 20);
  }
}

function drawExit(ctx, exit, mainTaken, time) {
  const glow = mainTaken ? 0.5 + 0.4 * Math.sin(time * 4) : 0.15;
  ctx.save();
  ctx.translate(exit.x, exit.y);
  ctx.fillStyle = `rgba(80, 200, 120, ${glow})`;
  ctx.beginPath();
  ctx.arc(0, 0, exit.r + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = mainTaken ? '#50c878' : '#5a6b5a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, exit.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = mainTaken ? '#a9f5c3' : '#8a9a8a';
  ctx.fillText('EXIT', 0, 4);
  ctx.restore();
}

// The room itself: checkerboard marble, carpet runner, walls, crates and
// shadow pools. Drawn before anything that moves.
export function drawWorld(ctx, world) {
  const room = world.room;
  const time = world.time;
  ctx.fillStyle = FLOOR_A;
  ctx.fillRect(0, 64, VIEW.width, 656);
  const tile = 64;
  for (let y = 64; y < 720; y += tile) {
    for (let x = 0; x < 1280; x += tile) {
      if (((x + y) / tile) % 2 === 0) {
        ctx.fillStyle = FLOOR_B;
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }
  // Crimson carpet runner down the middle of the gallery.
  ctx.fillStyle = CARPET;
  ctx.fillRect(600, 64, 80, 656);
  ctx.fillStyle = CARPET_EDGE;
  ctx.fillRect(596, 64, 4, 656);
  ctx.fillRect(680, 64, 4, 656);

  // Shadow pools: dark, soft-edged, and visibly safer.
  for (const s of room.shadows) {
    const grad = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r);
    grad.addColorStop(0, 'rgba(6, 8, 20, 0.62)');
    grad.addColorStop(1, 'rgba(6, 8, 20, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Walls with a lighter top edge, then crates (display cases).
  for (const w of room.walls) {
    ctx.fillStyle = WALL;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = WALL_TOP;
    ctx.fillRect(w.x, w.y, w.w, 4);
  }
  for (const c of room.crates) {
    ctx.fillStyle = CRATE;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = CRATE_TOP;
    ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, 10);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
  }

  drawExit(ctx, room.exit, world.mainTaken, time);
  for (const item of world.loot) drawLoot(ctx, item, time);
  for (const cam of world.cameras) drawCamera(ctx, cam, time);
  for (const guard of world.guards) drawGuard(ctx, guard);
  drawThief(ctx, world.thief, time);

  // Smoke clouds hide the thief and block every eye.
  for (const s of world.smokes) {
    const grad = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r);
    grad.addColorStop(0, 'rgba(220, 220, 230, 0.85)');
    grad.addColorStop(1, 'rgba(220, 220, 230, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Picking the main case: a progress ring around the thief.
  if (world.picking && world.pickProgress > 0) {
    ctx.beginPath();
    ctx.arc(world.thief.x, world.thief.y, 24, -Math.PI / 2, -Math.PI / 2 + world.pickProgress * Math.PI * 2);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f7dc6f';
    ctx.fillText('PICKING THE LOCK…', world.thief.x, world.thief.y - 34);
  }
}

// The top bar: room name, alarm meter, loot, smoke bombs, timer.
export function drawHud(ctx, world) {
  ctx.fillStyle = '#0d1120';
  ctx.fillRect(0, 0, VIEW.width, 64);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, 62, VIEW.width, 2);

  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5f6fa';
  ctx.fillText(world.room.name, 16, 26);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9fb3d8';
  ctx.fillText('WASD move · Shift sneak · E grab · Space smoke · Esc pause', 16, 48);

  // Alarm meter: green to red, pulsing past 70.
  const alarm = world.alarm;
  const meterX = 470;
  const meterW = 300;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = alarm > 70 ? '#ff5a4a' : '#f5f6fa';
  ctx.fillText('ALARM', meterX, 26);
  ctx.fillStyle = '#222a44';
  ctx.fillRect(meterX, 34, meterW, 14);
  const alarmColor = alarm < 35 ? '#50c878' : alarm < 70 ? '#f5a623' : '#ff3b30';
  ctx.fillStyle = alarmColor;
  ctx.fillRect(meterX, 34, (meterW * alarm) / ALARM.max, 14);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(meterX, 34, meterW, 14);
  if (world.spottedBy) {
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#ff5a4a';
    ctx.textAlign = 'left';
    ctx.fillText(world.spottedBy === 'camera' ? 'SPOTTED BY CAMERA!' : 'SPOTTED BY A GUARD!', meterX + meterW + 14, 45);
  }
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#f7dc6f';
  ctx.fillText(`LOOT $${world.lootValue.toLocaleString('en-US')}`, 1080, 26);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9fb3d8';
  ctx.fillText(`Smoke ×${world.smokeBombs}   ·   ${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}`, 1080, 48);
  ctx.textAlign = 'left';

  if (watchers(world) > 0 && world.phase === PHASE_PLAY) {
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ff5a4a';
    ctx.textAlign = 'center';
    ctx.fillText('— SEEN —', VIEW.width / 2, 88);
    ctx.textAlign = 'left';
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 13, 28, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.width / 2, y);
}

export function drawTitle(ctx) {
  ctx.fillStyle = '#0d1120';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = CARPET;
  ctx.fillRect(600, 0, 80, VIEW.height);
  centerText(ctx, 'THE GILDED VAULT', 190, 'bold 64px serif', '#d4af37');
  centerText(ctx, 'A midnight heist in three jobs', 235, '24px serif', '#f5f6fa');
  centerText(ctx, 'Cross the gallery. Dodge the cones. Take the Star of Meridian.', 300, '19px sans-serif', '#c9c9c9');
  centerText(ctx, 'Then slip out through the skylight before the alarm finds you.', 330, '19px sans-serif', '#c9c9c9');
  panel(ctx, 340, 380, 600, 150);
  centerText(ctx, 'WASD / arrows — move        Shift — sneak (slower, harder to spot)', 420, '17px sans-serif', '#f5f6fa');
  centerText(ctx, 'E — grab loot, hold to pick the diamond case        Space — smoke bomb (×3)', 452, '17px sans-serif', '#f5f6fa');
  centerText(ctx, 'Click — walk to a spot        Esc — pause', 484, '17px sans-serif', '#f5f6fa');
  centerText(ctx, 'Press ENTER to start the night', 580, 'bold 22px sans-serif', '#f7dc6f');
  centerText(ctx, 'Shadows slow the alarm. Crates block every eye. A guard that spots you gives chase.', 640, '15px sans-serif', '#9fb3d8');
}

export function drawBriefing(ctx, world) {
  panel(ctx, 290, 220, 700, 240);
  centerText(ctx, world.room.name, 280, 'bold 30px serif', '#d4af37');
  centerText(ctx, world.room.briefing, 330, '17px sans-serif', '#f5f6fa');
  centerText(ctx, `Guards: ${world.guards.length}    Cameras: ${world.cameras.length}    Loot: $${world.room.loot.reduce((a, l) => a + l.value, 0).toLocaleString('en-US')}`, 380, '16px sans-serif', '#c9c9c9');
  centerText(ctx, 'Press ENTER to begin this job', 430, 'bold 19px sans-serif', '#f7dc6f');
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(10, 13, 28, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'PAUSED', 330, 'bold 48px serif', '#f5f6fa');
  centerText(ctx, 'Press Esc to keep stealing', 390, '19px sans-serif', '#c9c9c9');
}

export function drawCaught(ctx, world) {
  ctx.fillStyle = 'rgba(40, 8, 8, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, 'CAUGHT!', 260, 'bold 72px serif', '#ff5a4a');
  centerText(ctx, world.caughtReason, 320, '20px sans-serif', '#f5f6fa');
  centerText(ctx, `The alarm hit 100 after ${Math.round(world.time)} seconds. Loot kept: $${world.lootValue.toLocaleString('en-US')}.`, 360, '18px sans-serif', '#c9c9c9');
  centerText(ctx, 'Press ENTER to try this job again', 430, 'bold 20px sans-serif', '#f7dc6f');
}

export function drawEscaped(ctx, world, totalScore, isLastJob) {
  ctx.fillStyle = 'rgba(8, 30, 16, 0.8)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centerText(ctx, isLastJob ? 'THE VAULT IS YOURS' : 'CLEAN GETAWAY', 220, 'bold 60px serif', '#50c878');
  centerText(ctx, `You slipped out with the ${world.room.loot.find((l) => l.main).name}.`, 290, '22px sans-serif', '#f5f6fa');
  panel(ctx, 390, 330, 500, 170);
  centerText(ctx, `Loot this job: $${world.lootValue.toLocaleString('en-US')}`, 375, '19px sans-serif', '#f7dc6f');
  centerText(ctx, `Time bonus: $${Math.max(0, Math.round(3000 - world.time * 12)).toLocaleString('en-US')}    Ghost bonus: $${world.alarm < 25 ? '1,500' : '0'}`, 410, '17px sans-serif', '#c9c9c9');
  centerText(ctx, `Job score: ${world.score.toLocaleString('en-US')}        Night total: ${totalScore.toLocaleString('en-US')}`, 445, 'bold 19px sans-serif', '#f5f6fa');
  centerText(ctx, isLastJob ? 'Press ENTER to run the night again' : 'Press ENTER for the next job', 560, 'bold 20px sans-serif', '#f7dc6f');
}
