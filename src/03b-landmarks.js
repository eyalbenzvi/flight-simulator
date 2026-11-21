'use strict';
// ---------- 7d. City landmarks: what every city of 60,000 or more is known for ----------
// Positions are real (lon, lat); heights are real; footprints are about half of real so they sit in the 4:1 compressed map.
// Each city's pieces are merged into three meshes (plain, windowed, shiny) and culled by distance like the city blocks.

/** [lon, lat, kind, options]. Kinds are the builders in LMK_KIND below. */
const LANDMARKS = {
  'Tel Aviv': [[34.7708, 32.0717, 'tower', { h: 142, w: 30, d: 30, col: 0xcfc6b2, top: 'crown' }], [34.7880, 32.0718, 'tower', { h: 238, w: 36, d: 36, col: 0x8fb0c8, glass: 1, top: 'slant' }],
    [34.7930, 32.0705, 'tower', { h: 110, w: 34, d: 26, col: 0xd8dde2, glass: 1 }], [34.7745, 32.0640, 'twin', { h: 160, col: 0x9fb6c9 }], [34.7816, 32.0813, 'tower', { h: 60, w: 50, d: 22, col: 0xe2dccd, top: 'flat' }],
    [34.7616, 32.0525, 'stadium', { len: 170, wid: 125, h: 24, rot: 0.3 }], [34.7915, 32.0686, 'arena', { r: 55, h: 26, col: 0xc9d2da }], [34.8044, 32.1133, 'campus', {}],
    [34.7895, 32.0808, 'hospital', { big: 1 }], [34.8130, 32.1010, 'park', { r: 380, lake: 1 }], [34.7744, 32.0753, 'mall', { w: 110, d: 80, h: 30, sign: 0xe14b3b }],
    [34.7735, 32.0985, 'hangars', { rot: -1.25 }], [34.7672, 32.0868, 'marina', { rot: -1.25 }], [34.7509, 32.0544, 'lighthouse', { h: 24 }]],
  'Ramat Gan': [[34.8016, 32.0837, 'tower', { h: 244, w: 40, d: 40, col: 0xb7c7d6, glass: 1, top: 'spire' }], [34.7998, 32.0850, 'tower', { h: 157, w: 32, d: 32, col: 0x9fb4c4, glass: 1 }],
    [34.8215, 32.0731, 'stadium', { len: 220, wid: 165, h: 30, rot: 0.1 }], [34.8222, 32.0447, 'park', { r: 330, trees: 1 }], [34.8427, 32.0452, 'hospital', { big: 1 }], [34.8435, 32.0688, 'campus', {}]],
  "Giv'atayim": [[34.8095, 32.0701, 'observatory', {}], [34.8128, 32.0676, 'tower', { h: 120, w: 30, d: 30, col: 0xd6d9dc }]],
  'Bene Beraq': [[34.8353, 32.0880, 'yeshiva', { dome: 0xc8b070 }], [34.8362, 32.0912, 'twin', { h: 130, col: 0x7f9fb8 }], [34.8333, 32.0938, 'hospital', {}], [34.8264, 32.0858, 'factory', { w: 150, d: 100, h: 18, col: 0xc8302a }]],
  'Holon': [[34.7772, 32.0137, 'ribbons', {}], [34.7698, 32.0103, 'arena', { r: 48, h: 22, col: 0xd8d2c4 }], [34.7930, 32.0090, 'park', { r: 240, lake: 1 }], [34.7850, 32.0220, 'tower', { h: 110, w: 30, d: 30, col: 0xd5d0c6 }]],
  'Bat Yam': [[34.7430, 32.0230, 'hotels', { n: 8, rot: 0.25 }], [34.7500, 32.0165, 'tower', { h: 120, w: 32, d: 32, col: 0xe0e4e8, glass: 1 }]],
  'Rishon LeZiyyon': [[34.7490, 31.9930, 'ferris', { r: 26 }], [34.8048, 31.9638, 'watertower', { h: 28, col: 0xd9cba8 }], [34.8040, 31.9650, 'synagogue', {}], [34.8030, 31.9622, 'factory', { w: 90, d: 60, h: 14, col: 0xa0754e }],
    [34.7350, 31.9870, 'hotels', { n: 6, rot: 0.3 }], [34.7785, 31.9890, 'mall', { w: 130, d: 90, h: 28, sign: 0xd8a62a }], [34.7900, 31.9750, 'twin', { h: 140, col: 0xc7d2dc }], [34.8010, 31.9500, 'campus', {}]],
  'Petah Tiqwa': [[34.8668, 32.0886, 'hospital', { big: 1 }], [34.8600, 32.1060, 'twin', { h: 150, col: 0x86a6c0 }], [34.8550, 32.1040, 'tower', { h: 170, w: 34, d: 34, col: 0x9cb5c9, glass: 1, top: 'spire' }],
    [34.8685, 32.1077, 'stadium', { len: 160, wid: 120, h: 20, rot: 0.6 }], [34.8664, 32.1003, 'mall', { w: 120, d: 90, h: 26, sign: 0x2a7bd8 }], [34.8870, 32.0870, 'synagogue', {}], [34.9120, 32.1040, 'park', { r: 260, lake: 1 }]],
  'Ashdod': [[34.6370, 31.8250, 'port', { rot: -0.95 }], [34.6350, 31.7980, 'watertower', { h: 32, col: 0xe6e2d6 }], [34.6450, 31.8020, 'arena', { r: 40, h: 30, col: 0xf2f0ea }], [34.6362, 31.7872, 'marina', { rot: -0.95 }],
    [34.6316, 31.7815, 'fortress', { s: 0.7 }], [34.6687, 31.8102, 'stadium', { len: 150, wid: 110, h: 18, rot: 0.5 }], [34.6560, 31.7960, 'twin', { h: 130, col: 0xd4dce4 }], [34.6490, 31.7860, 'tower', { h: 120, w: 30, d: 30, col: 0xe2e2dc }]],
  'Netanya': [[34.8500, 32.3300, 'hotels', { n: 9, rot: 0.15 }], [34.8644, 32.2932, 'stadium', { len: 170, wid: 120, h: 22, rot: 0.2 }], [34.8530, 32.3220, 'tower', { h: 130, w: 30, d: 30, col: 0xd9dfe4, glass: 1 }],
    [34.8450, 32.2850, 'twin', { h: 140, col: 0xc5d3df }], [34.8560, 32.3330, 'park', { r: 120, trees: 1 }]],
  "Be'er Sheva": [[34.7806, 31.2729, 'stadium', { len: 180, wid: 130, h: 22, rot: 0.1 }], [34.8013, 31.2621, 'campus', {}], [34.8008, 31.2582, 'hospital', { big: 1 }], [34.7930, 31.2440, 'mosque', { s: 1 }],
    [34.7965, 31.2412, 'watertower', { h: 22, col: 0xcdb48a }], [34.8104, 31.2643, 'twin', { h: 90, col: 0x8fb1cc }], [34.8086, 31.2501, 'mall', { w: 160, d: 100, h: 24, sign: 0xd8a62a }], [34.8200, 31.2360, 'park', { r: 300, lake: 1 }],
    [34.7920, 31.2550, 'tower', { h: 110, w: 30, d: 30, col: 0xd8d4c8 }]],
  'Ashqelon': [[34.5480, 31.6640, 'ruins', {}], [34.5540, 31.6820, 'marina', { rot: -1.0 }], [34.5350, 31.6370, 'desal', {}], [34.5900, 31.6700, 'stadium', { len: 140, wid: 100, h: 16, rot: 0.4 }],
    [34.5600, 31.6620, 'hospital', {}], [34.5700, 31.6800, 'tower', { h: 90, w: 28, d: 28, col: 0xe2ded2 }]],
  'Rehovot': [[34.8105, 31.9073, 'campus', {}], [34.8130, 31.9065, 'koffler', {}], [34.7995, 31.8710, 'hospital', {}], [34.8050, 31.8960, 'mall', { w: 100, d: 70, h: 22, sign: 0x2a7bd8 }], [34.8100, 31.8930, 'watertower', { h: 24 }]],
  'Bet Shemesh': [[34.9886, 31.7327, 'watertower', { h: 26 }], [35.0000, 31.7200, 'yeshiva', { dome: 0xb8a070 }], [34.9750, 31.7500, 'factory', { w: 160, d: 90, h: 16, col: 0xbfc4c8 }], [34.9930, 31.7440, 'tower', { h: 70, w: 26, d: 26, col: 0xd9cfb8 }]],
  'Herzliyya': [[34.7990, 32.1640, 'marina', { rot: -1.3 }], [34.8066, 32.1617, 'twin', { h: 120, col: 0x7fa2c0 }], [34.8075, 32.1949, 'fortress', { s: 0.8 }], [34.8433, 32.1758, 'campus', {}], [34.7975, 32.1575, 'hotels', { n: 4, rot: 0.2 }]],
  'Kefar Sava': [[34.8960, 32.1795, 'hospital', {}], [34.9126, 32.1812, 'mall', { w: 110, d: 80, h: 24, sign: 0x3aa64a }], [34.9200, 32.1700, 'park', { r: 220, lake: 1 }], [34.9050, 32.1760, 'tower', { h: 90, w: 28, d: 28, col: 0xdcdcd4 }]],
  'Hadera': [[34.9195, 32.4385, 'watertower', { h: 25, col: 0xc9a77a }], [34.9000, 32.4520, 'hospital', {}], [34.9300, 32.4300, 'park', { r: 300, trees: 1 }]],
  "Modi'in-Makkabbim-Re'ut": [[35.0055, 31.9040, 'park', { r: 300, lake: 1 }], [35.0137, 31.8965, 'watertower', { h: 30 }], [35.0100, 31.9000, 'mall', { w: 130, d: 90, h: 24, sign: 0xe14b3b }], [35.0160, 31.8930, 'twin', { h: 80, col: 0xd6d6d0 }]],
  "Modi'in Illit": [[35.0439, 31.9320, 'yeshiva', { dome: 0xc8b070 }], [35.0400, 31.9350, 'watertower', { h: 24 }]],
  'Lod': [[34.8963, 31.9479, 'mosque', { s: 1.1 }], [34.8987, 31.9486, 'church', { tower: 1 }], [34.8880, 31.9550, 'watertower', { h: 26 }]],
  'Ramla': [[34.8665, 31.9275, 'squareTower', { h: 30, col: 0xd8c9a6 }], [34.8706, 31.9284, 'mosque', { s: 1.2 }], [34.8720, 31.9260, 'church', { tower: 1 }], [34.8610, 31.9300, 'mall', { w: 90, d: 70, h: 20, sign: 0xd8a62a }]],
  "Ra'annana": [[34.8660, 32.1930, 'park', { r: 260, lake: 1 }], [34.8701, 32.1856, 'tower', { h: 80, w: 26, d: 26, col: 0xd8d8d0 }], [34.8580, 32.1960, 'twin', { h: 70, col: 0x8fb1cc }]],
  'Nazareth': [[35.2977, 32.7021, 'basilica', {}], [35.2985, 32.7036, 'mosque', { s: 0.9 }], [35.2958, 32.7085, 'church', { tower: 1 }], [35.3000, 32.7100, 'church', {}], [35.3100, 32.7040, 'watertower', { h: 22 }]],
  'Rahat': [[34.7536, 31.3905, 'mosque', { s: 1.4 }], [34.7600, 31.3950, 'mosque', { s: 0.9 }], [34.7500, 31.3850, 'watertower', { h: 24 }]],
  'Rosh HaAyin': [[34.9306, 32.1050, 'fortress', { s: 0.8 }], [34.9580, 32.0949, 'watertower', { h: 26 }]],
  'Hod HaSharon': [[34.8942, 32.1522, 'mall', { w: 90, d: 70, h: 20, sign: 0x3aa64a }], [34.8900, 32.1550, 'watertower', { h: 22 }]],
  'Betar Illit': [[35.1126, 31.6949, 'yeshiva', { dome: 0xb8a070 }], [35.1150, 31.6980, 'watertower', { h: 22 }]],
  'Nahariyya': [[35.0937, 33.0063, 'watertower', { h: 30, col: 0xe8e2d0 }], [35.0890, 33.0040, 'hotels', { n: 4, rot: 0.1 }], [35.1063, 33.0122, 'hospital', { big: 1 }], [35.0905, 33.0105, 'lighthouse', { h: 20 }]],
  'Qiryat Gat': [[34.7555, 31.6037, 'factory', { w: 280, d: 170, h: 30, col: 0xe8ecef }], [34.7700, 31.6100, 'watertower', { h: 26 }]],
  'Qiryat Atta': [[35.1085, 32.8042, 'watertower', { h: 24 }], [35.1050, 32.8060, 'mall', { w: 90, d: 70, h: 20, sign: 0xe14b3b }], [35.1150, 32.8000, 'factory', { w: 140, d: 80, h: 16, col: 0xb9a888 }]],
  'Haifa': [[35.0050, 32.8200, 'port', { rot: -0.55 }], [34.9720, 32.8272, 'lighthouse', { h: 22 }], [34.9705, 32.8266, 'church', { dome: 0xc9c3b0 }], [35.0220, 32.7770, 'campus', {}],
    [34.9900, 32.8330, 'hospital', { big: 1 }], [34.9680, 32.7840, 'stadium', { len: 200, wid: 150, h: 30, rot: 0.9 }], [35.0400, 32.8050, 'stacks', { n: 2, h: 200 }]],
  'Jerusalem': [[35.2297, 31.7785, 'sepulchre', {}], [35.2281, 31.7764, 'citadel', {}], [35.2223, 31.7745, 'tower', { h: 30, w: 70, d: 26, col: 0xe4d6b4, top: 'flat' }], [35.2233, 31.7752, 'squareTower', { h: 46, col: 0xe2d2ac }],
    [35.1907, 31.7516, 'stadium', { len: 190, wid: 145, h: 26, rot: 0.2 }], [35.1897, 31.7495, 'arena', { r: 52, h: 26, col: 0xd9d4c4 }], [35.1870, 31.7535, 'mall', { w: 200, d: 90, h: 26, sign: 0xd8a62a }],
    [35.1752, 31.7740, 'prism', {}], [35.2045, 31.7726, 'campus', { stone: 1 }], [35.1468, 31.7647, 'hospital', { big: 1, stone: 1 }], [35.2464, 31.7856, 'church', { tower: 1, h: 50 }],
    [35.2290, 31.7720, 'dormition', {}], [35.1920, 31.7558, 'tower', { h: 105, w: 26, d: 26, col: 0xe0d8c4 }], [35.2005, 31.7890, 'twin', { h: 100, col: 0xd9d2bf }]],
  'Gaza': [[34.4637, 31.5040, 'mosque', { s: 1.2 }], [34.4520, 31.5230, 'port', { rot: -1.0, small: 1 }], [34.4617, 31.5246, 'hospital', {}], [34.4450, 31.5150, 'hotels', { n: 5, rot: 0.6 }], [34.4700, 31.5100, 'tower', { h: 60, w: 24, d: 24, col: 0xd9d2c0 }]],
  'Khan Yunis': [[34.3047, 31.3443, 'fortress', { s: 0.8 }], [34.3065, 31.3452, 'mosque', {}]],
  'Rafah': [[34.2550, 31.2900, 'mosque', {}], [34.2600, 31.2850, 'watertower', { h: 22 }]],
  'Jabalia': [[34.4900, 31.5350, 'mosque', {}], [34.4950, 31.5300, 'watertower', { h: 22 }]],
  'Beit Lahia': [[34.4950, 31.5520, 'mosque', {}]],
  'Nuseirat': [[34.3900, 31.4500, 'mosque', {}]],
  'Deir al-Balah': [[34.3500, 31.4180, 'mosque', {}], [34.3400, 31.4200, 'park', { r: 220, trees: 1 }]],
  'Nablus': [[35.2289, 32.2253, 'campus', { stone: 1 }], [35.2622, 32.2203, 'mosque', { s: 1.2 }], [35.2735, 32.2005, 'ruins', {}], [35.2850, 32.2130, 'tomb', {}]],
  'Hebron': [[35.1105, 31.5246, 'patriarchs', {}], [35.1000, 31.5300, 'mosque', {}], [35.0950, 31.5400, 'watertower', { h: 22 }]],
  'Ramallah': [[35.1980, 31.9034, 'mausoleum', {}], [35.2050, 31.9000, 'tower', { h: 70, w: 26, d: 26, col: 0xd9cfb8 }], [35.2100, 31.9050, 'mosque', {}]],
  'Bethlehem': [[35.2075, 31.7043, 'nativity', {}], [35.2066, 31.7051, 'mosque', { s: 0.8 }], [35.2000, 31.7100, 'church', { tower: 1 }]],
  'Tulkarm': [[35.0300, 32.3100, 'mosque', {}]],
  'Yatta': [[35.0900, 31.4480, 'mosque', {}]],
  'Amman': [[35.9343, 31.9545, 'ruins', { big: 1 }], [35.9455, 31.9547, 'flagpole', { h: 126 }], [35.8760, 31.9622, 'twin', { h: 105, col: 0x8fa9bf }], [35.9134, 31.9622, 'mosque', { s: 1.6, dome: 0x2a6fb0 }],
    [35.9390, 31.9515, 'theater', {}], [35.9000, 31.9700, 'tower', { h: 140, w: 30, d: 30, col: 0xbcd0e0, glass: 1 }]],
  'Zarqa': [[36.0900, 32.0700, 'mosque', {}], [36.1300, 32.0500, 'stacks', { n: 2, h: 90 }]],
  'Irbid': [[35.8500, 32.5370, 'campus', { stone: 1 }], [35.8500, 32.5550, 'mosque', {}]],
  'Aqaba': [[35.0013, 29.5196, 'flagpole', { h: 130 }], [35.0000, 29.5000, 'port', { rot: 0.35 }], [35.0040, 29.5240, 'fortress', { s: 0.6 }]],
  'El Arish': [[33.8100, 31.1300, 'mosque', {}], [33.8250, 31.1500, 'port', { rot: -1.4, small: 1 }]],
  'Salt': [[35.7300, 32.0400, 'mosque', {}], [35.7270, 32.0388, 'church', { tower: 1 }]],
  'Daraa': [[36.1000, 32.6200, 'mosque', {}]],
  'Madaba': [[35.7900, 31.7180, 'church', { tower: 1 }]],
  'Tyre': [[35.2085, 33.2692, 'ruins', { big: 1 }], [35.1950, 33.2720, 'port', { rot: -1.6, small: 1 }], [35.2000, 33.2700, 'mosque', {}]],
  'Nawa': [[36.0400, 32.8900, 'mosque', {}]]
};

