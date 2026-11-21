'use strict';
// ---------- 12. Instruments ----------
const pfdC = document.getElementById('pfd'), P = pfdC.getContext('2d'), mapC = document.getElementById('map'), M = mapC.getContext('2d');
const FONT = '"DIN Alternate","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif';
/** The glide path is 3° in real terms. The horizontal scale changes with height (hsAt), so on the map its profile is curved: the world
    distance from touchdown to height h is the integral of hsAt / tan 3°. GSX tabulates it every 5 m up to 3000 m. */
const GS_T = Math.tan(3 * DEG), GSX = [];
function gsTable() { if (GSX.length) return; let x = 0; GSX.push(0); for (let h = 5; h <= 3000; h += 5) { x += hsAt(h - 2.5) * 5 / GS_T; GSX.push(x); } }
/** Height of the glide path above the runway at a world distance from touchdown, and the inverse. */
function gsHeight(xw) { gsTable(); if (xw <= 0) return 0; let lo = 0, hi = GSX.length - 1; if (xw >= GSX[hi]) return 3000; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (GSX[m] < xw) lo = m; else hi = m; } return (lo + (xw - GSX[lo]) / (GSX[hi] - GSX[lo])) * 5; }
function gsDist(h) { gsTable(); const i = clamp(h / 5, 0, GSX.length - 1), k = Math.floor(i); return GSX[k] + (GSX[Math.min(k + 1, GSX.length - 1)] - GSX[k]) * (i - k); }
function ilsOf(rw, toTouchdown) {
  const rx = S.pos.x - rw.tx, rz = S.pos.z - rw.tz, along = -(rx * rw.dx + rz * rw.dz), cross = rx * -rw.dz + rz * rw.dx;
  if (along > (toTouchdown ? -rw.len * 0.7 : 150) && along < 15000 && Math.abs(cross) < Math.max(along, 0) * 0.4 + 200)
  { const h = S.pos.y - GEAR_H - rw.elev, gh = gsHeight(along + 300);     // gs: degrees above the glide path, in real terms
    return { rw, along, cross, loc: Math.atan2(cross, Math.max(along + 300, 1)) / DEG, gs: Math.atan2(h - gh, Math.max(gh / GS_T, 60)) / DEG }; }
  return null;
}
const LAND_RANGE = 40000;                 // automatic landing can start this far from the runway (real metres)
const AP_HE = { LLBG: 'נתב״ג', LLHA: 'חיפה', LLER: 'רמון', LLIB: 'ראש פינה', LLMZ: 'מצדה', LLBS: 'באר שבע' };
const apName = ap => L(ap.name, AP_HE[ap.code] || ap.name);
/** Units the player chose (settings): speed kt / km/h / mph, distance km / miles / nautical miles, height ft / m. The PFD stays in kt and ft, as in an aircraft. */
const U_SPD = [[1.94384, 'kt', 'קשר'], [3.6, 'km/h', 'קמ״ש'], [2.23694, 'mph', 'מייל לשעה']], U_DIST = [[1000, ' km', ' ק״מ'], [1609.344, ' mi', ' מייל'], [1852, ' NM', ' מייל ימי']], U_ALT = [[3.28084, 'ft', 'רגל'], [1, 'm', 'מ׳']];
const uSpd = () => U_SPD[SAVE.uSpd | 0], uAlt = () => U_ALT[SAVE.uAlt | 0];
const spdNum = v => Math.round(v * uSpd()[0]), spdTxt = v => spdNum(v) + ' ' + L(uSpd()[1], uSpd()[2]);          // v in m/s
const altNum = (m, step) => { const k = uAlt()[0], st = step || (k > 1 ? 10 : 5); return Math.round(m * k / st) * st; }, altTxt = (m, step) => altNum(m, step).toLocaleString('en') + ' ' + L(uAlt()[1], uAlt()[2]);
const kmTxt = m => { const u = U_DIST[SAVE.uDist | 0], v = m / u[0]; return v.toFixed(v < 9.95 ? 1 : 0) + L(u[1], u[2]); };
const dirTxt = brg => { const i = Math.round(brg / 45) % 8; return L(['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][i], ['צפונה', 'לצפון-מזרח', 'מזרחה', 'לדרום-מזרח', 'דרומה', 'לדרום-מערב', 'מערבה', 'לצפון-מערב'][i]); };
const relArrow = rel => '↑↗→↘↓↙←↖'[Math.round((((rel % 360) + 360) % 360) / 45) % 8];
/** Where an automatic landing would go: the nearest runway with an instrument approach, its distance and bearing, and whether it is in range. */
function landTarget() {
  let best = null;
  for (const rw of RUNWAYS) { if (!rw.ils) continue; const d = realDist(S.pos.x - rw.tx, S.pos.z - rw.tz); if (!best || d < best.dist) best = { rw, ap: AIRPORTS[rw.ap], dist: d }; }     // dist: real metres
  if (best) { best.brg = (Math.atan2(best.rw.tx - S.pos.x, -(best.rw.tz - S.pos.z)) / DEG + 360) % 360; best.inRange = best.dist < LAND_RANGE; }
  return best;
}
/** Where the nearest airport with an approach is: an arrow, its name and the distance. Shown in the pause menu, not on the flight screen. */
function nearestAirportTxt() { const t = landTarget(); return t ? relArrow(t.brg - S.hdg) + ' ' + apName(t.ap) + ' ' + kmTxt(t.dist) : ''; }
/** The landing panel under the speed strip, and the state of the landing buttons: is landing possible, is it running, what is automatic. */
function landPanel(touchUI) {
  const air = !S.onGround, t = landTarget(), auto = S.assist || !!S.land, el = $('landP');
  let cls = '', main = '';
  if (S.crashed || S.trick || PH.on || !t) cls = '';
  else if (S.land) {
    const rw = S.land, d = realDist(S.pos.x - rw.tx, S.pos.z - rw.tz);
    const ph = !air ? L('braking to a stop', 'בלימה עד עצירה') : S.ra < 15 ? L('touching down', 'נגיעה במסלול') : S.landPh === 'final' ? L('on final approach', 'בגישה הסופית') : L('flying to the approach path', 'טסים אל קו הגישה');
    cls = 'active'; main = '<b>' + L('Automatic landing', 'נחיתה אוטומטית') + '</b> · ' + apName(AIRPORTS[rw.ap]) + ' ' + kmTxt(d) + ' · ' + ph;
  } else if (air && t.inRange) {
    // the way to the nearest airport is only shown when it is useful: for a few seconds on coming into range, and when low and near (on touch the green Land button already says it can land)
    if (!S.landSeen) { S.landSeen = true; S.landSeenT = TNOW + 7; }
    /* the nearest airport and its distance are not shown in flight: they are in the pause menu's footer (nearestAirportTxt) */
  } else S.landSeen = false;
  let chips = '';
  if (cls && (S.land ? air && S.ra < 900 : !S.assist && S.ra < 600)) {          // gear and flaps: while they matter (low, in Expert or during an automatic landing)
    const gp = S.gearPos, g = PL.fixedGear ? L('fixed gear', 'גלגלים קבועים') : (gp > 0.98 ? '▼ ' : gp < 0.02 ? '▲ ' : '… ') + L(gp > 0.98 ? 'gear down' : gp < 0.02 ? 'gear up' : 'gear moving', gp > 0.98 ? 'גלגלים למטה' : gp < 0.02 ? 'גלגלים למעלה' : 'גלגלים בתנועה');
    chips = '<span class="' + (gp > 0.98 || PL.fixedGear ? 'on' : gp < 0.02 ? 'off' : 'mid') + '">' + g + '</span>' + (FLAPS.length > 1 ? '<span>' + L('flaps ', 'מדפים ') + FLAPS[S.flapIdx] + '°</span>' : '') +
      (S.brake ? '<span class="on">' + L('brakes on', 'בלמים') + '</span>' : '') + '<span class="tag">' + (auto ? L('automatic', 'אוטומטי') : L('manual: G gear, F flaps', 'ידני')) + '</span>';
  }
  const html = cls ? '<div>' + main + '</div>' + (chips ? '<div class="chips2">' + chips + '</div>' : '') : '';
  if (html !== el._h) { el._h = html; el.innerHTML = html; el.hidden = !cls; el.className = 'panel ' + cls; }
  if (!touchUI) return;
  const set = (id, txt, c) => { const b = $(id); if (b.textContent !== txt) b.textContent = txt; if (b.className !== c) b.className = c; };
  const cl = $('cLand'); cl.hidden = !(air && !S.trick && !S.crashed);
  set('cLand', S.land ? L('Cancel landing', 'ביטול נחיתה') : L('Land', 'נחיתה'), S.land ? 'active' : t && t.inRange ? 'ready' : 'off');
  const gp = S.gearPos; set('cGear', L('Gear', 'גלגלים') + (gp > 0.98 ? ' ▼' : gp < 0.02 ? ' ▲' : ' …'), gp > 0.98 ? 'on' : '');
  set('cFlap', L('Flaps', 'מדפים') + ' ' + FLAPS[S.flapIdx] + '°', S.flapIdx > 0 ? 'on' : ''); set('cBrake', L('Brake', 'בלם'), S.brake ? 'on' : '');
}
function nearestILS() {
  let best = null;
  for (const rw of RUNWAYS) { if (!rw.ils) continue; const i = ilsOf(rw); if (i && (!best || i.along < best.along)) best = i; }
  return best;
}
function tape(x, y, w, h, val, ppu, minor, major, fmt, bug) {
  P.save(); P.beginPath(); P.rect(x, y, w, h); P.clip(); P.fillStyle = 'rgba(40,48,58,.92)'; P.fillRect(x, y, w, h);
  const cy = y + h / 2, span = h / 2 / ppu; P.strokeStyle = '#fff'; P.fillStyle = '#fff'; P.lineWidth = 1.5; P.font = '13px ' + FONT; P.textBaseline = 'middle';
  for (let t = Math.floor((val - span) / minor) * minor; t <= val + span; t += minor) {
    const ty = cy - (t - val) * ppu, mj = Math.round(t / minor) % Math.round(major / minor) === 0;
    P.beginPath(); if (x < 100) { P.moveTo(x + w, ty); P.lineTo(x + w - (mj ? 12 : 6), ty); } else { P.moveTo(x, ty); P.lineTo(x + (mj ? 12 : 6), ty); } P.stroke();
    if (mj) { P.textAlign = x < 100 ? 'right' : 'left'; P.fillText(fmt(t), x < 100 ? x + w - 15 : x + 15, ty); }
  }
  if (bug !== null && bug !== undefined) { const by = clamp(cy - (bug - val) * ppu, y + 4, y + h - 4); P.fillStyle = '#ff66ee'; P.fillRect(x < 100 ? x + w - 5 : x, by - 7, 5, 14); }
  P.restore();
  P.fillStyle = '#05080b'; P.strokeStyle = '#fff'; P.lineWidth = 1.5; P.fillRect(x + 2, cy - 13, w - 4, 26); P.strokeRect(x + 2, cy - 13, w - 4, 26);
  P.fillStyle = '#40f58c'; P.font = 'bold 17px ' + FONT; P.textAlign = 'center'; P.textBaseline = 'middle'; P.fillText(fmt(Math.round(val)), x + w / 2, cy + 1);
}
function drawPFD() {
  const W = 440, H = 300; P.fillStyle = '#0a0e13'; P.fillRect(0, 0, W, H);
  const pitchD = S.pitch / DEG, kt = S.V * KT, altF = S.pos.y * FT, vs = S.vel.y * 196.85;
  // --- artificial horizon ---
  const ax = 78, ay = 22, aw = 224, ah = 216, cx = ax + aw / 2, cy = ay + ah / 2, ppd = 4.6;
  P.save(); P.beginPath(); P.rect(ax, ay, aw, ah); P.clip(); P.translate(cx, cy); P.rotate(-S.bank); P.save(); P.translate(0, pitchD * ppd);
  P.fillStyle = '#2a82e6'; P.fillRect(-500, -900, 1000, 900); P.fillStyle = '#8a5a2c'; P.fillRect(-500, 0, 1000, 900);
  P.strokeStyle = '#fff'; P.lineWidth = 2; P.beginPath(); P.moveTo(-500, 0); P.lineTo(500, 0); P.stroke();
  P.lineWidth = 1.5; P.fillStyle = '#fff'; P.font = '12px ' + FONT; P.textBaseline = 'middle';
  for (let d = -60; d <= 60; d += 5) { if (!d) continue; const y = -d * ppd, hw = d % 10 === 0 ? 34 : 16; P.beginPath(); P.moveTo(-hw, y); P.lineTo(hw, y); P.stroke();
    if (d % 10 === 0) { P.textAlign = 'right'; P.fillText(Math.abs(d), -hw - 5, y); P.textAlign = 'left'; P.fillText(Math.abs(d), hw + 5, y); } }
  P.restore();
  P.fillStyle = '#fff'; P.beginPath(); P.moveTo(0, -96); P.lineTo(-7, -84); P.lineTo(7, -84); P.closePath(); P.fill();          // sky pointer
  P.restore();
  P.save(); P.beginPath(); P.rect(ax, ay, aw, ah); P.clip(); P.translate(cx, cy); P.strokeStyle = '#fff'; P.lineWidth = 2;
  for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { const r = a * DEG, l = a % 30 === 0 ? 12 : 7; P.beginPath(); P.moveTo(Math.sin(r) * 98, -Math.cos(r) * 98); P.lineTo(Math.sin(r) * (98 + l), -Math.cos(r) * (98 + l)); P.stroke(); }
  P.strokeStyle = '#ffd21f'; P.lineWidth = 4; P.beginPath(); P.moveTo(-70, 0); P.lineTo(-28, 0); P.lineTo(-28, 9); P.moveTo(70, 0); P.lineTo(28, 0); P.lineTo(28, 9); P.stroke();
  P.fillStyle = '#ffd21f'; P.fillRect(-3, -3, 6, 6);
  // ILS localiser / glideslope
  const ils = nearestILS();
  if (ils) { P.strokeStyle = '#fff'; P.lineWidth = 1; P.fillStyle = '#ff66ee';
    for (const k of [-2, -1, 1, 2]) { P.beginPath(); P.arc(k * 22, 98, 2.5, 0, 7); P.stroke(); P.beginPath(); P.arc(100, k * 22, 2.5, 0, 7); P.stroke(); }
    const lx = clamp(-ils.loc / 2.5, -1, 1) * 44, gy = clamp(ils.gs / 0.7, -1, 1) * 44, dia = (x, y) => { P.beginPath(); P.moveTo(x, y - 7); P.lineTo(x + 5, y); P.lineTo(x, y + 7); P.lineTo(x - 5, y); P.closePath(); P.fill(); };
    dia(lx, 98); dia(100, gy); }
  P.restore();
  if (ils) { P.fillStyle = '#ff66ee'; P.font = '12px ' + FONT; P.textAlign = 'left'; P.textBaseline = 'top'; P.fillText('ILS ' + ils.rw.label + '  ' + (ils.along / 1852).toFixed(1) + ' NM', ax + 4, ay + 4); }
  // --- tapes ---
  tape(8, 22, 62, 216, kt, 2.2, 10, 20, v => String(Math.max(0, v)), S.ap.on ? S.ap.spd * KT : null);
  if (!S.onGround || kt > 40) { const vsk = (S.vs0 || 60) * KT, y = clamp(130 - (vsk - kt) * 2.2, 22, 238); P.fillStyle = '#ff5252'; P.fillRect(64, y, 5, 238 - y); }
  tape(310, 22, 76, 216, altF, 0.22, 100, 200, v => String(v), S.land ? null : S.ap.on ? S.ap.alt * FT : (S.assist && S.holdAlt !== null ? S.holdAlt * FT : null));
  // VSI
  P.fillStyle = 'rgba(40,48,58,.92)'; P.fillRect(394, 22, 38, 216); P.strokeStyle = '#fff'; P.lineWidth = 1; P.fillStyle = '#fff'; P.font = '11px ' + FONT; P.textAlign = 'left'; P.textBaseline = 'middle';
  const vy = v => 130 - clamp(v / 4000, -1, 1) * 100;
  for (const v of [-4, -2, -1, 0, 1, 2, 4]) { const y = vy(v * 1000); P.beginPath(); P.moveTo(394, y); P.lineTo(402, y); P.stroke(); P.fillText(Math.abs(v), 406, y); }
  P.strokeStyle = '#40f58c'; P.lineWidth = 3; P.beginPath(); P.moveTo(432, 130); P.lineTo(398, vy(vs)); P.stroke();
  // --- heading tape ---
  const hx = 78, hy = 250, hw = 224, hh = 40; P.save(); P.beginPath(); P.rect(hx, hy, hw, hh); P.clip(); P.fillStyle = 'rgba(40,48,58,.92)'; P.fillRect(hx, hy, hw, hh);
  P.strokeStyle = '#fff'; P.fillStyle = '#fff'; P.lineWidth = 1.5; P.font = '13px ' + FONT; P.textAlign = 'center'; P.textBaseline = 'top';
  for (let t = Math.floor((S.hdg - 30) / 5) * 5; t <= S.hdg + 30; t += 5) { const x = hx + hw / 2 + (t - S.hdg) * 3.8, n = ((t % 360) + 360) % 360, mj = n % 10 === 0;
    P.beginPath(); P.moveTo(x, hy); P.lineTo(x, hy + (mj ? 10 : 5)); P.stroke(); if (mj) P.fillText(n === 0 ? 'N' : n === 90 ? 'E' : n === 180 ? 'S' : n === 270 ? 'W' : String(n / 10).padStart(2, '0'), x, hy + 13); }
  if (S.ap.on) { const bx = hx + hw / 2 + clamp(wrap180(S.ap.hdg - S.hdg), -29, 29) * 3.8; P.fillStyle = '#ff66ee'; P.fillRect(bx - 6, hy, 12, 5); }
  P.restore(); P.fillStyle = '#ffd21f'; P.beginPath(); P.moveTo(cx, hy + 9); P.lineTo(cx - 6, hy - 2); P.lineTo(cx + 6, hy - 2); P.closePath(); P.fill();
  // --- readouts ---
  P.font = '13px ' + FONT; P.textBaseline = 'middle'; P.textAlign = 'left'; P.fillStyle = '#55d6ff'; P.fillText('HDG ' + String(Math.round(S.hdg) % 360).padStart(3, '0') + '°', 8, 262);
  P.fillStyle = '#e4edf3'; P.fillText('GS ' + Math.round(Math.hypot(S.vel.x, S.vel.z) * KT), 8, 282);
  P.textAlign = 'right'; P.fillStyle = S.ra * FT < 2500 ? '#ffb84a' : '#8a9fb0'; P.fillText('AGL ' + Math.max(0, Math.round(S.ra * FT / 10) * 10).toLocaleString('en'), 432, 262);          // height above the ground, always
  P.fillStyle = '#e4edf3'; P.fillText('VS ' + Math.round(vs / 50) * 50, 432, 282);
  P.textAlign = 'left'; P.fillStyle = '#8a9fb0'; P.font = '11px ' + FONT; P.fillText('KT', 10, 12); P.fillText('FT', 312, 12); P.fillText('FPM×1000', 384, 12);
  { const lbl = S.land ? 'AUTOLAND' : S.ap.on ? 'AP  ALT  HDG  SPD' : S.arc ? 'EASY' : S.assist ? 'ASSISTED' : 'MANUAL'; P.fillStyle = S.land ? '#ff66ee' : '#40f58c'; P.textAlign = 'center'; P.font = '12px ' + FONT; P.fillText(lbl, cx, 12); }
  if (S.stallWarn) { P.fillStyle = '#ff5252'; P.font = 'bold 22px ' + FONT; P.textAlign = 'center'; P.fillText('STALL', cx, ay + 44); }
}
/** The minimap. The canvas is sized to its on-screen size × devicePixelRatio, so it stays sharp when enlarged on a phone.
    Text is sized in CSS pixels, and labels are placed by priority without overlapping (see mapLabels).
    The enlarged map zooms (1×–8×) with two fingers or the mouse wheel and pans with one finger or the mouse; a tap opens and closes it. */
const MAPW = 160, MAPH = 294, MAPZMAX = 8;
const WP_NAMES = { TLV: ['Tel Aviv', 'תל אביב'], JRS: ['Jerusalem', 'ירושלים'], HFA: ['Haifa', 'חיפה'], 'DEAD SEA': ['Dead Sea', 'ים המלח'], MASADA: ['Masada', 'מצדה'], EILAT: ['Eilat', 'אילת'] };
const MV = { z: 1, ox: 0, oy: 0, ptr: new Map(), moved: false, multi: false, raf: 0 };   // zoom and the top-left visible point in map units
let mapLbl = null;
function sizeMap() {
  const ch = mapC.clientHeight; if (!ch) return 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 3), h = Math.round(ch * dpr), w = Math.round(h * MAPW / MAPH);
  if (mapC.height !== h || mapC.width !== w) { mapC.width = w; mapC.height = h; mapLbl = null; }
  return ch / MAPH;                                   // CSS pixels per map unit
}
const mapZoomed = () => mapC.classList.contains('big') && MV.z > 1.001;
function mapClampView() { MV.z = clamp(MV.z, 1, MAPZMAX); MV.ox = clamp(MV.ox, 0, MAPW - MAPW / MV.z); MV.oy = clamp(MV.oy, 0, MAPH - MAPH / MV.z); }
/** Zoom by factor f about a point given in CSS pixels from the canvas corner, keeping the map point under it in place. */
function mapZoomAt(cx, cy, f) { const u = mapC.clientHeight / MAPH, mx = MV.ox + cx / (u * MV.z), my = MV.oy + cy / (u * MV.z); MV.z = clamp(MV.z * f, 1, MAPZMAX); MV.ox = mx - cx / (u * MV.z); MV.oy = my - cy / (u * MV.z); mapClampView(); }
function mapPan(dx, dy) { const u = mapC.clientHeight / MAPH; MV.ox -= dx / (u * MV.z); MV.oy -= dy / (u * MV.z); mapClampView(); }
function mapResetView() { MV.z = 1; MV.ox = MV.oy = 0; }
const mapRedraw = () => { if (!MV.raf) MV.raf = requestAnimationFrame(() => { MV.raf = 0; drawMap(); }); };
/** Touch and mouse on the map. A tap toggles the enlarged map (the click handler in 08-app.js asks mapWasDragged first). */
function setupMapGestures() {
  const pos = e => { const r = mapC.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  mapC.addEventListener('pointerdown', e => { if (!MV.ptr.size) { MV.moved = false; MV.multi = false; } MV.ptr.set(e.pointerId, pos(e)); if (MV.ptr.size > 1) MV.multi = true; try { mapC.setPointerCapture(e.pointerId); } catch (_) {} e.stopPropagation(); });
  mapC.addEventListener('pointermove', e => {
    if (!MV.ptr.has(e.pointerId)) return; const big = mapC.classList.contains('big'), prev = [...MV.ptr.values()].map(p => p.slice()), p = pos(e), old = MV.ptr.get(e.pointerId);
    if (Math.hypot(p[0] - old[0], p[1] - old[1]) > 0.5) { MV.ptr.set(e.pointerId, p); } else return;
    const now = [...MV.ptr.values()];
    if (now.length >= 2 && big) {
      const [a0, b0] = prev, [a1, b1] = now, d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]), d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]);
      const m0 = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], m1 = [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
      if (d0 > 4) mapZoomAt(m1[0], m1[1], d1 / d0); mapPan(m1[0] - m0[0], m1[1] - m0[1]); MV.moved = true; mapRedraw();
    } else if (now.length === 1 && big && !MV.multi) { const dx = p[0] - old[0], dy = p[1] - old[1]; if (MV.moved || Math.hypot(dx, dy) > 3) { MV.moved = true; if (MV.z > 1.001) { mapPan(dx, dy); mapRedraw(); } } }
    e.stopPropagation(); });
  const up = e => { MV.ptr.delete(e.pointerId); e.stopPropagation(); };
  mapC.addEventListener('pointerup', up); mapC.addEventListener('pointercancel', up);
  mapC.addEventListener('wheel', e => { if (!mapC.classList.contains('big')) return; e.preventDefault(); const [x, y] = pos(e); mapZoomAt(x, y, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015))); mapRedraw(); }, { passive: false });
  mapC.addEventListener('dblclick', e => { if (mapC.classList.contains('big')) { e.preventDefault(); const [x, y] = pos(e); if (MV.z < MAPZMAX - 0.01) mapZoomAt(x, y, 2); else mapResetView(); mapRedraw(); } });
}
/** True (once) when the last touch on the map was a drag or a pinch, not a tap. */
function mapWasDragged() { const m = MV.moved || MV.multi; MV.moved = MV.multi = false; return m; }
/** Label layout: one list of text boxes in map units, cached until the map size, its zoom step or the language changes.
    Order of priority: waypoints, big cities, motorway numbers, smaller towns, regional road numbers. A label that would touch
    another one, or leave the map, is tried on the other sides of its dot and then dropped. Zooming in lets smaller towns in. */
