'use strict';
// ---------- 13. Procedural audio ----------
const Snd = { ctx: null, muted: false,
  init() {
    const A = window.AudioContext || window.webkitAudioContext; if (!A || this.ctx) return; const c = this.ctx = new A();
    this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
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
    const c = this.ctx; if (!c) return; const t = c.currentTime, n = Math.abs(S.n1), inside = S.cam === 0 ? 0.7 : 1, dead = S.crashed || S.paused ? 0 : 1, pr = PL.prop, lv = PL.key === 'fighter' ? 1.5 : pr ? 0.25 : PL.key === 'bizjet' ? 0.8 : 1;
    const set = (p, v) => p.setTargetAtTime(v, t, 0.08);
    set(this.roarG.gain, (0.06 + 0.5 * n * n) * inside * dead * lv); set(this.roarF.frequency, 180 + 1500 * n + S.V * 2);
    set(this.whG.gain, (pr ? 0.06 + 0.2 * n : 0.012 + 0.05 * n) * inside * dead);     // propeller: a low buzz instead of a fan whine
    set(this.wh1.frequency, pr ? 58 + 62 * n : 150 + 520 * n); set(this.wh2.frequency, pr ? 117 + 124 * n : 227 + 790 * n); set(this.whF.frequency, pr ? 260 + 380 * n : 500 + 1900 * n);
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
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.7; }
};