const LMK = { list: [], meshes: [], clear: new Map() };
/** Step 1, before buildCities: place every landmark (nudged off roads) and reserve its ground, so the generic blocks keep clear. */
/** Jerusalem's Old City: the outline of the walls (metres from the centre of the Temple Mount platform, x east, z south; clockwise from the north-west
    corner by the New Gate, Damascus Gate, Herod's Gate, the Stork Tower, the east wall, the Dung Gate, Zion Gate, the south-west corner, Jaffa Gate).
    The generic city blocks keep out; `buildOldCity` (src/07c-extras.js) fills it with a dense fabric of small stone houses. */
const OLDCITY = { x: lon2x(35.21) + 520, z: lat2z(31.78) + 60, poly: [[-420, -250], [-330, -288], [-170, -332], [-20, -302], [132, -292], [132, 300], [20, 312], [-60, 252], [-250, 322], [-400, 300], [-424, 20]] };
function inOldCity(x, z, pad) { const P = OLDCITY.poly, px = x - OLDCITY.x, pz = z - OLDCITY.z; let ins = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) ins = !ins; }
  if (!ins || !pad) return ins; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j], dx = xj - xi, dz = zj - zi, t = clamp(((px - xi) * dx + (pz - zi) * dz) / (dx * dx + dz * dz), 0, 1); if (Math.hypot(px - xi - dx * t, pz - zi - dz * t) < pad) return false; }
  return true; }
