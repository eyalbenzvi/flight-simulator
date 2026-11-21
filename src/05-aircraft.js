'use strict';
// ---------- 9. Aircraft: specs, models, flight deck ----------
// roll/pitch are peak rates in rad/s; bank/up/dn are the Easy-mode limits in degrees; vc is a comfortable cruise in m/s.
// Performance checked against real types (see CLAUDE.md, "Flight model"): stall speeds, maximum speed (vmo is an indicated airspeed limit, m/s),
// climb, ceiling, load-factor limit nmax, roll rates. mcr: drag-rise Mach; sonic: supersonic (a transonic drag hump instead of a wall).
const PLANES = {
  airliner: { name: 'Airliner', tag: 'Twin-jet for 150 passengers. Steady and forgiving, slow to turn', mass: 65000, S: 125, T: 240000, cl0: 0.25, cla: 5, cd0: 0.028, k: 0.039, ast: 0.262, roll: 0.42, pitch: 0.2, gearH: 3.55, flaps: [0, 10, 20, 30], lapse: 0.0022, vmo: 180, mcr: 0.78, nmax: 2.5, spool: 0.25, bank: 50, up: 14, dn: 10, rot: 8, vc: 120, pace: 150, chase: [64, 21, 13], eye: [0, 1.16, -15], wingEye: [2.3, 1.25, -10.5], wingTgt: [13, -2.6, 2.5] },
  bizjet: { name: 'Business jet', tag: 'Sleek T-tail jet. Quick, agile, lands short', mass: 16000, S: 55, T: 64000, cl0: 0.25, cla: 5, cd0: 0.024, k: 0.05, ast: 0.262, roll: 0.8, pitch: 0.3, gearH: 1.75, flaps: [0, 10, 20, 30], lapse: 0.002, vmo: 170, mcr: 0.8, nmax: 3, spool: 0.3, bank: 60, up: 18, dn: 12, rot: 9, vc: 130, pace: 170, chase: [34, 10.5, 6.5], eye: [0, 0.5, -6.4], wingEye: [1.25, 0.55, -4.2], wingTgt: [7, -1.3, 2.5] },
  fighter: { name: 'Fighter jet', tag: 'Afterburner, Mach 1.5, rolls and loops. Hold on', mass: 12000, S: 28, T: 130000, cl0: 0.1, cla: 4.2, cd0: 0.02, k: 0.12, ast: 0.42, roll: 4.4, pitch: 0.95, gearH: 1.7, flaps: [0, 20], lapse: 0.00025, vmo: 410, mcr: 0.92, sonic: true, nmax: 9, spool: 0.5, bank: 76, up: 45, dn: 30, rot: 13, vc: 190, pace: 330, tricks: true, bubble: true, chase: [27, 7.5, 4.5], eye: [0, 0.98, -2.9], wingEye: [4.2, 2.4, 8.5], wingTgt: [-0.8, -0.2, -6] },
  stunt: { name: 'Aerobatic plane', tag: 'Light propeller plane with show smoke. Slow, nimble, lands anywhere', mass: 950, S: 10.7, T: 4800, cl0: 0.2, cla: 5, cd0: 0.03, k: 0.07, ast: 0.28, roll: 5.8, pitch: 1.2, gearH: 1.05, flaps: [0], lapse: 0.0062, vmo: 113, mcr: 0.6, nmax: 10, spool: 0.9, rhoExp: 1.7, bank: 78, up: 25, dn: 20, rot: 11, vc: 65, pace: 82, tricks: true, bubble: true, fixedGear: true, prop: true, chase: [14, 4.2, 2.6], eye: [0, 0.78, -0.25], wingEye: [1.7, 0.95, 2.7], wingTgt: [-0.3, 0.1, -4] }
};
const PLANE_ORDER = ['airliner', 'bizjet', 'fighter', 'stunt'];
for (const k in PLANES) { const p = PLANES[k]; p.key = k; p.vs = Math.sqrt(2 * p.mass * G / (1.225 * p.S * (p.cl0 + p.cla * p.ast))); }
let PL = PLANES.airliner;
const AC = { root: new THREE.Group(), deck: new THREE.Group(), frame: new THREE.Group(), models: {}, m: null, livery: [], envMats: [], glow: [] };
function planform(pts, t) {   // flat swept surface from (x, z) outline
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const b = Math.min(t * 0.42, 0.14), g = new THREE.ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * 1.6, bevelOffset: -b * 1.6, bevelSegments: 2 }); g.rotateX(Math.PI / 2); g.translate(0, t / 2 - b, 0); return g;       // rounded leading and trailing edges, not a sawn plank
}
function finGeo(pts, t) {     // vertical surface from (z, y) outline
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(t / 2, 0, 0); return g;
}
/** A tube-and-wing fuselage as one lathe: a rounded, slightly drooped nose, a constant section, an upswept tail cone. UV: u round the body
    (0 = belly, 0.25 = right side, 0.5 = top), v along it from the nose (0) to the tail (1). */