function mapLabels(W, H, u, big, zs) {
  const key = big + ':' + u.toFixed(4) + ':' + zs + ':' + SAVE.lang; if (mapLbl && mapLbl.key === key) return mapLbl.items;
  const items = [], boxes = [], px = v => v / u, fits = b => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= W && b.y1 <= H && !boxes.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  const mx = x => (x - X0) / (X1 - X0) * W, mz = z => (z - Z0) / (Z1 - Z0) * H, gap = px(big ? 3 : 2);
  for (const ap of AIRPORTS) { const x = mx(ap.x), y = mz(ap.z); boxes.push({ x0: x - px(3), y0: y - px(3), x1: x + px(3), y1: y + px(3) }); }
  const font = (size, bold) => (bold ? 'bold ' : '') + px(size).toFixed(4) + 'px ' + FONT;
  const label = (text, x, y, size, bold, kind, sides) => {
    M.font = font(size, bold); const tw = M.measureText(text).width, th = px(size), o = px(kind === 'loc' ? 4 : 6);
    const dot = kind === 'loc' ? { x0: x - px(2.5), y0: y - px(2.5), x1: x + px(2.5), y1: y + px(2.5) } : null; if (dot && !fits(dot)) return false;
    for (const s of sides) { const lx = s === 'r' ? x + o : s === 'l' ? x - o - tw : x - tw / 2, ly = s === 'u' ? y - o - th / 2 : s === 'd' ? y + o + th / 2 : y;
      const b = { x0: lx - gap, y0: ly - th / 2 - gap, x1: lx + tw + gap, y1: ly + th / 2 + gap }; if (!fits(b)) continue;
      boxes.push(b); if (dot) boxes.push(dot); items.push({ text, x: lx, y: ly, font: M.font, kind, dx: x, dy: y, b }); return true; }
    return false;
  };
  const shield = r => { const x = mx(r.x), y = mz(r.z), size = 9, th = px(size + 4); M.font = font(size, true); const w = M.measureText(r.n).width + px(5);
    const b = { x0: x - w / 2 - gap, y0: y - th / 2 - gap, x1: x + w / 2 + gap, y1: y + th / 2 + gap }; if (!fits(b)) return; boxes.push(b); items.push({ text: r.n, x, y, w, h: th, font: M.font, kind: 'road', cls: r.cls, b }); };
  // waypoints: short codes on the small map, place names on the big one
  const wps = WAYPOINTS.map(([n, lo, la]) => [n, mx(lon2x(lo)), mz(lat2z(la)), lo]), WPS = { TLV: 'ת״א', JRS: 'י-ם', HFA: 'חיפה', 'DEAD SEA': 'ים המלח', MASADA: 'מצדה', EILAT: 'אילת' };
  for (const [n, x, y, lo] of wps) { const t = big ? L(...WP_NAMES[n]) : L(n, WPS[n] || n); label(t, x, y, big ? 13 : 10, big, 'wp', lo < 35 ? ['l', 'r', 'u', 'd'] : ['r', 'l', 'u', 'd']); }
  if (big) {
    const near = (x, y) => wps.some(w => Math.hypot(w[1] - x, w[2] - y) < px(14)), minPop = Math.max(1, 20 / Math.pow(zs, 1.5));
    const locs = LOCS.filter(l => l[4] >= minPop).sort((a, b) => b[4] - a[4]).map(l => [L(l[1] || l[0], l[0]), mx(lon2x(l[2])), mz(lat2z(l[3])), l[4]]);
    for (const [t, x, y, pop] of locs) if (pop >= 100 && !near(x, y)) label(t, x, y, 12, true, 'loc', ['r', 'l', 'u', 'd']);
    for (const r of ROADLBL) if (r.cls === 2) shield(r);
    for (const [t, x, y, pop] of locs) if (pop < 100 && !near(x, y)) label(t, x, y, 10.5, false, 'loc', ['r', 'l', 'u', 'd']);
    for (const r of ROADLBL) if (r.cls !== 2) shield(r);
  }
  mapLbl = { key, items }; return items;
}
function drawMap() {
  const u0 = sizeMap(); if (!u0) return;
  const big = mapC.classList.contains('big'); if (!big && MV.z !== 1) mapResetView();
  const W = MAPW, H = MAPH, k = mapC.height / H, z = MV.z, zs = Math.pow(2, Math.round(Math.log2(z) * 4) / 4), u = u0 * z, px = v => v / u;   // zs: zoom step for the label layout
  const mx = x => (x - X0) / (X1 - X0) * W, mz = v => (v - Z0) / (Z1 - Z0) * H, vx0 = MV.ox, vy0 = MV.oy, vx1 = vx0 + W / z, vy1 = vy0 + H / z;
  M.setTransform(1, 0, 0, 1, 0, 0); M.clearRect(0, 0, mapC.width, mapC.height);
  M.setTransform(k * z, 0, 0, k * z, -vx0 * k * z, -vy0 * k * z); M.imageSmoothingEnabled = true; M.imageSmoothingQuality = 'high';
  M.drawImage(mapImg, 0, 0, W, H); M.fillStyle = big ? 'rgba(0,10,20,.28)' : 'rgba(0,10,20,.16)'; M.fillRect(0, 0, W, H);
  if (z > 1.4) {                                       // zoomed in: redraw the roads as sharp lines over the baked image
    M.lineJoin = M.lineCap = 'round';
    for (const c of [0, 1, 2]) for (const p of roadPaths) { if (p[0][3] !== c) continue;
      if (!p.bb) { let a = 1e9, b = 1e9, e = -1e9, f = -1e9; for (const q of p) { a = Math.min(a, q[0]); b = Math.min(b, q[2]); e = Math.max(e, q[0]); f = Math.max(f, q[2]); } p.bb = [mx(a), mz(b), mx(e), mz(f)]; }
      if (p.bb[2] < vx0 || p.bb[0] > vx1 || p.bb[3] < vy0 || p.bb[1] > vy1) continue;          // only the roads in view
      M.strokeStyle = c === 2 ? 'rgba(255,236,170,.95)' : c === 1 ? 'rgba(240,240,235,.8)' : 'rgba(230,230,225,.5)'; M.lineWidth = px(c === 2 ? 2.2 : c === 1 ? 1.4 : 0.9); M.beginPath();
      p.forEach((q, i) => i ? M.lineTo(mx(q[0]), mz(q[2])) : M.moveTo(mx(q[0]), mz(q[2]))); M.stroke(); } }
  M.lineWidth = px(1.2); M.strokeStyle = '#ff66ee';                                     // ILS approach feathers
  for (const rw of RUNWAYS) { if (!rw.ils) continue; const x = mx(rw.tx), y = mz(rw.tz), ex = mx(rw.tx - rw.dx * gsDist(450)), ey = mz(rw.tz - rw.dz * gsDist(450));
    M.beginPath(); M.moveTo(x, y); M.lineTo(ex, ey); M.stroke(); }
  M.fillStyle = '#fff'; for (const ap of AIRPORTS) { const s = Math.max(px(4), 2.5 / z); M.fillRect(mx(ap.x) - s / 2, mz(ap.z) - s / 2, s, s); }
  M.textBaseline = 'middle'; M.textAlign = 'left'; M.lineJoin = 'round';
  const items = mapLabels(W, H, u0 * zs, big, zs), sc = zs / z;     // labels laid out at the zoom step, drawn at the exact zoom
  for (const it of items) {
    if (it.b.x1 < vx0 || it.b.x0 > vx1 || it.b.y1 < vy0 || it.b.y0 > vy1) continue;
    { const sx0 = (it.b.x0 - vx0) * z, sx1 = (it.b.x1 - vx0) * z, sy0 = (it.b.y0 - vy0) * z, c = 20 / u0;   // keep the corners free for the N marker and the zoom factor
      if (sy0 < c && (sx1 > W - c || (big && z > 1.001 && sx0 < 2.2 * c))) continue; }
    M.save(); const ax = it.kind === 'road' ? it.x : it.kind === 'loc' || it.kind === 'wp' ? it.dx : it.x, ay = it.kind === 'road' ? it.y : it.dy;
    M.translate(ax, ay); M.scale(sc, sc); M.translate(-ax, -ay); M.font = it.font; const q = v => v / (u0 * zs);
    if (it.kind === 'road') { M.fillStyle = it.cls === 2 ? '#1d58b4' : '#2f8a45'; M.fillRect(it.x - it.w / 2, it.y - it.h / 2, it.w, it.h); M.strokeStyle = 'rgba(255,255,255,.8)'; M.lineWidth = q(0.8); M.strokeRect(it.x - it.w / 2, it.y - it.h / 2, it.w, it.h);
      M.fillStyle = '#fff'; M.textAlign = 'center'; M.fillText(it.text, it.x, it.y + q(0.5)); M.textAlign = 'left'; M.restore(); continue; }
    M.fillStyle = it.kind === 'wp' ? '#55d6ff' : '#fff'; M.strokeStyle = 'rgba(0,0,0,.7)'; M.lineWidth = q(1); M.beginPath(); M.arc(it.dx, it.dy, q(it.kind === 'wp' ? 3.5 : 2), 0, 7); M.fill(); M.stroke();
    M.strokeStyle = 'rgba(0,0,0,.8)'; M.lineWidth = q(3); M.strokeText(it.text, it.x, it.y); M.fillStyle = it.kind === 'wp' ? '#fff' : '#f2ede2'; M.fillText(it.text, it.x, it.y); M.restore();
  }
  // the aircraft: clamped to the visible part of the map, so it points the way back when panned away
  const m = px(3), px0 = clamp(mx(S.pos.x), vx0 + m, vx1 - m), py0 = clamp(mz(S.pos.z), vy0 + m, vy1 - m), h = S.hdg * DEG, len = Math.max(34 / z, px(40)), a = Math.max(px(9), 5 / z);
  M.strokeStyle = '#ffd21f'; M.lineWidth = px(1.6); M.beginPath(); M.moveTo(px0, py0); M.lineTo(px0 + Math.sin(h) * len, py0 - Math.cos(h) * len); M.stroke();
  if (S.land) { M.strokeStyle = '#ff66ee'; M.lineWidth = px(1.6); M.setLineDash([px(5), px(4)]); M.beginPath(); M.moveTo(px0, py0); M.lineTo(mx(S.land.tx), mz(S.land.tz)); M.stroke(); M.setLineDash([]); }
  if (S.ap.on) { const b = S.ap.hdg * DEG; M.strokeStyle = '#ff66ee'; M.setLineDash([px(4), px(4)]); M.beginPath(); M.moveTo(px0, py0); M.lineTo(px0 + Math.sin(b) * len, py0 - Math.cos(b) * len); M.stroke(); M.setLineDash([]); }
  M.save(); M.translate(px0, py0); M.rotate(h); M.scale(a / 7, a / 7); M.fillStyle = '#ffd21f'; M.strokeStyle = '#000'; M.lineWidth = 1; M.beginPath(); M.moveTo(0, -7); M.lineTo(5, 5); M.lineTo(0, 2); M.lineTo(-5, 5); M.closePath(); M.fill(); M.stroke(); M.restore();
  // fixed to the frame: north marker, and the zoom factor while zoomed
  const pf = v => v / u0; M.setTransform(k, 0, 0, k, 0, 0); M.textAlign = 'center'; M.font = 'bold ' + pf(12).toFixed(3) + 'px ' + FONT; M.strokeStyle = 'rgba(0,0,0,.8)'; M.lineWidth = pf(3); M.fillStyle = '#fff';
  M.strokeText('N', W - pf(9), pf(9)); M.fillText('N', W - pf(9), pf(9));
  { const g = big ? '⤡' : '⤢'; M.font = 'bold ' + pf(14).toFixed(3) + 'px ' + FONT; M.textAlign = 'left'; M.textBaseline = 'bottom'; M.strokeText(g, pf(5), H - pf(3)); M.fillText(g, pf(5), H - pf(3)); M.textBaseline = 'middle'; }     // tap to enlarge / shrink
  if (big && z > 1.001) { const t = z.toFixed(1) + '×'; M.font = 'bold ' + pf(11).toFixed(3) + 'px ' + FONT; M.textAlign = 'left'; M.strokeText(t, pf(7), pf(10)); M.fillText(t, pf(7), pf(10)); }
}
function hintText() {
  const T = document.body.classList.contains('touch'), up = SAVE.inv ? '↓' : '↑', dn = SAVE.inv ? '↑' : '↓', ft = m => (Math.round(m * FT / 50) * 50).toLocaleString('en') + ' ft';
  if (S.crashed) return '';
  if (S.trick) return S.trick.type === 'loop' ? L('Looping…', 'לולאה…') : L('Rolling…', 'גלגול…');
  if (S.land) return S.onGround || TNOW - (S.landT0 || 0) > 9 ? '' : L('Hands off: the aircraft lands itself. ' + (T ? 'Tap Cancel landing' : 'Press L') + ' to take over', 'לא נוגעים: המטוס נוחת לבד. כדי להשתלט: ' + (T ? '"ביטול נחיתה"' : 'L'));
  if (S.ap.on) return TNOW - (S.apT0 || 0) > 9 ? '' : L('Autopilot on. The stick moves its altitude and heading targets', 'טייס אוטומטי פועל. הג׳ויסטיק משנה את הגובה והכיוון שהוא שומר');
  if (S.arc) {
    if (S.onGround) return A.v > 3 ? '' : T ? L('Push the speed lever up. It takes off by itself', 'מרימים את ידית המהירות. המטוס ממריא לבד') : L('Hold Shift to go. It takes off by itself', 'מחזיקים Shift. המטוס ממריא לבד');
    if (S.airTime < 25) return T ? L('Move the stick where you want to fly. Let go to fly straight', 'מזיזים את הג׳ויסטיק לאן שרוצים לטוס. משחררים, וטסים ישר') : L('The arrows steer. Let go to fly straight. X rolls, Z loops', 'החצים מכוונים. משחררים, וטסים ישר. X גלגול, Z לולאה');
    if (S.ra < 150 && A.v < PL.vs * 1.9) return L('Fly gently onto the ground to land', 'יורדים בעדינות אל הקרקע כדי לנחות');
    return '';
  }
  if (S.onGround) {
    if (S.thr > 0.5) return S.assist ? L('Full power. It lifts off by itself', 'הספק מלא. המטוס ממריא לבד') : L('Full power. Raise the nose at ', 'הספק מלא. מרימים את האף ב-') + spdTxt(S.vs0 * 1.15);
    if (S.landed) return S.assist ? '' : (T ? L('Hold Brake to stop', 'מחזיקים "בלם" כדי לעצור') : L('Hold B or Space to brake', 'מחזיקים B או רווח כדי לבלום'));
    return T ? L('Slide the power lever up to take off', 'מעלים את ידית ההספק כדי להמריא') : L('Hold Shift, or press 9, for take-off power', 'מחזיקים Shift, או לוחצים 9, להספק המראה');
  }
  if (S.assist) {
    if (S.prot) return S.prot;
    if (AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R - 50) && S.gear) return T ? L('Over the airport: hold the stick down to land', 'מעל שדה התעופה: מחזיקים את הג׳ויסטיק למטה כדי לנחות') : L('Over the airport: hold ' + dn + ' to land', 'מעל שדה התעופה: מחזיקים ' + dn + ' כדי לנחות');
    // otherwise say what the aircraft is doing
    return '';                 // otherwise nothing: the instruments already show height and climb
  }
  if (S.gear && !PL.fixedGear && S.ra > 250 && S.V > S.vs0 * 1.5) return T ? L('The gear is still down: tap Gear', 'הגלגלים עדיין למטה: לוחצים "גלגלים"') : L('The gear is still down: press G', 'הגלגלים עדיין למטה: לוחצים G');
  if (S.gear && FLAPS.length > 1 && S.flapIdx === 0 && S.ra < 400 && S.vel.y < -1) return T ? L('Landing? Tap Flaps for landing flaps', 'נוחתים? לוחצים "מדפים"') : L('Landing? Press F for landing flaps, and fly ', 'נוחתים? לוחצים F למדפים, וטסים ב-') + spdTxt(S.vs0 * 1.3);
  if (S.gear && S.ra < 300 && S.vel.y < -1 && !S.onGround) return S.ra < 12 ? L('Flare: raise the nose gently, power to idle', 'הצפה: מרימים בעדינות את האף, הספק לסרק') : L('Approach speed ', 'מהירות גישה ') + spdTxt(S.vs0 * 1.3);
  return '';
}
/** The key guide shows for the first 45 s of a flight, then gets out of the way; "Always" in the settings (or the K key) pins it. */
const legendOn = () => S.legend && (SAVE.legendPin || TNOW - (S.spawnT || 0) < 45);
/** The key guide (desktop). It changes with the flight mode and the pitch setting. */
function drawLegend() {
  const el = $('legend'), up = SAVE.inv ? '↓' : '↑', dn = SAVE.inv ? '↑' : '↓'; el.style.display = legendOn() ? 'grid' : 'none'; el.textContent = '';
  if (S.arc) { for (const [k, en, he] of [[up, 'Up', 'למעלה'], [dn, 'Down', 'למטה'], ['← →', 'Turn', 'פנייה'], ['Shift', 'Faster', 'מהר יותר'], ['Ctrl', 'Slower', 'לאט יותר'], ['X', 'Roll', 'גלגול'], ['Z', 'Loop', 'לולאה'], ['Space', 'Brake', 'בלם'], ['L', 'Land automatically', 'נחיתה אוטומטית'], ['C', 'Change view', 'החלפת מבט'], ['Esc', 'Menu', 'תפריט']]) {
      const b = document.createElement('b'), sp = document.createElement('span'); b.textContent = k; b.dir = 'ltr'; sp.textContent = L(en, he); el.appendChild(b); el.appendChild(sp); } return; }
  const rows = [[up, S.assist ? L('Climb', 'טיפוס') : L('Nose up', 'אף למעלה')], [dn, S.assist ? L('Descend', 'ירידה') : L('Nose down', 'אף למטה')], ['← →', S.assist ? L('Turn', 'פנייה') : L('Roll', 'הטיה')], ['Shift / Ctrl', L('Power up / down', 'הספק למעלה / למטה')], ['0 – 9', L('Set power', 'קביעת הספק')], ['B / Space', L('Brake', 'בלם')], ['L', L('Land automatically', 'נחיתה אוטומטית')]];
  if (!S.assist) rows.push(['G', L('Landing gear', 'גלגלים')], ['F', L('Flaps', 'מדפים')]);
  rows.push(['Esc', L('Menu', 'תפריט')], ['K', L('Hide this', 'הסתרת המדריך')]);
  for (const [k, t] of rows) { const b = document.createElement('b'), sp = document.createElement('span'); b.textContent = k; b.dir = 'ltr'; sp.textContent = t; el.appendChild(b); el.appendChild(sp); }
}
function drawSys() {
  const touchUI = document.body.classList.contains('touch'), air = !S.onGround;
  const auto = S.thr >= 0 && S.boost > S.thr + 0.01, t = auto ? S.boost : S.thr, thrTxt = t < -0.01 ? 'REV ' + Math.round(-t * 100) + '%' : (auto ? 'AUTO ' : '') + Math.round(t * 100) + '%';
  landPanel(touchUI);
  if (touchUI) { $('thrTf').style.height = clamp(S.thr, 0, 1) * 100 + '%'; $('thrPct').textContent = thrTxt; }
  else {
    $('sThr').textContent = thrTxt; $('sThr').className = t < -0.01 || auto ? 'warnc' : '';
    $('thrFill').style.width = Math.abs(t) * 100 + '%'; $('thrFill').style.background = t < 0 ? 'var(--amber)' : 'var(--cyan)';
    const AU = S.assist || S.land ? L(' · AUTO', ' · אוטו׳') : ''; $('sFlap').textContent = FLAPS.length < 2 ? L('NONE', 'אין') : Math.round(S.flapDeg) + '°' + (Math.abs(S.flapDeg - FLAPS[S.flapIdx]) > 0.5 ? ' → ' + FLAPS[S.flapIdx] + '°' : '') + AU;
    const gp = S.gearPos, ge = $('sGear'); ge.textContent = (PL.fixedGear ? L('FIXED', 'קבועים') : gp > 0.98 ? L('▼ DOWN', '▼ למטה') : gp < 0.02 ? L('▲ UP', '▲ למעלה') : L('MOVING', 'בתנועה')) + (PL.fixedGear ? '' : AU); ge.className = gp > 0.98 ? 'ok' : gp < 0.02 ? '' : 'warnc';
    const ae = $('sAp'); ae.textContent = S.land ? L('LANDING', 'נחיתה') : S.ap.on ? altTxt(S.ap.alt) + ' / ' + String(Math.round(S.ap.hdg) % 360).padStart(3, '0') + '°' : L('OFF', 'כבוי'); ae.className = S.ap.on || S.land ? 'mg' : '';
    const cfg = !S.assist || !!S.land || (!S.onGround && S.ra < 500) || Math.abs(S.flapDeg - FLAPS[S.flapIdx]) > 0.5 || (gp > 0.02 && gp < 0.98);          // gear and flaps rows: in Expert, low, or while they move
    $('rFlap').hidden = !cfg || FLAPS.length < 2; $('rGear').hidden = !cfg || !!PL.fixedGear; $('rAp').hidden = !(S.ap.on || S.land);
  }
  if (document.body.classList.contains('nopfd')) { const AGL = '<svg viewBox="0 0 14 14" role="img" aria-label="' + L('above ground', 'מעל הקרקע') + '"><path d="M7 1v8M3.5 6L7 9.5 10.5 6M1.5 12.5h11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const h = '<i><b>' + spdNum(S.V) + '</b><span>' + uSpd()[1] + '</span></i><i><b>' + altNum(S.pos.y).toLocaleString('en') + '</b><span>' + uAlt()[1] + '</span></i>' +
      '<i class="s" style="color:var(--sand)" title="' + L('above ground', 'מעל הקרקע') + '">' + AGL + '<b class="agl">' + altNum(Math.max(S.ra, 0)).toLocaleString('en') + '</b><span>' + uAlt()[1] + '</span></i><i class="s"><b>' + String(Math.round(S.hdg) % 360).padStart(3, '0') + '°</b></i>';
    const st = $('strip'); if (st._h !== h) { st._h = h; st.innerHTML = h; } }
  document.body.classList.toggle('toasting', $('toast').style.display === 'block');
  $('hint').textContent = hintText(); $('place').textContent = S.place ? L('Over ' + S.place, 'מעל ' + S.placeHe) : '';
  if (!touchUI) { const sig = '' + S.mode + SAVE.lang + (SAVE.inv ? 'i' : 'n') + (legendOn() ? 1 : 0); if (sig !== S.legSig) { S.legSig = sig; drawLegend(); } }
  const al = $('alert'), blink = (TNOW * 3 % 1) < 0.6;
  if (S.stallWarn && !S.crashed) { al.textContent = 'STALL'; al.style.display = blink ? 'block' : 'none'; }
  else if (S.gpws && !S.crashed && !S.assist) { al.textContent = 'PULL UP'; al.style.display = blink ? 'block' : 'none'; }
  else if (!S.assist && !S.gear && !S.onGround && !S.crashed && S.ra < 220 && S.vel.y < -1) { al.textContent = 'GEAR UP'; al.style.display = blink ? 'block' : 'none'; }
  else if (!S.arc && !S.onGround && !S.crashed && S.V * Math.sqrt(isa(S.pos.y).rho / 1.225) > PL.vmo * 1.02 && !PL.sonic) { al.textContent = 'OVERSPEED'; al.style.display = blink ? 'block' : 'none'; }
  else al.style.display = 'none';
  if (touchUI) {   // only the buttons that matter right now
    $('cRoll').hidden = $('cLoop').hidden = !((PL.tricks || S.arc) && air && !S.land && S.ra > (S.arc ? 40 : 150));
    { const m = $('cMore'), any = !$('cLand').hidden || !$('cRoll').hidden; if (m.hidden === any) { m.hidden = !any; if (!any) foldMore(true); } m.classList.toggle('active', !!S.land); }          // the "more" button is there when it has something to offer, and turns magenta during an automatic landing
    $('cGear').hidden = S.assist || !!PL.fixedGear; $('cFlap').hidden = S.assist || FLAPS.length < 2;
    $('cBrake').hidden = !(S.onGround || !S.assist);
    const uT = S.arc ? L('Up', 'למעלה') : S.assist ? L('Climb', 'טיפוס') : L('Nose up', 'אף למעלה'), dT = S.arc ? L('Down', 'למטה') : S.assist ? L('Descend', 'ירידה') : L('Nose down', 'אף למטה'); $('stU').textContent = '▲'; $('stD').textContent = '▼'; $('stick').setAttribute('aria-label', '▲ ' + (SAVE.inv ? dT : uT) + ' · ▼ ' + (SAVE.inv ? uT : dT));          /* chevrons on the stick; the words are for screen readers */ $('thrLbl').textContent = S.arc ? L('Speed', 'מהירות') : L('Power', 'הספק');
  }
}

