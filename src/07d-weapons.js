'use strict';
// ---------- 12h. Weapons: a gun, missiles and bombs for the three military aircraft, on firing ranges only ----------
// Design (the owner asked for firing "by capability", planned with care):
// - Who has what. Fighter: a cannon, four homing air-to-air missiles, four bombs. Stealth jet: two guided bombs and nothing else (as the real one).
//   Heavy bomber: forty-eight bombs, dropped six at a time in a string. The four other aircraft are unarmed and never see any of this.
// - Where. The weapons are locked ("safe") everywhere except inside two firing ranges, one in the open Negev and one out at sea, as an air force
//   keeps its weapons for its ranges. Nothing in the rest of the world can be shot at or damaged: no town, building, vehicle, ship or aircraft.
//   Outside a range the fire key only says where the nearest range is.
// - At what. Practice targets only: orange target drones that circle each range (for the gun and the missiles), and on the ground or the water
//   bullseyes, checkered crates and orange rafts (for bombs and the gun). A target that is hit bursts and is set up again half a minute later.
//   There is no score and no table: a hit is a short message, a sound and a buzz.
// - How it shows. Nothing is added to the screen outside a range. Inside one, an armed aircraft gets a Fire button (touch), a small weapon button
//   when it has more than one weapon, an aiming mark (the gun's line of fire, or where a bomb dropped now would land) and a box on a drone the
//   missile has locked. Keys: Enter fires, U changes weapon. Ammunition comes back on a new start and after landing.
// - Aiming (the owner found pointing the nose too hard, above all on a phone). The game helps in four ways, with no extra buttons:
//   1. every practice target in view carries a small orange mark, so it can be found;
//   2. the weapon locks by itself onto the marked target nearest the aiming mark (red box), or onto the one the player taps;
//   3. the gun is forgiving: with a lock within 16 degrees of the nose and 2.2 km it fires at where the target will be, not straight ahead;
//   4. bombs release themselves: Fire with a ground target locked arms the drop, and the bombs go at the moment they will land on it.
//   Without a lock everything works as before (the gun along the nose, a bomb at once, a missile straight).
// - Motion. Everything flies in map space like the aircraft itself (ground speed scaled by `hsAt`), so the aiming mark and the bomb agree.

// - Everywhere, always (the owner's decision; a child lock and then a settings row were removed at his request): the weapons work over the whole map.
//   The firing ranges are only where the practice targets are. The world is still
//   not a target: a bomb or a shell bursts where it lands, on the ground or on a roof, and nothing is damaged or destroyed; only the practice targets react.
const WPN = { on: false, range: null, sel: 0, ammo: {}, cool: 0, bullets: [], shots: [], drones: [], targets: [], blasts: [], lock: null, hitT: -9, safeT: -9, gunT: 0 };
const RANGES = [{ name: ['the Negev range', 'שטח האש בנגב'], lon: 34.78, lat: 30.40, r: 4200 }          /* open desert south of Mitzpe Ramon: no town within reach, a handful of masts at most */, { name: ['the sea range', 'שטח האש בים'], lon: 34.36, lat: 32.2, r: 5200, sea: true }];
const WPN_NAME = { gun: ['Gun', 'תותח'], missile: ['Missile', 'טיל'], bomb: ['Bomb', 'פצצה'] };
/** The weapons of an aircraft, in the order the weapon button steps through them: [kind, how many, released per press]. */
const armsOf = pl => pl.key === 'fighter' ? [['gun', 500, 1], ['missile', 4, 1], ['bomb', 4, 1]] : pl.key === 'stealth' ? [['bomb', 2, 1]] : pl.key === 'bomber' ? [['bomb', 48, 6]] : null;
function wpnRearm() { const a = armsOf(PL); WPN.ammo = {}; WPN.sel = 0; wpnUnpick(); WPN.auto = null; if (a) for (const [k, n] of a) WPN.ammo[k] = n; }

