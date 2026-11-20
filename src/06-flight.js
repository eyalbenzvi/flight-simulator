'use strict';
// ---------- 10. Flight state & physics ----------
let MASS, SW, CL0, CLA, CD0, KIND, TMAX, ASTALL, GEAR_H, FLAPS;      // set by selectPlane()
const $ = id => document.getElementById(id);
const S = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), pr: 0, rr: 0, yr: 0, thr: 0, n1: 0, gear: true, gearPos: 1, flapIdx: 1, flapDeg: 10,
  brake: false, ap: { on: false, alt: 0, hdg: 0, spd: 0 }, onGround: true, airTime: 0, stalled: false, stallWarn: false, gpws: false, crashed: false, alpha: 0, nLoad: 1,
  cam: 1, tod: 0, dV: 0, vs0: 60, a1g: 0.05, gam: 0, boost: 0, assist: true, holdAlt: null, toClimb: false, land: null, landed: false, prot: '', terr: false, trick: null, shake: 0, smoke: true, paused: false, place: '', mach1: false, pitch: 0, bank: 0, hdg: 0, V: 0, ra: 0, lastSpawn: null, started: false };
const ctl = { pitch: 0, roll: 0, yaw: 0 }, keys = {}, touch = { x: 0, y: 0, on: false };
const fwd = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), F = new THREE.Vector3(), vdir = new THREE.Vector3(), ldir = new THREE.Vector3();
const eul = new THREE.Euler(0, 0, 0, 'YXZ'), dq = new THREE.Quaternion(), XA = new THREE.Vector3(1, 0, 0), YA = new THREE.Vector3(0, 1, 0), ZA = new THREE.Vector3(0, 0, 1);
let TNOW = 0, camSnap = true;

function crash(why) { if (S.crashed) return; S.crashed = true; S.ap.on = false; S.trick = null; S.land = null; Snd.boom(); S.shake = 1.4; S.crashT = 1.7; if (S.cam === 0) { S.camSave = true; S.cam = 1; camSnap = true; } startExplosion(); $('crashWhy').textContent = tr(why); }
let toastT = 0; function toast(msg, dur) { const t = document.getElementById('toast'); t.textContent = msg; t.style.display = 'block'; toastT = dur || 3; }

/** Throttle and pitch for steady flight at speed V on flight-path angle gamma (used when spawning in the air). */
function trimFor(V, alt, gamma, flapDeg, gear) {
  const rho = 1.225 * Math.exp(-alt / 8500), qd = 0.5 * rho * V * V, CL = MASS * G * Math.cos(gamma) / (qd * SW);
  const CD = CD0 + KIND * CL * CL + (gear && !PL.fixedGear ? 0.02 : 0) + 0.0015 * flapDeg, T = qd * SW * CD + MASS * G * Math.sin(gamma);
  return { thr: clamp(T / (TMAX * Math.pow(rho / 1.225, 0.7) * Math.max(0.35, 1 - PL.lapse * V)), 0, 1), alpha: (CL - CL0 - 0.03 * flapDeg) / CLA };
}
function spawn(def) {
  if (!def.keep) S.lastSpawn = def; S.crashed = false; $('crash').style.display = 'none';
  S.pr = S.rr = S.yr = 0; ctl.pitch = ctl.roll = ctl.yaw = 0; S.ap.on = false; S.brake = false; S.stalled = false; S.airTime = 5; camSnap = true;
  S.holdAlt = null; S.toClimb = false; S.land = null; S.landed = false; S.terr = false; S.trick = null; S.shake = 0; S.mach1 = false; S.crashT = 0; EXP.t = -1; for (const p of EXP.parts) p.s.visible = false; if (S.camSave) { S.cam = 0; S.camSave = false; } S.noEngine = !!def.noEngine; S.gamHold = null;
  if (def.type === 'ground') {
    const rw = def.rw; S.pos.set(rw.tx + rw.dx * 130, rw.elev + GEAR_H, rw.tz + rw.dz * 130); S.vel.set(0, 0, 0);
    S.q.setFromEuler(eul.set(0, -rw.hdg * DEG, 0, 'YXZ')); S.thr = S.n1 = 0; S.gear = true; S.gearPos = 1; S.flapIdx = fi(1); S.flapDeg = FLAPS[S.flapIdx]; S.onGround = true; S.airTime = 0;
  } else {
    let x, z, alt, hdg = def.hdg, gamma = 0, V = (def.spd || 120) / 120 * PL.vc; const f = fi(def.flaps || 0), gear = !!def.gear || !!PL.fixedGear;
    if (def.type === 'approach') { const rw = def.rw; x = rw.tx - rw.dx * def.dist; z = rw.tz - rw.dz * def.dist; alt = rw.elev + GEAR_H + (def.dist + 300) * Math.tan(3 * DEG); hdg = rw.hdg; gamma = -3 * DEG;
      V = 1.3 * Math.sqrt(2 * MASS * G / (1.225 * SW * (CL0 + CLA * ASTALL + 0.03 * FLAPS[f]))); }
    else { x = def.x !== undefined ? def.x : lon2x(def.lon); z = def.z !== undefined ? def.z : lat2z(def.lat); alt = def.agl ? groundAt(x, z).h + def.agl : def.alt; }
    const d = dirOf(hdg), tr = trimFor(V, alt, gamma, FLAPS[f], gear);
    alt += def.high || 0; S.pos.set(x, alt, z); S.vel.set(d.x * V * Math.cos(gamma), V * Math.sin(gamma), d.z * V * Math.cos(gamma));
    S.q.setFromEuler(eul.set(gamma + tr.alpha, -hdg * DEG, 0, 'YXZ')); S.thr = S.n1 = tr.thr; S.gear = gear; S.gearPos = gear ? 1 : 0; S.flapIdx = f; S.flapDeg = FLAPS[f]; S.onGround = false;
  }
  S.ra = S.pos.y - groundAt(S.pos.x, S.pos.z).h - GEAR_H; S.V = S.vel.length(); S.gam = 0; S.boost = 0; if (S.noEngine) S.thr = S.n1 = 0;
  S.vs0 = Math.sqrt(2 * MASS * G / (1.225 * Math.exp(-Math.max(S.pos.y, -500) / 8500) * SW * (CL0 + CLA * ASTALL + 0.03 * S.flapDeg)));
  A.sync = true; toast(tr(def.label));
}

