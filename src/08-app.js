'use strict';
// ---------- 13. Procedural audio ----------
const Snd = { ctx: null, muted: false,
  init() {
    const A = window.AudioContext || window.webkitAudioContext; if (!A || this.ctx) return; const c = this.ctx = new A();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.buf = buf;
    const noise = () => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const gain = v => { const g = c.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; return b; };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
    // jet roar (filtered noise) + fan whine (two detuned oscillators)
    this.roarF = filt('lowpass', 300, 0.5); this.roarG = gain(0); noise().connect(this.roarF); this.roarF.connect(this.roarG); this.roarG.connect(this.master);
    this.wh1 = osc('sawtooth', 200); this.wh2 = osc('triangle', 303); this.whF = filt('bandpass', 900, 2); this.whG = gain(0);
    this.wh1.connect(this.whF); this.wh2.connect(this.whF); this.whF.connect(this.whG); this.whG.connect(this.master);
    // wind rush
    this.windF = filt('bandpass', 500, 0.6); this.windG = gain(0); noise().connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master);
    // cockpit ambience: air conditioning hiss + avionics hum
    const amF = filt('lowpass', 220, 0.5), amG = gain(0.05); noise().connect(amF); amF.connect(amG); amG.connect(this.master);
    const hum = osc('sine', 110), humG = gain(0.012); hum.connect(humG); humG.connect(this.master);
    // landing gear hydraulics
    this.gearG = gain(0); const go = osc('sawtooth', 68), gf = filt('lowpass', 380, 1); go.connect(gf); gf.connect(this.gearG); this.gearG.connect(this.master);
    // warning horn
    this.warnO = osc('square', 1300); this.warnG = gain(0); const wf = filt('lowpass', 2600, 0.7); this.warnO.connect(wf); wf.connect(this.warnG); this.warnG.connect(this.master);
  },
  update() {
    const c = this.ctx; if (!c) return; const t = c.currentTime, n = Math.abs(S.n1), inside = S.cam === 0 ? 0.7 : 1, dead = S.crashed || S.paused ? 0 : 1, pr = PL.prop, lv = PL.sound || (PL.key === 'fighter' ? 1.5 : pr ? 0.55 : PL.key === 'bizjet' ? 0.8 : 1);
    const set = (p, v) => p.setTargetAtTime(v, t, 0.08);
    // A phone's speaker plays almost nothing below about 300 Hz. The idle rumble and the propeller's buzz used to sit under that, so on a phone the
    // aerobatic plane, and any jet at low power, seemed to have no sound at all: the filters now stay above it and the quiet end is louder
    set(this.roarG.gain, (0.1 + 0.5 * n * n) * inside * dead * lv); set(this.roarF.frequency, 420 + 1300 * n + S.V * 2);
    set(this.whG.gain, (pr ? 0.16 + 0.3 * n : 0.02 + 0.05 * n) * inside * dead);     // propeller: a low buzz instead of a fan whine
    set(this.wh1.frequency, pr ? 78 + 70 * n : 150 + 520 * n); set(this.wh2.frequency, pr ? 157 + 141 * n : 227 + 790 * n); set(this.whF.frequency, pr ? 520 + 600 * n : 500 + 1900 * n); set(this.whF.Q, pr ? 0.8 : 2);          /* the propeller: the harmonics of a low engine note, let through wide */
    const vv = clamp(S.V / 250, 0, 1.3); set(this.windG.gain, 0.4 * vv * vv * dead + (S.gearPos > 0.05 ? 0.07 * vv : 0)); set(this.windF.frequency, 250 + 900 * vv);
    set(this.gearG.gain, S.gearPos > 0.01 && S.gearPos < 0.99 ? 0.07 : 0);
    let w = 0;
    if (!S.crashed && S.stallWarn) { w = (t * 9 % 1) < 0.5 ? 0.09 : 0; this.warnO.frequency.setTargetAtTime(1400, t, 0.01); }
    else if (!S.crashed && S.gpws) { const ph = t * 1.6 % 1; w = ph < 0.7 ? 0.1 : 0; this.warnO.frequency.setTargetAtTime(480 + 620 * ph, t, 0.01); }
    this.warnG.gain.setTargetAtTime(w, t, 0.012);
  },
  /** Short rising blip: gates, landmarks, good landings. */
  chime(f, d) { const c = this.ctx; if (!c) return; d = d || 0.2; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.2); },
  /** Low thump: sonic boom and crashes. */
  boom() { const c = this.ctx; if (!c) return; const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime; s.buffer = this.buf; f.type = 'lowpass'; f.frequency.value = 140;
    g.gain.setValueAtTime(1.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 1.2); },
  toggle() { this.muted = !this.muted; this.sync(); },
  sync() { if (this.master) this.master.gain.value = this.muted ? 0 : 0.7; },
  /** Wake the sound: a phone suspends it after a call, another app's sound or a long pause, and only lets it start again from a touch. */
  wake() { const c = this.ctx; if (c && S.started && !document.hidden && c.state !== 'running') { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
};

// ---------- 14. Input ----------
function startTrick(type) {
  if (S.arc && !S.land) { S.ap.on = false;     // Easy mode: every aircraft can roll and loop (the autopilot lets go)
    if (S.trick || S.onGround) return; if (S.ra < (type === 'loop' ? 120 : 40)) return toast(L('Climb a little higher first', 'קודם מטפסים קצת')); A.gam = Math.max(A.gam, 0); S.trick = { type, t: 0, ang: 0, dir: (keys.KeyA || keys.ArrowLeft || touch.x < -0.3) ? -1 : 1 }; return; }
  if (!PL.tricks) return toast(L('The ' + PL.name.toLowerCase() + ' is not built for aerobatics. Try the fighter or the aerobatic plane', tr(PL.name) + ' לא בנוי לפעלולים. נסו את מטוס הקרב או את מטוס הפעלולים'), 4);
  if (S.trick || S.land || S.crashed) return;
  if (S.onGround || S.ra < (type === 'loop' ? Math.max(450, S.V * S.V / (G * 2.5)) : 150)) return toast(       /* a fast loop is a big one: it needs the height */L('Climb higher first', 'קודם מטפסים גבוה יותר'));
  if (type === 'loop' && S.V < S.vs0 * (PL.key === 'fighter' || PL.key === 'stealth' ? 2.6 : 1.7)) return toast(L('Need more speed for a loop', 'ללולאה צריך יותר מהירות'));
  S.ap.on = false; S.trick = { type, ang: 0, t: 0, dir: (keys.KeyA || keys.ArrowLeft || touch.x < -0.3) ? -1 : 1 };
}
let moreT = 0, FOLD = null;
/**
 * The folds of the side buttons: weapons, landing, and the rest. One is open at a time, in one slot. `foldOpen(name)` opens one for 7 s (a use of a button
 * inside starts the 7 s again); with none opened by the player the landing fold stands open by itself while its buttons are needed (`foldPin`).
 */
const FOLDS = { more: ['fMore', 'cMore'], land: ['fLand', 'cLandF'], arm: ['fArm', 'cArm'] };
function foldPin() { return S.started && !S.crashed && !$('cLandF').hidden && (S.onGround ? !$('cBrake').hidden : S.mode === 2 && (S.ra < 450 || !!S.land)) ? 'land' : null; }
function foldOpen(name) { clearTimeout(moreT); FOLD = name && !$(FOLDS[name][1]).hidden ? name : null; foldSync(); if (FOLD) moreT = setTimeout(() => foldOpen(null), 7000); }
function foldSync() { const show = FOLD || foldPin(); if (foldSync.was === show) return; foldSync.was = show; for (const k in FOLDS) { $(FOLDS[k][0]).hidden = k !== show; $(FOLDS[k][1]).setAttribute('aria-expanded', String(k === show)); } }
function foldMore(close) { foldOpen(close ? null : FOLD || 'more'); }
/** A button that also answers a second finger: browsers send a click only for a one-finger tap, so with a thumb on the stick no HUD button worked.
    It acts when the finger or mouse button comes up; a click with no pointer (the keyboard) still works. */
function tapButton(b, fn) { b.addEventListener('pointerup', e => { if (e.button === 0 || e.pointerType !== 'mouse') fn(e); }); b.addEventListener('click', e => { if (e.detail === 0) fn(e); }); }
/** Fast forward, as on a video player: the whole world (flight, traffic, weather, the clock) runs at 1, 1.25, 1.5 or 2 times its speed. On touch it is in
    the folded "more" row (the button shows the rate, and so does the "more" button while time runs fast); keys [ and ] on a keyboard; a row in the settings. */
const RATES = [1, 1.25, 1.5, 2], RATE = { i: 0, v: 1 };
function setRate(i, say) { RATE.i = clamp(i | 0, 0, RATES.length - 1); RATE.v = RATES[RATE.i]; const t = '\u200E×' + RATE.v; $('cRate').textContent = t; $('cRate').classList.toggle('on', RATE.v > 1); S.legSig = ''; if (say) toast(L('Speed ', 'מהירות ') + t, 1.4); }
function action(code) {
  if (S.crashed && (code === 'Escape' || code === 'Tab' || code === 'KeyO')) return;          // the crash screen has its own two buttons; a menu or photo mode opened under it left them dead
  if (code === 'Escape' || (code === 'Tab' && !S.paused)) {          /* Tab opens the menu; inside it Tab moves between the buttons, as everywhere */ if (PH.on) return action('KeyO'); return S.paused ? closeMenu() : openMenu(); }
  if (S.paused) return;
  if (code === 'KeyO') { PH.on = !PH.on; document.body.classList.toggle('photo', PH.on); camSnap = true; if (PH.on) for (const k in keys) keys[k] = false; return; }
  if (PH.on) return;
  if (code === 'KeyR') { if (S.lastSpawn) spawn(S.lastSpawn); return; }
  if (code === 'KeyM') return Snd.toggle();
  if (code === 'Rate' || code === 'BracketRight' || code === 'BracketLeft') return setRate(code === 'Rate' ? (RATE.i + 1) % RATES.length : clamp(RATE.i + (code === 'BracketRight' ? 1 : -1), 0, RATES.length - 1), true);
  if (code === 'Enter') return wpnFire(false);
  if (code === 'KeyU') return wpnSelect();
  if (code === 'KeyC') { S.cam = (S.cam + 1) % CAMS.length; camSnap = S.cam === 0 || S.cam === 3; toast(tr(CAMS[S.cam]), 1.6); return; }
  if (code === 'KeyT') { S.tod = (S.tod + 1) % 4; applyTOD(S.tod); return; }
  if (code === 'KeyI') { SAVE.pfd = document.body.classList.toggle('nopfd') ? false : true; persist(); return; }
  if (code === 'KeyK') { if (legendOn()) S.legend = false; else { S.legend = true; SAVE.legendPin = true; } S.legSig = ''; return; }
  if (code === 'KeyY') { WX = (WX + 1) % 3; applyTOD(S.tod); toast(L('Weather: ', 'מזג אוויר: ') + tr(WXN[WX])); return; }
  if (code === 'KeyN') { S.names = !S.names; return; }
  if (code === 'KeyV') { S.smoke = !S.smoke; toast(S.smoke ? L('Smoke trail on', 'שובל עשן פועל') : L('Smoke trail off', 'שובל עשן כבוי')); return; }
  if (S.crashed) return;
  if (code === 'KeyX') return startTrick('roll');
  if (code === 'KeyZ') return startTrick('loop');
  if (code === 'KeyH') { setMode((S.mode + 1) % 3); toast(L('Level: ', 'רמה: ') + L(LV[S.mode][0], LV[S.mode][1]) + '. ' + L(LVD[S.mode][0], LVD[S.mode][1]), 4.5); return; }
  if (code === 'KeyL') {
    if (S.land) { S.land = null; S.holdAlt = null; toast(L('Automatic landing cancelled. You are flying', 'הנחיתה האוטומטית בוטלה. אתם מטיסים')); }
    else if (S.onGround) toast(L('Automatic landing works in the air', 'נחיתה אוטומטית פועלת רק באוויר'));
    else { const t = landTarget();
      if (!t || !t.inRange) toast(L('No airport within 40 km. Nearest: ' + apName(t.ap) + ', ' + kmTxt(t.dist) + ' ' + dirTxt(t.brg) + '. Fly towards it and try again', 'אין שדה תעופה בטווח 40 ק״מ. הקרוב: ' + apName(t.ap) + ', ' + kmTxt(t.dist) + ' ' + dirTxt(t.brg) + '. טסים לכיוונו ומנסים שוב'), 6);
      else { S.landT0 = TNOW; S.land = t.rw; S.landPh = 'intercept'; S.landJoin = false; S.landTries = 0; S.landT = 0; S.ap.on = false; S.trick = null; S.holdAlt = null; toast(L('Automatic landing at ' + apName(t.ap) + ' started. Hands off', 'נחיתה אוטומטית ב' + apName(t.ap) + ' התחילה. לא נוגעים'), 4.5); } }
    return;
  }
  if (code === 'KeyG' && PL.fixedGear) return toast(L('This aircraft has fixed landing gear', 'למטוס הזה גלגלים קבועים'));
  if (code === 'KeyF' && FLAPS.length < 2) return toast(L('This aircraft has no flaps', 'למטוס הזה אין מדפים'));
  if ((S.assist || S.land) && (code === 'KeyG' || code === 'KeyF')) return toast(code === 'KeyG' ? L('Landing gear is automatic now: it comes down by itself before landing', 'הגלגלים אוטומטיים עכשיו: הם יורדים לבד לפני הנחיתה') : L('Flaps are automatic now', 'המדפים אוטומטיים עכשיו'), 4);
  if (code === 'KeyG') { if (S.onGround) toast(L('The gear stays down on the ground', 'על הקרקע הגלגלים נשארים למטה')); else { S.gear = !S.gear; toast(S.gear ? L('Gear coming down', 'גלגלים יורדים') : L('Gear going up', 'גלגלים עולים')); } }
  else if (code === 'KeyF') { if (S.flapIdx >= FLAPS.length - 1) S.flapDir = -1; else if (S.flapIdx <= 0) S.flapDir = 1; S.flapIdx = clamp(S.flapIdx + (S.flapDir || 1), 0, FLAPS.length - 1); toast(L('Flaps ', 'מדפים ') + FLAPS[S.flapIdx] + '°'); }          /* out step by step and back in step by step: full flap never jumps to none */
  else if (code === 'KeyP') {
    if (S.ap.on) { S.ap.on = false; toast(L('Autopilot off', 'טייס אוטומטי כבוי')); }
    else if (S.onGround || S.ra < 60) toast(L('Autopilot needs 200 ft above ground', 'טייס אוטומטי פועל מ-200 רגל מעל הקרקע'));
    else { S.apT0 = TNOW; S.land = null; S.trick = null; S.ap.on = true; S.ap.alt = S.pos.y; S.ap.hdg = S.hdg; S.ap.spd = Math.max(S.V, S.vs0 * 1.3); toast(L('Autopilot holding altitude, heading and speed', 'טייס אוטומטי: שומר גובה, כיוון ומהירות')); }
  }
}
const HANDLED = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyG', 'KeyF', 'KeyB', 'KeyP', 'KeyC', 'KeyT', 'KeyR', 'KeyM', 'KeyH', 'KeyL', 'KeyX', 'KeyZ', 'KeyV', 'KeyI', 'KeyO', 'KeyY', 'KeyN', 'KeyK', 'KeyU', 'Enter', 'BracketLeft', 'BracketRight', 'Space', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Equal', 'Minus', 'PageUp', 'PageDown']);
window.addEventListener('keydown', e => {
  if (PICK.open) return;                 // typing in the place search, not flying
  if (!S.started) { if (e.code === 'Enter' && !$('fly').disabled && (document.activeElement === document.body || !document.activeElement)) $('fly').click(); return; }      // Enter on a focused button presses that button
  const dg = /^Digit(\d)$/.exec(e.code); if (dg && !S.paused && !PH.on) { S.thr = +dg[1] / 9; e.preventDefault(); return; }      // 0 = idle … 9 = full power
  if (S.paused && e.code !== 'Escape') return;                // in the menu the keys belong to the page: Tab, Space, Enter and scrolling work as everywhere
  // browser shortcuts stay the browser's (Ctrl+R reloads, it does not restart the flight). Ctrl alone is the power-down key, so the arrows and Space still fly with it held
  if (e.metaKey || e.altKey || (e.ctrlKey && /^(Key|Digit|Minus|Equal)/.test(e.code))) return;
  if (HANDLED.has(e.code)) { e.preventDefault(); if (!keys[e.code] && !e.repeat) action(e.code); keys[e.code] = true; }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function setupTouch() {
  if (window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) { document.body.classList.add('touch', 'nopfd'); RES.pr = RES.fixed || Math.min(RES.max, 1.5); renderer.setPixelRatio(RES.pr); resize(); }
  // --- the stick floats: the whole lower left of the screen is the stick. It appears under the thumb wherever that comes down, so the hand never has to
  //     find it or stay on a small disc; if the thumb runs past the rim the base follows it; a small dead zone in the middle and a curved response make
  //     small corrections fine and full deflection still within a thumb's reach. At rest a faint ring shows where it is. ---
  const stick = $('stick'), knob = $('knob'), zone = $('stZone'); let sid = null, bx = 0, by = 0;
  const RAD = () => clamp(Math.min(window.innerWidth, window.innerHeight) * 0.17, 56, 86);
  const place = () => { const R = RAD(), r = $('hud').getBoundingClientRect(); stick.style.width = stick.style.height = 2 * R + 'px'; stick.style.left = bx - r.left - R + 'px'; stick.style.top = by - r.top - R + 'px'; stick.style.bottom = 'auto'; };
  const mv = e => { const R = RAD(); let dx = e.clientX - bx, dy = e.clientY - by, m = Math.hypot(dx, dy);
    if (m > R) { bx += dx * (1 - R / m); by += dy * (1 - R / m); dx *= R / m; dy *= R / m; m = R; place(); }            // past the rim: the base comes along
    const DZ = 0.07, k = m / R < DZ ? 0 : Math.pow((m / R - DZ) / (1 - DZ), 1.45) / (m / R);
    touch.x = dx / R * k; touch.y = dy / R * k; touch.on = true; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  const end = e => { if (e && e.pointerId !== sid) return; sid = null; touch.x = touch.y = 0; touch.on = false; knob.style.transform = ''; stick.classList.remove('on'); stick.style.left = stick.style.top = stick.style.bottom = stick.style.width = stick.style.height = ''; };
  zone.addEventListener('pointerdown', e => { if (sid !== null || !S.started || S.paused) return; sid = e.pointerId; try { zone.setPointerCapture(sid); } catch (x) {} bx = e.clientX; by = e.clientY; stick.classList.add('on'); place(); mv(e); e.preventDefault(); });
  zone.addEventListener('pointermove', e => { if (e.pointerId === sid) mv(e); }); zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); window.addEventListener('blur', () => end());
  // --- the power lever is dragged, not poked: touching it changes nothing, sliding the thumb moves it from where it stands (a tap still sets it there);
  //     its touch area is wider than what is drawn, and it gives a short tick at idle and at full power ---
  const th = $('thrT'); let thId = null, ty0 = 0, t0 = 0, moved = false;
  const tick = v => { if ((v === 0 || v === 1) && S.thr !== v && navigator.vibrate) try { navigator.vibrate(8); } catch (x) {} };
  const tm = e => { const h = th.getBoundingClientRect().height - 16; if (Math.abs(e.clientY - ty0) > 6) moved = true; if (!moved) return; const v = clamp(t0 + (ty0 - e.clientY) / h, 0, 1); tick(v); S.thr = v; };
  th.addEventListener('pointerdown', e => { if (thId !== null) return; thId = e.pointerId; try { th.setPointerCapture(thId); } catch (x) {} ty0 = e.clientY; t0 = S.thr; moved = false; });
  th.addEventListener('pointermove', e => { if (e.pointerId === thId) tm(e); });
  th.addEventListener('pointerup', e => { if (e.pointerId !== thId) return; thId = null; if (!moved) { const r = th.getBoundingClientRect(), v = clamp(1 - (e.clientY - r.top - 8) / (r.height - 16), 0, 1); tick(v); S.thr = v; } });
  th.addEventListener('pointercancel', () => thId = null);
  document.querySelectorAll('#ctx button').forEach(b => { const k = b.dataset.k;
    if (!k) return; const stay = ['cWpn', 'cGear', 'cFlap'].includes(b.id), inFold = b.parentNode.classList.contains('fold');
    if (b.dataset.hold) { b.addEventListener('pointerdown', () => { keys[k] = true; clearTimeout(moreT); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (keys[k] && FOLD) foldOpen(FOLD); keys[k] = false; }); }          /* a held button (fire, brake) keeps its fold open while it is in use */
    else tapButton(b, () => { action(k); if (!inFold) return; if (stay) foldOpen(FOLD); else foldOpen(null); }); });          /* a choice folds its group away; gear, flaps and the weapon change are tapped again, so they stay */
  // Land, Roll and Loop are folded behind one "more" button: it opens them, and they fold away again after a choice or a few seconds
  for (const n in FOLDS) tapButton($(FOLDS[n][1]), () => foldOpen(FOLD === n ? null : n));
  setupMapGestures(); $('map').addEventListener('click', () => { if (!mapWasDragged()) $('map').classList.toggle('big'); });
  $('map').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); $('map').classList.toggle('big'); } });
}

