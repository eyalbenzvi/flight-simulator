'use strict';
// ---------- 12g. Extras: a game controller, real cars near the camera, motorway lamps, cranes, power lines, a lightning bolt, puffs, night signs ----------
const PAD = { x: 0, y: 0, on: false, was: [] };
const XT = { cars: null, lamps: null, red: null, green: null, flood: null, bolt: null, wasGround: true, night: -1, vap: 0 };

/** A game controller: left stick flies, the triggers (or the right stick) move the power lever, A view, B brake, X automatic landing, Y gear,
    the shoulder buttons flaps, Start the menu. Nothing shows on screen; it simply works when a controller is connected. */
function padRead(dt) {
  PAD.on = false; PAD.brk = false; if (!navigator.getGamepads) return; let g = null; try { for (const p of navigator.getGamepads()) if (p && p.connected && p.axes.length >= 2) { g = p; break; } } catch (e) { return; } if (!g) return;
  const dz = v => Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88, b = i => g.buttons[i] ? (g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0)) : 0;
  PAD.x = dz(g.axes[0]); PAD.y = dz(g.axes[1]); PAD.on = PAD.x !== 0 || PAD.y !== 0;
  if (S.started && !S.paused) { const t = b(7) - b(6) - (g.axes.length > 3 ? dz(g.axes[3]) : 0); if (t) S.thr = clamp(S.thr + t * 0.7 * dt, 0, 1); }
  const map = { 0: 'KeyC', 2: 'KeyL', 3: 'KeyG', 4: 'KeyF', 8: 'KeyU', 9: 'Escape' };
  { const f = b(5) > 0.5; if (f) keys.Enter = true; else if (PAD.fire) keys.Enter = false; PAD.fire = f; }          // the right shoulder button fires (on a firing range); Select changes weapon
  for (const k in map) { const on = b(+k) > 0.5; if (on && !PAD.was[k] && S.started) action(map[k]); PAD.was[k] = on; }
  PAD.brk = b(1) > 0.5;
}

/** Steering by tilting the phone, as the big mobile simulators do (an option in the settings; the thumb stick stays and wins while it is touched).
    It reads gravity from the motion sensor, in the axes of the screen as it is turned now. The way the phone is held when a flight starts or resumes is
    neutral (`TILT.need`): roll is how far the screen's right edge dips (30 degrees is full), pitch is how far its top leans away or back (22 degrees
    is full; away is nose down, like a yoke, unless the stick sense is turned round). Android and iOS report gravity with opposite signs: the sign is
    taken from the posture at calibration. Never tried on a real phone. */
