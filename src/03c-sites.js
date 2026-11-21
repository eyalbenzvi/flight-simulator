'use strict';
// ---------- 7e. Identifiable places from OpenStreetMap: towers, mosques, churches, water towers, stadiums, ports' tanks, malls ... ----------
// SITES comes from tools/osm2world.py (real positions, tagged heights, footprints in real metres). Footprints are drawn at half real size,
// like the hand-made landmarks, heights are real. Each kind is one small model, placed with an InstancedMesh per kind and 8 km bucket.

const SITE = { list: [], meshes: [] };
let siteLights = null;
/** Step 1, before buildCities (called from planLandmarks): choose the sites and reserve their ground. */
function planSites() {
  const nearLmk = (x, z, r) => LMK.list.some(l => Math.hypot(l.x - x, l.z - z) < r + l.r);
  const mosques = SITES.filter(s => SITE_KINDS[s[0]] === 'mosque').map(s => [lon2x(s[1] / 1e5), lat2z(s[2] / 1e5)]);
  const byMosque = (x, z) => mosques.some(([mx, mz]) => Math.abs(mx - x) < 45 && Math.abs(mz - z) < 45);       // a mosque model brings its own minaret
  for (const s of SITES) {
    const kind = SITE_KINDS[s[0]], x = lon2x(s[1] / 1e5), z = lat2z(s[2] / 1e5); if (x < X0 || x > X1 || z < Z0 || z > Z1) continue;
    const L = s[4] / 2, W = s[5] / 2, area = s[4] * s[5];
    if (kind === 'synagogue' && area < 450) continue;              // the larger ones; the many small ones look like any building
    if (kind === 'ruins' && area < 3000) continue;
    if (kind === 'tower' && s[3] && s[3] < 15) continue;
    if (kind === 'minaret' && byMosque(x, z)) continue;
    if (kind === 'stadium' && s[4] < 110) continue;              // OSM calls small sports grounds stadiums too; only real stadiums get the model
    const r = { tall: Math.max(L, W, 14) * 0.75, mosque: 18, church: 18, synagogue: 14, watertower: 10, tower: 8, mast: 4, chimney: 6, lighthouse: 6, tank: Math.max(L * 0.5, 6),
      stadium: Math.max(L, W, 50) * 0.6, hospital: Math.max(L, W, 40) * 0.6, mall: Math.max(L, W, 35) * 0.6, plant: Math.max(L, W, 40) * 0.6, turbine: 6, fortress: Math.max(L, 22) * 0.6, ruins: Math.max(L, 16) * 0.6, silo: 9, minaret: 5, belltower: 7, lookout: 6,
      school: Math.max(L, W, 22) * 0.6, hotel: Math.max(L, W, 16) * 0.7, station: 24, pitch: Math.max(L, W, 24) * 0.55, court: Math.max(L, W, 10) * 0.6, pool: Math.max(L, W, 9) * 0.6, fuel: 11, shop: Math.max(L, W, 20) * 0.6, civic: Math.max(L, W, 16) * 0.6,
      monument: 5, barn: Math.max(L, W, 16) * 0.55, warehouse: Math.max(L, W, 30) * 0.55, sewage: Math.max(L, W, 30) * 0.55 }[kind];
    if (!r) continue;
    if (nearLmk(x, z, r + 30)) continue;                           // a hand-made landmark is already there
    let px = x, pz = z;                                            // keep off roads and railways: nudge up to two radii away, or leave it out
    if (nearRoad(px, pz, r * 0.85)) { let ok = false;
      for (let k = 1; k <= 4 && !ok; k++) for (let a = 0; a < 8; a++) { const d = k * Math.max(r * 0.5, 8), qx = x + Math.cos(a * 0.785) * d, qz = z + Math.sin(a * 0.785) * d; if (!nearRoad(qx, qz, r * 0.85)) { px = qx; pz = qz; ok = true; break; } }
      if (!ok) continue; }
    if (wetAt(px, pz, kind === 'lighthouse' ? 0 : Math.min(r, 40)) || airfieldAt(px, pz, r)) continue;          // not in the sea, a lake or a reservoir
    if (kind !== 'mosque' && kind !== 'church' && kind !== 'minaret' && kind !== 'belltower' && kind !== 'fortress' && kind !== 'ruins' && kind !== 'monument' && inOldCity(px, pz)) continue;
    if ((kind === 'tall' || kind === 'mall' || kind === 'hospital' || kind === 'plant') && inOldCity(px, pz)) continue;          // no modern blocks inside the Old City walls (it is drawn larger than its place on the map)
    SITE.list.push({ kind, x: px, z: pz, h: s[3], L, W, rot: s[6] * DEG, r });
    if (kind === 'plant') for (const k of [-1, 1]) SITE.list.push({ kind: 'chimney', x: x + Math.cos(s[6] * DEG) * L * 0.3 * k, z: z - Math.sin(s[6] * DEG) * L * 0.3 * k, h: 110, L: 0, W: 0, rot: 0, r: 6 });
  }
  for (const l of SITE.list) reserveGround(l.x, l.z, l.r);
}

