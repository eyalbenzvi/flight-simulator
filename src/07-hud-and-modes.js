'use strict';
// ---------- 12. Instruments ----------
const pfdC = document.getElementById('pfd'), P = pfdC.getContext('2d'), mapC = document.getElementById('map'), M = mapC.getContext('2d');
const FONT = '"DIN Alternate","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif';
function ilsOf(rw, toTouchdown) {
  const rx = S.pos.x - rw.tx, rz = S.pos.z - rw.tz, along = -(rx * rw.dx + rz * rw.dz), cross = rx * -rw.dz + rz * rw.dx;
  if (along > (toTouchdown ? -rw.len * 0.7 : 150) && along < 15000 && Math.abs(cross) < Math.max(along, 0) * 0.4 + 200)
    return { rw, along, cross, loc: Math.atan2(cross, Math.max(along + 300, 1)) / DEG, gs: Math.atan2(S.pos.y - GEAR_H - rw.elev, Math.max(along + 300, 1)) / DEG - 3 };
  return null;
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
  P.textAlign = 'right'; P.fillStyle = S.ra * FT < 2500 ? '#ffb84a' : '#8a9fb0'; P.fillText('RA ' + (S.ra * FT < 2500 ? Math.max(0, Math.round(S.ra * FT / 10) * 10) : '----'), 432, 262);
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
  const wps = WAYPOINTS.map(([n, lo, la]) => [n, mx(lon2x(lo)), mz(lat2z(la)), lo]);
  for (const [n, x, y, lo] of wps) { const t = big ? L(...WP_NAMES[n]) : n; label(t, x, y, big ? 13 : 10, big, 'wp', lo < 35 ? ['l', 'r', 'u', 'd'] : ['r', 'l', 'u', 'd']); }
  if (big) {
    const near = (x, y) => wps.some(w => Math.hypot(w[1] - x, w[2] - y) < px(14)), minPop = Math.max(1, 20 / Math.pow(zs, 1.5));
    const locs = LOCS.filter(l => l[4] >= minPop).sort((a, b) => b[4] - a[4]).map(l => [L(l[1], l[0]), mx(lon2x(l[2])), mz(lat2z(l[3])), l[4]]);
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
    for (const c of [0, 1, 2]) for (const p of roadPaths) { if (p[0][3] !== c) continue; M.strokeStyle = c === 2 ? 'rgba(255,236,170,.95)' : c === 1 ? 'rgba(240,240,235,.8)' : 'rgba(230,230,225,.5)'; M.lineWidth = px(c === 2 ? 2.2 : c === 1 ? 1.4 : 0.9); M.beginPath();
      p.forEach((q, i) => i ? M.lineTo(mx(q[0]), mz(q[2])) : M.moveTo(mx(q[0]), mz(q[2]))); M.stroke(); } }
  M.lineWidth = px(1.2); M.strokeStyle = '#ff66ee';                                     // ILS approach feathers
  for (const rw of RUNWAYS) { if (!rw.ils) continue; const x = mx(rw.tx), y = mz(rw.tz), ex = mx(rw.tx - rw.dx * 9000), ey = mz(rw.tz - rw.dz * 9000);
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
  if (S.ap.on) { const b = S.ap.hdg * DEG; M.strokeStyle = '#ff66ee'; M.setLineDash([px(4), px(4)]); M.beginPath(); M.moveTo(px0, py0); M.lineTo(px0 + Math.sin(b) * len, py0 - Math.cos(b) * len); M.stroke(); M.setLineDash([]); }
  M.save(); M.translate(px0, py0); M.rotate(h); M.scale(a / 7, a / 7); M.fillStyle = '#ffd21f'; M.strokeStyle = '#000'; M.lineWidth = 1; M.beginPath(); M.moveTo(0, -7); M.lineTo(5, 5); M.lineTo(0, 2); M.lineTo(-5, 5); M.closePath(); M.fill(); M.stroke(); M.restore();
  // fixed to the frame: north marker, and the zoom factor while zoomed
  const pf = v => v / u0; M.setTransform(k, 0, 0, k, 0, 0); M.textAlign = 'center'; M.font = 'bold ' + pf(12).toFixed(3) + 'px ' + FONT; M.strokeStyle = 'rgba(0,0,0,.8)'; M.lineWidth = pf(3); M.fillStyle = '#fff';
  M.strokeText('N', W - pf(9), pf(9)); M.fillText('N', W - pf(9), pf(9));
  if (big && z > 1.001) { const t = z.toFixed(1) + '×'; M.font = 'bold ' + pf(11).toFixed(3) + 'px ' + FONT; M.textAlign = 'left'; M.strokeText(t, pf(7), pf(10)); M.fillText(t, pf(7), pf(10)); }
}
function hintText() {
  const T = document.body.classList.contains('touch'), up = SAVE.inv ? '↓' : '↑', dn = SAVE.inv ? '↑' : '↓', ft = m => (Math.round(m * FT / 50) * 50).toLocaleString('en') + ' ft';
  if (S.crashed) return '';
  if (S.trick) return S.trick.type === 'loop' ? 'Looping…' : 'Rolling…';
  if (S.land) return S.onGround ? L('Autoland: braking', 'נחיתה אוטומטית: בולמים') : L('Autoland to ' + AIRPORTS[S.land.ap].name + '. Hands off', 'נחיתה אוטומטית. לא נוגעים');
  if (S.ap.on) return 'Autopilot on. The stick moves its altitude and heading targets';
  if (S.arc) {
    if (S.onGround) return A.v > 3 ? L('Here we go!', 'יוצאים לדרך!') : T ? L('Push the speed lever up. It takes off by itself', 'מרימים את ידית המהירות. המטוס ממריא לבד') : L('Hold Shift to go. It takes off by itself', 'מחזיקים Shift. המטוס ממריא לבד');
    if (S.airTime < 25) return T ? L('Move the stick where you want to fly. Let go to fly straight', 'מזיזים את הג׳ויסטיק לאן שרוצים לטוס. משחררים, וטסים ישר') : L('The arrows steer. Let go to fly straight. X rolls, Z loops', 'החצים מכוונים. משחררים, וטסים ישר. X גלגול, Z לולאה');
    if (S.ra < 150 && A.v < PL.vs * 1.9) return L('Fly gently onto the ground to land', 'יורדים בעדינות אל הקרקע כדי לנחות');
    return '';
  }
  if (S.onGround) {
    if (S.thr > 0.5) return S.assist ? 'Full power. It lifts off by itself' : 'Full power. Raise the nose at ' + Math.round(S.vs0 * 1.15 * KT) + ' kt';
    if (S.landed) return S.assist ? 'Slowing down' : (T ? 'Hold Brake to stop' : 'Hold B or Space to brake');
    return T ? 'Slide the power lever up to take off' : 'Hold Shift, or press 9, for take-off power';
  }
  if (S.assist) {
    if (S.prot) return S.prot;
    if (AIRPORTS.some(ap => Math.hypot(S.pos.x - ap.x, S.pos.z - ap.z) < ap.R - 50) && S.gear) return T ? 'Over the airport: hold the stick toward Descend to land' : 'Over the airport: hold ' + dn + ' to land';
    if (!S.toClimb && S.airTime > 45 && nearestILS()) return T ? 'Runway ahead: tap Land' : 'Runway ahead: press L to land';
    // otherwise say what the aircraft is doing
    if (S.toClimb) return 'Climbing out. Gear and flaps are automatic';
    if (S.holdAlt !== null) return 'Holding ' + ft(S.holdAlt);
    return S.vel.y > 1.5 ? 'Climbing through ' + ft(S.pos.y) : S.vel.y < -1.5 ? 'Descending through ' + ft(S.pos.y) : '';
  }
  if (S.gear && !PL.fixedGear && S.ra > 250 && S.V > S.vs0 * 1.5) return T ? 'Gear is still down: tap Gear' : 'Gear is still down: press G';
  if (S.gamHold !== null) return 'Manual: holding this path';
  return '';
}
/** The always-visible key guide (desktop). It changes with the flight mode and the pitch setting. */
function drawLegend() {
  const el = $('legend'), up = SAVE.inv ? '↓' : '↑', dn = SAVE.inv ? '↑' : '↓'; el.style.display = S.legend ? 'grid' : 'none'; el.textContent = '';
  if (S.arc) { for (const [k, en, he] of [[up, 'Up', 'למעלה'], [dn, 'Down', 'למטה'], ['← →', 'Turn', 'פנייה'], ['Shift', 'Faster', 'מהר יותר'], ['Ctrl', 'Slower', 'לאט יותר'], ['X', 'Roll', 'גלגול'], ['Z', 'Loop', 'לולאה'], ['Space', 'Brake', 'בלם'], ['L', 'Land for me', 'נחיתה אוטומטית'], ['C', 'Change view', 'החלפת מבט'], ['Esc', 'Menu', 'תפריט']]) {
      const b = document.createElement('b'), sp = document.createElement('span'); b.textContent = k; b.dir = 'ltr'; sp.textContent = L(en, he); el.appendChild(b); el.appendChild(sp); } return; }
  const rows = [[up, S.assist ? 'Climb' : 'Nose up'], [dn, S.assist ? 'Descend' : 'Nose down'], ['← →', S.assist ? 'Turn' : 'Roll'], ['Shift / Ctrl', 'Power up / down'], ['0 – 9', 'Set power'], ['B / Space', 'Brake'], ['L', 'Land automatically']];
  if (!S.assist) rows.push(['G', 'Landing gear'], ['F', 'Flaps']);
  rows.push(['Esc', 'Menu'], ['K', 'Hide this']);
  for (const [k, t] of rows) { const b = document.createElement('b'), sp = document.createElement('span'); b.textContent = k; sp.textContent = t; el.appendChild(b); el.appendChild(sp); }
}
function drawSys() {
  const touchUI = document.body.classList.contains('touch'), air = !S.onGround;
  const auto = S.thr >= 0 && S.boost > S.thr + 0.01, t = auto ? S.boost : S.thr, thrTxt = t < -0.01 ? 'REV ' + Math.round(-t * 100) + '%' : (auto ? 'AUTO ' : '') + Math.round(t * 100) + '%';
  if (touchUI) { $('thrTf').style.height = clamp(S.thr, 0, 1) * 100 + '%'; $('thrPct').textContent = thrTxt; }
  else {
    $('sThr').textContent = thrTxt; $('sThr').className = t < -0.01 || auto ? 'warnc' : '';
    $('thrFill').style.width = Math.abs(t) * 100 + '%'; $('thrFill').style.background = t < 0 ? 'var(--amber)' : 'var(--cyan)';
    $('sFlap').textContent = FLAPS.length < 2 ? 'NONE' : Math.round(S.flapDeg) + '°' + (Math.abs(S.flapDeg - FLAPS[S.flapIdx]) > 0.5 ? ' → ' + FLAPS[S.flapIdx] + '°' : '');
    const gp = S.gearPos, ge = $('sGear'); ge.textContent = PL.fixedGear ? 'FIXED' : gp > 0.98 ? '▼ DOWN' : gp < 0.02 ? '▲ UP' : 'IN TRANSIT'; ge.className = gp > 0.98 ? 'ok' : gp < 0.02 ? '' : 'warnc';
    const ae = $('sAp'); ae.textContent = S.land ? 'LAND ' + S.land.label : S.ap.on ? Math.round(S.ap.alt * FT / 10) * 10 + ' ft / ' + String(Math.round(S.ap.hdg) % 360).padStart(3, '0') + '°' : 'OFF'; ae.className = S.ap.on || S.land ? 'mg' : '';
    $('sMode').textContent = S.arc ? 'EASY' : S.assist ? 'ASSISTED' : 'MANUAL'; $('sMode').className = S.assist ? 'ok' : 'warnc';
  }
  if (document.body.classList.contains('nopfd')) $('strip').innerHTML = '<b>' + Math.round(S.V * KT) + '</b><span>kt</span><b>' + (Math.round(S.pos.y * FT / 10) * 10).toLocaleString('en') + '</b><span>ft</span><b>' + String(Math.round(S.hdg) % 360).padStart(3, '0') + '°</b>';
  $('hint').textContent = hintText(); $('place').textContent = S.place ? L('Over ' + S.place, 'מעל ' + S.placeHe) : '';
  if (!touchUI) { const sig = '' + S.mode + SAVE.lang + (SAVE.inv ? 'i' : 'n') + (S.legend ? 1 : 0); if (sig !== S.legSig) { S.legSig = sig; drawLegend(); } }
  const al = $('alert'), blink = (TNOW * 3 % 1) < 0.6;
  if (S.stallWarn && !S.crashed) { al.textContent = 'STALL'; al.style.display = blink ? 'block' : 'none'; }
  else if (S.gpws && !S.crashed && !S.assist) { al.textContent = 'PULL UP'; al.style.display = blink ? 'block' : 'none'; }
  else if (!S.assist && !S.gear && !S.onGround && !S.crashed && S.ra < 220 && S.vel.y < -1) { al.textContent = 'GEAR UP'; al.style.display = blink ? 'block' : 'none'; }
  else al.style.display = 'none';
  if (touchUI) {   // only the buttons that matter right now
    const ils = air && !S.trick && (S.land || nearestILS());
    $('cLand').hidden = !ils; $('cLand').textContent = S.land ? 'Cancel' : 'Land';
    $('cRoll').hidden = $('cLoop').hidden = !((PL.tricks || S.arc) && air && !S.land && S.ra > (S.arc ? 40 : 150));
    $('cGear').hidden = S.assist || !!PL.fixedGear; $('cFlap').hidden = S.assist || FLAPS.length < 2;
    $('cBrake').hidden = !(S.onGround || !S.assist);
    const uT = S.arc ? L('Up', 'למעלה') : S.assist ? 'Climb' : 'Nose up', dT = S.arc ? L('Down', 'למטה') : S.assist ? 'Descend' : 'Nose down'; $('stU').textContent = SAVE.inv ? dT : uT; $('stD').textContent = SAVE.inv ? uT : dT; $('thrLbl').textContent = S.arc ? L('Speed', 'מהירות') : 'Power';
  }
}

// ---------- 12b. Settings, smoke trails, air traffic, weather, photo mode ----------
const SAVE = (() => { const d = { plane: 'airliner', inv: false, mode: 0, lang: 'he' }; try { const o = JSON.parse(localStorage.getItem('ifs-save') || '{}'); if (o.plane) d.plane = o.plane; d.inv = !!o.inv; if (o.mode >= 0 && o.mode <= 2) d.mode = o.mode; if (o.lang === 'en') d.lang = 'en'; } catch (e) { /* no storage: defaults */ } return d; })();
function persist() { try { localStorage.setItem('ifs-save', JSON.stringify(SAVE)); } catch (e) { /* storage unavailable: settings last for this session only */ } }
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
  if (S.land) return 'Autoland touchdown: ' + fpm + ' ft/min';
  if (!ru) return (vs < -3.5 ? 'Hard landing: ' : 'Touchdown: ') + fpm + ' ft/min';
  const s1 = clamp(1 - (fpm - 120) / 700, 0, 1), s2 = clamp(1 - Math.abs(ru.cross) / 20, 0, 1), s3 = clamp(1 - Math.abs(ru.fromThr - 300) / 900, 0, 1);
  const sc = Math.round(100 * (0.5 * s1 + 0.3 * s2 + 0.2 * s3)), grade = sc >= 90 ? 'S' : sc >= 75 ? 'A' : sc >= 55 ? 'B' : 'C';
  Snd.chime(sc >= 75 ? 760 : 420, 0.3);
  return 'Landing grade ' + grade + ' (' + sc + '/100): ' + fpm + ' ft/min, ' + Math.abs(ru.cross).toFixed(0) + ' m off centre';
}
function buildFun() {
  const lam = c => new THREE.MeshLambertMaterial({ color: c }), R = rng(404);
  // other aircraft circling the airports and cities
  const body = new THREE.CylinderGeometry(1.9, 1.9, 34, 10).rotateX(Math.PI / 2), wing = new THREE.BoxGeometry(32, 0.5, 5), fin = new THREE.BoxGeometry(0.4, 7, 5), wht = lam(0xf2f2ee), tails = [lam(0x1557a8), lam(0xb83232), lam(0x2f8f6a), lam(0xe0a020)];
  [[34.83, 32.05, 5200, 900, 1], [35.0, 32.86, 4200, 700, -1], [35.2, 31.74, 6000, 1900, 1], [34.98, 29.72, 4500, 800, -1], [35.55, 32.8, 5000, 500, 1], [34.75, 31.3, 5500, 1200, -1], [34.86, 32.4, 7000, 1500, 1]].forEach(([lo, la, r, alt, dir], i) => {
    const g = new THREE.Group(); g.add(new THREE.Mesh(body, wht)); const w = new THREE.Mesh(wing, wht); w.position.set(0, -1, 1); g.add(w); const f = new THREE.Mesh(fin, tails[i % 4]); f.position.set(0, 4.5, 14.5); g.add(f); scene.add(g);
    AIT.push({ g, cx: lon2x(lo), cz: lat2z(la), r, alt, dir, a: R() * 6.283 }); });
  RUNWAYS.forEach(rw => { if (rw.ap > 2) LANDTESTS.push({ label: 'Approach: ' + AIRPORTS[rw.ap].name + ' airstrip', type: 'approach', rw, dist: 6000, flaps: 3, gear: true }); });
  // photo mode: drag to orbit, wheel or the buttons to zoom
  canvas.addEventListener('pointerdown', e => { if (PH.on) PH.drag = [e.clientX, e.clientY]; });
  window.addEventListener('pointermove', e => { if (PH.on && PH.drag) { PH.az -= (e.clientX - PH.drag[0]) * 0.006; PH.el = clamp(PH.el + (e.clientY - PH.drag[1]) * 0.005, -0.3, 1.4); PH.drag = [e.clientX, e.clientY]; } });
  window.addEventListener('pointerup', () => PH.drag = null);
  canvas.addEventListener('wheel', e => { if (PH.on) PH.d = clamp(PH.d * (e.deltaY > 0 ? 1.12 : 0.89), 0.5, 12); }, { passive: true });
  $('phDone').addEventListener('click', () => action('KeyO')); $('phIn').addEventListener('click', () => PH.d = clamp(PH.d * 0.75, 0.5, 12)); $('phOut').addEventListener('click', () => PH.d = clamp(PH.d * 1.33, 0.5, 12));
}
function updateAIT(dt) { for (const a of AIT) { a.a += a.dir * 105 / a.r * dt; const c = Math.cos(a.a), s = Math.sin(a.a); a.g.position.set(a.cx + c * a.r, a.alt, a.cz + s * a.r); a.g.rotation.set(0, Math.atan2(s * a.dir, -c * a.dir), -a.dir * 0.3, 'YXZ'); } }
// weather is layered on top of the time of day
const tmpC = new THREE.Color();
function applyWeather() {
  const t = TOD[S.tod], f = scene.fog, dim = 1 - 0.85 * t.lights, den = [0.000028, 0.00008, 0.000062][WX]; f.density = den; ENV.fogDen.value = den; S.turb = [0, 0.15, 1][WX];
  if (WX === 1) { f.color.lerp(tmpC.setRGB(0.80 * dim, 0.67 * dim, 0.48 * dim), 0.75); skyU.hor.value.lerp(tmpC, 0.8); skyU.top.value.lerp(tmpC, 0.35); }
  if (WX === 2) { f.color.lerp(tmpC.setRGB(0.40 * dim, 0.43 * dim, 0.48 * dim), 0.85); skyU.hor.value.lerp(tmpC, 0.9); skyU.top.value.lerp(tmpC.multiplyScalar(0.6), 0.85); sun.intensity = t.sunI * 0.35; ENV.sunCol.value.multiplyScalar(0.35);
    hemi.intensity = t.hI * 0.8; ENV.skyCol.value.multiplyScalar(0.8); ENV.gndCol.value.multiplyScalar(0.8); skyU.sunCol.value.multiplyScalar(0.15); if (glare) glare.material.opacity *= 0.1; }
  if (cloudMat) { cloudMat.opacity = WX === 2 ? 1 : 0.9; if (WX === 2) cloudMat.color.multiplyScalar(0.5); }
  ENV.fogCol.value.copy(f.color); $('rain').style.display = WX === 2 ? 'block' : 'none';
}
function updateWeather(dt) {
  if (S.flash > 0) { S.flash -= dt; if (S.flash <= 0) applyTOD(S.tod); }
  if (WX !== 2) return; S.lt -= dt;
  if (S.lt <= 0) { S.lt = 4 + Math.random() * 10; S.flash = 0.16; ENV.skyCol.value.setRGB(1.5, 1.5, 1.8); skyU.top.value.setRGB(0.7, 0.72, 0.85); setTimeout(() => Snd.boom(), 300 + Math.random() * 1500); }
}
function photoCamera() {
  const d = PL.chase[0] * PH.d, ce = Math.cos(PH.el); AC.root.position.copy(S.pos); AC.root.quaternion.copy(S.q); AC.m.g.visible = true; AC.deck.visible = false;
  camera.position.set(S.pos.x + Math.sin(PH.az) * ce * d, S.pos.y + Math.sin(PH.el) * d, S.pos.z + Math.cos(PH.az) * ce * d); camera.position.y = Math.max(camera.position.y, groundAt(camera.position.x, camera.position.z).h + 2);
  camera.up.set(0, 1, 0); camera.lookAt(S.pos); if (keys.ArrowLeft) PH.az += 0.02; if (keys.ArrowRight) PH.az -= 0.02; if (keys.ArrowUp) PH.el = Math.min(PH.el + 0.015, 1.4); if (keys.ArrowDown) PH.el = Math.max(PH.el - 0.015, -0.3);
  sky.position.copy(camera.position); if (glare) glare.position.copy(camera.position).addScaledVector(sunDir, 180000);
}

