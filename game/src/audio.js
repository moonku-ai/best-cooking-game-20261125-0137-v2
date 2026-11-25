// Warung Senja v2 — tiny synthesized sound effects (WebAudio, no assets, no network).
// Created lazily on the first user gesture; silent when AudioContext is unavailable.

let ctx = null;
let enabled = true;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  } catch { ctx = null; }
}

export function setSoundEnabled(v) { enabled = v; }
export function soundEnabled() { return enabled; }

function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
  if (!ctx || !enabled) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* audio is cosmetic; never break the game */ }
}

export const sfx = {
  pickup() { tone(520, 0.07, 'triangle', 0.08); },
  place() { tone(340, 0.08, 'triangle', 0.08); },
  chop() { tone(180, 0.05, 'square', 0.06, -60); },
  done() { tone(660, 0.1, 'sine', 0.1); setTimeout(() => tone(880, 0.12, 'sine', 0.1), 90); },
  serve() { tone(523, 0.1, 'triangle', 0.12); setTimeout(() => tone(659, 0.1, 'triangle', 0.12), 90); setTimeout(() => tone(784, 0.16, 'triangle', 0.12), 180); },
  burnt() { tone(140, 0.3, 'sawtooth', 0.08, -60); },
  lost() { tone(220, 0.25, 'sine', 0.08, -120); },
  error() { tone(160, 0.08, 'square', 0.05); },
  wash() { tone(440, 0.15, 'sine', 0.05, 220); },
  rush() { tone(392, 0.12, 'triangle', 0.1); setTimeout(() => tone(523, 0.14, 'triangle', 0.1), 110); },
};