// ---------- 14. Input ----------
function startTrick(type) {
  if (S.arc && !S.land && !S.ap.on) {      // Easy mode: every aircraft can roll and loop
    if (S.trick || S.onGround) return; if (S.ra < 40) return toast(L('Climb a little higher first', 'קודם מטפסים קצת')); S.trick = { type, t: 0, ang: 0, dir: (keys.KeyA || keys.ArrowLeft || touch.x < -0.3) ? -1 : 1 }; return; }
  if (!PL.tricks) return toast(L('The ' + PL.name.toLowerCase() + ' is not built for aerobatics. Try the fighter or the aerobatic plane', tr(PL.name) + ' לא בנוי לפעלולים. נסו את מטוס הקרב או את מטוס הפעלולים'), 4);
  if (S.trick || S.land || S.crashed) return;
  if (S.onGround || S.ra < (type === 'loop' ? 450 : 150)) return toast(L('Climb higher first', 'קודם מטפסים גבוה יותר'));
  if (type === 'loop' && S.V < S.vs0 * 1.7) return toast(L('Need more speed for a loop', 'ללולאה צריך יותר מהירות'));
  S.ap.on = false; S.trick = { type, ang: 0, t: 0, dir: (keys.KeyA || keys.ArrowLeft || touch.x < -0.3) ? -1 : 1 };
}
function action(code) {
  if (code === 'Escape' || code === 'Tab') { if (PH.on) return action('KeyO'); return S.paused ? closeMenu() : openMenu(); }
  if (S.paused) return;
  if (code === 'KeyO') { PH.on = !PH.on; document.body.classList.toggle('photo', PH.on); camSnap = true; if (PH.on) for (const k in keys) keys[k] = false; return; }
  if (PH.on) return;
  if (code === 'KeyR') { if (S.lastSpawn) spawn(S.lastSpawn); return; }
  if (code === 'KeyM') return Snd.toggle();
  if (code === 'KeyC') { S.cam = (S.cam + 1) % 3; camSnap = true; return; }
  if (code === 'KeyT') { S.tod = (S.tod + 1) % 3; applyTOD(S.tod); return; }
  if (code === 'KeyI') { document.body.classList.toggle('nopfd'); return; }
  if (code === 'KeyK') { S.legend = !S.legend; return; }
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
      if (!t || !t.inRange) toast(L('No airport within 20 km. Nearest: ' + apName(t.ap) + ', ' + kmTxt(t.dist) + ' ' + dirTxt(t.brg) + '. Fly towards it and try again', 'אין שדה תעופה בטווח 20 ק״מ. הקרוב: ' + apName(t.ap) + ', ' + kmTxt(t.dist) + ' ' + dirTxt(t.brg) + '. טסים לכיוונו ומנסים שוב'), 6);
      else { S.land = t.rw; S.landPh = 'intercept'; S.landJoin = false; S.ap.on = false; S.trick = null; S.holdAlt = null; toast(L('Automatic landing at ' + apName(t.ap) + ' started. Hands off', 'נחיתה אוטומטית ב' + apName(t.ap) + ' התחילה. לא נוגעים'), 4.5); } }
    return;
  }
  if (code === 'KeyG' && PL.fixedGear) return toast(L('This aircraft has fixed landing gear', 'למטוס הזה גלגלים קבועים'));
  if (code === 'KeyF' && FLAPS.length < 2) return toast(L('This aircraft has no flaps', 'למטוס הזה אין מדפים'));
  if ((S.assist || S.land) && (code === 'KeyG' || code === 'KeyF')) return toast(code === 'KeyG' ? L('Landing gear is automatic now: it comes down by itself before landing', 'הגלגלים אוטומטיים עכשיו: הם יורדים לבד לפני הנחיתה') : L('Flaps are automatic now', 'המדפים אוטומטיים עכשיו'), 4);
  if (code === 'KeyG') { if (S.onGround) toast(L('The gear stays down on the ground', 'על הקרקע הגלגלים נשארים למטה')); else { S.gear = !S.gear; toast(S.gear ? L('Gear coming down', 'גלגלים יורדים') : L('Gear going up', 'גלגלים עולים')); } }
  else if (code === 'KeyF') { S.flapIdx = (S.flapIdx + 1) % FLAPS.length; toast(L('Flaps ', 'מדפים ') + FLAPS[S.flapIdx] + '°'); }
  else if (code === 'KeyP') {
    if (S.ap.on) { S.ap.on = false; toast(L('Autopilot off', 'טייס אוטומטי כבוי')); }
    else if (S.onGround || S.ra < 60) toast(L('Autopilot needs 200 ft above ground', 'טייס אוטומטי פועל מ-200 רגל מעל הקרקע'));
    else { S.land = null; S.trick = null; S.ap.on = true; S.ap.alt = S.pos.y; S.ap.hdg = S.hdg; S.ap.spd = Math.max(S.V, S.vs0 * 1.3); toast(L('Autopilot holding altitude, heading and speed', 'טייס אוטומטי: שומר גובה, כיוון ומהירות')); }
  }
}
const HANDLED = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyG', 'KeyF', 'KeyB', 'KeyP', 'KeyC', 'KeyT', 'KeyR', 'KeyM', 'KeyH', 'KeyL', 'KeyX', 'KeyZ', 'KeyV', 'KeyI', 'KeyO', 'KeyY', 'KeyN', 'KeyK', 'Space', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'Equal', 'Minus', 'PageUp', 'PageDown']);
window.addEventListener('keydown', e => {
  if (!S.started) { if (e.code === 'Enter' && !$('fly').disabled) $('fly').click(); return; }
  const dg = /^Digit(\d)$/.exec(e.code); if (dg && !S.paused && !PH.on) { S.thr = +dg[1] / 9; e.preventDefault(); return; }      // 0 = idle … 9 = full power
  if (HANDLED.has(e.code)) { e.preventDefault(); if (!keys[e.code] && !e.repeat) action(e.code); keys[e.code] = true; }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function setupTouch() {
  if (window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) { document.body.classList.add('touch', 'nopfd'); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); resize(); }
  const stick = $('stick'), knob = $('knob');
  const mv = e => { const r = stick.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    touch.x = x; touch.y = y; touch.on = true; knob.style.transform = `translate(${x * 37}px,${y * 37}px)`; };
  const end = () => { touch.x = touch.y = 0; touch.on = false; knob.style.transform = ''; };
  stick.addEventListener('pointerdown', e => { stick.setPointerCapture(e.pointerId); mv(e); });
  stick.addEventListener('pointermove', e => { if (touch.on) mv(e); }); stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const th = $('thrT'); let thOn = false; const tm = e => { const r = th.getBoundingClientRect(); S.thr = clamp(1 - (e.clientY - r.top - 8) / (r.height - 16), 0, 1); };
  th.addEventListener('pointerdown', e => { th.setPointerCapture(e.pointerId); thOn = true; tm(e); }); th.addEventListener('pointermove', e => { if (thOn) tm(e); });
  th.addEventListener('pointerup', () => thOn = false); th.addEventListener('pointercancel', () => thOn = false);
  document.querySelectorAll('#ctx button').forEach(b => { const k = b.dataset.k;
    if (b.dataset.hold) { b.addEventListener('pointerdown', () => keys[k] = true); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => keys[k] = false); }
    else b.addEventListener('click', () => action(k)); });
  setupMapGestures(); $('map').addEventListener('click', () => { if (!mapWasDragged()) $('map').classList.toggle('big'); });
}