const TILT = { on: false, ok: false, need: true, x: 0, y: 0, g: null, s: 1, r0: 0, p0: 0, t: 0 };
function tiltEv(e) {
  const a = e.accelerationIncludingGravity; if (!TILT.on || !a || a.x === null || a.x === undefined) return;
  const o = (screen.orientation && typeof screen.orientation.angle === 'number' ? screen.orientation.angle : +window.orientation || 0) * DEG, c = Math.cos(o), sn = Math.sin(o);
  const raw = [a.x * c - a.y * sn, a.x * sn + a.y * c, a.z]; if (!TILT.g || TILT.need) TILT.g = raw.slice(); else for (let i = 0; i < 3; i++) TILT.g[i] += (raw[i] - TILT.g[i]) * 0.3;
  const g = TILT.g, len = Math.hypot(g[0], g[1], g[2]) || 1; if (TILT.need) TILT.s = Math.abs(g[1]) > 2.5 ? Math.sign(g[1]) : (Math.sign(g[2]) || 1);
  const sg = TILT.s, roll = Math.asin(clamp(sg * g[0] / len, -1, 1)), pit = Math.atan2(sg * g[2], sg * g[1]);
  if (TILT.need) { TILT.need = false; TILT.r0 = roll; TILT.p0 = pit; }
  const shape = (v, full) => { const d = 0.03, m = Math.min(Math.abs(v) / full, 1); return m < d ? 0 : Math.sign(v) * Math.pow((m - d) / (1 - d), 1.25); };
  TILT.x = shape(-(roll - TILT.r0), 30 * DEG); TILT.y = shape(-Math.atan2(Math.sin(pit - TILT.p0), Math.cos(pit - TILT.p0)), 22 * DEG); TILT.t = performance.now();
}
/** Turn tilt steering on. Must be called from a tap: iOS asks the player's permission for the motion sensor, and only then. */
function tiltStart() {
  const D = window.DeviceMotionEvent, go = () => { if (!TILT.ok) { window.addEventListener('devicemotion', tiltEv); TILT.ok = true; } TILT.need = true; TILT.on = true; };
  const no = () => { SAVE.tilt = 0; persist(); TILT.on = false; toast(L('This device gives no tilt reading. The thumb stick is on', 'המכשיר לא מוסר נתוני הטיה. הג׳ויסטיק פעיל'), 5); };
  if (!D) return no(); if (typeof D.requestPermission === 'function') { try { D.requestPermission().then(r => r === 'granted' ? go() : no()).catch(no); } catch (e) { no(); } } else go();
}
function tiltStop() { TILT.on = false; TILT.x = TILT.y = 0; }
function buildExtras() {
  buildOldCity(); buildBridges(); buildSkyLife();
  // --- the aircraft shadows itself (wing on fuselage, tail on wing): one small shadow map that follows it; larger screens only ---
  if (HIRES && new URLSearchParams(location.search).get('shadow') !== '0') { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; sun.castShadow = true; const c = sun.shadow.camera; c.left = c.bottom = -42; c.right = c.top = 42; c.near = 850; c.far = 1150; c.updateProjectionMatrix();
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
    for (const k in AC.models) AC.models[k].g.traverse(o => { const m = o.material; if (o.isMesh && m && !m.transparent && m.side !== THREE.DoubleSide && (m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial)) { o.castShadow = true; o.receiveShadow = true; } }); }
  // --- cars: a small body and cabin, drawn for the cars of the traffic that are near the camera ---
  { const g = mergeGeo([[new THREE.BoxGeometry(1.85, 0.7, 4.4).translate(0, 0.62, 0), 1, 1, 1], [new THREE.BoxGeometry(1.6, 0.55, 2.3).translate(0, 1.22, 0.25), 0.16, 0.2, 0.25],
      [new THREE.BoxGeometry(1.9, 0.3, 0.3).translate(0, 0.5, -2.12), 0.3, 0.3, 0.32], [new THREE.CylinderGeometry(0.34, 0.34, 1.95, 8).rotateZ(Math.PI / 2).translate(0, 0.34, 1.4), 0.07, 0.07, 0.08], [new THREE.CylinderGeometry(0.34, 0.34, 1.95, 8).rotateZ(Math.PI / 2).translate(0, 0.34, -1.4), 0.07, 0.07, 0.08]]);
    const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }), 90); const c = new THREE.Color(), pal = [0xf2f2ee, 0xe8e8e4, 0xc9cccf, 0x8a8f96, 0x2b2e33, 0x1d3f7a, 0xa5261d, 0xd9d6cc, 0x6e7a52, 0xf0c21a];
    for (let i = 0; i < 90; i++) m.setColorAt(i, c.setHex(pal[i % pal.length])); m.count = 0; m.frustumCulled = false; scene.add(m); XT.cars = m; }
  // --- lamps along the divided motorways, lit at night ---
  { const P = []; for (const r of roadLines()) { if (r.cls !== 2 || !r.dual) continue; for (let i = 1; i < r.D.length - 1; i += 2) { const p = r.D[i]; P.push(p[0], triHeight(p[0], p[1]) + 11, p[1]); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    XT.lamps = new THREE.Points(g, clampPoints(new THREE.PointsMaterial({ size: 13, map: lightDot(), color: 0xffb45a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 1.3, 7)); XT.lamps.visible = false; XT.lamps.frustumCulled = false; scene.add(XT.lamps); }
  const red = [], green = [], flood = [];
  // --- tower cranes on building sites ---
  { const Y = [0.95, 0.74, 0.1], G2 = [0.55, 0.55, 0.57], parts = [[new THREE.BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0), ...Y], [new THREE.BoxGeometry(0.03, 0.035, 0.03).translate(0, 1.02, 0), ...G2]];
    const jib = mergeGeo([[new THREE.BoxGeometry(1.2, 1.4, 50).translate(0, 0.7, -17), ...Y], [new THREE.BoxGeometry(2.4, 2.2, 4).translate(0, 0.2, 7), ...G2], [new THREE.BoxGeometry(1.6, 7, 1.6).translate(0, 3.5, 0), ...Y], [new THREE.BoxGeometry(2, 2.2, 2.4).translate(1.6, -1.2, -1), 0.9, 0.9, 0.88]]);
    const mast = mergeGeo([parts[0]]), mat = new THREE.MeshLambertMaterial({ vertexColors: true }), list = [];
    if (LCR) for (let j = 2; j < LCR.h - 2 && list.length < 260; j += 2) for (let i = 2; i < LCR.w - 2; i += 2) { if (LCR.d[(j * LCR.w + i) * 4] !== LCN.construction) continue; const h = hash2(i, j); if (h > 0.5) continue;
      const x = X0 + (i + 0.5) * 60 + (h - 0.25) * 60, z = Z0 + (j + 0.5) * 60 + (hash2(j, i) - 0.5) * 30, g = groundAt(x, z); if (g.h < 1 || wetAt(x, z, 20) || nearRoad(x, z, 4) || obstBox(x, z, 2.5, 2.5) || airfieldAt(x, z, 400)) continue; list.push([x, triHeight(x, z), z, 34 + hash2(i + 7, j) * 26, hash2(i, j + 9) * 6.283]); }
    if (list.length) { const a = new THREE.InstancedMesh(mast, mat, list.length), b = new THREE.InstancedMesh(jib, mat, list.length), o = new THREE.Object3D();
      list.forEach(([x, y, z, h, r], k) => { o.position.set(x, y - 1, z); o.rotation.set(0, r, 0); o.scale.set(1, h + 1, 1); o.updateMatrix(); a.setMatrixAt(k, o.matrix); o.position.set(x, y + h, z); o.scale.set(1, 1, 1); o.updateMatrix(); b.setMatrixAt(k, o.matrix); addObst(x, z, 2, 2, 0, y, y + h + 7); red.push(x, y + h + 8, z); });
      for (const m of [a, b]) { m.frustumCulled = false; m.userData = { x: 0, z: 0, far: 1e9 }; scene.add(m); } XT.cranes = [a, b]; XT.craneList = list; } }
  // --- high-voltage lines from the coastal power stations inland: lattice pylons and sagging wires ---
  { const routes = [[[34.892, 32.468], [34.95, 32.462], [35.02, 32.44], [35.07, 32.40], [35.08, 32.30], [35.03, 32.20], [35.0, 32.10]], [[34.528, 31.632], [34.60, 31.625], [34.72, 31.60], [34.83, 31.63], [34.93, 31.70], [34.98, 31.80]],
      [[34.80, 31.14], [34.83, 31.20], [34.85, 31.27], [34.93, 31.33], [35.05, 31.40]], [[34.66, 31.86], [34.75, 31.85], [34.86, 31.84], [34.95, 31.86]], [[35.02, 32.78], [35.10, 32.74], [35.20, 32.72], [35.32, 32.71], [35.45, 32.74]]];
    const S2 = [0.62, 0.64, 0.66], leg = (sx, sz) => { const g = new THREE.BoxGeometry(0.5, 44, 0.5); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 22) / 44; p.setX(i, p.getX(i) + sx * (4.2 - 3.4 * t)); p.setZ(i, p.getZ(i) + sz * (4.2 - 3.4 * t)); } g.translate(0, 22, 0); g.computeVertexNormals(); return [g, ...S2]; };
    const pg = mergeGeo([leg(1, 1), leg(-1, 1), leg(1, -1), leg(-1, -1), [new THREE.BoxGeometry(24, 0.6, 0.8).translate(0, 30, 0), ...S2], [new THREE.BoxGeometry(18, 0.6, 0.8).translate(0, 37, 0), ...S2], [new THREE.BoxGeometry(7, 0.5, 0.7).translate(0, 43.5, 0), ...S2],
      [new THREE.BoxGeometry(8.6, 0.4, 0.4).translate(0, 8, 3.6), ...S2], [new THREE.BoxGeometry(8.6, 0.4, 0.4).translate(0, 8, -3.6), ...S2], [new THREE.BoxGeometry(5.6, 0.4, 0.4).translate(0, 20, 2.4), ...S2], [new THREE.BoxGeometry(5.6, 0.4, 0.4).translate(0, 20, -2.4), ...S2]]);
    const py = [], W = [];
    for (const rt of routes) { const pts = splinePath(rt, 330); let prev = null;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)], g = groundAt(p[0], p[1]);
        if (g.h < 1.5 || wetAt(p[0], p[1], 20) || nearRoad(p[0], p[1], 7) || obstBox(p[0], p[1], 6, 6) || airfieldAt(p[0], p[1], 900)) continue;
        const rot = Math.atan2(q[0] - o[0], q[1] - o[1]), cur = { x: p[0], y: triHeight(p[0], p[1]) - 0.5, z: p[1], rot }; py.push(cur);
        if (prev && Math.hypot(cur.x - prev.x, cur.z - prev.z) < 800) for (const [ox, oy] of [[-11.5, 29.4], [11.5, 29.4], [-8.5, 36.4], [8.5, 36.4], [0, 43.4]]) { let lx = 0, ly = 0, lz = 0;
          for (let k = 0; k <= 6; k++) { const f = k / 6, c1 = Math.cos(prev.rot), s1 = Math.sin(prev.rot), c2 = Math.cos(cur.rot), s2 = Math.sin(cur.rot), ax = prev.x + ox * c1, az = prev.z - ox * s1, bx = cur.x + ox * c2, bz = cur.z - ox * s2;
            const x = ax + (bx - ax) * f, z = az + (bz - az) * f, y = prev.y + (cur.y - prev.y) * f + oy - 9 * 4 * f * (1 - f); if (k) W.push(lx, ly, lz, x, y, z); lx = x; ly = y; lz = z; } }
        prev = cur; } }
    if (py.length) { const m = new THREE.InstancedMesh(pg, new THREE.MeshLambertMaterial({ vertexColors: true }), py.length), o = new THREE.Object3D(); py.forEach((p, k) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.rot, 0); o.updateMatrix(); m.setMatrixAt(k, o.matrix); red.push(p.x, p.y + 45, p.z); });
      m.frustumCulled = false; scene.add(m); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3)); const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3d42, transparent: true, opacity: 0.75 })); ln.frustumCulled = false; scene.add(ln); XT.pylons = m; XT.wires = ln; } }
  // --- night signs: a green lamp on every minaret, floodlights round the stadiums, red lamps on cranes and pylons ---
  for (const s of SITE.list) { const y = triHeight(s.x, s.z);
    if (s.kind === 'mosque' || s.kind === 'minaret') green.push(s.x + (s.kind === 'mosque' ? Math.cos(s.rot) * 14 + Math.sin(s.rot) * -12 : 0), y + (s.kind === 'mosque' ? 31 : 27), s.z + (s.kind === 'mosque' ? -Math.sin(s.rot) * 14 + Math.cos(s.rot) * -12 : 0));
    else if (s.kind === 'stadium') { const a = Math.max(s.L, 110) * 0.56, b = Math.max(s.W, 80) * 0.56, c = Math.cos(s.rot), sn = Math.sin(s.rot); for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.05], [0, 1.05]]) flood.push(s.x + u * a * c + v * b * sn, y + 34, s.z - u * a * sn + v * b * c); } }
  const pts = (arr, col, size, hi) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const p = new THREE.Points(g, clampPoints(new THREE.PointsMaterial({ size, map: lightDot(), color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 1.5, hi)); p.visible = false; p.frustumCulled = false; scene.add(p); return p; };
  XT.red = pts(red, 0xff3020, 12, 8); XT.green = pts(green, 0x35ff6a, 13, 8); XT.flood = pts(flood, 0xf4f8ff, 46, 16);
  // --- the lightning bolt: a jagged ribbon from the cloud base to the ground, shown for the length of the flash ---
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 2 * 3), 3)); const I = []; for (let k = 0; k < 15; k++) I.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); g.setIndex(I);
    XT.bolt = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf2f4ff, side: THREE.DoubleSide, fog: false, toneMapped: false, transparent: true, depthWrite: false })); XT.bolt.frustumCulled = false; XT.bolt.visible = false; scene.add(XT.bolt); }
}