function fuselage(o, big) {
  const R = o.R, zN = o.z0 - o.nose * R, zT = o.z1 + o.tail, pts = [], N = 30;
  for (let i = 0; i <= N; i++) { const z = zN + (zT - zN) * Math.pow(i / N, i < 8 ? 1.25 : 1); let r;
    if (z < o.z0) { const t = (o.z0 - z) / (o.nose * R); r = R * Math.pow(Math.max(1 - t * t, 0), 0.62); }
    else if (z > o.z1) { const t = (z - o.z1) / o.tail; r = R * (1 - 0.80 * Math.pow(t, 1.35)); }
    else r = R;
    pts.push(new THREE.Vector2(Math.max(r, 0.012), z)); }
  const g = new THREE.LatheGeometry(pts, 28); g.rotateX(Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i); let y = p.getY(i);
    if (z > o.z1) y += R * 0.78 * Math.pow((z - o.z1) / o.tail, 1.5);                      // the tail cone sweeps up
    if (z < o.z0) y -= R * 0.20 * Math.pow((o.z0 - z) / (o.nose * R), 2);                   // the nose droops
    p.setY(i, y); uv.setY(i, (z - zN) / (zT - zN)); }
  g.computeVertexNormals(); return g;
}
/** The paint: white top, grey belly, a cheatline, the tail in the airline colour, one window per seat row, doors and cockpit panes, drawn on a canvas at
    start-up. A second canvas holds only the windows and lights them at night (emissiveMap). */
