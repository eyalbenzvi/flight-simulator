'use strict';
// ---------- 9. Aircraft: specs, models, flight deck ----------
// roll/pitch are peak rates in rad/s; bank/up/dn are the Easy-mode limits in degrees; vc is a comfortable cruise in m/s.
// Performance checked against real types (see CLAUDE.md, "Flight model"): stall speeds, maximum speed (vmo is an indicated airspeed limit, m/s),
// climb, ceiling, load-factor limit nmax, roll rates. mcr: drag-rise Mach; sonic: supersonic (a transonic drag hump instead of a wall).
const PLANES = {
  airliner: { name: 'Airliner', tag: 'Twin-jet for 150 passengers. Steady and forgiving, slow to turn', mass: 65000, S: 125, T: 240000, cl0: 0.25, cla: 5, cd0: 0.028, k: 0.039, ast: 0.262, roll: 0.42, pitch: 0.2, gearH: 3.55, flaps: [0, 10, 20, 30], lapse: 0.0022, vmo: 180, mcr: 0.78, nmax: 2.5, spool: 0.25, bank: 50, up: 14, dn: 10, rot: 8, vc: 120, pace: 150, chase: [64, 21, 13], eye: [0, 1.16, -15], wingEye: [2.3, 1.25, -10.5], wingTgt: [13, -2.6, 2.5] },
  bizjet: { name: 'Business jet', tag: 'Sleek T-tail jet. Quick, agile, lands short', mass: 16000, S: 55, T: 64000, cl0: 0.25, cla: 5, cd0: 0.024, k: 0.05, ast: 0.262, roll: 0.8, pitch: 0.3, gearH: 1.75, flaps: [0, 10, 20, 30], lapse: 0.002, vmo: 170, mcr: 0.8, nmax: 3, spool: 0.3, bank: 60, up: 18, dn: 12, rot: 9, vc: 130, pace: 170, chase: [34, 10.5, 6.5], eye: [0, 0.5, -6.4], wingEye: [1.25, 0.55, -4.2], wingTgt: [7, -1.3, 2.5] },
  fighter: { name: 'Fighter jet', tag: 'Afterburner, Mach 1.5, rolls and loops. Hold on', mass: 12000, S: 28, T: 130000, cl0: 0.1, cla: 4.2, cd0: 0.02, k: 0.12, ast: 0.42, roll: 4.4, pitch: 0.95, gearH: 1.7, flaps: [0, 20], lapse: 0.00025, vmo: 410, mcr: 0.92, sonic: true, nmax: 9, spool: 0.5, bank: 76, up: 45, dn: 30, rot: 13, vc: 190, pace: 330, tricks: true, bubble: true, chase: [27, 7.5, 4.5], eye: [0, 0.98, -2.9], wingEye: [4.2, 2.4, 8.5], wingTgt: [-0.8, -0.2, -6] },
  stunt: { name: 'Aerobatic plane', tag: 'Light propeller plane with show smoke. Slow, nimble, lands anywhere', mass: 950, S: 10.7, T: 4800, cl0: 0.2, cla: 5, cd0: 0.03, k: 0.07, ast: 0.28, roll: 5.8, pitch: 1.2, gearH: 1.05, flaps: [0], lapse: 0.0062, vmo: 113, mcr: 0.6, nmax: 10, spool: 0.9, rhoExp: 1.7, bank: 78, up: 25, dn: 20, rot: 11, vc: 65, pace: 82, tricks: true, bubble: true, fixedGear: true, prop: true, chase: [14, 4.2, 2.6], eye: [0, 0.78, -0.25], wingEye: [1.7, 0.95, 2.7], wingTgt: [-0.3, 0.1, -4] },
  // Concorde (155 t in flight, 358 m2, four engines with reheat): no flaps, lands nose-high at about 165 kt, Mach 2 at 18 km. wave: its supersonic drag is low; mmo: Mach limit;
  // lapse below zero and rhoExp 0.55: intakes that recover more thrust the faster and higher it flies
  concorde: { name: 'Concorde', tag: 'Supersonic airliner. Mach 2 at the edge of space, lands fast with its nose high', mass: 155000, S: 358, T: 676000, cl0: 0.05, cla: 3.3, cd0: 0.0083, k: 0.3, ast: 0.42, roll: 0.55, pitch: 0.22, gearH: 4.45, flaps: [0], lapse: -0.0002, rhoExp: 0.55, vmo: 240, mcr: 0.93, sonic: true, wave: 0.012, mmo: 2.04, nmax: 2.5, spool: 0.3, bank: 45, up: 16, dn: 10, rot: 13, vc: 150, climbV: 205, pace: 300, chase: [96, 24, 16], eye: [0, 0.75, -26.2], wingEye: [1.5, 0.6, -6], wingTgt: [11, -2.4, 14], sound: 1.5 },
  // the stealth attack jet (F-117: 20 t, 73 m2, two engines without afterburner): subsonic, Mach 0.9, no flaps, 67 degrees of sweep, lands at about 150 kt
  stealth: { name: 'Stealth jet', tag: 'Black, faceted, invisible to radar. Fast and low, no afterburner', mass: 20000, S: 73, T: 96000, cl0: 0.05, cla: 3.3, cd0: 0.018, k: 0.17, ast: 0.37, roll: 2.2, pitch: 0.6, gearH: 2.15, flaps: [0], lapse: 0.0012, vmo: 290, mcr: 0.86, nmax: 6, spool: 0.4, bank: 70, up: 30, dn: 22, rot: 11, vc: 180, pace: 290, tricks: true, bubble: true, chase: [36, 9, 6], eye: [0, 1.12, -4.2], wingEye: [3.6, 1.9, 9.5], wingTgt: [-0.6, -0.2, -6], sound: 1.2 },
  // the heavy bomber (B-52H: 180 t in flight, 370 m2, eight engines): slow to roll, takes off and lands almost level, 2 g
  bomber: { name: 'Heavy bomber', tag: 'Eight engines and enormous wings. Slow to turn, flies for ever', mass: 180000, S: 370, T: 608000, cl0: 0.3, cla: 5.2, cd0: 0.016, k: 0.045, ast: 0.24, roll: 0.3, pitch: 0.16, gearH: 3.15, flaps: [0, 20, 35], lapse: 0.002, vmo: 200, mcr: 0.82, nmax: 2, spool: 0.2, bank: 40, up: 12, dn: 9, rot: 5, vc: 125, pace: 150, chase: [90, 24, 16], eye: [0, 1.45, -20.4], wingEye: [2.2, 1.0, -9], wingTgt: [20, -1.5, 6], sound: 1.4 }
};
const PLANE_ORDER = ['airliner', 'bizjet', 'fighter', 'stunt', 'concorde', 'stealth', 'bomber'];
for (const k in PLANES) { const p = PLANES[k]; p.key = k; p.vs = Math.sqrt(2 * p.mass * G / (1.225 * p.S * (p.cl0 + p.cla * p.ast))); }
let PL = PLANES.airliner;
const AC = { root: new THREE.Group(), deck: new THREE.Group(), frame: new THREE.Group(), models: {}, m: null, livery: [], envMats: [], glow: [] };
/**
 * A lifting surface with a real section. The outline is a polygon of [span, chord] points (as the flat plank it replaces took it); at each station along
 * the span the outline gives the leading and trailing edge, and between them stands an aerofoil (the NACA four-digit thickness curve, a little camber
 * for wings), thick where the chord is long and thinning toward the tip. So a wing has a rounded nose, a fine trailing edge and a root deeper than its
 * tip, in every aircraft at once. Returns the surface in (span, thickness, chord); null if the outline has no span.
 */