/** Two real bridges (built in src/07c-extras.js): the Motza viaduct that carries road 1 up to Jerusalem, high enough to fly under between its piers, and
    Jerusalem's Chords Bridge with its leaning mast and fan of cables. [kind, lon, lat, direction of the deck (radians, 0 = north-south), length, height] */
const BRIDGES = [['viaduct', 35.1655, 31.7965, 1.25, 540, 50], ['chords', 35.2005, 31.7890, 0.5, 300, 118]];
function planLandmarks() {
  for (const [, lon, lat, rot, len] of BRIDGES) for (let u = -len / 2; u <= len / 2; u += 70) reserveGround(lon2x(lon) + Math.sin(rot) * u, lat2z(lat) + Math.cos(rot) * u, 42);
  for (let a = -440; a <= 150; a += 55) for (let b = -340; b <= 330; b += 55) if (inOldCity(OLDCITY.x + a, OLDCITY.z + b)) reserveGround(OLDCITY.x + a, OLDCITY.z + b, 42);
  const R = { tower: 30, twin: 60, stadium: 130, arena: 60, campus: 140, hospital: 90, park: 0, mall: 80, hangars: 120, marina: 0, lighthouse: 12, observatory: 25, yeshiva: 60, factory: 120, ribbons: 40,
    hotels: 0, ferris: 30, watertower: 12, synagogue: 25, port: 0, fortress: 60, desal: 90, koffler: 20, squareTower: 15, mosque: 40, church: 40, basilica: 50, sepulchre: 50, citadel: 50, prism: 60,
    dormition: 35, patriarchs: 60, mausoleum: 40, nativity: 50, tomb: 15, ruins: 60, theater: 50, flagpole: 10, stacks: 60 };
  for (const city in LANDMARKS) for (const [lon, lat, kind, o] of LANDMARKS[city]) {
    let x = lon2x(lon), z = lat2z(lat); const r = (R[kind] || 40) * (o.s || 1), wet = kind === 'port' || kind === 'marina';
    if (r && !wet) { let best = null;                   // nudge off roads: rings of 8 directions out to 3 radii
      for (let k = 0; k <= (airfieldAt(x, z, r) ? 30 : 6) && !best; k++) for (let a = 0; a < (k ? 8 : 1); a++) {          /* a landmark that falls on an airfield (runways are full size on the compressed map) looks farther for free ground */ const d = k * r * 0.5, px = x + Math.cos(a * 0.785) * d, pz = z + Math.sin(a * 0.785) * d; if (!nearRoad(px, pz, r * 0.8) && !groundAt(px, pz).water && !airfieldAt(px, pz, r)) { best = [px, pz]; break; } }
      if (best) [x, z] = best; }
    if (!wet && r && wetAt(x, z, r * 0.8)) { let ok = false;          // part of it would stand in the sea or a lake: move it inland, up to 500 m, or leave it out
      for (let k = 1; k <= 10 && !ok; k++) for (let q = 0; q < 8; q++) { const px = x + Math.cos(q * 0.785) * k * 50, pz = z + Math.sin(q * 0.785) * k * 50; if (!wetAt(px, pz, r * 0.8) && !nearRoad(px, pz, r * 0.7)) { x = px; z = pz; ok = true; break; } }
      if (!ok) continue; }
    if (!wet && groundAt(x, z).water) continue;
    LMK.list.push({ city, x, z, kind, o, r });
    if (r) reserveGround(x, z, r + 15);
  }
  planSites();                                       // and the OpenStreetMap sites (src/03c-sites.js)
}
/** Keep the generic city blocks off a circle of ground (a landmark or a site stands there). */
function reserveGround(x, z, r) {
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const kk = (Math.floor(x / 1000) + a) + ':' + (Math.floor(z / 1000) + b); let l = LMK.clear.get(kk); if (!l) LMK.clear.set(kk, l = []); l.push([x, z, r]); }
}
/** True where a landmark stands, so buildCities leaves the block empty. */
function landmarkAt(x, z, pad) { const l = LMK.clear.get(Math.floor(x / 1000) + ':' + Math.floor(z / 1000)); return !!l && l.some(([lx, lz, r]) => Math.hypot(x - lx, z - lz) < r + (pad || 0)); }       // pad: half the size of what is being placed, so its edge keeps clear too