function readAttitude() { eul.setFromQuaternion(S.q, 'YXZ'); S.pitch = eul.x; S.bank = -eul.z; S.hdg = ((-eul.y / DEG) % 360 + 360) % 360; }

// --- flight-law helpers shared by Easy mode, the autopilot and autoland ---
/** Stick needed to fly a flight-path angle: pitch = path + 1 g angle of attack + a bounded correction (which also keeps it below the stall). */
function pitchFor(gT) {
  const cb = Math.cos(S.bank), a1 = Math.min(S.a1g / Math.max(cb, 0.2), ASTALL - 0.05), da = clamp(3.0 * (gT - S.gam) / Math.max(cb, 0.3), -0.12, Math.max(0, Math.min(0.24, ASTALL - 0.035 - a1)));
  S.gErr = gT - S.gam; return clamp((S.gam + (a1 + da) * cb - S.pitch) * 1.28 / PL.pitch / Math.max(Math.abs(cb), 0.35), -1, 1);   // loop gain is the same for every aircraft
}
const rollFor = bT => { const e = bT - S.bank; return clamp(Math.atan2(Math.sin(e), Math.cos(e)) * 4.4 / PL.roll, -1, 1); };                          // stick needed to hold a bank angle
const gammaForAlt = alt => Math.asin(clamp(clamp((alt - S.pos.y) * 0.12, -10, 10) / Math.max(S.V, 50), -0.25, 0.25));
/** Runway under the wheels, in the direction the aircraft is facing. */
function runwayUnder() {
  for (const rw of RUNWAYS) {
    const rx = S.pos.x - rw.x, rz = S.pos.z - rw.z, al = rx * rw.dx + rz * rw.dz, cr = rx * -rw.dz + rz * rw.dx;
    if (Math.abs(al) < rw.len / 2 + 60 && Math.abs(cr) < rw.w) { const rev = Math.abs(wrap180(rw.hdg - S.hdg)) > 90; return { rw, hdg: rev ? (rw.hdg + 180) % 360 : rw.hdg, cross: rev ? -cr : cr, fromThr: (rev ? -al : al) + rw.len / 2 }; }
  }
  return null;
}
const centreline = () => { const ru = runwayUnder(); return ru ? clamp(wrap180(ru.hdg - S.hdg) * 0.1 - ru.cross * 0.03, -1, 1) : 0; };

