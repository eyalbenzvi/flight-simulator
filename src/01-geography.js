'use strict';
/* =====================================================================
   ISRAEL FLIGHT SIMULATOR – single file, everything procedural.
   World: 1 unit = 1 m, but the map is compressed 4:1 horizontally so the
   country (470 km) is ~118 km long and can be crossed in ~15 minutes.
   Axes: North = -Z, South = +Z, East = +X, West = -X, Up = +Y.
   ===================================================================== */

// ---------- 1. Math helpers ----------
const DEG = Math.PI / 180, KT = 1.94384, FT = 3.28084, G = 9.81;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap180 = d => ((d + 540) % 360) - 180;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(i, j) { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(i, j), hash2(i + 1, j), u), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), u), v);
}
function fbm(x, y, oct) { let n = 0, a = 0.5, t = 0; for (let o = 0; o < oct; o++) { n += a * vnoise(x, y); t += a; a *= 0.5; x *= 2.03; y *= 2.03; } return n / t; }
// piecewise-linear lookup table keyed by latitude
function tab(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const a = t[i - 1], b = t[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
  return t[t.length - 1][1];
}

// ---------- 2. Geography model (lon/lat driven) ----------
const LON0 = 33.6, LON1 = 36.4, LAT0 = 29.2, LAT1 = 33.6, KX = 23750, KZ = 27700;
/** The map is compressed 4:1 horizontally (real heights). Aloft the aircraft crosses it at a quarter of its true speed, so flight times
    and distances match the real country, and climbs and descents keep their true angle against the (equally compressed) terrain.
    On and near the ground, where runways and buildings are full size, it moves at full scale: hsAt blends between 15 and 120 m. */
const HSCALE = 0.25, hsAt = ra => 1 - (1 - HSCALE) * ss(15, 120, ra);
/** Real distance in metres for a world offset: the compression undone with the true metres per degree at 31.4°N. */
const REAL_X = 111320 * Math.cos(31.4 * Math.PI / 180) / KX, REAL_Z = 110950 / KZ, realDist = (dx, dz) => Math.hypot(dx * REAL_X, dz * REAL_Z);
// Terrain grid: 173 m cells on computers, 277 m on phones and tablets (the heaviest setting that still loads and runs comfortably there)
const HIRES = !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches), NX = HIRES ? 384 : 240, NZ = HIRES ? 704 : 440, FAR = 400000;
const lon2x = l => (l - 35) * KX, lat2z = l => -(l - 31.4) * KZ, x2lon = x => x / KX + 35, z2lat = z => 31.4 - z / KZ;
const X0 = lon2x(LON0), X1 = lon2x(LON1), Z0 = lat2z(LAT1), Z1 = lat2z(LAT0);

// Mediterranean coastline longitude per latitude (Sinai … Gaza … Tel Aviv … Haifa bay … Lebanon)
const T_COAST = [[29, 33.3], [31.05, 33.3], [31.13, 33.80], [31.21, 34.0], [31.32, 34.22], [31.42, 34.33], [31.52, 34.44], [31.67, 34.555], [31.80, 34.64], [31.93, 34.70], [32.02, 34.74], [32.05, 34.75], [32.08, 34.765], [32.17, 34.80], [32.33, 34.85], [32.45, 34.88], [32.50, 34.89], [32.61, 34.915], [32.70, 34.93], [32.80, 34.955], [32.835, 34.975], [32.86, 35.06], [32.93, 35.07], [33.0, 35.09], [33.09, 35.104], [33.3, 35.20], [33.6, 35.27]];
// Dead Sea Rift axis and floor elevation (Gulf of Eilat → Arava → Dead Sea → Jordan Valley → Kinneret → Hula)
const T_RIFT = [[29.2, 34.80], [29.55, 34.97], [30.0, 35.10], [30.5, 35.25], [31.1, 35.42], [31.75, 35.52], [32.0, 35.54], [32.5, 35.57], [32.8, 35.59], [33.3, 35.62], [33.6, 35.63]];
const T_FLOOR = [[29.2, -250], [29.3, -200], [29.52, -15], [29.56, 4], [29.8, 90], [30.1, 200], [30.4, 60], [30.7, -150], [31.0, -385], [31.05, -400], [31.75, -408], [31.8, -395], [32.0, -340], [32.5, -250], [32.69, -207], [32.92, -200], [33.0, -100], [33.1, 70], [33.3, 90], [33.6, 300]];
// Central mountain spine (Eilat Mts, Negev highlands, Hebron, Jerusalem, Samaria, Jezreel gap, Galilee)
const T_RIDGE = [[29.2, 34.74], [29.55, 34.84], [30.2, 34.78], [30.6, 34.80], [30.9, 34.85], [31.25, 34.98], [31.53, 35.10], [31.78, 35.20], [32.2, 35.27], [32.45, 35.25], [32.6, 35.25], [32.7, 35.30], [32.9, 35.38], [33.1, 35.40], [33.6, 35.45]];
const T_RIDGEH = [[29.2, 750], [29.7, 650], [30.2, 600], [30.6, 800], [30.9, 520], [31.25, 330], [31.53, 850], [31.78, 720], [32.2, 700], [32.45, 420], [32.58, 60], [32.7, 300], [32.9, 720], [33.0, 900], [33.1, 700], [33.6, 900]];
// Plateau east of the rift (Edom, Moab, Gilead, Golan)
const T_EAST = [[29.2, 1200], [30.3, 1300], [31.0, 1000], [31.5, 900], [32.3, 900], [32.6, 450], [32.9, 550], [33.2, 950], [33.6, 1100]];
const coastLon = lat => tab(T_COAST, lat), riftLon = lat => tab(T_RIFT, lat), ridgeLon = lat => tab(T_RIDGE, lat);