// ---------- 15. Menus ----------
let FREE = [], LANDTESTS = [];
/** A picture of each aircraft for its card, rendered once at start-up from the real model against the real sky. */
const PLANE_IMG = {};
function shootPlanes() {
  const w = 320, h = 180, keep = { p: camera.position.clone(), q: camera.quaternion.clone(), a: camera.aspect, f: camera.fov, pr: renderer.getPixelRatio() };
  try { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = 30; if (camera.view) camera.clearViewOffset(); camera.updateProjectionMatrix();
    const at = new THREE.Vector3(lon2x(34.62), 2600, lat2z(32.0)); AC.root.position.copy(at);          /* high over the sea: sky and haze behind, so the aircraft is the picture */ AC.deck.visible = false; if (SHADOW) SHADOW.visible = false;
    for (const k of PLANE_ORDER) { for (const j of PLANE_ORDER) AC.models[j].g.visible = j === k; const big = k === 'airliner' || k === 'bomber' || k === 'concorde', d = PLANES[k].chase[0] * (k === 'concorde' ? 0.86 : k === 'stealth' ? 0.7 : 0.78); AC.root.quaternion.setFromEuler(new THREE.Euler(big ? 0.04 : 0.1, -0.35, big ? 0.06 : k === 'bizjet' ? -0.18 : 0.3, 'YXZ'));          /* each type close up and at its own angle: the big ones level, the nimble ones banked */
      camera.position.set(at.x - d * (big ? 0.66 : 0.52), at.y + d * (k === 'stealth' || k === 'concorde' ? 0.34 : 0.16), at.z - d * (big ? 0.74 : 0.84)); camera.up.set(0, 1, 0); camera.lookAt(at);
      sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000); sun.position.copy(at).addScaledVector(sunDir, 1000); sun.target.position.copy(at); sun.target.updateMatrixWorld();
      const m = AC.models[k]; if (m.burner) m.burner.visible = false; if (m.land) for (const l of m.land) l.visible = false; renderer.render(scene, camera); PLANE_IMG[k] = renderer.domElement.toDataURL('image/jpeg', 0.82); }
  } catch (e) { /* no pictures: the cards fall back to text */ }
  renderer.setPixelRatio(keep.pr); camera.position.copy(keep.p); camera.quaternion.copy(keep.q); camera.fov = keep.f; for (const j of PLANE_ORDER) AC.models[j].g.visible = false; resize();
}
function planeCards(el, onPick) {
  el.textContent = ''; el.classList.add('planes');
  for (const k of PLANE_ORDER) { const p = PLANES[k], b = document.createElement('button'); b.className = 'pl' + (k === PL.key ? ' on' : ''); b.innerHTML = (PLANE_IMG[k] ? '<img alt="" src="' + PLANE_IMG[k] + '">' : '') + '<b></b><small></small>'; b.querySelector('b').textContent = tr(p.name); b.lastChild.textContent = tr(p.tag);
    b.addEventListener('click', () => onPick(k)); el.appendChild(b); }
  const on = el.querySelector('.on'); if (on) requestAnimationFrame(() => { el.scrollLeft = on.offsetLeft - el.offsetLeft - (el.clientWidth - on.offsetWidth) / 2; });          // the chosen aircraft is in view
}
function gridButtons(el, items) {
  el.textContent = '';
  for (const [title, sub, fn, on] of items) { const b = document.createElement('button'); if (on) b.className = 'on'; b.textContent = tr(title); if (sub) { const s = document.createElement('small'); s.textContent = tr(sub); b.appendChild(s); }
    b.addEventListener('click', fn); el.appendChild(b); }
}
/** The start screen and the pause menu share one set of folded sections, in the same order, built here. where: 'start' or 'pause'.
    On the start screen a choice is only selected (FLY starts from it); in the pause menu a start point or aircraft starts at once. */