// ---------- 15. Menus ----------
let FREE = [], LANDTESTS = [];
function planeCards(el, onPick) {
  el.textContent = '';
  for (const k of PLANE_ORDER) { const p = PLANES[k], b = document.createElement('button'); b.className = k === PL.key ? 'on' : ''; b.innerHTML = '<b></b><small></small>'; b.firstChild.textContent = tr(p.name); b.lastChild.textContent = tr(p.tag);
    b.addEventListener('click', () => onPick(k)); el.appendChild(b); }
}
function gridButtons(el, items) {
  el.textContent = '';
  for (const [title, sub, fn, on] of items) { const b = document.createElement('button'); if (on) b.className = 'on'; b.textContent = tr(title); if (sub) { const s = document.createElement('small'); s.textContent = tr(sub); b.appendChild(s); }
    b.addEventListener('click', fn); el.appendChild(b); }
}
/** The start screen and the pause menu share one set of folded sections, in the same order, built here. where: 'start' or 'pause'.
    On the start screen a choice is only selected (FLY starts from it); in the pause menu a start point or aircraft starts at once. */
let START = null, TAKEOFFS = [], AIRSTARTS = [];
const OPEN = { start: new Set(['pl', 'lv']), pause: new Set(['pl', 'lv']) };
const startName = (d, short) => d.type === 'ground' && short ? apName(AIRPORTS[d.rw.ap]) : tr(d.label.replace('Approach: ', ''));
function renderPanel(where) {
  const body = $(where === 'start' ? 'sBody' : 'mBody'), touchUI = document.body.classList.contains('touch'), cur = where === 'start' ? (START || FREE[0]) : S.lastSpawn, rer = () => renderPanel(where);
  const go = d => where === 'start' ? () => { START = d; spawn(d); $('toast').style.display = 'none'; rer(); } : () => { closeMenu(); spawn(d); };
  const pickPlane = k => { selectPlane(k); if (where === 'start') { spawn(START || FREE[0]); $('toast').style.display = 'none'; rer(); } else { closeMenu(); spawn(S.lastSpawn || FREE[0]); } };
  const starts = (list, short) => el => gridButtons(el, list.map(d => [startName(d, short), '', go(d), d === cur]));
  const secs = [
    ['pl', L('Aircraft', 'מטוס'), tr(PL.name), el => planeCards(el, pickPlane)],
    ['lv', L('Difficulty', 'רמת קושי'), L(LV[S.mode][0], LV[S.mode][1]), el => levelButtons(el, rer)],
    ['tk', L('Take off from a runway', 'המראה ממסלול'), TAKEOFFS.includes(cur) ? startName(cur, true) : '', starts(TAKEOFFS, true)],
    ['air', L('Start in the air', 'התחלה באוויר'), AIRSTARTS.includes(cur) ? startName(cur) : '', starts(AIRSTARTS)],
    ['ap', L('Practise a landing', 'תרגול נחיתה'), LANDTESTS.includes(cur) ? startName(cur) : '', starts(LANDTESTS)],
    ['set', L('Settings', 'הגדרות'), [todName(S.tod), tr(WXN[WX])].join(' · '), el => settingsRows(el, where, rer)]];
  if (!touchUI) secs.push(['keys', L('Keyboard keys', 'מקשי מקלדת'), '', keyList]);
  const open = OPEN[where]; body.textContent = '';
  for (const [id, title, val, fill] of secs) {
    const d = document.createElement('details'); d.className = 'sec'; d.open = open.has(id); d.addEventListener('toggle', () => { if (d.open) open.add(id); else open.delete(id); });
    const s = document.createElement('summary'); s.textContent = title; if (val) { const sm = document.createElement('small'); sm.textContent = val; s.appendChild(sm); }
    const c = document.createElement('div'); if (id !== 'set' && id !== 'keys') c.className = 'grid'; fill(c); d.append(s, c); body.appendChild(d); }
  $(where === 'start' ? 'sSum' : 'mSum').textContent = [tr(PL.name), L(LV[S.mode][0], LV[S.mode][1]), cur ? startName(cur) : ''].filter(Boolean).join(' · ');
}
/** Settings as rows of option buttons: every choice visible, the current one marked (aria-pressed). */
function settingsRows(el, where, rer) {
  const touchUI = document.body.classList.contains('touch');
  const row = (label, opts, cur, set) => { const r = document.createElement('div'), sp = document.createElement('span'), g = document.createElement('div'); r.className = 'seg'; sp.textContent = label; g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
    opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = o; b.setAttribute('aria-pressed', String(i === cur)); b.addEventListener('click', () => { if (i !== cur) { set(i); rer(); } }); g.appendChild(b); }); r.append(sp, g); el.appendChild(r); };
  const onOff = [L('On', 'פועל'), L('Off', 'כבוי')];
  row(L('Language', 'שפה'), ['עברית', 'English'], SAVE.lang === 'he' ? 0 : 1, i => { SAVE.lang = i ? 'en' : 'he'; persist(); applyLang(); });
  row(touchUI ? L('Stick forward', 'ג׳ויסטיק קדימה') : L('Up arrow', 'חץ למעלה'), [L('Climbs', 'מעלה את המטוס'), L('Descends, like a real stick', 'מוריד, כמו מוט אמיתי')], SAVE.inv ? 1 : 0, i => { SAVE.inv = !!i; persist(); S.legSig = ''; });
  row(L('Time of day', 'שעה ביום'), TOD.map((t, i) => todName(i)), S.tod, i => { S.tod = i; applyTOD(i); });
  row(L('Weather', 'מזג אוויר'), WXN.map(tr), WX, i => { WX = i; applyTOD(S.tod); });
  row(L('View', 'מבט'), CAMS.map(tr), S.cam, i => { S.cam = i; camSnap = true; });
  row(L('Place names', 'שמות מקומות'), [L('Shown', 'מוצגים'), L('Hidden', 'מוסתרים')], S.names ? 0 : 1, i => { S.names = !i; });
  row(L('Instruments', 'מכשירים'), [L('Simple', 'פשוטים'), L('Full', 'מלאים')], document.body.classList.contains('nopfd') ? 0 : 1, i => { document.body.classList.toggle('nopfd', !i); });
  row(L('Smoke trail', 'שובל עשן'), onOff, S.smoke ? 0 : 1, i => { S.smoke = !i; });
  row(L('Sound', 'קול'), onOff, Snd.muted ? 1 : 0, i => { if (!!Snd.muted !== !!i) Snd.toggle(); });
  if (!touchUI) row(L('Key guide on screen', 'מדריך מקשים על המסך'), [L('Shown', 'מוצג'), L('Hidden', 'מוסתר')], S.legend ? 0 : 1, i => { S.legend = !i; });
  if (where === 'pause') { const b = document.createElement('button'); b.className = 'sec2'; b.style.marginTop = '10px'; b.textContent = L('Photo mode: look at the aircraft from any side', 'מצב צילום: מסתכלים על המטוס מכל צד');
    b.addEventListener('click', () => { closeMenu(); action('KeyO'); }); el.appendChild(b); }
}
const todName = i => SAVE.lang === 'he' ? tr(TOD[i].name.toLowerCase()) : TOD[i].name;
const KEYS = [['Climb / descend', 'טיפוס / ירידה', '↑ / ↓ · W / S'], ['Turn left / right', 'פנייה שמאלה / ימינה', '← / → · A / D'], ['Power up / down', 'הספק למעלה / למטה', 'Shift / Ctrl · = / −'], ['Set power directly', 'קביעת הספק ישירה', '0 – 9'],
  ['Brakes', 'בלמים', 'B · Space'], ['Land automatically', 'נחיתה אוטומטית', 'L'], ['Menu and pause', 'תפריט והפסקה', 'Esc'], ['Change view', 'החלפת מבט', 'C'], ['Restart from the same point', 'התחלה מחדש מאותה נקודה', 'R'],
  ['Day / sunset / night', 'יום / שקיעה / לילה', 'T'], ['Weather', 'מזג אוויר', 'Y'], ['Place names', 'שמות מקומות', 'N'], ['Photo mode', 'מצב צילום', 'O'], ['Simple / full instruments', 'מכשירים פשוטים / מלאים', 'I'],
  ['Key guide on screen', 'מדריך מקשים על המסך', 'K'], ['Autopilot', 'טייס אוטומטי', 'P'], ['Roll / loop', 'גלגול / לולאה', 'X / Z'], ['Smoke trail', 'שובל עשן', 'V'], ['Sound on / off', 'קול', 'M'], ['Next difficulty level', 'רמת הקושי הבאה', 'H'],
  ['Expert: gear, flaps, rudder', 'מקצועי: גלגלים, מדפים, הגה כיוון', 'G · F · Q / E']];