// ---------- 12b. Settings, smoke trails, air traffic, weather, photo mode ----------
const SAVE = (() => { const d = { plane: 'airliner', inv: false, mode: 0, lang: 'he' }; try { const o = JSON.parse(localStorage.getItem('ifs-save') || '{}'); if (o.plane) d.plane = o.plane; d.inv = !!o.inv; if ([0, 1, 2].includes(o.mode)) d.mode = o.mode; if (!PLANES[d.plane]) d.plane = 'airliner'; if (o.lang === 'en') d.lang = 'en'; { const p = o.pick; if (p && Array.isArray(p.at) && Array.isArray(p.name) && isFinite(p.at[0]) && isFinite(p.at[1]) && typeof p.at[0] === 'number' && typeof p.at[1] === 'number' && p.at[0] >= X0 && p.at[0] <= X1 && p.at[1] >= Z0 && p.at[1] <= Z1 && typeof p.name[0] === 'string' && typeof p.name[1] === 'string' && [0, 1, 2].includes(p.alt) && [0, 1, 2, 3].includes(p.hdg)) d.pick = p; }
  if (typeof o.pfd === 'boolean') d.pfd = o.pfd;
  d.first = !o.plane;                    // nothing saved yet: a first visit
  for (const k of ['tod', 'wx']) if (o[k] >= 0 && o[k] <= 2) d[k] = o[k] | 0; if (o.cam >= 0 && o.cam <= 7) d.cam = o.cam | 0; for (const k of ['names', 'smoke', 'legend', 'muted']) if (typeof o[k] === 'boolean') d[k] = o[k]; if (typeof o.legendPin === 'boolean') d.legendPin = o.legendPin; if ([0, 1, 2].includes(o.uSpd)) d.uSpd = o.uSpd; if ([0, 1, 2].includes(o.uDist)) d.uDist = o.uDist; if ([0, 1].includes(o.uAlt)) d.uAlt = o.uAlt; } catch (e) { /* no storage: defaults */ } return d; })();