function buildWeapons() {
  const lam = c => new THREE.MeshLambertMaterial({ color: c }), ORANGE = 0xff7a1a;
  // the bullseye painted on the ground, and the checkered side of a crate
  const bull = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); for (const [r, col] of [[62, '#f4f4f0'], [50, '#d9342b'], [37, '#f4f4f0'], [24, '#d9342b'], [11, '#f4f4f0']]) { x.fillStyle = col; x.beginPath(); x.arc(64, 64, r, 0, 7); x.fill(); } return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }); })();
  const chk = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#ff7a1a' : '#f4f4f0'; x.fillRect(i * 16, j * 16, 16, 16); } return new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) }); })();
  const droneGeo = mergeGeo([[new THREE.ConeGeometry(1.6, 9, 8).rotateX(-Math.PI / 2), 1, 1, 1], [new THREE.BoxGeometry(11, 0.25, 2.6).translate(0, 0, 1.4), 1, 1, 1], [new THREE.BoxGeometry(0.25, 2.6, 2).translate(0, 1.2, 3.6), 1, 1, 1]]);
  RANGES.forEach((R, ri) => { R.x = lon2x(R.lon); R.z = lat2z(R.lat);
    // ground or water targets on a ring and in the middle
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + ri, d = k === 0 ? 0 : 700 + (k % 3) * 650; let x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d;
      if (!R.sea) for (let t = 0; t < 12; t++) { const hs = [triHeight(x - 20, z), triHeight(x + 20, z), triHeight(x, z - 20), triHeight(x, z + 20)]; if (Math.max(...hs) - Math.min(...hs) < 3 && !groundAt(x, z).water && !nearRoad(x, z, 30) && !obstBox(x, z, 20, 20)) break; x += 37; z += 23; }
      const g = new THREE.Group(), y = R.sea ? 0 : triHeight(x, z);
      if (R.sea) { const raft = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 16), lam(ORANGE)); raft.position.y = 0.7; g.add(raft); const m = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), chk); m.position.y = 3.9; g.add(m); }
      else if (k % 3 === 0) { const b = new THREE.Mesh(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), bull); b.position.y = 0.8; b.renderOrder = 2; g.add(b); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 8), lam(ORANGE)); p.position.y = 4.5; g.add(p); }
      else { const m = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), chk); m.position.y = 2.5; g.add(m); const m2 = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), chk); m2.position.set(7, 2, 3); g.add(m2); }
      g.position.set(x, y, z); scene.add(g); WPN.targets.push({ g, x, y: y + 2.5, z, hp: 6, dead: 0, range: ri }); }
    // three target drones on circles of their own
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(droneGeo, new THREE.MeshLambertMaterial({ color: ORANGE, vertexColors: true })); m.frustumCulled = false; scene.add(m);
      WPN.drones.push({ m, range: ri, r: 1300 + k * 800, alt: (R.sea ? 0 : groundAt(R.x, R.z).h) + 420 + k * 260, a: k * 2.1, dir: k % 2 ? -1 : 1, hp: 3, dead: 0, p: new THREE.Vector3() }); } });
  // tracers: one batch of line segments; missiles and bombs: a small pool of bodies; bursts: additive sprites
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 6), 3)); WPN.tr = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffe9a0, fog: false, toneMapped: false })); WPN.tr.frustumCulled = false; scene.add(WPN.tr); }
  { const body = mergeGeo([[new THREE.CylinderGeometry(0.22, 0.22, 3.2, 8).rotateX(Math.PI / 2), 1, 1, 1], [new THREE.ConeGeometry(0.22, 0.7, 8).rotateX(-Math.PI / 2).translate(0, 0, -1.95), 1, 1, 1], [new THREE.BoxGeometry(1.2, 0.05, 0.6).translate(0, 0, 1.3), 0.6, 0.6, 0.6], [new THREE.BoxGeometry(0.05, 1.2, 0.6).translate(0, 0, 1.3), 0.6, 0.6, 0.6]]);
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(body, new THREE.MeshLambertMaterial({ vertexColors: true })); m.visible = false; m.frustumCulled = false; scene.add(m); WPN.shots.push({ m, on: false, p: m.position, v: new THREE.Vector3() }); } }
  for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightDot(), color: 0xffa040, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); s.visible = false; scene.add(s); WPN.blasts.push({ s, t: 9, k: 1 }); }
  // the marks on the targets: six small screen elements; a tap on one chooses that target
  WPN.marks = []; for (let i = 0; i < 6; i++) { const m = document.createElement('div'); m.className = 'tmk'; m.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (m._t) { if (WPN.pick === m._t) wpnUnpick(); else { wpnUnpick(); WPN.pick = m._t; } buzz(10); } }); $('hud').appendChild(m); WPN.marks.push(m); }
  wpnRearm();
}
const wpnPos = t => t.p || (t.p = new THREE.Vector3(t.x, t.y, t.z)), wpnIsDrone = t => t.a !== undefined;
function wpnUnpick() { WPN.pick = null; WPN.free = null; }
/**
 * A tap (or a click) on the world chooses what is there as the target: the ground, the sea, a roof, anything. It is only a place to aim at: nothing
 * there is damaged. A tap near a practice target or a drone takes that instead. The chosen place carries a mark; a tap on the mark lets it go.
 * Returns true when the tap chose something.
 */
