// The Gilded Vault — tuning and room layouts.
//
// One file holds every number a designer would tweak: the canvas size, the
// thief's speeds, how fast the alarm climbs, and the three rooms (jobs) of
// the night. A room is a list of walls, crates to hide behind, patches of
// shadow, patrolling guards, sweeping cameras, loot and the exit vent.
// Coordinates are in game pixels; the room is 1280 by 720.
export const VIEW = { width: 1280, height: 720 };
export const HUD_HEIGHT = 64;

// The thief walks at 170 px/s, sneaks at 95. Sneaking halves how fast the
// alarm climbs while you are seen, and shrinks the radius at which a guard
// notices you at all.
export const THIEF = {
  walkSpeed: 170,
  sneakSpeed: 95,
  radius: 13,
  noticeRadius: 250,
  sneakNoticeRadius: 165,
};

// A guard walks its patrol at 62 px/s and chases at 118. Its cone reaches
// 205 px and spans 70 degrees. A camera sweeps its cone (range 235 px,
// span 60 degrees) back and forth across its arc.
export const GUARD = {
  patrolSpeed: 62,
  chaseSpeed: 118,
  coneRange: 205,
  coneHalfAngle: (35 * Math.PI) / 180,
  // Seconds of "!" warning before the alarm starts climbing fast.
  graceSeconds: 0.8,
};
export const CAMERA = {
  coneRange: 235,
  coneHalfAngle: (30 * Math.PI) / 180,
  sweepSpeed: 0.8,
};

// The alarm climbs while any eye is on you, faster the closer the eye is,
// and drains when you are out of sight. At 100 the job is blown.
export const ALARM = {
  baseRise: 26,
  closeRise: 34,
  sneakFactor: 0.5,
  shadowFactor: 0.45,
  decay: 9,
  max: 100,
};

// Tools. A smoke bomb (3 a night) throws a cloud that no eye can see
// through for 4.5 seconds. Picking the diamond's case takes 1.6 seconds
// of holding E beside it; side loot is a quick grab.
export const TOOLS = {
  smokeBombs: 3,
  smokeSeconds: 4.5,
  smokeRadius: 110,
  pickSeconds: 1.6,
};