/** Save the choices. Once the game is up (SAVE.ready, set at the end of init) the settings made in flight are saved too: time of day, weather, view, names, smoke, key guide, sound. */
function persist() { try { if (SAVE.ready) Object.assign(SAVE, { tod: S.tod, wx: WX, cam: S.cam, names: !!S.names, smoke: !!S.smoke, legend: !!S.legend, muted: !!Snd.muted });
  const o = Object.assign({}, SAVE); delete o.ready; delete o.first; const j = JSON.stringify(o); if (j !== SAVE_LAST) { SAVE_LAST = j; localStorage.setItem('ifs-save', j); } } catch (e) { /* storage unavailable: settings last for this session only */ } }
let SAVE_LAST = '';
Object.assign(S, { names: true, noEngine: false, gamHold: null, turb: 0, lt: 5, flash: 0, legend: true });
const WXN = ['Clear', 'Dust haze', 'Storm'], PH = { on: false, az: 0.7, el: 0.22, d: 1.5, drag: null }, AIT = [];
let TR = null, WX = 0;
function buildGameObjects() {
  // smoke / contrail particles: one Points draw call, recycled ring buffer
  const N = 320; TR = { n: N, i: 0, acc: 0, pos: new Float32Array(N * 3), dat: new Float32Array(N * 3) };
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(TR.pos, 3)); g.setAttribute('aDat', new THREE.BufferAttribute(TR.dat, 3));
  TR.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: ENV.uTime, uScale: { value: 600 }, uCol: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `attribute vec3 aDat; uniform float uTime, uScale; varying float vA;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ float k=clamp((uTime-aDat.x)/3.2,0.0,1.0); vA=aDat.z*(1.0-k)*step(0.0001,aDat.x);
        vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aDat.y*(1.0+3.5*k)*uScale/max(-mv.z,1.0); gl_Position=projectionMatrix*mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA;
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(uCol, vA*smoothstep(0.5,0.12,d)); }` });
  TR.mat.extensions = { derivatives: false, fragDepth: true, drawBuffers: false, shaderTextureLOD: false };
  TR.pts = new THREE.Points(g, TR.mat); TR.pts.frustumCulled = false; scene.add(TR.pts);
}
function emitTrails(dt) {
  if (!S.smoke || S.onGround) return; let on, size, alpha, step = 7;
  if (S.arc && !S.land) { on = true; size = PL.prop ? 1.5 : Math.max(1.2, PL.gearH * 0.7); alpha = 0.42; step = Math.max(2.4, S.V * 0.035); }      // Easy mode: always draw the path through the sky
  else if (PL.prop) { on = S.n1 > 0.25; size = 1.5; alpha = 0.5; step = 2.4; }
  else if (PL.tricks) { on = S.nLoad > 2.2 || S.pos.y > 2500; size = 1.2; alpha = 0.4; step = 5; }
  else { on = S.pos.y > 2500; size = PL.gearH; alpha = 0.34; }
  if (!on) return; TR.acc += S.V * dt; if (TR.acc < step) return; TR.acc = 0;
  for (const e of AC.m.emit) { tmpV.set(e[0], e[1], e[2]).applyQuaternion(S.q).add(S.pos); const i = TR.i; TR.i = (i + 1) % TR.n;
    TR.pos[i * 3] = tmpV.x; TR.pos[i * 3 + 1] = tmpV.y; TR.pos[i * 3 + 2] = tmpV.z; TR.dat[i * 3] = TNOW; TR.dat[i * 3 + 1] = size; TR.dat[i * 3 + 2] = alpha; }
  TR.pts.geometry.attributes.position.needsUpdate = true; TR.pts.geometry.attributes.aDat.needsUpdate = true;
}