function airfoilLoft(pts, t, camber) {
  const n = pts.length, lo = Math.min(...pts.map(p => p[0])), hi = Math.max(...pts.map(p => p[0])); if (!(hi - lo > 1e-3)) return null;
  const cut = a => { let c0 = 1e9, c1 = -1e9; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], a0 = p[0], a1 = q[0]; if (a < Math.min(a0, a1) - 1e-7 || a > Math.max(a0, a1) + 1e-7) continue;
      if (Math.abs(a1 - a0) < 1e-7) { c0 = Math.min(c0, p[1], q[1]); c1 = Math.max(c1, p[1], q[1]); continue; } const c = p[1] + (q[1] - p[1]) * (a - a0) / (a1 - a0); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } return [c0, c1]; };
  const st = [...new Set([...pts.map(p => +p[0].toFixed(4)), ...Array.from({ length: 9 }, (_, k) => +(lo + (hi - lo) * k / 8).toFixed(4))])].sort((a, b) => a - b).map(a => [a, cut(a)]).filter(e => e[1][1] >= e[1][0]);
  if (st.length < 2) return null; const maxC = Math.max(...st.map(e => e[1][1] - e[1][0])) || 1, K = 8, R = 2 * K, P = [], I = [];
  const th = u => 5 * (0.2969 * Math.sqrt(u) - 0.1260 * u - 0.3516 * u * u + 0.2843 * u * u * u - 0.1036 * u * u * u * u);
  for (const [a, [c0, c1]] of st) { const ch = Math.max(c1 - c0, 0.02), T = t * 1.55 * (0.34 + 0.66 * ch / maxC);
    for (let r = 0; r < R; r++) { const up = r <= K, k = up ? r : R - r, u = (1 - Math.cos(Math.PI * k / K)) / 2; P.push(a, t * 0.25 + (up ? 1 : -1) * T * th(u) + (camber || 0) * T * 2 * u * (1 - u), c0 + ch * u); } }
  for (let s = 0; s < st.length - 1; s++) for (let r = 0; r < R; r++) { const a = s * R + r, b = s * R + (r + 1) % R, c = a + R, d = b + R; I.push(a, c, b, b, c, d); }
  for (const [s, f] of [[0, 1], [st.length - 1, 0]]) for (let r = 1; r < R - 1; r++) { const o = s * R; if (f) I.push(o, o + r, o + r + 1); else I.push(o, o + r + 1, o + r); }
  let vol = 0; for (let k = 0; k < I.length; k += 3) { const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3; vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); }
  if (vol < 0) for (let k = 0; k < I.length; k += 3) { const q = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = q; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); const uv = []; for (let k = 0; k < P.length; k += 3) uv.push(P[k], P[k + 2]);          /* as the plank had them: the outline's own coordinates, which the painted wings count on */ g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
}
/** Metal skin, painted once per seed: plates in slightly different tones, the lines between them, rows of rivets, streaks along the airflow. Near
    white, so the material's own colour tints it; it repeats (`skinUV` lays it out in metres, seen from above). */