function updateControls(dt) {
  let ud = 0, lr = 0, yt = 0;                                                    // ud: +1 = stick back
  if (keys.KeyW || keys.ArrowUp) ud += 1; if (keys.KeyS || keys.ArrowDown) ud -= 1;      // ud > 0 always means nose up / climb, in both flight modes
  if (keys.KeyD || keys.ArrowRight) lr += 1; if (keys.KeyA || keys.ArrowLeft) lr -= 1;
  if (keys.KeyE) yt += 1; if (keys.KeyQ) yt -= 1;
  if (touch.on) { ud -= touch.y; lr += touch.x; }
  ud = clamp(ud, -1, 1); lr = clamp(lr, -1, 1); if (SAVE.inv) ud = -ud;                    // optional aircraft-stick convention: pull back to climb
  // throttle (reverse thrust becomes available on the ground below idle)
  const tu = keys.ShiftLeft || keys.ShiftRight || keys.Equal || keys.PageUp, td = keys.ControlLeft || keys.ControlRight || keys.Minus || keys.PageDown;
  if (tu) S.thr += 0.45 * dt; if (td) S.thr -= 0.45 * dt;
  S.thr = clamp(S.thr, S.onGround ? -0.35 : 0, 1);
  S.brake = !!(keys.KeyB || keys.Space); S.prot = ''; S.boost = 0;
  const air = !S.onGround, climb = ud;                          // Easy mode: "up" means climb
  let pt = ud, rt = lr;
  if (S.trick) {
    // ---- AEROBATICS: one automatic aileron roll or loop ----
    const tr = S.trick; tr.t += dt; S.boost = 1; yt = 0;
    if (tr.type === 'roll') { rt = tr.dir; pt = 0.04; tr.ang += Math.abs(S.rr) * dt; }
    else { rt = 0; pt = clamp((ASTALL * 0.78 - S.alpha) * 8, 0.12, 1); tr.ang += Math.max(S.pr, 0) * dt; }
    const bad = tr.t > 20 || S.ra < 40;
    if (bad || tr.ang > Math.PI * 2 - (tr.type === 'roll' ? 0.5 : 0.25)) { toast(bad ? 'Manoeuvre cut short' : tr.type === 'roll' ? 'Aileron roll!' : 'Loop!'); if (!bad) Snd.chime(820, 0.25); S.trick = null; S.holdAlt = null; }
  } else if (S.land) {
    // ---- AUTOLAND: follow the ILS, configure, flare, brake to a stop ----
    const rw = S.land; yt = 0;
    if (!air) { S.landPh = 'rollout'; S.thr = 0; S.brake = true; pt = 0; rt = centreline(); if (S.V < 1.5) { S.land = null; S.landed = true; Snd.chime(700, 0.3); toast(L('Landed at ' + AIRPORTS[rw.ap].name + '. Push the power up to take off again', 'נחתנו ב' + apName(AIRPORTS[rw.ap]) + '. כדי להמריא שוב מעלים את ההספק'), 6); } }
    else {
      const il = ilsOf(rw, true);
      if (S.landPh === 'rollout') { S.thr = 0; rt = rollFor(0); pt = clamp((0.03 - S.pitch) * 1.6 / PL.pitch, -1, 1); }     // a bounce after touching down: hold it level and let it settle
      // capture the final approach once lined up inside the approach cone; if blown off it, fly back round to the approach
      else if (S.landPh !== 'final' && il && il.along > 1500 && Math.abs(il.cross) < il.along * 0.15 + 200 && Math.abs(wrap180(rw.hdg - S.hdg)) < 35 && il.gs < 5) S.landPh = 'final';
      if (S.landPh === 'final' && il && il.along > 800 && il.along < 4000 && il.gs > 7 && S.ra > 60) { S.landPh = 'intercept'; S.landJoin = false; }     // far too high close in: go round and come back down the approach
      if (S.landPh === 'final' && !il) { S.landPh = 'intercept'; S.landJoin = false; }
      if (S.landPh === 'rollout') {}
      else if (S.landPh !== 'final') {
        // ---- to the approach. From in front of the runway with room to turn: a localizer intercept, steering for the runway heading
        //      corrected by up to 60° in proportion to the distance off the centreline (the gain keeps the turn within 25° of bank).
        //      From beside or behind it: first fly to an entry point far out on the extended centreline. Height follows the glide path. ----
        const rx = S.pos.x - rw.tx, rz = S.pos.z - rw.tz, along = -(rx * rw.dx + rz * rw.dz), cross = rx * -rw.dz + rz * rw.dx;
        const R = S.V * S.V / (G * Math.tan(25 * DEG)), entry = Math.max(9000, 2.5 * R + 5000);       // R: turn radius at 25° of bank
        if (S.landJoin && (along < 1500 || Math.abs(cross) > along * 1.2)) S.landJoin = false;
        else if (!S.landJoin && along > 2.5 * R + Math.abs(cross) * 0.6 + 2500 + (Math.abs(wrap180(S.hdg - rw.hdg)) > 90 ? 2.5 * R : 0)) S.landJoin = true;     // heading away: room for the turn back
        let hT;
        if (S.landJoin) hT = rw.hdg - clamp(cross / (1.5 * R) * 60, -60, 60);
        else hT = Math.atan2(rw.tx - rw.dx * entry - S.pos.x, -(rw.tz - rw.dz * entry - S.pos.z)) / DEG;
        const bl = !S.landJoin && S.ra < 250 ? 10 : 25; rt = rollFor(clamp(wrap180(hT - S.hdg) * 1.2, -bl, bl) * DEG);     // low down, climb before turning hard
        const gsAlt = rw.elev + GEAR_H + ((S.landJoin ? Math.max(along, 0) : entry) + 300) * Math.tan(3 * DEG);
        const terr = Math.max(groundAt(S.pos.x, S.pos.z).h, groundAt(S.pos.x + S.vel.x * 12, S.pos.z + S.vel.z * 12).h) + (S.landJoin ? clamp(along * 0.025, 40, 180) : 180);     // terrain clearance, less close to the runway
        pt = pitchFor(clamp((Math.max(gsAlt, terr) - S.pos.y) * 0.001, -0.13, 0.09));
        const dT = Math.hypot(rx, rz), vT = S.vs0 * (dT < 20000 ? 1.4 : 1.6); S.thr = clamp(S.thr + ((vT - S.V) * 0.02 - S.dV * 0.3) * dt, 0, 1); S.brake = S.V > vT + 18;
        if (dT < 14000) { S.gear = true; S.flapIdx = Math.max(S.flapIdx, fi(1)); }
      } else {
        if (il.along < 10000) S.gear = true;
        S.flapIdx = Math.max(S.flapIdx, fi(il.along < 5500 ? 3 : il.along < 8000 ? 2 : il.along < 12000 ? 1 : 0));
        const hT = rw.hdg - clamp(il.cross * 0.03, -35, 35); rt = rollFor(clamp(wrap180(hT - S.hdg) * 1.2, -25, 25) * DEG);
        const vT = S.vs0 * 1.3; S.thr = clamp(S.thr + ((vT - S.V) * 0.02 - S.dV * 0.3) * dt, 0, 1); S.brake = S.V > vT + 12;
        if (S.ra < 12) { S.thr = 0; S.brake = false; rt = rollFor(0); pt = clamp((0.07 - S.pitch) * 1.6 / PL.pitch, -1, 1); } else pt = pitchFor(clamp(-3 - il.gs * 1.5, -9, 1) * DEG);     // up to 9° down when high (valley airfields)
      }
    }
  } else if (S.ap.on) {
    // ---- AUTOPILOT: the stick moves the altitude and heading bugs ----
    if (S.onGround || S.stalled) { S.ap.on = false; toast('Autopilot disengaged'); }
    else {
      S.ap.hdg = (S.ap.hdg + lr * 14 * dt + 360) % 360; S.ap.alt += climb * 25 * dt;
      rt = rollFor(clamp(wrap180(S.ap.hdg - S.hdg) * 1.2, -25, 25) * DEG); pt = pitchFor(gammaForAlt(S.ap.alt)); yt = 0;
      S.thr = clamp(S.thr + ((S.ap.spd - S.V) * 0.02 - S.dV * 0.3) * dt, 0, 1);       // autothrottle
    }
  } else if (S.assist && air) {
    // ---- EASY MODE in the air: stick commands bank and climb angle; hands off = wings level, altitude held ----
    rt = rollFor(lr * Math.min(PL.bank, 42 + Math.max(S.ra - 25, 0) * 0.5) * clamp(1 - Math.max((S.gErr || 0) - 0.04, 0) * 5, 0.45, 1) * DEG);      // the bank eases off by itself when the turn starts losing height
    const overField = AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R - 50);
    let gT;
    if (Math.abs(climb) > 0.1) { gT = (climb > 0 ? PL.up : PL.dn) * climb * DEG; S.holdAlt = null; S.toClimb = false; }
    else if (S.toClimb) { gT = 5 * DEG; if (S.ra > 450) S.toClimb = false; }
    else { if (S.holdAlt === null) S.holdAlt = S.pos.y + S.vel.y * 1.5; gT = gammaForAlt(S.holdAlt); }
    if (overField && S.gear) {                                                   // over an airfield with the gear down: automatic flare, idle at touchdown
      if (!S.toClimb && climb <= 0.1) { gT = Math.max(gT, -Math.max(1.2, S.ra * 0.2) / Math.max(S.V, 40)); if (S.ra < 5) S.thr = Math.min(S.thr, 0); if (S.ra < 30) S.holdAlt = null; }
    } else {                                                                     // open country: stay 40 m above the ground and out-climb rising terrain ahead
      const hv = Math.hypot(S.vel.x, S.vel.z) || 1, ux = S.vel.x / hv, uz = S.vel.z / hv, base = S.pos.y - GEAR_H - 25 - S.V * 0.08;
      let gReq = -(S.ra - 25 - S.V * 0.08) * 0.3 / Math.max(S.V, 40);
      const tMax = clamp(330 / PL.up, 11, 40);      // sluggish aircraft look further ahead; races follow gates that already clear the ground
      for (const t of [0.5, 1, 1.5, 2, 3, 4, 5.5, 7, 9, 11, 16, 22, 30, 40]) { if (t > tMax) break; const d = hv * t; gReq = Math.max(gReq, (groundAt(S.pos.x + ux * d, S.pos.z + uz * d).h - base) / d); }
      if (Math.abs(S.bank) > 0.15) { const sg = Math.sign(S.bank);          // in a turn, also look along the curve
        for (const [t, a] of [[1.5, 0.12], [3, 0.25], [6, 0.5], [10, 0.8]]) { const d = hv * t, ca = Math.cos(a * sg), sa = Math.sin(a * sg); gReq = Math.max(gReq, (groundAt(S.pos.x + (ux * ca - uz * sa) * d, S.pos.z + (ux * sa + uz * ca) * d).h - base) / d); } }
      if (gT < gReq) {
        gT = Math.min(gReq, Math.max(14, PL.up) * DEG); if (gReq > 0.03) rt = rollFor(lr * Math.min(PL.bank, 25) * DEG);   /* climbing away from terrain: flatten the turn */ if (Math.abs(climb) <= 0.1) S.holdAlt = null;
        if (gReq > 4 * DEG) { S.boost = 1; S.prot = 'Terrain ahead: climbing'; } else if (climb < -0.1 && S.ra < 90) S.prot = 'Low-altitude protection';
      }
    }
    const vmin = S.vs0 * 1.2;                                                    // stall protection: lower the nose, add power
    if (S.V < vmin && S.ra > 20) { gT = Math.min(gT, 0.02) - (vmin - S.V) * 0.012; S.boost = clamp((vmin + 4 - S.V) * 0.12, 0, 1); if (!S.prot) S.prot = 'Too slow: adding power'; }
    pt = pitchFor(gT);
  } else if (S.assist) {
    // ---- EASY MODE on the ground: centreline keeping, automatic rotation, autobrake after landing ----
    pt = 0; S.holdAlt = null;
    if (Math.abs(lr) < 0.1 && Math.abs(yt) < 0.1 && S.V > 3) rt = centreline();
    if (S.thr > 0.5 && S.V > S.vs0 * 1.12) pt = clamp((PL.rot * DEG - S.pitch) * 1.28 / PL.pitch, 0, 0.6);
    if (S.thr > 0.3) S.landed = false;
    if (S.landed && S.thr < 0.1 && S.V > 1) S.brake = true;
  } else if (air) {
    // ---- EXPERT in the air: the stick commands pitch and roll rate directly, but letting go holds the flight path
    //      (so turns and speed changes do not drop the nose), small banks level themselves, and pull fades near the stall ----
    if (Math.abs(ud) > 0.05) { S.gamHold = null; pt = ud * 0.85; if (pt > 0) pt *= clamp((ASTALL - 0.015 - S.alpha) * 9, 0, 1); }
    else { if (S.gamHold === null) S.gamHold = S.gam; if (!S.stalled) pt = pitchFor(S.gamHold); }
    const free = !!PL.tricks, steep = Math.abs(S.bank) > 1.2;
    if (steep && Math.abs(ud) <= 0.05) pt = 0;                              // path hold only makes sense the right way up
    if (Math.abs(lr) > 0.05) { rt = lr * (free ? 0.85 : 0.5); if (!free && Math.abs(S.bank) > 1.05 && lr * S.bank > 0) rt = 0; }   // airliners stop rolling at 60 degrees
    else rt = Math.abs(S.bank) < 0.14 ? rollFor(0) : 0;
  } else S.gamHold = null;
  const k = (S.assist ? 5 : 3) * dt;
  ctl.pitch += clamp(pt - ctl.pitch, -k, k); ctl.roll += clamp(rt - ctl.roll, -k, k); ctl.yaw += clamp(yt - ctl.yaw, -k, k);
}

