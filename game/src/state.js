// Warung Senja v2 — pure game state: orders, stations, plates, economy.
// No DOM, no canvas here, so node --test can drive it directly.

import {
  INGREDIENTS, RECIPES, STATIONS, CHEF, SHIFT_SECONDS, MAX_ORDERS,
  BURN_GRACE, COMBO_WINDOW, COMBO_MAX, processedId, itemLabel, servePayout, starsFor,
  spawnInterval, rushMultiplier, recipeById,
} from './config.js';

// Seeded RNG (mulberry32) so ?shot= states and tests are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createState(seed = 1) {
  const rng = mulberry32(seed);
  return {
    seed, rng,
    time: 0, // seconds into the shift
    coins: 0, served: 0, lost: 0, burnt: 0, washed: 0,
    combo: 0, comboTimer: 0, bestCombo: 0,
    orders: [], // {id, recipeId, patience, patienceMax, customer}
    nextOrderIn: 6, orderSeq: 0,
    stations: Object.fromEntries(STATIONS.map((s) => [s.id, {
      ...s, item: s.kind === 'crate' ? s.item : null, progress: 0, done: false, burnt: false,
      // plate tables hold: {dirty:false, items:[]} or null (no plate on the table)
      plate: null,
      washing: 0, // sink progress 0..1
    }])),
    chef: { x: CHEF.x, y: CHEF.y, dir: 1, moving: false, target: null },
    hands: null, // carried item id, or {plate:true, items:[...]} when carrying a plate
    cleanPlates: 6, dirtyPlates: 0,
    over: false,
    events: [], // {type, text, at} — render + audio consume these
    customers: [], // faces waiting at the window, {name, mood}
  };
}

const CUSTOMER_NAMES = ['Bu Sari', 'Pak Budi', 'Mbak Rina', 'Mas Agus', 'Nek Minah', 'Dek Putri', 'Bang Jaka', 'Bu Tini'];

export function spawnOrder(state) {
  if (state.orders.length >= MAX_ORDERS) return null;
  const recipe = RECIPES[Math.floor(state.rng() * RECIPES.length)];
  // Cheap drinks appear a little less often early, so the board is not all drinks.
  const order = {
    id: ++state.orderSeq,
    recipeId: recipe.id,
    patience: recipe.patience,
    patienceMax: recipe.patience,
    customer: CUSTOMER_NAMES[Math.floor(state.rng() * CUSTOMER_NAMES.length)],
  };
  state.orders.push(order);
  state.events.push({ type: 'order', text: `Pesanan baru: ${recipe.name}`, at: state.time });
  return order;
}

export function pickRecipeForOrder(state) { return spawnOrder(state); }

// One simulation tick (dt seconds). Pure: mutates state, records events.
export function tick(state, dt) {
  if (state.over) return;
  state.time += dt;
  if (state.time >= SHIFT_SECONDS) { state.time = SHIFT_SECONDS; state.over = true; return; }

  // combo decay
  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) { state.combo = 0; state.comboTimer = 0; }
  }

  // order spawner
  state.nextOrderIn -= dt * (state.time >= 120 ? 1 / rushMultiplier(state.time) : 1);
  if (state.nextOrderIn <= 0) {
    spawnOrder(state);
    state.nextOrderIn = spawnInterval(state.time);
  }

  // patience drains; expired orders are lost
  for (const o of [...state.orders]) {
    o.patience -= dt;
    if (o.patience <= 0) {
      state.orders = state.orders.filter((x) => x.id !== o.id);
      state.lost++;
      state.combo = 0; state.comboTimer = 0;
      state.events.push({ type: 'lost', text: `Pesanan ${recipeById(o.recipeId).name} hangus — pelanggan pergi`, at: state.time });
    }
  }

  // station processing (only cooking stations transform food; crates never cook)
  const COOK_KINDS = new Set(['board', 'wok', 'fryer', 'cooker', 'drink']);
  for (const st of Object.values(state.stations)) {
    if (!COOK_KINDS.has(st.kind)) continue;
    if (st.item && !st.done) {
      const ing = INGREDIENTS[st.item];
      if (ing) {
        st.progress += dt / ing.seconds;
        if (st.progress >= 1) {
          st.progress = 1; st.done = true;
          st.events = st.events || [];
          state.events.push({ type: 'done', text: `${ing.label} selesai`, at: state.time });
        }
      }
    } else if (st.item && st.done && st.kind !== 'cooker') {
      // left too long after done -> burns (rice cooker never burns)
      st.burnTimer = (st.burnTimer || 0) + dt;
      if (st.burnTimer > BURN_GRACE) {
        st.item = 'burnt'; st.burnt = true; st.done = false; st.burnTimer = 0;
        state.burnt++;
        state.events.push({ type: 'burnt', text: 'Makanan gosong! Buang ke tempat sampah.', at: state.time });
      }
    }
  }
  // sink washing runs on its own (it is not a cooking station)
  const sink = state.stations['sink-1'];
  if (sink && sink.washing > 0) {
    sink.washing += dt / 3;
    if (sink.washing >= 1) {
      sink.washing = 0;
      if (state.dirtyPlates > 0) { state.dirtyPlates--; state.cleanPlates++; state.washed++; }
    }
  }
}

// ---- Chef interactions (called by main.js on E / click) ----

