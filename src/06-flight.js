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

function crash(why) { if (S.crashed) return;
  if (navigator.vibrate) navigator.vibrate([150, 60, 250]); document.body.classList.add('crashed'); S.crashed = true; S.ap.on = false; S.trick = null; S.land = null; Snd.boom(); S.shake = 1.4; S.crashT = 1.7; if (S.cam === 0) { S.camSave = true; S.cam = 1; camSnap = true; } startExplosion(); $('crashWhy').textContent = tr(why); }
let toastT = 0; function toast(msg, dur) { const t = document.getElementById('toast'); if (!msg) { t.style.display = 'none'; toastT = 0; return; } t.textContent = msg; t.style.display = 'block'; toastT = dur || 3; }

/** Throttle and pitch for steady flight at speed V on flight-path angle gamma (used when spawning in the air). */
function trimFor(V, alt, gamma, flapDeg, gear) {
  const rho = isa(alt).rho, qd = 0.5 * rho * V * V; let CL = MASS * G * Math.cos(gamma) / (qd * SW), CD = 0, T = 0;
  for (let i = 0; i < 4; i++) {          // thrust is tilted up by the angle of attack: it carries part of the weight and only its cosine pushes (it matters for the fighter on approach)
    const al = (CL - CL0 - 0.03 * flapDeg) / CLA; CD = CD0 + KIND * CL * CL + (gear && !PL.fixedGear ? 0.02 : 0) + 0.0015 * flapDeg; T = (qd * SW * CD + MASS * G * Math.sin(gamma)) / Math.max(Math.cos(al), 0.5);
    CL = (MASS * G * Math.cos(gamma) - T * Math.sin(al)) / (qd * SW); }
  return { thr: clamp(T / (TMAX * Math.pow(rho / 1.225, PL.rhoExp || 0.7) * clamp(1 - PL.lapse * V, 0.35, 1.2)), 0, 1), alpha: (CL - CL0 - 0.03 * flapDeg) / CLA };
}
function spawn(def) {
  S.spawnT = TNOW; S.landSeen = false; if (!def.keep) S.lastSpawn = def; document.body.classList.remove('crashed'); S.crashed = false; $('crash').style.display = 'none';
  S.pr = S.rr = S.yr = 0; ctl.pitch = ctl.roll = ctl.yaw = 0; S.ap.on = false; S.brake = false; S.stalled = false; S.airTime = 5; camSnap = true;
  S.holdAlt = null; S.toClimb = false; S.land = null; S.landed = false; S.terr = false; S.trick = null; S.shake = 0; S.mach1 = false; S.crashT = 0; EXP.t = -1; for (const p of EXP.parts) p.s.visible = false; if (EXP.deb) { EXP.deb.visible = false; EXP.flash.visible = false; } if (S.camSave) { S.cam = 0; S.camSave = false; } S.noEngine = !!def.noEngine; S.gamHold = null;
  if (def.type === 'ground') {
    const rw = def.rw, sg = def.rev ? -1 : 1, h = def.rev ? (rw.hdg + 180) % 360 : rw.hdg;     // rev: take off from the far end, the other way
    const ex = def.rev ? rw.x + rw.dx * rw.len / 2 : rw.tx, ez = def.rev ? rw.z + rw.dz * rw.len / 2 : rw.tz;
    S.pos.set(ex + rw.dx * 130 * sg, rw.elev + GEAR_H, ez + rw.dz * 130 * sg); S.vel.set(0, 0, 0);
    S.q.setFromEuler(eul.set(0, -h * DEG, 0, 'YXZ')); S.thr = S.n1 = 0; S.gear = true; S.gearPos = 1; S.flapIdx = fi(1); S.flapDeg = FLAPS[S.flapIdx]; S.onGround = true; S.airTime = 0;
  } else {
    let x, z, alt, hdg = def.hdg, gamma = 0, V = (def.spd || 120) / 120 * PL.vc; const f = fi(def.flaps || 0), gear = !!def.gear || !!PL.fixedGear;
    if (def.type === 'approach') { const rw = def.rw; x = rw.tx - rw.dx * def.dist; z = rw.tz - rw.dz * def.dist; alt = rw.elev + GEAR_H + gsHeight(def.dist + 300); hdg = rw.hdg; gamma = -3 * DEG;
      V = 1.3 * Math.sqrt(2 * MASS * G / (1.225 * SW * (CL0 + CLA * ASTALL + 0.03 * FLAPS[f]))); }
    else { x = def.x !== undefined ? def.x : lon2x(def.lon); z = def.z !== undefined ? def.z : lat2z(def.lat); alt = def.agl ? groundAt(x, z).h + def.agl : def.alt; }
    const d = dirOf(hdg), tr = trimFor(V, alt, gamma, FLAPS[f], gear);
    alt += def.high || 0; S.pos.set(x, alt, z); S.vel.set(d.x * V * Math.cos(gamma), V * Math.sin(gamma), d.z * V * Math.cos(gamma));
    S.q.setFromEuler(eul.set(gamma + tr.alpha, -hdg * DEG, 0, 'YXZ')); S.thr = S.n1 = tr.thr; S.gear = gear; S.gearPos = gear ? 1 : 0; S.flapIdx = f; S.flapDeg = FLAPS[f]; S.onGround = false;
  }
  S.ra = S.pos.y - groundAt(S.pos.x, S.pos.z).h - GEAR_H; S.V = S.vel.length(); S.gam = S.V > 5 ? Math.asin(clamp(S.vel.y / S.V, -1, 1)) : 0; S.gamHold = null; S.boost = 0;          /* the flight path it starts on is the one Expert holds hands-off (it used to hold level, on descent power) */ if (S.noEngine) S.thr = S.n1 = 0;
  S.vs0 = Math.sqrt(2 * MASS * G / (isa(S.pos.y).rho * SW * (CL0 + CLA * ASTALL + 0.03 * S.flapDeg)));
  A.sync = true; toast(def.pick ? '📍 ' + L(def.name[0], def.name[1]) : def.type === 'approach' ? L('Approach: ', 'גישה: ') + tr(def.label.replace('Approach: ', '')) : tr(def.label));
}

function readAttitude() { eul.setFromQuaternion(S.q, 'YXZ'); S.pitch = eul.x; S.bank = -eul.z; S.hdg = ((-eul.y / DEG) % 360 + 360) % 360; }

// --- flight-law helpers shared by Easy mode, the autopilot and autoland ---
/** Stick needed to fly a flight-path angle: pitch = path + 1 g angle of attack + a bounded correction (which also keeps it below the stall). */
function pitchFor(gT, unload) {            // unload: too slow, so the nose may come all the way down to the flight path (a fighter on full afterburner otherwise hangs on its thrust)
  const cb = Math.cos(S.bank), a1 = Math.min(S.a1g / Math.max(cb, 0.2), ASTALL - 0.05), da = clamp(3.0 * (gT - S.gam) / Math.max(cb, 0.3), unload ? -(a1 + 0.05) : -0.12, Math.max(0, Math.min(0.24, ASTALL - 0.035 - a1)));
  S.gErr = gT - S.gam; return clamp((S.gam + (a1 + da) * cb - S.pitch) * 1.28 / PL.pitch / Math.max(Math.abs(cb), 0.35), -1, 1);   // loop gain is the same for every aircraft
}
const rollFor = bT => { const e = bT - S.bank; return clamp(Math.atan2(Math.sin(e), Math.cos(e)) * 4.4 / PL.roll, -1, 1); };                          // stick needed to hold a bank angle
const gammaForAlt = alt => Math.asin(clamp(clamp((alt - S.pos.y) * 0.12, -10, 10) / Math.max(S.V, 50), -0.25, 0.25));
/** Runway under the wheels, in the direction the aircraft is facing. */
function runwayUnder() {
  let best = null;                           // where runways cross or lie side by side: the one the aircraft is lined up with, nearest its centreline
  for (const rw of RUNWAYS) {
    const rx = S.pos.x - rw.x, rz = S.pos.z - rw.z, al = rx * rw.dx + rz * rw.dz, cr = rx * -rw.dz + rz * rw.dx;
    if (Math.abs(al) < rw.len / 2 + 60 && Math.abs(cr) < rw.w) { const rev = Math.abs(wrap180(rw.hdg - S.hdg)) > 90, off = Math.abs(wrap180((rev ? rw.hdg + 180 : rw.hdg) - S.hdg)), sc = Math.abs(cr) + (off > 30 ? 1000 : 0);
      if (!best || sc < best.sc) best = { sc, rw, hdg: rev ? (rw.hdg + 180) % 360 : rw.hdg, cross: rev ? -cr : cr, fromThr: (rev ? -al : al) + rw.len / 2 }; }
  }
  return best;
}
const centreline = () => { const ru = runwayUnder(); return ru ? clamp(wrap180(ru.hdg - S.hdg) * 0.1 - ru.cross * 0.03, -1, 1) : 0; };

