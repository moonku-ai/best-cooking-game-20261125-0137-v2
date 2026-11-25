// Warung Senja v2 — game loop, movement, collision and interaction wiring.
// One job: connect input + state + render + juice. The rules live in state.js.

import { VIEW, STATIONS, FLOOR, CHEF } from './config.js';
import { createState, tick, interact, stationName } from './state.js';
import { createInput, moveVector } from './input.js';
import { createFx, burst, steam, floatText, addTrauma, updateFx, shakeOffset } from './particles.js';
import { render, drawPaused } from './render.js';
import { stageForShot, freshGame } from './shots.js';
import { ensureAudio, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1);
const frozen = params.get('frozen') === '1';

let state = shot ? stageForShot(shot, seed) : freshGame(seed);
let fx = createFx();
let input = createInput(canvas);
let paused = false;
let hint = '';
let hintTimer = 0;
let lastRush = false;
let steamTimer = 0;

// ---- Click-to-move pathfinding (A* on a coarse grid) ----
// Straight lines get stuck behind counters, so a click routes around them.
const CELL = 32;
const GRID_W = Math.ceil((FLOOR.x + FLOOR.w - FLOOR.x) / CELL);
const GRID_H = Math.ceil((FLOOR.y + FLOOR.h - FLOOR.y) / CELL);

function cellBlocked(gx, gy) {
  const cx = FLOOR.x + gx * CELL + CELL / 2;
  const cy = FLOOR.y + gy * CELL + CELL / 2;
  for (const st of Object.values(state.stations)) {
    if (cx > st.x - CHEF.r && cx < st.x + st.w + CHEF.r && cy > st.y - CHEF.r && cy < st.y + st.h + CHEF.r) return true;
  }
  return false;
}

function toCell(x, y) {
  return {
    x: Math.max(0, Math.min(GRID_W - 1, Math.floor((x - FLOOR.x) / CELL))),
    y: Math.max(0, Math.min(GRID_H - 1, Math.floor((y - FLOOR.y) / CELL))),
  };
}

function nearestFreeCell(gx, gy) {
  const found = freeCellNear(gx, gy);
  return found.cell;
}

// Nearest free cell to (gx, gy) plus how many rings out it was (0 = the cell itself).
function freeCellNear(gx, gy) {
  if (!cellBlocked(gx, gy)) return { cell: { x: gx, y: gy }, ring: 0 };
  for (let r = 1; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        if (!cellBlocked(nx, ny)) return { cell: { x: nx, y: ny }, ring: r };
      }
    }
  }
  return { cell: { x: gx, y: gy }, ring: 99 };
}

// Best standing spot next to a station: try below, right, left, above the rect
// and take the one whose nearest free cell is closest (crates sit in a solid
// wall, so "below" alone can be many rings away).
function bestApproach(st) {
  const cands = [
    { x: st.x + st.w / 2, y: st.y + st.h + 34 },
    { x: st.x + st.w + 34, y: st.y + st.h / 2 },
    { x: st.x - 34, y: st.y + st.h / 2 },
    { x: st.x + st.w / 2, y: st.y - 34 },
  ];
  let best = null;
  for (const p of cands) {
    const cell = toCell(p.x, p.y);
    const found = freeCellNear(cell.x, cell.y);
    if (!best || found.ring < best.ring) {
      best = { ring: found.ring, x: FLOOR.x + found.cell.x * CELL + CELL / 2, y: FLOOR.y + found.cell.y * CELL + CELL / 2 };
    }
  }
  return best;
}