/** The models, one per kind, in metres, base at y = 0, vertex-coloured. Footprint kinds (stadium, mall, hospital, fortress, ruins, plant)
    are 1 × 1 in x and z and scaled to the footprint; the others are real size and scaled by height or a size factor. */
function siteModels() {
  const B = (w, h, d, x, y, z, c, ry = 0) => [new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y + h / 2, z), c];
  const C = (rt, rb, h, x, y, z, c, seg = 10) => [new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z), c];
  const K = (r, h, x, y, z, c, seg = 10) => [new THREE.ConeGeometry(r, h, seg).translate(x, y + h / 2, z), c];
  const D = (r, x, y, z, c, sy = 1) => [new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, sy, 1).translate(x, y, z), c];
  const P = (w, h, d, x, y, z, c) => [new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2).scale(w / 2, h / 1.5, d).translate(x, y + h * 0.33, z), c];      // pitched roof
  const rgb = (parts) => mergeGeo(parts.map(([g, c]) => { const k = new THREE.Color(c); return [g, k.r, k.g, k.b]; }));
  const STONE = 0xdccfae, CREAM = 0xebe4d2, WHITE = 0xf1f0ea, RED = 0xc8443a, GREY = 0xb9bcc0, DARK = 0x4a4f55;
  const bands = (r0, r1, n, c1, c2) => { const a = []; for (let i = 0; i < n; i++) a.push(C(r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n), 1 / n, 0, i / n, 0, i % 2 ? c2 : c1, 10)); return a; };
  const minaret = (x, z, h, c) => [C(1.5, 1.8, h, x, -1, z, c), C(2.6, 2.6, 1, x, h * 0.72, z, c), C(1.1, 1.2, h * 0.18, x, h * 0.78, z, c), K(1.5, 5, x, h - 1, z, 0x5f8f6a)];
  return {
    mosque: rgb([B(24, 10, 22, 0, -1, 0, CREAM), C(7.4, 7.4, 3, 0, 9, 0, CREAM), D(7.6, 0, 12, 0, 0x6f9a86, 1.05), ...minaret(14, -12, 32, WHITE)]),
    mosqueG: rgb([B(24, 10, 22, 0, -1, 0, CREAM), C(7.4, 7.4, 3, 0, 9, 0, CREAM), D(7.6, 0, 12, 0, 0xd9a520, 1.05), ...minaret(14, -12, 32, WHITE)]),
    church: rgb([B(14, 13, 30, 0, -1, 0, STONE), P(15, 7, 30, 0, 12, 0, 0x9a4a32), B(7.5, 28, 7.5, 0, -1, -18, STONE), K(5.6, 9, 0, 27, -18, 0x6a6f74, 4)]),
    synagogue: rgb([B(24, 14, 18, 0, -1, 0, CREAM), B(24.3, 6, 18.3, 0, 4, 0, 0x8d8576), B(13, 5, 10, 0, 13, 0, 0xddd3bb)]),      // a hall with tall windows and a raised roof, no dome
    watertower: rgb([C(2.4, 3, 22, 0, -1, 0, 0xd5d0c2), C(8.5, 7, 8, 0, 20, 0, 0xd8d4c8), K(9, 3.5, 0, 28, 0, 0x9aa0a4)]),
    tower: rgb([C(0.9, 3.6, 1, 0, 0, 0, 0xbcc0c4, 4), C(2.2, 2.2, 0.04, 0, 0.84, 0, 0xd8443a, 8), C(0.5, 0.5, 0.12, 0, 0.9, 0, 0xe8e8e8, 6)]),
    mast: rgb(bands(0.9, 0.5, 7, 0xd8443a, 0xf2f2f0)),
    chimney: rgb([C(3.4, 4.2, 0.72, 0, 0, 0, 0xd9d6cf, 12), ...bands(3.4, 3.0, 4, RED, WHITE).map(([g, c]) => [g.scale(1, 0.28, 1).translate(0, 0.72, 0), c])]),
    lighthouse: rgb([...bands(3.2, 2.4, 5, WHITE, RED), C(2.2, 2.2, 0.1, 0, 1, 0, 0xfff2b0, 10), K(2.6, 0.12, 0, 1.1, 0, DARK)]),
    tank: rgb([C(1, 1, 1, 0, 0, 0, 0xe9e9e4, 18), K(1.02, 0.12, 0, 1, 0, 0xcfd2d4, 18)]),
    stadium: (() => { const G = lmkGeo(); return rgb([[G.stands.clone(), 0x5d6976], [G.wall.clone(), 0xd3d6d9], [G.roof.clone(), 0xeeeeea], [G.roof2.clone(), 0xeeeeea], [G.rim.clone(), 0xb9bec3], [G.pitch.clone(), 0x3d8f38], [new THREE.BoxGeometry(0.01, 0.006, 1.1).translate(0, 0.123, 0), 0xf2f2ee],
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, c]) => [new THREE.CylinderGeometry(0.008, 0.012, 1.7, 5).translate(a * 0.86, 0.85, c * 0.62), 0xd0d4d8])]); })(),
    hospital: rgb([B(1, 15, 1, 0, -1, 0, 0xeceee9), B(0.34, 44, 0.42, -0.22, -1, 0.05, 0xe4e7e3), B(0.26, 36, 0.3, 0.2, -1, -0.18, 0xe8ebe6), C(0.11, 0.11, 0.5, 0.3, 14, 0.25, DARK, 12), B(0.05, 3, 0.05, -0.22, 43, 0.05, RED)]),
    mall: rgb([B(1, 16, 1, 0, -1, 0, 0xd9d4c8), B(1.01, 3.5, 1.01, 0, 10, 0, 0xc8302a), B(0.3, 2, 0.3, 0.2, 15, 0.15, 0x8a8f94)]),
    plant: rgb([B(1, 30, 0.6, 0, -1, -0.15, GREY), B(0.7, 18, 0.35, -0.1, -1, 0.35, 0xa9adb1)]),
    turbine: rgb([C(1.6, 2.6, 82, 0, -1, 0, 0xeceeef), B(3.5, 3.5, 9, 0, 80, 0, 0xeceeef), ...[0, 2.094, 4.189].map(a => [new THREE.BoxGeometry(2.4, 40, 0.6).translate(0, 20, 0).rotateZ(a).translate(0, 82, 5), 0xf4f4f4])]),
    fortress: rgb([B(1, 12, 0.07, 0, -1, -0.47, STONE), B(1, 12, 0.07, 0, -1, 0.47, STONE), B(0.07, 12, 1, -0.47, -1, 0, STONE), B(0.07, 12, 1, 0.47, -1, 0, STONE),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => C(0.09, 0.1, 17, a * 0.47, -1, b * 0.47, 0xcfc09c, 8))]),
    ruins: rgb([B(1, 1.5, 1, 0, -1, 0, 0xd2c39c), B(0.6, 5, 0.05, -0.1, 0, -0.4, 0xc9b88f), B(0.05, 4, 0.5, 0.42, 0, 0.1, 0xc9b88f), ...[0, 1, 2, 3, 4, 5].map(k => C(0.03, 0.03, 7 + (k % 3) * 2, -0.3 + k * 0.12, 0, 0.2, 0xe8dcc0, 6))]),
    minaret: rgb([C(3.2, 3.6, 4, 0, -1, 0, CREAM), ...minaret(0, 0, 32, WHITE)]),
    belltower: rgb([B(7, 24, 7, 0, -1, 0, STONE), B(7.6, 1, 7.6, 0, 16, 0, 0xcfc09c), K(5.4, 8, 0, 23, 0, 0x8a4a3a, 4)]),
    lookout: rgb([C(2.2, 3.0, 13, 0, -1, 0, 0xcdc6b4, 8), B(6.5, 1, 6.5, 0, 12, 0, 0xb9b2a0), B(6.5, 3, 0.4, 0, 13, 3.1, 0xb9b2a0), B(6.5, 3, 0.4, 0, 13, -3.1, 0xb9b2a0), B(7, 0.6, 7, 0, 16, 0, 0x8a8f94)]),
    // --- the smaller places every town and village has (unit footprints are scaled to the mapped size) ---
    school: rgb([B(1, 0.4, 1, 0, -0.3, 0, 0xb9b4a6), B(1, 10, 0.3, 0, -1, -0.35, 0xe9e4d6), B(0.28, 10, 0.72, -0.36, -1, 0.14, 0xe4dfd0), B(0.28, 7, 0.5, 0.36, -1, 0.03, 0xe9e4d6), B(1.01, 1.2, 0.31, 0, 3, -0.35, 0x4d7fb0), B(1.01, 1.2, 0.31, 0, 6.3, -0.35, 0x4d7fb0),
      B(0.29, 1.2, 0.73, -0.36, 3, 0.14, 0x4d7fb0), B(0.29, 1.2, 0.73, -0.36, 6.3, 0.14, 0x4d7fb0), B(0.3, 0.25, 0.4, 0.02, 0.1, 0.22, 0x4f8a48), B(0.2, 0.3, 0.28, 0.02, 0.1, 0.22, 0xc9683c)]),
    station: rgb([B(34, 7, 11, 0, -1, -12, 0xe6e1d4), B(35, 1.2, 12, 0, 6, -12, 0x8c3f34), B(96, 0.8, 5, 0, 0, -3, 0xb9bcc0), B(96, 0.8, 5, 0, 0, 7, 0xb9bcc0), B(84, 0.5, 6, 0, 5.2, -3, 0xd9dde0), B(84, 0.5, 6, 0, 5.2, 7, 0xd9dde0),
      ...[-36, -18, 0, 18, 36].flatMap(x => [B(0.5, 5, 0.5, x, 0.6, -3, 0x6a6f74), B(0.5, 5, 0.5, x, 0.6, 7, 0x6a6f74)]), B(22, 6, 1.2, 0, 4, 2, 0x8a9096)]),
    pitch: rgb([B(1, 0.5, 1, 0, -0.3, 0, 0x3f8f3a), B(0.94, 0.02, 0.012, 0, 0.21, -0.47, 0xf2f2ee), B(0.94, 0.02, 0.012, 0, 0.21, 0.47, 0xf2f2ee), B(0.008, 0.02, 0.94, -0.47, 0.21, 0, 0xf2f2ee), B(0.008, 0.02, 0.94, 0.47, 0.21, 0, 0xf2f2ee), B(0.008, 0.02, 0.94, 0, 0.21, 0, 0xf2f2ee),
      C(0.085, 0.085, 0.02, 0, 0.2, 0, 0xf2f2ee, 16), C(0.078, 0.078, 0.025, 0, 0.2, 0, 0x3f8f3a, 16), B(0.006, 2.4, 0.11, -0.475, 0.2, 0, 0xfafafa), B(0.006, 2.4, 0.11, 0.475, 0.2, 0, 0xfafafa)]),
    court: rgb([B(1, 0.45, 1, 0, -0.3, 0, 0xb9b6ad), B(0.86, 0.03, 0.82, 0, 0.15, 0, 0xffffff), B(0.012, 0.03, 0.82, 0, 0.17, 0, 0xd9d9d9), B(0.86, 0.03, 0.02, 0, 0.17, -0.41, 0xd9d9d9), B(0.86, 0.03, 0.02, 0, 0.17, 0.41, 0xd9d9d9),
      B(0.012, 3.2, 0.012, -0.44, 0.15, 0, 0x6a6f74), B(0.012, 3.2, 0.012, 0.44, 0.15, 0, 0x6a6f74), B(0.012, 1, 0.09, -0.43, 2.6, 0, 0xf4f4f4), B(0.012, 1, 0.09, 0.43, 2.6, 0, 0xf4f4f4)]),
    pool: rgb([B(1, 0.5, 1, 0, -0.3, 0, 0xddd6c4), B(0.72, 0.06, 0.6, 0, 0.2, 0, 0x2f9fd6), B(0.74, 0.03, 0.62, 0, 0.2, 0, 0xf4f4f0), B(0.72, 0.065, 0.6, 0, 0.2, 0, 0x2f9fd6), B(0.1, 2.6, 0.3, 0.42, 0.2, 0, 0xeae6da)]),
    fuel: rgb([B(18, 0.9, 11, 0, 5.2, 0, 0xf4f4f2), B(18.2, 0.5, 11.2, 0, 5.4, 0, 0xd9342b), ...[[-6, -3], [6, -3], [-6, 3], [6, 3]].map(([x, z]) => C(0.3, 0.3, 5.4, x, 0, z, 0xd9dde0, 8)), B(1, 1.6, 0.6, -6, 0, 0, 0xe33b2e), B(1, 1.6, 0.6, 6, 0, 0, 0xe33b2e),
      B(9, 3.6, 6, 0, -0.5, -11, 0xe9e6de), B(9.2, 0.6, 6.2, 0, 2.6, -11, 0x2f6fb0), B(22, 0.25, 22, 0, -0.1, -3, 0x55585c)]),
    shop: rgb([B(1, 7.5, 1, 0, -1, 0, 0xe2ded2), B(1.01, 1.6, 1.01, 0, 4.6, 0, 0xd9342b), B(0.5, 4, 0.02, 0, 0, 0.5, 0x5d7890), B(0.22, 1.6, 0.22, 0.25, 6.4, -0.2, 0x8a8f94), B(0.16, 1.2, 0.16, -0.25, 6.4, 0.2, 0x8a8f94)]),
    civic: rgb([B(1, 9, 0.8, 0, -1, -0.1, 0xece6d6), B(1.04, 1, 0.3, 0, 7.6, 0.38, 0xddd5c0), ...[-0.42, -0.25, -0.08, 0.08, 0.25, 0.42].map(x => B(0.04, 8, 0.04, x, -0.4, 0.44, 0xf2efe6)), B(0.55, 3.4, 0.45, 0, 8, -0.1, 0xddd5c0), B(1.02, 0.5, 1.02, 0, -0.6, 0, 0xc9c2b0)]),
    monument: rgb([B(8, 1, 8, 0, -0.6, 0, 0xcfc8b8), B(5, 0.8, 5, 0, 0.4, 0, 0xddd6c6), C(0.5, 1.3, 12, 0, 1.2, 0, 0xe9e4d6, 4), K(0.7, 1.4, 0, 13.2, 0, 0xe9e4d6, 4)]),
    barn: rgb([B(1, 0.3, 1, 0, -0.2, 0, 0xa59c88), P(1.04, 2.6, 1.04, 0, 5, 0, 0xc9ccce), B(1.0, 0.25, 1.0, 0, 4.9, 0, 0xb4b8bb), ...[-0.46, -0.15, 0.15, 0.46].flatMap(z => [B(0.02, 5, 0.02, -0.47, 0, z, 0x8a8f94), B(0.02, 5, 0.02, 0.47, 0, z, 0x8a8f94), B(0.02, 5, 0.02, 0, 0, z, 0x8a8f94)]),
      B(0.05, 1.2, 0.9, 0.2, 0.1, 0, 0x6f6a5e), B(0.05, 1.2, 0.9, -0.2, 0.1, 0, 0x6f6a5e)]),
    warehouse: rgb([B(1, 9, 1, 0, -1, 0, 0xc9cdd0), ...[-0.375, -0.125, 0.125, 0.375].map(z => [new THREE.CylinderGeometry(1, 1, 1, 3).rotateZ(Math.PI / 2).rotateX(0.5).scale(1, 2.2, 0.135).translate(0, 8.6, z), 0xaeb4b8]), B(0.12, 4.5, 0.02, -0.3, 0, 0.5, 0x4f5a66), B(0.12, 4.5, 0.02, 0, 0, 0.5, 0x4f5a66), B(0.12, 4.5, 0.02, 0.3, 0, 0.5, 0x4f5a66)]),
    sewage: rgb([B(1, 0.4, 1, 0, -0.3, 0, 0x9c9a8e), C(0.2, 0.2, 2.6, -0.24, 0, -0.22, 0xc9c9c2, 20), C(0.185, 0.185, 2.7, -0.24, 0, -0.22, 0x5d7f6a, 20), C(0.2, 0.2, 2.6, 0.24, 0, -0.22, 0xc9c9c2, 20), C(0.185, 0.185, 2.7, 0.24, 0, -0.22, 0x5d7f6a, 20),
      B(0.4, 2.2, 0.3, -0.2, 0, 0.26, 0x6b8a78), B(0.42, 1.9, 0.32, -0.2, 0, 0.26, 0xc9c9c2), B(0.22, 5, 0.2, 0.3, 0, 0.3, 0xe2ded2), B(0.012, 0.3, 0.4, -0.24, 2.6, -0.22, 0x6a6f74), B(0.012, 0.3, 0.4, 0.24, 2.6, -0.22, 0x6a6f74)]),
    silo: rgb([C(4.4, 4.4, 1, -5, 0, 0, 0xd9d9d4, 12), C(4.4, 4.4, 1, 5, 0, 0, 0xd9d9d4, 12), C(4.4, 4.4, 1, 0, 0, 8, 0xd2d2cc, 12), B(4, 1.15, 4, 0, 0, -4, 0xb9bcc0)])
  };
}