// ---------- 12d. Easy flight: a direct "point and fly" control model for children and first-time pilots ----------
// What makes flying fun for a child: the aircraft goes exactly where the stick points, at once; nothing has to be managed;
// nothing ends the flight; and the ground is a place to land, not a wall. So in Easy mode there is no stall, no crash and
// no systems: the stick steers the flight path itself, the lever sets the speed, and letting go always flies straight and level.
Object.assign(PLANES.airliner, { aTurn: 0.34, aPitch: 0.40, aG: 50, aBank: 42, aVmax: 220, aAcc: 16 });
Object.assign(PLANES.bizjet, { aTurn: 0.45, aPitch: 0.50, aG: 55, aBank: 48, aVmax: 245, aAcc: 20 });
Object.assign(PLANES.fighter, { aTurn: 0.85, aPitch: 0.95, aG: 80, aBank: 78, aVmax: 480, aAcc: 55 });
Object.assign(PLANES.stunt, { aTurn: 0.95, aPitch: 1.05, aG: 80, aBank: 72, aVmax: 95, aAcc: 11 });
const A = { psi: 0, gam: 0, phi: 0, turn: 0, v: 0, sync: true, msgT: 0 };
const L = (en, he) => SAVE.lang === 'he' ? he : en;
const TRD = { 'The aircraft hit the water.': 'המטוס פגע במים', 'Touched down with the landing gear up.': 'נחיתה עם גלגלים מקופלים', 'Flew into terrain.': 'התנגשות בקרקע', 'Wing or nose struck the ground.': 'הכנף או האף פגעו בקרקע', 'Left the airfield at speed.': 'ירידה מהמסלול במהירות גבוהה', 'Airliner': 'מטוס נוסעים', 'Business jet': 'מטוס מנהלים', 'Fighter jet': 'מטוס קרב', 'Aerobatic plane': 'מטוס פעלולים',
  'Twin-jet for 150 passengers. Steady and forgiving, slow to turn': 'סילון גדול ל-150 נוסעים. יציב וסלחני, פונה לאט', 'Sleek T-tail jet. Quick, agile, lands short': 'סילון קטן ומהיר. זריז ונוחת בקלות',
  'Afterburner, Mach 1.5, rolls and loops. Hold on': 'מבער, מהירות על-קולית, גלגולים ולולאות. תחזיקו חזק', 'Light propeller plane with show smoke. Slow, nimble, lands anywhere': 'מטוס מדחף קל עם עשן. איטי, זריז ונוחת בכל מקום',
  'Takeoff: Ben Gurion Airport': 'המראה מנתב״ג', 'Coastline: Tel Aviv': 'חוף תל אביב', 'Flyover: Jerusalem': 'מעל ירושלים', 'Low pass: Dead Sea': 'נמוך מעל ים המלח', 'Crater run: Makhtesh Ramon': 'מכתש רמון', 'Snow line: Mount Hermon': 'השלג בחרמון', 'Sea of Galilee': 'הכנרת',
  'Ben Gurion runway 12': 'נתב״ג, מסלול 12', 'Haifa over the bay': 'חיפה, מעל המפרץ', 'Eilat Ramon': 'רמון (אילת)', 'Rosh Pina airstrip': 'מנחת ראש פינה', 'Masada (Bar Yehuda) airstrip': 'מנחת בר יהודה (מצדה)', 'Beer Sheva airstrip': 'מנחת באר שבע',
  'Cockpit': 'תא הטייס', 'Chase': 'מאחור', 'Wing': 'מהכנף', 'Clear': 'בהיר', 'Dust haze': 'אובך', 'Storm': 'סופה', 'day': 'יום', 'sunset': 'שקיעה', 'night': 'לילה' };