/** Collects transformed primitives with a colour each into three merged meshes (plain, windowed, shiny) for one city. */
class LmkBuilder {
  constructor(cx, cz) { this.cx = cx; this.cz = cz; this.p = { plain: [], win: [], shiny: [] }; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); }
  put(set, geo, col, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    this.e.set(rx, ry, rz, 'YXZ'); this.q.setFromEuler(this.e); this.m.compose(tmpV.set(x - this.cx, y, z - this.cz), this.q, tmpV2.set(sx, sy, sz));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(this.m); this.p[set].push([g, new THREE.Color(col)]); }
  meshes() {
    const out = [];
    for (const set of ['plain', 'win', 'shiny']) { const parts = this.p[set]; if (!parts.length) continue; let n = 0; for (const [g] of parts) n += g.attributes.position.count;
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
      for (const [g, c] of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); for (let i = 0; i < g.attributes.position.count; i++) { C[(o + i) * 3] = c.r; C[(o + i) * 3 + 1] = c.g; C[(o + i) * 3 + 2] = c.b; } o += g.attributes.position.count; g.dispose(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.computeBoundingSphere();
      out.push([set, geo]); }
    return out;
  }
}
const LG = {};      // shared unit primitives, base at y = 0
function lmkGeo() {
  if (LG.box) return LG;
  LG.box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  LG.cyl = s => LG['c' + s] || (LG['c' + s] = new THREE.CylinderGeometry(1, 1, 1, s).translate(0, 0.5, 0));
  LG.cone = s => LG['k' + s] || (LG['k' + s] = new THREE.ConeGeometry(1, 1, s).translate(0, 0.5, 0));
  LG.dome = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  LG.ball = new THREE.SphereGeometry(1, 14, 10);
  LG.ring = new THREE.TorusGeometry(1, 0.035, 6, 40);
  LG.bowl = new THREE.CylinderGeometry(1, 0.78, 1, 32, 1, true).translate(0, 0.5, 0);
  LG.tri = new THREE.CylinderGeometry(1, 1, 1, 3);
  // a stadium bowl, 1 across and 1 high: stands rising from the pitch to the rim, the outer wall, a roof over the main stand
  LG.stands = new THREE.LatheGeometry([[0.6, 0.0], [0.6, 0.07], [0.66, 0.1], [0.97, 0.78], [1.0, 0.8]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
  LG.wall = new THREE.CylinderGeometry(1.0, 1.02, 0.8, 40, 1, true).translate(0, 0.4, 0);
  LG.roof = new THREE.CylinderGeometry(0.86, 1.0, 0.1, 40, 1, true, -0.9, 1.8).translate(0, 0.96, 0);
  LG.roof2 = new THREE.CylinderGeometry(0.86, 1.0, 0.1, 40, 1, true, Math.PI - 0.9, 1.8).translate(0, 0.96, 0);
  LG.rim = new THREE.TorusGeometry(1.0, 0.025, 4, 40).rotateX(Math.PI / 2).translate(0, 0.8, 0);
  LG.ribs = new THREE.SphereGeometry(1, 16, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  LG.pitch = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 40).translate(0, 0.06, 0);     // thick enough to stand above uneven ground       // centred; laid along z with rx = -90°, apex up, it is a pitched roof
  return LG;
}
// colours
const STONE = 0xdccfae, CREAM = 0xe8e0cc, WHITE = 0xf2f0ea, CONC = 0xbfc2c4, GREEN = 0x4f7a3a, GOLD = 0xe0a91c, ROOF_RED = 0xa84a32;

/** The builders. b: LmkBuilder, (x, y, z): ground point, o: options, f(dx, dz): a local offset turned into world x, z by the landmark's rotation. */
const LMK_KIND = {
  tower(b, x, y, z, o) { const G = lmkGeo(), h = o.h, w = o.w || 30, d = o.d || 30, set = 'win', ry = o.ry || 0;
    b.put(set, G.box, o.col || CONC, x, y - 3, z, ry, w, h + 3, d);
    if (o.top === 'spire') { b.put('shiny', G.cyl(8), 0xd8dde2, x, y + h, z, 0, w * 0.18, 10, w * 0.18); b.put('plain', G.cone(8), 0xe8ecef, x, y + h + 10, z, 0, 2, h * 0.16, 2); }
    else if (o.top === 'crown') { b.put('plain', G.box, 0x8a8f94, x, y + h, z, ry, w * 0.7, 8, d * 0.7); b.put('plain', G.cyl(6), 0xd04030, x, y + h + 8, z, 0, 0.8, 22, 0.8); }
    else if (o.top === 'slant') { b.put('shiny', G.box, 0xbcd0e0, x, y + h - 6, z, ry, w * 1.02, 14, d * 1.02, 0.35); }
    else b.put('plain', G.box, 0x9a9ea2, x, y + h, z, ry, w * 0.5, 5, d * 0.5);
    if (o.glass) b.put('shiny', G.box, 0x7fa7c8, x, y + h * 0.2, z, ry, w * 1.01, h * 0.75, d * 1.01);
    addObst(x, z, w, d, ry, y - 3, y + h + 10); },
  twin(b, x, y, z, o) { const ry = o.rot || 0.4; for (const s of [-1, 1]) LMK_KIND.tower(b, x + Math.cos(ry) * 34 * s, y, z + Math.sin(ry) * 34 * s, { h: o.h * (s < 0 ? 1 : 0.88), w: 28, d: 28, col: o.col, glass: 1, ry }); },
  stadium(b, x, y, z, o) { const G = lmkGeo(), L = o.len, W = o.wid, h = o.h, r = o.rot || 0;
    b.put('plain', G.stands, 0x5d6976, x, y - 1, z, r, L / 2, h, W / 2); b.put('plain', G.wall, 0xd3d6d9, x, y - 1, z, r, L / 2, h, W / 2); b.put('plain', G.roof, 0xeeeeea, x, y - 1, z, r, L / 2, h, W / 2);
    b.put('plain', G.roof2, 0xeeeeea, x, y - 1, z, r, L / 2, h, W / 2); b.put('plain', G.rim, 0xb9bec3, x, y - 1, z, r, L / 2, h, W / 2);
    b.put('plain', G.pitch, 0x3d8f38, x, y - 1, z, r, L / 2, h, W / 2); b.put('plain', G.box, 0xf2f2ee, x, y - 1 + h * 0.12, z, r, 0.6, 0.15, W * 0.55);
    for (let k = 0; k < 4; k++) { const a = r + Math.PI / 4 + k * Math.PI / 2, mx = x + Math.cos(a) * L * 0.55, mz = z + Math.sin(a) * W * 0.55; b.put('plain', G.cyl(6), 0xcfd3d6, mx, y, mz, 0, 1.4, h + 30, 1.4); b.put('plain', G.box, 0xf6f2d0, mx, y + h + 30, mz, -a, 10, 5, 2); }
    addObst(x, z, L, W, -r, y - 2, y + h); },
  arena(b, x, y, z, o) { const G = lmkGeo(); b.put('plain', G.cyl(28), o.col || CONC, x, y - 2, z, 0, o.r, o.h * 0.35, o.r); b.put('shiny', G.cyl(28), 0x6f8fa8, x, y - 2 + o.h * 0.35, z, 0, o.r * 1.01, o.h * 0.25, o.r * 1.01);
    b.put('plain', G.cyl(28), o.col || CONC, x, y - 2 + o.h * 0.6, z, 0, o.r * 1.04, o.h * 0.08, o.r * 1.04); b.put('shiny', G.ribs, 0x9aa3ab, x, y - 2 + o.h * 0.68, z, 0, o.r, o.h * 0.32, o.r); addObst(x, z, o.r * 2, o.r * 2, 0, y - 2, y + o.h); },
  campus(b, x, y, z, o) { const R = rng(Math.round(x + z)), col = o.stone ? STONE : 0xd6d2c6;
    for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 40 + R() * 80, w = 30 + R() * 30, h = 12 + R() * 16; b.put('win', lmkGeo().box, col, x + Math.cos(a) * d, y - 2, z + Math.sin(a) * d, a, w, h, 18 + R() * 12); }
    LMK_KIND.tower(b, x, y, z, { h: 60, w: 18, d: 18, col }); b.put('plain', lmkGeo().cyl(24), GREEN, x + 60, y - 1.4, z - 50, 0, 45, 1.6, 45); },
  hospital(b, x, y, z, o) { const G = lmkGeo(), col = o.stone ? STONE : 0xe9ebe6, n = o.big ? 3 : 2;
    b.put('win', G.box, col, x, y - 2, z, 0.3, 120, 18, 60);
    for (let i = 0; i < n; i++) LMK_KIND.tower(b, x - 40 + i * 40, y, z + (i % 2) * 12, { h: 45 + i * 15, w: 26, d: 22, col, top: 'flat', ry: 0.3 });
    b.put('plain', G.cyl(16), 0x2e3236, x + 45, y + 16, z - 12, 0, 9, 0.6, 9); b.put('plain', G.box, 0xe8e8e0, x + 45, y + 16.4, z - 12, 0, 9, 0.3, 2); b.put('plain', G.box, 0xe8e8e0, x + 45, y + 16.4, z - 12, 0, 2, 0.3, 9);
    b.put('plain', G.box, 0xd8322a, x - 40, y + 46, z, 0.3, 8, 8, 2); },
  park(b, x, y, z, o) { const G = lmkGeo(), R = rng(Math.round(x * 3 + z)), r = o.r;
    b.put('plain', G.cyl(28), 0x4f7a3c, x, y - 1.2, z, 0, r * 0.9, 1.6, r * 0.6);
    if (o.lake) b.put('shiny', G.cyl(24), 0x3e7a98, x + r * 0.2, y - 0.9, z, 0, r * 0.32, 1.6, r * 0.2);
    for (let i = 0; i < (o.trees ? 70 : 40); i++) { const a = R() * 6.283, d = Math.sqrt(R()) * r * 0.85, tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d * 0.66; if (o.lake && Math.hypot((tx - x - r * 0.2) / 0.32, (tz - z) / 0.2) < r * 1.05) continue;
      const th = 9 + R() * 8; b.put('plain', G.cone(6), 0x2f5a26 + ((R() * 3) | 0) * 0x020400, tx, heightAt(tx, tz) - 0.5, tz, 0, 4 + R() * 3, th, 4 + R() * 3); } },
  mall(b, x, y, z, o) { const G = lmkGeo(); b.put('win', G.box, 0xd9d5cc, x, y - 2, z, 0.2, o.w, o.h, o.d); b.put('plain', G.box, o.sign || 0xe14b3b, x, y + o.h - 8, z, 0.2, o.w * 1.01, 5, o.d * 1.01);
    b.put('plain', G.box, 0x5c5f63, x + o.w * 0.9, y - 1, z, 0.2, o.w * 0.8, 1.4, o.d * 1.2); addObst(x, z, o.w, o.d, -0.2, y - 2, y + o.h); },
  hangars(b, x, y, z, o) { const G = lmkGeo(); for (let i = 0; i < 5; i++) { const d = (i - 2) * 46; b.put('plain', G.box, i % 2 ? 0xc9b48a : 0xd8cfb9, x + Math.cos(o.rot) * d, Math.max(y, 0.5) - 2, z + Math.sin(o.rot) * d, -o.rot, 38, 14, 60); }
    b.put('plain', G.box, 0xb9a78a, x - Math.sin(o.rot) * 40, 0, z + Math.cos(o.rot) * 40, -o.rot, 240, 2.5, 14); },
  marina(b, x, y, z, o) { const G = lmkGeo(), c = Math.cos(o.rot), s = Math.sin(o.rot), R = rng(Math.round(x + z * 7));
    for (const [ox, oz, L] of [[-60, -40, 200], [70, -10, 170]]) b.put('plain', G.box, 0x8f8b84, x + c * ox - s * oz, 0, z + s * ox + c * oz, -o.rot + 1.57, L, 3, 10);
    for (let i = 0; i < 24; i++) { const bx = x + c * (R() - 0.5) * 110 - s * (R() * 60 - 10), bz = z + s * (R() - 0.5) * 110 + c * (R() * 60 - 10); if (!groundAt(bx, bz).water) continue;
      b.put('plain', G.box, 0xf4f4f0, bx, 0, bz, -o.rot, 3, 1.6, 10); b.put('plain', G.cyl(4), 0xe8e8e0, bx, 1.6, bz, 0, 0.15, 12, 0.15); } },
  port(b, x, y, z, o) { const G = lmkGeo(), c = Math.cos(o.rot), s = Math.sin(o.rot), n = o.small ? 2 : 5, R = rng(Math.round(x * 5 + z)), cc = [0xc65b3a, 0x3c78a8, 0x6d9a4b, 0xd8a62a, 0x8c4f8a, 0xb9bcc0];
    const L = o.small ? 200 : 520; b.put('plain', G.box, 0x9c9890, x, -2, z, -o.rot, L, 4.5, 70);                 // quay along the shore
    b.put('plain', G.box, 0x8f8b84, x + s * 160, -2, z - c * 160, -o.rot + 0.3, L * 0.9, 5, 14);                       // breakwater out at sea
    for (let i = 0; i < n; i++) { const d = (i - (n - 1) / 2) * (L / n), cx = x + c * d - s * 18, cz = z + s * d + c * 18;
      for (const e of [-1, 1]) b.put('plain', G.box, 0xc8302a, cx + s * e * 10, 2.5, cz - c * e * 10, -o.rot, 2, 40, 2);
      b.put('plain', G.box, 0xc8302a, cx, 42, cz, -o.rot + 1.57, 2.6, 2.6, 70); b.put('plain', G.box, 0x3a3c40, cx, 40, cz, -o.rot, 6, 4, 6); }
    for (let i = 0; i < (o.small ? 20 : 90); i++) { const d = (R() - 0.5) * L * 0.9, w = 6 - R() * 30, px = x + c * d + s * w, pz = z + s * d - c * w;
      b.put('plain', G.box, cc[(R() * cc.length) | 0], px, 2.5 + ((R() * 3) | 0) * 2.6, pz, -o.rot, 12, 2.6, 2.6); } },
  lighthouse(b, x, y, z, o) { const G = lmkGeo(), h = o.h; for (let i = 0; i < 4; i++) b.put('plain', G.cyl(12), i % 2 ? 0xd23a2e : WHITE, x, y - 1 + i * h / 4, z, 0, 3.2 - i * 0.3, h / 4, 3.2 - i * 0.3);
    b.put('shiny', G.cyl(10), 0xfff2b0, x, y + h - 1, z, 0, 2.4, 3, 2.4); b.put('plain', G.cone(10), 0x2e3236, x, y + h + 2, z, 0, 2.8, 2.5, 2.8); },
  observatory(b, x, y, z, o) { const G = lmkGeo(); b.put('plain', G.cyl(16), CREAM, x, y - 2, z, 0, 12, 18, 12); b.put('shiny', G.dome, 0xc9ced2, x, y + 16, z, 0, 11, 11, 11); },
  yeshiva(b, x, y, z, o) { const G = lmkGeo(); b.put('win', G.box, CREAM, x, y - 2, z, 0.2, 80, 22, 50); b.put('plain', G.box, 0xd9cfb4, x, y + 20, z, 0.2, 50, 7, 30); b.put('plain', G.tri, 0x9a8f78, x, y + 27 + 3, z, 0.2, 30, 50, 6, -1.5708);
    b.put('win', G.box, CREAM, x + 60, y - 2, z + 20, 0.2, 40, 30, 30); },
  synagogue(b, x, y, z, o) { const G = lmkGeo(); b.put('plain', G.box, STONE, x, y - 2, z, 0, 26, 16, 34); b.put('plain', G.box, 0x8a8273, x, y + 4, z, 0, 26.3, 6, 34.3); b.put('plain', G.box, 0xd9cfb0, x, y + 14, z, 0, 14, 5, 22); },
  factory(b, x, y, z, o) { const G = lmkGeo(); b.put('plain', G.box, o.col, x, y - 2, z, 0.1, o.w, o.h, o.d); b.put('plain', G.box, 0x8a8f94, x + o.w * 0.3, y + o.h - 2, z, 0.1, o.w * 0.3, 6, o.d * 0.4);
    for (let i = 0; i < 3; i++) b.put('plain', G.cyl(10), 0xd6d8da, x - o.w * 0.4 + i * 14, y - 2, z + o.d * 0.6, 0, 5, o.h + 14, 5); addObst(x, z, o.w, o.d, -0.1, y - 2, y + o.h); },
  ribbons(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0x5a5048, x, y - 2, z, 0, 40, 14, 30); for (let i = 0; i < 5; i++) b.put('plain', G.box, [0xd2401e, 0xe2621c, 0xc8301a, 0xe87a22, 0xb02818][i], x, y - 1 + i * 3.4, z, i * 0.12, 54 - i * 3, 2.6, 40 - i * 2); },
  hotels(b, x, y, z, o) { const R = rng(Math.round(x + z * 3)); for (let i = 0; i < o.n; i++) { const d = (i - (o.n - 1) / 2) * 70, hx = x - Math.sin(o.rot) * d * -1, hz = z + Math.cos(o.rot) * d, h = 50 + R() * 70;
      if (groundAt(hx, hz).water || nearRoad(hx, hz, 22)) continue; LMK_KIND.tower(b, hx, heightAt(hx, hz), hz, { h, w: 22, d: 46, col: [0xf0ede4, 0xe4e8ec, 0xe9e1cf][i % 3], ry: o.rot, top: 'flat' }); } },
  ferris(b, x, y, z, o) { const G = lmkGeo(), r = o.r; for (const dz of [-1.2, 1.2]) b.put('plain', G.ring, 0xe8e8e8, x, y + r + 6, z + dz, 0, r, r, 28); for (let k = 0; k < 8; k++) b.put('plain', G.box, 0xd0d0d0, x, y + r + 6, z, 0, 0.9, r * 2, 2.4, 0, k * 0.3927);
    for (const s of [-1, 1]) b.put('plain', G.box, 0xc8302a, x + s * r * 0.35, y, z, 0, 1.2, r + 8, 1.2, 0, s * -0.33);
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; b.put('plain', G.box, [0xd2401e, 0x2a7bd8, 0xd8a62a][k % 3], x + Math.cos(a) * r, y + r + 6 + Math.sin(a) * r - 1.5, z, 0, 2.6, 3, 2.6); }
  },
  watertower(b, x, y, z, o) { const G = lmkGeo(), h = o.h || 24; b.put('plain', G.cyl(10), o.col || 0xd8d4c8, x, y - 1, z, 0, 3.2, h, 3.2); b.put('plain', G.cyl(16), o.col || 0xd8d4c8, x, y + h - 1, z, 0, 9, 9, 9); b.put('plain', G.cone(16), 0x9aa0a4, x, y + h + 8, z, 0, 9.5, 4, 9.5); addObst(x, z, 18, 18, 0, y, y + h + 12); },
  fortress(b, x, y, z, o) { const G = lmkGeo(), s = o.s || 1, w = 90 * s; for (const [dx, dz, sx, sz] of [[0, -w / 2, w, 6], [0, w / 2, w, 6], [-w / 2, 0, 6, w], [w / 2, 0, 6, w]]) b.put('plain', G.box, STONE, x + dx, y - 2, z + dz, 0, sx, 14, sz);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.put('plain', G.cyl(10), 0xcfc09c, x + dx * w / 2, y - 2, z + dz * w / 2, 0, 7 * s + 3, 19, 7 * s + 3); },
  desal(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0xdfe2e4, x, y - 2, z, 0.2, 140, 16, 60); for (let i = 0; i < 4; i++) b.put('plain', G.cyl(16), 0xc4cacd, x - 50 + i * 30, y - 2, z + 55, 0, 11, 12, 11); },
  koffler(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.cyl(16), 0xd9d2c0, x, y - 2, z, 0, 9, 46, 9); b.put('shiny', G.ball, 0xc9ced2, x, y + 52, z, 0, 10, 8, 10); },
  squareTower(b, x, y, z, o) { const G = lmkGeo(), h = o.h; b.put('plain', G.box, o.col || STONE, x, y - 2, z, 0, 10, h, 10); b.put('plain', G.box, o.col || STONE, x, y + h - 2, z, 0, 11.5, 2, 11.5); b.put('plain', G.cone(4), 0xa89870, x, y + h, z, 0.785, 6, 6, 6); addObst(x, z, 12, 12, 0, y, y + h + 6); },
  minaret(b, x, y, z, h, col) { const G = lmkGeo(); b.put('plain', G.cyl(10), col || WHITE, x, y - 1, z, 0, 2.1, h, 2.1); b.put('plain', G.cyl(10), col || WHITE, x, y + h * 0.72, z, 0, 3, 1.2, 3); b.put('plain', G.cone(10), 0x5f8f6a, x, y + h - 1, z, 0, 2.2, 6, 2.2); },
  mosque(b, x, y, z, o) { const G = lmkGeo(), s = o.s || 1; b.put('plain', G.box, CREAM, x, y - 2, z, 0, 34 * s, 12 * s, 30 * s); b.put('plain', G.cyl(16), CREAM, x, y + 9 * s, z, 0, 9 * s, 4 * s, 9 * s);
    b.put('shiny', G.dome, o.dome || (s > 1.1 ? GOLD : 0x6f9a86), x, y + 13 * s, z, 0, 9.5 * s, 9 * s, 9.5 * s); LMK_KIND.minaret(b, x + 20 * s, y, z - 16 * s, 36 * s); if (s >= 1.2) LMK_KIND.minaret(b, x - 20 * s, y, z - 16 * s, 36 * s); },
  church(b, x, y, z, o) { const G = lmkGeo(); b.put('plain', G.box, STONE, x, y - 2, z, 0.1, 18, 16, 40); b.put('plain', G.tri, ROOF_RED, x, y + 14 + 3, z, 0.1, 10, 40, 6, -1.5708);
    if (o.tower) { const h = o.h || 34; b.put('plain', G.box, STONE, x, y - 2, z - 24, 0.1, 9, h, 9); b.put('plain', G.cone(4), 0x6a6f74, x, y + h - 2, z - 24, 0.885, 7, 9, 7); }
    if (o.dome) b.put('shiny', G.dome, o.dome, x, y + 14, z + 8, 0, 8, 8, 8); },
  basilica(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0xd9cfb4, x, y - 2, z, 0, 44, 22, 60); b.put('plain', G.cyl(8), 0xd9cfb4, x, y + 20, z, 0.39, 12, 8, 12); b.put('plain', G.cone(8), 0x7f8a8e, x, y + 28, z, 0.39, 12.5, 26, 12.5); b.put('shiny', G.ball, GOLD, x, y + 55, z, 0, 1.2, 1.2, 1.2); },
  sepulchre(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0xd2c39c, x, y - 2, z, 0, 50, 18, 40); b.put('plain', G.cyl(16), 0xd2c39c, x - 10, y + 16, z, 0, 10, 6, 10); b.put('shiny', G.dome, 0x8f9aa2, x - 10, y + 22, z, 0, 10, 9, 10);
    b.put('shiny', G.dome, 0x9aa4ac, x + 14, y + 16, z, 0, 7, 6, 7); b.put('plain', G.box, 0xd2c39c, x + 22, y - 2, z - 18, 0, 8, 30, 8); },
  citadel(b, x, y, z) { LMK_KIND.fortress(b, x, y, z, { s: 0.6 }); LMK_KIND.minaret(b, x + 22, y, z - 22, 32, STONE); },
  prism(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.tri, 0xb9b2a2, x, y + 4.5, z, 0.4, 12, 110, 9, -1.5708); b.put('plain', G.box, 0xcfc7b4, x + 50, y - 2, z + 30, 0.4, 40, 10, 30); },
  dormition(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.cyl(16), STONE, x, y - 2, z, 0, 16, 18, 16); b.put('plain', G.cone(16), 0x5d666c, x, y + 16, z, 0, 16.5, 12, 16.5); b.put('plain', G.cyl(10), STONE, x + 18, y - 2, z, 0, 4.5, 38, 4.5); b.put('plain', G.cone(10), 0x5d666c, x + 18, y + 36, z, 0, 4.8, 8, 4.8); },
  patriarchs(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0xcdbf9a, x, y - 4, z, 0.5, 70, 18, 40); b.put('plain', G.box, 0xb7a984, x, y + 13, z, 0.5, 60, 6, 30); for (const s of [-1, 1]) LMK_KIND.minaret(b, x + s * 32, y + 12, z + s * 20, 22, 0xd9cdac); },
  mausoleum(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0xe8e2d4, x, y - 2, z, 0, 18, 14, 18); b.put('shiny', G.box, 0xa8c8d8, x, y + 1, z, 0, 18.4, 7, 18.4); LMK_KIND.minaret(b, x + 20, y, z, 30, 0xe8e2d4); b.put('plain', G.box, 0xdcd5c4, x, y - 2, z + 40, 0, 90, 8, 40); },
  nativity(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, 0xcbbc94, x, y - 2, z, 0, 30, 18, 60); b.put('plain', G.tri, 0x8a6a4a, x, y + 16 + 4, z, 0, 16, 60, 8, -1.5708); b.put('plain', G.box, 0xd9cfb4, x + 26, y - 2, z - 10, 0, 22, 16, 30);
    b.put('plain', G.box, 0xcbbc94, x + 4, y - 2, z + 36, 0, 10, 30, 10); b.put('plain', G.box, 0xe8e2d4, x - 30, y - 1.6, z + 30, 0, 50, 0.6, 40); },
  tomb(b, x, y, z) { const G = lmkGeo(); b.put('plain', G.box, WHITE, x, y - 2, z, 0, 12, 7, 12); b.put('plain', G.dome, WHITE, x, y + 5, z, 0, 5.5, 5, 5.5); },
  ruins(b, x, y, z, o) { const G = lmkGeo(), R = rng(Math.round(x + z)), s = o.big ? 1.3 : 1; b.put('plain', G.box, 0xd8c8a2, x, y - 2, z, 0, 70 * s, 4, 40 * s);
    for (let i = 0; i < 12; i++) { const cx = x - 30 * s + (i % 6) * 12 * s, cz = z + (i < 6 ? -14 : 14) * s; if (R() < 0.25) continue; b.put('plain', G.cyl(8), 0xe8dcc0, cx, y + 2, cz, 0, 1.8, 8 + R() * 10, 1.8); }
    b.put('plain', G.box, 0xcfbf98, x + 50 * s, y - 2, z, 0, 14, 10, 30); },
  theater(b, x, y, z) { const G = lmkGeo(); for (let i = 0; i < 6; i++) b.put('plain', new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI).translate(0, 0.5, 0), 0xd8c8a2, x, y - 2 + i * 2.4, z, 0, 50 - i * 6, 2.4, 50 - i * 6); b.put('plain', G.box, 0xcfbf98, x, y - 2, z + 4, 0, 90, 14, 6); },
  flagpole(b, x, y, z, o) { const G = lmkGeo(); b.put('plain', G.cyl(8), 0xd8dde2, x, y - 1, z, 0, 1.6, o.h, 1.6); for (let i = 0; i < 4; i++) b.put('plain', G.box, [0x111111, 0xf4f4f4, 0x1a8a3a, 0xc8202a][i], x + 30, y + o.h - 8 - i * 9, z, 0, 60, 9, 0.6); addObst(x, z, 4, 4, 0, y, y + o.h); },
  stacks(b, x, y, z, o) { const G = lmkGeo(); for (let i = 0; i < o.n; i++) { b.put('plain', G.cyl(12), 0xe6e3dc, x + i * 50, y - 2, z, 0, 9, o.h, 9); for (let k = 1; k < 4; k++) b.put('plain', G.cyl(12), 0xc8443a, x + i * 50, y + o.h * (0.62 + k * 0.1), z, 0, 9.3, o.h * 0.05, 9.3); addObst(x + i * 50, z, 18, 18, 0, y, y + o.h); }
    b.put('plain', G.box, 0xb9bcc0, x + 25 * (o.n - 1), y - 2, z + 70, 0, 50 * o.n + 60, 40, 70); }
};