function wpnTap(cx, cy) {
  if (!WPN.on || !armsOf(PL)) return false; const w = window.innerWidth, h = window.innerHeight;
  // a practice target or a drone under the finger (within 34 px) comes first
  let near = null, nd = 34; for (const t of [...WPN.drones, ...WPN.targets]) { if (t.dead > 0 || wpnPos(t).distanceTo(S.pos) > 6000) continue; const v = tmpV.copy(wpnPos(t)).project(camera); if (v.z > 1) continue; const d = Math.hypot((v.x * 0.5 + 0.5) * w - cx, (-v.y * 0.5 + 0.5) * h - cy); if (d < nd) { nd = d; near = t; } }
  if (near) { wpnUnpick(); WPN.pick = near; buzz(10); return true; }
  // otherwise the first thing the line of sight meets, out to 12 km: a building or the ground
  const o = tmpV.set(cx / w * 2 - 1, -(cy / h) * 2 + 1, 0.5).unproject(camera), c = camera.getWorldPosition(tmpV2), dx = o.x - c.x, dy = o.y - c.y, dz = o.z - c.z, n = Math.hypot(dx, dy, dz), ux = dx / n, uy = dy / n, uz = dz / n;
  const inside = t => { const x = c.x + ux * t, y = c.y + uy * t, z = c.z + uz * t; return y <= groundAt(x, z).h || hitObstacle(x, y, z, 0); };
  let t0 = 20, t1 = -1; for (let t = 20; t < 12000; t += Math.max(6, t * 0.012)) { if (inside(t)) { t1 = t; break; } t0 = t; }
  if (t1 < 0) return false; for (let i = 0; i < 12; i++) { const m = (t0 + t1) / 2; if (inside(m)) t1 = m; else t0 = m; }
  const x = c.x + ux * t1, y = c.y + uy * t1, z = c.z + uz * t1; WPN.free = { x, y, z, p: new THREE.Vector3(x, y, z), dead: 0, free: true }; WPN.pick = WPN.free; WPN.auto = null; buzz(10);
  if (!WPN.freeSaid) { WPN.freeSaid = true; toast(L('Target chosen. Tap its mark to let it go', 'המטרה נבחרה. נגיעה בסימן שלה משחררת אותה'), 3.5); }
  return true;
}
/** Where to shoot to hit a target: its place when the shell arrives (drones move along their circle). */
function wpnLead(t, out) { out.copy(wpnPos(t)); if (wpnIsDrone(t)) { const tm = out.distanceTo(S.pos) / 900, sp = t.dir * 38; out.x += -Math.sin(t.a) * sp * tm; out.z += Math.cos(t.a) * sp * tm; } return out; }
/** Let the bombs or the missile go. */
function wpnRelease(kind, per, tgt) { const hs = hsAt(S.ra), a = armsOf(PL); fwd.set(0, 0, -1).applyQuaternion(S.q); WPN.cool = kind === 'missile' ? 0.5 : 0.35;
  for (let n = 0; n < per && WPN.ammo[kind] > 0; n++) { const sh = WPN.shots.find(q => !q.on); if (!sh) break; WPN.ammo[kind]--; sh.on = true; sh.kind = kind; sh.t = -n * 0.16; sh.m.visible = n === 0; sh.tgt = kind === 'missile' ? (WPN.lock && (wpnIsDrone(WPN.lock) || WPN.lock.free) ? WPN.lock : null) : (tgt || null); sh.guided = PL.key === 'stealth';
    sh.p.copy(S.pos); sh.p.y -= 2; if (kind === 'missile') sh.v.set(S.vel.x * hs + fwd.x * 120, S.vel.y + fwd.y * 120, S.vel.z * hs + fwd.z * 120); else sh.v.set(S.vel.x * hs, S.vel.y, S.vel.z * hs); sh.m.scale.setScalar(kind === 'missile' ? 1 : 1.5); }
  if (kind === 'missile') wpnSound('whoosh'); buzz(15);
  if (!WPN.ammo[kind] && a.length > 1) { const nx = a.findIndex(([k]) => WPN.ammo[k] > 0); if (nx >= 0) WPN.sel = nx; } }