/** Name of the nearest town for the HUD. */
function updatePlace() {
  let best = null, bd = 1e9;
  for (const l of LOCS) { const dx = S.pos.x - lon2x(l[2]), dz = S.pos.z - lat2z(l[3]); if (Math.abs(dx) > 7000 || Math.abs(dz) > 7000) continue; const d = Math.hypot(dx, dz) - 60 * Math.sqrt(l[4]); if (d < bd) { bd = d; best = l; } }
  S.place = best && bd < 900 ? best[1] : ''; S.placeHe = best ? best[0] : '';
}
/** Grade a manual touchdown on a runway: sink rate, centreline, and distance from the aiming point. */
function landingScore(vs) {
  const ru = runwayUnder(), fpm = Math.round(-vs * 196.85);
  if (S.land) return L('Automatic landing touchdown: ' + fpm + ' ft/min', 'נגיעה בנחיתה אוטומטית: ' + fpm + ' רגל לדקה');
  if (!ru) return (vs < -3.5 ? L('Hard landing: ', 'נחיתה קשה: ') : L('Touchdown: ', 'נגיעה: ')) + fpm + L(' ft/min', ' רגל לדקה');
  const s1 = clamp(1 - (fpm - 120) / 700, 0, 1), s2 = clamp(1 - Math.abs(ru.cross) / 20, 0, 1), s3 = clamp(1 - Math.abs(ru.fromThr - 300) / 900, 0, 1);
  const sc = Math.round(100 * (0.5 * s1 + 0.3 * s2 + 0.2 * s3)), grade = sc >= 90 ? 'S' : sc >= 75 ? 'A' : sc >= 55 ? 'B' : 'C';
  Snd.chime(sc >= 75 ? 760 : 420, 0.3);
  return L('Landing grade ' + grade + ' (' + sc + '/100): ' + fpm + ' ft/min, ' + Math.abs(ru.cross).toFixed(0) + ' m off centre', 'ציון נחיתה ' + grade + ' (' + sc + '/100): ' + fpm + ' רגל לדקה, ' + Math.abs(ru.cross).toFixed(0) + ' מ׳ ממרכז המסלול');
}
function buildFun() {
  const lam = c => new THREE.MeshLambertMaterial({ color: c }), R = rng(404);
  // other aircraft circling the airports and cities
  const body = new THREE.CylinderGeometry(1.9, 1.9, 34, 10).rotateX(Math.PI / 2), wing = new THREE.BoxGeometry(32, 0.5, 5), fin = new THREE.BoxGeometry(0.4, 7, 5), wht = lam(0xf2f2ee), tails = [lam(0x1557a8), lam(0xb83232), lam(0x2f8f6a), lam(0xe0a020)];
  [[34.83, 32.05, 5200, 900, 1], [35.0, 32.86, 4200, 700, -1], [35.2, 31.74, 6000, 1900, 1], [34.98, 29.72, 4500, 800, -1], [35.55, 32.8, 5000, 500, 1], [34.75, 31.3, 5500, 1200, -1], [34.86, 32.4, 7000, 1500, 1]].forEach(([lo, la, r, alt, dir], i) => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(body, wht)); const w = new THREE.Mesh(wing, wht); w.position.set(0, -1, 1); g.add(w); const f = new THREE.Mesh(fin, tails[i % 4]); f.position.set(0, 4.5, 14.5); g.add(f); scene.add(g);
    AIT.push({ g, cx: lon2x(lo), cz: lat2z(la), r, alt, dir, a: R() * 6.283 }); });
  RUNWAYS.forEach(rw => { if (rw.ap > 2) LANDTESTS.push({ label: 'Approach: ' + AIRPORTS[rw.ap].name + ' airstrip', type: 'approach', rw, dist: 2300, flaps: 3, gear: true }); });
  // photo mode: drag to orbit, wheel or the buttons to zoom
  canvas.addEventListener('pointerdown', e => { if (PH.on) PH.drag = [e.clientX, e.clientY]; });
  window.addEventListener('pointermove', e => { if (PH.on && PH.drag) { PH.az -= (e.clientX - PH.drag[0]) * 0.006; PH.el = clamp(PH.el + (e.clientY - PH.drag[1]) * 0.005, -0.3, 1.4); PH.drag = [e.clientX, e.clientY]; } });
  window.addEventListener('pointerup', () => PH.drag = null);
  canvas.addEventListener('wheel', e => { if (PH.on) PH.d = clamp(PH.d * (e.deltaY > 0 ? 1.12 : 0.89), 0.5, 12); }, { passive: true });
  $('phDone').addEventListener('click', () => action('KeyO')); $('phIn').addEventListener('click', () => PH.d = clamp(PH.d * 0.75, 0.5, 12)); $('phOut').addEventListener('click', () => PH.d = clamp(PH.d * 1.33, 0.5, 12));
}
function updateAIT(dt) { for (const a of AIT) { a.a += a.dir * 105 * HSCALE / a.r * dt; const c = Math.cos(a.a), s = Math.sin(a.a); a.g.position.set(a.cx + c * a.r, a.alt, a.cz + s * a.r); a.g.rotation.set(0, Math.atan2(s * a.dir, -c * a.dir), -a.dir * 0.3, 'YXZ'); } }
// weather is layered on top of the time of day
const tmpC = new THREE.Color();
function applyWeather() {
  const t = TOD[S.tod], f = scene.fog, dim = 1 - 0.85 * t.lights, den = WX === 0 ? (t.den || 0.00006) : [0, 0.00013, 0.00009][WX];       /* denser than real air, because the map is compressed 4:1: far ridges must recede in steps */ f.density = den; ENV.fogDen.value = den; S.turb = [0, 0.15, 1][WX];
  if (WX === 1) { f.color.lerp(tmpC.setRGB(0.86 * dim, 0.72 * dim, 0.50 * dim), 0.8); skyU.hor.value.lerp(tmpC, 0.9); skyU.top.value.lerp(tmpC.setRGB(0.62 * dim, 0.60 * dim, 0.56 * dim), 0.6); ENV.sunCol.value.multiply(tmpC.setRGB(0.8, 0.69, 0.53)); skyU.uCir.value = 0.1; if (glare) { glare.material.opacity *= 0.35; } }       /* a sharav day: tan air, a pale sun, grey-beige sky */
  if (WX === 2) { f.color.lerp(tmpC.setRGB(0.40 * dim, 0.43 * dim, 0.48 * dim), 0.85); skyU.hor.value.lerp(tmpC, 0.9); skyU.top.value.lerp(tmpC.multiplyScalar(0.6), 0.85); sun.intensity = t.sunI * 0.35; ENV.sunCol.value.multiplyScalar(0.35);
    hemi.intensity = t.hI * 0.8; ENV.skyCol.value.multiplyScalar(0.8); ENV.gndCol.value.multiplyScalar(0.8); skyU.sunCol.value.multiplyScalar(0.15); if (glare) glare.material.opacity *= 0.1; }
  if (cloudMat) { cloudMat.uniforms.uOp.value = WX === 2 ? 1 : 0.9; cloudMat.uniforms.uGrow.value = WX === 2 ? 2.6 : WX === 1 ? 0.8 : 1; if (WX === 2) cloudMat.color.multiplyScalar(0.42); }       /* in a storm the clouds swell and join into a dark deck */
  ENV.fogCol.value.copy(f.color); $('rain').style.display = 'none';       /* the rain is in the world now (updateRain), not a striped overlay */
}
function updateWeather(dt) {
  updateRain(dt);
  if (S.flash > 0) { S.flash -= dt; if (S.flash <= 0) applyTOD(S.tod); }
  if (WX !== 2) return; S.lt -= dt;
  if (S.lt <= 0) { S.lt = 4 + Math.random() * 10; S.flash = 0.16; ENV.skyCol.value.setRGB(1.5, 1.5, 1.8); skyU.top.value.setRGB(0.7, 0.72, 0.85); setTimeout(() => Snd.boom(), 300 + Math.random() * 1500); }
}
function photoCamera() {
  const d = PL.chase[0] * PH.d, ce = Math.cos(PH.el); AC.root.position.copy(S.pos); AC.root.quaternion.copy(S.q); AC.m.g.visible = !S.crashed; AC.deck.visible = false;
  camera.position.set(S.pos.x + Math.sin(PH.az) * ce * d, S.pos.y + Math.sin(PH.el) * d, S.pos.z + Math.cos(PH.az) * ce * d); camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z).h + 2);
  if (camera.view) camera.clearViewOffset(); camera.up.set(0, 1, 0); camera.lookAt(S.pos); if (keys.ArrowLeft) PH.az += 0.02; if (keys.ArrowRight) PH.az -= 0.02; if (keys.ArrowUp) PH.el = Math.min(PH.el + 0.015, 1.4); if (keys.ArrowDown) PH.el = Math.max(PH.el - 0.015, -0.3);
  sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000);
}