function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }

/** Elevation in metres for a lon/lat, before airports are levelled. */
// Named summits and craters [lon, lat, metres added, sigmaLon, sigmaLat]: Meron, Canaan, Ebal, Gerizim, Ba'al Hatzor, Scopus/Olives, Nebi Samwil, Halhul, Mount Ramon, Timna, Mount Shlomo, Menashe, western Galilee, and the two smaller makhteshim
const PEAKS = [[35.41, 32.997, 330, 0.03, 0.025], [35.5, 32.975, 150, 0.02, 0.018], [35.272, 32.235, 180, 0.02, 0.012], [35.272, 32.2, 150, 0.018, 0.012], [35.287, 31.977, 220, 0.025, 0.02], [35.245, 31.79, 60, 0.012, 0.02], [35.18, 31.833, 90, 0.012, 0.012],
  [35.11, 31.58, 120, 0.03, 0.03], [34.76, 30.5, 180, 0.04, 0.03], [34.95, 29.78, 150, 0.03, 0.03], [34.9, 29.59, 200, 0.03, 0.03], [35.08, 32.57, 120, 0.06, 0.04], [35.23, 32.99, 120, 0.05, 0.03], [34.99, 30.93, -260, 0.05, 0.022], [35.21, 30.955, -300, 0.03, 0.026]];
