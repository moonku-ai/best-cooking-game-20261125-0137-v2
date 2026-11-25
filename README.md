# Warung Senja v2

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/moonku-ai/best-cooking-game-20261125-0137-v2/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/moonku-ai/best-cooking-game-20261125-0137-v2/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

**Warung Senja v2** is an original top-down cooking game played in a desktop browser, offline, from static files. You are the cook of a small warung at dusk. Orders come in on the board — eight dishes on the menu — and a three-minute shift is yours to fill: fetch ingredients from the crates, chop them on the boards, fry them in the wok and fryer, brew drinks, build each dish on a plate and run it to the serving window before the customer walks away.

## How it plays

- **Eight dishes, one route each.** Nasi Goreng, Mie Goreng, Ayam Geprek, Soto Ayam, Gado-Gado, Pisang Goreng, Teh Tarik and Es Teh Manis. Every ingredient has its own chain: chop on the board, cook in the wok, fry in the fryer, brew at the drink station — the rice cooker never burns.
- **The kitchen is the puzzle.** Ten ingredient crates on the left, three chopping boards, three wok burners, a fryer, a rice cooker and a drink station in the middle, three plating tables, a sink and the serving window on the right. You carry one thing at a time, so every trip is a choice.
- **Pressure that grows.** Orders spawn faster as the shift goes on, and the last sixty seconds are RUSH HOUR: orders come twice as fast and pay 50% more. Food left too long on a burner burns and has to be thrown away. Six plates only — a served plate comes back dirty and must be washed at the sink.
- **Score:** base price, plus a 25% tip for serving with patience to spare, times a combo that grows when serves come quickly (up to x3), times the rush bonus. Three stars at 500 / 1,000 / 1,600 coins.
- **Feel:** chopping, sizzling and coin sounds synthesized in the browser (no audio files), steam wisps, floating coin pops and a small screen shake on every combo serve. Customers at the window show their mood as their patience runs down.

Controls: **WASD / arrows** to walk, **E** (or Space) to pick up, put down, process and serve. Click a station to use it, click the floor to walk there. **P** pauses, **M** mutes, **R** starts a new shift.

## Run it

```sh
node serve.ts
# open http://localhost:8080/game/index.html
```

Or open `game/index.html` through any static server. Node 22+ for `main.ts` (the make.fun entrypoint, which copies `game/` + `screenshots/` to `/output` and writes `dossier.json`).

Screenshots are staged deterministically from the real game: `game/index.html?shot=play|rush|serve|end&seed=7` (see `shots.json`). All four shots in `screenshots/` are real renders of the game's own code: a busy kitchen mid-shift, the rush, a serve at the window, and the end-of-shift results.

## Tests

```sh
node --test tests/*.test.mjs
# 11 tests: recipes, the full cook-and-serve flow, economy (combo/tip/rush),
# burn rules, order expiry, the plate wash cycle, station rejection, pacing, stars
```