function physics(dt) {
  fwd.set(0, 0, -1).applyQuaternion(S.q); up.set(0, 1, 0).applyQuaternion(S.q); right.set(1, 0, 0).applyQuaternion(S.q);
  const V = S.vel.length(), u = S.vel.dot(fwd), w = S.vel.dot(up), sd = S.vel.dot(right);
  let alpha = 0, beta = 0; if (V > 3) { alpha = Math.atan2(-w, Math.max(u, 0.1)); beta = Math.atan2(sd, Math.max(u, 0.1)); }
  S.alpha += (alpha - S.alpha) * Math.min(1, 6 * dt);
  const rho = 1.225 * Math.exp(-Math.max(S.pos.y, -500) / 8500), qd = 0.5 * rho * V * V;
  const flapCL = 0.03 * S.flapDeg, spoil = (S.brake && !S.onGround) ? 1 : 0;
  // --- aerodynamics: lift curve with stall break, parabolic drag polar ---
  let CL = CL0 + CLA * alpha + flapCL; const CLmax = CL0 + CLA * ASTALL + flapCL;
  if (alpha > ASTALL) CL = CLmax * Math.max(0.3, 1 - (alpha - ASTALL) * 3.2);
  CL = Math.max(CL, -1) * (1 - 0.25 * spoil);
  const CD = CD0 + KIND * CL * CL + (PL.fixedGear ? 0 : 0.02) * S.gearPos + 0.0015 * S.flapDeg + 0.06 * spoil + Math.max(0, V - PL.vmo) * 0.0008 + (alpha > ASTALL ? (alpha - ASTALL) * 1.5 : 0);
  const L = qd * SW * CL, D = qd * SW * CD;
  S.stalled = !S.onGround && alpha > ASTALL; S.stallWarn = !S.onGround && S.airTime > 1 && alpha > ASTALL - 0.045;
  S.vs0 = Math.sqrt(2 * MASS * G / (rho * SW * CLmax));
  S.a1g = clamp((MASS * G / Math.max(qd * SW, 1) - CL0 - flapCL) / CLA, -0.05, ASTALL - 0.035); S.gam = V > 5 ? Math.asin(clamp(S.vel.y / V, -1, 1)) : 0;
  F.set(0, -MASS * G, 0);
  if (V > 0.5) { vdir.copy(S.vel).multiplyScalar(1 / V); F.addScaledVector(vdir, -D); ldir.crossVectors(right, vdir).normalize(); F.addScaledVector(ldir, L); F.addScaledVector(right, -qd * SW * 1.2 * beta); }
  // --- thrust: engines spool, thrust lapses with speed and altitude ---
  S.n1 += clamp((S.noEngine ? 0 : S.thr >= 0 ? Math.max(S.thr, S.boost) : S.thr) - S.n1, -0.4 * dt, 0.4 * dt);
  if (S.turb > 0 && !S.onGround) { const tb = S.turb * MASS; F.x += (Math.random() - 0.5) * tb * 5; F.y += (Math.random() - 0.5) * tb * 9; F.z += (Math.random() - 0.5) * tb * 5; S.rr += (Math.random() - 0.5) * S.turb * 0.05; S.pr += (Math.random() - 0.5) * S.turb * 0.015; }   // storm turbulence
  let T = S.n1 * TMAX * Math.pow(rho / 1.225, 0.7) * Math.max(0.35, 1 - PL.lapse * V) * (S.trick && S.trick.type === 'loop' ? 1.6 : 1);
  if (S.n1 < 0 && u < 1) T = 0;
  F.addScaledVector(fwd, T); S.nLoad = L / (MASS * G);
  // --- rotation: rate command scaled by control authority ---
  eul.setFromQuaternion(S.q, 'YXZ'); const theta = eul.x, phi = -eul.z;
  const auth = clamp((V - 0.35 * PL.vs) / (0.75 * PL.vs), 0, 1);
  let prT = ctl.pitch * PL.pitch * auth, rrT = ctl.roll * PL.roll * auth, yrT = ctl.yaw * 0.14 * auth;
  if (!S.onGround) {
    prT -= (1 - clamp((V - 0.28 * PL.vs) / (0.55 * PL.vs), 0, 1)) * 0.28;                                                   // nose drops when slow
    if (S.stalled) { prT = -0.3 + ctl.pitch * 0.08; rrT = rrT * 0.4 + Math.sin(TNOW * 2.3) * 0.15; }
    const om = clamp(S.nLoad, 0, 2.5) * G * Math.sin(phi) / Math.max(V, 40);     // coordinated turn: bank pulls the nose round
    prT += om * Math.sin(phi) * Math.cos(theta); yrT += om * Math.cos(phi) * Math.cos(theta) + beta * 0.9 * auth;
    rrT += ctl.yaw * 0.12 * auth;
  } else {
    yrT = (ctl.yaw + ctl.roll) * 0.45 * clamp(V / 12, 0, 1) * (1 - 0.65 * clamp(V / 80, 0, 1));   // nosewheel steering
    rrT = 0; if (L < MASS * G * 0.9 && ctl.pitch <= 0.05) prT -= 0.12;
  }
  const kk = Math.min(1, 4 * dt); S.pr += (prT - S.pr) * kk; S.rr += (rrT - S.rr) * kk; S.yr += (yrT - S.yr) * kk;
  S.q.multiply(dq.setFromAxisAngle(XA, S.pr * dt)).multiply(dq.setFromAxisAngle(ZA, -S.rr * dt)).multiply(dq.setFromAxisAngle(YA, -S.yr * dt)).normalize();
  // --- integrate ---
  S.vel.addScaledVector(F, dt / MASS);
  if (S.onGround) {
    const side = S.vel.dot(right); S.vel.addScaledVector(right, -side * (1 - Math.exp(-10 * dt)));      // tyres resist sideslip
    const sp = S.vel.length(), dec = (0.015 + (S.brake ? 0.42 : 0)) * G * dt; if (sp > dec) S.vel.multiplyScalar((sp - dec) / sp); else S.vel.set(0, 0, 0);
  }
  S.pos.addScaledVector(S.vel, dt);
  // --- ground contact ---
  const g = groundAt(S.pos.x, S.pos.z), floor = g.h + GEAR_H;
  if (S.pos.y <= floor) {
    const vs = S.vel.y;
    if (g.water) return crash('The aircraft hit the water.');
    if (!S.onGround && S.airTime > 1.5) {
      if (S.gearPos < 0.9) return crash('Touched down with the landing gear up.');
      if (vs < (S.assist || S.land ? -9.5 : -7)) return crash('Hit the ground at ' + Math.round(-vs * 196.85) + ' ft/min.');
      if (!g.field && V > 45) return crash('Flew into terrain.');
      if (Math.abs(phi) > 0.26 || theta < -0.1) return crash('Wing or nose struck the ground.');
      S.landed = true; S.shake = clamp(-vs * 0.12, 0.1, 0.8); toast(landingScore(vs), 5);
    }
    if (!g.field && V > 55) return crash('Left the airfield at speed.');
    S.pos.y = floor; if (S.vel.y < 0) S.vel.y = 0; S.onGround = true; S.airTime = 0;
    eul.setFromQuaternion(S.q, 'YXZ'); eul.z *= Math.exp(-8 * dt); eul.x = clamp(eul.x, 0, PL.rot * DEG + 0.07); S.q.setFromEuler(eul);
  } else { if (S.pos.y > floor + 0.15) { if (S.onGround && S.assist && S.thr > 0.5) S.toClimb = true; S.onGround = false; } if (!S.onGround) S.airTime += dt; }
  S.ra = S.pos.y - floor;
}