const tr = s => SAVE.lang === 'he' && TRD[s] ? TRD[s] : s;
function setMode(m) {
  S.mode = m; S.arc = m === 0; S.assist = m !== 2; S.holdAlt = null; S.gamHold = null; S.toClimb = false; A.sync = true; SAVE.mode = m; persist();
  document.body.classList.toggle('arc', S.arc); $('modeB').textContent = L('Level: ', 'רמה: ') + L(LV[m][0], LV[m][1]); if (!document.body.classList.contains('touch')) document.body.classList.toggle('nopfd', S.arc); S.legSig = '';
}
function arcSync() {
  const V = S.vel.length(), vMin = PL.vs * 1.15; readAttitude(); A.v = V; A.psi = V > 5 ? Math.atan2(S.vel.x, -S.vel.z) : S.hdg * DEG; A.gam = V > 5 && !S.onGround ? Math.asin(clamp(S.vel.y / V, -1, 1)) : 0; A.phi = S.bank; A.turn = 0; A.sync = false; A.out = false;
  S.thr = S.onGround ? clamp(V / (PL.aVmax * 0.6), 0, 1) : clamp((V - vMin) / (PL.aVmax - vMin), 0, 1);
}
function arcSay(en, he) { if (TNOW > A.msgT) { A.msgT = TNOW + 4; toast(L(en, he)); } }
function arcadeStep(dt) {
  if (A.sync) arcSync();
  let ud = 0, lr = 0; if (keys.KeyW || keys.ArrowUp) ud += 1; if (keys.KeyS || keys.ArrowDown) ud -= 1; if (keys.KeyD || keys.ArrowRight) lr += 1; if (keys.KeyA || keys.ArrowLeft) lr -= 1;
  if (touch.on) { ud -= touch.y; lr += touch.x; } ud = clamp(ud, -1, 1); lr = clamp(lr, -1, 1); if (SAVE.inv) ud = -ud;
  const up = keys.ShiftLeft || keys.ShiftRight || keys.Equal || keys.PageUp, dn = keys.ControlLeft || keys.ControlRight || keys.Minus || keys.PageDown;
  if (up) S.thr += 0.4 * dt; if (dn) S.thr -= 0.4 * dt; S.thr = clamp(S.thr, 0, 1); S.brake = !!(keys.KeyB || keys.Space);
  const vMin = PL.vs * 1.15, vMax = PL.aVmax; let G2 = 0;
  if (S.onGround) {
    // on the ground: the lever drives, the stick steers, and it lifts off by itself once it is fast enough
    const vT = S.brake ? 0 : S.thr * vMax * 0.6, a = (vT > A.v ? PL.aAcc : S.brake ? 30 : 12) * dt; A.v += clamp(vT - A.v, -a, a);
    A.psi += lr * 0.7 * clamp(A.v / 8, 0, 1) * dt; A.gam = 0; A.phi *= Math.exp(-8 * dt); A.turn = 0;
    const sx = Math.sin(A.psi) * A.v * dt, sz = -Math.cos(A.psi) * A.v * dt; S.pos.x += sx; S.pos.z += sz; let g = groundAt(S.pos.x, S.pos.z);
    if (g.water) { S.pos.x -= sx; S.pos.z -= sz; A.v = 0; g = groundAt(S.pos.x, S.pos.z); arcSay('That is water. Turn around', 'זה מים. צריך להסתובב'); }
    S.pos.y = g.h + GEAR_H; S.airTime = 0;
    if (A.v > vMin * 0.8 && (S.thr > 0.4 || ud > 0.1)) { S.onGround = false; A.gam = 0.12; A.out = true; S.landed = false; }
  } else {
    S.airTime += dt;
    const vT = lerp(vMin, vMax, S.thr), a = (vT > A.v ? PL.aAcc : 14) * dt; A.v += clamp(vT - A.v, -a, a);
    const tk = S.trick;
    if (tk) { tk.t += dt; const T = tk.type === 'roll' ? 1.1 : (PL.aPitch > 0.8 ? 3.6 : 6), k = Math.min(tk.t / T, 1), e = k * k * (3 - 2 * k); tk.ang = (tk.type === 'roll' ? tk.dir : 1) * e * Math.PI * 2;
      if (k >= 1) { S.trick = null; Snd.chime(820, 0.25); toast(tk.type === 'roll' ? L('Roll!', 'גלגול!') : L('Loop!', 'לולאה!')); } }
    A.turn += (lr * PL.aTurn * clamp(1.25 - A.v / vMax * 0.55, 0.6, 1) - A.turn) * Math.min(1, 5 * dt); A.psi += A.turn * dt;
    const gm = PL.aG * DEG, back = PL.aPitch * 0.45 * dt;
    if (Math.abs(ud) > 0.05) A.gam = clamp(A.gam + ud * PL.aPitch * dt, -gm, gm); else { if (A.out && S.ra > 150) A.out = false; A.gam += clamp((A.out ? 0.16 : 0) - A.gam, -back, back); }          // let go: it levels off by itself (after take-off it first climbs clear of the ground)
    if (ud < -0.05) A.out = false;
    if (S.ra < 150 && !S.trick) A.gam = Math.max(A.gam, -(0.1 + Math.max(S.ra, 0) / 130));          // automatic flare: the dive flattens out close to the ground
    A.phi += (A.turn / PL.aTurn * PL.aBank * DEG - A.phi) * Math.min(1, 6 * dt);
    G2 = A.gam + (S.trick && S.trick.type === 'loop' ? S.trick.ang : 0); const cg = Math.cos(G2);
    S.pos.x += Math.sin(A.psi) * cg * A.v * dt; S.pos.y += Math.sin(G2) * A.v * dt; S.pos.z -= Math.cos(A.psi) * cg * A.v * dt;
    const g = groundAt(S.pos.x, S.pos.z), floor = g.h + GEAR_H;
    if (S.pos.y <= floor) {            // the ground is forgiving: touch down gently anywhere; otherwise skim or bounce, never crash
      S.pos.y = floor; S.trick = null; G2 = 0;
      const gw = g.water, rise = g.h - groundAt(S.pos.x - Math.sin(A.psi) * 30, S.pos.z + Math.cos(A.psi) * 30).h;
      if (gw) return crash(L('The aircraft hit the water.', 'המטוס פגע במים'));
      if (rise > 9) return crash(L('Flew into a hillside.', 'התנגשות בצלע הר'));
      if (A.gam < -0.3) return crash(L('Hit the ground too steeply. Come down gently to land.', 'פגיעה תלולה מדי בקרקע. כדי לנחות יורדים בעדינות'));
      if (A.v > vMin * 1.9) return crash(L('Too fast to land. Slow down first.', 'מהר מדי לנחיתה. קודם מאטים'));
      S.onGround = true; A.gam = 0; S.landed = true; S.thr = 0; S.shake = 0.25; Snd.chime(700, 0.25); toast(L('Landed!', 'נחתנו!'));
    }
  }
  // attitude, and the values the rest of the simulator reads
  const roll = A.phi + (S.trick && S.trick.type === 'roll' ? S.trick.ang : 0), cg = Math.cos(G2);
  S.q.setFromEuler(eul.set(G2 + (S.onGround ? 0 : 0.03), -A.psi, -roll, 'YXZ'));
  S.vel.set(Math.sin(A.psi) * cg * A.v, S.onGround ? 0 : Math.sin(G2) * A.v, -Math.cos(A.psi) * cg * A.v);
  S.ra = S.pos.y - groundAt(S.pos.x, S.pos.z).h - GEAR_H; S.n1 += clamp(S.thr - S.n1, -0.6 * dt, 0.6 * dt); S.nLoad = 1 + Math.abs(A.turn) * A.v / G; S.alpha = 0.03; S.vs0 = PL.vs;
  S.stalled = S.stallWarn = false; S.boost = 0; S.prot = ''; S.holdAlt = null;
  ctl.pitch += clamp(ud - ctl.pitch, -4 * dt, 4 * dt); ctl.roll += clamp(lr - ctl.roll, -4 * dt, 4 * dt); ctl.yaw = 0;
}
/** Static interface text in the chosen language. */
function applyLang() {
  const he = SAVE.lang === 'he', set = (sel, en, h) => document.querySelectorAll(sel).forEach(e => e.textContent = he ? h : en);
  document.querySelectorAll('.ov .card, #legend, #photoBar').forEach(e => e.dir = he ? 'rtl' : 'ltr');
  set('#start h1', 'ISRAEL FLIGHT SIMULATOR', 'סימולטור טיסה מעל ישראל');
  set('#start p', 'Pick an aircraft and a difficulty, then fly anywhere over Israel. On Easy the arrows (or the stick) steer the aircraft directly, and letting go flies straight. To land, come down slowly and gently, anywhere. Hit the ground hard, the sea or a building, and it ends with a bang.',
    'בוחרים מטוס ורמת קושי, וטסים לכל מקום מעל ישראל. ברמה הקלה החצים (או הג׳ויסטיק) מכוונים את המטוס ישירות, וכשמשחררים הוא טס ישר. כדי לנחות יורדים לאט ובעדינות, בכל מקום. פגיעה חזקה בקרקע, בים או בבניין נגמרת בפיצוץ.');
  set('#sPlH, #hPl', 'Aircraft', 'מטוס'); set('#sLvH, #hLv', 'Difficulty', 'רמת קושי'); set('#hFr', 'Start from', 'מאיפה מתחילים'); set('#hLd', 'Approaches to land', 'גישות לנחיתה'); set('#hSt', 'Settings', 'הגדרות'); levelButtons($('sLevels')); $('modeB').textContent = L('Level: ', 'רמה: ') + L(LV[S.mode][0], LV[S.mode][1]); set('#langB', 'עברית', 'English'); set('summary', 'All keys', 'כל המקשים');
  if (!$('fly').disabled) set('#fly', 'FLY NOW', 'לטוס!');
  set('#menu h2', 'Paused', 'הפסקה'); set('#resume', 'RESUME', 'המשך'); 
  set('#cLand', 'Land', 'נחיתה'); set('#cRoll', 'Roll', 'גלגול'); set('#cLoop', 'Loop', 'לולאה'); set('#cGear', 'Gear', 'גלגלים'); set('#cFlap', 'Flaps', 'מדפים'); set('#cBrake', 'Brake', 'בלם'); set('#cCam', 'View', 'מבט');
  set('#crash h2', 'CRASH', 'התרסקות'); set('#again', 'TRY AGAIN', 'שוב'); set('#airborne', 'Back in the air', 'חזרה לאוויר'); set('#photoBar span', 'Photo mode: drag to look around', 'מצב צילום: גוררים כדי להסתכל'); set('#phDone', 'Done', 'סיום');
  S.legSig = ''; if ($('sPlanes').childElementCount) planeCards($('sPlanes'), startPick);
}
let startPick = () => {};

