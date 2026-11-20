'use strict';
// ---------- 12f. Start anywhere: pick a place on the map or search for it ----------
/** Well-known places that are not localities, for the search (localities come from LOCS). [English, Hebrew, lon, lat] */
const PICK_SITES = [
  ['Mount Hermon', 'החרמון', 35.786, 33.405], ['Sea of Galilee (Kinneret)', 'הכנרת (ים כנרת)', 35.585, 32.82], ['Mount Tabor', 'הר תבור', 35.39, 32.687], ['Mount Carmel', 'הכרמל', 35.05, 32.73],
  ['Rosh HaNikra', 'ראש הנקרה', 35.105, 33.093], ['Mount Meron', 'הר מירון', 35.41, 32.998], ['Hula Valley', 'עמק החולה', 35.62, 33.08], ['Banias', 'הבניאס', 35.695, 33.248],
  ['Nimrod Fortress', 'מבצר נמרוד', 35.715, 33.252], ['Gamla', 'גמלא', 35.74, 32.905], ['Mount Gilboa', 'הר הגלבוע', 35.42, 32.47], ['Jordan River (Yardenit)', 'הירדן (ירדנית)', 35.571, 32.708],
  ['Akko old city', 'העיר העתיקה בעכו', 35.069, 32.922], ['Bahai Gardens', 'הגנים הבהאיים', 34.987, 32.814], ['Caesarea', 'קיסריה העתיקה', 34.891, 32.5], ['Azrieli Towers', 'מגדלי עזריאלי', 34.792, 32.074],
  ['Tel Aviv Port', 'נמל תל אביב', 34.774, 32.098], ['Jaffa Port', 'נמל יפו', 34.751, 32.053], ['Ben Gurion Airport', 'נמל התעופה בן גוריון', 34.886, 32.0], ['Latrun', 'לטרון', 34.98, 31.838],
  ['Western Wall', 'הכותל המערבי', 35.2345, 31.7767], ['Herodium', 'הרודיון', 35.241, 31.666], ['Dead Sea', 'ים המלח', 35.5, 31.5], ['Masada', 'מצדה', 35.354, 31.316],
  ['Ein Gedi', 'עין גדי', 35.387, 31.462], ['Sde Boker', 'שדה בוקר', 34.784, 30.874], ['Makhtesh Ramon', 'מכתש רמון', 34.8, 30.58], ['Timna Park', 'פארק תמנע', 34.955, 29.78],
  ['Coral Beach, Eilat', 'חוף האלמוגים, אילת', 34.918, 29.508], ['Ashkelon National Park', 'הגן הלאומי אשקלון', 34.546, 31.664], ['Beit She\'an', 'בית שאן העתיקה', 35.503, 32.503], ['Golan Heights', 'רמת הגולן', 35.75, 33.0]
];
/** Familiar names and abbreviations the locality list spells otherwise, separated by |. */
const PICK_ALIAS = { 'צפת': 'Safed|Tzfat', 'עכו': 'Acre', 'באר שבע': 'Beersheba|ב"ש', 'תל אביב-יפו': 'Jaffa|ת"א|תל אביב יפו|יפו', 'ירושלים': 'י-ם', 'נוף הגליל': 'Nazareth Illit|נצרת עילית', 'הרצליה': 'Herzliya', 'כפר סבא': 'Kfar Saba|כפ"ס',
  'רעננה': 'Raanana', 'קריית גת': 'Kiryat Gat', 'קריית שמונה': 'Kiryat Shmona|ק"ש', 'מודיעין-מכבים-רעות': 'Modiin', 'ראשון לציון': 'Rishon LeZion|ראשל"צ', 'נס ציונה': 'Nes Ziona', 'בית שמש': 'Beit Shemesh',
  'פתח תקווה': 'Petah Tikva|פ"ת', 'רמת גן': 'ר"ג', 'בני ברק': 'ב"ב', 'רמת השרון': 'רמה"ש' };
