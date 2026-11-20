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
const AC = { root: new THREE.Group(), deck: new THREE.Group(), frame: new THREE.Group(), models: {}, m: null };
function planform(pts, t) {   // flat swept surface from (x, z) outline
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, t / 2, 0); return g;
}
function finGeo(pts, t) {     // vertical surface from (z, y) outline
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(t / 2, 0, 0); return g;
}
function buildAircraft() {
  const ph = (c, s) => new THREE.MeshPhongMaterial({ color: c, shininess: s || 50 }), lam = c => new THREE.MeshLambertMaterial({ color: c });
  AC.cabinMat = new THREE.MeshBasicMaterial({ color: 0x1b2430 });
  const dark = lam(0x23272c), tyre = lam(0x111214), cyl = (a, b, l, n) => new THREE.CylinderGeometry(a, b, l, n || 18).rotateX(Math.PI / 2);
  const canopy = new THREE.MeshPhongMaterial({ color: 0x18242f, shininess: 140, specular: 0xbfd8ee, transparent: true, opacity: 0.86 });
  for (const key of PLANE_ORDER) {
    const sp = PLANES[key], M = { g: new THREE.Group(), elev: [], ail: [], flap: [], strobes: [], rud: null, gear: null, beacon: null, prop: null, burner: null, emit: [] };
    const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || M.g).add(m); return m; };
    const pivot = (x, y, z, parent) => { const g = new THREE.Group(); g.position.set(x, y, z); (parent || M.g).add(g); return g; };
    const lamp = (c, x, y, z, r) => add(new THREE.SphereGeometry(r || 0.22, 8, 6), new THREE.MeshBasicMaterial({ color: c, fog: false }), x, y, z);
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
      add(cyl(R, R, len, 22), body, 0, 0, zc);
      add(new THREE.SphereGeometry(R, 22, 14), body, 0, 0, o.z0).scale.set(1, 1, o.nose);
      add(cyl(R * 0.23, R, o.tail, 22), body, 0, R * 0.18, o.z1 + o.tail / 2 - 0.1).rotation.x = -0.085;
      add(new THREE.BoxGeometry(R * 1.28, R * 0.28, R * 0.67), dark, 0, R * 0.44, o.z0 - R * 0.97).rotation.x = 0.5;            // windshield
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, R * 0.17, len * 0.86), AC.cabinMat, s * R * 0.995, R * 0.26, zc);  // cabin windows
      add(new THREE.BoxGeometry(R * 0.1, R * 0.1, len), acc, 0, -R * 0.975, zc);
      if (!big) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, R * 0.1, len * 1.05), ph(0xc9a44a, 80), s * R * 0.999, -R * 0.05, zc);  // gold cheatline
      for (const s of [-1, 1]) {
        const wg = pivot(0, 0, 0); wg.rotation.z = s * o.dih; const tip = o.wing[1];
        add(planform(o.wing.map(p => [s * p[0], p[1]]), o.wt), wingM, 0, o.wy, 0, wg);
        add(new THREE.BoxGeometry(R * 0.08, R * 1.2, R * 0.9), acc, s * tip[0], o.wy + R * 0.5, tip[1] + R * 0.5, wg).rotation.x = -0.3;      // winglet
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
    } else if (key === 'fighter') {
      // ---- single-engine fighter: blended delta, bubble canopy, all-moving tailplanes, afterburner ----
      const g1 = ph(0x8d98a3, 70), g2 = ph(0x6c7884, 60);
      add(cyl(0.75, 0.75, 9), g1, 0, 0, 1.0); add(cyl(0.75, 0.07, 5.4), g2, 0, 0, -6.2);                       // fuselage + radome
      add(new THREE.SphereGeometry(0.55, 16, 12), canopy, 0, 0.6, -2.6).scale.set(1, 1, 3.4);
      add(new THREE.BoxGeometry(1.05, 0.5, 2.6), dark, 0, -0.78, -1.6); add(new THREE.BoxGeometry(1.5, 0.5, 6), g1, 0, -0.1, 2.2);
      add(cyl(0.62, 0.72, 1.3, 16), dark, 0, 0, 6.1);
      M.burner = add(cyl(0.08, 0.5, 5.5, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, 0, 9.4);
      for (const s of [-1, 1]) {
        add(planform([[s * 0.6, -1.3], [s * 4.75, 2.7], [s * 4.75, 3.6], [s * 0.6, 4.0]], 0.16), g1, 0, -0.05, 0);
        add(planform([[s * 0.6, -4.3], [s * 1.5, -1.0], [s * 0.6, -1.0]], 0.12), g2, 0, -0.05, 0);                 // leading-edge strake
        surf(M.ail, s * 2.7, -0.05, 3.75, 3.4, 0.07, 0.55, g2);
        add(cyl(0.07, 0.07, 2.6, 8), dark, s * 4.8, -0.05, 2.7);                                                    // wingtip rail
        lamp(s < 0 ? 0xff2020 : 0x20ff40, s * 4.8, 0.05, 3.8, 0.09); M.emit.push([s * 4.8, -0.05, 4.0]);
      }
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
  const trim = lam(0x30353b), dk = lam(0x15181c);
  const dadd = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || AC.deck).add(m); return m; };
  dadd(new THREE.BoxGeometry(3.4, 0.1, 0.9), dk, 0, 0.84, -16.3).rotation.x = 0.08;                   // glare shield
  dadd(new THREE.PlaneGeometry(3.3, 0.72), trim, 0, 0.47, -16.45).rotation.x = -0.2;                  // main panel
  AC.pfdTex = new THREE.CanvasTexture(document.getElementById('pfd')); AC.mapTex = new THREE.CanvasTexture(document.getElementById('map'));
  const scr = (w, h, x, tex) => { dadd(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }), x, 0.47, -16.43).rotation.x = -0.2; };
  scr(0.7, 0.48, -0.62, AC.pfdTex); scr(0.29, 0.53, 0.02, AC.mapTex); scr(0.7, 0.48, 0.66, AC.pfdTex);
  dadd(new THREE.BoxGeometry(1.0, 0.5, 1.2), trim, 0, 0.05, -15.9);                                   // pedestal
  for (const s of [-1, 1]) { dadd(new THREE.BoxGeometry(0.11, 1.5, 0.11), trim, s * 1.2, 1.5, -16.6, AC.frame).rotation.z = -s * 0.28; dadd(new THREE.BoxGeometry(0.12, 2.6, 3), trim, s * 1.72, 1.0, -15.4, AC.frame); }
  dadd(new THREE.BoxGeometry(3.6, 0.3, 1.0), trim, 0, 1.72, -16.2, AC.frame);
  AC.stick = new THREE.Group(); AC.stick.position.set(-1.0, 0.45, -15.75); AC.deck.add(AC.stick);
  dadd(new THREE.CylinderGeometry(0.025, 0.035, 0.26, 8), dk, 0, 0.13, 0, AC.stick); dadd(new THREE.SphereGeometry(0.045, 8, 6), dk, 0, 0.27, 0, AC.stick);
  AC.thr = new THREE.Group(); AC.thr.position.set(0, 0.3, -15.75); AC.deck.add(AC.thr); dadd(new THREE.BoxGeometry(0.22, 0.2, 0.06), dk, 0, 0.12, 0, AC.thr);
  AC.deck.add(AC.frame); AC.root.add(AC.deck); AC.deck.visible = false; scene.add(AC.root);
}
/** Switch aircraft: load its flight model numbers and show its 3D model. */
function selectPlane(key) {
  PL = PLANES[key] || PLANES.airliner; AC.m = AC.models[PL.key];
  MASS = PL.mass; SW = PL.S; CL0 = PL.cl0; CLA = PL.cla; CD0 = PL.cd0; KIND = PL.k; TMAX = PL.T; ASTALL = PL.ast; GEAR_H = PL.gearH; FLAPS = PL.flaps;
  for (const k of PLANE_ORDER) AC.models[k].g.visible = false;
  AC.deck.position.set(PL.eye[0], PL.eye[1] - 1.16, PL.eye[2] + 15); AC.frame.visible = !PL.bubble;
  SAVE.plane = PL.key; persist();
}
const fi = n => Math.min(n, FLAPS.length - 1);          // flap notch that exists on this aircraft