function keyList(el) { el.className = 'keysL'; for (const [en, he, k] of KEYS) { const d = document.createElement('div'), a = document.createElement('span'), b = document.createElement('b'); a.textContent = L(en, he); b.textContent = k; b.dir = 'ltr'; d.append(a, b); el.appendChild(d); } }
function openMenu() { if (!S.started) return; S.paused = true; for (const k in keys) keys[k] = false; renderPanel('pause'); $('menu').style.display = 'flex'; $('menu').scrollTop = 0; }
function closeMenu() { S.paused = false; $('menu').style.display = 'none'; $('toast').style.display = 'none'; }
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
  LANDTESTS = [
    { label: 'Approach: Ben Gurion runway 12', type: 'approach', rw: RUNWAYS[1], dist: 7500, flaps: 3, gear: true },
    { label: 'Approach: Haifa over the bay', type: 'approach', rw: RUNWAYS[2], dist: 7000, flaps: 3, gear: true },
    { label: 'Approach: Eilat Ramon', type: 'approach', rw: RUNWAYS[3], dist: 7500, flaps: 3, gear: true }
  ];
}

// ---------- 16. Main loop ----------
let last = 0, frame = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frame++;
  const run = S.started && !S.paused && !PH.on; if (run || !S.started) TNOW += dt;
  if (run) {
    if (!S.crashed) {
      if (!S.arc || S.land || S.ap.on) { A.sync = true; readAttitude(); updateControls(dt); for (let i = 0; i < 2 && !S.crashed; i++) physics(dt / 2); } else arcadeStep(dt);
      if (!S.crashed && !S.onGround) {          // buildings and other aircraft are solid
        if (hitObstacle(S.pos.x, S.pos.y - GEAR_H * 0.5, S.pos.z, PL.chase[0] * 0.12)) crash(L('Flew into a building.', 'התנגשות בבניין'));
        else for (const a of AIT) if (a.g.position.distanceToSquared(S.pos) < 900) { crash(L('Mid-air collision.', 'התנגשות באוויר')); break; } }
      updateSystems(dt); readAttitude(); emitTrails(dt); if (frame % 20 === 0) updatePlace();
    }
    updateExplosion(dt); if (S.crashed && S.crashT > 0) { S.crashT -= dt; if (S.crashT <= 0) $('crash').style.display = 'flex'; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.display = 'none'; }
  }
  if (S.started) {
    const full = !document.body.classList.contains('nopfd');
    if (full || S.cam === 0) drawPFD(); if (frame % 4 === 0) drawMap(); if (frame % 5 === 0) drawSys();
    if (S.cam === 0) { AC.pfdTex.needsUpdate = true; if (frame % 4 === 0) AC.mapTex.needsUpdate = true; }
    Snd.update(); if (PH.on) photoCamera(); else updateCamera(run ? dt : 0); if (frame % 10 === 0) updateLabels();
  } else {                                           // slow orbit behind the start screen
    const a = TNOW * 0.12, d = PL.chase[0] * 1.5; camera.position.set(S.pos.x + Math.cos(a) * d, S.pos.y + PL.chase[1] * 0.6, S.pos.z + Math.sin(a) * d); camPos.copy(camera.position);
    AC.root.position.copy(S.pos); AC.root.quaternion.copy(S.q); AC.m.g.visible = true; AC.deck.visible = false; camera.lookAt(S.pos); sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000);
    sun.position.copy(S.pos).addScaledVector(sunDir, 1000); sun.target.position.copy(S.pos); sun.target.updateMatrixWorld(); if (AC.m.burner) AC.m.burner.visible = false;
  }
  ENV.uTime.value = TNOW; if (TR) TR.mat.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * DEG / 2));
  if (run || !S.started) for (const s of clouds.children) { s.position.x += 6 * dt; if (s.position.x > X1 + 12000) s.position.x = X0 - 12000; }
  for (const m of [...cityMeshes, ...LMK.meshes]) { const u = m.userData, dx = Math.max(0, Math.abs(camera.position.x - u.x) - (u.half || 0)), dz = Math.max(0, Math.abs(camera.position.z - u.z) - (u.half || 0)); m.visible = Math.hypot(dx, dz) < u.far; }   // distance cull, to the nearest edge of each bucket
  updateScatter(); if (run || !S.started) { updateTrains(dt); updateAIT(dt); updateWeather(dt); updateTraffic(dt); for (const h of turbines) h.rotation.z += h.userData.v * dt; }
  renderer.render(scene, camera);
}