/** Jerusalem's Old City: crenellated walls on the real outline with towers at the corners and gates, and inside them a tight fabric of small
    stone houses, a third of them domed, with alleys between. Two instanced meshes; every house is a solid obstacle. */
function buildOldCity() {
  const O = OLDCITY, P = O.poly, mat = new THREE.MeshLambertMaterial({ vertexColors: true }), box = mergeGeo([[new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 1, 1, 1]]), dome = mergeGeo([[new THREE.SphereGeometry(0.5, 10, 6, 0, 6.2832, 0, 1.5708), 1, 1, 1]]);
  const B = [], D = [], stoneC = [0xe2d3ae, 0xd9c79f, 0xe8dcbc, 0xcfbd95, 0xdccfae, 0xc9b78d], put = (x, y, z, sx, sy, sz, ry, col) => B.push([x, y, z, sx, sy, sz, ry, col]);
  // walls: a run of wall per edge, merlons along the top, a tower at every corner (the gates stand taller)
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), n = Math.ceil(len / 40);
    for (let k = 0; k < n; k++) { const f = (k + 0.5) / n, x = O.x + a[0] + dx * f, z = O.z + a[1] + dz * f, y = Math.min(triHeight(x, z), triHeight(O.x + a[0] + dx * k / n, O.z + a[1] + dz * k / n), triHeight(O.x + a[0] + dx * (k + 1) / n, O.z + a[1] + dz * (k + 1) / n)) - 3; put(x, y, z, 5, 17, len / n + 0.5, ry, 0xd6c8a2);
      addObst(x, z, 5, len / n, -ry, y, y + 17); for (let m = 0; m < len / n / 4.2 - 0.5; m++) { const g = (m + 0.5) * 4.2 - len / n / 2; put(x + Math.sin(ry) * g, y + 17, z + Math.cos(ry) * g, 5.4, 1.6, 2.2, ry, 0xd6c8a2); } }
    const gate = i === 2 || i === 10 || i === 8 || i === 7, tx = O.x + a[0], tz = O.z + a[1], ty = triHeight(tx, tz) - 3, tw = gate ? 20 : 13, th = gate ? 27 : 22; put(tx, ty, tz, tw, th, tw, ry, 0xcfc09a); addObst(tx, tz, tw, tw, 0, ty, ty + th);
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(tx + u * tw * 0.4, ty + th, tz + v * tw * 0.4, tw * 0.2, 1.8, tw * 0.2, ry, 0xcfc09a); }
  // houses: a jittered 16 m lattice, each cell one house or a pair, never on the Temple Mount platform, a road or something that already stands there
  for (let a = -430; a <= 140; a += 16) for (let b = -335; b <= 325; b += 16) { const h1 = hash2(a * 0.37 + 5, b * 0.71 + 9), h2 = hash2(a * 0.91 + 2, b * 0.33 + 4), h3 = hash2(a * 0.13 + 8, b * 0.57 + 1);
    const x = O.x + a + (h1 - 0.5) * 3, z = O.z + b + (h2 - 0.5) * 3; if (!inOldCity(x, z, 13) || (Math.abs(a) < 146 && Math.abs(b) < 176) || h3 < 0.07) continue;
    const w = 9.5 + h1 * 4.5, d = 9.5 + h2 * 4.5, h = 6 + h3 * 9 + (h1 > 0.9 ? 6 : 0); if (nearRoad(x, z, 7) || obstBox(x, z, w / 2, d / 2) || LMK.list.some(l => Math.hypot(l.x - x, l.z - z) < l.r * 0.75 + 7)) continue;
    const y = triHeight(x, z) - 2.5, col = stoneC[(h3 * 97 | 0) % stoneC.length]; put(x, y, z, w, h + 2.5, d, (h1 - 0.5) * 0.12, col); addObst(x, z, w, d, 0, y, y + h + 2.5);
    if (h2 > 0.64) D.push([x, y + h + 2.5, z, Math.min(w, d) * 0.62, col]); else if (h1 > 0.5) put(x + (h2 - 0.3) * 3, y + h + 2.5, z + (h1 - 0.7) * 3, w * 0.4, 2.4, d * 0.4, 0, col); }
  const o = new THREE.Object3D(), c = new THREE.Color(), bm = new THREE.InstancedMesh(box, mat, B.length), dm = new THREE.InstancedMesh(dome, mat, Math.max(1, D.length));
  B.forEach((e, k) => { o.position.set(e[0], e[1], e[2]); o.rotation.set(0, e[6], 0); o.scale.set(e[3], e[4], e[5]); o.updateMatrix(); bm.setMatrixAt(k, o.matrix); bm.setColorAt(k, c.setHex(e[7])); });
  D.forEach((e, k) => { o.position.set(e[0], e[1] - 0.2, e[2]); o.rotation.set(0, 0, 0); o.scale.set(e[3], e[3] * 0.85, e[3]); o.updateMatrix(); dm.setMatrixAt(k, o.matrix); dm.setColorAt(k, c.setHex(k % 7 === 0 ? 0x8f9aa0 : e[4]).multiplyScalar(0.96)); });
  for (const m of [bm, dm]) { m.frustumCulled = false; m.userData = { x: O.x - 145, z: O.z, half: 340, far: 16000 }; scene.add(m); cityMeshes.push(m); } XT.oldCity = [bm, dm];
}