let START = null, TAKEOFFS = [], AIRSTARTS = [];
let PLHOLD = false;          // true once the player picked an aircraft after the start point: spawn then leaves the aircraft alone
const OPEN = { start: new Set(['pl', 'lv']), pause: new Set(['pl', 'lv']) };
const startName = (d, short) => d.pick ? L(d.name[0], d.name[1]) : d.type === 'ground' && short ? apName(AIRPORTS[d.rw.ap]) : tr(d.label.replace('Approach: ', ''));
function renderPanel(where) {
  const body = $(where === 'start' ? 'sBody' : 'mBody'), touchUI = document.body.classList.contains('touch'), cur = where === 'start' ? (START || FREE[0]) : S.lastSpawn, rer = () => renderPanel(where);
  const go = d => where === 'start' ? () => { PLHOLD = false; START = d; if (WORLD.ready) { spawn(d); $('toast').style.display = 'none'; } rer(); } : () => { PLHOLD = false; closeMenu(); spawn(d); };
  const pickPlane = k => { PLHOLD = true; if (!WORLD.ready) { PL = PLANES[k] || PL; SAVE.plane = PL.key; persist(); return rer(); }          /* the models are not built yet: the choice is kept and applied when they are */ selectPlane(k); if (where === 'start') { spawn(START || FREE[0]); $('toast').style.display = 'none'; rer(); } else { closeMenu(); if (S.onGround || S.crashed) spawn(S.lastSpawn || FREE[0]); else spawn({ type: 'air', x: S.pos.x, z: S.pos.z, agl: Math.max(S.ra, 120), hdg: S.hdg, spd: 120, label: L('New aircraft, same place', 'מטוס חדש, אותו מקום'), keep: true }); } };          /* in the air the new aircraft carries on from where the old one was */
  const starts = (list, short) => el => gridButtons(el, list.map(d => [startName(d, short), '', go(d), d === cur]));
  const secs = [
    ['pl', L('Aircraft', 'מטוס'), tr(PL.name), el => planeCards(el, pickPlane)],
    ['lv', L('Difficulty', 'רמת קושי'), L(LV[S.mode][0], LV[S.mode][1]), el => levelButtons(el, rer)],
    ['tk', L('Take off from a runway', 'המראה ממסלול'), TAKEOFFS.includes(cur) ? startName(cur, true) : '', starts(TAKEOFFS, true)],
    ['air', L('Start in the air', 'התחלה באוויר'), AIRSTARTS.includes(cur) || (cur && cur.pick) ? startName(cur) : '', el => { starts(AIRSTARTS)(el); surpriseButton(el, where, rer); pickButton(el, where, cur, rer); }],
    ['ap', L('Practise a landing', 'תרגול נחיתה'), LANDTESTS.includes(cur) ? startName(cur) : '', starts(LANDTESTS)],
    ['set', L('Settings', 'הגדרות'), [todName(S.tod), tr(WXN[WX])].join(' · '), el => settingsRows(el, where, rer)]];
  if (!touchUI) secs.push(['keys', L('Keyboard keys', 'מקשי מקלדת'), '', keyList]);
  const open = OPEN[where]; body.textContent = '';
  for (const [id, title, val, fill] of secs) {
    const d = document.createElement('details'); d.className = 'sec'; d.open = open.has(id); d.addEventListener('toggle', () => { if (d.open) open.add(id); else open.delete(id); });
    const s = document.createElement('summary'); s.textContent = title; if (val) { const sm = document.createElement('small'); sm.textContent = val; s.appendChild(sm); }
    const c = document.createElement('div'); if (id !== 'set' && id !== 'keys') c.className = 'grid'; fill(c); d.append(s, c); body.appendChild(d); }
  $(where === 'start' ? 'sSum' : 'mSum').textContent = where === 'pause' ? [L('Nearest airport: ', 'שדה התעופה הקרוב: ') + nearestAirportTxt(), tr(PL.name), L(LV[S.mode][0], LV[S.mode][1])].join(' · ') : [tr(PL.name), L(LV[S.mode][0], LV[S.mode][1]), cur ? startName(cur) : ''].filter(Boolean).join(' · ');
}
/** Photo mode: keep the picture. The frame is drawn again and taken from the canvas at once; a phone offers its share sheet (with the file), anything
    else downloads it. */
