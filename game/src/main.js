// The Gilded Vault — the game loop and its screens.
//
// Screens: title, a briefing before each job, the heist itself, and the
// caught / getaway endings. `?shot=<name>&seed=<n>` in the URL renders one
// screenshot scene instead of the playable game: the autopilot plays the
// real rules forward and the frame is drawn once.
import { ROOMS, VIEW } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import {
  drawBriefing,
  drawCaught,
  drawEscaped,
  drawHud,
  drawPaused,
  drawTitle,
  drawWorld,
} from './render.js';
import { buildShot } from './shots.js';
import { PHASE_CAUGHT, PHASE_ESCAPED, PHASE_PLAY, createWorld, stepWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const audio = createAudio();
const input = createInput(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || '1');

// A screenshot scene: play it forward, draw the frame once, and stop.
if (shotName) {
  const shot = buildShot(shotName, shotSeed);
  if (shot.screen === 'title') {
    drawTitle(ctx);
  } else if (shot.screen === 'escaped') {
    drawWorld(ctx, shot.world);
    drawHud(ctx, shot.world);
    drawEscaped(ctx, shot.world, shot.totalScore || shot.world.score, false);
  } else {
    drawWorld(ctx, shot.world);
    drawHud(ctx, shot.world);
  }
  document.title = `The Gilded Vault — ${shotName}`;
} else {
  startGame();
}

function startGame() {
  let screen = 'title';
  let roomIndex = 0;
  let world = createWorld(0, 1);
  let totalScore = 0;
  let lastTime = performance.now();
  let alarmBeepAt = 0;

  function announce(text) {
    statusLine.textContent = text;
  }

  function beginJob(index) {
    roomIndex = index;
    world = createWorld(index, 100 + index * 17);
    screen = 'briefing';
    announce(`${ROOMS[index].name}. ${ROOMS[index].briefing}`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(1 / 30, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const oneShot = input.consume();

    if (screen === 'title') {
      drawTitle(ctx);
      if (oneShot.confirm) {
        audio.unlock();
        totalScore = 0;
        beginJob(0);
      }
      return;
    }
    if (screen === 'briefing') {
      drawWorld(ctx, world);
      drawHud(ctx, world);
      drawBriefing(ctx, world);
      if (oneShot.confirm) {
        screen = 'play';
        announce('The job is on. Stay out of the cones.');
      }
      return;
    }
    if (screen === 'caught' || screen === 'escaped') {
      drawWorld(ctx, world);
      drawHud(ctx, world);
      if (screen === 'caught') drawCaught(ctx, world);
      else drawEscaped(ctx, world, totalScore, roomIndex === ROOMS.length - 1);
      if (oneShot.confirm) {
        if (screen === 'escaped' && roomIndex < ROOMS.length - 1) {
          beginJob(roomIndex + 1);
        } else if (screen === 'escaped') {
          totalScore = 0;
          beginJob(0);
        } else {
          beginJob(roomIndex);
        }
      }
      return;
    }

    // screen === 'play'
    if (input.paused) {
      drawWorld(ctx, world);
      drawHud(ctx, world);
      drawPaused(ctx);
      return;
    }
    input.poll(world.thief);
    const step = {
      mx: input.mx,
      my: input.my,
      sneak: input.sneak,
      interact: input.interact,
      smoke: oneShot.smoke,
    };
    const events = stepWorld(world, step, dt);
    for (const event of events) {
      audio.play(event);
      if (event === 'main-loot') announce('The diamond is yours. Get to the skylight exit.');
      if (event === 'chase') announce('A guard is chasing you. Break line of sight.');
      if (event === 'caught') announce('Caught. The job is blown.');
      if (event === 'escaped') announce('Clean getaway.');
    }
    if (world.spottedBy && now - alarmBeepAt > 500) {
      alarmBeepAt = now;
      audio.play('alarm');
    }
    if (world.phase === PHASE_CAUGHT) {
      screen = 'caught';
    } else if (world.phase === PHASE_ESCAPED) {
      totalScore += world.score;
      screen = 'escaped';
    }
    drawWorld(ctx, world);
    drawHud(ctx, world);
  }

  canvas.addEventListener('mousedown', () => audio.unlock());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
  });
  announce('The Gilded Vault. Press Enter to start the night.');
  requestAnimationFrame(frame);
}