/** The two bridges of `BRIDGES`. The viaduct: a deck on tall piers, solid (deck and piers are obstacles), with clear air under it: flying under the deck
    between two piers is answered with a message. The Chords Bridge: a low curved deck, a leaning white mast and its cables. */
function buildBridges() {
  const conc = new THREE.MeshLambertMaterial({ color: 0xd2cfc6 }), dark = new THREE.MeshLambertMaterial({ color: 0x3c3f44 }), white = new THREE.MeshLambertMaterial({ color: 0xf2f2ee });
  const box = (w, h, d, mat, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry || 0; scene.add(m); return m; };
  XT.under = [];
  for (const [kind, lon, lat, rot, len, h] of BRIDGES) { const cx = lon2x(lon), cz = lat2z(lat), sx = Math.sin(rot), sz = Math.cos(rot), at = u => [cx + sx * u, cz + sz * u];
    if (kind === 'viaduct') { let lo = 1e9; for (let u = -len / 2; u <= len / 2; u += 30) lo = Math.min(lo, triHeight(...at(u))); const y = lo + h;
      box(22, 3, len, conc, cx, y, cz, rot); box(22.6, 0.5, len, dark, cx, y + 1.7, cz, rot); for (const s of [-1, 1]) box(0.5, 1.6, len, conc, cx + sz * s * 11, y + 2.3, cz - sx * s * 11, rot);
      addObst(cx, cz, 22, len, rot, y - 2.5, y + 4);
      for (let u = -len / 2 + 45; u <= len / 2 - 45; u += 90) { const [px, pz] = at(u), g = triHeight(px, pz), ph = y - 1.5 - g + 4; if (ph < 6) continue; box(13, ph, 4.5, conc, px, g - 4 + ph / 2, pz, rot); box(16, 2.4, 6, conc, px, y - 2.6, pz, rot); addObst(px, pz, 13, 4.5, rot, g - 4, y); }
      XT.under.push({ cx, cz, sx, sz, half: len / 2 - 8, wid: 15, y }); }
    else { const y0 = triHeight(cx, cz), dy = 11;          // the deck curves: three straight pieces, each turned a little more
      for (const [u, tw] of [[-len / 3, -0.22], [0, 0], [len / 3, 0.22]]) { const [px, pz] = at(u); box(14, 1.6, len / 3 + 6, conc, px + sz * Math.abs(tw) * 60, y0 + dy, pz - sx * Math.abs(tw) * 60, rot + tw); box(4, dy + 3, 4, conc, px + sz * Math.abs(tw) * 60, y0 + dy / 2 - 2, pz - sx * Math.abs(tw) * 60, rot + tw); }
      const mx = cx - sz * 16, mz = cz + sx * 16, top = new THREE.Vector3(mx - sz * 26, y0 + h, mz + sx * 26), base = new THREE.Vector3(mx, y0, mz), mid = base.clone().lerp(top, 0.5), mast = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.4, base.distanceTo(top), 8), white);
      mast.position.copy(mid); mast.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(base).normalize()); scene.add(mast); addObst(mid.x, mid.z, 30, 30, 0, y0, y0 + h);
      const W = []; for (let k = 0; k < 22; k++) { const u = -len / 2 + 14 + k * (len - 28) / 21, [px, pz] = at(u), tw = Math.abs(u) / (len / 2) * 0.22 * 60 * (Math.abs(u) > len / 6 ? 1 : 0.4), a = base.clone().lerp(top, 0.55 + 0.42 * (k % 11) / 10); W.push(a.x, a.y, a.z, px + sz * tw, y0 + dy + 1, pz - sx * tw); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3)); const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf4f4f0 })); ln.frustumCulled = false; scene.add(ln); } }
}
/** Company in the sky: the other aircraft are real models now (the airliner and the business jet, wheels up), hot-air balloons hang over the Jezreel
    valley, and a flock of birds wheels over the coast north of Tel Aviv. Balloons are solid; birds are not. */