function findPath(from, to) {
  const start = nearestFreeCell(from.x, from.y);
  const goal = nearestFreeCell(to.x, to.y);
  const key = (c) => `${c.x},${c.y}`;
  const open = [{ ...start, g: 0, f: 0, parent: null }];
  const best = new Map([[key(start), 0]]);
  const closed = new Set();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const cells = [];
      let n = cur;
      while (n) { cells.unshift(n); n = n.parent; }
      return cells.map((c) => ({ x: FLOOR.x + c.x * CELL + CELL / 2, y: FLOOR.y + c.y * CELL + CELL / 2 }));
    }
    closed.add(key(cur));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      if (cellBlocked(nx, ny) || closed.has(`${nx},${ny}`)) continue;
      // no corner cutting through blocked diagonals
      if (dx && dy && (cellBlocked(cur.x + dx, cur.y) || cellBlocked(cur.x, cur.y + dy))) continue;
      const g = cur.g + (dx && dy ? 1.414 : 1);
      if (best.has(`${nx},${ny}`) && best.get(`${nx},${ny}`) <= g) continue;
      best.set(`${nx},${ny}`, g);
      const h = Math.hypot(goal.x - nx, goal.y - ny);
      open.push({ x: nx, y: ny, g, f: g + h, parent: cur });
    }
  }
  return null;
}

function center(st) { return { x: st.x + st.w / 2, y: st.y + st.h / 2 }; }

function setMoveTarget(x, y) {
  const c = state.chef;
  const path = findPath(toCell(c.x, c.y), toCell(x, y));
  c.path = path || [{ x, y }];
  c.target = { x, y };
}

// How far the chef can reach a station (edge distance): the aisle beside the
// crate wall is ~160px from a crate's centre, so reach must clear that.
const REACH = 150;

function nearestStation() {
  const c = state.chef;
  let best = null, bestD = REACH;
  for (const st of Object.values(state.stations)) {
    const ctr = center(st);
    const dx = ctr.x - c.x, dy = ctr.y - c.y;
    const d = Math.hypot(dx, dy);
    // distance to the station's edge, not its centre, so big stations are reachable
    const edge = d - Math.max(st.w, st.h) / 2;
    if (edge < bestD) { bestD = edge; best = st; }
  }
  return best;
}

function collideChef() {
  const c = state.chef;
  c.x = Math.max(FLOOR.x + CHEF.r, Math.min(FLOOR.x + FLOOR.w - CHEF.r, c.x));
  c.y = Math.max(FLOOR.y + CHEF.r, Math.min(FLOOR.y + FLOOR.h - CHEF.r, c.y));
  // push out of station rectangles (simple AABB)
  for (const st of Object.values(state.stations)) {
    const nx = Math.max(st.x, Math.min(c.x, st.x + st.w));
    const ny = Math.max(st.y, Math.min(c.y, st.y + st.h));
    const dx = c.x - nx, dy = c.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < CHEF.r * CHEF.r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = CHEF.r - d;
      if (d2 === 0) { c.y = st.y + st.h + CHEF.r; }
      else { c.x += (dx / d) * push; c.y += (dy / d) * push; }
    }
  }
}

function doInteract(st) {
  if (!st) return;
  ensureAudio();
  const before = { coins: state.coins, served: state.served, dirty: state.dirtyPlates, clean: state.cleanPlates };
  const label = interact(state, st.id);
  const ctr = center(st);
  hint = label; hintTimer = 2.5;
  if (state.coins > before.coins) {
    const pay = state.coins - before.coins;
    floatText(fx, ctr.x, st.y - 12, `+${pay} koin`, '#059669');
    burst(fx, ctr.x, ctr.y, '#F59E0B', 16, 120);
    addTrauma(fx, state.combo >= 2 ? 0.35 : 0.15);
    sfx.serve();
  } else if (label.includes('Gosong') || label.includes('gosong')) {
    sfx.burnt();
  } else if (label.includes('Mencuci')) {
    sfx.wash();
  } else if (label.startsWith('Ambil') || label.startsWith('Taruh') || label.startsWith('Letakkan')) {
    burst(fx, ctr.x, ctr.y, '#FDE68A', 5, 50);
    sfx.pickup();
  } else if (label.includes('Memasak') || label.includes('Mencuci')) {
    sfx.place();
  } else {
    sfx.error();
  }
}

