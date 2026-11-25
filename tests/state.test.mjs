// Warung Senja v2 — logic tests (node --test). No DOM needed: state.js is pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, tick, interact, spawnOrder, dishOnPlate, stars, timeLeft, isRush,
} from '../game/src/state.js';
import {
  INGREDIENTS, RECIPES, processedId, servePayout, starsFor,
  spawnInterval, rushMultiplier, payoutMultiplier,
} from '../game/src/config.js';

// Every recipe component must be a real processed item.
test('recipes: all needs are valid processed ingredients', () => {
  for (const r of RECIPES) {
    assert.ok(r.needs.length >= 1 && r.needs.length <= 3, r.id);
    for (const need of r.needs) {
      const [id, proc] = need.split(':');
      assert.ok(INGREDIENTS[id], `${r.id} unknown ingredient ${id}`);
      assert.equal(INGREDIENTS[id].process, proc, `${r.id} wrong process for ${id}`);
    }
  }
  assert.equal(RECIPES.length, 8);
});

// Full happy path: crate -> wok -> plate -> serve, coins land, combo grows.
test('flow: cook Nasi Goreng and serve it for coins', () => {
  const s = createState(7);
  const order = spawnOrder(s);
  // force the order to be Nasi Goreng so the test is deterministic
  order.recipeId = 'nasi-goreng';
  order.patience = 60; order.patienceMax = 60;

  // take nasi, cook it, plate it
  assert.match(interact(s, 'crate-nasi'), /Ambil Nasi/);
  assert.match(interact(s, 'wok-1'), /Memasak Nasi/);
  tick(s, 4.5);
  assert.equal(s.stations['wok-1'].done, true);
  assert.match(interact(s, 'wok-1'), /Ambil Nasi Masak/);
  assert.match(interact(s, 'plate-1'), /Taruh di piring/); // clean plate auto-placed
  assert.equal(s.cleanPlates, 5);
  // telur: cook and plate
  assert.match(interact(s, 'crate-telur'), /Ambil Telur/);
  interact(s, 'wok-2'); tick(s, 3.5);
  assert.match(interact(s, 'wok-2'), /Ambil Telur Masak/);
  assert.match(interact(s, 'plate-1'), /Taruh di piring/);
  // bawang cincang: chop and plate — completes the dish
  assert.match(interact(s, 'crate-bawang'), /Ambil Bawang/);
  interact(s, 'board-1'); tick(s, 2.5);
  assert.match(interact(s, 'board-1'), /Ambil Bawang Cincang/);
  assert.match(interact(s, 'plate-1'), /lengkap! Bawa ke jendela saji/);

  assert.equal(dishOnPlate(s.stations['plate-1'].plate.items).id, 'nasi-goreng');
  // pick up the plate and serve
  assert.match(interact(s, 'plate-1'), /Ambil piring/);
  const coinsBefore = s.coins;
  assert.match(interact(s, 'serve-1'), /koin!/);
  assert.ok(s.coins > coinsBefore, `coins ${coinsBefore} -> ${s.coins}`);
  assert.equal(s.served, 1);
  assert.equal(s.combo, 1);
  assert.equal(s.dirtyPlates, 1, 'served plate comes back dirty');
  assert.ok(!s.orders.some((o) => o.recipeId === 'nasi-goreng'), 'the served order is gone');
});

test('economy: combo, tip and rush multiply the payout', () => {
  const r = RECIPES.find((x) => x.id === 'teh-tarik'); // price 15
  assert.equal(servePayout(r, 10, 1, 30, 35), 19); // 15 * 1.25 tip = 18.75 -> 19
  assert.equal(servePayout(r, 10, 1, 10, 35), 15); // no tip, no combo
  assert.equal(servePayout(r, 10, 2, 10, 35), 19); // combo x2: 15*1.25=18.75 -> 19
  assert.equal(servePayout(r, 10, 3, 10, 35), 23); // combo x3: 15*1.5=22.5 -> 23
  assert.equal(servePayout(r, 150, 1, 10, 35), 23); // rush x1.5: 22.5 -> 23
  assert.equal(servePayout(r, 150, 3, 30, 35), 42); // rush + combo x3 + tip: 15*1.5*1.5*1.25=42.2 -> 42
});