// ---------- 12d. Easy flight: a direct "point and fly" control model for children and first-time pilots ----------
// What makes flying fun for a child: the aircraft goes exactly where the stick points, at once; nothing has to be managed;
// nothing ends the flight; and the ground is a place to land, not a wall. So in Easy mode there is no stall, no crash and
// no systems: the stick steers the flight path itself, the lever sets the speed, and letting go always flies straight and level.
// Easy mode: turn rate, pitch rate, steepest path (deg), bank, top speed (m/s, within the type's limits). Acceleration comes from thrust and drag (arcadeAccel).
Object.assign(PLANES.airliner, { aTurn: 0.30, aPitch: 0.30, aG: 20, aBank: 35, aVmax: 175, aCeil: 12500 });        // aCeil: as high as it goes in Easy (m)
Object.assign(PLANES.bizjet, { aTurn: 0.40, aPitch: 0.40, aG: 26, aBank: 45, aVmax: 170, aCeil: 14000 });
Object.assign(PLANES.fighter, { aTurn: 0.80, aPitch: 0.90, aG: 70, aBank: 75, aVmax: 340, aCeil: 19500 });
Object.assign(PLANES.stunt, { aTurn: 0.95, aPitch: 1.05, aG: 45, aBank: 72, aVmax: 92, aCeil: 6000 });
/** Easy mode speed changes follow the type's real thrust and drag, and gravity on a climb or a descent: no fixed rates. */
function arcadeAccel(v, gam, ground) {
  const at = isa(S.pos.y), q = 0.5 * at.rho * v * v, W = PL.mass * G, cl = ground ? 0.3 : Math.min(W * Math.cos(gam) / Math.max(q * PL.S, 1), 2);
  const D = q * PL.S * (PL.cd0 + PL.k * cl * cl + (ground || (S.gear && !PL.fixedGear) ? 0.02 : 0) + 0.0015 * S.flapDeg) + (ground ? 0.015 * W : 0), T = PL.T * Math.pow(at.rho / 1.225, PL.rhoExp || 0.7) * Math.max(0.35, 1 - PL.lapse * v);
  // up may be negative (a climb the engines cannot sustain loses speed); gmax is the steepest climb the thrust can hold at this speed
  return { up: (T - D) / PL.mass - G * Math.sin(gam), dn: Math.max(0.3, D / PL.mass + G * Math.sin(gam)), gmax: Math.asin(clamp((T * S.thr - D) / W, -0.1, 1)) };       // gmax follows the lever: at idle it cannot climb
}
const A = { psi: 0, gam: 0, phi: 0, turn: 0, v: 0, sync: true, msgT: 0 };
const L = (en, he) => SAVE.lang === 'he' ? he : en;
const TRD = { 'The aircraft hit the water.': 'המטוס פגע במים', 'Touched down far too fast.': 'נגיעה בקרקע במהירות גבוהה מדי', 'Touched down with the landing gear up.': 'נחיתה עם גלגלים מקופלים', 'Flew into terrain.': 'התנגשות בקרקע', 'Wing or nose struck the ground.': 'הכנף או האף פגעו בקרקע', 'Left the airfield at speed.': 'ירידה מהמסלול במהירות גבוהה', 'Airliner': 'מטוס נוסעים', 'Business jet': 'מטוס מנהלים', 'Fighter jet': 'מטוס קרב', 'Aerobatic plane': 'מטוס פעלולים',
  'Twin-jet for 150 passengers. Steady and forgiving, slow to turn': 'סילון גדול ל-150 נוסעים. יציב וסלחני, פונה לאט', 'Sleek T-tail jet. Quick, agile, lands short': 'סילון קטן ומהיר. זריז ונוחת בקלות',
  'Afterburner, Mach 1.5, rolls and loops. Hold on': 'מבער, מהירות על-קולית, גלגולים ולולאות. תחזיקו חזק', 'Light propeller plane with show smoke. Slow, nimble, lands anywhere': 'מטוס מדחף קל עם עשן. איטי, זריז ונוחת בכל מקום',
  'Takeoff: Ben Gurion Airport': 'המראה מנתב״ג', 'Takeoff: Haifa': 'המראה מחיפה', 'Takeoff: Eilat Ramon': 'המראה מרמון', 'Takeoff: Rosh Pina': 'המראה מראש פינה', 'Takeoff: Masada (Bar Yehuda)': 'המראה ממצדה', 'Takeoff: Beer Sheva': 'המראה מבאר שבע', 'Coastline: Tel Aviv': 'חוף תל אביב', 'Flyover: Jerusalem': 'מעל ירושלים', 'Low pass: Dead Sea': 'נמוך מעל ים המלח', 'Crater run: Makhtesh Ramon': 'מכתש רמון', 'Snow line: Mount Hermon': 'השלג בחרמון', 'Sea of Galilee': 'הכנרת',
  'Ben Gurion runway 12': 'נתב״ג, מסלול 12', 'Haifa over the bay': 'חיפה, מעל המפרץ', 'Eilat Ramon': 'רמון (אילת)', 'Rosh Pina airstrip': 'מנחת ראש פינה', 'Masada (Bar Yehuda) airstrip': 'מנחת בר יהודה (מצדה)', 'Beer Sheva airstrip': 'מנחת באר שבע',
  'Cockpit': 'תא הטייס', 'Chase': 'מאחור', 'Wing': 'מהכנף', 'Fly-by': 'מהצד (מעבר)', 'Above': 'מלמעלה', 'Front': 'מלפנים', 'Below': 'מבט למטה', 'Tail': 'מהזנב', 'Continue the last flight': 'המשך הטיסה האחרונה', 'Clear': 'בהיר', 'Dust haze': 'אובך', 'Storm': 'סופה', 'day': 'יום', 'sunset': 'שקיעה', 'night': 'לילה' };