function savePhoto() {
  try { renderFrame(); renderer.domElement.toBlob(b => { if (!b) return; const f = new File([b], 'flight-over-israel.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(() => {});
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); } }, 'image/jpeg', 0.92); } catch (e) {}
}
/** "Surprise me": a famous place, an aircraft and a time of day drawn at random (never the same twice running). */
const SURPRISE = [[34.76, 32.06, 350, 20], [35.20, 31.775, 500, 80], [35.0, 32.84, 450, 200], [35.45, 31.45, 300, 180], [34.80, 30.60, 600, 60], [35.78, 33.28, 900, 30], [34.95, 29.60, 400, 190], [35.55, 32.78, 350, 0], [35.36, 31.33, 500, 20], [34.90, 32.50, 250, 180], [35.30, 32.70, 500, 250], [34.65, 31.80, 300, 30]];
function surpriseButton(el, where, rer) {
  const b = document.createElement('button'); b.className = 'pickB'; b.textContent = '🎲 ' + L('Surprise me', 'תפתיעו אותי'); const s = document.createElement('small'); s.textContent = L('A place, an aircraft and a time of day at random', 'מקום, מטוס ושעה ביום באקראי'); b.appendChild(s);
  b.addEventListener('click', () => { let i; do i = (Math.random() * SURPRISE.length) | 0; while (i === surpriseButton.last); surpriseButton.last = i; PLHOLD = false; const [lon, lat, agl, hdg] = SURPRISE[i], k = PLANE_ORDER[(Math.random() * PLANE_ORDER.length) | 0];
    const d = { label: 'A surprise flight', type: 'air', lon, lat, agl, hdg, spd: 115, tod: Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2, wx: 0 };
    if (WORLD.ready) selectPlane(k); else { PL = PLANES[k]; SAVE.plane = k; persist(); } if (where === 'start') { START = d; if (WORLD.ready) { spawn(d); $('toast').style.display = 'none'; } rer(); } else { closeMenu(); spawn(d); } });
  el.insertBefore(b, el.firstChild);
}
/** First in the air starts: any place in Israel, chosen on a map or by name (src/07b-picker.js). Shows the place chosen last. */
function pickButton(el, where, cur, rer) {
  const b = document.createElement('button'), on = !!(cur && cur.pick); b.className = 'pickB' + (on ? ' on' : ''); b.textContent = '📍 ' + (on ? startName(cur) : L('Choose any place on the map', 'בחירת מקום כלשהו על המפה'));
  const s = document.createElement('small'); s.textContent = on ? L('Choose another place', 'בחירת מקום אחר') : L('Search a town or site, or tap the map', 'חיפוש ישוב או אתר, או הקשה על המפה'); b.appendChild(s);
  b.disabled = !WORLD.ready;          /* the picker draws on the baked map */
  b.addEventListener('click', () => openPicker(where, rer)); el.insertBefore(b, el.firstChild);
}
/** Settings as rows of option buttons: every choice visible, the current one marked (aria-pressed). */
function settingsRows(el, where, rer) {
  const touchUI = document.body.classList.contains('touch');
  const row = (label, opts, cur, set) => { const r = document.createElement('div'), sp = document.createElement('span'), g = document.createElement('div'); r.className = 'seg'; sp.textContent = label; g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
    opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = o; b.setAttribute('aria-pressed', String(i === cur)); b.addEventListener('click', () => { if (i !== cur) { set(i); persist(); rer(); } }); g.appendChild(b); }); r.append(sp, g); el.appendChild(r); };
  const onOff = [L('On', 'פועל'), L('Off', 'כבוי')];
  row(L('Language', 'שפה'), ['עברית', 'English'], SAVE.lang === 'he' ? 0 : 1, i => { SAVE.lang = i ? 'en' : 'he'; persist(); applyLang(); });
  row(touchUI ? L('Stick forward', 'ג׳ויסטיק קדימה') : L('Up arrow', 'חץ למעלה'), [L('Climbs', 'מעלה את המטוס'), L('Descends, like a real stick', 'מוריד, כמו מוט אמיתי')], SAVE.inv ? 1 : 0, i => { SAVE.inv = !!i; persist(); S.legSig = ''; });
  row(L('Time of day', 'שעה ביום'), [0, 1, 2, 3].map(todName), S.tod, i => { S.tod = i; applyTOD(i); });
  row(L('Weather', 'מזג אוויר'), WXN.map(tr), WX, i => { WX = i; applyTOD(S.tod); });
  row(L('View', 'מבט'), CAMS.map(tr), S.cam, i => { S.cam = i; camSnap = true; });
  if (touchUI) row(L('Steering', 'היגוי'), [L('Thumb stick', 'ג׳ויסטיק'), L('Tilt the phone', 'הטיית הטלפון')], SAVE.tilt | 0, i => { SAVE.tilt = i; if (i) tiltStart(); else tiltStop(); });
  if (where === 'pause') row(L('Speed of time', 'מהירות הזמן'), RATES.map(r => '×' + r), RATE.i, i => setRate(i));
  // weapons: on the firing ranges only (the default), or anywhere, which is behind a grown-up's question (the child lock)
  row(L('Graphics', 'גרפיקה'), [L('Automatic', 'אוטומטי'), L('Fast', 'מהיר'), L('Best', 'מרבי')], SAVE.gfx | 0, i => { SAVE.gfx = i; applyGfx(i); });
  row(L('Speed units', 'יחידות מהירות'), U_SPD.map(u => L(u[1], u[2])), SAVE.uSpd | 0, i => { SAVE.uSpd = i; });
  row(L('Distance units', 'יחידות מרחק'), [L('km', 'ק״מ'), L('miles', 'מייל'), L('nautical miles', 'מייל ימי')], SAVE.uDist | 0, i => { SAVE.uDist = i; });
  row(L('Height units', 'יחידות גובה'), [L('feet', 'רגל'), L('metres', 'מטר')], SAVE.uAlt | 0, i => { SAVE.uAlt = i; });
  row(L('Place names', 'שמות מקומות'), [L('Shown', 'מוצגים'), L('Hidden', 'מוסתרים')], S.names ? 0 : 1, i => { S.names = !i; });
  row(L('Instruments', 'מכשירים'), [L('Simple', 'פשוטים'), L('Full', 'מלאים')], document.body.classList.contains('nopfd') ? 0 : 1, i => { document.body.classList.toggle('nopfd', !i); SAVE.pfd = !!i; });
  row(L('Smoke trail', 'שובל עשן'), onOff, S.smoke ? 0 : 1, i => { S.smoke = !i; });
  row(L('Sound', 'קול'), onOff, Snd.muted ? 1 : 0, i => { if (!!Snd.muted !== !!i) Snd.toggle(); });
  if (!touchUI) row(L('Key guide on screen', 'מדריך מקשים על המסך'), [L('Always', 'תמיד'), L('At the start of a flight', 'בתחילת טיסה'), L('Hidden', 'מוסתר')], !S.legend ? 2 : SAVE.legendPin ? 0 : 1, i => { S.legend = i < 2; SAVE.legendPin = i === 0; S.legSig = ''; });
  if (where === 'pause') { const b = document.createElement('button'); b.className = 'sec2'; b.style.marginTop = '10px'; b.textContent = L('Photo mode: look at the aircraft from any side', 'מצב צילום: מסתכלים על המטוס מכל צד');
    b.addEventListener('click', () => { closeMenu(); action('KeyO'); }); el.appendChild(b); }
}
const todName = i => i === 3 ? L('Passing', 'מתחלף') : SAVE.lang === 'he' ? tr(TOD[i].name.toLowerCase()) : TOD[i].name[0] + TOD[i].name.slice(1).toLowerCase();
const KEYS = [['Climb / descend', 'טיפוס / ירידה', '↑ / ↓ · W / S'], ['Turn left / right', 'פנייה שמאלה / ימינה', '← / → · A / D'], ['Power up / down', 'הספק למעלה / למטה', 'Shift / Ctrl · = / −'], ['Set power directly', 'קביעת הספק ישירה', '0 – 9'],
  ['Brakes', 'בלמים', 'B · Space'], ['Land automatically', 'נחיתה אוטומטית', 'L'], ['Menu and pause', 'תפריט והפסקה', 'Esc'], ['Change view', 'החלפת מבט', 'C'], ['Look around', 'מבט מסביב', L('drag the view', 'גוררים את התמונה')], ['Restart from the same point', 'התחלה מחדש מאותה נקודה', 'R'],
  ['Day / sunset / night', 'יום / שקיעה / לילה', 'T'], ['Weather', 'מזג אוויר', 'Y'], ['Place names', 'שמות מקומות', 'N'], ['Photo mode', 'מצב צילום', 'O'], ['Simple / full instruments', 'מכשירים פשוטים / מלאים', 'I'],
  ['Key guide on screen', 'מדריך מקשים על המסך', 'K'], ['Autopilot', 'טייס אוטומטי', 'P'], ['Roll / loop', 'גלגול / לולאה', 'X / Z'], ['Smoke trail', 'שובל עשן', 'V'], ['Sound on / off', 'קול', 'M'], ['Next difficulty level', 'רמת הקושי הבאה', 'H'],
  ['Expert: gear, flaps, rudder', 'מקצועי: גלגלים, מדפים, הגה כיוון', 'G · F · Q / E']];