function skinTraffic() {          // called once the other aircraft exist (they are made after this file's builders)
  AIT.forEach((a, i) => { const M = AC.models[i % 3 === 1 ? 'bizjet' : 'airliner'], c = M.g.clone(true); c.visible = true; const gi = M.g.children.indexOf(M.gear); if (gi >= 0) c.children[gi].visible = false;
    for (const l of M.land || []) { const li = M.g.children.indexOf(l); if (li >= 0) c.children[li].visible = false; } while (a.g.children.length) a.g.remove(a.g.children[0]); a.g.add(c); });
}
function buildSkyLife() {
  // balloons: a striped envelope and a basket
  { const prof = [[0.2, -9], [3.2, -7.4], [7.4, -3], [9, 1.5], [8.2, 5.6], [5.4, 8.4], [0.1, 9.6]].map(p => new THREE.Vector2(p[0], p[1])), env = new THREE.LatheGeometry(prof, 16), n = env.attributes.position.count, col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const stripe = Math.floor(env.attributes.uv.getX(k) * 16 - 0.001) % 2; col[k * 3] = 1; col[k * 3 + 1] = stripe ? 1 : 0.42; col[k * 3 + 2] = stripe ? 1 : 0.42; } env.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const g = mergeGeo([[env.toNonIndexed(), 1, 1, 1]]); { const src = env.toNonIndexed().attributes.color.array, dst = g.attributes.color.array; for (let k = 0; k < dst.length; k++) dst[k] = src[k]; }
    const bk = mergeGeo([[new THREE.BoxGeometry(1.6, 1.3, 1.6).translate(0, -12.6, 0), 0.45, 0.3, 0.16], [new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4).translate(0.7, -10.6, 0.7), 0.2, 0.2, 0.2], [new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4).translate(-0.7, -10.6, -0.7), 0.2, 0.2, 0.2]]);
    const N = 9, mat = new THREE.MeshLambertMaterial({ vertexColors: true }), a = new THREE.InstancedMesh(g, mat, N), b = new THREE.InstancedMesh(bk, mat, N), c = new THREE.Color(), pal = [0xe33b2e, 0x2f7fd0, 0xf0b020, 0x3fa85a, 0xb04ac0, 0xff7a1a, 0x18a6a6, 0xd02a6a, 0x5a6ad8]; XT.bal = { a, b, list: [] };
    for (let k = 0; k < N; k++) { const x = lon2x(35.14 + hash2(k, 3) * 0.24), z = lat2z(32.57 + hash2(k, 7) * 0.12); XT.bal.list.push({ x, z, y: groundAt(x, z).h + 240 + hash2(k, 11) * 380, ph: k * 1.7 }); a.setColorAt(k, c.setHex(pal[k])); b.setColorAt(k, c.setHex(0xffffff)); }
    for (const m of [a, b]) { m.frustumCulled = false; scene.add(m); } }
  // birds: forty small wings that beat, on a slow circle
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1.1, 0, 0.1, 0, 0, -0.35, 0, 0, 0.3, 1.1, 0, 0.1, 0, 0, 0.3, 0, 0, -0.35], 3)); g.computeVertexNormals();
    const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x2a2c30, side: THREE.DoubleSide }), 40); m.frustumCulled = false; scene.add(m); XT.birds = { m, cx: lon2x(34.775), cz: lat2z(32.15), off: [] }; for (let k = 0; k < 40; k++) XT.birds.off.push([(hash2(k, 1) - 0.5) * 90, (hash2(k, 2) - 0.5) * 26, (hash2(k, 5) - 0.5) * 70, hash2(k, 9) * 6]); }
}
function updateSkyLife(dt) {
  const o = updateSkyLife.o || (updateSkyLife.o = new THREE.Object3D());
  if (!XT.skinned && AIT.length) { XT.skinned = true; skinTraffic(); }
  if (XT.bal) { XT.bal.list.forEach((b, k) => { const y = b.y + Math.sin(TNOW * 0.25 + b.ph) * 12; o.position.set(b.x, y, b.z); o.rotation.set(0, TNOW * 0.05 + b.ph, 0); o.scale.setScalar(1.6); o.updateMatrix(); XT.bal.a.setMatrixAt(k, o.matrix); XT.bal.b.setMatrixAt(k, o.matrix);
      if (!S.crashed && S.started && Math.hypot(S.pos.x - b.x, S.pos.y - y, S.pos.z - b.z) < 17) crash(L('Flew into a balloon.', 'התנגשות בכדור פורח')); }); XT.bal.a.instanceMatrix.needsUpdate = true; XT.bal.b.instanceMatrix.needsUpdate = true; }
  if (XT.birds) { const B = XT.birds, a = TNOW * 0.05, bx = B.cx + Math.cos(a) * 520, bz = B.cz + Math.sin(a) * 520, by = 120 + Math.sin(TNOW * 0.11) * 40, hd = Math.atan2(-Math.sin(a), -Math.cos(a)) + Math.PI / 2;
    B.off.forEach((f, k) => { o.position.set(bx + f[0], by + f[1] + Math.sin(TNOW * 0.9 + f[3]) * 3, bz + f[2]); o.rotation.set(0, -a, 0); o.scale.set(1, 1, 1); o.updateMatrix(); const e = o.matrix.elements, fl = Math.sin(TNOW * 9 + f[3]) * 0.5; e[1] = fl * 0.6; B.m.setMatrixAt(k, o.matrix); }); B.m.instanceMatrix.needsUpdate = true; }
  // flying close beside another aircraft for a few seconds
  if (!S.onGround && !S.crashed) { let near = false; for (const t of AIT) { const d = t.g.position.distanceTo(S.pos); if (d < 190 && d > 32) near = true; } XT.formT = near ? (XT.formT || 0) + dt : 0;
    if (XT.formT > 3.5 && TNOW - (XT.dareT || -99) > 20) { XT.dareT = TNOW; XT.formT = 0; toast(L('Formation flight!', 'טיסת מבנה!'), 2.4); Snd.chime(880, 0.2); buzz(25); } }
  // under the viaduct
  if (XT.under && !S.onGround && !S.crashed) for (const u of XT.under) { const dx = S.pos.x - u.cx, dz = S.pos.z - u.cz, al = dx * u.sx + dz * u.sz, ac = dx * u.sz - dz * u.sx; if (Math.abs(al) < u.half && Math.abs(ac) < u.wid && S.pos.y < u.y - 3 && S.pos.y > u.y - 70 && TNOW - (XT.underT || -99) > 8) { XT.underT = TNOW; XT.dareT = TNOW; toast(L('Under the bridge!', 'מתחת לגשר!'), 2.6); fanfare(2); } }
}
/** One puff of smoke or vapour into the trail buffer. */
function puff(x, y, z, size, alpha) { if (!TR) return; const i = TR.i; TR.i = (i + 1) % TR.n; TR.pos[i * 3] = x; TR.pos[i * 3 + 1] = y; TR.pos[i * 3 + 2] = z; TR.dat[i * 3] = TNOW; TR.dat[i * 3 + 1] = size; TR.dat[i * 3 + 2] = alpha; TR.pts.geometry.attributes.position.needsUpdate = true; TR.pts.geometry.attributes.aDat.needsUpdate = true; }