function updateControls(dt) {
  let ud = 0, lr = 0, yt = 0;                                                    // ud: +1 = stick back
  if (keys.KeyW || keys.ArrowUp) ud += 1; if (keys.KeyS || keys.ArrowDown) ud -= 1;      // ud > 0 always means nose up / climb, in both flight modes
  if (keys.KeyD || keys.ArrowRight) lr += 1; if (keys.KeyA || keys.ArrowLeft) lr -= 1;
  if (keys.KeyE) yt += 1; if (keys.KeyQ) yt -= 1;
  if (touch.on) { ud -= touch.y; lr += touch.x; } if (PAD.on) { ud -= PAD.y; lr += PAD.x; }
  ud = clamp(ud, -1, 1); lr = clamp(lr, -1, 1); if (SAVE.inv) ud = -ud;                    // optional aircraft-stick convention: pull back to climb
  // throttle (reverse thrust becomes available on the ground below idle)
  const tu = keys.ShiftLeft || keys.ShiftRight || keys.Equal || keys.PageUp, td = keys.ControlLeft || keys.ControlRight || keys.Minus || keys.PageDown;
  if (tu) S.thr += 0.45 * dt; if (td) S.thr -= 0.45 * dt;
  S.thr = clamp(S.thr, S.onGround && !PL.tricks ? -0.35 : 0, 1);          // reverse thrust: the two transports only
  S.brake = !!(keys.KeyB || keys.Space || PAD.brk); S.prot = ''; S.boost = 0;
  const air = !S.onGround, climb = ud;                          // Easy mode: "up" means climb
  let pt = ud, rt = lr;
  if (S.trick) {
    // ---- AEROBATICS: one automatic aileron roll or loop ----
    const tr = S.trick; tr.t += dt; S.boost = 1; yt = 0;
    const rollOut = tr.type === 'roll' && tr.ang > Math.PI * 2 - 1.2;          // the last part of a roll: back to wings level, and only then done
    if (tr.type === 'roll') { rt = rollOut ? rollFor(0) : tr.dir; pt = 0.04; tr.ang += Math.abs(S.rr) * dt; }
    else { rt = 0; pt = clamp((ASTALL * 0.78 - S.alpha) * 8, 0.12, 1); tr.ang += Math.max(S.pr, 0) * dt; }
    const bad = tr.t > 45 || S.ra < 40;
    if (bad || (tr.type === 'roll' ? rollOut && Math.abs(S.bank) < 0.1 && Math.abs(S.rr) < 0.35 : tr.ang > Math.PI * 2 - 0.25)) { S.gamHold = tr.type === 'roll' ? 0 : null; toast(bad ? L('Manoeuvre cut short', 'התרגיל הופסק') : tr.type === 'roll' ? L('Aileron roll!', 'גלגול!') : L('Loop!', 'לולאה!')); if (!bad) Snd.chime(820, 0.25); S.trick = null; S.holdAlt = null; }
  } else if (S.land) {
    // ---- AUTOLAND: follow the ILS, configure, flare, brake to a stop ----
    const rw = S.land; yt = 0;
    if (!air) { S.landPh = 'rollout'; S.thr = 0; S.brake = true; pt = 0; rt = centreline(); if (S.V < 1.5) { S.land = null; S.landed = true; Snd.chime(700, 0.3); toast(L('Landed at ' + AIRPORTS[rw.ap].name + '. Push the power up to take off again', 'נחתנו ב' + apName(AIRPORTS[rw.ap]) + '. כדי להמריא שוב מעלים את ההספק'), 6); } }
    else {
      const il = ilsOf(rw, true);
      if (S.landPh === 'rollout') { S.thr = 0; rt = rollFor(0); pt = clamp((0.03 - S.pitch) * 1.6 / PL.pitch, -1, 1); }     // a bounce after touching down: hold it level and let it settle
      // capture the final approach once lined up inside the approach cone; if blown off it, fly back round to the approach
      else if (S.landPh !== 'final' && il && il.along > 400 && Math.abs(il.cross) < (il.along * 0.1 + 80) * clamp(Math.pow(68 / Math.max(S.V, 1), 2), 0.3, 1) && Math.abs(wrap180(rw.hdg - S.hdg)) < 35 && il.gs < 5) S.landPh = 'final';          /* a fast approach (no flaps: Concorde, the stealth jet) has less time to close on the centreline, so it must be nearer to it when the final begins */
      // close in and far too high, too fast, or not over the runway: go round and come back down the approach (and give up after a few tries rather than circle for ever)
      if (S.landPh === 'final' && il && S.ra > 25 && ((il.along > 300 && il.along < 1600 && (il.gs > 7 || (il.along < 500 && S.V > 1.7 * S.vs0))) || (il.along > 60 && il.along < 350 && Math.abs(il.cross) > Math.max(rw.w * 0.5, 18)))) {
        S.landPh = 'intercept'; S.landJoin = false; S.landTries = (S.landTries || 0) + 1;
        if (S.landTries > 3) { S.land = null; S.landTries = 0; toast(L('Could not line up with the runway. Fly farther out and press Land again', 'לא הצלחנו להתיישר מול המסלול. מתרחקים ולוחצים שוב על נחיתה'), 6); return; }
        toast(L('Going around for another approach', 'הולכים סביב לגישה נוספת'), 4); }
      if (S.landPh === 'final' && !il) { S.landPh = 'intercept'; S.landJoin = false; }
      if (S.landPh === 'rollout') {}
      else if (S.landPh !== 'final') {
        // ---- to the approach. From in front of the runway with room to turn: a localizer intercept, steering for the runway heading
        //      corrected by up to 60° in proportion to the distance off the centreline (the gain keeps the turn within 25° of bank).
        //      From beside or behind it: first fly to an entry point far out on the extended centreline. Height follows the glide path. ----
        const rx = S.pos.x - rw.tx, rz = S.pos.z - rw.tz, along = -(rx * rw.dx + rz * rw.dz), cross = rx * -rw.dz + rz * rw.dx;
        const R = S.V * S.V / (G * Math.tan(25 * DEG)) * hsAt(S.ra), entry = Math.max(gsDist(420), 4 * R + 1500);       // R: turn radius at 25° of bank, on the map
        if (realDist(rx, rz) < 20000) S.landT = (S.landT || 0) + dt;                  // time spent manoeuvring near the field
        if (S.landJoin && (along < 1500 || Math.abs(cross) > along * 1.2)) { S.landJoin = false; S.landTries = (S.landTries || 0) + 0.5; }
        if (S.landTries > 3 || S.landT > 600) { S.land = null; S.landTries = 0; S.landT = 0; S.holdAlt = null; toast(L('Could not line up with the runway. Fly farther out and press Land again', 'לא הצלחנו להתיישר מול המסלול. מתרחקים ולוחצים שוב על נחיתה'), 6); return; }       // rather than circle for ever
        else if (!S.landJoin && along > 2.5 * R + Math.abs(cross) * 0.6 + 800 + (Math.abs(wrap180(S.hdg - rw.hdg)) > 90 ? 2.5 * R : 0)) S.landJoin = true;     // heading away: room for the turn back
        if (rw.obMax === undefined) { rw.obMax = -Infinity; for (let ox = -1800; ox <= 1800; ox += 128) for (let oz = -1800; oz <= 1800; oz += 128) rw.obMax = Math.max(rw.obMax, obstacleTop(rw.tx + ox, rw.tz + oz)); }      // the tallest thing around the field (at Masada, the rock): manoeuvring near the field stays above it
        const rock = !S.landJoin && rw.obMax > rw.elev + 150 && Math.hypot(rx, rz) < 2600 && rw.obMax + 70 - S.pos.y > 20;       // low beside a tall rock: climb straight out along the runway before turning
        let hT;
        if (S.landJoin) hT = rw.hdg - clamp(cross / (1.5 * R) * 60, -60, 60);
        else hT = Math.atan2(rw.tx - rw.dx * entry - S.pos.x, -(rw.tz - rw.dz * entry - S.pos.z)) / DEG;
        if (rock && Math.abs(wrap180(rw.hdg - S.hdg)) < 100) hT = rw.hdg;
        const bl = !S.landJoin && S.ra < 250 ? 10 : 25; rt = rollFor(clamp(wrap180(hT - S.hdg) * 1.2, -bl, bl) * DEG);     // low down, climb before turning hard
        const gsAlt = rw.elev + GEAR_H + gsHeight((S.landJoin ? Math.max(along, 0) : entry) + 300);
        const terr = Math.max(groundAt(S.pos.x, S.pos.z).h, groundAt(S.pos.x + S.vel.x * 12 * hsAt(S.ra), S.pos.z + S.vel.z * 12 * hsAt(S.ra)).h) + (S.landJoin ? clamp(along * 0.06, 40, 180) : 180);     // terrain clearance, less close to the runway
        const hsN = hsAt(S.ra), obT = Math.max(!S.landJoin && rw.obMax > rw.elev + 150 && Math.hypot(rx, rz) < 2600 ? rw.obMax : -Infinity, obstacleTop(S.pos.x, S.pos.z), obstacleTop(S.pos.x + S.vel.x * 6 * hsN, S.pos.z + S.vel.z * 6 * hsN), obstacleTop(S.pos.x + S.vel.x * 12 * hsN, S.pos.z + S.vel.z * 12 * hsN), obstacleTop(S.pos.x + S.vel.x * 22 * hsN, S.pos.z + S.vel.z * 22 * hsN), obstacleTop(S.pos.x + S.vel.x * 36 * hsN, S.pos.z + S.vel.z * 36 * hsN)) + 70;       // and clear of buildings and the Masada rock
        const low = Math.max(terr, S.landJoin && along > 0 && along < 600 ? -1e9 : obT) - S.pos.y > 20;                       // below the safe height: full power and a steep climb come before speed and turning
        pt = pitchFor(clamp((Math.max(gsAlt, terr, S.landJoin && along > 0 && along < 600 ? -1e9 : obT) - S.pos.y) * 0.001, -0.13, low ? 0.2 : 0.09));
        const dT = realDist(rx, rz), vT = S.vs0 * (dT < 25000 ? 1.4 : 1.6); S.thr = low ? 1 : clamp(S.thr + ((vT - S.V) * 0.02 - S.dV * 0.3) * dt, 0, 1); S.brake = !low && S.V > vT + 18; if (low) S.boost = 1;
        if (dT < 15000) { S.gear = true; S.flapIdx = Math.max(S.flapIdx, fi(1)); }
      } else {
        const hR = S.pos.y - GEAR_H - rw.elev; if (hR < 700) S.gear = true;     // configure by height on the glide path
        S.flapIdx = Math.max(S.flapIdx, fi(hR < 230 ? 3 : hR < 400 ? 2 : hR < 650 ? 1 : 0));
        // localizer: the intercept angle grows with the distance off the centreline; the gain allows for the map scale (ground speed across the map is hsAt of the airspeed)
        const hs = hsAt(S.ra), xr = (S.vel.x * -rw.dz + S.vel.z * rw.dx) * hs, hT = rw.hdg - clamp(il.cross * 0.07 / hs + xr * 0.25, -30, 30); rt = rollFor(clamp(wrap180(hT - S.hdg) * 1.2, -25, 25) * DEG);
        const vT = S.vs0 * 1.3; S.thr = clamp(S.thr + ((vT - S.V) * 0.02 - S.dV * 0.3) * dt, 0, 1); S.brake = S.V > vT * 1.1;
        if (S.ra < 12) { if (S.ra < 6) S.thr = 0; S.brake = false; rt = rollFor(clamp(wrap180(hT - S.hdg) * 1.2, -4, 4) * DEG); pt = pitchFor(-Math.max(0.6, S.ra * 0.25) / Math.max(S.V, 40)); } else pt = pitchFor     /* flare on the flight path: sink 3 m/s at 12 m easing to 0.6 */(clamp(-3 - il.gs * 1.5, -9, 1) * DEG);     // up to 9° down when high (valley airfields)
      }
    }
  } else if (S.ap.on) {
    // ---- AUTOPILOT: the stick moves the altitude and heading bugs ----
    if (S.onGround || S.stalled) { S.ap.on = false; toast(L('Autopilot disengaged', 'הטייס האוטומטי התנתק')); }
    else {
      S.ap.hdg = (S.ap.hdg + lr * 14 * dt + 360) % 360; S.ap.alt += climb * 25 * dt;
      rt = rollFor(clamp(wrap180(S.ap.hdg - S.hdg) * 1.2, -25, 25) * DEG); pt = pitchFor(gammaForAlt(S.ap.alt)); yt = 0;
      if (tu || td) S.ap.spd = clamp(S.ap.spd + (tu ? 5 : -5) * dt, S.vs0 * 1.3, PL.vmo * (PL.sonic ? 1.4 : 1));       // the power keys move the speed the autopilot holds
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
      const hv0 = Math.hypot(S.vel.x, S.vel.z) || 1, hv = hv0 * hsAt(S.ra), ux = S.vel.x / hv0, uz = S.vel.z / hv0, base = S.pos.y - GEAR_H - 25 - S.V * 0.08;
      let gReq = -(S.ra - 25 - S.V * 0.08) * 0.3 / Math.max(S.V, 40);
      const tMax = clamp(330 / PL.up, 11, 40);      // sluggish aircraft look further ahead; races follow gates that already clear the ground
      for (const t of [0.5, 1, 1.5, 2, 3, 4, 5.5, 7, 9, 11, 16, 22, 30, 40]) { if (t > tMax) break; const d = hv * t; gReq = Math.max(gReq, (Math.max(groundAt(S.pos.x + ux * d, S.pos.z + uz * d).h, t <= 16 ? obstacleTop(S.pos.x + ux * d, S.pos.z + uz * d) : -1e9) - base) / d); }       // towers count as ground ahead
      if (Math.abs(S.bank) > 0.15) { const sg = Math.sign(S.bank);          // in a turn, also look along the curve
        for (const [t, a] of [[1.5, 0.12], [3, 0.25], [6, 0.5], [10, 0.8]]) { const d = hv * t, ca = Math.cos(a * sg), sa = Math.sin(a * sg); gReq = Math.max(gReq, (groundAt(S.pos.x + (ux * ca - uz * sa) * d, S.pos.z + (ux * sa + uz * ca) * d).h - base) / d); } }
      if (gT < gReq) {
        gT = Math.min(gReq, Math.max(14, PL.up) * DEG); if (gReq > 0.03) rt = rollFor(lr * Math.min(PL.bank, 25) * DEG);   /* climbing away from terrain: flatten the turn */ if (Math.abs(climb) <= 0.1) S.holdAlt = null;
        if (gReq > 4 * DEG && S.thr >= 0.08) { S.boost = 1; S.prot = L('Terrain ahead: climbing', 'קרקע לפנים: מטפסים'); } else if (climb < -0.1 && S.ra < 90) S.prot = L('Height protection: this level lands at airports only (L lands for you)', 'הגנת גובה: ברמה הזו נוחתים רק בשדה תעופה (L נוחת בשבילכם)');
      }
    }
    const vmin = S.vs0 * 1.2, idle = S.thr < 0.08;                               // stall protection: lower the nose, add power
    // the power lever closed means no power: the protection does not open the engines behind the pilot's back. The aircraft keeps its speed by gliding down
    if (idle && S.V < vmin + 6) { S.holdAlt = null; gT = Math.min(gT, -0.035 - Math.max(vmin + 3 - S.V, 0) * 0.014); S.boost = 0; S.prot = L('Power is off: gliding down. Raise the power to fly on', 'ההספק סגור: המטוס גולש למטה. מעלים הספק כדי להמשיך לטוס'); }
    else if (S.V < vmin && S.ra > 20) { gT = Math.min(gT, 0.02) - (vmin - S.V) * 0.012; S.boost = clamp((vmin + 4 - S.V) * 0.12, 0, 1); if (!S.prot) S.prot = L('Too slow: adding power', 'איטי מדי: מוסיפים הספק'); }
    pt = pitchFor(gT, S.V < vmin && S.ra > 20);
  } else if (S.assist) {
    // ---- EASY MODE on the ground: centreline keeping, automatic rotation, autobrake after landing ----
    pt = 0; S.holdAlt = null;
    if (Math.abs(lr) < 0.1 && Math.abs(yt) < 0.1 && S.V > 3) rt = centreline();
    if (S.thr > 0.5 && S.V > S.vs0 * 1.12) pt = clamp((PL.rot * DEG - S.pitch) * 1.28 / PL.pitch, 0, 0.6);
    if (S.thr > 0.3) S.landed = false;
    if (S.thr < 0.1 && (S.landed ? S.V > 1 : S.thr < 0.05 && S.V > 8)) S.brake = true;          // after landing, and when a take-off is abandoned (power back to idle)
  } else if (air) {
    // ---- EXPERT in the air: the stick commands pitch and roll rate directly, but letting go holds the flight path
    //      (so turns and speed changes do not drop the nose), small banks level themselves, and pull fades near the stall ----
    if (Math.abs(ud) > 0.05) { S.gamHold = null; pt = ud * 0.85; if (pt > 0) pt *= clamp((ASTALL - 0.015 - S.alpha) * 9, 0, 1);
      if (!PL.tricks) pt *= pt > 0 ? clamp((30 * DEG - S.pitch) / (8 * DEG), 0, 1) : clamp((S.pitch + 20 * DEG) / (8 * DEG), 0, 1); }       // the airliner and the business jet stay within 30° nose up and 20° nose down
    else { if (S.gamHold === null) S.gamHold = S.gam; if (!S.stalled) pt = pitchFor(S.gamHold); }
    const free = !!PL.tricks, steep = Math.abs(S.bank) > 1.2;
    if (steep && Math.abs(ud) <= 0.05) pt = 0;                              // path hold only makes sense the right way up
    if (Math.abs(lr) > 0.05) { rt = lr * (free ? 0.85 : 0.5); if (!free && Math.abs(S.bank) > 1.05 && lr * S.bank > 0) rt = 0; }   // airliners stop rolling at 60 degrees
    else rt = Math.abs(S.bank) < 0.14 ? rollFor(0) : 0;
  } else S.gamHold = null;
  const k = (S.assist ? 5 : 3) * dt;
  ctl.pitch += clamp(pt - ctl.pitch, -k, k); ctl.roll += clamp(rt - ctl.roll, -k, k); ctl.yaw += clamp(yt - ctl.yaw, -k, k);
}