// Broad valley floors [lon, lat, floor level, sigmaLon, sigmaLat]: Jezreel, Beit Netofa, the Sharon
const VALES = [[35.22, 32.6, 70, 0.13, 0.05], [35.32, 32.81, 150, 0.07, 0.02], [35.0, 32.35, 40, 0.06, 0.12]];
// Volcanic cones of the Golan and the Ajloun highlands, east of the rift
const CONES = [[35.795, 33.11, 220, 0.012, 0.012], [35.785, 33.133, 200, 0.01, 0.01], [35.86, 32.955, 150, 0.012, 0.012], [35.8, 33.18, 150, 0.012, 0.012], [35.75, 32.33, 250, 0.08, 0.06]];
function rawHeight(lon, lat) {
  const d = lon - coastLon(lat);
  if (d < 0) return Math.max(-300, d * 1800);                          // Mediterranean seabed
  const rl = riftLon(lat), n1 = fbm(lon * 12, lat * 12, 4), n2 = fbm(lon * 48 + 5, lat * 48, 3);
  // coastal plain: low bluff behind the beach, then a slow rise inland; the Negev sits higher
  let h = 2 + 28 * ss(0.003, 0.02, d) + 70 * ss(0, 0.35, d) + 250 * ss(31.3, 30.6, lat);
  // central spine
  const rdx = lon - ridgeLon(lat), rg = Math.exp(-Math.pow(rdx / (rdx < 0 ? 0.17 : 0.13), 2));
  h += tab(T_RIDGEH, lat) * rg * (0.75 + 0.5 * n1) + (n1 - 0.5) * (40 + 220 * rg) + (n2 - 0.5) * 50 * rg;
  // Mount Tabor, the Gilboa ridge and the cone of Herodium
  h += 430 * Math.exp(-(Math.pow((lon - 35.39) / 0.016, 2) + Math.pow((lat - 32.687) / 0.013, 2)));
  h += 380 * Math.exp(-Math.pow(distSeg(lon, lat * 1.167, 35.36, 32.53 * 1.167, 35.45, 32.42 * 1.167) / 0.022, 2));
  h += 230 * Math.exp(-(Math.pow((lon - 35.241) / 0.008, 2) + Math.pow((lat - 31.666) / 0.007, 2)));
  for (const p of PEAKS) { const a = (lon - p[0]) / p[3], b2 = (lat - p[1]) / p[4], q = a * a + b2 * b2; if (q < 8) h += p[2] * Math.exp(-q); }
  for (const v of VALES) { const a = (lon - v[0]) / v[3], b2 = (lat - v[1]) / v[4], q = a * a + b2 * b2; if (q < 8) h -= Math.max(0, h - v[2]) * Math.exp(-q) * 0.85; }
  // Mount Carmel
  h += 480 * Math.exp(-Math.pow(distSeg(lon, lat * 1.167, 34.97, 32.83 * 1.167, 35.13, 32.62 * 1.167) / 0.035, 2));
  // Negev canyons (ridged noise carves wadis)
  const neg = ss(31.3, 30.8, lat);
  if (neg > 0) { const c = 1 - Math.abs(2 * fbm(lon * 36 + 9, lat * 36, 4) - 1); h -= neg * 150 * c * c * c; }
  // Makhtesh Ramon: elongated erosion crater with a raised rim
  { const dx = lon - 34.92, dy = (lat - 30.6) * 1.167, u = dx * 0.906 + dy * 0.423, v = -dx * 0.423 + dy * 0.906;
    const r = Math.hypot(u / 0.19, v / 0.05); h += -330 * ss(1, 0.7, r) + 70 * Math.exp(-Math.pow((r - 1.05) / 0.15, 2)); }
  // Judean terraces
  if (lat > 31.3 && lat < 32.1 && h > 350) h = lerp(h, Math.round(h / 35) * 35, 0.45);
  // Rift valley with lake basins
  let fl = tab(T_FLOOR, lat);
  { const kt = clamp((lat - 32.80) / 0.095, -1, 1); fl -= 45 * ss(1, 0.55, Math.hypot((lon - 35.59 - 0.006 * kt) / (0.066 * (1 + 0.24 * kt)), (lat - 32.80) / 0.095)); }    // Kinneret: harp-shaped, wider in the north
  fl -= 70 * ss(1, 0.6, Math.hypot((lon - rl) / 0.075, (lat - 31.55) / 0.225));       // Dead Sea: the deep northern basin only; the south is evaporation pans
  const ax = Math.abs(lon - rl), flat = 0.045 + 0.04 * ss(29.6, 29.3, lat);
  if (lon <= rl) h = lerp(h, fl, ss(flat + 0.125, flat, ax));
  else h = fl + (tab(T_EAST, lat) * (0.85 + 0.3 * n1) + (n2 - 0.5) * 80 - fl) * ss(flat, flat + 0.175, ax);
  // Mount Hermon
  h += 2000 * Math.exp(-(Math.pow((lon - 35.86) / 0.13, 2) + Math.pow((lat - 33.42) / 0.11, 2))) * (0.85 + 0.3 * n1);
  for (const p of CONES) { const a = (lon - p[0]) / p[3], b2 = (lat - p[1]) / p[4], q = a * a + b2 * b2; if (q < 8) h += p[2] * Math.exp(-q); }
  return h;
}

/** Water surface level at a point if there is water above terrain height h, else null. */
function waterLevel(lon, lat, h) {
  if (lon < coastLon(lat)) return 0;
  if (lat < 29.57 && h < 0) return 0;                                                   // Gulf of Eilat
  if (h < -212 && lat > 32.68 && lat < 32.94 && lon > 35.48 && lon < 35.70) return -212; // Kinneret
  if (h < -430 && lat > 30.98 && lat < 31.86 && lon > 35.25 && lon < 35.68) return -430; // Dead Sea
  return null;
}