const tr = s => SAVE.lang === 'he' && TRD[s] ? TRD[s] : s;
function setMode(m) {
  if (S.arc && S.trick && m !== 0) { S.q.setFromEuler(eul.set(A.gam + 0.03, -A.psi, -A.phi, 'YXZ')); const cg = Math.cos(A.gam); S.vel.set(Math.sin(A.psi) * cg * A.v, Math.sin(A.gam) * A.v, -Math.cos(A.psi) * cg * A.v); }      // leaving Easy in the middle of a roll or loop: the right way up
  S.mode = m; S.arc = m === 0; S.assist = m !== 2; S.trick = null; S.holdAlt = null;          /* a half-flown Easy loop must not be handed to the real-physics trick law */ S.gamHold = null; S.toClimb = false; A.sync = true; SAVE.mode = m; persist();
  document.body.classList.toggle('arc', S.arc); $('modeB').textContent = L(LV[m][0], LV[m][1]); $('modeB').setAttribute('aria-label', L('Level: ', 'רמה: ') + L(LV[m][0], LV[m][1])); if (SAVE.pfd !== undefined) document.body.classList.toggle('nopfd', !SAVE.pfd); else if (!document.body.classList.contains('touch')) document.body.classList.toggle('nopfd', S.arc);      /* the player's own choice of instruments wins over the level's default */ S.legSig = '';
}
/* Easy's slowest speed: 1.18 x the stall speed for the flaps now set (automatic in Easy), so full flaps allow a real approach speed */
function arcVmin() { const clm = PL.cl0 + PL.cla * PL.ast; return PL.vs * Math.sqrt(clm / (clm + 0.03 * S.flapDeg)) * 1.18; }
function arcSync() {
  const V = S.vel.length(), vMin = arcVmin(); readAttitude(); A.v = V; A.psi = V > 5 ? Math.atan2(S.vel.x, -S.vel.z) : S.hdg * DEG; A.gam = V > 5 && !S.onGround ? Math.asin(clamp(S.vel.y / V, -1, 1)) : 0; A.phi = S.bank; A.turn = 0; A.sync = false; A.out = false;
  S.thr = S.onGround ? (S.landed || V < 3 ? 0 : clamp(V / (PL.aVmax * 0.6), 0, 1)) : clamp((V - vMin) / (PL.aVmax - vMin), 0, 1);     // stopped or just landed: the lever at idle, so it does not creep
  if (S.onGround && V < 3) A.v = 0;
}
function arcSay(en, he) { if (TNOW > A.msgT) { A.msgT = TNOW + 4; toast(L(en, he)); } }
function arcadeStep(dt) {
  if (A.sync) arcSync();
  let ud = 0, lr = 0; if (keys.KeyW || keys.ArrowUp) ud += 1; if (keys.KeyS || keys.ArrowDown) ud -= 1; if (keys.KeyD || keys.ArrowRight) lr += 1; if (keys.KeyA || keys.ArrowLeft) lr -= 1;
  if (touch.on) { ud -= touch.y; lr += touch.x; } ud = clamp(ud, -1, 1); lr = clamp(lr, -1, 1); if (SAVE.inv) ud = -ud;
  const up = keys.ShiftLeft || keys.ShiftRight || keys.Equal || keys.PageUp, dn = keys.ControlLeft || keys.ControlRight || keys.Minus || keys.PageDown;
  if (up) S.thr += 0.4 * dt; if (dn) S.thr -= 0.4 * dt; S.thr = clamp(S.thr, 0, 1); S.brake = !!(keys.KeyB || keys.Space);
  const vMin = arcVmin(), vMax = PL.aVmax; let G2 = 0;
  if (S.onGround) {
    // on the ground: the lever drives, the stick steers, and it lifts off by itself once it is fast enough
    /* more than 40% lever always reaches flying speed (a child sets the lever part-way and waits); less is taxiing. With the power at idle the brakes come on by themselves, after a landing or an abandoned take-off */
    const ac = arcadeAccel(A.v, 0, true), vT = S.brake ? 0 : S.thr > 0.4 ? Math.max(S.thr * vMax * 0.6, PL.vs * 1.2) : S.thr * PL.vs, a = (vT > A.v ? Math.max(ac.up, 0.3) : S.brake ? 4.4 : ac.dn + (S.thr < 0.05 ? 2.8 : 0)) * dt;
    A.v += clamp(vT - A.v, -a, a);
    A.psi += lr * 0.7 * Math.max(clamp(A.v / 8, 0, 1), S.thr > 0.1 ? 0.5 : 0) * (1 - 0.8 * clamp(A.v / 60, 0, 1)) * dt;          /* with power on it turns on the spot too, so it can turn away from water */ A.gam = 0;          /* gentle steering at speed */ A.phi *= Math.exp(-8 * dt); A.turn = 0;
    const sx = Math.sin(A.psi) * A.v * dt, sz = -Math.cos(A.psi) * A.v * dt; S.pos.x += sx; S.pos.z += sz; let g = groundAt(S.pos.x, S.pos.z);
    if (g.water) { S.pos.x -= sx; S.pos.z -= sz; A.v = 0; g = groundAt(S.pos.x, S.pos.z); arcSay('That is water. Turn around', 'זה מים. צריך להסתובב'); }
    S.pos.y = g.h + GEAR_H; S.airTime = 0;
    if (A.v > PL.vs * 1.1 && (S.thr > 0.4 || ud > 0.1)) { S.onGround = false; A.gam = 0.04; A.out = true; S.landed = false; }     // rotate a little above the stall speed
  } else {
    S.airTime += dt;
    // coming down to land (stick held down, low): the aircraft slows to landing speed by itself, so holding the stick down is all a landing needs
    const landing = ud < -0.05 && S.ra < 400 && !S.trick, ac = arcadeAccel(A.v, A.gam, false), vT = landing ? vMin : lerp(vMin, vMax, S.thr);
    const dn = Math.max(ac.dn, landing ? 5 : S.brake || S.thr < 0.05 ? 2.5 : 0.8);          // idle or the brake key: the speed brakes are out
    if (vT > A.v) A.v = Math.max(Math.min(vT, A.v + ac.up * dt), Math.min(A.v, vMin * 0.97)); else A.v = Math.max(vT, A.v - dn * dt);      // Easy has no stall: near the stall speed the nose comes down instead (below)
    const tk = S.trick;
    if (tk) { tk.t += dt; const T = tk.type === 'roll' ? 1.1 : (PL.aPitch > 0.8 ? 3.6 : 6), k = Math.min(tk.t / T, 1), e = k * k * (3 - 2 * k); tk.ang = (tk.type === 'roll' ? tk.dir : 1) * e * Math.PI * 2;
      if (k >= 1) { S.trick = null; Snd.chime(820, 0.25); toast(tk.type === 'roll' ? L('Roll!', 'גלגול!') : L('Loop!', 'לולאה!')); } }
    A.turn += (lr * PL.aTurn * clamp(1.25 - A.v / vMax * 0.55, 0.6, 1) - A.turn) * Math.min(1, 5 * dt); A.psi += A.turn * dt;
    const gm = PL.aG * DEG, back = PL.aPitch * 0.45 * dt;
    if (Math.abs(ud) > 0.05 && !(S.trick && ud < 0)) A.gam = clamp(A.gam + ud * PL.aPitch * dt, -gm, gm); else { if (A.out && S.ra > 450) A.out = false; A.gam += clamp((A.out ? 0.16 : 0) - A.gam, -back, back); }          // let go: it levels off by itself (after take-off it first climbs clear of the ground)
    if (ud < -0.05) A.out = false;
    { const off = S.thr < 0.05, cap = off ? Math.min(ac.gmax, -0.045) : Math.max(ac.gmax, 0);          // the lever closed all the way: no power, so it glides down (and lands where it comes down)
      if (A.v < vMin * 1.06 && A.gam > cap) { A.gam = Math.max(cap, A.gam - 1.5 * dt); if (off) arcSay('Power is off: gliding down. Push the lever up to fly on', 'ההספק סגור: המטוס גולש למטה. מעלים את הידית כדי להמשיך לטוס'); else if (ud > 0.1 && S.thr < 0.3) arcSay('To climb, push the speed lever up', 'כדי לטפס מעלים את ידית המהירות'); } }         // too slow to keep climbing: the nose lowers to what the engines can hold, whatever the stick says
    { const top = gm * clamp((PL.aCeil - S.pos.y) / 1500, 0, 1); if (A.gam > top) { A.gam = Math.max(top, A.gam - 1.5 * dt); if (top < 0.01 && ud > 0.1) arcSay('This is as high as it goes', 'זה הכי גבוה שאפשר'); } }      // the ceiling
    if (!S.trick && S.ra < 260 + A.v && S.thr >= 0.05) {           // terrain ahead: when the ground rises in front, climb over it by itself (flat ground can still be landed on)
      const here = groundAt(S.pos.x, S.pos.z).h; let need = -1;
      for (const t of [2, 4, 7, 11, 16]) { const gx = S.pos.x + Math.sin(A.psi) * A.v * t * hsAt(S.ra), gz = S.pos.z - Math.cos(A.psi) * A.v * t * hsAt(S.ra), gh = groundAt(gx, gz).h; if (gh > here + 12 && !(landing && (gh - here) / (A.v * t * hsAt(S.ra)) < 0.2)) need = Math.max(need,       /* coming down to land, gently rising ground is somewhere to land, not something to climb over */ (gh + (A.v > 250 ? 100 : 70) - S.pos.y) / (A.v * t)); }
      if (need > A.gam) A.gam = Math.min(need, PL.aG * DEG); }
    if (S.ra < 150 && !S.trick && A.v > vMin * 1.2) A.gam = Math.max(A.gam, -Math.max(S.ra - 6, 0) / 130);          // still fast: it floats just above the ground until it has slowed to landing speed
    if (S.ra < 150 && !S.trick) A.gam = Math.max(A.gam, -(0.1 + Math.max(S.ra, 0) / 130));          // automatic flare: the dive flattens out close to the ground
    A.phi += (A.turn / PL.aTurn * PL.aBank * DEG - A.phi) * Math.min(1, 6 * dt);
    G2 = A.gam + (S.trick && S.trick.type === 'loop' ? S.trick.ang : 0); const cg = Math.cos(G2);
    const hs = hsAt(S.ra); S.pos.x += Math.sin(A.psi) * cg * A.v * dt * hs; S.pos.y += Math.sin(G2) * A.v * dt; S.pos.z -= Math.cos(A.psi) * cg * A.v * dt * hs;     // a quarter of the true speed across the map when aloft
    const g = groundAt(S.pos.x, S.pos.z), floor = g.h + GEAR_H;
    if (S.pos.y <= floor) {            // the ground is forgiving: touch down gently anywhere; otherwise skim or bounce, never crash
      S.pos.y = floor; S.trick = null; G2 = 0;
      const gw = g.water, rise = g.h - groundAt(S.pos.x - Math.sin(A.psi) * 30, S.pos.z + Math.cos(A.psi) * 30).h;
      if (gw) return crash(L('The aircraft hit the water.', 'המטוס פגע במים'));
      if (rise > 9) return crash(L('Flew into a hillside.', 'התנגשות בצלע הר'));
      if (A.gam < -0.3) return crash(L('Hit the ground too steeply. Come down gently to land.', 'פגיעה תלולה מדי בקרקע. כדי לנחות יורדים בעדינות'));
      // still too fast: it skips back into the air instead of crashing, and says why
      if (A.v > PL.vs * 1.6) { S.pos.y = floor + 1.5; A.gam = 0.07; A.v *= 0.97; S.shake = 0.3; A.out = false; arcSay('Too fast to land: hold the stick down and it slows by itself', 'מהר מדי לנחיתה: מחזיקים את המוט למטה והמטוס מאט לבד'); }
      else { S.onGround = true; A.gam = 0; S.landed = true; S.thr = 0; S.shake = 0.25; Snd.chime(700, 0.25); toast(L('Landed!', 'נחתנו!')); }
    }
  }
  // attitude, and the values the rest of the simulator reads
  const roll = A.phi + (S.trick && S.trick.type === 'roll' ? S.trick.ang : 0), cg = Math.cos(G2);
  S.q.setFromEuler(eul.set(G2 + (S.onGround ? 0 : 0.03), -A.psi, -roll, 'YXZ'));
  S.vel.set(Math.sin(A.psi) * cg * A.v, S.onGround ? 0 : Math.sin(G2) * A.v, -Math.cos(A.psi) * cg * A.v);
  S.ra = S.pos.y - groundAt(S.pos.x, S.pos.z).h - GEAR_H; S.n1 += clamp(S.thr - S.n1, -0.6 * dt, 0.6 * dt); S.nLoad = Math.min(Math.hypot(1, A.turn * A.v / G), PL.nmax || 9); S.mach = A.v / isa(S.pos.y).a; S.alpha = 0.03; S.vs0 = PL.vs;
  S.stalled = S.stallWarn = false; S.boost = 0; S.prot = ''; S.holdAlt = null;
  ctl.pitch += clamp(ud - ctl.pitch, -4 * dt, 4 * dt); ctl.roll += clamp(lr - ctl.roll, -4 * dt, 4 * dt); ctl.yaw = 0;
}
/** Static interface text in the chosen language. */
function applyLang() {
  const he = SAVE.lang === 'he', set = (sel, en, h) => document.querySelectorAll(sel).forEach(e => e.textContent = he ? h : en);
  document.querySelectorAll('.ov .card, #legend, #photoBar, #sys').forEach(e => e.dir = he ? 'rtl' : 'ltr');
  set('#start h1', 'ISRAEL FLIGHT SIMULATOR', 'סימולטור טיסה מעל ישראל');
  set('#intro', 'Pick an aircraft and a difficulty, then press FLY. Everything else can also be changed during the flight, in the ☰ menu.', 'בוחרים מטוס ורמת קושי ולוחצים "לטוס!". את כל השאר אפשר לשנות גם במהלך הטיסה, בתפריט ☰.');
  $('modeB').textContent = L(LV[S.mode][0], LV[S.mode][1]); set('#langB', 'עברית', 'English'); $('langB').lang = he ? 'en' : 'he';
  document.documentElement.lang = he ? 'he' : 'en'; document.title = L('Israel Flight Simulator', 'סימולטור טיסה מעל ישראל');
  const aria = (id, en, h) => { const e = $(id); e.setAttribute('aria-label', he ? h : en); e.title = he ? h : en; };
  aria('menuB', 'Menu', 'תפריט'); aria('mClose', 'Close the menu', 'סגירת התפריט'); aria('map', 'Map: tap to enlarge or shrink', 'מפה: הקשה מגדילה ומקטינה'); aria('phIn', 'Closer', 'קרוב יותר'); aria('phOut', 'Farther', 'רחוק יותר'); aria('modeB', 'Difficulty level', 'רמת קושי');
  if (!$('fly').disabled) set('#fly', 'FLY NOW', 'לטוס!');
  set('#menu h2', 'Paused', 'הפסקה'); set('#resume', 'CONTINUE', 'המשך');
  $('cMore').setAttribute('aria-label', L('More actions: land, roll, loop', 'עוד פעולות: נחיתה, גלגול, לולאה'));
  set('#cLand', 'Land', 'נחיתה'); set('#cRoll', 'Roll', 'גלגול'); set('#cLoop', 'Loop', 'לולאה'); set('#cGear', 'Gear', 'גלגלים'); set('#cFlap', 'Flaps', 'מדפים'); set('#cBrake', 'Brake', 'בלם'); set('#cCam', 'View', 'מבט');
  set('#crash h2', 'CRASH', 'התרסקות'); set('#again', 'TRY AGAIN', 'שוב'); set('#airborne', 'Back in the air', 'חזרה לאוויר'); set('#photoBar span', 'Photo mode: drag to look around', 'מצב צילום: גוררים כדי להסתכל'); set('#phDone', 'Done', 'סיום');
  { const ks = document.querySelectorAll('#sys .k'), T = [['Throttle', 'הספק'], ['Flaps', 'מדפים'], ['Gear', 'גלגלים'], ['Autopilot', 'טייס אוטו׳'], ['Level', 'רמה']]; ks.forEach((k, i) => { if (T[i]) k.textContent = he ? T[i][1] : T[i][0]; }); }
  S.legSig = ''; if (FREE.length) { renderPanel('start'); if (S.paused) renderPanel('pause'); }
}