/** Compressibility: past the drag-rise Mach a subsonic jet meets a steep wall; a supersonic type a transonic hump that eases past Mach 1.2. */
function waveDrag(M) {
  const mc = PL.mcr || 0.8; if (M <= mc) return 0;
  if (!PL.sonic) return 2.4 * (M - mc) * (M - mc) + 0.4 * Math.max(0, M - mc - 0.08) ** 2 * 10;
  return (PL.wave || 0.032) * Math.min(1, (M - mc) / 0.15) * (M > 1.2 ? 1.2 / M : 1) + (PL.mmo ? Math.max(0, M - PL.mmo) * 0.25 : 0);
}
function physics(dt) {
  fwd.set(0, 0, -1).applyQuaternion(S.q); up.set(0, 1, 0).applyQuaternion(S.q); right.set(1, 0, 0).applyQuaternion(S.q);
  const V = S.vel.length(), u = S.vel.dot(fwd), w = S.vel.dot(up), sd = S.vel.dot(right);
  let alpha = 0, beta = 0; if (V > 3) { alpha = Math.atan2(-w, Math.max(u, 0.1)); beta = Math.atan2(sd, Math.max(u, 0.1)); }
  S.alpha += (alpha - S.alpha) * Math.min(1, 6 * dt);
  const atm = isa(S.pos.y), rho = atm.rho, qd = 0.5 * rho * V * V, mach = V / atm.a, eas = V * Math.sqrt(rho / 1.225); S.mach = mach;
  const flapCL = 0.03 * S.flapDeg, spoil = (S.brake && !S.onGround) ? 1 : 0;
  // --- aerodynamics: lift curve with stall break, parabolic drag polar ---
  let CL = CL0 + CLA * alpha + flapCL; const CLmax = CL0 + CLA * ASTALL + flapCL;
  if (alpha > ASTALL) CL = CLmax * Math.max(0.3, 1 - (alpha - ASTALL) * 3.2);
  CL = Math.max(CL, -1) * (1 - 0.25 * spoil);
  const CD = CD0 + KIND * CL * CL + (PL.fixedGear ? 0 : 0.02) * S.gearPos + 0.0015 * S.flapDeg + 0.06 * spoil + Math.max(0, eas - PL.vmo) * 0.0008 + waveDrag(mach) + (alpha > ASTALL ? (alpha - ASTALL) * 1.5 : 0);
  const Lf = qd * SW * CL, Df = qd * SW * CD;          // not L and D: L is the translation function, and shadowing it broke the hard-landing message
  S.stalled = !S.onGround && alpha > ASTALL; S.stallWarn = !S.onGround && S.airTime > 1 && alpha > ASTALL - 0.045;
  S.vs0 = Math.sqrt(2 * MASS * G / (rho * SW * CLmax));
  S.a1g = clamp((MASS * G / Math.max(qd * SW, 1) - CL0 - flapCL) / CLA, -0.05, ASTALL - 0.035); S.gam = V > 5 ? Math.asin(clamp(S.vel.y / V, -1, 1)) : 0;
  F.set(0, -MASS * G, 0);
  if (V > 0.5) { vdir.copy(S.vel).multiplyScalar(1 / V); F.addScaledVector(vdir, -Df); ldir.crossVectors(right, vdir).normalize(); F.addScaledVector(ldir, Lf); F.addScaledVector(right, -qd * SW * 1.2 * beta); }
  // --- thrust: engines spool, thrust lapses with speed and altitude ---
  { const sp = PL.spool || 0.4; S.n1 += clamp((S.noEngine ? 0 : S.thr >= 0 ? Math.max(S.thr, S.boost) : S.thr) - S.n1, -sp * dt, sp * dt); }     // engines take seconds to spool
  if (S.turb > 0 && !S.onGround) { const tb = S.turb * MASS; F.x += (Math.random() - 0.5) * tb * 5; F.y += (Math.random() - 0.5) * tb * 9; F.z += (Math.random() - 0.5) * tb * 5; S.rr += (Math.random() - 0.5) * S.turb * 0.05; S.pr += (Math.random() - 0.5) * S.turb * 0.015; }   // storm turbulence
  let T = S.n1 * TMAX * Math.pow(rho / 1.225, PL.rhoExp || 0.7) * clamp(1 - PL.lapse * V, 0.35, 1.2) * (S.trick && S.trick.type === 'loop' ? 1.6 : 1);
  if (S.n1 < 0 && u < 1) T = 0;
  F.addScaledVector(fwd, T); S.nLoad = Lf / (MASS * G);
  // --- rotation: rate command scaled by control authority ---
  eul.setFromQuaternion(S.q, 'YXZ'); const theta = eul.x, phi = -eul.z;
  const auth = clamp((V - 0.35 * PL.vs) / (0.75 * PL.vs), 0, 1);
  let prT = ctl.pitch * PL.pitch * auth, rrT = ctl.roll * PL.roll * auth, yrT = ctl.yaw * 0.14 * auth;
  if (!S.onGround) {
    prT -= (1 - clamp((V - 0.28 * PL.vs) / (0.55 * PL.vs), 0, 1)) * 0.28;                                                   // nose drops when slow
    if (S.stalled) { prT = -0.3 + ctl.pitch * 0.08; rrT = rrT * 0.4 + Math.sin(TNOW * 2.3) * 0.15; }
    else if (PL.nmax && prT > 0) {                                                // load-factor limit: no pull beyond the structural g
      const aN = (PL.nmax * MASS * G / Math.max(qd * SW, 1) - CL0 - flapCL) / CLA; if (S.alpha > aN - 0.02) prT = Math.min(prT, Math.max(0, (aN - S.alpha) * 6));
      prT = Math.min(prT, Math.max(0, (PL.nmax - S.nLoad) * G / Math.max(V, 40) * 2.5)); }          // and on the load itself: the angle of attack is filtered and lags a hard pull
    else if (prT < 0 && !S.stalled) prT = Math.max(prT, Math.min(0, ((PL.tricks ? (PL.key === 'stunt' ? -6 : -3) : -1) - S.nLoad) * G / Math.max(V, 40) * 2.5));      // negative g limit
    const om = clamp(S.nLoad, 0, 2.5) * G * Math.sin(phi) / Math.max(V, 40);     // coordinated turn: bank pulls the nose round
    prT += om * Math.sin(phi) * Math.cos(theta); yrT += om * Math.cos(phi) * Math.cos(theta) + beta * 0.9 * auth;
    rrT += ctl.yaw * 0.12 * auth;
  } else {
    yrT = (ctl.yaw + ctl.roll) * 0.45 * clamp(V / 12, 0, 1) * (1 - 0.65 * clamp(V / 80, 0, 1));   // nosewheel steering
    rrT = 0; if (Lf < MASS * G * 0.9 && ctl.pitch <= 0.05) prT -= 0.12;
  }
  const kk = Math.min(1, 4 * dt); S.pr += (prT - S.pr) * kk; S.rr += (rrT - S.rr) * kk; S.yr += (yrT - S.yr) * kk;
  S.q.multiply(dq.setFromAxisAngle(XA, S.pr * dt)).multiply(dq.setFromAxisAngle(ZA, -S.rr * dt)).multiply(dq.setFromAxisAngle(YA, -S.yr * dt)).normalize();
  // --- integrate ---
  S.vel.addScaledVector(F, dt / MASS);
  if (S.onGround) {
    const side = S.vel.dot(right); S.vel.addScaledVector(right, -side * (1 - Math.exp(-10 * dt)));      // tyres resist sideslip
    const sp = S.vel.length(), dec = (0.015 + (S.brake ? 0.42 : 0)) * G * dt; if (sp > dec) S.vel.multiplyScalar((sp - dec) / sp); else S.vel.set(0, 0, 0);
  }
  { const hs = hsAt(S.ra); S.pos.x += S.vel.x * dt * hs; S.pos.y += S.vel.y * dt; S.pos.z += S.vel.z * dt * hs; }     // a quarter of the true speed across the compressed map when aloft
  // --- ground contact ---
  const g = groundAt(S.pos.x, S.pos.z), floor = g.h + GEAR_H;
  if (S.pos.y <= floor) {
    const vs = S.vel.y;
    if (g.water) return crash('The aircraft hit the water.');
    if (!S.onGround && S.airTime > 1.5) {
      // the reason given is the first that applies, most violent first; limits: autoland 9.5 m/s, Medium 7.5, Expert 5.5 (jets) or 6.5
      const sinkMax = S.land ? 9.5 : S.assist ? 7.5 : PL.tricks ? 6.5 : 5.5;
      if (vs < -sinkMax) return crash(L('Hit the ground at ' + Math.round(-vs * 196.85) + ' ft/min.', 'פגיעה בקרקע במהירות ירידה של ' + Math.round(-vs * 196.85) + ' רגל לדקה'));
      if (V > 2 * S.vs0) return crash(g.field ? 'Touched down far too fast.' : 'Flew into terrain.');
      if (!g.field && V > Math.max(45, 1.3 * S.vs0)) return crash('Flew into terrain.');
      if (Math.abs(phi) > 0.26 || theta < -0.1) return crash('Wing or nose struck the ground.');
      if (S.gearPos < 0.9) return crash('Touched down with the landing gear up.');
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
    if (!nearField) { const hs = hsAt(S.ra); for (const t of [5, 10]) if (groundAt(S.pos.x + S.vel.x * t * hs, S.pos.z + S.vel.z * t * hs).h > S.pos.y + S.vel.y * t - 40) terr = true; }
  }
  S.terr = terr; S.gpws = gp || terr;
  // Easy mode: landing gear and flaps look after themselves
  if (S.assist && !S.land && !S.trick) {
    const K = PL.vs / 73;                                   // speed thresholds scale with the aircraft's stall speed
    if (!S.onGround) {
      if (PL.fixedGear) S.gear = true;
      else if (S.gear && S.vel.y > 2 && S.ra > 40 && (V > 92 * K || S.ra > 350)) S.gear = false;
      else if (!S.gear && ((S.ra < 300 && V < 92 * K && S.vel.y < 0.5) || (S.ra < 150 && S.vel.y < 1 && V < 130 * K && AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R + 5000)))) S.gear = true;
      if (S.gear && !PL.fixedGear && !S.toClimb && S.airTime > 8 && S.vel.y < 1) S.flapIdx = Math.max(S.flapIdx, fi(V < 82 * K ? 3 : V < 90 * K ? 2 : V < 100 * K ? 1 : 0));
      else if (!S.gear) { if (V > 105 * K) S.flapIdx = 0; else if (V < 98 * K && S.flapIdx < 1) S.flapIdx = fi(1); }
    } else if (V < 30 * K && !S.landed) S.flapIdx = fi(1);
  }
  // the edge of the map: a warning 5 km (real) inside it; beyond it Easy and Medium turn back by themselves, Expert is only told
  { const m = Math.min(S.pos.x - X0, X1 - S.pos.x, S.pos.z - Z0, Z1 - S.pos.z);
    if (m < 1250 && !S.onGround && !S.crashed && TNOW > (S.edgeT || 0)) { S.edgeT = TNOW + 10; toast(m < 0 && S.assist ? L('The map ends here: turning back towards Israel', 'כאן נגמרת המפה: פונים חזרה לישראל') : L('The edge of the map is near: turn back', 'קצה המפה קרוב: כדאי לפנות חזרה'), 5); }
    if (m >= 0) S.edgeDir = 0;
    if (m < 0 && S.assist && !S.onGround && !S.land) { const hT = Math.atan2((X0 + X1) / 2 - S.pos.x, -((Z0 + Z1) / 2 - S.pos.z)) / DEG, e = wrap180(hT - S.hdg);
      if (Math.abs(e) > 4) { const sg = Math.abs(e) > 120 && S.edgeDir ? S.edgeDir : Math.sign(e) || 1, a = sg * 9 * DEG * dt; S.edgeDir = sg;          /* heading straight out, either way round is as good: keep to one */ if (S.arc && !S.ap.on) A.psi += a; else { S.q.premultiply(dq.setFromAxisAngle(YA, -a)); S.vel.applyAxisAngle(YA, -a); if (S.ap.on) S.ap.hdg = (S.hdg + 360) % 360; } } } }
  if ((S.mach || 0) > 1 && !S.mach1) { S.mach1 = true; Snd.boom(); S.shake = 0.5; toast(L('Mach 1! Sonic boom', 'מאך 1! בום על-קולי')); } else if ((S.mach || 0) < 0.93) S.mach1 = false;
}