// ---------- 17. Boot ----------
function init() {
  buildHeights(); buildTerrain(); buildWater(); buildAirports(); buildScatter(); buildCities(); buildLandmarks(); buildRoads(); buildDetails(); buildIsrael(); buildCityLandmarks(); buildRivers(); buildBoom(); buildLabels(); bakeMap(); buildSkyObjects(); buildAircraft(); buildGameObjects();
  buildMenu(); buildFun(); applyTOD(0); setupTouch(); selectPlane(SAVE.plane); setMode(SAVE.mode); setupCanvasGuard();
  spawn(FREE[0]); $('toast').style.display = 'none'; readAttitude(); drawMap();
  const fly = $('fly'); fly.disabled = false; applyLang(); $('langB').addEventListener('click', () => { SAVE.lang = SAVE.lang === 'he' ? 'en' : 'he'; persist(); applyLang(); });
  fly.addEventListener('click', () => { Snd.init(); if (Snd.ctx && Snd.ctx.state === 'suspended') Snd.ctx.resume(); S.started = true; camSnap = true; $('start').style.display = 'none'; $('hud').style.display = 'block';
    if (!S.arc && S.onGround) toast(L('Push the power to full. The ' + PL.name.toLowerCase() + ' takes off by itself', 'מעלים את ההספק עד הסוף. ה' + tr(PL.name) + ' ממריא לבד'), 4); });
  $('menuB').addEventListener('click', e => { openMenu(); e.currentTarget.blur(); });
  $('modeB').addEventListener('click', e => { OPEN.pause.add('lv'); openMenu(); e.currentTarget.blur(); });     // the level chip opens the menu at the levels, it does not switch level by itself
  $('resume').addEventListener('click', closeMenu); $('mClose').addEventListener('click', closeMenu);
  $('again').addEventListener('click', () => action('KeyR'));
  $('airborne').addEventListener('click', () => spawn({ type: 'air', x: S.pos.x, z: S.pos.z, agl: 600, hdg: S.hdg, spd: 120, label: 'Back in the air', keep: true }));
  requestAnimationFrame(loop);
}
if (typeof THREE === 'undefined') { $('fly').textContent = 'Could not load the 3D engine. Check your connection and reload.'; }
else { const im = new Image();      // decode the settlement raster first; everything else is built from it
  im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); BLD = { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; setTimeout(init, 30); };
  im.src = BLD_PNG; }
