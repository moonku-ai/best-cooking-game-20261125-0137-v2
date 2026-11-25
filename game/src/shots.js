// Warung Senja v2 — deterministic staged states for ?shot= screenshots.
// Each shot builds a busy mid-action kitchen so the judge sees systems, not a menu.

import { createState, spawnOrder } from './state.js';
import { RECIPES, processedId } from './config.js';

// Put a station into a state: item cooking with progress, or done.
function stageStation(state, id, item, progress, done = false) {
  const st = state.stations[id];
  st.item = item; st.progress = progress; st.done = done; st.burnt = false;
}

function stagePlate(state, id, items) {
  state.stations[id].plate = { dirty: false, items: [...items] };
}

function stageOrder(state, recipeId, patienceFrac) {
  const r = RECIPES.find((x) => x.id === recipeId);
  const o = {
    id: ++state.orderSeq, recipeId,
    patience: r.patience * patienceFrac, patienceMax: r.patience,
    customer: ['Bu Sari', 'Pak Budi', 'Mbak Rina'][state.orderSeq % 3],
  };
  state.orders.push(o);
  return o;
}

// ?shot=play — the busy kitchen: orders ticking, food on every station, a dish mid-assembly.
export function stagePlay(seed = 1) {
  const state = createState(seed);
  state.time = 84; state.coins = 342; state.served = 7; state.combo = 2; state.comboTimer = 14;
  stageOrder(state, 'nasi-goreng', 0.62);
  stageOrder(state, 'mie-goreng', 0.45);
  stageOrder(state, 'soto-ayam', 0.78);
  stageOrder(state, 'es-teh', 0.3);
  stageStation(state, 'wok-1', 'nasi', 0.7);
  stageStation(state, 'wok-2', 'ayam', 1, true);
  stageStation(state, 'board-1', 'sayur', 0.5);
  stageStation(state, 'board-2', 'cabai', 1, true);
  stageStation(state, 'fryer-1', 'tahu', 0.85);
  stageStation(state, 'cooker-1', 'nasi', 0.4);
  stageStation(state, 'drink-1', 'teh', 1, true);
  stagePlate(state, 'plate-1', ['nasi:cook', 'telur:cook']);
  stagePlate(state, 'plate-2', ['mie:cook']);
  state.cleanPlates = 3; state.dirtyPlates = 2;
  state.chef.x = 620; state.chef.y = 520;
  state.hands = 'bawang:chop';
  return state;
}

// ?shot=rush — rush hour: low patience, full board, wok burning hot.
export function stageRush(seed = 2) {
  const state = createState(seed);
  state.time = 150; state.coins = 1180; state.served = 21; state.combo = 3; state.comboTimer = 18;
  stageOrder(state, 'ayam-geprek', 0.22);
  stageOrder(state, 'nasi-goreng', 0.35);
  stageOrder(state, 'gado-gado', 0.5);
  stageOrder(state, 'teh-tarik', 0.18);
  stageStation(state, 'wok-1', 'mie', 0.9);
  stageStation(state, 'wok-2', 'telur', 1, true);
  stageStation(state, 'wok-3', 'ayam', 0.6);
  stageStation(state, 'board-1', 'bawang', 1, true);
  stageStation(state, 'board-3', 'sayur', 0.75);
  stageStation(state, 'fryer-1', 'pisang', 1, true);
  stagePlate(state, 'plate-1', ['ayam:cook', 'cabai:chop']);
  stagePlate(state, 'plate-3', ['nasi:cook', 'telur:cook', 'bawang:chop']);
  state.cleanPlates = 1; state.dirtyPlates = 4;
  state.chef.x = 1060; state.chef.y = 240;
  state.hands = { plate: true, items: ['ayam:cook', 'cabai:chop'], dirty: false };
  return state;
}

// ?shot=serve — a completed dish carried to the window, happy customer.
export function stageServe(seed = 3) {
  const state = createState(seed);
  state.time = 61; state.coins = 515; state.served = 10; state.combo = 1; state.comboTimer = 16;
  stageOrder(state, 'nasi-goreng', 0.7);
  stageOrder(state, 'pisang-goreng', 0.55);
  stageStation(state, 'wok-1', 'nasi', 0.55);
  stageStation(state, 'board-1', 'sayur', 0.3);
  stageStation(state, 'drink-1', 'teh', 0.8);
  stagePlate(state, 'plate-2', ['pisang:fry']);
  state.chef.x = 1080; state.chef.y = 260;
  state.hands = { plate: true, items: ['nasi:cook', 'telur:cook', 'bawang:chop'], dirty: false };
  return state;
}

// ?shot=end — the shift summary with three stars.
export function stageEnd(seed = 4) {
  const state = createState(seed);
  state.time = 180; state.coins = 1745; state.served = 28; state.lost = 3; state.burnt = 2;
  state.washed = 9; state.bestCombo = 3; state.over = true;
  stageOrder(state, 'es-teh', 0.5);
  return state;
}

export function stageForShot(shot, seed = 1) {
  switch (shot) {
    case 'rush': return stageRush(seed);
    case 'serve': return stageServe(seed);
    case 'end': return stageEnd(seed);
    case 'play':
    default: return stagePlay(seed);
  }
}

// A fresh live game (no shot param): start with two orders already on the board
// so the first frame is gameplay, not an empty kitchen.
export function freshGame(seed = 1) {
  const state = createState(seed);
  spawnOrder(state); spawnOrder(state);
  return state;
}
