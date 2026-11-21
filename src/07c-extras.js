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
  const map = { 0: 'KeyC', 2: 'KeyL', 3: 'KeyG', 4: 'KeyF', 5: 'KeyV', 9: 'Escape' };
  for (const k in map) { const on = b(+k) > 0.5; if (on && !PAD.was[k] && S.started) action(map[k]); PAD.was[k] = on; }
  PAD.brk = b(1) > 0.5;
}

function buildExtras() {
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
      const x = X0 + (i + 0.5) * 60 + (h - 0.25) * 60, z = Z0 + (j + 0.5) * 60 + (hash2(j, i) - 0.5) * 30, g = groundAt(x, z); if (g.h < 1 || nearRoad(x, z, 4) || obstBox(x, z, 2.5, 2.5) || airfieldAt(x, z, 400)) continue; list.push([x, triHeight(x, z), z, 34 + hash2(i + 7, j) * 26, hash2(i, j + 9) * 6.283]); }
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
        if (g.h < 1.5 || nearRoad(p[0], p[1], 7) || obstBox(p[0], p[1], 6, 6) || airfieldAt(p[0], p[1], 900)) continue;
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

/** One puff of smoke or vapour into the trail buffer. */
function puff(x, y, z, size, alpha) { if (!TR) return; const i = TR.i; TR.i = (i + 1) % TR.n; TR.pos[i * 3] = x; TR.pos[i * 3 + 1] = y; TR.pos[i * 3 + 2] = z; TR.dat[i * 3] = TNOW; TR.dat[i * 3 + 1] = size; TR.dat[i * 3 + 2] = alpha; TR.pts.geometry.attributes.position.needsUpdate = true; TR.pts.geometry.attributes.aDat.needsUpdate = true; }

function updateExtras(dt, run, moved) {
  padRead(dt);
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
  // tyre smoke at touchdown; vapour off the wingtips in a hard pull
  if (S.onGround && !XT.wasGround && S.V > 25) { fwd.set(0, 0, -1).applyQuaternion(S.q); for (let k = 0; k < 10; k++) puff(S.pos.x - fwd.x * (k * 2.2 - 4) + (Math.random() - 0.5) * 5, S.pos.y - GEAR_H + 0.8, S.pos.z - fwd.z * (k * 2.2 - 4) + (Math.random() - 0.5) * 5, 2.6 + Math.random() * 2, 0.5); }
  XT.wasGround = S.onGround;
  if (!S.onGround && !S.arc && S.nLoad > 3.6 && S.V > 70 && S.pos.y < 6000) { XT.vap += S.V * dt; if (XT.vap > 3) { XT.vap = 0; const w = (PL.span || PL.chase[0] * 0.7) * 0.5; for (const sx of [-1, 1]) { tmpV.set(sx * w, 0.2, 1.5).applyQuaternion(S.q).add(S.pos); puff(tmpV.x, tmpV.y, tmpV.z, 0.7, 0.55); } } }
  // lightning
  if (XT.bolt) { const on = S.flash > 0 && WX === 2; if (on && !XT.bolt.visible) { const p = XT.bolt.geometry.attributes.position, a = Math.random() * 6.283, d = 2500 + Math.random() * 6000; camera.getWorldDirection(tmpV); let x = cx + tmpV.x * d + Math.cos(a) * 1500, z = cz + tmpV.z * d + Math.sin(a) * 1500; const g = groundAt(x, z).h, top = Math.max(g + 900, 1500), px = -tmpV.z, pz = tmpV.x;
      for (let k = 0; k < 16; k++) { const f = k / 15, y = top + (g - top) * f, w = 5 + 9 * (1 - f); if (k) { x += (Math.random() - 0.5) * 130; z += (Math.random() - 0.5) * 130; } p.setXYZ(k * 2, x - px * w, y, z - pz * w); p.setXYZ(k * 2 + 1, x + px * w, y, z + pz * w); } p.needsUpdate = true; }
    XT.bolt.visible = on; }
}