function updateSystems(dt) {
  S.gearPos = clamp(S.gearPos + (S.gear ? 1 : -1) * 0.3 * dt, 0, 1);
  const ft = FLAPS[S.flapIdx]; S.flapDeg += clamp(ft - S.flapDeg, -4 * dt, 4 * dt);
  const V = S.vel.length(); S.dV = lerp(S.dV || 0, (V - S.V) / Math.max(dt, 1e-3), 0.1); S.V = V;
  // GPWS: excessive sink near the ground, or rising terrain ahead
  let gp = false, terr = false;
  if (!S.onGround && S.airTime > 3) {
    if (S.ra < 300 && S.vel.y < -Math.max(S.ra / 7, S.gear ? 9 : 5)) gp = true;
    const nearField = S.gear && AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R + 7000);
    if (!nearField) for (const t of [5, 10]) if (groundAt(S.pos.x + S.vel.x * t, S.pos.z + S.vel.z * t).h > S.pos.y + S.vel.y * t - 40) terr = true;
  }
  S.terr = terr; S.gpws = gp || terr;
  // Easy mode: landing gear and flaps look after themselves
  if (S.assist && !S.land && !S.trick) {
    const K = PL.vs / 73;                                   // speed thresholds scale with the aircraft's stall speed
    if (!S.onGround) {
      if (PL.fixedGear) S.gear = true;
      else if (S.gear && S.vel.y > 2 && S.ra > 40 && (V > 92 * K || S.ra > 350)) S.gear = false;
      else if (!S.gear && ((S.ra < 300 && V < 92 * K && S.vel.y < 0.5) || (S.ra < 120 && S.vel.y < -0.5 && AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R + 5000)))) S.gear = true;
      if (S.gear && !PL.fixedGear && !S.toClimb && S.airTime > 8 && S.vel.y < 1) S.flapIdx = Math.max(S.flapIdx, fi(V < 82 * K ? 3 : V < 90 * K ? 2 : V < 100 * K ? 1 : 0));
      else if (!S.gear) { if (V > 105 * K) S.flapIdx = 0; else if (V < 98 * K && S.flapIdx < 1) S.flapIdx = fi(1); }
    } else if (V < 30 * K && !S.landed) S.flapIdx = fi(1);
  }
  if (V > 335 && !S.mach1) { S.mach1 = true; Snd.boom(); S.shake = 0.5; toast('Mach 1! Sonic boom'); } else if (V < 310) S.mach1 = false;
}