/** Step 2, after the cities: instance every site; red obstruction lights on the tall ones for the night. */
function buildSites() {
  const M = siteModels(), base = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); base.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.attributes.position.count * 3).fill(1), 3));
  const plain = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x222222, side: THREE.DoubleSide });
  const groups = new Map(), BK = 8000, R = rng(5150), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), LP = [];
  const GLASS = [0x8fb0c8, 0x9db8cc, 0x7f9fb8, 0xb8c6d2, 0xd6d9dc, 0xe2ded4, 0xa9bccb, 0xc9d1d8];
  const FAR = { pitch: 9000, court: 4500, pool: 4500, fuel: 5000, monument: 5000, barn: 7000, school: 9000, shop: 8000, civic: 8000, station: 9000, warehouse: 11000, sewage: 9000, hotel: 20000, tall: 26000, stadium: 16000, mall: 14000, hospital: 14000, plant: 16000, tank: 14000, chimney: 18000, turbine: 16000, tower: 14000, fortress: 12000 };
  for (const s of SITE.list) {
    const y = Math.min(...[[0, 0], [s.r * 0.6, 0], [-s.r * 0.6, 0], [0, s.r * 0.6], [0, -s.r * 0.6]].map(([a, b]) => heightAt(s.x + a, s.z + b)));
    let model = s.kind, sx = 1, sy = 1, sz = 1, yy = y, ry = s.rot, tint = 0.86 + R() * 0.14, colour = null, obst = null, light = 0;
    switch (s.kind) {
      case 'tall': { const h = Math.max(s.h, 25); model = 'tall'; sx = clamp(s.L, 14, 70); sz = clamp(s.W, 12, 60); sy = h + 8; yy = y - 8; colour = GLASS[(R() * GLASS.length) | 0]; obst = [sx, sz, y + h]; light = h > 70 ? y + h + 2 : 0; break; }
      case 'mosque': { const k = clamp(Math.sqrt(s.L * s.W) / 12, 0.75, 1.7); model = R() < 0.3 ? 'mosqueG' : 'mosque'; sx = sy = sz = k; obst = [24 * k, 22 * k, y + 32 * k]; break; }
      case 'church': case 'synagogue': { const k = clamp(Math.sqrt(s.L * s.W) / 14, 0.8, 1.6); sx = sy = sz = k; obst = [16 * k, 30 * k, y + 28 * k]; break; }
      case 'watertower': { const k = clamp((s.h || 28) / 30, 0.7, 1.6); sx = sz = clamp(k, 0.8, 1.2); sy = k; ry = R() * 6.3; obst = [18, 18, y + 32 * k]; break; }
      case 'tower': { sy = clamp(s.h || 45, 15, 250); obst = [7, 7, y + sy]; light = y + sy + 1; ry = R() * 6.3; break; }
      case 'mast': { sy = clamp(s.h || 60, 15, 300); obst = [3, 3, y + sy]; light = y + sy + 1; break; }
      case 'chimney': { sy = clamp(s.h || 80, 20, 300); obst = [8, 8, y + sy]; light = y + sy + 1; break; }
      case 'lighthouse': { sy = clamp(s.h || 24, 10, 70); obst = [7, 7, y + sy]; break; }
      case 'minaret': { const k = clamp((s.h || 32) / 32, 0.7, 1.6); sx = sz = clamp(k, 0.8, 1.2); sy = k; obst = [6, 6, y + 32 * k]; break; }
      case 'belltower': { const k = clamp((s.h || 26) / 26, 0.7, 1.6); sx = sz = clamp(k, 0.8, 1.2); sy = k; obst = [8, 8, y + 31 * k]; break; }
      case 'lookout': { const k = clamp((s.h || 15) / 16, 0.6, 2); sx = sz = 1; sy = k; ry = R() * 6.3; obst = [7, 7, y + 17 * k]; break; }
      case 'silo': { sy = clamp(s.h || 30, 10, 70); obst = [20, 20, y + sy]; break; }
      case 'tank': { const rr = clamp(s.L * 0.5, 4, 45); sx = sz = rr; sy = clamp(s.h || 14, 6, 30); yy = y - 0.5; break; }
      case 'stadium': {     /* half way between the lowest point and the centre, so the pitch is never under the ground */ sx = clamp(s.L * 0.55, 30, 120); sz = clamp(s.W * 0.55, 22, 95); sy = 22; yy = (y + heightAt(s.x, s.z)) / 2 - 1; obst = [sx * 2, sz * 2, y + 20]; break; }
      case 'hospital': case 'mall': case 'plant': case 'fortress': case 'ruins': {
        sx = clamp(s.L, s.kind === 'ruins' ? 16 : 25, s.kind === 'plant' ? 220 : 140); sz = clamp(s.W, s.kind === 'ruins' ? 12 : 20, s.kind === 'plant' ? 160 : 110); if (s.kind !== 'ruins') obst = [sx, sz, y + (s.kind === 'hospital' ? 44 : s.kind === 'plant' ? 30 : 16)]; break; }
      case 'hotel': { const h = clamp(s.h || 18 + ((s.L + s.W) % 5) * 5, 14, 39.9); model = 'tall'; sx = clamp(s.L, 16, 60); sz = clamp(s.W, 13, 50); sy = h + 8; yy = y - 8; colour = [0xe9e2d0, 0xf0ece2, 0xdcd0b8, 0xcfd9e0][(R() * 4) | 0]; obst = [sx, sz, y + h]; break; }
      case 'school': case 'shop': case 'civic': case 'warehouse': case 'barn': case 'sewage': {
        const lo = { school: 26, shop: 22, civic: 18, warehouse: 34, barn: 18, sewage: 34 }[s.kind]; sx = clamp(s.L, lo, s.kind === 'warehouse' ? 150 : 90); sz = clamp(s.W, lo * 0.7, s.kind === 'warehouse' ? 110 : 70);
        if (s.kind === 'shop') colour = [0xffffff, 0xcfe0ff, 0xfff0c0, 0xd0ffd8][(R() * 4) | 0]; if (s.kind !== 'sewage') obst = [sx, sz, y + { school: 10, shop: 8, civic: 12, warehouse: 11, barn: 7 }[s.kind]]; yy = y - 0.4; break; }
      case 'pitch': { sx = clamp(s.L, 40, 70); sz = clamp(s.W, 26, 46); yy = heightAt(s.x, s.z) * 0.5 + y * 0.5; break; }
      case 'court': { sx = clamp(s.L, 15, 26); sz = clamp(s.W, 9, 16); yy = heightAt(s.x, s.z) * 0.5 + y * 0.5; colour = [0x3f78b0, 0xb5563c, 0x3f8f5a, 0x4a9ac0][(R() * 4) | 0]; break; }
      case 'pool': { sx = clamp(s.L, 14, 40); sz = clamp(s.W, 9, 26); yy = heightAt(s.x, s.z) * 0.5 + y * 0.5; break; }
      case 'fuel': { ry = R() * 6.3; obst = [18, 11, y + 6]; break; }
      case 'station': { obst = [40, 26, y + 8]; break; }
      case 'monument': { const k = clamp((s.h || 12) / 12, 0.6, 2.5); sy = k; ry = R() * 6.3; obst = [4, 4, y + 14 * k]; break; }
      case 'turbine': { ry = R() * 6.3; obst = [6, 6, y + 120]; light = y + 84; break; }
    }
    const key = model + ':' + Math.floor(s.x / BK) + ':' + Math.floor(s.z / BK); let g = groups.get(key); if (!g) groups.set(key, g = { model, kind: s.kind, list: [] });
    g.list.push([s.x, yy, s.z, ry, sx, sy, sz, colour, tint]);
    if (obst) addObst(s.x, s.z, obst[0], obst[1], -ry, y - 2, obst[2]);
    if (light) LP.push(s.x, light, s.z);
  }
  for (const g of groups.values()) {
    const geo = g.model === 'tall' ? base : M[g.model], mat = g.model === 'tall' ? bldMat : plain, im = new THREE.InstancedMesh(geo, mat, g.list.length);
    let cx = 0, cz = 0, ext = 0; for (const b of g.list) { cx += b[0]; cz += b[2]; } cx /= g.list.length; cz /= g.list.length;
    g.list.forEach((b, n) => { e.set(0, b[3], 0); q.setFromEuler(e); p.set(b[0], b[1], b[2]); sc.set(b[4], b[5], b[6]); m4.compose(p, q, sc); im.setMatrixAt(n, m4);
      im.setColorAt(n, b[7] !== null ? col.setHex(b[7]) : col.setRGB(b[8], b[8], b[8])); ext = Math.max(ext, Math.hypot(b[0] - cx, b[2] - cz)); });
    im.frustumCulled = false; im.matrixAutoUpdate = false; im.userData = { x: cx, z: cz, half: ext + 300, far: (HIRES ? 1 : 0.55) * (FAR[g.kind] || 11000) }; scene.add(im); SITE.meshes.push(im);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
  siteLights = new THREE.Points(lg, clampPoints(new THREE.PointsMaterial({ size: 14, map: lightDot(), color: 0xff3020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 1.6, 9));
  siteLights.visible = false; scene.add(siteLights);
}