// ---------- 11. Cameras ----------
const camPos = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
const CAMS = ['Cockpit', 'Chase', 'Wing', 'Fly-by', 'Above', 'Front', 'Below', 'Tail'];
/** Free look: drag on the view (mouse, or a finger away from the controls) to look around from the cockpit or the wing, or to swing the chase
    camera round the aircraft. Letting go eases the view back to straight ahead. */
const LOOK = { yaw: 0, pitch: 0, id: null, x: 0, y: 0, t: 0 };
function setupLook() {
  canvas.addEventListener('pointerdown', e => { if (PH.on || !S.started || S.paused || LOOK.id !== null) return; LOOK.id = e.pointerId; LOOK.x = e.clientX; LOOK.y = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== LOOK.id) return; const k = 3.2 / Math.max(window.innerWidth, 600);
    LOOK.yaw = clamp(LOOK.yaw + (e.clientX - LOOK.x) * k, -2.7, 2.7); LOOK.pitch = clamp(LOOK.pitch - (e.clientY - LOOK.y) * k, -1.1, 0.9); LOOK.x = e.clientX; LOOK.y = e.clientY; LOOK.t = TNOW; });
  const up = e => { if (e.pointerId === LOOK.id) LOOK.id = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
}
let SHADOW = null, SHADOW_TEX = null, LPOOL = null, ENVRT = null;
/** A soft silhouette of an aircraft, drawn once: the ground shadow (a texture made during init, so the canvas guard covers it). */
function buildShadow() {
  // one silhouette per aircraft type (nose up the canvas): [fuselage half-width, half-length, wing outline, tailplane outline]
  const SH = { airliner: [11, 96, [[0, -30], [108, 14], [108, 30], [0, 12]], [[0, 62], [40, 88], [40, 98], [0, 88]]], bizjet: [12, 92, [[0, -18], [106, 30], [106, 44], [0, 34]], [[0, 70], [44, 88], [44, 98], [0, 92]]],
    fighter: [13, 100, [[0, -40], [16, -8], [74, 44], [74, 58], [0, 52]], [[0, 62], [44, 86], [44, 96], [0, 90]]],
    concorde: [6, 122, [[0, -75], [8, -52], [17, 2], [35, 57], [52, 84], [52, 90], [0, 98]], [[0, 0], [0, 0]]], stealth: [8, 40, [[0, -119], [71, 70], [70, 84], [25, 55], [18, 87], [0, 95]], [[0, 0], [0, 0]]],
    bomber: [7, 104, [[0, -24], [121, 57], [121, 71], [45, 37], [0, 20]], [[0, 74], [34, 93], [34, 101], [0, 103]]], stunt: [13, 78, [[0, -30], [112, -22], [112, 6], [0, 10]], [[0, 56], [42, 60], [42, 76], [0, 76]]] };
  SHADOW_TEX = {}; let t = null;
  for (const k in SH) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), [fw, fl, wing, tail] = SH[k]; x.translate(128, 128); x.filter = 'blur(6px)'; x.fillStyle = '#000';
    x.beginPath(); x.ellipse(0, 0, fw, fl, 0, 0, 7); x.fill();
    for (const poly of [wing, tail]) for (const sg of [-1, 1]) { x.beginPath(); poly.forEach((p, i) => i ? x.lineTo(sg * p[0], p[1]) : x.moveTo(sg * p[0], p[1])); x.closePath(); x.fill(); }
    t = SHADOW_TEX[k] = new THREE.CanvasTexture(c); }
  SHADOW = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.4, fog: false }));
  SHADOW.renderOrder = 2; SHADOW.frustumCulled = false; scene.add(SHADOW);
  // the pool of light the landing lights throw on the ground at night
  LPOOL = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: lightDot(), color: 0xfff0d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  LPOOL.renderOrder = 3; LPOOL.frustumCulled = false; LPOOL.visible = false; scene.add(LPOOL);
}
/** A small picture of the sky and the land all round, taken once per time of day, for the aircraft's paint and glass to reflect. Nothing per frame. */
function bakeSkyReflection() {
  if (!AC.envMats.length || !S.pos) return;
  if (!ENVRT) { ENVRT = new THREE.WebGLCubeRenderTarget(64, { format: THREE.RGBFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }); ENVRT.cam = new THREE.CubeCamera(5, 400000, ENVRT); }
  const key = S.tod + '-' + WX + (TODX.on ? TODX.key : ''); if (ENVRT.key === key) return; ENVRT.key = key;          // only when the light changes, not on every lightning flash
  const g = groundAt(S.pos.x, S.pos.z), vis = AC.root.visible; ENVRT.cam.position.set(S.pos.x, Math.max(S.pos.y, g.h + 400), S.pos.z); AC.root.visible = false; const sp0 = sky.position.clone(); sky.position.copy(ENVRT.cam.position);
  if (clouds) clouds.visible = false; ENVRT.cam.update(renderer, scene); if (clouds) clouds.visible = true; AC.root.visible = vis; sky.position.copy(sp0);
  for (const m of AC.envMats) { if (m.envMap !== ENVRT.texture) { m.envMap = ENVRT.texture; m.combine = THREE.MixOperation; m.reflectivity = m.transparent ? 0.5 : 0.14; m.needsUpdate = true; } }
}
/** Camera feel: the chase camera leans into turns and trails the aircraft a little; a new start swings in from the side instead of cutting; a change
    of view blends; shake is a smooth buffet, not pixel noise; and the picture is shifted so the aircraft sits clear of the instruments. */