const SKIN = {};
function skinTex(seed, k) {
  if (SKIN[seed]) return SKIN[seed]; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = rng(seed * 77 + 5); k = k || 1;
  x.fillStyle = '#e9e9e9'; x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256;) { const h = (28 + R() * 30) | 0; for (let px = 0; px < 256;) { const w = (36 + R() * 56) | 0, v = (233 + (R() - 0.5) * 24 * k) | 0; x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; x.fillRect(px, y, w, h); x.strokeStyle = 'rgba(40,44,50,' + 0.30 * k + ')'; x.lineWidth = 1; x.strokeRect(px + 0.5, y + 0.5, w, h); px += w; } y += h; }
  x.fillStyle = 'rgba(30,34,40,' + 0.16 * k + ')'; for (let i = 0; i < 256; i += 8) for (let j = 6; j < 256; j += 64) x.fillRect(i, j, 1, 1);
  for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(60,60,60,' + 0.035 * k + ')'; x.fillRect(R() * 256, R() * 256, 2 + R() * 3, 30 + R() * 90); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return SKIN[seed] = t;
}
function skinUV(geo, size, oz) { const P = geo.attributes.position, uv = new Float32Array(P.count * 2); for (let k = 0; k < P.count; k++) { uv[k * 2] = P.getX(k) / size; uv[k * 2 + 1] = (P.getZ(k) + (oz || 0)) / size; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo; }
function tileUV(geo, ru, rv) { const U = geo.attributes.uv; for (let k = 0; k < U.count; k++) U.setXY(k, U.getX(k) * ru, U.getY(k) * rv); return geo; }
function plankGeo(pts, t) {   // the old flat plank: kept for an outline the aerofoil cannot take
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const b = Math.min(t * 0.42, 0.14), g = new THREE.ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * 1.6, bevelOffset: -b * 1.6, bevelSegments: 2 }); g.rotateX(Math.PI / 2); g.translate(0, t / 2 - b, 0); return g;
}
function planform(pts, t) {   // a wing, tailplane, strake or pylon from its (x, z) outline
  return airfoilLoft(pts, t, 0.12) || plankGeo(pts, t);
}
function finGeo(pts, t) {     // a fin from its (z, y) outline: the same aerofoil, standing up, no camber
  const g = airfoilLoft(pts.map(p => [p[1], p[0]]), t * 0.8, 0); if (g) { g.translate(0, -t * 0.2, 0); g.rotateZ(Math.PI / 2); return g; }
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const g2 = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g2.rotateY(-Math.PI / 2); g2.translate(t / 2, 0, 0); return g2;
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
  x.fillStyle = 'rgba(50,60,72,.10)'; for (let z = zN + 1; z < zT; z += big ? 1.3 : 0.9) x.fillRect(0, Y(z), W, 1); for (const u of [0.06, 0.19, 0.37, 0.63, 0.81, 0.94]) x.fillRect(U(u), Y(o.z1 + o.tail * 0.5), 1, Y(o.z0 - R) - Y(o.z1 + o.tail * 0.5));          // the skin's ring and plate joints, faint
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
  x.fillStyle = '#8f979f'; x.fillRect(0, Y(zN + R * 0.18), W, H);                                         // radome tip
  const map = new THREE.CanvasTexture(c1), em = new THREE.CanvasTexture(c2); map.anisotropy = em.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.MeshPhongMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, shininess: 70 }); AC.livery.push(m); AC.envMats.push(m); return m;
}
/** The front of a turbofan as a texture: twenty-two dark blades with lighter edges round a hub. */
let FAN_MAT = null;
function fanMat() { if (FAN_MAT) return FAN_MAT; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#0f1215'; x.fillRect(0, 0, 128, 128); x.translate(64, 64);
  for (let i = 0; i < 22; i++) { x.rotate(Math.PI * 2 / 22); x.fillStyle = '#2b3138'; x.beginPath(); x.moveTo(4, -14); x.quadraticCurveTo(22, -40, 9, -63); x.lineTo(-3, -63); x.quadraticCurveTo(10, -40, -3, -14); x.fill(); x.strokeStyle = 'rgba(190,200,210,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(4, -14); x.quadraticCurveTo(22, -40, 9, -63); x.stroke(); }
  x.fillStyle = '#c9ced4'; x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
  return FAN_MAT = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }); }
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
    // a gear leg: an outer strut with a chrome oleo below it, a torque link, an axle and two wheels with light hubs; the wheels turn on the ground
    const chrome = ph(0xd9dde2, 140), hub = ph(0xbfc5cb, 60);
    const leg = (x, z, r, top, parent, door) => { const bot = -sp.gearH, l = top - bot - r, t = 0.045 + r * 0.17;
      add(new THREE.CylinderGeometry(t, t * 1.1, l * 0.6, 10), ph(0xe6e9ec, 50), x, bot + r + l * 0.7, z, parent); add(new THREE.CylinderGeometry(t * 0.62, t * 0.62, l * 0.45, 10), chrome, x, bot + r + l * 0.2, z, parent);
      add(new THREE.BoxGeometry(t * 0.5, l * 0.3, t * 2.2), dark, x, bot + r + l * 0.3, z + t * 1.4, parent).rotation.x = 0.5;                                // torque link
      add(new THREE.CylinderGeometry(t * 0.5, t * 0.5, r * 1.5, 8).rotateZ(Math.PI / 2), dark, x, bot + r, z, parent);                                      // axle
      for (const s of [-1, 1]) { const wh = pivot(x + s * r * 0.56, bot + r, z, parent); (M.wheels = M.wheels || []).push([wh, r]);
        add(new THREE.CylinderGeometry(r, r, r * 0.5, 18).rotateZ(Math.PI / 2), tyre, 0, 0, 0, wh); add(new THREE.CylinderGeometry(r * 0.55, r * 0.55, r * 0.54, 10).rotateZ(Math.PI / 2), hub, 0, 0, 0, wh);
        add(new THREE.BoxGeometry(r * 0.56, r * 0.2, r * 0.2), dark, 0, 0, 0, wh); }
      if (door) add(new THREE.BoxGeometry(0.04, l * 0.55, r * 2.4), door, x + Math.sign(x || 1) * (r * 0.95 + 0.12), bot + r + l * 0.72, z, parent).rotation.z = Math.sign(x || 1) * 0.12; };

    // a turbofan: a lathe nacelle with a rounded, polished lip, a fan that turns with the engine, a dark duct, and a core nozzle with its plug
    const engine = (x, y, z, r, l) => { const prof = [[r * 0.86, -l * 0.5], [r * 1.0, -l * 0.44], [r * 1.07, -l * 0.25], [r * 1.08, 0], [r * 1.0, l * 0.3], [r * 0.82, l * 0.5]].map(p => new THREE.Vector2(p[0], p[1]));
      const ng = new THREE.LatheGeometry(prof, 22); ng.rotateX(Math.PI / 2); add(ng, ph(sp.key === 'airliner' ? 0xf2f4f6 : 0xf4f1ea, 70), x, y, z);
      add(new THREE.TorusGeometry(r * 0.9, r * 0.075, 8, 24), chrome, x, y, z - l * 0.5 + 0.02);                                                           // intake lip
      add(new THREE.CylinderGeometry(r * 0.86, r * 0.86, l * 0.5, 20, 1, true).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14171b, side: THREE.BackSide }), x, y, z - l * 0.24);   // inlet duct
      const fan = pivot(x, y, z - l * 0.36); add(new THREE.CircleGeometry(r * 0.86, 24), fanMat(), 0, 0, 0, fan).rotation.y = Math.PI; add(new THREE.ConeGeometry(r * 0.24, r * 0.5, 12).rotateX(-Math.PI / 2), ph(0xe9ecef, 90), 0, 0, -r * 0.2, fan); (M.fans = M.fans || []).push(fan);
      add(cyl(r * 0.5, r * 0.78, l * 0.3, 16), ph(0x8b9199, 110), x, y, z + l * 0.6); add(cyl(r * 0.08, r * 0.42, l * 0.34, 12), ph(0x5c6168, 90), x, y, z + l * 0.78); };
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
      const body = ph(o.col, 60), wingM = ph(o.wcol, 40), acc = ph(o.acc, 50), R = o.R, len = o.z1 - o.z0, zc = (o.z0 + o.z1) / 2, wsz = big ? 7 : 4; wingM.map = skinTex(1, 0.9);
      // the wing-to-body fairing: the belly swells where the wing passes under the cabin
      add(new THREE.SphereGeometry(1, 18, 12), ph(big ? 0xaab1b8 : o.col, 50), 0, o.wy - R * 0.1, (o.wing[0][1] + o.wing[4][1]) / 2).scale.set(R * 1.06, R * 0.36, (o.wing[4][1] - o.wing[0][1]) * 0.62);
      add(fuselage(o, big), liveryMat(o, big), 0, 0, 0);
      for (const s of [-1, 1]) {
        const wg = pivot(0, 0, 0); wg.rotation.z = s * o.dih; const tip = o.wing[1];
        add(skinUV(planform(o.wing.map(p => [s * p[0], p[1]]), o.wt), wsz), wingM, 0, o.wy, 0, wg);
        { const wl = add(finGeo([[0, 0], [R * 0.75, R * 1.25], [R * 1.15, R * 1.25], [R * 0.95, 0]], R * 0.07), acc, s * tip[0], o.wy, tip[1] + R * 0.05, wg); wl.rotation.z = -s * 0.12; }      // swept winglet
        M.wings = M.wings || []; M.wings.push([wg, s, o.dih]);
        surf(M.ail, s * o.ail[0], o.wy, o.ail[1], o.ail[2], o.wt * 0.28, o.ail[3], body, wg);
        surf(M.flap, s * o.flap[0], o.wy - 0.05, o.flap[1], o.flap[2], o.wt * 0.32, o.flap[3], body, wg);
        const [ex, ey, ez, er, el] = o.eng;
        engine(s * ex, ey, ez, er, el);
        if (o.rear) add(planform([[0, -el * 0.3], [s * (ex - R * 0.75), -el * 0.22], [s * (ex - R * 0.75), el * 0.22], [0, el * 0.3]], 0.2), body, s * R * 0.75, ey, ez);          // stub pylon
        else { add(finGeo([[ez - el * 0.25, ey + er * 0.75], [ez + el * 0.1, o.wy - 0.1], [ez + el * 0.85, o.wy - 0.1], [ez + el * 0.55, ey + er * 0.8]], 0.26), body, s * ex, 0, 0);                         // pylon, swept back to the wing
          for (const fx of [0.36, 0.62, 0.84]) add(new THREE.SphereGeometry(0.2, 8, 6), body, s * tip[0] * fx, o.wy - 0.28 + 1.0 * tip[0] * fx * o.dih, lerp(o.wing[4][1], o.wing[2][1], fx) - 0.5, wg).scale.set(0.9, 0.9, 5.2);   // flap-track fairings
          M.spoil = M.spoil || []; const sp2 = pivot(s * tip[0] * 0.5, o.wy + o.wt * 0.5 + 0.02, lerp(o.wing[4][1], o.wing[2][1], 0.5) - 1.7, wg); add(new THREE.BoxGeometry(tip[0] * 0.34, 0.04, 0.8), wingM, 0, 0, 0.4, sp2); M.spoil.push(sp2); }
        M.emit.push([s * ex, ey, ez + el / 2 + 1.5]);
        add(skinUV(planform(o.hs.map(p => [s * p[0], p[1]]), o.wt * 0.52), wsz), wingM, 0, o.hsy, 0);
        surf(M.elev, s * o.elev[0], o.hsy, o.elev[1], o.elev[2], o.wt * 0.24, o.elev[3], body);
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * tip[0], o.wy + 1.55 * tip[0] * o.dih, tip[1] + 1.1, R * 0.11);
        M.strobes.push(lamp(0xffffff, s * (tip[0] + 0.1), o.wy + 1.6 * tip[0] * o.dih, tip[1] + 1.8, R * 0.18));
      }
      add(finGeo(o.fin, R * 0.18), acc, 0, 0, 0);
      M.rud = pivot(0, o.rud[0], o.rud[1]); M.rud.rotation.x = o.rud[4]; add(new THREE.BoxGeometry(R * 0.08, o.rud[2], o.rud[3]), body, 0, 0, o.rud[3] / 2, M.rud);
      M.gear = pivot(0, 0, 0); leg(0, o.gn, o.wr * 0.72, -R * 0.6, M.gear, body); leg(-o.gm[0], o.gm[1], o.wr, o.wy, M.gear, body); leg(o.gm[0], o.gm[1], o.wr, o.wy, M.gear, body);
      // small things that make it an aircraft: the belly fairing, antennas, pitot probes, the tail-cone exhaust, a stripe on the fin
      add(new THREE.SphereGeometry(1, 14, 10), body, 0, -R * 0.82, (o.wing[0][1] + o.wing[4][1]) / 2).scale.set(R * 0.92, R * 0.36, (o.wing[4][1] - o.wing[0][1]) * 0.72);
      add(finGeo([[-2.2, R * 0.98], [-1.5, R * 1.3], [-1.2, R * 1.3], [-1.3, R * 0.98]], 0.05), body, 0, 0, 0); add(finGeo([[3, -R * 0.98], [3.3, -R * 1.25], [3.6, -R * 1.25], [3.7, -R * 0.98]], 0.05), body, 0, 0, 0);
      for (const sg of [-1, 1]) add(cyl(0.02, 0.03, 0.5, 6), chrome, sg * R * 0.78, -R * 0.3, o.z0 - R * 0.9);
      add(new THREE.CircleGeometry(R * 0.2, 10), new THREE.MeshBasicMaterial({ color: 0x1a1c1f }), 0, R * 0.62, o.z1 + o.tail + 0.02);
      add(finGeo([[o.fin[1][0] - (o.fin[1][0] - o.fin[0][0]) * 0.5, o.fin[1][1] * 0.52], [o.fin[1][0] + 0.2, o.fin[1][1] * 0.86], [o.fin[2][0] - 0.1, o.fin[1][1] * 0.86], [o.fin[3][0] + (o.fin[2][0] - o.fin[3][0]) * 0.45, o.fin[1][1] * 0.52]], R * 0.19), ph(big ? 0xe9c877 : 0xc9a44a, 70), 0, 0, 0);
      lamp(0xffffff, 0, R * 0.4, o.z1 + o.tail, R * 0.11); M.beacon = lamp(0xff3030, 0, R * 1.08, -1, R * 0.15);
      M.land = [lamp(0xfff4dc, -R * 1.2, o.wy + 0.1, o.wing[0][1] + 0.4, R * 0.42), lamp(0xfff4dc, R * 1.2, o.wy + 0.1, o.wing[0][1] + 0.4, R * 0.42), lamp(0xfff4dc, 0, -R * 0.75, o.gn, R * 0.3)];
    } else if (key === 'fighter') {
      // ---- single-engine fighter: blended delta, bubble canopy, all-moving tailplanes, afterburner ----
      const g1 = ph(0x8d98a3, 70), g2 = ph(0x6c7884, 60), g3 = ph(0x9aa5b0, 80);
      // paint: the three-colour desert scheme, sand with brown and pale green patches, drawn once seen from above and laid over the fuselage, the wings
      // and the tailplanes alike (`topUV`), so the patches run across the joins as on the real aircraft; fine panel lines over it
      const camo = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), R = rng(7); x.fillStyle = '#b5a37e'; x.fillRect(0, 0, 512, 512);
        for (const [colr, nn] of [['#806c52', 15], ['#8c9579', 13]]) { x.fillStyle = colr; for (let i = 0; i < nn; i++) { const cx = R() * 512, cy = R() * 512; x.beginPath(); for (let a = 0; a < 6.3; a += 0.45) { const r = 34 + R() * 44; x.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r); } x.closePath(); x.fill(); } }
        x.strokeStyle = 'rgba(30,30,30,.22)'; x.lineWidth = 1; for (let i = 0; i < 512; i += 37) { x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(512, i + 0.5); x.stroke(); } for (let i = 0; i < 512; i += 93) { x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, 512); x.stroke(); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
      const gC = new THREE.MeshPhongMaterial({ map: camo, shininess: 38 }); AC.envMats.push(gC);
      const topUV = (geo, oz) => { const P = geo.attributes.position, uv = new Float32Array(P.count * 2); for (let k = 0; k < P.count; k++) { uv[k * 2] = P.getX(k) / 22 + 0.5; uv[k * 2 + 1] = (P.getZ(k) + (oz || 0)) / 22 + 0.5; } geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return geo; };
      // fuselage: one lathe from the radome tip to the nozzle, wider than it is tall, with a raised spine behind the canopy
      { const pts = [], prof = [[-8.9, 0.02], [-8.2, 0.16], [-7.0, 0.34], [-5.6, 0.52], [-4.2, 0.66], [-2.6, 0.76], [0, 0.80], [2.5, 0.80], [4.6, 0.76], [6.0, 0.68], [6.7, 0.62]];
        for (const [z, r] of prof) pts.push(new THREE.Vector2(r, z)); const fg = new THREE.LatheGeometry(pts, 32); fg.rotateX(Math.PI / 2); fg.scale(1.22, 0.9, 1);
        const p = fg.attributes.position; for (let k = 0; k < p.count; k++) { const z = p.getZ(k), y = p.getY(k); if (z < -4.2) p.setY(k, y - 0.14 * Math.pow((-4.2 - z) / 4.7, 1.5)); if (y > 0 && z > -1.2 && z < 5.6) p.setY(k, y * (1 + 0.22 * Math.sin((z + 1.2) / 6.8 * Math.PI))); } fg.computeVertexNormals();
        add(topUV(fg), gC, 0, 0, 0);
        // the radome: the nose itself in darker grey, a pointed cone that follows the body (it used to be a ball stuck on the tip)
        const rp = [[-8.93, 0.012], [-8.2, 0.165], [-7.4, 0.29], [-6.7, 0.385]].map(q => new THREE.Vector2(q[1] * 1.012, q[0])), rg = new THREE.LatheGeometry(rp, 32); rg.rotateX(Math.PI / 2); rg.scale(1.22, 0.9, 1);
        { const q = rg.attributes.position; for (let k = 0; k < q.count; k++) { const z = q.getZ(k); q.setY(k, q.getY(k) - 0.14 * Math.pow((-4.2 - z) / 4.7, 1.5)); } rg.computeVertexNormals(); } add(rg, ph(0x4f5961, 50), 0, 0, 0); }
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
        add(topUV(planform([[s * 0.7, -1.3], [s * 4.75, 2.7], [s * 4.75, 3.6], [s * 0.7, 4.0]], 0.16)), gC, 0, -0.05, 0);
        add(topUV(planform([[s * 0.7, -5.2], [s * 1.55, -1.0], [s * 0.7, -1.0]], 0.12)), gC, 0, -0.05, 0);                 // leading-edge strake, running forward to the cockpit
        surf(M.ail, s * 2.7, -0.05, 3.75, 3.4, 0.07, 0.55, g2);
        add(cyl(0.07, 0.07, 2.6, 8), dark, s * 4.8, -0.05, 2.7);                                                    // wingtip rail
        add(cyl(0.085, 0.085, 2.3, 8), ph(0xe9ebee, 60), s * 4.8, -0.2, 2.6); add(cyl(0.01, 0.085, 0.45, 8), ph(0xe9ebee, 60), s * 4.8, -0.2, 1.25);      // a missile on the rail
        for (const f of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.3, 0.28), g2, s * 4.8 + f * 0.0, -0.2 + f * 0.2, 3.6);
        add(finGeo([[4.6, -0.55], [5.9, -1.25], [6.5, -1.25], [6.3, -0.55]], 0.06), g2, s * 0.62, 0, 0).rotation.z = -s * 0.28;                              // ventral fin
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 4.8, 0.05, 3.8, 0.09); M.emit.push([s * 4.8, -0.05, 4.0]);
      }
      add(cyl(0.015, 0.02, 1.1, 6), dark, 0, -0.16, -9.3);                                                           // pitot
      const tp = pivot(0, -0.05, 6.3); M.elev.push(tp);
      for (const s of [-1, 1]) add(topUV(planform([[s * 0.6, -1.1], [s * 2.9, 0.3], [s * 2.9, 1.0], [s * 0.6, 0.8]], 0.1), 6.3), gC, 0, 0, 0, tp);
      add(finGeo([[3.3, 0.6], [6.2, 3.7], [7.1, 3.7], [6.9, 0.6]], 0.12), g2, 0, 0, 0);
      M.rud = pivot(0, 2.1, 6.95); add(new THREE.BoxGeometry(0.07, 2.5, 0.5), g1, 0, 0, 0.25, M.rud);
      M.gear = pivot(0, 0, 0); leg(0, -3.3, 0.2, -0.6, M.gear, g2); leg(-0.95, 1.6, 0.28, -0.3, M.gear, g2); leg(0.95, 1.6, 0.28, -0.3, M.gear, g2);
      // stores and markings: a centreline drop tank on its pylon, underwing pylons, pale formation-light strips, a dark fin cap, an air-data probe on the fin
      { const tk = [[0.02, -2.6], [0.26, -1.9], [0.34, -0.6], [0.34, 0.9], [0.22, 2.0], [0.03, 2.7]].map(p => new THREE.Vector2(p[0], p[1])), tg = new THREE.LatheGeometry(tk, 12); tg.rotateX(Math.PI / 2); add(tg, g3, 0, -1.55, 1.3);
        add(new THREE.BoxGeometry(0.08, 0.5, 1.6), g2, 0, -1.12, 1.3); for (const sg of [-1, 1]) { add(new THREE.BoxGeometry(0.07, 0.3, 1.5), g2, sg * 2.6, -0.28, 2.4);
          add(new THREE.BoxGeometry(0.02, 0.1, 1.3), ph(0xd9e6a8, 40), sg * 0.99, 0.18, -0.4); add(new THREE.BoxGeometry(0.9, 0.02, 0.1), ph(0xd9e6a8, 40), sg * 3.4, 0.05, 3.3); } }
      add(finGeo([[5.75, 3.2], [6.2, 3.72], [7.1, 3.72], [7.05, 3.2]], 0.13), dark, 0, 0, 0); add(cyl(0.012, 0.012, 0.7, 5), dark, 0, 3.5, 5.9);
      M.beacon = lamp(0xff3030, 0, 3.8, 6.6, 0.1); M.strobes.push(lamp(0xffffff, 0, -0.75, 2, 0.12));
    } else if (key === 'concorde') {
      // ---- the supersonic airliner: a needle fuselage, an ogival delta wing with no tailplane, four engines in two boxes under it, a nose that droops for landing ----
      const wht = ph(0xf4f5f6, 90), wng = ph(0xeef0f2, 70), navy = ph(0x1b2f5e, 60), metal = ph(0x8b9199, 110), R = 1.45, zN = -33, zT = 28.6; wng.map = skinTex(2, 0.6);
      const prof = [[-33, 0.03], [-32.2, 0.16], [-30.5, 0.42], [-28, 0.74], [-25, 1.05], [-22, 1.28], [-19, 1.41], [-16, 1.45], [13, 1.45], [18, 1.28], [22.5, 0.92], [26, 0.5], [28.6, 0.1]];
      // the paint, on a canvas wrapped round the body: white, a thin dark-blue line under a row of very small windows, the visor panes
      const paint = (() => { const c = document.createElement('canvas'), c2 = document.createElement('canvas'); c.width = c2.width = 256; c.height = c2.height = 2048; const x = c.getContext('2d'), e = c2.getContext('2d'), Y = z => 2048 * (1 - (z - zN) / (zT - zN));
        x.fillStyle = '#f4f5f6'; x.fillRect(0, 0, 256, 2048); e.fillStyle = '#000'; e.fillRect(0, 0, 256, 2048);
        for (const u of [64, 192]) { const sg = u < 128 ? 1 : -1; x.fillStyle = '#1b2f5e'; x.fillRect(u - sg * 9 - 2, Y(22), 4, Y(-24) - Y(22)); x.fillStyle = '#c9ccd0'; x.fillRect(u - sg * 14 - 1, Y(22), 2, Y(-24) - Y(22));
          for (let z = -21.5; z < 17.5; z += 0.51) { x.fillStyle = '#18202a'; x.fillRect(u + sg * 5 - 2, Y(z) - 3, 4, 5); if ((z * 5.7 % 1 + 1) % 1 > 0.25) { e.fillStyle = '#ffe2a0'; e.fillRect(u + sg * 5 - 2, Y(z) - 3, 4, 5); } }
          x.strokeStyle = 'rgba(40,48,58,.5)'; x.lineWidth = 2; for (const z of [-22.6, -6, 12]) x.strokeRect(u + sg * 2 - 9, Y(z) - 16, 18, 30); }
        x.fillStyle = '#141b24'; for (let k = -2; k < 2; k++) x.fillRect(128 + k * 17 + 2, Y(-24.6), 13, Y(-26.9) - Y(-24.6));                      // cockpit panes behind the visor
        x.fillStyle = '#2a333d'; for (let k = -2; k < 2; k++) x.fillRect(128 + k * 15 + 2, Y(-27.3), 11, Y(-29.6) - Y(-27.3));                      // the visor
        x.fillStyle = '#d8dbde'; x.fillRect(0, Y(-32.2), 256, 2048);
        const map = new THREE.CanvasTexture(c), em = new THREE.CanvasTexture(c2); map.anisotropy = em.anisotropy = renderer.capabilities.getMaxAnisotropy(); const m = new THREE.MeshPhongMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, shininess: 90 }); AC.livery.push(m); AC.envMats.push(m); return m; })();
      const tube = (a, b, zOff) => { const pts = prof.filter(p => p[0] >= a - 1e-6 && p[0] <= b + 1e-6).map(p => new THREE.Vector2(p[1], p[0] - zOff)), g = new THREE.LatheGeometry(pts, 24); g.rotateX(Math.PI / 2); const uv = g.attributes.uv, p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const z = p.getZ(i) + zOff; uv.setY(i, (z - zN) / (zT - zN)); if (z > 16) p.setY(i, p.getY(i) + 0.9 * Math.pow((z - 16) / 12.6, 1.6)); } g.computeVertexNormals(); return g; };
      add(tube(-25, 28.6, 0), paint, 0, 0, 0);
      M.droop = pivot(0, -0.5, -25); add(tube(-33, -25, -25), paint, 0, 0.5, 0, M.droop);                                    // the nose and visor swing down for take-off and landing
      add(cyl(0.012, 0.02, 1.3, 6), metal, 0, 0.5, -8.6, M.droop);                                                            // nose probe
      for (const s of [-1, 1]) {
        // the ogee wing: a curved leading edge from far forward on the body out to a narrow tip, a nearly straight trailing edge
        const W = [[1.2, -18.5], [1.9, -13], [2.9, -6.5], [4.2, 0.5], [6.1, 8], [8.6, 14.2], [11.2, 18.6], [12.75, 20.6], [12.8, 20.95], [1.2, 22.85]];
        add(skinUV(planform(W.map(p => [s * p[0], p[1]]), 0.46), 9), wng, 0, -0.95, 0);
        add(skinUV(planform([[s * 1.2, -12], [s * 3.6, 2], [s * 6.2, 12], [s * 7.4, 21.6], [s * 1.2, 22.6]], 0.34), 9), wng, 0, -0.74, 0);          // the thicker inner wing
        for (const [arr, ex2, wd] of [[M.elev, 3.1, 3.6], [M.elev, 6.9, 3.7], [M.ail, 10.7, 3.7]]) { const ev = surf(arr, s * ex2, -0.95, 22.75 - (ex2 - 1.2) * 0.164, wd, 0.14, 1.42, wht); ev.rotation.order = 'YXZ'; ev.rotation.y = s * 0.163; }          /* the elevons are the trailing edge */
        // two engines in one box under each wing: square intakes with a splitter, two round nozzles with clamshell petals
        const ex = s * 5.15, ey = -2.05; add(new THREE.BoxGeometry(2.75, 1.5, 10.6), wng, ex, ey, 14.6); add(new THREE.BoxGeometry(2.6, 1.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x0c0e11 }), ex, ey, 9.28);
        add(new THREE.BoxGeometry(0.1, 1.5, 1.6), metal, ex, ey, 9.6); add(new THREE.BoxGeometry(2.85, 0.07, 1.1), metal, ex, ey + 0.77, 9.3).rotation.x = -0.12;
        for (const k of [-1, 1]) { add(cyl(0.5, 0.62, 1.7, 16), metal, ex + k * 0.66, ey, 20.7); add(new THREE.CircleGeometry(0.5, 14), M.nozMat = M.nozMat || new THREE.MeshBasicMaterial({ color: 0x100806, fog: false }), ex + k * 0.66, ey, 21.2); M.emit.push([ex + k * 0.66, ey, 22.5]); }
        leg(s * 3.85, 9.3, 0.5, -0.95, M.gear = M.gear || pivot(0, 0, 0), wng); leg(s * 3.85, 10.8, 0.5, -0.95, M.gear);
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 12.8, -0.9, 21.2, 0.16); M.strobes.push(lamp(0xffffff, s * 12.85, -0.9, 22.2, 0.24));
      }
      M.nozzle = { material: M.nozMat };
      add(finGeo([[11.5, 1.3], [15.6, 2.3], [21.6, 10.2], [24.1, 10.2], [25.3, 1.3]], 0.3), wht, 0, 0, 0);
      add(finGeo([[18.2, 5.7], [21.55, 10.05], [24.1, 10.05], [24.68, 5.7]], 0.32), navy, 0, 0, 0); add(finGeo([[17.3, 4.5], [18.05, 5.5], [24.7, 5.5], [24.85, 4.5]], 0.32), ph(0xc8302a, 60), 0, 0, 0);
      M.rud = pivot(0, 5.6, 24.72); M.rud.rotation.x = -0.134; add(new THREE.BoxGeometry(0.26, 7.8, 0.85), wht, 0, 0, 0.42, M.rud);
      leg(0, -19.5, 0.4, -1.1, M.gear, wht); add(cyl(0.12, 0.12, 0.5, 8), dark, 0, 0.55, 27.6);                              // nose gear; the tail bumper
      { const ft = (() => { const fc = document.createElement('canvas'); fc.width = 32; fc.height = 256; const fx = fc.getContext('2d'), gd = fx.createLinearGradient(0, 256, 0, 0); gd.addColorStop(0, 'rgba(255,255,255,1)'); gd.addColorStop(0.2, 'rgba(255,200,140,.8)'); gd.addColorStop(0.6, 'rgba(255,130,50,.4)'); gd.addColorStop(1, 'rgba(255,90,20,0)'); fx.fillStyle = gd; fx.fillRect(0, 0, 32, 256);
          for (let d = 0; d < 4; d++) { const y = 236 - d * 38, rg = fx.createRadialGradient(16, y, 0, 16, y, 15); rg.addColorStop(0, 'rgba(255,255,255,' + (0.8 - d * 0.15) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)'); fx.fillStyle = rg; fx.fillRect(0, y - 15, 32, 30); } return new THREE.CanvasTexture(fc); })();
        M.burner = new THREE.Group(); M.burnerZ = 21.3; M.burnerL = 3.2; M.g.add(M.burner);
        for (const bx of [-5.81, -4.49, 4.49, 5.81]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.46, 6.4, 12, 1, true).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ map: ft, color: 0xffa860, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide, toneMapped: false })); f.position.set(bx, -2.05, 0); M.burner.add(f); } }
      M.beacon = lamp(0xff3030, 0, 1.6, -4, 0.2); lamp(0xffffff, 0, 1.0, 28.6, 0.16);
      M.land = [lamp(0xfff4dc, -1.6, -0.9, -17.5, 0.55), lamp(0xfff4dc, 1.6, -0.9, -17.5, 0.55), lamp(0xfff4dc, 0, -1.2, -19.5, 0.4)];
    } else if (key === 'stealth') {
      // ---- the stealth jet: nothing but flat facets. An arrowhead plate (the leading edge runs straight from the nose to the wingtip), a faceted
      //      pyramid of a body on it, a shallow belly, a sawtooth trailing edge, two canted fins, gridded intakes, slot exhausts ----
      const blk = new THREE.MeshPhongMaterial({ color: 0x25282c, shininess: 22, specular: 0x555b62, flatShading: true, side: THREE.DoubleSide }), blk2 = new THREE.MeshPhongMaterial({ color: 0x1b1d20, shininess: 12, flatShading: true, side: THREE.DoubleSide });
      const gold = new THREE.MeshPhongMaterial({ color: 0x4a3a12, shininess: 160, specular: 0xffe9a8, flatShading: true, side: THREE.DoubleSide }); AC.envMats.push(gold);
      blk.map = blk2.map = skinTex(4, 1.5);          /* the coating's tiles and seams, faint on black */
      const ZS = 1.1, V = { N: [0, -0.2, -10], L0: [1.83, -0.2, -5.6], L1: [3.53, -0.2, -1.5], TL: [6.6, -0.2, 5.9], TT: [6.45, -0.2, 7.1], NO: [2.3, -0.2, 4.6], RE: [1.7, -0.2, 7.3], TC: [0, -0.15, 8.0],
        K0: [0, 0.35, -7.4], K1: [0, 1.55, -4.4], K2: [0, 1.6, -2.2], K3: [0, 1.2, 1.5], K4: [0, 0.55, 5.6], H1: [0.85, 0.95, -4.3], H2: [0.95, 1.0, -2.0], H3: [1.25, 0.55, 1.6], H4: [1.0, 0.3, 5.4],
        J1: [1.9, 0.05, -1.5], J2: [2.1, 0.05, 2.6], RT: [6.2, -0.05, 6.5], B0: [0, -0.85, -4.5], B1: [0, -0.9, 0], B2: [0, -0.7, 6.6], E1: [1.7, -0.85, -1.0], E2: [1.9, -0.85, 3.8] };
      const facets = tris => { const P = []; for (const sg of [1, -1]) for (const t of tris) for (const n of t) { const v = V[n]; P.push(sg * v[0], v[1], v[2] * ZS); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return skinUV(g, 5.5); };
      add(facets([['N', 'K0', 'L0'], ['K0', 'H1', 'L0'], ['K1', 'K2', 'H2'], ['K1', 'H2', 'H1'], ['H1', 'H2', 'J1'], ['H1', 'J1', 'L0'], ['K2', 'K3', 'H3'], ['K2', 'H3', 'H2'], ['H2', 'H3', 'J2'], ['H2', 'J2', 'J1'], ['K3', 'K4', 'H4'], ['K3', 'H4', 'H3'],
        ['H3', 'H4', 'NO'], ['H3', 'NO', 'J2'], ['K4', 'TC', 'RE'], ['K4', 'RE', 'H4'], ['H4', 'RE', 'NO'], ['L0', 'L1', 'J1'], ['L1', 'J2', 'J1'], ['L1', 'TL', 'RT'], ['L1', 'RT', 'J2'], ['J2', 'RT', 'TT'], ['J2', 'TT', 'NO'], ['TL', 'TT', 'RT']]), blk, 0, 0, 0);
      add(facets([['N', 'L0', 'B0'], ['L0', 'E1', 'B0'], ['L0', 'L1', 'E1'], ['B0', 'E1', 'B1'], ['E1', 'E2', 'B1'], ['L1', 'E2', 'E1'], ['L1', 'TL', 'E2'], ['TL', 'TT', 'E2'], ['TT', 'NO', 'E2'], ['NO', 'RE', 'E2'], ['E2', 'RE', 'B2'], ['E2', 'B2', 'B1'], ['RE', 'TC', 'B2']]), blk2, 0, 0, 0);
      // the canopy: five flat panes with a gold tint, set a hair above the body facets, with dark frames between them (the body shows through as the frame)
      { const pane = (a, b, c, k) => { const A = V[a], B = V[b], C = V[c], cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3, cz = (A[2] + B[2] + C[2]) / 3, P = [];
          for (const sg of [1, -1]) for (const v of [A, B, C]) P.push(sg * (cx + (v[0] - cx) * k + 0.012), cy + (v[1] - cy) * k + 0.012, (cz + (v[2] - cz) * k) * ZS); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); add(g, gold, 0, 0, 0); };
        V.KW = [0, 0.82, -6.2]; V.HW = [0.62, 0.72, -5.2]; pane('KW', 'K1', 'H1', 0.86); pane('K1', 'K2', 'H2', 0.8); pane('K1', 'H2', 'H1', 0.8); V.JW = [1.25, 0.5, -3.2]; pane('H1', 'H2', 'JW', 0.84); }
      for (const s of [-1, 1]) {
        // intake grid on the shoulder, exhaust slot on the flat tail, an elevon and a flaperon on the swept trailing edge, a canted fin
        const ig = add(new THREE.PlaneGeometry(0.95, 1.5), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.DoubleSide }), s * 1.62, 0.52, -0.2); ig.rotation.set(-0.5, s * 0.5, 0, 'YXZ');
        add(new THREE.BoxGeometry(1.25, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: 0x08090a }), s * 0.9, -0.06, 8.25); M.emit.push([s * 0.9, 0, 9.2]);
        for (const [arr, f] of [[M.elev, 0.3], [M.ail, 0.74]]) { const hx = lerp(2.3, 6.45, f), hz = lerp(4.6, 7.1, f) * ZS - 0.42, p = pivot(s * hx, -0.2, hz); p.rotation.order = 'YXZ'; p.rotation.y = -s * 0.56; add(new THREE.BoxGeometry(1.75, 0.05, 0.55), blk2, 0, 0, 0.3, p); p.userData.z = hz; arr.push(p); }
        const fin = add(finGeo([[5.9, 0], [9.0, 2.75], [10.2, 2.75], [8.5, 0]], 0.13), blk, s * 0.32, 0.42, 0); fin.rotation.z = -s * 0.7;
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 6.5, -0.15, 7.4, 0.07);
        add(cyl(0.012, 0.02, 0.9, 5), blk2, s * 0.22, -0.18, -11.3).rotation.y = -s * 0.12; add(cyl(0.012, 0.02, 0.7, 5), blk2, s * 0.5, -0.19, -10.6).rotation.y = -s * 0.2;      // the four air-data probes on the nose
      }
      M.rud = pivot(0, -50, 0);
      M.gear = pivot(0, 0, 0); leg(0, -6.0, 0.26, -0.5, M.gear, blk2); leg(-1.75, 1.3, 0.34, -0.5, M.gear, blk2); leg(1.75, 1.3, 0.34, -0.5, M.gear, blk2);
      M.beacon = lamp(0xff3030, 0, -0.95, 0.5, 0.08); M.strobes.push(lamp(0xffffff, 0, 1.3, 2.0, 0.08)); M.land = [lamp(0xfff4dc, 0, -1.1, -6.0, 0.3)];
    } else if (key === 'bomber') {
      // ---- the heavy bomber: a long slab fuselage, a huge shoulder wing swept 35 degrees that droops on the ground and bows upward in flight, eight
      //      engines in four twin pods on forward pylons, tip tanks, a tall fin, four twin-wheel trucks under the body and outrigger wheels near the tips ----
      const grey = ph(0x6a7077, 30), grey2 = ph(0x555b62, 25), dkg = ph(0x3f444a, 30), glassD = new THREE.MeshPhongMaterial({ color: 0x10161c, shininess: 150, specular: 0xbcd4e8 }); grey.map = skinTex(3, 1.3); AC.envMats.push(glassD);
      { const prof = [[-24.2, 0.05], [-23.8, 0.5], [-23, 0.95], [-21.5, 1.33], [-19, 1.5], [9, 1.5], [15, 1.28], [20, 0.95], [23.4, 0.66], [24.4, 0.5]], g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[1], p[0])), 22); g.rotateX(Math.PI / 2); g.scale(1, 1.28, 1);
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); if (z > 9) p.setY(i, y + 0.75 * Math.pow((z - 9) / 15.4, 1.4)); if (z < -19) p.setY(i, y - 0.35 * Math.pow((-19 - z) / 5.2, 1.5)); } g.computeVertexNormals(); add(tileUV(g, 6, 16), grey, 0, 0, 0); }
      add(new THREE.SphereGeometry(1, 14, 10), dkg, 0, -0.32, -22.9).scale.set(0.98, 1.2, 1.5);                                                    // radome
      for (const k of [-1.5, -0.5, 0.5, 1.5]) { const w = add(new THREE.BoxGeometry(0.5, 0.62, 0.05), glassD, k * 0.56, 1.52, -21.25); w.rotation.set(-0.95, -k * 0.2, 0, 'YXZ'); }      // windscreen panes
      for (const sg of [-1, 1]) { add(new THREE.BoxGeometry(0.05, 0.5, 0.9), glassD, sg * 1.33, 1.2, -20.3).rotation.z = -sg * 0.35; add(new THREE.SphereGeometry(0.34, 8, 6), dkg, sg * 0.55, -1.85, -21.6).scale.set(1, 0.8, 1.6); }      // side windows, the two sensor blisters under the chin
      add(new THREE.SphereGeometry(0.5, 10, 8), dkg, 0, 1.3, 24.3).scale.set(0.9, 0.9, 1.6); add(new THREE.BoxGeometry(0.9, 0.25, 7), grey2, 0, 1.98, -8);      // tail fairing, the spine
      for (const s of [-1, 1]) {
        const wg = pivot(0, 1.25, -3); wg.rotation.z = -s * 0.055; M.wings = M.wings || []; M.wings.push([wg, s, -0.055, 3.2, 0.085]);          // drooped on the ground, bowed up in the air
        const LE = x => -5.5 + (x - 1.4) * 0.70;
        add(skinUV(planform([[s * 1.4, -5.5], [s * 28.2, LE(28.2)], [s * 28.2, LE(28.2) + 3.3], [s * 10.5, 8.6], [s * 1.4, 4.6]], 0.62), 8), grey, 0, 0, 0, wg);
        surf(M.flap, s * 6.2, -0.1, 4.5, 8.2, 0.2, 2.2, grey2, wg).rotation.y = -s * 0.414; surf(M.flap, s * 16.6, -0.1, 9.6, 7.4, 0.17, 1.7, grey2, wg).rotation.y = -s * 0.42;
        for (const f of M.flap.slice(-2)) f.rotation.order = 'YXZ';
        M.spoil = M.spoil || []; { const sp2 = pivot(s * 14.5, 0.33, 7.4, wg); sp2.rotation.order = 'YXZ'; sp2.rotation.y = -s * 0.5; add(new THREE.BoxGeometry(7, 0.05, 1.0), grey2, 0, 0, 0.5, sp2); M.spoil.push(sp2); }
        for (const px of [9.9, 18.6]) { const pz = LE(px) + 3.0 - 6.4, py = -2.1;                                                                 // a twin pod, hung ahead of and below the wing
          add(finGeo([[pz + 1.4, py + 0.75], [pz + 5.2, -0.2], [pz + 8.2, -0.2], [pz + 4.4, py + 0.75]], 0.3), grey2, s * px, 0, 0, wg); add(new THREE.BoxGeometry(1.5, 0.5, 3.4), grey2, s * px, py + 0.55, pz + 2.6, wg);
          for (const k of [-1, 1]) { const ex = s * px + k * 0.78, prf = [[0.52, -2.0], [0.63, -1.75], [0.68, -0.9], [0.68, 0.3], [0.6, 1.3], [0.46, 2.0]].map(q => new THREE.Vector2(q[0], q[1])), ng = new THREE.LatheGeometry(prf, 16); ng.rotateX(Math.PI / 2);
            add(ng, grey, ex, py, pz + 2.2, wg); add(new THREE.TorusGeometry(0.55, 0.05, 6, 16), dkg, ex, py, pz + 0.22, wg);
            const fan = pivot(ex, py, pz + 0.6, wg); add(new THREE.CircleGeometry(0.52, 18), fanMat(), 0, 0, 0, fan).rotation.y = Math.PI; add(new THREE.ConeGeometry(0.15, 0.3, 10).rotateX(-Math.PI / 2), dkg, 0, 0, -0.12, fan); (M.fans = M.fans || []).push(fan);
            add(new THREE.CircleGeometry(0.44, 12), new THREE.MeshBasicMaterial({ color: 0x0c0d0f }), ex, py, pz + 4.21, wg); }
          M.emit.push([s * px, py + 1.2, pz + 6]); }
        { const tk = [[0.03, -3.4], [0.34, -2.6], [0.5, -1], [0.5, 1.2], [0.3, 2.9], [0.04, 3.7]].map(q => new THREE.Vector2(q[0], q[1])), tg = new THREE.LatheGeometry(tk, 12); tg.rotateX(Math.PI / 2); add(tg, grey2, s * 25.4, -0.85, LE(25.4) + 1.2, wg); add(new THREE.BoxGeometry(0.12, 0.6, 2.2), grey2, s * 25.4, -0.4, LE(25.4) + 1.6, wg); }      // tip tank
        { add(new THREE.BoxGeometry(0.25, 0.7, 5), grey2, s * 5.2, -0.6, 0.4, wg); for (const k of [-1, 0, 1]) { add(cyl(0.26, 0.26, 5.2, 8), ph(0xd9dcdf, 40), s * 5.2 + k * 0.62, -1.15 - (k ? 0 : 0.4), 0.4, wg); add(cyl(0.02, 0.26, 0.9, 8), ph(0xd9dcdf, 40), s * 5.2 + k * 0.62, -1.15 - (k ? 0 : 0.4), -2.65, wg); } }      // a pylon with three cruise missiles
        { const ow = pivot(0, 0, 0, wg), x = s * 21.5, z = LE(21.5) + 2.2; add(new THREE.CylinderGeometry(0.07, 0.09, 3.0, 8), ph(0xd9dde2, 80), x, -1.75, z, ow); const wh = pivot(x, -3.35, z, ow); add(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 14).rotateZ(Math.PI / 2), tyre, 0, 0, 0, wh); (M.wheels = M.wheels || []).push([wh, 0.34]); (M.outrig = M.outrig || []).push(ow); }      // outrigger wheel
        add(skinUV(planform([[s * 0.9, 17.2], [s * 8.0, 21.6], [s * 8.0, 23.5], [s * 0.9, 23.9]], 0.34), 8), grey, 0, 0.75, 0); surf(M.elev, s * 4.4, 0.75, 23.4, 7, 0.14, 1.0, grey2);
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 28.2, 0.1, LE(28.2) + 1.6, 0.2).userData.wing = 1; M.strobes.push(lamp(0xffffff, s * 1.6, -1.8, -2, 0.25));
        leg(s * 1.3, -8.6, 0.62, -1.2, M.gear = M.gear || pivot(0, 0, 0), grey2); leg(s * 1.3, 7.2, 0.62, -1.2, M.gear, grey2);
      }
      add(finGeo([[14.6, 1.7], [21.2, 9.3], [24.3, 9.3], [24.2, 1.4]], 0.34), grey, 0, 0, 0); add(finGeo([[19.9, 7.9], [21.2, 9.32], [24.3, 9.32], [24.3, 7.9]], 0.36), dkg, 0, 0, 0);
      M.rud = pivot(0, 5.2, 24.25); add(new THREE.BoxGeometry(0.16, 6.6, 0.9), grey2, 0, 0, 0.45, M.rud);
      M.beacon = lamp(0xff3030, 0, 2.1, -4, 0.22); lamp(0xffffff, 0, 1.4, 25.2, 0.18);
      M.land = [lamp(0xfff4dc, -1.3, -1.5, -9.4, 0.5), lamp(0xfff4dc, 1.3, -1.5, -9.4, 0.5), lamp(0xfff4dc, 0, -1.7, -20, 0.36)];
    } else {
      // ---- aerobatic monoplane: propeller, fixed gear, big control surfaces ----
      const red = ph(0xd3302b, 80), wht = ph(0xf5f2ea, 70);
      // fuselage: one lathe from the cowling to the tail post, painted on a canvas: a red nose and belly, white top, a red sweep along the side
      { const prof = [[-2.95, 0.34], [-2.6, 0.46], [-2.0, 0.52], [-0.6, 0.53], [0.8, 0.46], [2.4, 0.30], [4.1, 0.10], [4.35, 0.05]], pts = prof.map(p => new THREE.Vector2(p[1], p[0])), fg = new THREE.LatheGeometry(pts, 18); fg.rotateX(Math.PI / 2);
        const p = fg.attributes.position, uv = fg.attributes.uv; for (let k = 0; k < p.count; k++) { const z = p.getZ(k), y = p.getY(k); if (y > 0 && z > -1.6 && z < 2.6) p.setY(k, y * (1 + 0.16 * Math.sin((z + 1.6) / 4.2 * Math.PI))); uv.setY(k, (z + 2.95) / 7.3); } fg.computeVertexNormals();
        const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'), Y = z => 512 * (1 - (z + 2.95) / 7.3);
        x.fillStyle = '#f5f2ea'; x.fillRect(0, 0, 256, 512); x.fillStyle = '#d3302b'; x.fillRect(0, Y(-1.9), 256, 512 - Y(-1.9)); x.fillRect(0, 0, 40, 512); x.fillRect(216, 0, 40, 512);                    // nose, belly
        for (const u of [64, 192]) { const sg = u < 128 ? 1 : -1; x.beginPath(); x.moveTo(u - sg * 24, Y(-1.9)); x.lineTo(u + sg * 30, Y(-1.9)); x.lineTo(u + sg * 4, Y(3.9)); x.lineTo(u - sg * 24, Y(3.9)); x.closePath(); x.fill();          // the sweep narrows to the tail
          x.fillStyle = '#1c2f52'; x.fillRect(u + sg * 30 - (sg > 0 ? 0 : 5), Y(3.6), 5, Y(-1.9) - Y(3.6)); x.fillStyle = '#d3302b'; }
        const fm = new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(c), shininess: 90 }); AC.envMats.push(fm); add(fg, fm, 0, 0, 0); }
      add(new THREE.TorusGeometry(0.33, 0.035, 6, 16), dark, 0, 0, -2.96); for (const sg of [-1, 1]) add(cyl(0.035, 0.035, 0.5, 6), ph(0x8b9199, 120), sg * 0.3, -0.42, -2.1).rotation.x = 0.5;                     // cowl intake, exhaust stacks
      // propeller: a spinner and three tapered blades; as the engine speeds up the blades give way to a blurred disc with a yellow tip ring
      M.prop = pivot(0, 0, -3.05); add(new THREE.ConeGeometry(0.2, 0.55, 14).rotateX(-Math.PI / 2), wht, 0, 0, -0.18, M.prop); M.blades = [];
      for (let b = 0; b < 3; b++) { const bl = pivot(0, 0, 0, M.prop); bl.rotation.z = b * Math.PI * 2 / 3; const bm = add(new THREE.BoxGeometry(0.17, 1.0, 0.035), dark, 0, 0.6, 0, bl); bm.rotation.y = 0.35; add(new THREE.BoxGeometry(0.12, 0.14, 0.04), ph(0xf2c230, 40), 0, 1.05, 0, bl).rotation.y = 0.35; M.blades.push(bl); }
      { const dc = document.createElement('canvas'); dc.width = dc.height = 128; const dx = dc.getContext('2d'), dg = dx.createRadialGradient(64, 64, 6, 64, 64, 64); dg.addColorStop(0, 'rgba(60,64,70,.0)'); dg.addColorStop(0.3, 'rgba(60,64,70,.20)'); dg.addColorStop(0.86, 'rgba(60,64,70,.13)'); dg.addColorStop(0.9, 'rgba(242,194,48,.3)'); dg.addColorStop(0.97, 'rgba(242,194,48,.2)'); dg.addColorStop(1, 'rgba(60,64,70,0)'); dx.fillStyle = dg; dx.fillRect(0, 0, 128, 128);
        M.disc = add(new THREE.CircleGeometry(1.13, 28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dc), transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0, -3.06); }
      // canopy: clear, with a frame, and the pilot under it
      { const glass = new THREE.MeshPhongMaterial({ color: 0x33424f, shininess: 160, specular: 0xdcecf8, transparent: true, opacity: 0.38 }); AC.envMats.push(glass);
        add(new THREE.BoxGeometry(0.42, 0.5, 0.45), dark, 0, 0.36, 0.25); add(new THREE.SphereGeometry(0.16, 10, 8), ph(0xf0f0ea, 90), 0, 0.72, 0.05); add(new THREE.BoxGeometry(0.3, 0.3, 0.22), ph(0x2a3c66, 40), 0, 0.5, 0.05);            // seat, helmet, shoulders
        add(new THREE.SphereGeometry(0.44, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glass, 0, 0.36, -0.15).scale.set(0.95, 1.0, 2.8); add(new THREE.TorusGeometry(0.42, 0.028, 6, 14, Math.PI), wht, 0, 0.36, -1.05).scale.set(0.95, 0.75, 1); }
      // the wings carry a sunburst on top: red rays on white, the same on both sides (it shows the attitude from far away)
      const sun2 = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f5f2ea'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#d3302b';
        for (const sg of [-1, 1]) for (let r = 0; r < 5; r++) { const a0 = 0.10 + r * 0.30, a1 = a0 + 0.15; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + sg * Math.cos(a0) * 300, 128 - Math.sin(a0) * 300); x.lineTo(128 + sg * Math.cos(a1) * 300, 128 - Math.sin(a1) * 300); x.closePath(); x.fill(); }
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1 / 8.4, 1 / 2.1); t.offset.set(0.5, 0.74); const m = new THREE.MeshPhongMaterial({ map: t, shininess: 80 }); AC.envMats.push(m); return m; })();
      for (const s of [-1, 1]) {
        add(planform([[s * 0.4, -1.45], [s * 4, -0.85], [s * 4, 0.05], [s * 0.4, 0.5]], 0.14), sun2, 0, -0.3, 0);
        surf(M.ail, s * 2.4, -0.3, 0.2, 2.9, 0.06, 0.42, red);
        add(planform([[s * 0.1, 3.3], [s * 1.5, 3.5], [s * 1.5, 3.95], [s * 0.1, 4.0]], 0.07), red, 0, 0.15, 0);
        add(new THREE.BoxGeometry(0.07, 0.75, 0.3), ph(0xd9dde2, 120), s * 0.62, -0.62, -1.2).rotation.z = s * 0.75;             // spring gear leg
        { const wh = pivot(s * 0.92, -0.85, -1.2); (M.wheels = M.wheels || []).push([wh, 0.2]); add(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16).rotateZ(Math.PI / 2), tyre, 0, 0, 0, wh); add(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 8).rotateZ(Math.PI / 2), ph(0xbfc5cb, 60), 0, 0, 0, wh); add(new THREE.BoxGeometry(0.16, 0.05, 0.05), dark, 0, 0, 0, wh); }
        { const sp3 = [[0.02, -0.5], [0.15, -0.3], [0.2, 0.0], [0.16, 0.32], [0.03, 0.62]].map(p => new THREE.Vector2(p[0], p[1])), sg2 = new THREE.LatheGeometry(sp3, 10, 0, Math.PI); sg2.rotateX(Math.PI / 2); sg2.rotateZ(Math.PI / 2); add(sg2, red, s * 0.92, -0.8, -1.2).scale.set(0.8, 1.15, 1); }   // wheel spat
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 4.0, -0.28, -0.3, 0.07);
      }
      add(new THREE.BoxGeometry(0.03, 0.3, 0.05), ph(0xd9dde2, 120), 0, -0.25, 4.05).rotation.x = -0.5; add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10).rotateZ(Math.PI / 2), tyre, 0, -0.4, 4.15);        // tail wheel
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
  // The cockpit view is for the scenery (the owner's wish, even at the cost of accuracy, in every aircraft): nothing stands between the eye and the world.
  // No window posts, no roof, no canopy bow, no nose, no walls, no wide panel. All that is left in front is a small instrument pod low in the middle of the
  // view, from 21 degrees below the horizon down: the two live flight displays and the map, under a thin lip. The world shows to both sides of it, right
  // down to the bottom of the screen. Behind (seen only when looking round) are a floor and two low seats.
  dadd(new THREE.BoxGeometry(1.34, 0.03, 0.12), dk, 0, 0.615, -16.42).rotation.x = 0.08;              // the lip over the pod
  dadd(new THREE.PlaneGeometry(1.3, 0.34), trim, 0, 0.45, -16.5).rotation.x = -0.5;                   // the pod
  AC.pfdTex = new THREE.CanvasTexture(document.getElementById('pfd')); AC.mapTex = new THREE.CanvasTexture(document.getElementById('map'));
  const scr = (w, h, x, tex) => { dadd(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }), x, 0.46, -16.47).rotation.x = -0.5; };
  scr(0.4, 0.27, -0.39, AC.pfdTex); scr(0.15, 0.27, 0.0, AC.mapTex); scr(0.4, 0.27, 0.39, AC.pfdTex);
  AC.stick = new THREE.Group(); AC.stick.position.set(-0.5, -0.25, -15.6); AC.deck.add(AC.stick);
  dadd(new THREE.CylinderGeometry(0.025, 0.035, 0.26, 8), dk, 0, 0.13, 0, AC.stick); dadd(new THREE.SphereGeometry(0.045, 8, 6), dk, 0, 0.27, 0, AC.stick);
  AC.thr = new THREE.Group(); AC.thr.position.set(0.5, -0.3, -15.75); AC.deck.add(AC.thr); dadd(new THREE.BoxGeometry(0.22, 0.2, 0.06), dk, 0, 0.12, 0, AC.thr);
  { const cab = lam(0x2b3036), seat = lam(0x3b4654);
    dadd(new THREE.BoxGeometry(2.2, 0.06, 2.4), cab, 0, -0.42, -14.0, AC.frame);                                                                                            // a floor behind the eye
    for (const sd of [-1, 1]) { dadd(new THREE.BoxGeometry(0.52, 0.8, 0.14), seat, sd * 0.62, 0.2, -14.25, AC.frame).rotation.x = -0.12; dadd(new THREE.BoxGeometry(0.52, 0.12, 0.5), seat, sd * 0.62, -0.08, -14.5, AC.frame); } }   // low seats
  AC.bub = new THREE.Group(); AC.deck.add(AC.bub); AC.bubNose = dadd(new THREE.BoxGeometry(0.01, 0.01, 0.01), lam(0x7d8894), 0, -5, -15, AC.bub); AC.bubNose.visible = false;          // single-seaters have the same open view (the nose that used to show is gone)
  AC.deck.add(AC.frame); AC.root.add(AC.deck); AC.deck.visible = false; scene.add(AC.root);
}
/** Switch aircraft: load its flight model numbers and show its 3D model. */
function selectPlane(key) {
  PL = PLANES[key] || PLANES.airliner; AC.m = AC.models[PL.key];
  MASS = PL.mass; SW = PL.S; CL0 = PL.cl0; CLA = PL.cla; CD0 = PL.cd0; KIND = PL.k; TMAX = PL.T; ASTALL = PL.ast; GEAR_H = PL.gearH; FLAPS = PL.flaps;
  for (const k of PLANE_ORDER) AC.models[k].g.visible = false;
  AC.deck.position.set(PL.eye[0], PL.eye[1] - 1.16, PL.eye[2] + 15); AC.frame.visible = !PL.bubble; if (AC.bub) AC.bub.visible = !!PL.bubble; if (AC.bubNose) AC.bubNose.material.color.setHex(PL.key === 'stealth' ? 0x25282c : PL.key === 'stunt' ? 0xd3302b : 0x7d8894);
  SAVE.plane = PL.key; persist();
}
const fi = n => Math.min(n, FLAPS.length - 1);          // flap notch that exists on this aircraft