// ---------- 3. Airports, runways, cities, waypoints ----------
function dirOf(hdg) { const r = hdg * DEG; return { x: Math.sin(r), z: -Math.cos(r) }; }
const AIRPORTS = [
  { code: 'LLBG', name: 'Ben Gurion', lon: 34.885, lat: 32.005, R: 2150, term: [400, 0], big: true },
  { code: 'LLHA', name: 'Haifa', lon: 35.043, lat: 32.81, R: 1450, term: [-350, 0] },
  { code: 'LLER', name: 'Eilat Ramon', lon: 35.005, lat: 29.72, R: 1850, term: [-420, 0] },
  { code: 'LLIB', name: 'Rosh Pina', lon: 35.572, lat: 32.985, R: 1000, term: [-260, 0] },
  { code: 'LLMZ', name: 'Masada (Bar Yehuda)', lon: 35.392, lat: 31.328, R: 1000, term: [-260, 0] },
  { code: 'LLBS', name: 'Beer Sheva', lon: 34.722, lat: 31.288, R: 1050, term: [260, 0] }
];
const RUNWAYS = [
  { ap: 0, name: '26', off: [0, -450], hdg: 260, len: 3000, w: 60, ils: false },
  { ap: 0, name: '12', off: [250, 500], hdg: 120, len: 3000, w: 60, ils: true },
  { ap: 1, name: '16', off: [0, 0], hdg: 160, len: 2200, w: 50, ils: true },
  { ap: 2, name: '19', off: [0, 0], hdg: 190, len: 3000, w: 60, ils: true },
  { ap: 3, name: '33', off: [0, 0], hdg: 330, len: 1500, w: 40, ils: true },
  { ap: 4, name: '01', off: [0, 0], hdg: 10, len: 1500, w: 40, ils: true },
  { ap: 5, name: '14', off: [0, 0], hdg: 140, len: 1600, w: 40, ils: true }
];
// [name, lon, lat, radius, buildings, style]   g = street grid, s = stone hill town, m = mixed
const CITIES = [['Tel Aviv',34.78,32.075,1500,1250,'g'],['Jerusalem',35.21,31.78,1400,950,'s'],['Haifa',35.0,32.795,1000,560,'m'],['Beer Sheva',34.79,31.25,800,200,'m'],['Eilat',34.94,29.56,520,120,'m'],
  ['Netanya',34.86,32.33,520,110,'g'],['Ashdod',34.66,31.80,600,130,'g'],['Tiberias',35.52,32.79,380,60,'s'],['Nazareth',35.30,32.70,520,90,'s'],['Acre',35.09,32.93,320,50,'s'],
  ['Ashkelon',34.58,31.67,480,80,'g'],['Rishon LeZion',34.80,31.965,560,110,'g'],['Rehovot',34.81,31.895,420,70,'g'],['Petah Tikva',34.89,32.095,520,100,'g'],['Herzliya',34.835,32.165,420,80,'g'],
  ['Kfar Saba',34.91,32.18,400,65,'g'],['Hadera',34.92,32.44,420,65,'g'],['Caesarea',34.90,32.50,260,26,'s'],['Zikhron Ya’akov',34.955,32.57,260,30,'s'],['Yokneam',35.11,32.66,280,35,'m'],
  ['Afula',35.29,32.61,380,55,'m'],['Migdal HaEmek',35.24,32.675,260,30,'m'],['Beit She’an',35.50,32.50,300,35,'m'],['Safed',35.50,32.965,340,50,'s'],['Rosh Pina',35.54,32.97,200,20,'s'],
  ['Kiryat Shmona',35.57,33.21,340,45,'m'],['Metula',35.578,33.28,180,18,'s'],['Katzrin',35.69,32.99,260,30,'m'],['Majdal Shams',35.77,33.27,240,30,'s'],['Nahariya',35.10,33.01,380,55,'g'],
  ['Ma’alot',35.27,33.015,260,30,'s'],['Karmiel',35.30,32.92,360,50,'m'],['Sakhnin',35.30,32.865,280,35,'s'],['Shefa-Amr',35.17,32.805,280,35,'s'],['Kiryat Bialik',35.085,32.84,380,55,'g'],
  ['Umm al-Fahm',35.15,32.52,320,45,'s'],['Modi’in',35.01,31.90,440,75,'m'],['Ramla',34.865,31.915,380,55,'m'],['Yavne',34.74,31.88,300,40,'g'],['Beit Shemesh',34.99,31.75,400,60,'s'],
  ['Kiryat Gat',34.77,31.61,380,55,'g'],['Sderot',34.60,31.525,260,30,'m'],['Netivot',34.59,31.42,280,35,'m'],['Ofakim',34.62,31.31,280,35,'m'],['Rahat',34.75,31.39,340,45,'s'],
  ['Arad',35.21,31.26,320,40,'m'],['Dimona',35.03,31.07,340,45,'m'],['Yeruham',34.93,30.99,220,24,'m'],['Sde Boker',34.79,30.87,150,12,'m'],['Mitzpe Ramon',34.80,30.61,240,28,'m'],
  ['Ein Gedi',35.385,31.46,150,12,'m'],['Ein Bokek',35.365,31.20,200,22,'g'],['Jericho',35.46,31.86,340,45,'s'],['Ma’ale Adumim',35.30,31.775,300,40,'s'],['Bethlehem',35.20,31.705,380,60,'s'],
  ['Hebron',35.10,31.53,520,90,'s'],['Ramallah',35.205,31.90,460,80,'s'],['Nablus',35.26,32.22,500,90,'s'],['Jenin',35.30,32.46,360,50,'s'],['Tulkarm',35.03,32.31,320,45,'s'],
  ['Qalqilya',34.97,32.19,280,35,'s'],['Ariel',35.17,32.105,260,30,'m'],['Gaza',34.47,31.51,620,120,'s'],['Khan Yunis',34.31,31.345,400,60,'s'],['Rafah',34.265,31.29,340,45,'s'],
  ['Yotvata',35.06,29.895,150,12,'m'],['Aqaba',35.01,29.53,460,70,'s'],['Amman',35.93,31.95,1300,330,'s'],['Irbid',35.85,32.555,520,80,'s'],['Madaba',35.79,31.72,300,35,'s'],
  ['Karak',35.70,31.18,280,30,'s'],['Tyre',35.20,33.27,340,45,'s'],['Quneitra',35.82,33.125,220,22,'s'],['Ein Gev',35.64,32.78,130,10,'m']
].map(c => ({ name: c[0], lon: c[1], lat: c[2], r: c[3], n: c[4], style: c[5] === 'g' ? 'grid' : c[5] === 's' ? 'stone' : 'mixed' }));
const WAYPOINTS = [['TLV', 34.78, 32.075], ['JRS', 35.21, 31.78], ['HFA', 35.0, 32.80], ['DEAD SEA', 35.47, 31.5], ['MASADA', 35.354, 31.316], ['EILAT', 34.95, 29.56]];

