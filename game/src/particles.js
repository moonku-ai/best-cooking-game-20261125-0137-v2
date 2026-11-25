// Warung Senja v2 — particles, floating texts and screen shake (game-feel juice).
// Visual only: never touches the simulation.

export function createFx() {
  return { particles: [], floats: [], trauma: 0, t: 0 };
}

export function burst(fx, x, y, color, n = 10, speed = 90) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    fx.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
      life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 4,
    });
  }
}

export function steam(fx, x, y) {
  fx.particles.push({
    x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 8,
    vy: -28 - Math.random() * 18, life: 0.9, max: 0.9,
    color: 'rgba(255,255,255,0.55)', size: 5 + Math.random() * 5, steam: true,
  });
}

export function floatText(fx, x, y, text, color = '#059669') {
  fx.floats.push({ x, y, text, color, life: 1.2, max: 1.2 });
}

export function addTrauma(fx, amount) {
  fx.trauma = Math.min(1, fx.trauma + amount);
}

export function updateFx(fx, dt) {
  fx.t += dt;
  fx.trauma = Math.max(0, fx.trauma - 1.4 * dt);
  for (const p of fx.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.steam) { p.vy -= 6 * dt; p.size += 6 * dt; }
    else p.vy += 160 * dt;
    p.life -= dt;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const f of fx.floats) { f.y -= 42 * dt; f.life -= dt; }
  fx.floats = fx.floats.filter((f) => f.life > 0);
}

// Camera offset from decaying trauma (trauma^2, summed sines — no per-frame buzz).
export function shakeOffset(fx) {
  const s = fx.trauma * fx.trauma;
  if (s <= 0.001) return { x: 0, y: 0 };
  return {
    x: 10 * s * Math.sin(fx.t * 47),
    y: 7 * s * Math.sin(fx.t * 61),
  };
}