// ---------- 12e. Collisions with buildings, and the explosion ----------
const OBST = new Map(), EXP = { parts: [], t: -1 };
/** Register a box obstacle (centre x,z, width, depth, rotation, base and top height) in a 128 m spatial hash. */
/** True when an upright box of half-sizes hw, hd centred at x, z would cut into something already standing there (with a 1.5 m gap). Buildings are
    tested against it before they are placed, so blocks do not run through each other, and trees do not grow through walls. */
function obstBox(x, z, hw, hd) {
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = OBST.get((Math.floor(x / 128) + a) * 100003 + Math.floor(z / 128) + b); if (!c) continue;
    for (const o of c) { const r = Math.max(o[2], o[3]), lx = o[5] ? r : o[2], lz = o[5] ? r : o[3]; if (Math.abs(x - o[0]) < hw + lx + 1.5 && Math.abs(z - o[1]) < hd + lz + 1.5) return true; } }
  return false;
}
function addObst(x, z, w, d, rot, y0, y1) {
  const o = [x, z, w / 2, d / 2, Math.cos(rot), Math.sin(rot), y0, y1], r = Math.hypot(w, d) / 2;
  for (let gx = Math.floor((x - r) / 128); gx <= Math.floor((x + r) / 128); gx++) for (let gz = Math.floor((z - r) / 128); gz <= Math.floor((z + r) / 128); gz++) { const k = gx * 100003 + gz; let a = OBST.get(k); if (!a) OBST.set(k, a = []); a.push(o); }
}
/** Top of the tallest obstacle around a point (its 128 m cell and the eight around it), or -Infinity: for routes that must clear buildings and the Masada rock, not only the ground. */
function obstacleTop(x, z) {
  let top = -Infinity; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = OBST.get((Math.floor(x / 128) + a) * 100003 + Math.floor(z / 128) + b); if (c) for (const o of c) if (o[7] > top) top = o[7]; }
  return top;
}
function hitObstacle(x, y, z, pad) {
  const a = OBST.get(Math.floor(x / 128) * 100003 + Math.floor(z / 128)); if (!a) return false;
  for (const o of a) { if (y < o[6] || y > o[7] + pad) continue; const dx = x - o[0], dz = z - o[1], lx = dx * o[4] - dz * o[5], lz = dx * o[5] + dz * o[4]; if (Math.abs(lx) < o[2] + pad && Math.abs(lz) < o[3] + pad) return true; }
  return false;
}
function buildBoom() {
  for (let i = 0; i < 30; i++) { const fire = i < 18, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightDot(), color: fire ? (i % 3 ? 0xff8a2a : 0xffe08a) : 0x2a2622, transparent: true, depthWrite: false, fog: false, blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.visible = false; scene.add(s); EXP.parts.push({ s, fire, v: new THREE.Vector3(), r: 1 }); }
  // a white flash, tumbling debris that falls and bounces, and a scorch mark left on the ground
  EXP.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightDot(), color: 0xffffff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false })); EXP.flash.visible = false; scene.add(EXP.flash);
  EXP.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x3a3d42 }), 26); EXP.deb.frustumCulled = false; EXP.deb.visible = false; scene.add(EXP.deb);
  EXP.dp = []; for (let i = 0; i < 26; i++) EXP.dp.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), a: new THREE.Vector3(), w: new THREE.Vector3(), s: 1 });
  EXP.scorch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: lightDot(), color: 0x0d0c0b, transparent: true, depthWrite: false, opacity: 0 })); EXP.scorch.rotation.x = -Math.PI / 2; EXP.scorch.renderOrder = 2; EXP.scorch.visible = false; scene.add(EXP.scorch);
  // tall landmarks you can hit
  const A2 = (lon, lat, dx, dz, w, d, h) => { const x = lon2x(lon) + dx, z = lat2z(lat) + dz, y = heightAt(x, z); addObst(x, z, w, d, 0, y - 10, y + h); };
  A2(34.78, 32.075, 365, -85, 130, 130, 190); A2(34.787, 32.073, 0, 0, 20, 20, 140); A2(35.21, 31.78, 520, 60, 130, 130, 110); A2(35.354, 31.316, 0, 0, 520, 520, 370); A2(34.73, 30.96, 0, 0, 30, 30, 250);
  A2(34.886, 32.47, 60, 0, 170, 30, 300); A2(34.537, 31.63, 30, 0, 110, 30, 250); A2(34.668, 31.845, 30, 0, 110, 30, 150); A2(34.776, 32.106, 0, 0, 30, 30, 150); A2(35.02, 32.762, 0, 0, 40, 40, 102); A2(35.0, 32.812, 0, 0, 40, 40, 110); A2(34.803, 32.084, 0, 0, 44, 44, 235);
}
function startExplosion() {
  const k = PL.chase[0] / 30; EXP.t = 0; EXP.k = k;
  for (const p of EXP.parts) { p.s.position.copy(S.pos); p.s.visible = true; const a = Math.random() * 6.283, e = Math.random() * 1.4 - 0.2, sp = (p.fire ? 8 + Math.random() * 26 : 4 + Math.random() * 9) * k;
    p.v.set(Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + (p.fire ? 6 : 16) * k, Math.sin(a) * Math.cos(e) * sp).addScaledVector(S.vel, p.fire ? 0.12 : 0.05); p.r = 0.6 + Math.random() * 0.8; }
  const g = groundAt(S.pos.x, S.pos.z); EXP.gy = g.h; EXP.wet = g.water;
  EXP.flash.position.copy(S.pos); EXP.flash.visible = true; EXP.deb.visible = true;
  for (const d of EXP.dp) { const a = Math.random() * 6.283, sp = (10 + Math.random() * 34) * k; d.p.copy(S.pos); d.v.set(Math.cos(a) * sp, (8 + Math.random() * 30) * k, Math.sin(a) * sp).addScaledVector(S.vel, 0.25); d.a.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); d.s = (0.5 + Math.random() * 1.3) * k; }
  EXP.scorch.visible = !g.water && S.ra < 40; if (EXP.scorch.visible) { EXP.scorch.position.set(S.pos.x, Math.max(g.h, triHeight(S.pos.x, S.pos.z)) + (g.field ? 0.45 : 3.75), S.pos.z); EXP.scorch.scale.set(46 * k, 46 * k, 1); EXP.scorch.material.opacity = 0; }
}
function updateExplosion(dt) {
  if (EXP.t < 0) return; EXP.t += dt; const t = EXP.t, k = EXP.k, LIFE = 14;
  for (const p of EXP.parts) { p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-(p.fire ? 2.2 : 0.9) * dt)); if (!p.fire) p.v.y += 3 * dt;
    const sc = (p.fire ? 5 + t * 22 : 7 + t * 13 + t * t * 0.5) * k * p.r; p.s.scale.set(sc, sc, 1);
    if (p.fire) { p.s.material.opacity = 0.85 * Math.max(0, 1 - t / 1.3); const h = clamp(t / 1.1, 0, 1); p.s.material.color.setRGB(1, lerp(0.92, 0.28, h), lerp(0.62, 0.05, h)); }      // white-hot, then orange, then dark red
    else p.s.material.opacity = Math.min(0.72, t * 3) * Math.max(0, 1 - t / LIFE); }
  EXP.flash.visible = t < 0.14; if (EXP.flash.visible) { const fs = (60 + t * 900) * k; EXP.flash.scale.set(fs, fs, 1); EXP.flash.material.opacity = 1 - t / 0.14; }
  if (EXP.deb.visible) { const m4 = tmpM, q = tmpQ, sc = tmpV2; let alive = 0;
    EXP.dp.forEach((d, i) => { if (d.s > 0) { d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); d.a.addScaledVector(d.w, dt); const gy = EXP.gy + 0.4;
        if (d.p.y < gy) { d.p.y = gy; if (EXP.wet || Math.abs(d.v.y) < 3) { d.v.set(0, 0, 0); d.w.set(0, 0, 0); if (EXP.wet) d.s = 0; } else { d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5); } }
        alive++; }
      q.setFromEuler(eul.set(d.a.x, d.a.y, d.a.z, 'YXZ')); sc.setScalar(Math.max(d.s, 0.001)); m4.compose(d.p, q, sc); EXP.deb.setMatrixAt(i, m4); });
    EXP.deb.instanceMatrix.needsUpdate = true; }
  if (EXP.scorch.visible) EXP.scorch.material.opacity = Math.min(0.75, t * 1.5);
  if (t > LIFE) { EXP.t = -1; for (const p of EXP.parts) p.s.visible = false; EXP.deb.visible = false; EXP.flash.visible = false; }
}
/** Rain you fly through: streaks in a box round the camera, slanted by the aircraft's own speed, so they rush at you when you fly fast. One draw call. */
let RAIN = null;
function updateRain(dt) {
  if (WX !== 2) { if (RAIN) RAIN.visible = false; return; }
  if (!RAIN) { const N = HIRES ? 900 : 420, P = new Float32Array(N * 6), E = new Float32Array(N * 2); for (let i = 0; i < N; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); P.set([a, b, c, a, b, c], i * 6); E[i * 2] = 0; E[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(E, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uOff: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, -1, 0) }, uLen: { value: 1 } },
      vertexShader: `attribute float aEnd; uniform vec3 uOff, uDir; uniform float uLen; varying float vA;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main(){ vec3 p=mod(position*70.0+uOff,70.0)-35.0; vA=(1.0-aEnd)*(1.0-smoothstep(20.0,35.0,length(p))); p+=cameraPosition-uDir*uLen*aEnd; vec4 mv=viewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `varying float vA;
        #include <common>
        #include <logdepthbuf_pars_fragment>
        void main(){
          #include <logdepthbuf_fragment>
          gl_FragColor=vec4(0.80,0.86,0.94,0.5*vA); }` });
    m.extensions = { derivatives: false, fragDepth: true, drawBuffers: false, shaderTextureLOD: false };
    RAIN = new THREE.LineSegments(g, m); RAIN.frustumCulled = false; RAIN.renderOrder = 6; scene.add(RAIN); }
  RAIN.visible = S.started; const u = RAIN.material.uniforms, rel = tmpV.set(3, -11, 1).sub(S.vel), sp = rel.length();        // the rain's motion as seen from the aircraft
  u.uOff.value.addScaledVector(rel, dt); u.uOff.value.set(u.uOff.value.x % 70, u.uOff.value.y % 70, u.uOff.value.z % 70); u.uDir.value.copy(rel).multiplyScalar(1 / Math.max(sp, 1)); u.uLen.value = clamp(sp * 0.035, 0.7, 7);
}
const LV = [['Easy', 'קל'], ['Medium', 'בינוני'], ['Expert', 'מקצועי']];
const LVD = [['The stick steers the aircraft directly. No stalls, land anywhere', 'המוט מכוון את המטוס ישירות. המטוס לא נופל, ונוחתים בכל מקום'], ['Real flight physics, with automatic gear, flaps and protections', 'פיזיקת טיסה אמיתית, עם גלגלים ומדפים אוטומטיים והגנות'], ['Real physics and full manual control', 'פיזיקה אמיתית ושליטה ידנית מלאה']];
/** The three difficulty buttons (start screen and menu). */
function levelButtons(el, after) {
  el.textContent = '';
  LV.forEach((n, i) => { const b = document.createElement('button'); b.className = i === S.mode ? 'on' : ''; b.innerHTML = '<b></b><small></small>'; b.firstChild.textContent = L(n[0], n[1]); b.lastChild.textContent = L(LVD[i][0], LVD[i][1]);
    b.addEventListener('click', () => { setMode(i); if (after) after(); else levelButtons(el); }); el.appendChild(b); });
}
