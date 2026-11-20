# Israel Flight Simulator: notes for Claude Code

A single-page Three.js (r128, global `THREE` from cdnjs) flight simulator over Israel. Plain classic scripts, no modules,
no bundler, no framework. Everything shares one global scope, so the load order in `index.html` matters.

## Commands

- Run: open `index.html` (or serve the folder).
- Single-file build: `python3 tools/build.py` → `dist/index.html`. Rebuild it after any change if `dist/` is kept in git.
- Test: `python3 tools/smoke_test.py` (needs `pip install playwright && playwright install chromium`). It loads the page
  headlessly, reports JS errors, steps the flight model in all three modes and writes `smoke.png`.
- Syntax check: `for f in src/*.js; do node --check $f; done`.
- Data: `python3 tools/make_estimate.py && python3 tools/ghsl2bld.py` (inputs in `raw/`, see README).

## World conventions

- 1 unit = 1 m, but the map is compressed 4:1 horizontally (elevation is real). `KX = 23750`, `KZ = 27700` world metres per
  degree. `lon2x`, `lat2z`, `x2lon`, `z2lat` convert. North = −Z, East = +X, Up = +Y.
- Map window: lon 33.6–36.4, lat 29.2–33.6. Terrain grid `NX × NZ` is 384 × 704 on desktop, 240 × 440 on touch devices
  (`HIRES`). The outer ring of vertices is stretched to the horizon.
- Aircraft body axes: nose −Z, right +X, up +Y. Attitude is the quaternion `S.q`; `readAttitude()` derives `S.pitch`,
  `S.bank` (right positive) and `S.hdg` (degrees) with Euler order `YXZ`.
- `renderer.logarithmicDepthBuffer` is on. Every custom `ShaderMaterial` must include the `logdepthbuf_*` chunks and set
  `material.extensions.fragDepth = true` (see `SHADER_VS`, `TERRAIN_FS`, `WATER_FS`).
- Three r128 quirk: `InstancedMesh.setColorAt` only tints if the material has `vertexColors: true` and the geometry has a
  white `color` attribute; and the colour buffer is sized by `count` at the first `setColorAt`, so call it before lowering `count`.

## Source map

| File | Sections | Contents |
| --- | --- | --- |
| `src/data.js` | 0 | Generated. `BLD_PNG` (settlement raster) and `LOCS` (localities). Never hand-edit; it is one 400 KB line |
| `src/01-geography.js` | 1–4 | Math helpers, noise, the lon/lat tables for coast, rift, ridge; `rawHeight`, `waterLevel`; airports, runways; `CITIES` (legacy list, still used for road routing and minarets); height grid `HGT`, `heightAt`, `groundAt`; `terrainColor` |
| `src/02-scene-terrain.js` | 5 | Renderer, camera, lights, noise and field textures, terrain and water shaders, `buildTerrain`, `buildWater` |
| `src/03-world.js` | 6, 7, 7b, 7c | Airports; `buildCities` (from the raster); landmarks; roads and traffic; camera-local trees (`updateScatter`); ponds, industry, ships; Hebrew sky labels; Nahalal, pivot fields, railways and trains; rivers |
| `src/04-sky.js` | 8 | Sky shader, clouds, sun glare, time of day (`TOD`, `applyTOD`), shared uniforms `ENV` |
| `src/05-aircraft.js` | 9 | `PLANES` specs, the four 3D models, flight deck, `selectPlane` |
| `src/06-flight.js` | 10, 11 | State `S`, `spawn`, flight-law helpers (`pitchFor`, `rollFor`), `updateControls` (autoland, autopilot, assisted and manual laws), `physics`, `updateSystems`, cameras |
| `src/07-hud-and-modes.js` | 12, 12b, 12d, 12e | PFD, minimap, hints, key guide; settings (`SAVE`), smoke trails, air traffic, weather, photo mode; Easy mode (`arcadeStep`), translations (`L`, `TRD`, `applyLang`); obstacle hash, explosion, level buttons |
| `src/08-app.js` | 13–17 | Audio (`Snd`), input (`action`), menus, main `loop`, boot (`init`) |

## Flight modes (`S.mode`, set only through `setMode`)

- 0 Easy (`S.arc`): `arcadeStep` replaces the physics. The stick steers the flight path directly, the lever sets speed,
  release flies straight and level, there is an automatic flare near the ground. Crashes: water, hillside, too fast, buildings.
- 1 Medium (`S.assist`): real physics with flight-path hold, automatic gear and flaps, stall and terrain protection.
- 2 Expert: real physics, rate command with flight-path hold when the stick is released, manual gear and flaps.
- Autoland (`S.land`) and the autopilot (`S.ap.on`) always run on the physics path, also from Easy mode.
- Pitch input is positive = nose up in every mode; `SAVE.inv` flips it for people who want a real stick.

## Settlement data

One pixel of `BLD_PNG` is one 60 m game block (240 m of real ground): R height in metres, G style in bits 0–2
(1 apartment block, 2 stone, 3 red-roofed houses, 4 glass tower) and footprint size in bits 3–4, B random seed, A present.
`buildCities` places one building (or a few houses) per pixel, in 12 km buckets with distance culling, and registers each
box in the obstacle hash `OBST` for collisions. `urbanAt` feeds the terrain shader's street grid, which is aligned to the
same 60 m lattice (`uOrg`).

## Known gaps and ideas

- The GHSL tile R6_C22 ends near latitude 33.1; north of it the raster is an estimate. Adding tile R5_C22 needs
  `tools/ghsl2bld.py` to mosaic two tiles.
- GHSL height is a 100 m average, so individual towers are invented (about 10% of the tallest cells).
- Never measured on a real phone. Roughly 77,000 building instances; if it stutters, lower the `far` distances in
  `buildCities` or raise the coverage threshold `TH` in `tools/ghsl2bld.py`.
- Terrain is formula-based (tables and Gaussian peaks in `rawHeight`), not a DEM. A real DEM could replace `rawHeight`
  through the same kind of embedded raster.
- Some toasts and the Medium/Expert hints are still English only; `TRD` and `L(en, he)` are the two translation mechanisms.
- Audio has only been checked for errors, never listened to.
- No licence file yet.

## Working style for this project

- Keep it dependency-free at runtime: one CDN script, everything else procedural or embedded.
- After changing flight laws, run the smoke test; it catches crashes in level flight and at take-off in all modes.
- User-facing text: Hebrew is the default language; add both strings with `L('English', 'עברית')`.