function keyList(el) { el.className = 'keysL'; for (const [en, he, k] of KEYS) { const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('b'); a.textContent = L(en, he); b.textContent = k; b.dir = 'ltr'; d.append(a, b); el.appendChild(d); } }
function openMenu() { if (!S.started) return; document.body.classList.add('paused'); S.paused = true; for (const k in keys) keys[k] = false; renderPanel('pause'); $('menu').style.display = 'flex'; $('menu').scrollTop = 0; }
function closeMenu() { TILT.need = true; document.body.classList.remove('paused'); S.paused = false; $('menu').style.display = 'none'; $('toast').style.display = 'none'; }
/** Android browsers can wipe 2D canvases after a GPU reset (memory pressure, a heavy settings change) or while the tab sleeps.
    Every canvas the scene keeps as a texture, and the baked map image, would come back blank: a black minimap and invisible
    place names. Each one is saved once as a PNG and repainted when its canvas, or the WebGL context, is restored, and a
    reference pixel of the map image is checked every few seconds and whenever the page comes back into view. */
const GUARD = { list: [], busy: false };
function setupCanvasGuard() {
  const byCanvas = new Map(), add = (c, tex) => {
    if (!(c instanceof HTMLCanvasElement) || c === pfdC || c === mapC || !c.width || !c.height) return;
    let e = byCanvas.get(c); if (!e) { e = { c, texs: [], blob: null }; byCanvas.set(c, e); GUARD.list.push(e); c.toBlob(b => e.blob = b); c.addEventListener('contextrestored', () => repaintCanvas(e)); }
    if (tex && !e.texs.includes(tex)) e.texs.push(tex); };
  const scan = m => { if (!m) return; for (const k in m) { const v = m[k]; if (v && v.isTexture) add(v.image, v); } if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture) add(v.image, v); } };
  scene.traverse(o => { if (Array.isArray(o.material)) o.material.forEach(scan); else scan(o.material); });
  add(mapImg, null);
  // the reference pixel: the middle of the map image is land, never transparent
  const mx = mapImg.getContext('2d'); GUARD.ref = [mapImg.width >> 1, mapImg.height >> 1]; GUARD.refA = mx.getImageData(GUARD.ref[0], GUARD.ref[1], 1, 1).data[3];
  renderer.domElement.addEventListener('webglcontextrestored', repaintAll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(checkCanvases, 300); });
  setInterval(checkCanvases, 3000);
}
function checkCanvases() { if (GUARD.busy || !GUARD.refA) return; const a = mapImg.getContext('2d').getImageData(GUARD.ref[0], GUARD.ref[1], 1, 1).data[3]; if (a !== GUARD.refA) repaintAll(); }
function repaintAll() { GUARD.busy = true; Promise.all(GUARD.list.map(repaintCanvas)).then(() => { GUARD.busy = false; mapLbl = null; drawMap(); }); }
function repaintCanvas(e) {
  if (!e.blob) return Promise.resolve();
  return createImageBitmap(e.blob).then(bmp => { const x = e.c.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.drawImage(bmp, 0, 0); x.restore(); bmp.close && bmp.close();
    for (const t of e.texs) t.needsUpdate = true; }).catch(() => {});
}
function buildMenu() {
  FREE = [
    { label: 'Takeoff: Ben Gurion Airport', type: 'ground', rw: RUNWAYS[0] },
    { label: 'Coastline: Tel Aviv', type: 'air', lon: 34.72, lat: 31.98, alt: 500, hdg: 15, spd: 115 },
    { label: 'Flyover: Jerusalem', type: 'air', lon: 35.03, lat: 31.775, alt: 1750, hdg: 88, spd: 120 },
    { label: 'Low pass: Dead Sea', type: 'air', lon: 35.52, lat: 31.80, alt: -250, hdg: 190, spd: 115 },
    { label: 'Crater run: Makhtesh Ramon', type: 'air', lon: 34.60, lat: 30.50, alt: 1500, hdg: 65, spd: 120 },
    { label: 'Snow line: Mount Hermon', type: 'air', lon: 35.60, lat: 33.12, alt: 2750, hdg: 40, spd: 125 },
    { label: 'Sea of Galilee', type: 'air', lon: 35.50, lat: 32.62, alt: 400, hdg: 20, spd: 115 }
  ];
  // a takeoff from every airport; rev: from the far end of the runway, towards open ground (Haifa over the bay, Rosh Pina towards the Kinneret, Beer Sheva towards the plain)
  TAKEOFFS = [FREE[0], { label: 'Takeoff: Haifa', type: 'ground', rw: RUNWAYS[2], rev: true }, { label: 'Takeoff: Eilat Ramon', type: 'ground', rw: RUNWAYS[3] },
    { label: 'Takeoff: Rosh Pina', type: 'ground', rw: RUNWAYS[4], rev: true }, { label: 'Takeoff: Masada (Bar Yehuda)', type: 'ground', rw: RUNWAYS[5] }, { label: 'Takeoff: Beer Sheva', type: 'ground', rw: RUNWAYS[6], rev: true }];
  AIRSTARTS = FREE.slice(1);
  // two more invitations: the city by night and a storm (they set the time of day and the weather too)
  AIRSTARTS.push({ label: 'Concorde at Mach 2', type: 'air', lon: 34.95, lat: 29.75, alt: 17000, hdg: 4, spd: 478, plane: 'concorde', thr: 1 });          // already up where it flies twice as fast as sound, heading up the length of the country
  // the two firing ranges (an unarmed aircraft is exchanged for the fighter)
  AIRSTARTS.push({ label: 'Firing range: the Negev', type: 'air', lon: 34.78, lat: 30.335, alt: 1500, hdg: 0, spd: 115, armed: true }, { label: 'Firing range: the sea', type: 'air', lon: 34.36, lat: 32.13, alt: 800, hdg: 0, spd: 115, armed: true });
  AIRSTARTS.push({ label: 'Tel Aviv at night', type: 'air', lon: 34.74, lat: 32.03, alt: 420, hdg: 30, spd: 115, tod: 2, wx: 0 }, { label: 'Storm over Haifa', type: 'air', lon: 34.93, lat: 32.74, alt: 700, hdg: 40, spd: 115, tod: 0, wx: 2 });
  LANDTESTS = [
    { label: 'Approach: Ben Gurion runway 12', type: 'approach', rw: RUNWAYS[1], dist: 2700, flaps: 3, gear: true },
    { label: 'Approach: Haifa over the bay', type: 'approach', rw: RUNWAYS[2], dist: 2600, flaps: 3, gear: true },
    { label: 'Approach: Eilat Ramon', type: 'approach', rw: RUNWAYS[3], dist: 2700, flaps: 3, gear: true }
  ];
}

