// Keyboard and mouse, read fresh every frame. WASD or arrows move the
// thief, Shift sneaks, E grabs and picks, Space throws a smoke bomb, and a
// mouse click sets a walk target for players who prefer the mouse. Escape
// pauses; Enter starts and restarts.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    interact: false,
    smoke: false,
    clickTarget: null,
    paused: false,
    confirm: false,
  };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === ' ' && !e.repeat) input.smoke = true;
    if (k === 'escape' && !e.repeat) input.paused = !input.paused;
    if (k === 'enter' && !e.repeat) input.confirm = true;
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.clickTarget = {
      x: ((e.clientX - rect.left) / rect.width) * 1280,
      y: ((e.clientY - rect.top) / rect.height) * 720,
    };
  });

  // Fold the raw keys and the click target into one movement vector.
  input.poll = function poll(thief) {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (x === 0 && y === 0 && input.clickTarget) {
      const dx = input.clickTarget.x - thief.x;
      const dy = input.clickTarget.y - thief.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 14) {
        input.clickTarget = null;
      } else {
        x = dx / dist;
        y = dy / dist;
      }
    }
    if (x !== 0 || y !== 0) input.clickTarget = null;
    input.mx = x;
    input.my = y;
    input.sneak = keys.has('shift');
    input.interact = keys.has('e');
    return input;
  };

  // One-shot flags (smoke, confirm) are consumed by the game loop each
  // frame so a single press never fires twice.
  input.consume = function consume() {
    const out = { smoke: input.smoke, confirm: input.confirm };
    input.smoke = false;
    input.confirm = false;
    return out;
  };

  return input;
}