test('burn: wok food left past done+8s burns; rice cooker never burns', () => {
  const s = createState(3);
  interact(s, 'crate-nasi'); interact(s, 'wok-1'); tick(s, 4.5);
  assert.equal(s.stations['wok-1'].done, true);
  tick(s, 7);
  assert.equal(s.stations['wok-1'].burnt, false);
  tick(s, 2);
  assert.equal(s.stations['wok-1'].burnt, true);
  assert.equal(s.stations['wok-1'].item, 'burnt');
  assert.equal(s.burnt, 1);
  assert.match(interact(s, 'wok-1'), /Ambil Gosong/);
  assert.match(interact(s, 'trash-1'), /Gosong dibuang/);

  const s2 = createState(3);
  interact(s2, 'crate-nasi'); interact(s2, 'cooker-1'); tick(s2, 4.5);
  assert.equal(s2.stations['cooker-1'].done, true);
  tick(s2, 60);
  assert.equal(s2.stations['cooker-1'].burnt, false);
  assert.equal(s2.stations['cooker-1'].item, 'nasi');
});

test('orders: patience drains, expiry loses the order and resets combo', () => {
  const s = createState(5);
  s.combo = 2; s.comboTimer = 10;
  const o = spawnOrder(s);
  o.patience = 1.5;
  tick(s, 2);
  assert.equal(s.orders.length, 0);
  assert.equal(s.lost, 1);
  assert.equal(s.combo, 0);
});

test('plates: wash cycle returns a dirty plate to clean', () => {
  const s = createState(9);
  s.dirtyPlates = 2; s.cleanPlates = 4;
  assert.match(interact(s, 'sink-1'), /Mencuci/);
  tick(s, 3.5);
  assert.equal(s.dirtyPlates, 1);
  assert.equal(s.cleanPlates, 5);
  assert.equal(s.washed, 1);
  assert.match(interact(s, 'sink-1'), /Mencuci/);
  tick(s, 3.5);
  assert.equal(s.dirtyPlates, 0);
  assert.equal(s.cleanPlates, 6);
  assert.equal(interact(s, 'sink-1'), 'Tidak ada piring kotor');
});

test('stations: wrong station rejects the ingredient', () => {
  const s = createState(11);
  interact(s, 'crate-sayur');
  assert.match(interact(s, 'wok-1'), /bukan untuk wajan/);
  assert.equal(s.hands, 'sayur', 'ingredient stays in hand after rejection');
  assert.match(interact(s, 'board-1'), /Memasak Sayur/);
});

test('pacing: spawn interval shrinks, rush speeds spawns and pays more', () => {
  assert.ok(spawnInterval(0) > spawnInterval(179));
  assert.equal(rushMultiplier(119), 1);
  assert.equal(rushMultiplier(120), 0.6);
  assert.equal(payoutMultiplier(119), 1);
  assert.equal(payoutMultiplier(150), 1.5);
  const s = createState(13);
  assert.equal(isRush(s), false);
  s.time = 121;
  assert.equal(isRush(s), true);
  assert.equal(timeLeft(s), 59);
});

test('stars: thresholds 500 / 1000 / 1600', () => {
  assert.equal(starsFor(0), 0);
  assert.equal(starsFor(499), 0);
  assert.equal(starsFor(500), 1);
  assert.equal(starsFor(999), 1);
  assert.equal(starsFor(1000), 2);
  assert.equal(starsFor(1600), 3);
  const s = createState(15);
  s.coins = 1000;
  assert.equal(stars(s), 2);
});

test('serve: wrong dish does not match any order', () => {
  const s = createState(17);
  const o = spawnOrder(s);
  o.recipeId = 'teh-tarik';
  s.hands = { plate: true, items: ['pisang:fry'], dirty: false };
  assert.equal(interact(s, 'serve-1'), 'Tidak ada pesanan yang cocok');
  assert.equal(s.served, 0);
  assert.ok(s.hands, 'plate stays in hand after a failed serve');
});

test('dishOnPlate: exact match only', () => {
  assert.equal(dishOnPlate(['nasi:cook', 'telur:cook', 'bawang:chop']).id, 'nasi-goreng');
  assert.equal(dishOnPlate(['nasi:cook', 'telur:cook']), null);
  assert.equal(dishOnPlate(['nasi:cook', 'telur:cook', 'bawang:chop', 'sayur:chop']), null);
  assert.equal(dishOnPlate(['teh:brew']).id, 'teh-tarik');
  assert.equal(dishOnPlate(['teh:brew', 'es:brew']).id, 'es-teh');
});