// ---------- 11. Cameras ----------
const camPos = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
const CAMS = ['Cockpit', 'Chase', 'Wing'];
function updateCamera(dt) {
  const M = AC.m; AC.root.position.copy(S.pos); AC.root.quaternion.copy(S.q);
  M.g.visible = S.cam !== 0 && !S.crashed; AC.deck.visible = S.cam === 0;
  fwd.set(0, 0, -1).applyQuaternion(S.q);
  if (S.cam === 1) {
    const c = PL.chase; tmpV.copy(S.pos).addScaledVector(fwd, -c[0]); tmpV.y += c[1];
    if (camSnap) { camPos.copy(tmpV); camSnap = false; } else camPos.lerp(tmpV, 1 - Math.exp(-(4.5 + S.V * 0.03) * dt));
    camPos.y = Math.max(camPos.y, groundAt(camPos.x, camPos.z).h + 1.5);
    camera.position.copy(camPos); camera.up.set(0, 1, 0); tmpV2.copy(S.pos).addScaledVector(fwd, c[0] * 0.47); tmpV2.y -= c[2]; camera.lookAt(tmpV2);
  } else {
    const e = S.cam === 0 ? PL.eye : PL.wingEye, eye = tmpV.set(e[0], e[1], e[2]);
    const tgt = S.cam === 0 ? tmpV2.set(e[0], e[1] - 0.21, e[2] - 2) : tmpV2.set(PL.wingTgt[0], PL.wingTgt[1], PL.wingTgt[2]);
    tmpM.lookAt(eye, tgt, YA); tmpQ.setFromRotationMatrix(tmpM);
    camera.quaternion.copy(S.q).multiply(tmpQ); camera.position.copy(eye).applyQuaternion(S.q).add(S.pos);
  }
  // game feel: the view widens with speed and shakes on afterburner, stall buffet and touchdown
  const base = window.innerWidth < window.innerHeight ? 74 : 60, want = base + (S.cam === 1 ? 13 * clamp((S.V - PL.vc * 0.8) / (PL.vmo * 0.6), 0, 1) : 0);
  camera.fov += (want - camera.fov) * Math.min(1, 3 * dt); camera.near = S.cam === 0 ? 0.15 : 1; camera.updateProjectionMatrix();
  S.shake *= Math.exp(-4 * dt);
  const amp = (S.stallWarn ? 0.35 : 0) + (M.burner && S.n1 > 0.9 ? 0.06 : 0) + S.shake;
  if (amp > 0.005 && !S.paused) camera.position.set(camera.position.x + (Math.random() - 0.5) * amp, camera.position.y + (Math.random() - 0.5) * amp, camera.position.z + (Math.random() - 0.5) * amp);
  sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000);
  sun.position.copy(S.pos).addScaledVector(sunDir, 1000); sun.target.position.copy(S.pos); sun.target.updateMatrixWorld();
  // animated parts
  M.elev.forEach(e => e.rotation.x = -ctl.pitch * 0.4); if (M.rud) M.rud.rotation.y = ctl.yaw * 0.45;
  if (M.ail.length) { M.ail[0].rotation.x = ctl.roll * 0.4; M.ail[1].rotation.x = -ctl.roll * 0.4; }
  M.flap.forEach(f => { f.rotation.x = S.flapDeg * DEG; f.position.z = f.userData.z + S.flapDeg * 0.01 * PL.gearH; });
  if (M.gear) { M.gear.visible = S.gearPos > 0.03; M.gear.scale.y = Math.max(0.05, S.gearPos); M.gear.position.y = -0.35 * PL.gearH * (1 - S.gearPos); }
  if (M.beacon) M.beacon.visible = (TNOW % 1.2) < 0.12; const st = (TNOW % 1.5) < 0.07 || ((TNOW + 0.2) % 1.5) < 0.07; M.strobes.forEach(s => s.visible = st);
  if (M.prop) M.prop.rotation.z += (8 + 40 * Math.abs(S.n1)) * dt;
  if (M.burner) { const ab = clamp((S.n1 - 0.85) / 0.15, 0, 1); M.burner.visible = ab > 0.02; M.burner.scale.set(1, 1, ab * (0.85 + Math.random() * 0.3)); M.burner.position.z = 6.7 + 2.75 * M.burner.scale.z; }
  AC.stick.rotation.x = -ctl.pitch * 0.3; AC.stick.rotation.z = -ctl.roll * 0.3; AC.thr.position.z = -15.75 - S.thr * 0.18;
}