// What happens when the chef uses a station. Returns a short label for the HUD.
export function interact(state, stationId) {
  const st = state.stations[stationId];
  if (!st) return '—';
  const hands = state.hands;

  switch (st.kind) {
    case 'crate': {
      if (hands) return 'Tangan penuh';
      state.hands = st.item; // raw ingredient id
      return `Ambil ${INGREDIENTS[st.item].label}`;
    }
    case 'board':
    case 'wok':
    case 'fryer':
    case 'cooker':
    case 'drink': {
      const ing = hands && typeof hands === 'string' ? INGREDIENTS[hands] : null;
      if (st.item) {
        if (st.done || st.burnt) {
          if (hands) return 'Tangan penuh';
          const taken = st.burnt ? 'burnt' : processedId(st.item);
          state.hands = taken;
          st.item = null; st.progress = 0; st.done = false; st.burnt = false; st.burnTimer = 0;
          return `Ambil ${itemLabel(taken)}`;
        }
        return 'Masih diproses…';
      }
      if (!ing) return st.kind === 'cooker' ? 'Bawa nasi mentah ke rice cooker' : 'Bawa bahan ke sini';
      if (ing.station !== st.kind && !(st.kind === 'cooker' && hands === 'nasi')) {
        return `Bahan ini bukan untuk ${stationName(st.kind)}`;
      }
      // rice cooker only takes nasi and never burns
      st.item = hands; st.progress = 0; st.done = false; st.burnt = false; st.burnTimer = 0;
      state.hands = null;
      return `Memasak ${ing.label}…`;
    }
    case 'plate': {
      // Table empty: put a clean plate from the stack on it (empty hands),
      // set down a carried plate, or — carrying food — plate it in one move.
      if (!st.plate) {
        if (hands && typeof hands === 'object' && hands.plate) {
          st.plate = hands; state.hands = null; return 'Letakkan piring';
        }
        if (hands === 'burnt') return 'Buang yang gosong ke tempat sampah';
        if (state.cleanPlates <= 0) return 'Piring bersih habis — cuci dulu!';
        st.plate = { dirty: false, items: [] };
        state.cleanPlates--;
        if (hands && typeof hands === 'string') {
          st.plate.items.push(hands); state.hands = null;
          return 'Taruh di piring';
        }
        return 'Piring siap di meja';
      }
      if (st.plate.dirty) return 'Piring kotor — cuci dulu di sink';
      if (hands && typeof hands === 'object' && hands.plate) return 'Meja sudah ada piring';
      if (hands && typeof hands === 'string') {
        if (hands === 'burnt') return 'Buang yang gosong ke tempat sampah';
        if (st.plate.items.length >= 3) return 'Piring penuh';
        st.plate.items.push(hands); state.hands = null;
        const dish = dishOnPlate(st.plate.items);
        return dish ? `${dish.name} lengkap! Bawa ke jendela saji` : 'Taruh di piring';
      }
      // empty hands: pick up the plate (with its food)
      state.hands = { plate: true, items: st.plate.items, dirty: false };
      st.plate = null;
      return 'Ambil piring';
    }
    case 'sink': {
      if (state.dirtyPlates <= 0) return 'Tidak ada piring kotor';
      if (st.washing > 0) return 'Sedang mencuci…';
      st.washing = 0.0001; // kick off the wash cycle
      return 'Mencuci piring…';
    }
    case 'trash': {
      if (!hands) return 'Tidak ada yang dibuang';
      if (hands === 'burnt') { state.hands = null; return 'Gosong dibuang'; }
      if (typeof hands === 'object' && hands.plate) {
        // dumping a plated dish: plate becomes dirty, food lost
        state.hands = null; state.dirtyPlates++;
        return 'Hidangan dibuang, piring kotor';
      }
      state.hands = null; return 'Bahan dibuang';
    }
    case 'serve': {
      if (!hands || typeof hands !== 'object' || !hands.plate) return 'Bawa piring hidangan ke sini';
      const dish = hands.items;
      const match = state.orders.find((o) => {
        const need = [...recipeById(o.recipeId).needs].sort();
        const got = [...dish].sort();
        return need.length === got.length && need.every((v, i) => v === got[i]);
      });
      if (!match) return 'Tidak ada pesanan yang cocok';
      const recipe = recipeById(match.recipeId);
      const pay = servePayout(recipe, state.time, state.combo + 1, match.patience, match.patienceMax);
      state.coins += pay;
      state.served++;
      state.combo = Math.min(COMBO_MAX, state.combo + 1);
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.comboTimer = COMBO_WINDOW;
      state.orders = state.orders.filter((o) => o.id !== match.id);
      state.hands = null;
      state.dirtyPlates++;
      state.events.push({ type: 'serve', text: `+${pay} koin — ${recipe.name} disajikan!`, at: state.time, pay });
      return `+${pay} koin!`;
    }
    default: return '—';
  }
}

export function stationName(kind) {
  return { board: 'talenan', wok: 'wajan', fryer: 'fryer', cooker: 'rice cooker', drink: 'stasiun minum', plate: 'meja plating', sink: 'sink', trash: 'tempat sampah', serve: 'jendela saji', crate: 'peti bahan' }[kind] || kind;
}

// Does the plate on a table complete a recipe? Returns the recipe or null.
export function dishOnPlate(items) {
  const got = [...items].sort();
  return RECIPES.find((r) => {
    const need = [...r.needs].sort();
    return need.length === got.length && need.every((v, i) => v === got[i]);
  }) || null;
}

export function stars(state) { return starsFor(state.coins); }
export function timeLeft(state) { return Math.max(0, SHIFT_SECONDS - state.time); }
export function isRush(state) { return state.time >= 120; }