function step(dt) {
  const v = moveVector(input);
  const c = state.chef;
  if (v.x || v.y) {
    c.x += v.x * CHEF.speed * dt;
    c.y += v.y * CHEF.speed * dt;
    c.dir = v.x < 0 ? -1 : v.x > 0 ? 1 : c.dir;
    c.moving = true;
    c.path = null; c.target = null; // keyboard steering cancels click-to-move
  } else if (c.path && c.path.length) {
    const wp = c.path[0];
    const dx = wp.x - c.x, dy = wp.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 10) { c.path.shift(); if (!c.path.length) { c.target = null; c.moving = false; } }
    else {
      c.x += (dx / d) * CHEF.speed * dt;
      c.y += (dy / d) * CHEF.speed * dt;
      c.dir = dx < 0 ? -1 : dx > 0 ? 1 : c.dir;
      c.moving = true;
    }
  } else c.moving = false;
  collideChef();

  // click: station in reach -> use it; floor -> walk there
  if (input.click) {
    const { x, y } = input.click;
    input.click = null;
    ensureAudio();
    const hit = Object.values(state.stations).find((st) => x >= st.x - 6 && x <= st.x + st.w + 6 && y >= st.y - 6 && y <= st.y + st.h + 6);
    if (hit) {
      const ctr = center(hit);
      if (Math.hypot(ctr.x - c.x, ctr.y - c.y) - Math.max(hit.w, hit.h) / 2 < REACH) doInteract(hit);
      else {
        const spot = bestApproach(hit);
        setMoveTarget(spot.x, spot.y);
        hint = `Berjalan ke ${stationName(hit.kind)}…`; hintTimer = 1.5;
      }
    } else if (y > FLOOR.y) {
      setMoveTarget(x, y);
    }
  }
  if (input.interactPressed) {
    input.interactPressed = false;
    const st = nearestStation();
    if (st) doInteract(st);
  }
  if (input.pausePressed) { input.pausePressed = false; paused = !paused; }

  // simulation
  const eventsBefore = state.events.length;
  tick(state, dt);
  for (let i = eventsBefore; i < state.events.length; i++) {
    const ev = state.events[i];
    if (ev.type === 'done') sfx.done();
    else if (ev.type === 'burnt') { sfx.burnt(); addTrauma(fx, 0.2); }
    else if (ev.type === 'lost') { sfx.lost(); addTrauma(fx, 0.25); }
    else if (ev.type === 'serve') { /* handled in doInteract */ }
    if (ev.type === 'lost' || ev.type === 'burnt') { hint = ev.text; hintTimer = 3; }
  }
  if (!lastRush && state.time >= 120 && !state.over) { sfx.rush(); hint = 'RUSH HOUR! Pesanan lebih cepat, bayaran +50%!'; hintTimer = 4; }
  lastRush = state.time >= 120;

  // steam wisps from hot stations
  steamTimer -= dt;
  if (steamTimer <= 0) {
    steamTimer = 0.25;
    for (const st of Object.values(state.stations)) {
      if (st.item && (st.kind === 'wok' || st.kind === 'fryer' || st.kind === 'cooker')) {
        steam(fx, st.x + st.w / 2, st.y + 8);
      }
    }
  }
  if (hintTimer > 0) hintTimer -= dt;
  updateFx(fx, dt);

  // restart after the shift ends
  if (state.over && input.keys.has('r')) { /* handled below via keydown */ }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && state.over) {
    state = freshGame((seed + 1) % 1000);
    fx = createFx();
    paused = false;
    hint = 'Shift baru dimulai!'; hintTimer = 2;
  }
  if (e.code === 'KeyM') { import('./audio.js').then((m) => m.setSoundEnabled(!m.soundEnabled())); }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && !state.over && !frozen) step(dt);
  else if (frozen) updateFx(fx, 0.016);
  else if (state.over) updateFx(fx, dt);

  ctx.save();
  const sh = shakeOffset(fx);
  ctx.translate(sh.x, sh.y);
  const hover = nearestStation();
  render(ctx, state, fx, hover ? hover.id : null, hintTimer > 0 ? hint : '');
  ctx.restore();
  if (paused && !state.over) drawPaused(ctx);
  requestAnimationFrame(frame);
}

// expose a tiny debug handle for the playtest driver
window.__warung = { get state() { return state; }, interact: (id) => doInteract(state.stations[id]), freshGame, debugPath: (x, y) => findPath(toCell(state.chef.x, state.chef.y), toCell(x, y)) };

requestAnimationFrame(frame);