const PICK = { open: false, where: 'start', pt: null, name: null, alt: 1, hdg: 0, s: 1, ox: 0, oy: 0, ptr: new Map(), moved: false, pinch: 0, rer: null, idx: null };
const PICK_ALTS = [300, 1000, 2500], PICK_HDGS = [0, 90, 180, 270];
/** Search key: no vowel points or punctuation, and English spellings folded together (Qiryat / Kiryat, Eilat / Elat, Tzfat / Zefat). */
const pickNorm = s => s.toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[\u05F3\u05F4'"`\u2019]/g, '').replace(/[-\u2013\u05BE.,()]/g, ' ')
  .replace(/q/g, 'k').replace(/ei/g, 'e').replace(/t[sz]/g, 'z').replace(/[kc]h/g, 'h').replace(/w/g, 'v').replace(/([a-z])\1/g, '$1').replace(/\s+/g, ' ').trim();
/** A looser key for spelling variants: no vowels inside a word (Shemona / Shmona, Zefat / Tzfat), and no vav or yod (קרית / קריית). */
const pickSkel = n => n.split(' ').map(w => w[0] + w.slice(1).replace(/[aeiouy\u05D5\u05D9]/g, '')).join(' ');
function pickIndex() {
  if (PICK.idx) return PICK.idx;
  PICK.idx = LOCS.map(l => ({ en: l[1], he: l[0], lon: l[2], lat: l[3], pop: l[4], site: false })).concat(PICK_SITES.map(p => ({ en: p[0], he: p[1], lon: p[2], lat: p[3], pop: 150, site: true })));
    for (const e of PICK.idx) { e.ne = pickNorm(e.en); e.nh = pickNorm(e.he); e.al = !e.site && PICK_ALIAS[e.he] ? PICK_ALIAS[e.he].split('|').map(pickNorm) : []; e.se = pickSkel(e.ne); e.sh = pickSkel(e.nh); }
  return PICK.idx;
}
/** Search results, best first: the name starts with the text, then a word in it does, then it contains it; bigger places first. */
function pickSearch(q) {
  q = pickNorm(q); if (!q) return []; const qs = pickSkel(q);
  const score = (n, q) => n.startsWith(q) ? 0 : (' ' + n).includes(' ' + q) ? 1 : n.includes(q) ? 2 : 9, out = [];
  for (const e of pickIndex()) { let sc = Math.min(score(e.ne, q), score(e.nh, q), ...e.al.map(a => score(a, q))); if (sc === 9 && qs.length > 1) sc = Math.min(score(e.se, qs), score(e.sh, qs)) + 3; if (sc < 9) out.push([sc, e]); }
  return out.sort((a, b) => a[0] - b[0] || b[1].pop - a[1].pop).slice(0, 8).map(a => a[1]);
}
/** The name of a point on the map: a site or town it is in or near, else its coordinates. */
function pickNameAt(x, z) {
  let best = null;
  for (const e of pickIndex()) { const d = Math.hypot(lon2x(e.lon) - x, lat2z(e.lat) - z) * 4, r = e.site ? 4000 : 1500 + 120 * Math.sqrt(e.pop * 1000) / 10;    // real metres
    const sc = d / r; if (sc < 3 && (!best || sc < best.sc)) best = { sc, e, d }; }
  if (!best) return [x2lon(x).toFixed(2) + '°E, ' + z2lat(z).toFixed(2) + '°N', x2lon(x).toFixed(2) + '°E, ' + z2lat(z).toFixed(2) + '°N'];
  return best.sc < 1 ? [best.e.en, best.e.he] : ['Near ' + best.e.en, 'ליד ' + best.e.he];
}
// map view: PICK.s canvas pixels per map-image pixel, PICK.ox / oy the image point at the canvas's top-left corner
const pickC = () => $('pickMap');
const pickImgXY = (x, z) => [(x - X0) / (X1 - X0) * mapImg.width, (z - Z0) / (Z1 - Z0) * mapImg.height];
const pickWorld = (ix, iy) => [X0 + ix / mapImg.width * (X1 - X0), Z0 + iy / mapImg.height * (Z1 - Z0)];
function pickFit(lon0, lat0, lon1, lat1) {
  const c = pickC(), [ax, ay] = pickImgXY(lon2x(lon0), lat2z(lat1)), [bx, by] = pickImgXY(lon2x(lon1), lat2z(lat0));
  PICK.s = Math.min(c.width / (bx - ax), c.height / (by - ay)); PICK.ox = (ax + bx) / 2 - c.width / 2 / PICK.s; PICK.oy = (ay + by) / 2 - c.height / 2 / PICK.s; pickClamp();
}
function pickClamp() {
  const c = pickC(), smin = Math.min(c.width / mapImg.width, c.height / mapImg.height), smax = 8 * (window.devicePixelRatio || 1);
  PICK.s = clamp(PICK.s, smin, smax); const vw = c.width / PICK.s, vh = c.height / PICK.s;
  PICK.ox = vw >= mapImg.width ? (mapImg.width - vw) / 2 : clamp(PICK.ox, 0, mapImg.width - vw); PICK.oy = vh >= mapImg.height ? (mapImg.height - vh) / 2 : clamp(PICK.oy, 0, mapImg.height - vh);
}
function pickZoomAt(cx, cy, f) { const ix = PICK.ox + cx / PICK.s, iy = PICK.oy + cy / PICK.s; PICK.s *= f; pickClamp(); PICK.ox = ix - cx / PICK.s; PICK.oy = iy - cy / PICK.s; pickClamp(); pickDraw(); }
function pickSize() {
  const c = pickC(), dpr = Math.min(window.devicePixelRatio || 1, 3), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { const cx = PICK.ox + c.width / 2 / PICK.s, cy = PICK.oy + c.height / 2 / PICK.s, k = c.width ? w / c.width : 1; c.width = w; c.height = h; PICK.s *= k; PICK.ox = cx - w / 2 / PICK.s; PICK.oy = cy - h / 2 / PICK.s; pickClamp(); }
}
/** Start point for the chosen place: a little before it, facing it, so the place is just ahead; high enough for the ground on the way. */
function pickDef() {
  const [x, z] = PICK.pt, h = PICK_HDGS[PICK.hdg], agl = PICK_ALTS[PICK.alt], d = dirOf(h), back = 2500 * hsAt(agl), sx = x - d.x * back, sz = z - d.z * back;
  let g = -1e9; for (let i = 0; i <= 8; i++) { const gi = groundAt(sx + (x - sx) * i / 8, sz + (z - sz) * i / 8); g = Math.max(g, gi.h); }
  return { label: L(PICK.name[0], PICK.name[1]), name: PICK.name, pick: true, type: 'air', x: sx, z: sz, alt: Math.max(g, -400) + agl, hdg: h, spd: 115, at: [x, z] };
}
function pickDraw() {
  if (!PICK.open) return; const c = pickC(), x = c.getContext('2d'), dpr = c.width / (c.clientWidth || 1), s = PICK.s, P = (wx, wz) => { const [ix, iy] = pickImgXY(wx, wz); return [(ix - PICK.ox) * s, (iy - PICK.oy) * s]; };
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0b1622'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(mapImg, -PICK.ox * s, -PICK.oy * s, mapImg.width * s, mapImg.height * s);
  if (s > 2 * dpr) {                                    // close in: the roads as sharp lines over the baked image (only those in view)
    if (!PICK.roads) PICK.roads = roadPaths.map(p => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const q of p) { a = Math.min(a, q[0]); b = Math.min(b, q[2]); c = Math.max(c, q[0]); d = Math.max(d, q[2]); } return [p, a, b, c, d]; });
    const [w0, z0] = pickWorld(PICK.ox, PICK.oy), [w1, z1] = pickWorld(PICK.ox + c.width / s, PICK.oy + c.height / s); x.lineJoin = x.lineCap = 'round';
    for (const cl of [0, 1, 2]) { x.strokeStyle = cl === 2 ? 'rgba(255,236,170,.95)' : cl === 1 ? 'rgba(240,240,235,.85)' : 'rgba(230,230,225,.55)'; x.lineWidth = (cl === 2 ? 2.4 : cl === 1 ? 1.6 : 1) * dpr; x.beginPath();
      for (const [p, a, b, cc, d] of PICK.roads) { if (p[0][3] !== cl || cc < w0 || a > w1 || d < z0 || b > z1) continue; p.forEach((q, i) => { const [px, py] = P(q[0], q[2]); i ? x.lineTo(px, py) : x.moveTo(px, py); }); }
      x.stroke(); } }
  // names: sites and towns, bigger first, the more the closer in, never overlapping
  const he = SAVE.lang === 'he', kmPx = s / mapImg.width * (X1 - X0) * 4 / 1000, minPop = clamp(260 / Math.pow(kmPx / dpr * 10, 2), 0.3, 400), boxes = [];
  x.textBaseline = 'middle'; x.lineJoin = 'round';
  const items = pickIndex().filter(e => e.site ? kmPx / dpr > 0.5 : e.pop >= minPop).sort((a, b) => (b.site ? 300 : b.pop) - (a.site ? 300 : a.pop));
  for (const e of items) { const [px, py] = P(lon2x(e.lon), lat2z(e.lat)); if (px < -50 || py < -20 || px > c.width + 50 || py > c.height + 20) continue;
    const fs = (e.site ? 12 : e.pop >= 100 ? 14 : 12) * dpr; x.font = (e.pop >= 100 && !e.site ? '600 ' : '') + fs + 'px system-ui, sans-serif'; const t = he ? e.he : e.en, w = x.measureText(t).width;
    const b = [px + 5 * dpr, py - fs * 0.6, px + 5 * dpr + w, py + fs * 0.6]; if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue; boxes.push(b);
    x.fillStyle = e.site ? '#55d6ff' : '#fff'; x.beginPath(); x.arc(px, py, 2.6 * dpr, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 3 * dpr; x.textAlign = 'left'; x.strokeText(t, b[0], py); x.fillStyle = e.site ? '#bfefff' : '#f2ede2'; x.fillText(t, b[0], py); }
  // the chosen place, and the line the aircraft will fly towards it
  if (PICK.pt) { const d = pickDef(), [ax, ay] = P(d.x, d.z), [bx, by] = P(PICK.pt[0], PICK.pt[1]);
    x.strokeStyle = 'rgba(233,200,119,.95)'; x.lineWidth = 2.5 * dpr; x.setLineDash([7 * dpr, 5 * dpr]); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.setLineDash([]);
    const an = Math.atan2(by - ay, bx - ax); x.save(); x.translate(ax, ay); x.rotate(an); x.fillStyle = '#e9c877'; x.strokeStyle = '#17202a'; x.lineWidth = 1.5 * dpr; x.beginPath();
    x.moveTo(11 * dpr, 0); x.lineTo(-7 * dpr, -7 * dpr); x.lineTo(-3 * dpr, 0); x.lineTo(-7 * dpr, 7 * dpr); x.closePath(); x.fill(); x.stroke(); x.restore();
    x.fillStyle = '#ff5252'; x.strokeStyle = '#fff'; x.lineWidth = 2 * dpr; x.beginPath(); x.arc(bx, by - 14 * dpr, 7 * dpr, Math.PI * 0.8, Math.PI * 2.2); x.lineTo(bx, by); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(bx, by - 14 * dpr, 2.6 * dpr, 0, 7); x.fill(); }
}
function pickSelect(wx, wz, name) {
  if (wx < X0 || wx > X1 || wz < Z0 || wz > Z1) return;
  PICK.pt = [wx, wz]; PICK.name = name || pickNameAt(wx, wz); pickPanel(); pickDraw();
}
/** The bottom bar: what is chosen, height and direction (every choice visible), and the button that starts there. */
function pickPanel() {
  const el = $('pickFoot'); el.textContent = '';
  const t = document.createElement('div'); t.className = 'pickWhat'; t.textContent = PICK.pt ? '📍 ' + L(PICK.name[0], PICK.name[1]) : (document.body.classList.contains('touch') ? L('Tap the map or search to choose a place', 'מקישים על המפה או מחפשים, ובוחרים מקום') : L('Click the map or search to choose a place', 'לוחצים על המפה או מחפשים, ובוחרים מקום')); el.appendChild(t);
  const rows = document.createElement('div'); el.appendChild(rows);
  const row = (label, opts, cur, set) => { const r = document.createElement('div'), sp = document.createElement('span'), g = document.createElement('div'); r.className = 'seg'; sp.textContent = label; g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
    opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = o; b.setAttribute('aria-pressed', String(i === cur)); b.addEventListener('click', () => { set(i); pickPanel(); pickDraw(); }); g.appendChild(b); }); r.append(sp, g); rows.appendChild(r); };
  row(L('Height above ground', 'גובה מעל הקרקע'), [L('Low · 300 m', 'נמוך · 300 מ׳'), L('Medium · 1,000 m', 'בינוני · 1,000 מ׳'), L('High · 2,500 m', 'גבוה · 2,500 מ׳')], PICK.alt, i => { PICK.alt = i; });
  row(L('Flying', 'כיוון טיסה'), [L('North', 'צפונה'), L('East', 'מזרחה'), L('South', 'דרומה'), L('West', 'מערבה')], PICK.hdg, i => { PICK.hdg = i; });
  const go = document.createElement('button'); go.className = 'go'; go.textContent = L('START HERE', 'התחלה כאן'); go.disabled = !PICK.pt; go.addEventListener('click', pickGo); el.appendChild(go);
}
function pickGo() {
  if (!PICK.pt) return; const d = pickDef(); SAVE.pick = { at: PICK.pt, name: PICK.name, alt: PICK.alt, hdg: PICK.hdg }; persist(); closePicker();
  if (PICK.where === 'start') { START = d; spawn(d); $('toast').style.display = 'none'; PICK.rer && PICK.rer(); } else { closeMenu(); spawn(d); }
}
function openPicker(where, rer) {
  PICK.open = true; PICK.where = where; PICK.rer = rer; const ov = $('pick'); ov.style.display = 'flex'; ov.dir = SAVE.lang === 'he' ? 'rtl' : 'ltr';
  $('pickT').textContent = L('Choose a place', 'בחירת מקום'); $('pickClose').setAttribute('aria-label', L('Close', 'סגירה'));
  const q = $('pickQ'); q.placeholder = L('Search a town or site, e.g. Masada', 'חיפוש ישוב או אתר, למשל: מצדה'); q.value = ''; $('pickRes').textContent = ''; $('pickRes').hidden = true;
  $('pickHint').textContent = document.body.classList.contains('touch') ? L('Tap to choose · two fingers to zoom', 'הקשה לבחירה · שתי אצבעות לזום') : L('Click to choose · scroll to zoom · drag to move', 'לחיצה לבחירה · גלגלת לזום · גרירה להזזה'); $('pickHint').textContent += ' · © OpenStreetMap';
  const sv = SAVE.pick; if (!PICK.pt && sv && sv.at) { PICK.pt = sv.at; PICK.name = sv.name; PICK.alt = sv.alt | 0; PICK.hdg = sv.hdg | 0; }
  pickPanel();                 // the bottom bar first: it sets how much room the map has (sizing the map before it squashed the picture and shifted every tap)
  pickC().width = 0; pickSize();
  if (PICK.pt) { const lo = x2lon(PICK.pt[0]), la = z2lat(PICK.pt[1]); pickFit(lo - 0.35, la - 0.35, lo + 0.35, la + 0.35); } else pickFit(34.2, 29.45, 35.95, 33.35);
  pickDraw(); if (!document.body.classList.contains('touch')) q.focus();
}
function closePicker() { PICK.open = false; $('pick').style.display = 'none'; }
function setupPicker() {
  const c = pickC(), q = $('pickQ'), res = $('pickRes'), dpr = () => c.width / (c.clientWidth || 1);
  $('pickClose').addEventListener('click', closePicker);
  window.addEventListener('resize', () => { if (PICK.open) { pickSize(); pickDraw(); } });
  if (window.ResizeObserver) new ResizeObserver(() => { if (PICK.open) { pickSize(); pickDraw(); } }).observe(c);       // the bar under the map changes height when a place is chosen
  const show = list => { res.textContent = ''; res.hidden = !list.length;
    for (const e of list) { const b = document.createElement('button'); b.setAttribute('role', 'option'); const n = document.createElement('b'), m = document.createElement('small'); n.textContent = L(e.en, e.he); m.textContent = (e.site ? L('site', 'אתר') + ' · ' : '') + L(e.he, e.en);
      b.append(n, m); b.addEventListener('click', () => choose(e)); res.appendChild(b); } };
  const choose = e => { res.hidden = true; q.value = L(e.en, e.he); q.blur(); const x = lon2x(e.lon), z = lat2z(e.lat); pickSelect(x, z, [e.en, e.he]);
    const k = e.site ? 0.25 : 0.12 + Math.sqrt(e.pop) / 120; pickFit(e.lon - k, e.lat - k, e.lon + k, e.lat + k); pickDraw(); };
  q.addEventListener('input', () => show(pickSearch(q.value)));
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = pickSearch(q.value); if (r.length) choose(r[0]); } else if (e.key === 'Escape') { if (!res.hidden) { res.hidden = true; e.stopPropagation(); } } });
  document.addEventListener('keydown', e => { if (PICK.open && e.key === 'Escape') { closePicker(); e.stopPropagation(); } }, true);     // Esc closes the picker only, not the menu under it
  // map: drag to move, pinch or wheel to zoom, a tap (not a drag) chooses
  c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); PICK.ptr.set(e.pointerId, [e.offsetX, e.offsetY]); if (PICK.ptr.size === 1) { PICK.moved = false; PICK.down = [e.offsetX, e.offsetY]; } PICK.pinch = 0; res.hidden = true; });
  c.addEventListener('pointermove', e => { const p = PICK.ptr.get(e.pointerId); if (!p) return; const k = dpr();
    if (PICK.ptr.size === 1) { if (Math.hypot(e.offsetX - PICK.down[0], e.offsetY - PICK.down[1]) > 6) PICK.moved = true; if (PICK.moved) { PICK.ox -= (e.offsetX - p[0]) * k / PICK.s; PICK.oy -= (e.offsetY - p[1]) * k / PICK.s; pickClamp(); pickDraw(); } }
    else if (PICK.ptr.size === 2) { PICK.moved = true; const [a, b] = [...PICK.ptr.values()], o = a === p ? b : a, d1 = Math.hypot(e.offsetX - o[0], e.offsetY - o[1]), d0 = Math.hypot(p[0] - o[0], p[1] - o[1]);
      if (d0 > 10) pickZoomAt((e.offsetX + o[0]) / 2 * k, (e.offsetY + o[1]) / 2 * k, d1 / d0); }
    PICK.ptr.set(e.pointerId, [e.offsetX, e.offsetY]); });
  const up = e => { const had = PICK.ptr.has(e.pointerId); PICK.ptr.delete(e.pointerId); if (!had || PICK.ptr.size || PICK.moved || e.type === 'pointercancel') return; const k = dpr();
    const [wx, wz] = pickWorld(PICK.ox + e.offsetX * k / PICK.s, PICK.oy + e.offsetY * k / PICK.s); pickSelect(wx, wz); };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('wheel', e => { e.preventDefault(); const k = dpr(); pickZoomAt(e.offsetX * k, e.offsetY * k, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  for (const [id, f] of [['pickIn', 1.6], ['pickOut', 1 / 1.6]]) $(id).addEventListener('click', () => pickZoomAt(c.width / 2, c.height / 2, f));
}

// ---------- 12g. The flight passport: a stamp for every well-known place flown over ----------
/** One sentence about each place in PICK_SITES, by its English name: [English, Hebrew]. */
const STAMP_FACTS = {
  'Mount Hermon': ['The highest mountain in Israel, with snow in winter and a ski site', 'ההר הגבוה בישראל. בחורף יש בו שלג ואתר סקי'],
  'Sea of Galilee (Kinneret)': ['The lowest freshwater lake in the world, about 210 m below sea level', 'אגם המים המתוקים הנמוך בעולם, כ-210 מטר מתחת לפני הים'],
  'Mount Tabor': ['A round mountain that stands alone in the Jezreel Valley', 'הר עגול שעומד לבדו בעמק יזרעאל'],
  'Mount Carmel': ['A green ridge that runs down to the sea at Haifa', 'רכס ירוק שיורד אל הים בחיפה'],
  'Rosh HaNikra': ['White chalk cliffs and sea caves on the northern border', 'צוקי קירטון לבנים ונקרות ים בגבול הצפון'],
  'Mount Meron': ['The highest peak in the Galilee', 'הפסגה הגבוהה בגליל'],
  'Hula Valley': ['Half a billion birds rest here on their way between Europe and Africa', 'חצי מיליארד ציפורים נודדות עוצרות כאן בדרך בין אירופה לאפריקה'],
  'Banias': ['A spring and a waterfall at the foot of the Hermon', 'מעיין ומפל למרגלות החרמון'],
  'Nimrod Fortress': ['A huge medieval castle on a ridge above the Banias', 'מבצר ענק מימי הביניים על רכס מעל הבניאס'],
  'Gamla': ['An ancient town on a ridge shaped like a camel\'s hump, and a vulture colony', 'עיר עתיקה על רכס בצורת דבשת גמל, ולידה נשרים'],
  'Mount Gilboa': ['Famous for its purple irises in spring', 'מפורסם באירוס הגלבוע הסגול שפורח באביב'],
  'Jordan River (Yardenit)': ['Where the Jordan leaves the Kinneret on its way to the Dead Sea', 'כאן יוצא הירדן מהכנרת בדרכו לים המלח'],
  'Akko old city': ['A walled port city with Crusader halls under its streets', 'עיר נמל מוקפת חומה, ומתחת לרחובותיה אולמות צלבניים'],
  'Bahai Gardens': ['Nineteen garden terraces down the slope of the Carmel', 'תשע-עשרה מדרגות של גנים במורד הכרמל'],
  'Caesarea': ['A Roman port city built by King Herod, with a theatre by the sea', 'עיר נמל רומית שבנה הורדוס, עם תיאטרון על חוף הים'],
  'Azrieli Towers': ['Three towers in Tel Aviv: a circle, a triangle and a square', 'שלושה מגדלים בתל אביב: עגול, משולש ומרובע'],
  'Tel Aviv Port': ['An old port that became a boardwalk by the sea', 'נמל ישן שהפך לטיילת על הים'],
  'Jaffa Port': ['One of the oldest ports in the world, about 4,000 years old', 'אחד הנמלים העתיקים בעולם, בן כ-4,000 שנה'],
  'Ben Gurion Airport': ['Israel\'s main airport, named after the first prime minister', 'שדה התעופה הראשי של ישראל, על שם ראש הממשלה הראשון'],
  'Latrun': ['A hill on the road to Jerusalem, with a monastery and a tank museum', 'גבעה בדרך לירושלים, עם מנזר ומוזיאון טנקים'],
  'Western Wall': ['The Western Wall, in the Old City of Jerusalem', 'הכותל המערבי, בעיר העתיקה בירושלים'],
  'Herodium': ['A palace that King Herod built inside a man-made mountain', 'ארמון שהורדוס בנה בתוך הר מעשה ידי אדם'],
  'Dead Sea': ['The lowest place on Earth, so salty that people float', 'המקום הנמוך בעולם. המים כל כך מלוחים שצפים בהם'],
  'Masada': ['King Herod\'s fortress on a cliff above the Dead Sea', 'המבצר של הורדוס על צוק מעל ים המלח'],
  'Ein Gedi': ['An oasis with waterfalls and ibex beside the Dead Sea', 'נווה מדבר עם מפלים ויעלים ליד ים המלח'],
  'Sde Boker': ['The desert kibbutz where David Ben Gurion lived', 'הקיבוץ במדבר שבו גר דוד בן גוריון'],
  'Makhtesh Ramon': ['The largest erosion crater in the world, 40 km long', 'המכתש הגדול בעולם, באורך 40 קילומטר'],
  'Timna Park': ['Ancient copper mines and red sandstone pillars', 'מכרות נחושת עתיקים ועמודי אבן חול אדומים'],
  'Coral Beach, Eilat': ['A coral reef in the Red Sea, full of colourful fish', 'שונית אלמוגים בים סוף, מלאה דגים צבעוניים'],
  'Ashkelon National Park': ['Ancient city walls and the oldest arched gate in the world, by the sea', 'חומות עיר עתיקה ושער הקשת העתיק בעולם, על חוף הים'],
  'Beit She\'an': ['A Roman city with a theatre and streets of columns', 'עיר רומית עם תיאטרון ורחובות עמודים'],
  'Golan Heights': ['A high basalt plateau of old volcanoes', 'רמה גבוהה של בזלת והרי געש כבויים'] };
const stampCount = () => PICK_SITES.filter(p => SAVE.stamps && SAVE.stamps[p[0]]).length;
/** A stamp is earned by flying within 2 km (real) of the place, below 1,500 m above the ground. */
function updateStamps() {
  if (!S.started || S.crashed || S.onGround || S.ra > 1500) return;
  for (const p of PICK_SITES) { if (SAVE.stamps && SAVE.stamps[p[0]]) continue; if (Math.hypot(lon2x(p[2]) - S.pos.x, lat2z(p[3]) - S.pos.z) > 500) continue;
    (SAVE.stamps = SAVE.stamps || {})[p[0]] = 1; persist(); Snd.chime(660, 0.2); setTimeout(() => Snd.chime(880, 0.3), 160); setTimeout(() => Snd.chime(1100, 0.4), 320); if (navigator.vibrate) navigator.vibrate(60);
    const f = STAMP_FACTS[p[0]]; toast('⭐ ' + L('New stamp: ', 'חותמת חדשה: ') + L(p[0], p[1]) + ' (' + stampCount() + '/' + PICK_SITES.length + ')' + (f ? '\n' + L(f[0], f[1]) : ''), 8); return; }
}
/** The passport in the menus: every place, earned ones in gold with their sentence. Choosing one opens the map on it, to start there. */
function stampGrid(el, where, rer) {
  const intro = document.createElement('p'); intro.style.gridColumn = '1 / -1'; intro.style.margin = '0 0 4px';
  intro.textContent = L('Fly low over a place to collect its stamp. Choose a place to start near it.', 'טסים נמוך מעל מקום כדי לקבל את החותמת שלו. בוחרים מקום כדי להתחיל לידו.'); el.appendChild(intro);
  for (const p of PICK_SITES) { const got = !!(SAVE.stamps && SAVE.stamps[p[0]]), b = document.createElement('button'), f = STAMP_FACTS[p[0]]; b.className = got ? 'on' : ''; b.textContent = (got ? '⭐ ' : '☆ ') + L(p[0], p[1]);
    if (got && f) { const s = document.createElement('small'); s.textContent = L(f[0], f[1]); b.appendChild(s); }
    b.addEventListener('click', () => { openPicker(where, rer); pickSelect(lon2x(p[2]), lat2z(p[3]), [p[0], p[1]]); pickFit(p[2] - 0.25, p[3] - 0.25, p[2] + 0.25, p[3] + 0.25); pickDraw(); }); el.appendChild(b); }
}
