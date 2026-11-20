# Israel Flight Simulator · סימולטור טיסה מעל ישראל

A browser flight simulator over a procedurally built Israel: four aircraft, three difficulty levels, real settlement
footprints and building heights from satellite data, Hebrew and English interface. No build step is needed to run it.

סימולטור טיסה בדפדפן מעל ישראל: ארבעה מטוסים, שלוש רמות קושי, יישובים בצורתם האמיתית לפי נתוני לוויין, ממשק בעברית ובאנגלית.

## Run

Open `index.html` in a browser (it loads Three.js r128 from cdnjs, so the first load needs a connection).
With GitHub Pages enabled on the repository root, the same file is the live site.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Markup and CSS; loads the scripts in `src/` in order |
| `src/01-geography.js` … `src/08-app.js` | The simulator, split by subsystem (see `CLAUDE.md`); `src/03b-landmarks.js` holds the city landmarks |
| `src/data.js` | **Generated.** Settlement raster (base64 PNG) and the list of localities |
| `src/roads.js` | **Generated.** The road network from OpenStreetMap |
| `data/` | The same data as plain files, plus previews |
| `tools/build.py` | Inlines everything into one self-contained `dist/index.html` |
| `tools/make_estimate.py`, `tools/ghsl2bld.py` | The data pipeline that produces `src/data.js` |
| `tools/osm2roads.py` | Builds `src/roads.js` from an OpenStreetMap extract |
| `tools/smoke_test.py` | Headless load-and-fly test |

## Build a single file

```
python3 tools/build.py        # writes dist/index.html
```

## Rebuild the settlement data

Put the raw inputs in `raw/` (not committed):

- `GHS_BUILT_S_E2020_GLOBE_R2023A_54009_100_V1_0_R6_C22.tif` and `GHS_BUILT_H_ANBH_E2018_GLOBE_R2023A_54009_100_V1_0_R6_C22.tif`
  from the GHSL download page (tile R6_C22; add R5_C22 to cover the far north, see `CLAUDE.md`)
- `localities.json` from <https://github.com/arikw/israeli-localities> (`dist/localities.json`)
- `geojson-israel-municipalities/` from <https://github.com/tzagim/geojson-israel>

```
pip install -r tools/requirements.txt
python3 tools/make_estimate.py     # data/estimate.png, data/locs.json
python3 tools/ghsl2bld.py          # src/data.js, data/buildings.png
```

## Rebuild the road network

Download the Israel and Palestine extract into `raw/` and convert it (motorways, trunk, primary and secondary roads):

```
curl -o raw/israel_and_palestine.osm.pbf https://download.openstreetmap.fr/extracts/asia/israel_and_palestine.osm.pbf
pip install osmium
python3 tools/osm2roads.py          # src/roads.js
```

## Test

```
playwright install chromium
python3 tools/smoke_test.py               # the split source version
python3 tools/smoke_test.py dist/index.html
```

## Data sources and credit

- Built-up surface and building height: GHSL (Global Human Settlement Layer), European Commission, Joint Research Centre,
  GHS-BUILT-S and GHS-BUILT-H R2023A.
- Localities (names, coordinates, population): Israel Central Bureau of Statistics, via `arikw/israeli-localities`.
- Jurisdiction borders: Israel Ministry of Interior open data, via `tzagim/geojson-israel`.
- Places outside Israel: GeoNames `cities1000`, via the `reverse_geocoder` package.
- Roads in Israel and Palestine: © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0),
  <https://www.openstreetmap.org/copyright>. Roads beyond them (Jordan, Lebanon, Sinai) are hand-drawn.
- Rendering: Three.js r128.

Check each source's licence terms before redistributing the data. No licence has been chosen for this repository's own code yet.

Terrain, rivers, forests and landmarks are hand-modelled approximations, not survey data. The map is compressed 4:1
horizontally. Not for navigation.