/** Step 2, after the roads: build the meshes. */
function buildCityLandmarks() {
  const by = new Map(); for (const l of LMK.list) { let a = by.get(l.city); if (!a) by.set(l.city, a = []); a.push(l); }
  const mats = { plain: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), win: bldMat, shiny: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x555555 }) };
  for (const [city, list] of by) {
    const cx = list.reduce((s, l) => s + l.x, 0) / list.length, cz = list.reduce((s, l) => s + l.z, 0) / list.length, b = new LmkBuilder(cx, cz);
    for (const l of list) { const k = LMK_KIND[l.kind]; if (!k) { console.warn('no landmark kind', l.kind); continue; }
      const r = Math.max(l.r * 0.6, 6), y = Math.min(...[[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([a, c]) => heightAt(l.x + a, l.z + c)));
      k(b, l.x, Math.max(y, l.kind === 'port' || l.kind === 'marina' ? 0 : y), l.z, l.o); }
    const ext = Math.max(...list.map(l => Math.hypot(l.x - cx, l.z - cz) + l.r + 300));
    for (const [set, geo] of b.meshes()) { const m = new THREE.Mesh(geo, mats[set]); m.position.set(cx, 0, cz); m.updateMatrix(); m.matrixAutoUpdate = false;
      m.userData = { x: cx, z: cz, half: ext, far: HIRES ? 26000 : 14000 }; scene.add(m); LMK.meshes.push(m); } }
}