// ---------- 4. Terrain grid ----------
const HGT = new Float32Array((NX + 1) * (NZ + 1));
function buildHeights() {
  for (const ap of AIRPORTS) { ap.x = lon2x(ap.lon); ap.z = lat2z(ap.lat); { const e0 = Math.round(rawHeight(ap.lon, ap.lat)); ap.elev = e0 > -5 ? Math.max(6, e0) : e0; } }
  for (const rw of RUNWAYS) {
    const ap = AIRPORTS[rw.ap], d = dirOf(rw.hdg);
    rw.x = ap.x + rw.off[0]; rw.z = ap.z + rw.off[1]; rw.elev = ap.elev; rw.dx = d.x; rw.dz = d.z;
    rw.tx = rw.x - d.x * rw.len / 2; rw.tz = rw.z - d.z * rw.len / 2;       // landing threshold
    rw.label = ap.code + ' ' + rw.name;
  }
  for (let j = 0; j <= NZ; j++) {
    const lat = LAT1 - (LAT1 - LAT0) * j / NZ, z = lat2z(lat);
    for (let i = 0; i <= NX; i++) {
      const lon = LON0 + (LON1 - LON0) * i / NX, x = lon2x(lon);
      let h = rawHeight(lon, lat);
      if (lon >= coastLon(lat)) for (const ap of AIRPORTS) {                               // level the airfields
        const dd = Math.hypot(x - ap.x, z - ap.z);
        if (dd < ap.R + 900) h = lerp(h, ap.elev - 0.6, ss(ap.R + 900, ap.R + 100, dd));
      }
      HGT[j * (NX + 1) + i] = h;
    }
  }
}
function heightAt(x, z) {
  const fi = clamp((x - X0) / (X1 - X0) * NX, 0, NX - 0.0001), fj = clamp((z - Z0) / (Z1 - Z0) * NZ, 0, NZ - 0.0001);
  const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * (NX + 1) + i;
  return lerp(lerp(HGT[k], HGT[k + 1], u), lerp(HGT[k + NX + 1], HGT[k + NX + 2], u), v);
}
const _g = { h: 0, water: false, field: false };
/** Surface the aircraft can touch: terrain, pavement level on an airfield, or a water surface. */
/** The airfield proper: runways with their overruns and parallel taxiway, the taxiway to the terminal, and the apron. Buildings, roads
    and trees keep off it. It is much smaller than ap.R (the circle the ground is levelled in and where touching down is allowed): the
    runways are at real scale while the map around them is compressed 4:1, so the circle covers several real towns (Lod, Or Yehuda…). */