/** With a menu sheet open, shift the picture so the aircraft sits in the clear part of the screen: beside the sheet, or above it on an upright phone. */
function menuOffset() { const w = window.innerWidth, h = window.innerHeight; if (h > w && w < 760) camera.setViewOffset(w, h, 0, h * 0.26, w, h); else camera.setViewOffset(w, h, -Math.min(220, w * 0.2), 0, w, h); }
// ---------- 16. Main loop ----------
let last = 0, frame = 0;
function loop(now) {
  const pT = PERF.on ? performance.now() : 0;
  if (last && S.started && !S.paused) autoRes(now - last);
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frame++;
  const run = S.started && !S.paused && !PH.on, sdt = dt * (run ? RATE.v : 1); if (run || !S.started) TNOW += sdt;          // sdt: the time the world lives through this frame (faster with the time setting)
  if (run) {
    for (let k = 0, n = RATE.v > 1 ? 2 : 1, dt = sdt / n; k < n && !S.crashed; k++) {          /* two steps per frame when time runs fast, so each step stays as short as at normal speed */
      if (!S.arc || S.land || S.ap.on) { A.sync = true; readAttitude(); updateControls(dt); for (let i = 0; i < 2 && !S.crashed; i++) physics(dt / 2); } else arcadeStep(dt);
      if (!S.crashed && (!S.onGround || S.V > 4)) {          // buildings and other aircraft are solid, also for an aircraft rolling on the ground
        if (hitObstacle(S.pos.x, S.pos.y - GEAR_H * 0.5, S.pos.z, PL.chase[0] * 0.12)) crash(L('Flew into a building.', 'התנגשות בבניין'));
        else if (!S.onGround) for (const a of AIT) if (a.g.position.distanceToSquared(S.pos) < 900) { crash(L('Mid-air collision.', 'התנגשות באוויר')); break; } }
      updateSystems(dt); readAttitude(); emitTrails(dt); if (frame % 20 === 0) updatePlace();
    }
    updateExplosion(dt); if (S.crashed && S.crashT > 0) { S.crashT -= dt; if (S.crashT <= 0) $('crash').style.display = 'flex'; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.display = 'none'; }
  }
  if (S.started) {
    const full = !document.body.classList.contains('nopfd');
    if (full || S.cam === 0) drawPFD(); if (frame % 4 === 0) drawMap(); if (frame % 5 === 0) drawSys();
    if (S.cam === 0) { AC.pfdTex.needsUpdate = true; if (frame % 4 === 0) AC.mapTex.needsUpdate = true; }
    Snd.update(); if (PH.on) photoCamera(); else { updateCamera(run ? dt : 0); if (S.paused) menuOffset(); } if (frame % 10 === 0) updateLabels();
  } else {                                           // slow orbit behind the start screen
    menuOffset(); const a = TNOW * 0.12, d = PL.chase[0] * 1.5; camera.position.set(S.pos.x + Math.cos(a) * d, S.pos.y + PL.chase[1] * 0.6, S.pos.z + Math.sin(a) * d); camPos.copy(camera.position);
    AC.root.position.copy(S.pos); AC.root.quaternion.copy(S.q); AC.m.g.visible = true; AC.deck.visible = false; camera.lookAt(S.pos); sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000);
    sun.position.copy(S.pos).addScaledVector(sunDir, 1000); sun.target.position.copy(S.pos); sun.target.updateMatrixWorld(); if (AC.m.burner) AC.m.burner.visible = false;
  }
  ENV.uTime.value = TNOW; skyU.uT.value = TNOW; if (TR) TR.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * DEG / 2));
  if ((run || !S.started) && cloudMat) cloudMat.uniforms.uDrift.value += 6 * dt;
  if (!loop.cull || loop.cullN !== cityMeshes.length + LMK.meshes.length + SITE.meshes.length) { loop.cull = [...cityMeshes, ...LMK.meshes, ...SITE.meshes]; loop.cullN = loop.cull.length; }      // one list, not a new one every frame
  for (const m of loop.cull) { const u = m.userData, dx = Math.max(0, Math.abs(camera.position.x - u.x) - (u.half || 0)), dz = Math.max(0, Math.abs(camera.position.z - u.z) - (u.half || 0)); m.visible = Math.hypot(dx, dz) < u.far; }   // distance cull, to the nearest edge of each bucket
  updateScatter(); if (run || !S.started) { updateTrains(sdt); updateAIT(sdt); updateWeather(sdt); todTick(sdt); updateTraffic(sdt); for (const h of turbines) h.rotation.z += h.userData.v * sdt; }
  updateExtras(dt, run, run || !S.started); updateWeapons(sdt, run);
  if (PERF.on) { PERF.acc(performance.now() - pT); if (PERF.busy) return; }          /* ?perf=1: the measurement draws its own frames */
  renderFrame();
}