function updateExtras(dt, run, moved) {
  padRead(dt);
  if (TILT.on && performance.now() - TILT.t > 600) TILT.x = TILT.y = 0;          // the sensor went quiet: let go rather than hold the last tilt
  const lights = ENV.uLights.value, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  // night lamps follow the light; the instruments dim a little at night
  if (lights !== XT.night) { XT.night = lights; for (const [p, k] of [[XT.lamps, 0.95], [XT.red, 1], [XT.green, 1], [XT.flood, 0.9]]) if (p) { p.visible = lights > 0.05; p.material.opacity = Math.min(1, lights * 1.3) * k; }
    document.body.classList.toggle('night', lights > 0.6); }
  POST.k = 0.28 + 0.72 * lights;          // by day only the brightest glints bloom (white paint in the sun must not); at night every lamp does
  // cars near the camera become small 3D cars (the light dots stay for the night)
  if (XT.cars && traffic && moved) { const m = XT.cars, o = updateExtras.o || (updateExtras.o = new THREE.Object3D()); let n = 0; const near = cy - groundAt(cx, cz).h < 700, arr = traffic.pts.geometry.attributes.position.array, R2 = 650 * 650;
    if (near) for (let i = 0; i < traffic.cars.length && n < 90; i++) { const dx = arr[i * 3] - cx, dz = arr[i * 3 + 2] - cz; if (dx * dx + dz * dz > R2) continue; const c = traffic.cars[i], k = c.s | 0, mm = c.p.length - 1, p = c.p[k], q = c.p[Math.min(k + 1, mm)], sg = c.v < 0 ? -1 : 1;
      let ux = (q[0] - p[0]) * sg, uz = (q[2] - p[2]) * sg; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l; const off = p[3] === 2 ? 5.2 : 1.5;
      o.position.set(arr[i * 3] - uz * off, arr[i * 3 + 1] - 1.0, arr[i * 3 + 2] + ux * off);          /* the light dots ride 3.8 m over the ground, the road surface 2.2 to 3 m */ o.rotation.set(0, Math.atan2(-ux, -uz), 0); o.scale.setScalar(i % 9 === 0 ? 1.35 : 1); o.updateMatrix(); m.setMatrixAt(n++, o.matrix); if (lights < 0.3) arr[i * 3 + 1] -= 40; }
    m.count = n; m.instanceMatrix.needsUpdate = true; }
  if (!run) return;
  updateSkyLife(dt);
  // daring flying is answered: a low pass, a pass between towers, skimming the sea (one short message with a chime, at most every 20 s)
  if (!S.onGround && !S.crashed && !S.land && S.airTime > 15 && TNOW - (XT.dareT || -99) > 20) { const fast = S.V > PL.vs * 1.25, wet = groundAt(S.pos.x, S.pos.z).water; let msg = '';
    if (fast && S.ra > 8 && obstacleTop(S.pos.x, S.pos.z) > S.pos.y + 12 && lcAt(S.pos.x, S.pos.z) !== 9 && urbanAt(S.pos.x, S.pos.z) > 0.05) msg = L('Between the towers!', 'בין המגדלים!');
    else if (fast && S.ra < 22 && S.ra > 1) { XT.lowT = (XT.lowT || 0) + dt; if (XT.lowT > 1.4 && !AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R)) msg = wet ? L('Skimming the sea!', 'רפרוף מעל הים!') : L('Low pass! ', 'מעבר נמוך! ') + altTxt(S.ra); } else XT.lowT = 0;
    if (msg) { XT.dareT = TNOW; XT.lowT = 0; toast(msg, 2.2); Snd.chime(880, 0.2); buzz(25); } }
  // the vapour cone as the sound barrier breaks
  if (S.boomT !== undefined && TNOW - S.boomT < 0.5 && TNOW - S.boomT >= 0) { fwd.set(0, 0, -1).applyQuaternion(S.q); const r = PL.chase[0] * 0.13; for (let k = 0; k < 3; k++) { const a = Math.random() * 6.283; tmpV.set(Math.cos(a) * r, Math.sin(a) * r, PL.chase[0] * 0.05).applyQuaternion(S.q).add(S.pos); puff(tmpV.x, tmpV.y, tmpV.z, r * 0.9, 0.5); } }
  // tyre smoke at touchdown; vapour off the wingtips in a hard pull
  if (S.onGround && !XT.wasGround && S.V > 15) buzz(30);
  if (S.onGround && !XT.wasGround && S.V > 25) { fwd.set(0, 0, -1).applyQuaternion(S.q); for (let k = 0; k < 10; k++) puff(S.pos.x - fwd.x * (k * 2.2 - 4) + (Math.random() - 0.5) * 5, S.pos.y - GEAR_H + 0.8, S.pos.z - fwd.z * (k * 2.2 - 4) + (Math.random() - 0.5) * 5, 2.6 + Math.random() * 2, 0.5); }
  XT.wasGround = S.onGround;
  if (!S.onGround && !S.arc && S.nLoad > 3.6 && S.V > 70 && S.pos.y < 6000) { XT.vap += S.V * dt; if (XT.vap > 3) { XT.vap = 0; const w = (PL.span || PL.chase[0] * 0.7) * 0.5; for (const sx of [-1, 1]) { tmpV.set(sx * w, 0.2, 1.5).applyQuaternion(S.q).add(S.pos); puff(tmpV.x, tmpV.y, tmpV.z, 0.7, 0.55); } } }
  // lightning
  if (XT.bolt) { const on = S.flash > 0 && WX === 2; if (on && !XT.bolt.visible) { const p = XT.bolt.geometry.attributes.position, a = Math.random() * 6.283, d = 2500 + Math.random() * 6000; camera.getWorldDirection(tmpV); let x = cx + tmpV.x * d + Math.cos(a) * 1500, z = cz + tmpV.z * d + Math.sin(a) * 1500; const g = groundAt(x, z).h, top = Math.max(g + 900, 1500), px = -tmpV.z, pz = tmpV.x;
      for (let k = 0; k < 16; k++) { const f = k / 15, y = top + (g - top) * f, w = 5 + 9 * (1 - f); if (k) { x += (Math.random() - 0.5) * 130; z += (Math.random() - 0.5) * 130; } p.setXYZ(k * 2, x - px * w, y, z - pz * w); p.setXYZ(k * 2 + 1, x + px * w, y, z + pz * w); } p.needsUpdate = true; }
    XT.bolt.visible = on; }
}