function airfieldAt(x, z, pad = 0) {
  const seg = (ax, az, bx, bz, r) => { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(x - ax - dx * t, z - az - dz * t) < r + pad; };
  for (const rw of RUNWAYS) { if (rw.x === undefined) continue; const ap = AIRPORTS[rw.ap], e = rw.len / 2 + 450;
    if (seg(rw.x - rw.dx * e, rw.z - rw.dz * e, rw.x + rw.dx * e, rw.z + rw.dz * e, rw.w / 2 + 230)) return true;
    if (seg(rw.x, rw.z, ap.x + ap.term[0], ap.z + ap.term[1], 70)) return true; }
  for (const ap of AIRPORTS) { if (ap.x === undefined) continue; const s = ap.big ? 1 : 0.45; if (Math.abs(x - ap.x - ap.term[0]) < 310 * s + 140 + pad && Math.abs(z - ap.z - ap.term[1]) < 210 * s + 160 + pad) return true; }
  return false;
}
function groundAt(x, z) {
  let h = heightAt(x, z); _g.water = false; _g.field = false;
  for (const ap of AIRPORTS) if (Math.hypot(x - ap.x, z - ap.z) < ap.R) { _g.field = true; h = ap.elev; }
  if (!_g.field) { const wl = waterLevel(x2lon(x), z2lat(z), h); if (wl !== null) { h = wl; _g.water = true; } }
  _g.h = h; return _g;
}

// Real woodland and planted forests: [lon, lat, sigmaLon, sigmaLat]
const FORESTS = [[35.03, 32.72, 0.05, 0.06], [35.5, 33.0, 0.04, 0.03], [35.4, 32.99, 0.05, 0.04], [34.97, 31.95, 0.03, 0.03], [35.08, 31.77, 0.07, 0.05], [35.0, 31.79, 0.03, 0.03], [35.05, 31.35, 0.05, 0.03], [35.05, 32.58, 0.05, 0.04],
  [34.87, 31.38, 0.03, 0.02], [35.75, 33.2, 0.03, 0.03], [35.4, 32.48, 0.04, 0.04], [35.39, 32.687, 0.02, 0.015], [35.25, 33.03, 0.1, 0.04], [35.55, 33.1, 0.02, 0.05], [35.31, 32.72, 0.03, 0.02], [34.99, 31.70, 0.04, 0.04], [35.15, 32.92, 0.04, 0.03]];