/** Keep the screen on while flying: phones would otherwise dim and lock while the pilot only watches. The Screen Wake Lock API where
    there is one (the browser drops the lock when the page is hidden, so it is asked for again on return); elsewhere (older iOS) a tiny
    muted video that keeps playing does the same. */
const WAKE = { lock: null, video: null };
function keepAwake() {
  if (document.visibilityState !== 'visible') return;
  if ('wakeLock' in navigator) { if (!WAKE.lock) navigator.wakeLock.request('screen').then(l => { WAKE.lock = l; l.addEventListener('release', () => { WAKE.lock = null; }); }).catch(() => {}); return; }
  try { if (!WAKE.video) { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); setInterval(() => { x.fillStyle = Date.now() % 2000 < 1000 ? '#000' : '#010101'; x.fillRect(0, 0, 2, 2); }, 1000);
      const v = WAKE.video = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true; v.srcObject = c.captureStream(1);
      v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none'; document.body.appendChild(v); }
    WAKE.video.play().catch(() => {}); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (S.started && document.visibilityState === 'visible') keepAwake();
  if (Snd.ctx) { if (document.hidden) Snd.ctx.suspend(); else if (S.started) Snd.ctx.resume(); } });          // no engine drone from a tab in the background

// leaving the page in mid-flight asks first: Ctrl (power down) with W (climb) is the browser's close-tab shortcut, which a page cannot block
window.addEventListener('beforeunload', e => { saveFlight(); if (S.started && !S.crashed) { e.preventDefault(); e.returnValue = ''; } });
/* The game must not end by accident.
   - Back (the phone's button or a swipe from the edge) does not leave a flight: it opens the menu, and Back again returns to the flight. A history entry is
     kept in front of the page for that; from the start screen, before a flight, Back leaves as usual.
   - Pulling the page down does not reload it (overscroll-behavior in the CSS); a long press opens no browser menu; a pinch does not zoom the page.
   - If the page is closed or reloaded anyway (the tab was put to sleep, a crash, a mistaken reload), the flight is saved every few seconds and the start screen
     offers to continue it. */