// A wall is an {x, y, w, h} rectangle. Crates block sight and movement.
// A shadow patch {x, y, r} darkens the floor and slows detection. Loot
// items carry a name, a value in dollars and whether they are the job's
// main target. A guard patrols the listed waypoints and pauses at each.
// A camera sits at (x, y), faces `angle`, and sweeps `arc` radians.
export const ROOMS = [
  {
    name: 'Job 1 · The Meridian Gallery',
    briefing:
      'The Star of Meridian hangs in the gallery at midnight. Three guards, two cameras, one way in.',
    walls: [
      { x: 0, y: 64, w: 1280, h: 14 },
      { x: 0, y: 694, w: 1280, h: 14 },
      { x: 0, y: 64, w: 14, h: 644 },
      { x: 1266, y: 64, w: 14, h: 644 },
      { x: 420, y: 64, w: 16, h: 190 },
      { x: 420, y: 380, w: 16, h: 314 },
      { x: 844, y: 64, w: 16, h: 190 },
      { x: 844, y: 380, w: 16, h: 314 },
    ],
    crates: [
      { x: 180, y: 180, w: 90, h: 60 },
      { x: 180, y: 470, w: 90, h: 60 },
      { x: 1010, y: 180, w: 90, h: 60 },
      { x: 1010, y: 470, w: 90, h: 60 },
      { x: 560, y: 520, w: 80, h: 60 },
    ],
    shadows: [
      { x: 240, y: 330, r: 105 },
      { x: 1040, y: 330, r: 105 },
      { x: 640, y: 620, r: 120 },
    ],
    guards: [
      {
        waypoints: [
          [300, 140],
          [300, 580],
        ],
        pause: 1.2,
      },
      {
        waypoints: [
          [980, 580],
          [980, 140],
        ],
        pause: 1.2,
      },
      {
        // The floor guard: paces back and forth across the diamond,
        // so the middle of the room is never a free highway.
        waypoints: [
          [480, 360],
          [800, 360],
        ],
        pause: 0.8,
      },
    ],
    cameras: [
      { x: 640, y: 78, angle: Math.PI / 2, arc: 1.5, phase: 0 },
      { x: 640, y: 694, angle: -Math.PI / 2, arc: 1.5, phase: 1.4 },
    ],
    loot: [
      { x: 640, y: 360, name: 'Star of Meridian', value: 5000, main: true },
      { x: 120, y: 120, name: 'Jade Horse', value: 800, main: false },
      { x: 1160, y: 600, name: 'Gold Ingot', value: 1200, main: false },
    ],
    start: [640, 660],
    exit: { x: 640, y: 96, r: 26 },
  },
  {
    name: 'Job 2 · The Vault Annex',
    briefing:
      'Three guards, three cameras, and a vault door that only opens when the case is picked.',
    walls: [
      { x: 0, y: 64, w: 1280, h: 14 },
      { x: 0, y: 694, w: 1280, h: 14 },
      { x: 0, y: 64, w: 14, h: 644 },
      { x: 1266, y: 64, w: 14, h: 644 },
      { x: 320, y: 64, w: 16, h: 260 },
      { x: 320, y: 450, w: 16, h: 244 },
      { x: 640, y: 300, w: 16, h: 394 },
      { x: 960, y: 64, w: 16, h: 260 },
      { x: 960, y: 450, w: 16, h: 244 },
    ],
    crates: [
      { x: 130, y: 300, w: 90, h: 60 },
      { x: 1060, y: 300, w: 90, h: 60 },
      { x: 480, y: 130, w: 80, h: 70 },
      { x: 720, y: 560, w: 80, h: 70 },
      { x: 480, y: 560, w: 80, h: 70 },
    ],
    shadows: [
      { x: 180, y: 560, r: 110 },
      { x: 1100, y: 160, r: 110 },
      { x: 800, y: 360, r: 100 },
    ],
    guards: [
      {
        waypoints: [
          [180, 140],
          [180, 580],
        ],
        pause: 0.9,
      },
      {
        waypoints: [
          [820, 140],
          [820, 580],
        ],
        pause: 0.9,
      },
      {
        waypoints: [
          [1120, 580],
          [1120, 140],
        ],
        pause: 0.9,
      },
    ],
    cameras: [
      { x: 480, y: 78, angle: Math.PI / 2, arc: 1.7, phase: 0 },
      { x: 800, y: 694, angle: -Math.PI / 2, arc: 1.7, phase: 2.1 },
      { x: 1266, y: 360, angle: Math.PI, arc: 1.4, phase: 0.8 },
    ],
    loot: [
      { x: 800, y: 360, name: 'Crown of Alder', value: 8000, main: true },
      { x: 120, y: 120, name: 'Ivory Fan', value: 900, main: false },
      { x: 1160, y: 640, name: 'Ruby Chalice', value: 1500, main: false },
      { x: 640, y: 120, name: 'Pearl Strand', value: 1100, main: false },
    ],
    start: [80, 660],
    exit: { x: 1200, y: 96, r: 26 },
  },
  {
    name: 'Job 3 · The Penthouse Vault',
    briefing:
      'Four guards, four cameras, no easy shadows. Take the Sable Tiara and vanish through the skylight.',
    walls: [
      { x: 0, y: 64, w: 1280, h: 14 },
      { x: 0, y: 694, w: 1280, h: 14 },
      { x: 0, y: 64, w: 14, h: 644 },
      { x: 1266, y: 64, w: 14, h: 644 },
      { x: 300, y: 64, w: 16, h: 200 },
      { x: 300, y: 390, w: 16, h: 304 },
      { x: 620, y: 64, w: 16, h: 200 },
      { x: 620, y: 390, w: 16, h: 304 },
      { x: 940, y: 64, w: 16, h: 200 },
      { x: 940, y: 390, w: 16, h: 304 },
    ],
    crates: [
      { x: 150, y: 300, w: 80, h: 60 },
      { x: 460, y: 560, w: 80, h: 60 },
      { x: 780, y: 140, w: 80, h: 60 },
      { x: 1100, y: 560, w: 80, h: 60 },
    ],
    shadows: [
      { x: 200, y: 620, r: 95 },
      { x: 1080, y: 140, r: 95 },
    ],
    guards: [
      {
        waypoints: [
          [160, 140],
          [160, 580],
        ],
        pause: 0.7,
      },
      {
        waypoints: [
          [470, 580],
          [470, 140],
        ],
        pause: 0.7,
      },
      {
        waypoints: [
          [790, 140],
          [790, 580],
        ],
        pause: 0.7,
      },
      {
        waypoints: [
          [1120, 580],
          [1120, 140],
        ],
        pause: 0.7,
      },
    ],
    cameras: [
      { x: 460, y: 78, angle: Math.PI / 2, arc: 1.8, phase: 0 },
      { x: 780, y: 694, angle: -Math.PI / 2, arc: 1.8, phase: 1.1 },
      { x: 14, y: 360, angle: 0, arc: 1.5, phase: 2.2 },
      { x: 1266, y: 360, angle: Math.PI, arc: 1.5, phase: 0.5 },
    ],
    loot: [
      { x: 640, y: 360, name: 'Sable Tiara', value: 12000, main: true },
      { x: 120, y: 120, name: 'Emerald Brooch', value: 1400, main: false },
      { x: 1160, y: 120, name: 'Sapphire Egg', value: 1800, main: false },
      { x: 120, y: 620, name: 'Silver Mask', value: 1000, main: false },
      { x: 1160, y: 620, name: 'Opal Ring', value: 1300, main: false },
    ],
    start: [680, 660],
    exit: { x: 640, y: 96, r: 26 },
  },
];