let FOREST = null;
/** Biome colour (o[0..2]), surface zones (o[3..6] = farmland, aridity, urban, ruggedness) and forest cover (o[7]) for one terrain vertex. */
function terrainColor(lon, lat, h, ny, o) {
  const d = lon - coastLon(lat), rl = riftLon(lat), rdx = lon - ridgeLon(lat);
  const n = fbm(lon * 40 + 11, lat * 40 + 3, 3);
  o[3] = o[4] = o[5] = o[7] = 0; o[6] = 0.3;
  if (d < 0) { o[0] = 0.62; o[1] = 0.58; o[2] = 0.44; return; }
  // aridity: Negev in the south, rain shadow east of the spine, steppe east of the rift
  let arid = ss(31.6, 30.95, lat);
  arid = Math.max(arid, ss(0.03, 0.12, rdx) * ss(32.5, 32.15, lat));
  if (lon > rl + 0.05) arid = Math.max(arid, 0.75 * ss(32.7, 32.1, lat));
  arid = clamp(arid + (n - 0.5) * 0.3, 0, 1);
  const hill = ss(150, 750, h);
  let forest = 0; for (const f of FORESTS) { const a = (lon - f[0]) / f[2], b = (lat - f[1]) / f[3], q = a * a + b * b; if (q < 6) forest = Math.max(forest, Math.exp(-q)); }
  forest = clamp(forest * (0.75 + n) * (1 - arid * 0.6), 0, 1);
  // Mediterranean green: lighter in the plains, darker maquis in the hills, darkest in the pine forests
  let r = lerp(0.40, 0.24, hill) + (n - 0.5) * 0.08, g = lerp(0.47, 0.36, hill) + (n - 0.5) * 0.08, b = lerp(0.22, 0.16, hill);
  r = lerp(r, 0.13, forest * 0.75); g = lerp(g, 0.27, forest * 0.75); b = lerp(b, 0.12, forest * 0.75);
  // basalt plateau of the Golan: darker and browner than the Galilee
  if (lon > rl + 0.06 && lat > 32.7) { const k = 0.4 * ss(rl + 0.06, rl + 0.14, lon); r = lerp(r, 0.36, k); g = lerp(g, 0.35, k); b = lerp(b, 0.22, k); }
  // desert: tan loess → red sandstone toward Eilat, pale chalk in the Judean Desert, sand seas in the west, dark granite at Eilat
  const red = clamp(ss(30.7, 29.8, lat) * 0.85 + (n - 0.5) * 0.4, 0, 1);
  let dr = lerp(0.80, 0.66, red) + (n - 0.5) * 0.10, dg = lerp(0.69, 0.41, red) + (n - 0.5) * 0.08, db = lerp(0.48, 0.28, red);
  { const chalk = 0.45 * ss(0.08, 0.16, rdx) * ss(31.15, 31.3, lat) * ss(32.0, 31.85, lat) * (lon < rl ? 1 : 0); dr = lerp(dr, 0.86, chalk); dg = lerp(dg, 0.80, chalk); db = lerp(db, 0.64, chalk);
    const sand = 0.55 * ss(34.72, 34.55, lon) * ss(30.8, 30.95, lat) * ss(31.25, 31.1, lat); dr = lerp(dr, 0.88, sand); dg = lerp(dg, 0.78, sand); db = lerp(db, 0.56, sand);
    const granite = 0.55 * ss(29.85, 29.65, lat) * ss(34.97, 34.9, lon); dr = lerp(dr, 0.40, granite); dg = lerp(dg, 0.27, granite); db = lerp(db, 0.23, granite); }
  r = lerp(r, dr, arid); g = lerp(g, dg, arid); b = lerp(b, db, arid);
  // beaches and coastal dunes
  let beach = 0; if (d < 0.012 && h < 28 && lat > 31.2) { beach = ss(0.012, 0.005, d); r = lerp(r, 0.91, beach); g = lerp(g, 0.83, beach); b = lerp(b, 0.60, beach); }
  if (d < 0.035 && lat > 31.55 && lat < 31.95) { const k = 0.6 * ss(0.035, 0.012, d) * (0.5 + n); r = lerp(r, 0.90, k); g = lerp(g, 0.82, k); b = lerp(b, 0.60, k); beach = Math.max(beach, k * 0.8); }
  // Dead Sea salt flats
  let salt = 0; if (lat > 30.98 && lat < 31.86 && Math.abs(lon - rl) < 0.12 && h < -410) { salt = ss(-410, -424, h); r = lerp(r, 0.95, salt); g = lerp(g, 0.95, salt); b = lerp(b, 0.92, salt); }
  o[0] = r; o[1] = g; o[2] = b;
  // zones used by the per-pixel terrain shader
  let urban = 0; const x = lon2x(lon), z = lat2z(lat);
  urban = urbanAt(x, z);
  const field = AIRPORTS.some(ap => Math.hypot(x - ap.x, z - ap.z) < ap.R + 250);
  const farm = (1 - arid) * (1 - hill) * ss(0.90, 0.975, ny) * (1 - beach) * (1 - salt) * (1 - urban) * (1 - forest) * (field ? 0 : 1);
  o[3] = farm; o[4] = arid; o[5] = urban; o[7] = forest;
  o[6] = clamp(0.3 + 0.5 * hill + 0.45 * arid, 0, 1) * (1 - 0.8 * urban) * (1 - 0.55 * farm) * (1 - 0.8 * salt) * (1 - 0.7 * beach) * (field ? 0.1 : 1);
}
