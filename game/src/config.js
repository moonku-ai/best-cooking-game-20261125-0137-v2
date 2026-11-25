// Warung Senja v2 — tuning, ingredients, recipes, station layout.
// One clear job: every number the game balances on lives here.

export const VIEW = { w: 1280, h: 800 };
export const SHIFT_SECONDS = 180;
export const RUSH_AT = 120; // rush hour starts when 60s remain
export const MAX_ORDERS = 4;
export const STAR_COINS = [500, 1000, 1600];
export const COMBO_WINDOW = 20; // seconds between serves to keep the combo alive
export const COMBO_MAX = 3;
export const TIP_THRESHOLD = 0.5; // patience fraction left for a +25% tip
export const BURN_GRACE = 8; // seconds past done before food burns (rice cooker never burns)

// Ingredients: id, label, colour, where it is processed, seconds on that station.
export const INGREDIENTS = {
  nasi:   { label: 'Nasi',    color: '#FFF7E0', process: 'cook',  seconds: 4, station: 'wok' },
  mie:    { label: 'Mie',     color: '#F5C542', process: 'cook',  seconds: 4, station: 'wok' },
  ayam:   { label: 'Ayam',    color: '#E8A87C', process: 'cook',  seconds: 5, station: 'wok' },
  telur:  { label: 'Telur',   color: '#FDE68A', process: 'cook',  seconds: 3, station: 'wok' },
  sayur:  { label: 'Sayur',   color: '#65A30D', process: 'chop',  seconds: 2.5, station: 'board' },
  bawang: { label: 'Bawang',  color: '#E9D5FF', process: 'chop',  seconds: 2, station: 'board' },
  cabai:  { label: 'Cabai',   color: '#DC2626', process: 'chop',  seconds: 2, station: 'board' },
  tahu:   { label: 'Tahu',    color: '#FEF3C7', process: 'fry',   seconds: 3.5, station: 'fryer' },
  pisang: { label: 'Pisang',  color: '#FACC15', process: 'fry',   seconds: 3.5, station: 'fryer' },
  teh:    { label: 'Teh',     color: '#92400E', process: 'brew',  seconds: 2, station: 'drink' },
  es:     { label: 'Es Batu', color: '#BAE6FD', process: 'brew',  seconds: 1, station: 'drink' },
};

// A processed item is "<id>:<process>" e.g. "nasi:cook". Raw items are just "<id>".
export function processedId(id) {
  const ing = INGREDIENTS[id];
  return ing ? `${id}:${ing.process}` : id;
}
export function itemLabel(item) {
  if (!item) return '';
  if (item === 'burnt') return 'Gosong';
  const [id, proc] = item.split(':');
  const ing = INGREDIENTS[id];
  if (!ing) return item;
  if (!proc) return ing.label;
  const verb = { chop: 'Cincang', cook: 'Masak', fry: 'Goreng', brew: 'Seduh' }[proc] || proc;
  return `${ing.label} ${verb}`;
}
export function itemColor(item) {
  if (!item) return '#888';
  if (item === 'burnt') return '#292524';
  const [id] = item.split(':');
  return (INGREDIENTS[id] || {}).color || '#888';
}

// Recipes: components are processed-item ids. price in coins, patience in seconds.
export const RECIPES = [
  { id: 'nasi-goreng', name: 'Nasi Goreng', price: 40, patience: 60,
    needs: ['nasi:cook', 'telur:cook', 'bawang:chop'], color: '#F97316' },
  { id: 'mie-goreng', name: 'Mie Goreng', price: 45, patience: 60,
    needs: ['mie:cook', 'sayur:chop', 'ayam:cook'], color: '#EAB308' },
  { id: 'ayam-geprek', name: 'Ayam Geprek', price: 50, patience: 55,
    needs: ['ayam:cook', 'cabai:chop'], color: '#DC2626' },
  { id: 'soto-ayam', name: 'Soto Ayam', price: 55, patience: 70,
    needs: ['ayam:cook', 'mie:cook', 'sayur:chop'], color: '#F59E0B' },
  { id: 'gado-gado', name: 'Gado-Gado', price: 45, patience: 65,
    needs: ['sayur:chop', 'tahu:fry', 'telur:cook'], color: '#16A34A' },
  { id: 'pisang-goreng', name: 'Pisang Goreng', price: 25, patience: 45,
    needs: ['pisang:fry'], color: '#CA8A04' },
  { id: 'teh-tarik', name: 'Teh Tarik', price: 15, patience: 35,
    needs: ['teh:brew'], color: '#92400E' },
  { id: 'es-teh', name: 'Es Teh Manis', price: 20, patience: 35,
    needs: ['teh:brew', 'es:brew'], color: '#0284C7' },
];

