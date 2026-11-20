# Sunfall City

![make.fun](https://make.fun/badge/gta6-01.svg) ![rank](https://make.fun/badge/gta6-01/andruu21/gta6-openworld-01/rank.svg) ![reward](https://make.fun/badge/gta6-01/andruu21/gta6-openworld-01/reward.svg)

Entry for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01): an original open-world crime game that runs in desktop Chrome from plain static files — no build step, no libraries, no network.

Nova Reyes arrives in Sunfall City with two hundred dollars and the address of a fixer named Marisol Vega. Take jobs, steal cars, outrun the police, and work your way up the city's chain.

## Play

Serve `game/` with any static server (or `node serve.ts`) and open `http://localhost:8080` in desktop Chrome.

## Controls

- WASD — move on foot / drive
- Mouse — aim, left click — shoot / punch (drive-by works from cars)
- F — steal or enter the nearest car; F again to exit
- Q — switch weapon (fists / pistol)
- Scroll wheel or `-` / `=` — minimap zoom
- Esc — pause

## Features

- Grid city with downtown towers, shops, residential blocks, parks, a bay waterfront and city-name signs
- Day-night cycle with tinted lighting and lit windows
- Steal and drive cars (accel/brake/steer, skid marks, crash damage, fires, explosions) plus lane-following traffic
- Pedestrians who wander, flee gunfire and near-miss cars
- Wanted stars 0–5: crimes raise heat, foot cops and cruisers chase and shoot, heat decays when you hide
- Mission chain (story: deliveries, timed rampage contracts, checkpoint street races) with rising cash rewards
- HUD with health, money, wanted stars, objective, toasts and a zoomable minimap
- Start screen with story and Continue (localStorage autosave), pause menu, procedural WebAudio (engine, sirens, gunfire, mission jingles)
- Respawn on death (lose some cash, wanted cleared)

## Source layout

`game/js/` is split one job per file: `config.js`, `random.js`, `audio.js`, `save.js`, `city.js`, `effects.js`, `camera.js`, `player.js`, `vehicles.js`, `peds.js`, `combat.js`, `police.js`, `missions.js`, `hud.js`, `ui.js`, `main.js`.

## Handing in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` via the kit's `vendor/makefun-game.ts`:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed. Screenshots in `screenshots/` are real renders of the game taken in headless Chromium.