// ---------- 12g-2. Where the frame time goes: `?perf=1` ----------
/**
 * A measurement for a real device (the game was only ever run on a software renderer here). Open the page with `?perf=1`, start a flight, and after a
 * moment it flies itself to three places and draws each one a few dozen times in different ways, waiting for the graphics chip to finish every frame
 * (a one-pixel read), so the numbers are real drawing times and not capped by the screen's 60 frames a second. Then it shows a table to photograph:
 * the whole frame, without the post pass, at half the resolution in each direction (a quarter of the pixels: if the time falls with it, pixels are the
 * cost), and without the terrain, the water, the buildings or the sky (what each one costs); the triangles and draw calls; the time the game's own
 * code takes per frame. Nothing of this runs or shows without the parameter.
 */
const PERF = { on: /[?&]perf=1/.test(location.search), jsAcc: 0, jsN: 0, jsMax: 0, busy: false };
PERF.acc = ms => { PERF.jsAcc += ms; PERF.jsN++; if (ms > PERF.jsMax) PERF.jsMax = ms; };
async function perfRun() {
  if (PERF.busy) return; PERF.busy = true; const gl = renderer.getContext(), px = new Uint8Array(4), wait = ms => new Promise(r => setTimeout(r, ms)), raf = () => new Promise(r => requestAnimationFrame(r));
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;right:0;top:0;max-height:100%;overflow:auto;z-index:99;background:rgba(6,10,16,.93);color:#e8eef5;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;padding:10px;white-space:pre;direction:ltr;text-align:left;user-select:text;-webkit-user-select:text;pointer-events:auto';
  document.body.appendChild(box); const say = t => { box.textContent = t; };
  const isTerr = m => m.material && m.material.uniforms && m.material.uniforms.tLC, isWater = m => m.material && m.material.uniforms && m.material.uniforms.deepCol;          /* (the first version matched the terrain as well, and so reported the water as costing what the terrain costs) */
  const terr = scene.children.filter(isTerr), water = scene.children.filter(isWater), bld = [...cityMeshes, ...LMK.meshes, ...SITE.meshes], skyG = [sky, clouds, glare].filter(Boolean);
  const draw = n => { for (let i = 0; i < 3; i++) { renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } const t0 = performance.now(); for (let i = 0; i < n; i++) { renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return (performance.now() - t0) / n; };
  const without = (list, n) => { const was = list.map(m => m.visible); for (const m of list) m.visible = false; const t = draw(n); list.forEach((m, i) => m.visible = was[i]); return t; };
  const places = [['low and fast up the coast', 34.80, 32.00, 150, 20, 0, 1], ['Tel Aviv, low', 34.775, 32.06, 250, 0, 0], ['Jerusalem hills', 35.08, 31.78, 600, 90, 0], ['high over the south', 34.95, 31.45, 0, 0, 6000]], rows = [], N = 10;
  const post0 = POST.on, pr0 = RES.pr, fixed0 = RES.fixed, mode0 = S.mode, cam0 = S.cam;
  for (const [name, lon, lat, agl, hdg, alt, fast] of places) {
    say('measuring: ' + name + ' …'); setMode(0); S.cam = 1; spawn(alt ? { type: 'air', lon, lat, alt, hdg, spd: 115, label: name } : fast ? { type: 'air', lon, lat, agl, hdg, spd: 280, thr: 1, label: name } : { type: 'air', lon, lat, agl, hdg, spd: 115, label: name }); PERF.jsAcc = PERF.jsN = 0;
    PERF.busy = false; for (let i = 0; i < 30; i++) await raf(); PERF.jsAcc = PERF.jsN = PERF.jsMax = 0; const tR = performance.now(); let tP = tR, worst = 0, late = 0; for (let i = 0; i < 240; i++) { await raf(); const tN = performance.now(), dF = tN - tP; tP = tN; if (dF > worst) worst = dF; if (dF > 25) late++; } const real = (performance.now() - tR) / 240, jsMax = PERF.jsMax; PERF.busy = true; const js = PERF.jsN ? PERF.jsAcc / PERF.jsN : 0;          /* four seconds of play: the average, and the frames that came late (what is felt as jumps) */          /* as played: the game's own loop, on the screen's clock */
    const r = { name, js, real, worst, late, jsMax, det: DET.lvl, pr: RES.pr }; POST.on = post0; r.full = draw(N); await raf();
    POST.on = false; r.noPost = draw(N); renderer.info.reset(); renderer.render(scene, camera); r.calls = renderer.info.render.calls; r.tris = renderer.info.render.triangles;
    { const cnt = list => { const was = list.map(m => m.visible); for (const m of list) m.visible = false; renderer.info.reset(); renderer.render(scene, camera); list.forEach((m, i) => m.visible = was[i]); return [r.tris - renderer.info.render.triangles, r.calls - renderer.info.render.calls]; }; r.gT = cnt(terr); r.gB = cnt(bld); r.gW = cnt(water); }
    { const t0 = performance.now(); for (let i = 0; i < N; i++) renderer.render(scene, camera); r.submit = (performance.now() - t0) / N; gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } await raf();
    { const prN = RES.pr; renderer.setPixelRatio(prN * 0.5); resize(); r.half = draw(N); renderer.setPixelRatio(prN); resize(); } await raf();
    r.noTerr = without(terr, N); r.noWater = without(water, N); await raf(); r.noBld = without(bld, N); r.noSky = without(skyG, N); r.onlyTerr = without(scene.children.filter(m => !isTerr(m) && m.type !== 'HemisphereLight' && m.type !== 'DirectionalLight'), N);
    POST.on = post0; rows.push(r); await raf(); }
  // What brings the frame rate back: the same two places as played, each time with one of the newer extras switched off (the governor and the automatic
  // resolution held still). The answer is in which line returns to 60.
  const ab = []; { const lv = DET.lvl, fx0 = RES.fixed; DET.lvl = 5; RES.fixed = RES.pr; setMode(0); S.cam = 1;
    const far0 = new Map(), hide = kind => { for (const m of cityMeshes) if (m.userData.kind === kind) { far0.set(m, m.userData.far); m.userData.far = 0; } }, show = () => { for (const [m, fr] of far0) m.userData.far = fr; far0.clear(); };
    const U = TERRAIN_MAT.uniforms, sat0 = U.uSat.value, bs0 = U.uBS.value, V = [['all on', () => {}, () => {}], ['no far forest', () => hide('forest'), show], ['no roof detail', () => hide('roof'), show],
      ['no tree shadows', () => { scatter.tsh.visible = scatter.bsh.visible = false; }, () => { scatter.tsh.visible = scatter.bsh.visible = true; }], ['no drawn facades', () => { FACADE.value = 0; }, () => { FACADE.value = 1; }],
      ['plain terrain colour', () => { U.uSat.value = 0; U.uX.value = 0; }, () => { U.uSat.value = sat0; U.uX.value = 1; }], ['no building shadows', () => { U.uBS.value = 0; }, () => { U.uBS.value = bs0; }], ['all of these off', () => { hide('forest'); hide('roof'); scatter.tsh.visible = scatter.bsh.visible = false; FACADE.value = 0; U.uSat.value = 0; U.uX.value = 0; U.uBS.value = 0; }, () => { show(); scatter.tsh.visible = scatter.bsh.visible = true; FACADE.value = 1; U.uSat.value = sat0; U.uX.value = 1; U.uBS.value = bs0; }]];
    for (const [name, lon, lat, agl, hdg, fast] of [['low and fast up the coast', 34.80, 32.00, 150, 20, 1], ['Jerusalem hills', 35.08, 31.78, 600, 90, 0]]) { const row = { name, v: [] };
      for (const [vn, off, on] of V) { say('comparing: ' + name + ', ' + vn + ' …'); spawn({ type: 'air', lon, lat, agl, hdg, spd: fast ? 280 : 115, thr: fast ? 1 : undefined, label: name }); off(); PERF.busy = false; for (let i = 0; i < 45; i++) await raf();
        const t0 = performance.now(); let tP = t0, late = 0; for (let i = 0; i < 150; i++) { await raf(); const tN = performance.now(); if (tN - tP > 25) late++; tP = tN; } row.v.push([vn, (performance.now() - t0) / 150, late]); on(); PERF.busy = true; }
      ab.push(row); }
    DET.lvl = lv; RES.fixed = fx0; PERF.ab = ab; PERF.abInfo = 'density x' + RES.pr + ', draw distance ' + Math.round(DET.far * 100) + '%'; }
  RES.fixed = fixed0; setMode(mode0); S.cam = cam0;
  const f = v => (v < 10 ? ' ' : '') + v.toFixed(1), dbg = gl.getExtension('WEBGL_debug_renderer_info'), buf = renderer.getDrawingBufferSize(new THREE.Vector2());
  let out = 'FRAME TIME, ms per frame (16.7 = 60 fps, 33 = 30 fps)\nthe lines under AS PLAYED wait for the chip after every frame: they compare parts, and read higher than play\n' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'gpu unknown') + '\nscreen ' + innerWidth + 'x' + innerHeight + ' css, drawn ' + buf.x + 'x' + buf.y + ' (x' + pr0 + '), post pass ' + (post0 ? 'on' : 'off') + ', detail ' + DET.lvl + ', terrain grid ' + NX + 'x' + NZ + '\n';
  for (const r of rows) { const pixShare = Math.max(0, Math.min(1, (r.noPost - r.half) / r.noPost / 0.75));
    out += '\n' + r.name.toUpperCase() + '\n  AS PLAYED          ' + f(r.real) + '   = ' + Math.round(1000 / r.real) + ' frames a second (the screen caps this); detail step ' + r.det + ', density x' + r.pr + '\n  late frames        ' + r.late + ' of 240 came over 25 ms, the worst ' + f(r.worst) + '; game code at its worst ' + f(r.jsMax) + '\n  whole frame        ' + f(r.full) + '\n  no post pass       ' + f(r.noPost) + '   (post pass costs ' + f(r.full - r.noPost) + ')\n  quarter the pixels ' + f(r.half) + '   -> about ' + Math.round(pixShare * 100) + '% of the drawing time is per pixel'
      + '\n  without terrain    ' + f(r.noTerr) + '   (terrain costs ' + f(r.noPost - r.noTerr) + ')\n  without water      ' + f(r.noWater) + '   (water ' + f(r.noPost - r.noWater) + ')\n  without buildings  ' + f(r.noBld) + '   (buildings ' + f(r.noPost - r.noBld) + ')\n  without sky/clouds ' + f(r.noSky) + '   (sky ' + f(r.noPost - r.noSky) + ')\n  terrain alone      ' + f(r.onlyTerr)
      + '\n  triangles ' + r.tris.toLocaleString('en') + ', draw calls ' + r.calls + ', sending them ' + f(r.submit) + ' ms\n    of which terrain ' + r.gT[0].toLocaleString('en') + ' / ' + r.gT[1] + ', buildings and sites ' + r.gB[0].toLocaleString('en') + ' / ' + r.gB[1] + ', water ' + r.gW[0].toLocaleString('en') + ' / ' + r.gW[1] + ', the rest ' + (r.tris - r.gT[0] - r.gB[0] - r.gW[0]).toLocaleString('en') + ' / ' + (r.calls - r.gT[1] - r.gB[1] - r.gW[1]) + '\n  game code (flight, map, HUD) ' + f(r.js) + ' ms\n'; }
  { let t2 = 'WHAT BRINGS IT BACK (as played, ' + PERF.abInfo + '; ms a frame, late frames of 150)\n'; for (const r of PERF.ab) { t2 += r.name.toUpperCase() + '\n'; for (const [vn, ms, late] of r.v) t2 += '  ' + (vn + '                      ').slice(0, 22) + f(ms) + '  ' + late + ' late\n'; } out = t2 + '\n' + out; }
  out += '\n' + L('Take a screenshot of this and send it. Tap to close.', 'צלמו את המסך הזה ושלחו. נגיעה סוגרת.'); say(out); PERF.result = rows; PERF.text = out; box.addEventListener('click', () => box.remove()); PERF.busy = false;
}
if (PERF.on) { const iv = setInterval(() => { if (typeof WORLD !== 'undefined' && WORLD.ready && S.started && !S.paused && !S.crashed) { clearInterval(iv); setTimeout(perfRun, 2500); } }, 500); }
