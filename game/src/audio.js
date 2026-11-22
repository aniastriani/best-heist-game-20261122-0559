// All sound is synthesized with the Web Audio API — no audio files ship
// with the game. A short blip for a grab, a low pulse while the alarm
// climbs, a sting when you are caught, and a little arpeggio for the
// getaway. The first user gesture unlocks the audio context.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, when, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + when + seconds);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + seconds + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    play(event) {
      if (!ensure()) return;
      if (event === 'loot') {
        tone(880, 0.12, 'sine', 0);
        tone(1318, 0.18, 'sine', 0.08);
      } else if (event === 'main-loot') {
        tone(523, 0.14, 'triangle', 0);
        tone(659, 0.14, 'triangle', 0.12);
        tone(784, 0.22, 'triangle', 0.24);
        tone(1046, 0.3, 'triangle', 0.36);
      } else if (event === 'smoke') {
        tone(220, 0.35, 'sine', 0, 90);
      } else if (event === 'chase') {
        tone(196, 0.16, 'square', 0);
        tone(147, 0.2, 'square', 0.14);
      } else if (event === 'caught') {
        tone(330, 0.25, 'sawtooth', 0, 110);
        tone(220, 0.4, 'sawtooth', 0.2, 70);
      } else if (event === 'escaped') {
        tone(523, 0.16, 'triangle', 0);
        tone(659, 0.16, 'triangle', 0.14);
        tone(784, 0.16, 'triangle', 0.28);
        tone(1046, 0.4, 'triangle', 0.42);
      } else if (event === 'alarm') {
        tone(1200, 0.07, 'square', 0);
      }
    },
  };
}