export function recipeById(id) { return RECIPES.find((r) => r.id === id); }

// Order spawn pacing: interval shrinks as the shift goes on; rush multiplies it.
export function spawnInterval(elapsed) {
  const t = Math.min(1, elapsed / SHIFT_SECONDS);
  return 14 - 6 * t; // 14s early -> 8s late
}
export function rushMultiplier(elapsed) { return elapsed >= RUSH_AT ? 0.6 : 1; }
export function payoutMultiplier(elapsed) { return elapsed >= RUSH_AT ? 1.5 : 1; }

// Serve payout: base * rush * combo, +25% tip when served with >50% patience left.
export function servePayout(recipe, elapsed, combo, patienceLeft, patienceMax) {
  let pay = recipe.price * payoutMultiplier(elapsed) * (1 + 0.25 * (combo - 1));
  if (patienceLeft / patienceMax > TIP_THRESHOLD) pay *= 1.25;
  return Math.round(pay);
}

export function starsFor(coins) {
  let s = 0;
  for (const t of STAR_COINS) if (coins >= t) s++;
  return s;
}

// ---- Kitchen floor plan (canvas 1280x800) ----
// Top bar 0..64, order rail 64..150, floor 150..800.
// Crates left, work stations centre, plating + sink + trash right, serve window top-right.
export const STATIONS = [
  // ingredient crates (take raw item)
  ...Object.keys(INGREDIENTS).map((id, i) => ({
    kind: 'crate', id: `crate-${id}`, item: id,
    x: 24 + (i % 2) * 86, y: 168 + Math.floor(i / 2) * 62, w: 78, h: 54,
  })),
  // chopping boards (aisle 72px from crates, 60px between columns)
  { kind: 'board', id: 'board-1', x: 260, y: 168, w: 120, h: 70 },
  { kind: 'board', id: 'board-2', x: 260, y: 258, w: 120, h: 70 },
  { kind: 'board', id: 'board-3', x: 260, y: 348, w: 120, h: 70 },
  // wok burners
  { kind: 'wok', id: 'wok-1', x: 440, y: 168, w: 120, h: 70 },
  { kind: 'wok', id: 'wok-2', x: 440, y: 258, w: 120, h: 70 },
  { kind: 'wok', id: 'wok-3', x: 440, y: 348, w: 120, h: 70 },
  // fryer + rice cooker + drink station
  { kind: 'fryer', id: 'fryer-1', x: 620, y: 168, w: 120, h: 70 },
  { kind: 'cooker', id: 'cooker-1', x: 620, y: 258, w: 120, h: 70 },
  { kind: 'drink', id: 'drink-1', x: 620, y: 348, w: 120, h: 70 },
  // plating tables
  { kind: 'plate', id: 'plate-1', x: 800, y: 168, w: 130, h: 70 },
  { kind: 'plate', id: 'plate-2', x: 800, y: 258, w: 130, h: 70 },
  { kind: 'plate', id: 'plate-3', x: 800, y: 348, w: 130, h: 70 },
  // sink + trash
  { kind: 'sink', id: 'sink-1', x: 980, y: 168, w: 120, h: 70 },
  { kind: 'trash', id: 'trash-1', x: 980, y: 258, w: 120, h: 70 },
  // serve window (top-right, under the order rail)
  { kind: 'serve', id: 'serve-1', x: 980, y: 348, w: 240, h: 70 },
];

export const CHEF = { x: 620, y: 560, r: 20, speed: 260 };
export const FLOOR = { x: 16, y: 158, w: 1248, h: 626 };