function guardBack() { try { history.pushState({ ifs: 1 }, ''); } catch (e) { /* no history: nothing to guard */ } }
window.addEventListener('popstate', () => {
  if (PICK.open) { closePicker(); return guardBack(); }
  if (!S.started) return;                                  // on the start screen Back leaves, as everywhere
  if (PH.on) action('KeyO'); else if (S.crashed) { if ($('crash').style.display === 'flex') $('again').click(); } else if (S.paused) closeMenu(); else openMenu();          /* on the crash screen Back is its main button */
  guardBack();
});
document.addEventListener('contextmenu', e => { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, e => e.preventDefault());
canvas.addEventListener('webglcontextlost', e => e.preventDefault());                 // lets the browser restore the picture instead of leaving it black
/** The flight as it is now, for continuing after the page was closed: position, height, heading, speed, aircraft, level. */
function saveFlight() { try { if (!S.started || S.crashed || S.onGround) { if (S.started) localStorage.removeItem('ifs-flight'); return; }
  localStorage.setItem('ifs-flight', JSON.stringify({ x: S.pos.x, z: S.pos.z, y: S.pos.y, hdg: S.hdg, v: S.V, plane: PL.key, t: Date.now() })); } catch (e) { /* no storage */ } }
function savedFlight() { try { const f = JSON.parse(localStorage.getItem('ifs-flight') || 'null'); if (!f || Date.now() - f.t > 45 * 60000 || ![f.x, f.z, f.y, f.hdg, f.v].every(Number.isFinite) || f.x < X0 || f.x > X1 || f.z < Z0 || f.z > Z1 || !PLANES[f.plane]) return null;
  return { type: 'air', label: 'Continue the last flight', x: f.x, z: f.z, alt: Math.max(f.y, groundAt(f.x, f.z).h + 150), hdg: f.hdg, spd: clamp(f.v / PLANES[f.plane].vc, 0.6, 1.6) * 120, plane: f.plane }; } catch (e) { return null; } }

// ---------- 17. Boot ----------
/** The world behind the choice screen: `ready` once it is built, `wantFly` when FLY was pressed before that (the flight then starts by itself). */
const WORLD = { ready: false, wantFly: false };
const worldFailed = e => { console.error(e); try { localStorage.removeItem('ifs-save'); } catch (x) {}      /* a damaged save must not fail again after the reload */ $('fly').textContent = '!'; $('fly').disabled = true; $('sBody').textContent = ''; document.body.classList.remove('building');
  $('intro').textContent = document.documentElement.lang === 'he' ? 'משהו השתבש בזמן בניית המפה. נסו לטעון את הדף מחדש.' : 'Something went wrong while building the map. Please reload the page.'; };
function startFlight() {
  if (SAVE.tilt && document.body.classList.contains('touch')) tiltStart();          // the motion sensor may only be asked for from a tap, and this is one
  const fly = $('fly'); if (!WORLD.ready) { WORLD.wantFly = true; fly.classList.add('busy'); Snd.init(); return; }          // pressed while the map is still being built: it starts as soon as it is there
  Snd.init(); if (Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume(); S.started = true; keepAwake(); camSnap = S.cam !== 1;          /* in the chase view the camera glides in from where the start screen's orbit left it */ $('start').style.display = 'none'; $('hud').style.display = 'block';
  if (S.mode === 1 && S.onGround) toast(L('Push the power to full. The ' + PL.name.toLowerCase() + ' takes off by itself', 'מעלים את ההספק עד הסוף. ה' + tr(PL.name) + ' ממריא לבד'), 4);
}
/** Step 1, as soon as the scripts are in: the choice screen. Nothing here needs the world. */
function init() {
  if (window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch', 'nopfd');          // before the first screen is drawn, so a phone never shows the keyboard section
  buildMenu(); PL = PLANES[SAVE.plane] || PLANES.airliner; setMode(SAVE.mode);
  { const rf = savedFlight(); if (rf) { PL = PLANES[rf.plane] || PL; START = rf; AIRSTARTS.unshift(rf); } }          // a flight that was cut off (the page closed or reloaded) is offered first
  if (SAVE.first && !START) START = FREE[1];             // a first visit starts in the air over the Tel Aviv coast: flying at once, with the city ahead (a take-off takes half a minute and ends over the sea)
  const fly = $('fly'); fly.disabled = false; $('langB').style.visibility = ''; document.body.classList.add('ready', 'building'); applyLang();
  $('langB').addEventListener('click', () => { SAVE.lang = SAVE.lang === 'he' ? 'en' : 'he'; persist(); applyLang(); });
  fly.addEventListener('click', startFlight);
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(ev, () => Snd.wake(), { capture: true, passive: true });          // every touch checks that the sound is awake
  tapButton($('menuB'), () => { openMenu(); $('menuB').blur(); });
  tapButton($('modeB'), () => { OPEN.pause.add('lv'); openMenu(); $('modeB').blur(); });     // the level chip opens the menu at the levels, it does not switch level by itself
  $('resume').addEventListener('click', closeMenu); $('mClose').addEventListener('click', closeMenu);
  const uncover = () => { if (S.paused) closeMenu(); if (PH.on) { PH.on = false; document.body.classList.remove('photo'); } };
  // after a crash: in Easy the main button puts the aircraft straight back in the air where it was (a child wants to fly on, not to start over); in the other levels it starts the flight again
  const again = () => { uncover(); spawn(S.lastSpawn || FREE[0]); }, airborne = () => { uncover(); spawn({ type: 'air', x: S.pos.x, z: S.pos.z, agl: 600, hdg: S.hdg, spd: 120, label: L('Back in the air', 'חזרה לאוויר'), keep: true }); };
  $('again').addEventListener('click', () => (S.arc ? airborne : again)()); $('airborne').addEventListener('click', () => (S.arc ? again : airborne)());
}
/** Step 2, behind the choice screen: the world, one builder at a time with a breath between them, so the screen keeps answering taps. */
async function buildWorld() {
  const breath = () => new Promise(r => setTimeout(r, 0)), hold = +(new URLSearchParams(location.search).get('hold')) || 0; if (hold) await new Promise(r => setTimeout(r, hold));
  for (const f of [buildHeights, buildTerrain, buildWater, buildAirports, buildScatter, buildCities, buildLandmarks, buildRoads, buildDetails, buildIsrael, buildCityLandmarks, buildSites, buildRivers, buildBoom, buildLabels, bakeMap, buildSkyObjects, buildAircraft, buildGameObjects, buildExtras, buildWeapons]) { f(); await breath(); }
  buildFun(); setupPicker(); setupLook(); buildShadow(); applyTOD(0); setupTouch(); selectPlane(PL.key); setMode(S.mode); setupCanvasGuard(); await breath();
  // settings from the last visit
  if (SAVE.gfx) applyGfx(SAVE.gfx);
  if (SAVE.tod) S.tod = SAVE.tod; if (SAVE.wx) WX = SAVE.wx; if (SAVE.tod || SAVE.wx) applyTOD(S.tod); if (SAVE.cam !== undefined) S.cam = SAVE.cam; if (SAVE.names === false) S.names = false; if (SAVE.smoke !== undefined) S.smoke = SAVE.smoke; if (SAVE.legend === false) S.legend = false; Snd.muted = !!SAVE.muted; Snd.sync();          /* sync: the sound may already be running (FLY pressed while the world was being built) */
  shootPlanes(); await breath(); selectPlane(PL.key); spawn(START || FREE[0]); $('toast').style.display = 'none'; readAttitude(); drawMap(); SAVE.ready = true; WORLD.ready = true; document.body.classList.remove('building'); guardBack(); setInterval(() => { if (S.started) { persist(); saveFlight(); } }, 5000);
  renderPanel('start'); requestAnimationFrame(loop);
  if (WORLD.wantFly) { $('fly').classList.remove('busy'); startFlight(); }
}
if (typeof THREE === 'undefined') { $('fly').textContent = '!'; $('intro').textContent = document.documentElement.lang === 'he' ? 'לא הצלחנו לטעון את מנוע התלת-ממד. בדקו את החיבור לאינטרנט וטענו מחדש.' : 'Could not load the 3D engine. Check your connection and reload.'; $('sBody').textContent = ''; }
else {      // the choice screen first; meanwhile the rasters are decoded (settlements from GHSL, land cover and buildings from OpenStreetMap) and the world is built from them
  const load = src => new Promise((res, rej) => { const im = new Image(); im.onerror = () => rej(new Error('image')); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res({ w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }); }; im.src = src; });
  try { init(); } catch (e) { worldFailed(e); }
  Promise.all([load(BLD_PNG), load(LC_PNG), load(BO_PNG)]).then(([b, l, o]) => { BLD = b; LCR = l; BOR = o; return buildWorld(); }).catch(worldFailed); }