// ---------- 12e. Collisions with buildings, and the explosion ----------
const OBST = new Map(), EXP = { parts: [], t: -1 };
/** Register a box obstacle (centre x,z, width, depth, rotation, base and top height) in a 128 m spatial hash. */
function addObst(x, z, w, d, rot, y0, y1) {
  const o = [x, z, w / 2, d / 2, Math.cos(rot), Math.sin(rot), y0, y1], r = Math.hypot(w, d) / 2;
  for (let gx = Math.floor((x - r) / 128); gx <= Math.floor((x + r) / 128); gx++) for (let gz = Math.floor((z - r) / 128); gz <= Math.floor((z + r) / 128); gz++) { const k = gx * 100003 + gz; let a = OBST.get(k); if (!a) OBST.set(k, a = []); a.push(o); }
}
function hitObstacle(x, y, z, pad) {
  const a = OBST.get(Math.floor(x / 128) * 100003 + Math.floor(z / 128)); if (!a) return false;
  for (const o of a) { if (y < o[6] || y > o[7] + pad) continue; const dx = x - o[0], dz = z - o[1], lx = dx * o[4] - dz * o[5], lz = dx * o[5] + dz * o[4]; if (Math.abs(lx) < o[2] + pad && Math.abs(lz) < o[3] + pad) return true; }
  return false;
}
function buildBoom() {
  for (let i = 0; i < 30; i++) { const fire = i < 18, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightDot(), color: fire ? (i % 3 ? 0xff8a2a : 0xffe08a) : 0x2a2622, transparent: true, depthWrite: false, fog: false, blending: fire ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.visible = false; scene.add(s); EXP.parts.push({ s, fire, v: new THREE.Vector3(), r: 1 }); }
  // tall landmarks you can hit
  const A2 = (lon, lat, dx, dz, w, d, h) => { const x = lon2x(lon) + dx, z = lat2z(lat) + dz, y = heightAt(x, z); addObst(x, z, w, d, 0, y - 10, y + h); };
  A2(34.78, 32.075, 365, -85, 130, 130, 190); A2(34.787, 32.073, 0, 0, 20, 20, 140); A2(35.21, 31.78, 520, 60, 130, 130, 110); A2(35.354, 31.316, 0, 0, 520, 520, 370); A2(34.73, 30.96, 0, 0, 30, 30, 250);
  A2(34.886, 32.47, 60, 0, 170, 30, 300); A2(34.537, 31.63, 30, 0, 110, 30, 250); A2(34.668, 31.845, 30, 0, 110, 30, 150); A2(34.776, 32.106, 0, 0, 30, 30, 150); A2(35.02, 32.762, 0, 0, 40, 40, 102); A2(35.0, 32.812, 0, 0, 40, 40, 110); A2(34.803, 32.084, 0, 0, 44, 44, 235);
}
function startExplosion() {
  const k = PL.chase[0] / 30; EXP.t = 0; EXP.k = k;
  for (const p of EXP.parts) { p.s.position.copy(S.pos); p.s.visible = true; const a = Math.random() * 6.283, e = Math.random() * 1.4 - 0.2, sp = (p.fire ? 8 + Math.random() * 26 : 4 + Math.random() * 9) * k;
    p.v.set(Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + (p.fire ? 6 : 16) * k, Math.sin(a) * Math.cos(e) * sp).addScaledVector(S.vel, p.fire ? 0.12 : 0.05); p.r = 0.6 + Math.random() * 0.8; }
}
function updateExplosion(dt) {
  if (EXP.t < 0) return; EXP.t += dt; const t = EXP.t, k = EXP.k;
  for (const p of EXP.parts) { p.s.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-(p.fire ? 2.2 : 0.9) * dt)); if (!p.fire) p.v.y += 3 * dt;
    const sc = (p.fire ? 5 + t * 22 : 7 + t * 13) * k * p.r; p.s.scale.set(sc, sc, 1); p.s.material.opacity = p.fire ? 0.85 * Math.max(0, 1 - t / 1.1) : Math.min(0.7, t * 3) * Math.max(0, 1 - t / 6); }
  if (t > 6) { EXP.t = -1; for (const p of EXP.parts) p.s.visible = false; }
}
const LV = [['Easy', 'קל'], ['Medium', 'בינוני'], ['Expert', 'מקצועי']];
const LVD = [['The stick steers the aircraft directly. No stalls, land anywhere', 'המוט מכוון את המטוס ישירות. בלי הזדקרות, נוחתים בכל מקום'], ['Real flight physics, with automatic gear, flaps and protections', 'פיזיקת טיסה אמיתית, עם גלגלים ומדפים אוטומטיים והגנות'], ['Real physics and full manual control', 'פיזיקה אמיתית ושליטה ידנית מלאה']];
/** The three difficulty buttons (start screen and menu). */
function levelButtons(el) {
  el.textContent = '';
  LV.forEach((n, i) => { const b = document.createElement('button'); b.className = i === S.mode ? 'on' : ''; b.innerHTML = '<b></b><small></small>'; b.firstChild.textContent = L(n[0], n[1]); b.lastChild.textContent = L(LVD[i][0], LVD[i][1]);
    b.addEventListener('click', () => { setMode(i); levelButtons($('sLevels')); levelButtons($('mLevels')); }); el.appendChild(b); });
}