function liveryMat(o, big) {
  const W = 512, H = big ? 2048 : 1024, R = o.R, zN = o.z0 - o.nose * R, zT = o.z1 + o.tail, L = zT - zN, hex = c => '#' + c.toString(16).padStart(6, '0');
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; }, c1 = mk(), c2 = mk(), x = c1.getContext('2d'), e = c2.getContext('2d');
  const Y = z => H * (1 - (z - zN) / L), U = u => u * W, mPerU = 2 * Math.PI * R, du = m => m / mPerU * W, dz = m => m / L * H;
  x.fillStyle = hex(o.col); x.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  x.fillStyle = '#aab1b8'; x.fillRect(0, 0, U(0.13), H); x.fillRect(U(0.87), 0, U(0.13), H);                                                 // belly
  for (const side of [0.25, 0.75]) { const sg = side < 0.5 ? 1 : -1, uw = side + sg * 0.045, ul = side - sg * 0.012;
    x.fillStyle = hex(o.acc); x.fillRect(U(ul) - du(0.11), Y(o.z1 + o.tail * 0.15), du(0.22), Y(o.z0 - R * 0.6) - Y(o.z1 + o.tail * 0.15));    // cheatline under the windows
    if (!big) { x.fillStyle = '#c9a44a'; x.fillRect(U(ul - sg * 0.02) - du(0.04), Y(o.z1 + o.tail * 0.15), du(0.08), Y(o.z0 - R * 0.6) - Y(o.z1 + o.tail * 0.15)); }
    const step = big ? 0.53 : 0.62, ww = du(big ? 0.25 : 0.30), wh = dz(big ? 0.36 : 0.30);
    for (let z = o.z0 + (big ? 1.6 : 1.3); z < o.z1 - (big ? 0.6 : 0.2); z += step) { const px = U(uw) - ww / 2, py = Y(z) - wh / 2;
      x.fillStyle = '#1c2530'; x.beginPath(); x.ellipse(px + ww / 2, py + wh / 2, ww / 2, wh / 2, 0, 0, 7); x.fill();
      if ((z * 7.3 % 1 + 1) % 1 > 0.22) { e.fillStyle = '#ffe2a0'; e.beginPath(); e.ellipse(px + ww / 2, py + wh / 2, ww / 2, wh / 2, 0, 0, 7); e.fill(); } }
    x.strokeStyle = 'rgba(40,48,58,.55)'; x.lineWidth = 2;
    for (const z of big ? [o.z0 + 0.4, o.z1 - 1.2] : [o.z0 + 0.5]) x.strokeRect(U(side + sg * 0.03) - du(0.5), Y(z) - dz(0.42), du(1.0), dz(0.84));   // doors
  }
  // the tail in the airline colour, swept forward along the top
  x.fillStyle = hex(o.acc); x.beginPath(); x.moveTo(0, Y(zT)); x.lineTo(W, Y(zT)); x.lineTo(W, Y(o.z1 + o.tail * 0.55)); x.lineTo(U(0.5), Y(o.z1 - R * 1.2)); x.lineTo(0, Y(o.z1 + o.tail * 0.55)); x.closePath(); x.fill();
  // cockpit: six panes round the top of the nose
  x.fillStyle = '#141b24'; const zc0 = o.z0 - R * (big ? 0.55 : 0.2), zc1 = o.z0 - R * (big ? 1.15 : 1.0);
  for (let k = -3; k < 3; k++) { const u0 = 0.5 + k * 0.047 + 0.004, u1 = u0 + 0.039, t = Math.abs(k + 0.5) / 3; x.beginPath(); x.moveTo(U(u0), Y(zc0 + t * R * 0.25)); x.lineTo(U(u1), Y(zc0 + t * R * 0.25)); x.lineTo(U(u1), Y(zc1 + t * R * 0.3)); x.lineTo(U(u0), Y(zc1 + t * R * 0.3)); x.closePath(); x.fill(); }
  x.fillStyle = '#3a4047'; x.beginPath(); x.ellipse(W / 2, Y(zN), W, dz(R * 0.35), 0, 0, 7); x.fill();                                         // radome tip
  const map = new THREE.CanvasTexture(c1), em = new THREE.CanvasTexture(c2); map.anisotropy = em.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.MeshPhongMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, shininess: 70 }); AC.livery.push(m); AC.envMats.push(m); return m;
}
function buildAircraft() {
  const ph = (c, s) => { const m = new THREE.MeshPhongMaterial({ color: c, shininess: s || 50 }); AC.envMats.push(m); return m; }, lam = c => new THREE.MeshLambertMaterial({ color: c });
  AC.cabinMat = new THREE.MeshBasicMaterial({ color: 0x1b2430 });
  const dark = lam(0x23272c), tyre = lam(0x111214), cyl = (a, b, l, n) => new THREE.CylinderGeometry(a, b, l, n || 18).rotateX(Math.PI / 2);
  const canopy = new THREE.MeshPhongMaterial({ color: 0x18242f, shininess: 140, specular: 0xbfd8ee, transparent: true, opacity: 0.86 });
  for (const key of PLANE_ORDER) {
    const sp = PLANES[key], M = { g: new THREE.Group(), elev: [], ail: [], flap: [], strobes: [], rud: null, gear: null, beacon: null, prop: null, burner: null, emit: [] };
    const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || M.g).add(m); return m; };
    const pivot = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent || M.g).add(g); return g; };
    const lamp = (c, x, y, z, r) => { const sp2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightDot(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false })); sp2.userData.r = (r || 0.22) * 3.6; sp2.scale.setScalar(sp2.userData.r); sp2.position.set(x, y, z); M.g.add(sp2); AC.glow.push(sp2); return sp2; };       // lights that glow, and bloom at night
    const surf = (arr, x, y, z, w, t, c, mat, parent) => { const p = pivot(x, y, z, parent); add(new THREE.BoxGeometry(w, t, c), mat, 0, 0, c / 2, p); p.userData.z = z; arr.push(p); return p; };
    const leg = (x, z, r, top, parent) => { const bot = -sp.gearH, l = top - bot - r; add(new THREE.CylinderGeometry(0.04 + r * 0.16, 0.04 + r * 0.16, l, 8), dark, x, bot + r + l / 2, z, parent);
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(r, r, r * 0.55, 14).rotateZ(Math.PI / 2), tyre, x + s * r * 0.52, bot + r, z, parent); };

    if (key === 'airliner' || key === 'bizjet') {
      // ---- tube-and-wing jets share one parametric builder ----
      const big = key === 'airliner';
      const o = big
        ? { col: 0xf2f4f6, wcol: 0xb9c0c7, acc: 0x1557a8, R: 1.95, z0: -14, z1: 12, nose: 2.4, tail: 8.5, wing: [[1.4, -4.6], [17, 3.1], [17, 4.9], [6, 4.5], [1.4, 5.6]], wy: -1.1, wt: 0.5, dih: 0.09,
            ail: [13.5, 4.45, 5, 0.9], flap: [6.3, 4.6, 7, 1.3], eng: [5.8, -2.15, -3.2, 1.1, 4.4], hs: [[0.4, 15.2], [6.3, 18.7], [6.3, 19.9], [0.4, 19.4]], hsy: 0.75, elev: [3.4, 19.6, 5.6, 0.9],
            fin: [[13.6, 1.0], [19.6, 8.4], [21.6, 8.4], [20.2, 1.0]], rud: [4.7, 20.95, 7, 1.1, -0.19], gn: -12.2, gm: [3.3, 1.6], wr: 0.58 }
        : { col: 0xf4f1ea, wcol: 0xd9dcdf, acc: 0x1c2f52, R: 0.95, z0: -5.6, z1: 5.4, nose: 2.7, tail: 4.2, wing: [[0.7, -1.3], [8, 2.9], [8, 3.8], [3, 3.5], [0.7, 3.5]], wy: -0.6, wt: 0.24, dih: 0.07,
            ail: [6.2, 3.45, 2.6, 0.45], flap: [2.9, 3.4, 3.4, 0.65], eng: [1.72, 0.5, 5.0, 0.52, 2.7], rear: true, hs: [[0.1, 8.5], [3.3, 10.0], [3.3, 10.7], [0.1, 10.4]], hsy: 3.9, elev: [1.7, 10.35, 3.0, 0.45],
            fin: [[5.6, 0.5], [8.5, 3.95], [10.3, 3.95], [9.1, 0.5]], rud: [2.2, 9.65, 3.0, 0.55, -0.34], gn: -5.4, gm: [1.25, 1.9], wr: 0.3 };
      const body = ph(o.col, 60), wingM = ph(o.wcol, 40), acc = ph(o.acc, 50), R = o.R, len = o.z1 - o.z0, zc = (o.z0 + o.z1) / 2;
      add(fuselage(o, big), liveryMat(o, big), 0, 0, 0);
      for (const s of [-1, 1]) {
        const wg = pivot(0, 0, 0); wg.rotation.z = s * o.dih; const tip = o.wing[1];
        add(planform(o.wing.map(p => [s * p[0], p[1]]), o.wt), wingM, 0, o.wy, 0, wg);
        { const wl = add(finGeo([[0, 0], [R * 0.75, R * 1.25], [R * 1.15, R * 1.25], [R * 0.95, 0]], R * 0.07), acc, s * tip[0], o.wy, tip[1] + R * 0.05, wg); wl.rotation.z = -s * 0.12; }      // swept winglet
        M.wings = M.wings || []; M.wings.push([wg, s, o.dih]);
        surf(M.ail, s * o.ail[0], o.wy, o.ail[1], o.ail[2], o.wt * 0.28, o.ail[3], body, wg);
        surf(M.flap, s * o.flap[0], o.wy - 0.05, o.flap[1], o.flap[2], o.wt * 0.32, o.flap[3], body, wg);
        const [ex, ey, ez, er, el] = o.eng;
        add(cyl(er * 0.95, er * 1.07, el, 20), body, s * ex, ey, ez); add(cyl(er * 0.89, er * 0.89, 0.12, 20), dark, s * ex, ey, ez - el / 2 - 0.03);
        add(cyl(er * 0.41, er * 0.73, el * 0.36, 14), dark, s * ex, ey, ez + el / 2 + el * 0.14);
        if (o.rear) add(new THREE.BoxGeometry(ex - R * 0.7, 0.16, el * 0.55), body, s * (R * 0.7 + (ex - R * 0.7) / 2), ey, ez);
        else add(new THREE.BoxGeometry(0.3, 1.0, 3.6), wingM, s * ex, ey + 0.95, ez + 1.0);
        M.emit.push([s * ex, ey, ez + el / 2 + 1.5]);
        add(planform(o.hs.map(p => [s * p[0], p[1]]), o.wt * 0.52), wingM, 0, o.hsy, 0);
        surf(M.elev, s * o.elev[0], o.hsy, o.elev[1], o.elev[2], o.wt * 0.24, o.elev[3], body);
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * tip[0], o.wy + 1.55 * tip[0] * o.dih, tip[1] + 1.1, R * 0.11);
        M.strobes.push(lamp(0xffffff, s * (tip[0] + 0.1), o.wy + 1.6 * tip[0] * o.dih, tip[1] + 1.8, R * 0.18));
      }
      add(finGeo(o.fin, R * 0.18), acc, 0, 0, 0);
      M.rud = pivot(0, o.rud[0], o.rud[1]); M.rud.rotation.x = o.rud[4]; add(new THREE.BoxGeometry(R * 0.08, o.rud[2], o.rud[3]), body, 0, 0, o.rud[3] / 2, M.rud);
      M.gear = pivot(0, 0, 0); leg(0, o.gn, o.wr * 0.72, -R * 0.6, M.gear); leg(-o.gm[0], o.gm[1], o.wr, o.wy, M.gear); leg(o.gm[0], o.gm[1], o.wr, o.wy, M.gear);
      lamp(0xffffff, 0, R * 0.4, o.z1 + o.tail, R * 0.11); M.beacon = lamp(0xff3030, 0, R * 1.08, -1, R * 0.15);
      M.land = [lamp(0xfff4dc, -R * 1.2, o.wy + 0.1, o.wing[0][1] + 0.4, R * 0.42), lamp(0xfff4dc, R * 1.2, o.wy + 0.1, o.wing[0][1] + 0.4, R * 0.42), lamp(0xfff4dc, 0, -R * 0.75, o.gn, R * 0.3)];
    } else if (key === 'fighter') {
      // ---- single-engine fighter: blended delta, bubble canopy, all-moving tailplanes, afterburner ----
      const g1 = ph(0x8d98a3, 70), g2 = ph(0x6c7884, 60), g3 = ph(0x9aa5b0, 80);
      // fuselage: one lathe from the radome tip to the nozzle, wider than it is tall, with a raised spine behind the canopy
      { const pts = [], prof = [[-8.9, 0.02], [-8.2, 0.16], [-7.0, 0.34], [-5.6, 0.52], [-4.2, 0.66], [-2.6, 0.76], [0, 0.80], [2.5, 0.80], [4.6, 0.76], [6.0, 0.68], [6.7, 0.62]];
        for (const [z, r] of prof) pts.push(new THREE.Vector2(r, z)); const fg = new THREE.LatheGeometry(pts, 20); fg.rotateX(Math.PI / 2); fg.scale(1.22, 0.9, 1);
        const p = fg.attributes.position; for (let k = 0; k < p.count; k++) { const z = p.getZ(k), y = p.getY(k); if (z < -4.2) p.setY(k, y - 0.14 * Math.pow((-4.2 - z) / 4.7, 1.5)); if (y > 0 && z > -1.2 && z < 5.6) p.setY(k, y * (1 + 0.22 * Math.sin((z + 1.2) / 6.8 * Math.PI))); } fg.computeVertexNormals();
        add(fg, g1, 0, 0, 0); }
      add(new THREE.SphereGeometry(0.42, 10, 8), g2, 0, -0.12, -8.3).scale.set(1, 1, 2.2);                              // darker radome
      // chin intake: an open duct under the forward fuselage, dark inside, with a lip
      { const duct = new THREE.CylinderGeometry(0.5, 0.56, 3.4, 16, 1, true).rotateX(Math.PI / 2); add(duct, g1, 0, -0.82, -1.9).scale.set(1.25, 0.62, 1);
        add(new THREE.CylinderGeometry(0.47, 0.52, 3.3, 16, 1, true).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0c0e11, side: THREE.BackSide }), 0, -0.82, -1.9).scale.set(1.25, 0.62, 1);
        add(new THREE.TorusGeometry(0.5, 0.045, 6, 18), g3, 0, -0.82, -3.6).scale.set(1.25, 0.62, 1); add(new THREE.BoxGeometry(1.0, 0.36, 3.2), g1, 0, -0.5, 0.6); }
      // canopy: clear bubble with a bow frame, the seat and the pilot's helmet inside
      { const glass = new THREE.MeshPhongMaterial({ color: 0x2b3a48, shininess: 160, specular: 0xdcecf8, transparent: true, opacity: 0.42 }); AC.envMats.push(glass);
        add(new THREE.BoxGeometry(0.5, 0.75, 0.5), dark, 0, 0.55, -2.1); add(new THREE.SphereGeometry(0.19, 10, 8), ph(0xe8e8e2, 90), 0, 0.98, -2.45);                    // seat, helmet
        add(new THREE.SphereGeometry(0.58, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), glass, 0, 0.52, -2.7).scale.set(0.95, 1.05, 3.3);
        add(new THREE.TorusGeometry(0.55, 0.035, 6, 16, Math.PI), dark, 0, 0.52, -3.9).scale.set(0.95, 1.0, 1); }
      // nozzle: an open ring of petals that glows inside with the afterburner
      add(new THREE.CylinderGeometry(0.50, 0.66, 1.25, 16, 1, true).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x33363b, side: THREE.DoubleSide }), 0, 0, 7.3);
      M.nozzle = add(new THREE.CircleGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: 0x100806, fog: false }), 0, 0, 6.75);
      { // afterburner: an outer orange plume and a white-blue core, both with shock diamonds, drawn once on a canvas
        const fc = document.createElement('canvas'); fc.width = 32; fc.height = 256; const fx = fc.getContext('2d'), fgd = fx.createLinearGradient(0, 256, 0, 0);
        fgd.addColorStop(0, 'rgba(255,255,255,1)'); fgd.addColorStop(0.18, 'rgba(255,214,150,.85)'); fgd.addColorStop(0.55, 'rgba(255,140,50,.45)'); fgd.addColorStop(1, 'rgba(255,90,20,0)'); fx.fillStyle = fgd; fx.fillRect(0, 0, 32, 256);
        for (let d = 0; d < 5; d++) { const y = 236 - d * 34, rg = fx.createRadialGradient(16, y, 0, 16, y, 15); rg.addColorStop(0, 'rgba(255,255,255,' + (0.85 - d * 0.14) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = rg; fx.fillRect(0, y - 15, 32, 30); }
        const ft = new THREE.CanvasTexture(fc), bm = c => new THREE.MeshBasicMaterial({ map: ft, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false });
        M.burner = new THREE.Group(); M.burner.position.set(0, 0, 9.4); M.g.add(M.burner);
        M.burner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.52, 5.5, 14, 1, true).rotateX(Math.PI / 2), bm(0xffa050))); M.burner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.30, 4.2, 10, 1, true).rotateX(Math.PI / 2), bm(0xcfe2ff))).position.z = -0.6; }
      for (const s of [-1, 1]) {
        add(planform([[s * 0.7, -1.3], [s * 4.75, 2.7], [s * 4.75, 3.6], [s * 0.7, 4.0]], 0.16), g1, 0, -0.05, 0);
        add(planform([[s * 0.7, -5.2], [s * 1.55, -1.0], [s * 0.7, -1.0]], 0.12), g2, 0, -0.05, 0);                 // leading-edge strake, running forward to the cockpit
        surf(M.ail, s * 2.7, -0.05, 3.75, 3.4, 0.07, 0.55, g2);
        add(cyl(0.07, 0.07, 2.6, 8), dark, s * 4.8, -0.05, 2.7);                                                    // wingtip rail
        add(cyl(0.085, 0.085, 2.3, 8), ph(0xe9ebee, 60), s * 4.8, -0.2, 2.6); add(cyl(0.01, 0.085, 0.45, 8), ph(0xe9ebee, 60), s * 4.8, -0.2, 1.25);      // a missile on the rail
        for (const f of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.3, 0.28), g2, s * 4.8 + f * 0.0, -0.2 + f * 0.2, 3.6);
        add(finGeo([[4.6, -0.55], [5.9, -1.25], [6.5, -1.25], [6.3, -0.55]], 0.06), g2, s * 0.62, 0, 0).rotation.z = -s * 0.28;                              // ventral fin
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 4.8, 0.05, 3.8, 0.09); M.emit.push([s * 4.8, -0.05, 4.0]);
      }
      add(cyl(0.015, 0.02, 1.1, 6), dark, 0, -0.16, -9.3);                                                           // pitot
      const tp = pivot(0, -0.05, 6.3); M.elev.push(tp);
      for (const s of [-1, 1]) add(planform([[s * 0.6, -1.1], [s * 2.9, 0.3], [s * 2.9, 1.0], [s * 0.6, 0.8]], 0.1), g2, 0, 0, 0, tp);
      add(finGeo([[3.3, 0.6], [6.2, 3.7], [7.1, 3.7], [6.9, 0.6]], 0.12), g2, 0, 0, 0);
      M.rud = pivot(0, 2.1, 6.95); add(new THREE.BoxGeometry(0.07, 2.5, 0.5), g1, 0, 0, 0.25, M.rud);
      M.gear = pivot(0, 0, 0); leg(0, -3.3, 0.2, -0.6, M.gear); leg(-0.95, 1.6, 0.28, -0.3, M.gear); leg(0.95, 1.6, 0.28, -0.3, M.gear);
      M.beacon = lamp(0xff3030, 0, 3.8, 6.6, 0.1); M.strobes.push(lamp(0xffffff, 0, -0.75, 2, 0.12));
    } else {
      // ---- aerobatic monoplane: propeller, fixed gear, big control surfaces ----
      const red = ph(0xd3302b, 80), wht = ph(0xf5f2ea, 70);
      add(cyl(0.5, 0.5, 2.8, 16), red, 0, 0, -0.8); add(cyl(0.13, 0.5, 3.7, 16), wht, 0, 0.04, 2.45);
      add(cyl(0.5, 0.36, 0.7, 16), wht, 0, 0, -2.55); add(cyl(0.2, 0.03, 0.5, 12), dark, 0, 0, -3.15);          // cowling + spinner
      M.prop = pivot(0, 0, -3.0); add(new THREE.BoxGeometry(0.14, 2.1, 0.04), dark, 0, 0, 0, M.prop);
      add(cyl(1.05, 1.05, 0.02, 24), new THREE.MeshBasicMaterial({ color: 0x9aa4ad, transparent: true, opacity: 0.16, depthWrite: false }), 0, 0, 0, M.prop);
      add(new THREE.SphereGeometry(0.42, 14, 10), canopy, 0, 0.36, -0.2).scale.set(1, 1, 2.9);
      for (const s of [-1, 1]) {
        add(planform([[s * 0.4, -1.45], [s * 4, -0.85], [s * 4, 0.05], [s * 0.4, 0.5]], 0.14), s < 0 ? red : wht, 0, -0.3, 0);
        surf(M.ail, s * 2.4, -0.3, 0.2, 2.9, 0.06, 0.42, s < 0 ? wht : red);
        add(planform([[s * 0.1, 3.3], [s * 1.5, 3.5], [s * 1.5, 3.95], [s * 0.1, 4.0]], 0.07), red, 0, 0.15, 0);
        add(new THREE.BoxGeometry(0.07, 0.75, 0.3), dark, s * 0.62, -0.62, -1.2).rotation.z = s * 0.75;             // spring gear leg
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 14).rotateZ(Math.PI / 2), tyre, s * 0.92, -0.85, -1.2);
        add(new THREE.SphereGeometry(0.24, 10, 8), red, s * 0.92, -0.8, -1.2).scale.set(0.5, 0.8, 1.6);              // wheel pant
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 4.0, -0.28, -0.3, 0.07);
      }
      surf(M.elev, 0, 0.15, 3.98, 2.9, 0.05, 0.4, wht);
      add(finGeo([[3.1, 0.2], [3.85, 1.5], [4.3, 1.5], [4.25, 0.2]], 0.07), red, 0, 0, 0);
      M.rud = pivot(0, 0.85, 4.28); add(new THREE.BoxGeometry(0.06, 1.3, 0.45), wht, 0, 0, 0.22, M.rud);
      M.emit.push([0, -0.35, 1.0]);
    }
    M.g.visible = false; AC.root.add(M.g); AC.models[key] = M;
  }
  // ---- flight deck (shown only in cockpit view; framing is hidden under bubble canopies) ----
  const trim = lam(0x4a5058), dk = lam(0x23272c);           // lighter than black, so the panel reads as a panel; and set low, so the world fills most of the view
  const cab2 = () => lam(0x2b3036);
  const dadd = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || AC.deck).add(m); return m; };
  dadd(new THREE.BoxGeometry(3.4, 0.08, 0.9), dk, 0, 0.62, -16.3).rotation.x = 0.08;                   // glare shield
  dadd(new THREE.PlaneGeometry(3.3, 0.72), trim, 0, 0.25, -16.45).rotation.x = -0.2;                  // main panel
  AC.pfdTex = new THREE.CanvasTexture(document.getElementById('pfd')); AC.mapTex = new THREE.CanvasTexture(document.getElementById('map'));
  const scr = (w, h, x, tex) => { dadd(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }), x, 0.25, -16.43).rotation.x = -0.2; };
  scr(0.7, 0.48, -0.62, AC.pfdTex); scr(0.29, 0.53, 0.02, AC.mapTex); scr(0.7, 0.48, 0.66, AC.pfdTex);
  dadd(new THREE.BoxGeometry(1.0, 0.5, 1.2), trim, 0, -0.17, -15.9);                                   // pedestal
  for (const s of [-1, 1]) { dadd(new THREE.BoxGeometry(0.05, 1.7, 0.05), trim, s * 1.38, 1.42, -16.6, AC.frame).rotation.z = -s * 0.1; dadd(new THREE.BoxGeometry(0.08, 0.5, 3), trim, s * 1.72, 0.3, -15.4, AC.frame); dadd(new THREE.BoxGeometry(0.07, 2.2, 0.09), trim, s * 1.72, 1.4, -15.3, AC.frame); }       // slim posts, a low sill and open side windows
  dadd(new THREE.BoxGeometry(3.6, 0.16, 1.0), trim, 0, 2.2, -16.2, AC.frame);
  AC.stick = new THREE.Group(); AC.stick.position.set(-1.0, 0.23, -15.75); AC.deck.add(AC.stick);
  dadd(new THREE.CylinderGeometry(0.025, 0.035, 0.26, 8), dk, 0, 0.13, 0, AC.stick); dadd(new THREE.SphereGeometry(0.045, 8, 6), dk, 0, 0.27, 0, AC.stick);
  AC.thr = new THREE.Group(); AC.thr.position.set(0, 0.08, -15.75); AC.deck.add(AC.thr); dadd(new THREE.BoxGeometry(0.22, 0.2, 0.06), dk, 0, 0.12, 0, AC.thr);
  // a room, not a floating panel: floor, side consoles, an overhead panel, two seats and the back wall (seen when looking round)
  { const cab = lam(0x2b3036), seat = lam(0x3b4654);
    dadd(new THREE.BoxGeometry(3.6, 0.06, 4.2), cab, 0, -0.42, -14.6, AC.frame); dadd(new THREE.BoxGeometry(3.6, 2.7, 0.08), cab, 0, 0.9, -12.6, AC.frame);                 // floor, back wall
    for (const sd of [-1, 1]) { dadd(new THREE.BoxGeometry(0.5, 0.5, 3.2), trim, sd * 1.5, -0.1, -15.2, AC.frame);                                                          // side consoles
      dadd(new THREE.BoxGeometry(0.52, 1.25, 0.14), seat, sd * 0.62, 0.42, -14.25, AC.frame).rotation.x = -0.12; dadd(new THREE.BoxGeometry(0.52, 0.12, 0.5), seat, sd * 0.62, -0.08, -14.5, AC.frame);   // seats
      dadd(new THREE.BoxGeometry(0.3, 0.2, 0.2), seat, sd * 0.62, 1.12, -14.2, AC.frame); }
    dadd(new THREE.BoxGeometry(1.5, 0.1, 1.3), trim, 0, 2.12, -15.5, AC.frame).rotation.x = 0.1; dadd(new THREE.BoxGeometry(3.6, 0.08, 4.2), cab, 0, 2.3, -14.6, AC.frame);     // overhead panel, ceiling
    dadd(new THREE.BoxGeometry(0.05, 1.7, 0.05), trim, 0, 1.42, -16.62, AC.frame); }                                                                                        // centre post of the windshield
  // bubble canopies (fighter, aerobatic plane): the canopy bow, the side rails and the nose ahead
  AC.bub = new THREE.Group(); AC.deck.add(AC.bub);
  { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 6, 20, Math.PI), trim); bow.position.set(0, 0.62, -16.25); AC.bub.add(bow);
    for (const sd of [-1, 1]) dadd(new THREE.BoxGeometry(0.06, 0.06, 2.6), trim, sd * 0.78, 0.62, -15.1, AC.bub);
    dadd(new THREE.CylinderGeometry(0.1, 0.62, 4.2, 14).rotateX(-Math.PI / 2), lam(0x7d8894), 0, 0.2, -18.9, AC.bub); dadd(new THREE.BoxGeometry(1.5, 0.5, 1.6), cab2(), 0, -0.05, -15.2, AC.bub); }
  AC.deck.add(AC.frame); AC.root.add(AC.deck); AC.deck.visible = false; scene.add(AC.root);
}
/** Switch aircraft: load its flight model numbers and show its 3D model. */
function selectPlane(key) {
  PL = PLANES[key] || PLANES.airliner; AC.m = AC.models[PL.key];
  MASS = PL.mass; SW = PL.S; CL0 = PL.cl0; CLA = PL.cla; CD0 = PL.cd0; KIND = PL.k; TMAX = PL.T; ASTALL = PL.ast; GEAR_H = PL.gearH; FLAPS = PL.flaps;
  for (const k of PLANE_ORDER) AC.models[k].g.visible = false;
  AC.deck.position.set(PL.eye[0], PL.eye[1] - 1.16, PL.eye[2] + 15); AC.frame.visible = !PL.bubble; if (AC.bub) AC.bub.visible = !!PL.bubble;
  SAVE.plane = PL.key; persist();
}
const fi = n => Math.min(n, FLAPS.length - 1);          // flap notch that exists on this aircraft