/** A burst: a short orange flash and a few puffs of smoke. */
function wpnBlast(x, y, z, k, quiet) { const b = WPN.blasts.reduce((a, c) => c.t > a.t ? c : a); b.s.position.set(x, y, z); b.t = 0; b.k = k; b.s.visible = true;
  for (let i = 0; i < 4; i++) puff(x + (Math.random() - 0.5) * 8 * k, y + Math.random() * 6 * k, z + (Math.random() - 0.5) * 8 * k, 5 * k, 0.5); if (!quiet) { Snd.boom(); } }
function wpnHit(what) { if (TNOW - WPN.hitT > 1.2) { WPN.hitT = TNOW; toast(L('Hit!', 'פגיעה!'), 1.6); Snd.chime(940, 0.16); buzz(30); } }
function wpnSound(kind) { const c = Snd.ctx; if (!c || !Snd.buf) return; const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime, d = kind === 'gun' ? 0.07 : 0.7; s.buffer = Snd.buf; f.type = kind === 'gun' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'gun' ? 900 : 700;
  g.gain.setValueAtTime(kind === 'gun' ? 0.5 : 0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(g); g.connect(Snd.master); s.start(t, Math.random()); s.stop(t + d + 0.05); }

/** The range the aircraft is in, or null; and the nearest one with its distance, for the message. */
function wpnRange() { let best = null, bd = 1e9; for (const R of RANGES) { const d = Math.hypot(S.pos.x - R.x, S.pos.z - R.z); if (d < bd) { bd = d; best = R; } } return { in: bd < best.r ? best : null, best, d: bd }; }
/** Where a bomb let go now would come down (the same steps the bomb itself takes). */
function wpnImpact(out) { const hs = hsAt(S.ra); let x = S.pos.x, y = S.pos.y - 2, z = S.pos.z, vy = S.vel.y; const vx = S.vel.x * hs, vz = S.vel.z * hs; for (let i = 0; i < 400; i++) { x += vx * 0.1; z += vz * 0.1; vy -= G * 0.1; y += vy * 0.1; const g = groundAt(x, z).h; if (y <= g) { y = g; break; } } return out.set(x, y, z); }

function wpnSelect() { const a = armsOf(PL); if (!a || a.length < 2) return; WPN.sel = (WPN.sel + 1) % a.length; const k = a[WPN.sel][0]; toast(L(WPN_NAME[k][0], WPN_NAME[k][1]) + ' · ' + WPN.ammo[k], 1.4); }
/** One press of the fire key (the gun also fires while it is held, from `updateWeapons`). */
function wpnFire(held) {
  const a = armsOf(PL); if (!a || S.crashed || S.paused) return; const [kind, , per] = a[WPN.sel] || a[0], rg = wpnRange();
  if (S.onGround) return; if (!WPN.ammo[kind]) { if (!held && TNOW - WPN.safeT > 3) { WPN.safeT = TNOW; toast(L('Out of ammunition: land, or start again, to rearm', 'נגמרה התחמושת: נוחתים או מתחילים מחדש כדי להתחמש'), 4); } return; }
  const hs = hsAt(S.ra); fwd.set(0, 0, -1).applyQuaternion(S.q);
  if (kind === 'gun') { if (WPN.gunT > 0) return; WPN.gunT = 0.06; WPN.ammo.gun--; const dir = tmpV2.copy(fwd);
    if (WPN.lock) { wpnLead(WPN.lock, tmpV).sub(S.pos); const dist = tmpV.length(); tmpV.multiplyScalar(1 / dist); if (dist < 2200 && tmpV.dot(fwd) > 0.96) { dir.copy(tmpV); dir.y += 0.5 * G * (dist / 900) * (dist / 900) / dist; } }          // the forgiving gun: at the locked target's future place, with the drop allowed for
    const b = { p: new THREE.Vector3().copy(S.pos).addScaledVector(fwd, 8), v: new THREE.Vector3(dir.x * 900, dir.y * 900, dir.z * 900), t: 0 }; WPN.bullets.push(b); if (WPN.bullets.length > 60) WPN.bullets.shift(); if ((WPN.ammo.gun & 3) === 0) wpnSound('gun'); return; }
  if (held || WPN.cool > 0) return;
  // a bomb with a ground target locked is not dropped now but armed: it goes by itself at the moment it will land on the target (a second press drops at once)
  if (kind === 'bomb' && WPN.lock && !wpnIsDrone(WPN.lock) && !WPN.auto && Math.hypot(wpnImpact(tmpV).x - WPN.lock.x, tmpV.z - WPN.lock.z) > 45) { WPN.auto = { t: WPN.lock, prev: 1e9, t0: TNOW, per }; buzz(10); toast(L('Armed: fly over the target, the bombs drop by themselves', 'חמוש: טסים מעל המטרה, הפצצות משתחררות לבד'), 3); return; }
  WPN.auto = null; wpnRelease(kind, per, kind === 'bomb' && WPN.lock && !wpnIsDrone(WPN.lock) ? WPN.lock : null);
}

function updateWeapons(dt, run) {
  const a = armsOf(PL), T = document.body.classList.contains('touch'), rg = a && S.started ? wpnRange() : null, live = !!(rg && !S.crashed && !S.paused && !PH.on);
  // the buttons and marks exist only for an armed aircraft inside a range
  if (WPN.on !== live || WPN.uiPl !== PL.key) { WPN.on = live; WPN.uiPl = PL.key; $('cFire').hidden = !live; $('cMore').classList.toggle('armed', live); $('cWpn').hidden = !(live && a && a.length > 1); if (!live) { $('aim').style.display = 'none'; $('aimLock').style.display = 'none'; keys.Enter = false; }
    if (live && rg.in && TNOW - (WPN.inT || -99) > 30) { WPN.inT = TNOW; toast(L('Firing range: weapons are live. ', 'שטח אש: הנשק פעיל. ') + (T ? L('Tap a target, or any place, to aim at it. Fire is under "⋯"', 'נוגעים במטרה, או בכל מקום, כדי לכוון אליו. "אש" נמצא תחת "⋯"') : L('Click a target, or any place, to aim at it. Enter fires, U changes weapon', 'לוחצים על מטרה, או על כל מקום, כדי לכוון אליו. Enter יורה, U מחליף נשק')), 6); } }
  if (S.landed && S.onGround && a && S.V < 2 && !WPN.rearmed) { WPN.rearmed = true; wpnRearm(); } else if (!S.onGround) WPN.rearmed = false;
  // drones fly their circles everywhere (they are part of the range), targets come back after a while
  for (const d of WPN.drones) { const R = RANGES[d.range]; if (run) d.a += d.dir * 38 / d.r * dt;          /* slow enough to hit with the gun without leading far */ d.p.set(R.x + Math.cos(d.a) * d.r, d.alt, R.z + Math.sin(d.a) * d.r); d.m.position.copy(d.p); d.m.rotation.set(0, Math.atan2(Math.sin(d.a) * d.dir, -Math.cos(d.a) * d.dir), -d.dir * 0.25, 'YXZ'); d.m.scale.setScalar(2.2);
    if (d.dead > 0 && run) { d.dead -= dt; if (d.dead <= 0) { d.hp = 3; } } d.m.visible = d.dead <= 0; }
  for (const t of WPN.targets) { if (t.dead > 0 && run) { t.dead -= dt; if (t.dead <= 0) t.hp = 6; } t.g.visible = t.dead <= 0; }
  for (const b of WPN.blasts) { if (b.t < 1) { b.t += dt * 2.2; const sc = (18 + b.t * 60) * b.k; b.s.scale.set(sc, sc, 1); b.s.material.opacity = Math.max(0, 1 - b.t); if (b.t >= 1) b.s.visible = false; } }
  if (!run) return;
  WPN.cool -= dt; WPN.gunT -= dt; if (live && keys.Enter) wpnFire(WPN.was); WPN.was = !!keys.Enter;          // the first frame of a press is a press (a bomb, a missile), the rest is holding (the gun)
  const killDrone = d => { d.dead = 30; d.hp = 0; wpnBlast(d.p.x, d.p.y, d.p.z, 1.2); wpnHit(); }, killTgt = t => { t.dead = 30; t.hp = 0; wpnBlast(t.x, t.y + 3, t.z, 1.6); wpnHit(); };
  // bullets: straight and fast, a little drop; they wear a target down
  { const P = WPN.tr.geometry.attributes.position; let n = 0; WPN.bullets = WPN.bullets.filter(b => { b.t += dt; const px = b.p.x, py = b.p.y, pz = b.p.z; b.v.y -= G * dt; b.p.addScaledVector(b.v, dt); if (b.t > 2.6) return false;
      for (const d of WPN.drones) if (d.dead <= 0 && Math.abs(d.p.x - b.p.x) < 60 && tmpV.copy(d.p).sub(b.p).length() < 26) { if (--d.hp <= 0) killDrone(d); else puff(d.p.x, d.p.y, d.p.z, 3, 0.5); return false; }
      if (hitObstacle(b.p.x, b.p.y, b.p.z, 1)) { puff(b.p.x, b.p.y, b.p.z, 2.2, 0.4); return false; }
      const gh = groundAt(b.p.x, b.p.z).h; if (b.p.y <= gh + 1) { for (const t of WPN.targets) if (t.dead <= 0 && Math.hypot(t.x - b.p.x, t.z - b.p.z) < 14) { if (--t.hp <= 0) killTgt(t); } puff(b.p.x, gh + 1, b.p.z, 2.2, 0.4); return false; }
      if (n < 60) { P.setXYZ(n * 2, px, py, pz); P.setXYZ(n * 2 + 1, b.p.x, b.p.y, b.p.z); n++; } return true; });
    WPN.tr.geometry.setDrawRange(0, n * 2); P.needsUpdate = true; }
  // missiles home on the drone that was locked; bombs fall (the stealth jet's steer to the nearest target near where they will land)
  for (const s of WPN.shots) { if (!s.on) continue; s.t += dt; if (s.t < 0) { s.p.copy(S.pos); s.p.y -= 2; const hs = hsAt(S.ra); s.v.set(S.vel.x * hs, S.vel.y, S.vel.z * hs); continue; } s.m.visible = true;
    if (s.kind === 'missile') { const d = s.tgt && s.tgt.dead <= 0 ? s.tgt : null, sp = Math.min(s.v.length() + 500 * dt, 720); if (d) { tmpV.copy(d.p).sub(s.p).normalize(); s.v.normalize().lerp(tmpV, Math.min(1, 4.5 * dt)).normalize(); } else s.v.normalize(); s.v.multiplyScalar(sp);
      s.p.addScaledVector(s.v, dt); if ((s.n = (s.n | 0) + 1) % 2 === 0) puff(s.p.x, s.p.y, s.p.z, 1.6, 0.5);
      if (d && s.p.distanceTo(d.p) < 28) { if (d.free) wpnBlast(s.p.x, s.p.y, s.p.z, 1.2); else killDrone(d); s.on = false; } else if (hitObstacle(s.p.x, s.p.y, s.p.z, 0)) { wpnBlast(s.p.x, s.p.y, s.p.z, 1.2); s.on = false; } else if (s.t > 9 || s.p.y < groundAt(s.p.x, s.p.z).h) { wpnBlast(s.p.x, s.p.y, s.p.z, 0.8, true); s.on = false; } }
    else { s.v.y -= G * dt; if (s.guided && s.t > 0.6) { let best = s.tgt && s.tgt.dead <= 0 ? s.tgt : null, bd = 420; if (!best) for (const t of WPN.targets) if (t.dead <= 0) { const dd = Math.hypot(t.x - s.p.x, t.z - s.p.z); if (dd < bd) { bd = dd; best = t; } } if (best) { const tt = Math.max((s.p.y - best.y) / Math.max(-s.v.y, 20), 0.3); s.v.x += ((best.x - s.p.x) / tt - s.v.x) * Math.min(1, 2.5 * dt); s.v.z += ((best.z - s.p.z) / tt - s.v.z) * Math.min(1, 2.5 * dt); } }
      s.p.addScaledVector(s.v, dt); const gh = hitObstacle(s.p.x, s.p.y, s.p.z, 1) ? s.p.y : groundAt(s.p.x, s.p.z).h; if (s.p.y <= gh) { wpnBlast(s.p.x, gh + 2, s.p.z, 2.2);          /* on a roof it bursts on the roof: a picture only, nothing is damaged */ for (const t of WPN.targets) if (t.dead <= 0 && Math.hypot(t.x - s.p.x, t.z - s.p.z) < 38) killTgt(t); s.on = false; } }
    if (s.on) { tmpV.copy(s.p).add(s.v); s.m.lookAt(tmpV); s.m.rotateY(Math.PI); } else s.m.visible = false; }
  // aiming: marks on the targets in view, the lock, the aiming mark, the automatic drop
  const aim = $('aim'), lk = $('aimLock'); WPN.lock = null; let nm = 0;
  if (live && a) { const [kind] = a[WPN.sel] || a[0], w = window.innerWidth, h = window.innerHeight, ndc = v => { v.project(camera); return v.z <= 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02; }, at = (el, v, half) => { el.style.display = 'block'; el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w - half) + 'px,' + ((-v.y * 0.5 + 0.5) * h - half) + 'px)'; };
    fwd.set(0, 0, -1).applyQuaternion(S.q); aim.textContent = String(WPN.ammo[kind] || 0);
    const ap = kind === 'bomb' ? wpnImpact(new THREE.Vector3()) : new THREE.Vector3().copy(S.pos).addScaledVector(fwd, 900), apW = ap.clone(), apOn = ndc(ap);
    // the targets this weapon is for, nearest first; each one in view gets a mark, and the one nearest the aiming mark is locked (or the one tapped)
    const pool = (kind === 'bomb' ? WPN.targets : kind === 'missile' ? WPN.drones : [...WPN.drones, ...WPN.targets]).filter(t => t.dead <= 0 && wpnPos(t).distanceTo(S.pos) < 6000).sort((p, q) => wpnPos(p).distanceTo(S.pos) - wpnPos(q).distanceTo(S.pos));
    if (WPN.free) { if (WPN.free.p.distanceTo(S.pos) < 14000) pool.unshift(WPN.free); else wpnUnpick(); }
    if (WPN.pick && (WPN.pick.dead > 0 || !pool.includes(WPN.pick))) WPN.pick = null; let best = null, bd = kind === 'bomb' ? 0.9 : 0.5;
    for (const t of pool) { const v = tmpV2.copy(wpnPos(t)); if (!ndc(v)) continue; if (nm < WPN.marks.length) { const m = WPN.marks[nm++]; m._t = t; at(m, v, 13); m.classList.toggle('pk', t === WPN.pick); m.classList.toggle('fr', !!t.free); }
      const d = apOn ? Math.hypot(v.x - ap.x, (v.y - ap.y) * h / w) : Math.hypot(v.x, v.y * h / w) + 0.2; if (d < bd && (kind !== 'missile' || tmpV.copy(wpnPos(t)).sub(S.pos).normalize().dot(fwd) > 0.8)) { bd = d; best = t; } }
    WPN.lock = WPN.pick || best;
    let hot = false; if (kind === 'gun' && WPN.lock) { wpnLead(WPN.lock, tmpV).sub(S.pos); const dist = tmpV.length(); hot = dist < 2200 && tmpV.multiplyScalar(1 / dist).dot(fwd) > 0.96; }
    if (kind === 'bomb' && WPN.lock) hot = Math.hypot(apW.x - WPN.lock.x, apW.z - WPN.lock.z) < 45;
    aim.className = kind + (hot ? ' hot' : '') + (WPN.auto ? ' auto' : ''); if (hot && kind === 'gun') { const v = wpnLead(WPN.lock, tmpV2); if (ndc(v)) at(aim, v, 14); else aim.style.display = 'none'; } else if (apOn) at(aim, ap, 14); else aim.style.display = 'none';
    if (WPN.lock) { const v = tmpV2.copy(wpnPos(WPN.lock)); if (ndc(v)) at(lk, v, 17); else lk.style.display = 'none'; } else lk.style.display = 'none';
    // the armed drop: release as the bombs' landing point reaches the target (or stops closing on it close by); given up after a while or when the target is gone
    if (WPN.auto) { const A2 = WPN.auto, d = Math.hypot(apW.x - A2.t.x, apW.z - A2.t.z); if (kind !== 'bomb' || A2.t.dead > 0 || TNOW - A2.t0 > 150 || S.onGround) WPN.auto = null; else if (d < 30 || (d > A2.prev && A2.prev < 140)) { WPN.auto = null; if (WPN.ammo.bomb) wpnRelease('bomb', A2.per, A2.t); } else A2.prev = d; }
    const fb = $('cFire'), ft = L('Fire', 'אש') + ' · ' + (WPN.ammo[kind] || 0); if (fb.textContent !== ft) fb.textContent = ft; const wb = $('cWpn'), wt = L(WPN_NAME[kind][0], WPN_NAME[kind][1]); if (wb.textContent !== wt) wb.textContent = wt; }
  else { WPN.auto = null; if (!live) wpnUnpick(); }
  for (let i = nm; i < WPN.marks.length; i++) { WPN.marks[i].style.display = 'none'; WPN.marks[i]._t = null; }
}