const CAMX = { last: -1, blend: 0, fromP: new THREE.Vector3(), fromQ: new THREE.Quaternion(), bank: 0, vo: 0, fb: new THREE.Vector3(), fbT: 0, fbOk: false, fbSide: 1 };
function updateCamera(dt) {
  if (LOOK.id === null && (LOOK.yaw || LOOK.pitch)) { const k = Math.exp(-5 * dt); LOOK.yaw *= k; LOOK.pitch *= k; if (Math.abs(LOOK.yaw) + Math.abs(LOOK.pitch) < 0.002) LOOK.yaw = LOOK.pitch = 0; }
  const looking = LOOK.yaw !== 0 || LOOK.pitch !== 0;
  if (CAMX.last !== S.cam) { CAMX.fbOk = false; if (CAMX.last >= 0 && !camSnap) { CAMX.blend = 0.38; CAMX.fromP.copy(camera.position); CAMX.fromQ.copy(camera.quaternion); } CAMX.last = S.cam; }      // a change of view glides, it does not cut
  const M = AC.m; AC.root.position.copy(S.pos); AC.root.quaternion.copy(S.q);
  M.g.visible = (S.cam !== 0 || CAMX.blend > 0.19) && !S.crashed; AC.deck.visible = S.cam === 0 && CAMX.blend < 0.19;
  fwd.set(0, 0, -1).applyQuaternion(S.q);
  if (S.cam === 1) {
    const c = PL.chase; tmpV.copy(S.pos).addScaledVector(fwd, -c[0]); tmpV.y += c[1];
    // a new start: the camera begins out to one side, wide and low, and swings in behind (the follow below does the move)
    if (camSnap) { camPos.copy(S.pos).addScaledVector(fwd, -c[0] * 1.5); camPos.x += -fwd.z * c[0] * 1.3; camPos.z += fwd.x * c[0] * 1.3; camPos.y += c[1] * 0.35; camSnap = false; CAMX.bank = 0; }
    else camPos.lerp(tmpV, 1 - Math.exp(-(3.2 + S.V * 0.022) * dt));
    { const want = S.trick || S.onGround ? 0 : clamp(S.bank, -1, 1) * (S.arc ? 0.12 : 0.22); CAMX.bank += (want - CAMX.bank) * (1 - Math.exp(-2.5 * dt)); }       // lean into the turn, gently (half as much in Easy)
    camPos.y = Math.max(camPos.y, groundAt(camPos.x, camPos.z).h + 1.5);
    camera.position.copy(camPos); camera.up.set(0, 1, 0); tmpV2.copy(S.pos).addScaledVector(fwd, c[0] * 0.47); tmpV2.y -= c[2] * lerp(1, 1.6, clamp((S.ra - 40) / 110, 0, 1));          /* aloft the camera looks further down: the horizon sits on the upper third and the land fills the frame; near the ground it looks ahead at the runway */
    if (looking) { tmpV.copy(camPos).sub(S.pos).applyAxisAngle(YA, -LOOK.yaw); const hd = Math.hypot(tmpV.x, tmpV.z), el = clamp(Math.atan2(tmpV.y, hd) - LOOK.pitch, -0.35, 1.45), r = tmpV.length(); tmpV.multiplyScalar(r * Math.cos(el) / Math.max(hd, 0.01)); tmpV.y = r * Math.sin(el);
      camera.position.copy(S.pos).add(tmpV); camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z).h + 1.5); tmpV2.lerp(S.pos, clamp((Math.abs(LOOK.yaw) + Math.abs(LOOK.pitch)) * 2, 0, 1)); }
    else { const sl = c[0] * 0.30 * Math.sin(CAMX.bank * 4); tmpV2.x += -fwd.z * sl; tmpV2.z += fwd.x * sl; }          // look into the turn: the aircraft slides toward the outside of the frame
    camera.lookAt(tmpV2); if (!looking) camera.rotateZ(-CAMX.bank);
  } else if (S.cam === 3) {
    // fly-by: a camera standing in the world ahead of the aircraft, watching it come, pass and go; then it moves on ahead again
    const c = PL.chase, hs = hsAt(S.ra), F = CAMX.fb, d = F.distanceTo(S.pos), behind = (S.pos.x - F.x) * S.vel.x + (S.pos.z - F.z) * S.vel.z > 0;
    if (camSnap || !CAMX.fbOk || d > c[0] * 16 + S.V * hs * 6 || (behind && d > c[0] * 7) || TNOW - CAMX.fbT > 14) { const hv = Math.hypot(S.vel.x, S.vel.z) || 1, ux = S.vel.x / hv, uz = S.vel.z / hv, ah = Math.max(c[0] * 5, S.V * hs * 4.5), sd = (CAMX.fbSide = -(CAMX.fbSide || 1)) * c[0] * 1.5;
      F.set(S.pos.x + ux * ah - uz * sd, 0, S.pos.z + uz * ah + ux * sd); const g = groundAt(F.x, F.z); F.y = Math.max(g.h + 3, Math.max(g.h, triHeight(F.x, F.z)) + 3, S.pos.y + S.vel.y * 4.5 - c[0] * 0.3); CAMX.fbT = TNOW; CAMX.fbOk = true; camSnap = false; CAMX.blend = 0; }
    camera.position.copy(F); camera.up.set(0, 1, 0); camera.lookAt(S.pos);
  } else if (S.cam === 4) {
    // from straight above, the nose at the top of the picture
    const c = PL.chase; camera.position.copy(S.pos); camera.position.y += c[0] * 2.3; tmpV.set(fwd.x, 0, fwd.z); if (tmpV.lengthSq() < 1e-4) tmpV.set(0, 0, -1); camera.up.copy(tmpV.normalize()); camera.lookAt(S.pos); camSnap = false;
  } else if (S.cam === 5) {
    // from the front: ahead of the nose and a little above, looking back at the aircraft
    const c = PL.chase; tmpV.set(fwd.x, 0, fwd.z).normalize(); camera.position.copy(S.pos).addScaledVector(tmpV, c[0] * 0.95).addScaledVector(tmpV2.set(-tmpV.z, 0, tmpV.x), c[0] * 0.28); camera.position.y += c[1] * 0.3;
    camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z).h + 1.5); camera.up.set(0, 1, 0); camera.lookAt(S.pos); camSnap = false;
  } else {
    // views fixed to the aircraft: the cockpit, the wing, under the belly looking down and ahead, and the top of the fin looking forward along the fuselage
    const c0 = PL.chase, e = S.cam === 0 ? PL.eye : S.cam === 6 ? [0, -PL.gearH * 0.62 - 0.2, 0.5] : S.cam === 7 ? [0, c0[1] * 0.46, c0[0] * 0.33] : PL.wingEye, eye = tmpV.set(e[0], e[1], e[2]);
    const tgt = S.cam === 0 ? tmpV2.set(e[0], e[1] - 0.12, e[2] - 2) : S.cam === 6 ? tmpV2.set(0, e[1] - 1.35, e[2] - 1.6) : S.cam === 7 ? tmpV2.set(0, e[1] - 1.6, e[2] - 9) : tmpV2.set(PL.wingTgt[0], PL.wingTgt[1], PL.wingTgt[2]);
    tmpM.lookAt(eye, tgt, YA); tmpQ.setFromRotationMatrix(tmpM);
    camera.quaternion.copy(S.q).multiply(tmpQ); if (looking) camera.quaternion.multiply(dq.setFromEuler(eul.set(LOOK.pitch, -LOOK.yaw, 0, 'YXZ'))); camera.position.copy(eye).applyQuaternion(S.q).add(S.pos);
  }
  // game feel: the view widens with speed and shakes on afterburner, stall buffet and touchdown
  const base = window.innerWidth < window.innerHeight ? 74 : 60, want = S.cam === 3 ? 32 : S.cam === 6 ? base + 8 : base + (S.cam === 1 ? 13 * clamp((S.V - PL.vc * 0.8) / (PL.vmo * 0.6), 0, 1) : 0);       /* the fly-by camera uses a long lens */
  camera.fov += (want - camera.fov) * Math.min(1, 3 * dt); camera.near = S.cam === 0 ? 0.15 : S.cam >= 6 ? 0.3 : 1; camera.updateProjectionMatrix();
  if (CAMX.blend > 0) { CAMX.blend = Math.max(0, CAMX.blend - Math.max(dt, 0.001)); const k = 1 - CAMX.blend / 0.38, e = k * k * (3 - 2 * k); tmpV.copy(camera.position); camera.position.lerpVectors(CAMX.fromP, tmpV, e); tmpQ.copy(camera.quaternion); camera.quaternion.copy(CAMX.fromQ).slerp(tmpQ, e); }
  { // keep the aircraft clear of what covers the lower part of the screen: the instrument panel on desktop, the stick and buttons on a phone held upright
    const w = window.innerWidth, h = window.innerHeight, tch = document.body.classList.contains('touch'), want = S.cam !== 1 ? 0 : tch ? (h > w ? 0.10 * h : 0) : document.body.classList.contains('nopfd') ? 0 : 0.07 * h;
    CAMX.vo += (want - CAMX.vo) * Math.min(1, 3 * Math.max(dt, 0.016)); if (Math.abs(CAMX.vo) > 0.5) camera.setViewOffset(w, h, 0, CAMX.vo, w, h); else if (camera.view) camera.clearViewOffset(); }
  S.shake *= Math.exp(-4 * dt);
  // shake: a touchdown bump and the stall buffet. The afterburner only trembles a little, and not at all from inside: in the cockpit the panel is a metre from the eye,
  // so centimetres of camera movement made the whole picture jump for as long as the burner was lit
  const amp = ((S.stallWarn ? 0.16 : 0) + (M.burner && S.n1 > 0.9 ? 0.012 : 0) + S.shake) * (S.cam === 0 || S.cam === 2 || S.cam >= 6 ? 0.12 : 1);
  if (amp > 0.004 && !S.paused) { const t = TNOW, a = amp * 0.5;          // buffet: two summed sines per axis, and a slight roll wobble
    camera.position.x += a * (Math.sin(t * 69) + Math.sin(t * 107 + 1.3)); camera.position.y += a * (Math.sin(t * 73 + 2.1) + Math.sin(t * 113 + 0.4)); camera.position.z += a * (Math.sin(t * 61 + 4.0) + Math.sin(t * 97 + 2.7)); camera.rotateZ(Math.min(amp, 0.5) * 0.006 * Math.sin(t * 43)); }
  sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000);
  sun.position.copy(S.pos).addScaledVector(sunDir, 1000); sun.target.position.copy(S.pos); sun.target.updateMatrixWorld();
  // the aircraft's shadow on the ground: where the sun puts it, softer and fainter with height, gone at night
  if (SHADOW) { const sy = Math.max(sunDir.y, 0.12), k = Math.max(S.ra, 0) / sy, sx = S.pos.x - sunDir.x * k, sz = S.pos.z - sunDir.z * k, gs = groundAt(sx, sz);
    const a = sunDir.y > 0.05 && !S.crashed ? 0.5 * clamp(1 - S.ra / 900, 0, 1) * clamp(sunDir.y * 4, 0, 1) : 0; SHADOW.visible = a > 0.01 && !gs.water;
    if (SHADOW.visible) { const sp = PL.chase[0] * 0.66 * (1 + Math.min(S.ra, 900) / 500); if (SHADOW.material.map !== SHADOW_TEX[PL.key]) { SHADOW.material.map = SHADOW_TEX[PL.key]; SHADOW.material.needsUpdate = true; } SHADOW.position.set(sx, Math.max(gs.h, triHeight(sx, sz)) + (gs.field ? 0.35 : 3.6), sz);          /* on the rendered mesh, above the roads; on an airfield just above the flat surface */ SHADOW.scale.set(sp * Math.max(0.3, Math.abs(Math.cos(S.bank))), sp, 1); SHADOW.rotation.set(-Math.PI / 2, 0, -S.hdg * DEG); SHADOW.material.opacity = a; } }
  // landing lights: on with the gear down; at night they throw a pool of light ahead on the ground
  if (M.land) { const on = S.gear && S.gearPos > 0.9; for (const l of M.land) l.visible = on;
    const nt = ENV.uLights.value; LPOOL.visible = on && nt > 0.3 && S.ra < 160 && !S.crashed;
    if (LPOOL.visible) { const d = 30 + S.ra * 1.6, lx = S.pos.x + fwd.x * d, lz = S.pos.z + fwd.z * d, gl = groundAt(lx, lz), r = 34 + S.ra * 0.9; LPOOL.position.set(lx, Math.max(gl.h, triHeight(lx, lz)) + (gl.field ? 0.4 : 3.7), lz); LPOOL.scale.set(r, r * 2.2, 1); LPOOL.rotation.set(-Math.PI / 2, 0, -S.hdg * DEG); LPOOL.material.opacity = 0.5 * nt * clamp(1 - S.ra / 160, 0, 1); } }
  else if (LPOOL) LPOOL.visible = false;
  if (M.wings) for (const [wg, sg, dih, fk, air] of M.wings) wg.rotation.z = sg * (dih + (air || 0) * clamp(S.nLoad, 0, 1.6) + 0.022 * (air ? 0 : 1) * (fk || 1) * clamp(S.nLoad - 1, -1.5, 2.5) * (S.onGround ? -0.6 : 1));
  if (M.droop) M.droop.rotation.x += (-0.22 * S.gearPos - M.droop.rotation.x) * Math.min(1, 1.5 * dt);          /* the nose comes down with the gear */
  if (M.outrig) for (const o of M.outrig) o.visible = S.gearPos > 0.5;      // the wings bend with the load
  // animated parts
  M.elev.forEach(e => e.rotation.x = -ctl.pitch * 0.4); if (M.rud) M.rud.rotation.y = ctl.yaw * 0.45;
  if (M.ail.length) { M.ail[0].rotation.x = ctl.roll * 0.4; M.ail[1].rotation.x = -ctl.roll * 0.4; }
  M.flap.forEach(f => { f.rotation.x = S.flapDeg * DEG; f.position.z = f.userData.z + S.flapDeg * 0.01 * PL.gearH; });
  if (M.gear) { M.gear.visible = S.gearPos > 0.03; M.gear.scale.y = Math.max(0.05, S.gearPos); M.gear.position.y = -0.35 * PL.gearH * (1 - S.gearPos); }
  if (M.beacon) M.beacon.visible = (TNOW % 1.2) < 0.12; const st = (TNOW % 1.5) < 0.07 || ((TNOW + 0.2) % 1.5) < 0.07; M.strobes.forEach(s => s.visible = st);
  if (M.prop) { const n = Math.abs(S.n1); M.prop.rotation.z += (8 + 40 * n) * dt; if (M.blades) { const blur = clamp((n - 0.12) / 0.3, 0, 1); for (const b of M.blades) b.visible = blur < 0.98; M.disc.visible = blur > 0.02; M.disc.material.opacity = blur; } }      // the blades give way to a blurred disc
  if (M.fans) for (const f of M.fans) f.rotation.z += (3 + 34 * Math.abs(S.n1)) * dt;
  if (M.wheels && S.onGround) for (const [w, r] of M.wheels) w.rotation.x -= S.V / r * dt;
  if (M.spoil) { const up = S.brake || (S.onGround && S.landed && S.V > 8) ? 0.75 : 0; for (const sp of M.spoil) sp.rotation.x += (-up - sp.rotation.x) * Math.min(1, 6 * dt); }      // spoilers rise on the brake and after touchdown
  if (M.burner) { const ab = clamp((S.n1 - 0.85) / 0.15, 0, 1); M.burner.visible = ab > 0.02; M.burner.scale.set(1, 1, ab * (0.9 + 0.07 * Math.sin(TNOW * 47) + 0.05 * Math.sin(TNOW * 83))); M.burner.position.z = (M.burnerZ || 7.7) + (M.burnerL || 2.75) * M.burner.scale.z; if (M.nozzle) M.nozzle.material.color.setRGB(0.06 + ab * 0.94, 0.03 + ab * 0.55, 0.02 + ab * 0.2); }       /* a steady flame with a slight pulse, and a glowing nozzle */
  AC.stick.rotation.x = -ctl.pitch * 0.3; AC.stick.rotation.z = -ctl.roll * 0.3; AC.thr.position.z = -15.75 - S.thr * 0.18;
}
