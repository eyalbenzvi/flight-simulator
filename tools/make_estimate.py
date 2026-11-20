#!/usr/bin/env python3
"""Step 1 of the data pipeline (run from the repository root): an ESTIMATE of the settlement raster, used north of the GHSL tile,
plus data/locs.json (the list of localities the HUD and the sky labels use).
Builds the settlement raster the simulator reads: one pixel = one 60 m block of the (4:1 compressed) game world.
R = building height in metres, G = style (1 apartment block, 2 stone house, 3 red-roofed house, 4 glass tower), B = random seed.
Sources: CBS localities (coordinates, population, type) and Ministry of Interior jurisdiction borders."""
import json, glob, math, random, base64, io, sys, csv, os
from PIL import Image, ImageDraw
KX, KZ, CELL = 23750, 27700, 60
X0, Z0 = (33.6 - 35) * KX, -(33.6 - 31.4) * KZ
W, H = math.ceil((36.4 - 33.6) * KX / CELL), math.ceil((33.6 - 29.2) * KZ / CELL)
px = lambda lon: ((lon - 35) * KX - X0) / CELL
py = lambda lat: (-(lat - 31.4) * KZ - Z0) / CELL
random.seed(7)
L = json.load(open('raw/localities.json'))
polys = {}
for f in glob.glob('raw/geojson-israel-municipalities/*/*.geojson'):
    for ft in json.load(open(f))['features']:
        p = ft['properties']; code = (p.get('CV_LAMAS') or '').strip() or ((p.get('CR_LAMAS') or '').strip() if not (p.get('Vaad_Heb') or '').strip() else '')
        if not code.isdigit(): continue
        g = ft['geometry']; rings = [g['coordinates'][0]] if g['type'] == 'Polygon' else [q[0] for q in g['coordinates']]
        polys.setdefault(int(code), []).extend(rings)
img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pix = img.load()
def place(cx, cy, n, cls, style, rings=None, jer=False):
    R = max(3, int(math.sqrt(n / math.pi) * 2.2) + 3); cand = []
    if rings:
        xs = [px(c[0]) for r in rings for c in r]; ys = [py(c[1]) for r in rings for c in r]; x0, y0, x1, y1 = int(min(xs)) - 1, int(min(ys)) - 1, int(max(xs)) + 2, int(max(ys)) + 2
        if (x1 - x0) * (y1 - y0) < 4e6:
            m = Image.new('1', (x1 - x0, y1 - y0), 0); d = ImageDraw.Draw(m)
            for r in rings: d.polygon([(px(c[0]) - x0, py(c[1]) - y0) for c in r], fill=1)
            mp = m.load()
            for yy in range(y1 - y0):
                for xx in range(x1 - x0):
                    if mp[xx, yy]: cand.append((math.hypot(xx + x0 - cx, yy + y0 - cy) * (1 + random.random() * 0.35), xx + x0, yy + y0))
    if len(cand) < max(4, n * 0.5):      # no usable border: a slightly ragged disc
        cand = [(math.hypot(dx, dy) * (1 + random.random() * 0.5), int(cx) + dx, int(cy) + dy) for dx in range(-R, R + 1) for dy in range(-R, R + 1)]
    cand.sort(); k = 0
    for i, (d, x, y) in enumerate(cand[:n]):
        if not (0 <= x < W and 0 <= y < H) or pix[x, y][3]: continue
        f = i / max(n, 1); r = random.random(); st = style
        if cls == 5: h = 40 + r * r * 120 if f < 0.05 else 15 + r * 25 if f < 0.3 else 9 + r * 11
        elif cls == 4: h = 25 + r * r * 45 if f < 0.07 else 12 + r * 16 if f < 0.4 else 8 + r * 8
        elif cls == 3: h = 12 + r * 13 if f < 0.15 else 7 + r * 6
        elif cls == 2: h = 6 + r * 4
        else: h = 5 + r * 2
        if st == 1 and h > 70: st = 4
        if st == 1 and cls <= 2: st = 3
        if st == 3 and h > 9: st = 1
        pix[x, y] = (int(h), st, random.randrange(256), 255); k += 1
    return k
locs = []; tot = 0; withpoly = 0
for l in sorted(L, key=lambda l: -(l.get('population') or 0)):
    c = (l.get('coordinates') or {}).get('wgs84');
    if not c: continue
    pop = l.get('population') or 300; t = l.get('typeOfLocality') or {}; arab = 'לא יהוד' in (t.get('form') or '') + (t.get('group') or '')
    a = 105 if pop >= 150000 else 130 if pop >= 50000 else 170 if pop >= 10000 else 230 if pop >= 2000 else 300
    n = max(5, round(max(pop * a, 90000) / 16 / CELL / CELL)); cls = 5 if pop >= 200000 else 4 if pop >= 50000 else 3 if pop >= 10000 else 2 if pop >= 2000 else 1
    rings = polys.get(l['id']); withpoly += bool(rings)
    tot += place(px(c['longitude']), py(c['latitude']), n, cls, 2 if (arab or l['id'] == 3000) else 1, rings)
    locs.append([l['name'], l.get('nameEn') or '', round(c['longitude'], 4), round(c['latitude'], 4), max(1, round(pop / 1000))])
print('CBS localities', len(locs), 'with border', withpoly, 'cells', tot)
# places outside the CBS list: Palestinian cities, Gaza, and towns across the borders (approximate populations, drawn as ragged discs)
EXTRA = [('עזה','Gaza',34.47,31.51,600),('ח׳אן יונס','Khan Yunis',34.31,31.345,200),('רפיח','Rafah',34.255,31.29,170),('ג׳באליה','Jabalia',34.49,31.535,170),('דיר אל-בלח','Deir al-Balah',34.35,31.418,75),('בית לאהיא','Beit Lahia',34.495,31.552,90),('בית חאנון','Beit Hanoun',34.535,31.54,50),('נוסייראת','Nuseirat',34.39,31.45,80),
 ('חברון','Hebron',35.10,31.53,220),('שכם','Nablus',35.26,32.22,160),('רמאללה','Ramallah',35.205,31.90,90),('ג׳נין','Jenin',35.30,32.46,50),('טולכרם','Tulkarm',35.03,32.31,65),('קלקיליה','Qalqilya',34.97,32.19,55),('בית לחם','Bethlehem',35.20,31.705,60),('יריחו','Jericho',35.46,31.86,22),('יטא','Yatta',35.09,31.448,65),('דורא','Dura',35.03,31.507,40),('טובאס','Tubas',35.37,32.32,22),('קבאטיה','Qabatiya',35.28,32.41,25),('סלפית','Salfit',35.18,32.085,11),
 ('עמאן','Amman',35.93,31.95,1500),('זרקא','Zarqa',36.09,32.07,600),('אירביד','Irbid',35.85,32.555,500),('עקבה','Aqaba',35.01,29.53,150),('א-סלט','Salt',35.73,32.04,100),('ג׳רש','Jerash',35.9,32.28,50),('מידבא','Madaba',35.79,31.72,85),('כרכ','Karak',35.70,31.18,30),('טפילה','Tafila',35.6,30.84,30),
 ('צור','Tyre',35.20,33.27,60),('נבטיה','Nabatieh',35.48,33.38,40),('בינת ג׳בייל','Bint Jbeil',35.43,33.12,30),('דרעא','Daraa',36.1,32.62,100),('נווא','Nawa',36.04,32.89,60),('אל-עריש','El Arish',33.81,31.13,150)]
import reverse_geocoder as rg
rows = [r for r in csv.DictReader(open(os.path.dirname(rg.__file__) + '/rg_cities1000.csv', encoding='utf8')) if r['cc'] != 'IL' and 33.6 <= float(r['lon']) <= 36.4 and 29.2 <= float(r['lat']) <= 33.6]
near = lambda lo, la, lst, d=0.012: any(abs(lo - e[2]) < d and abs(la - e[3]) < d for e in lst)
ex = list(EXTRA) + [(r['name'], r['name'], float(r['lon']), float(r['lat']), 6) for r in rows if not near(float(r['lon']), float(r['lat']), EXTRA, 0.02)]
k2 = 0
for he, en, lo, la, popk in ex:
    if near(lo, la, locs, 0.006): continue
    pop = popk * 1000; a = 60 if pop >= 150000 else 90 if pop >= 50000 else 150
    n = max(5, round(pop * a / 16 / CELL / CELL)); cls = 5 if pop >= 200000 else 4 if pop >= 50000 else 3 if pop >= 10000 else 2
    k2 += place(px(lo), py(la), n, cls, 2); 
    if popk > 6: locs.append([he, en, lo, la, popk])
print('other places', len(ex), 'cells', k2, 'size', W, H)
buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True); b = buf.getvalue(); open('data/estimate.png', 'wb').write(b)
locs.sort(key=lambda l: -l[4])
json.dump(locs, open('data/locs.json', 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':')); print('png bytes', len(b), 'localities', len(locs))
# preview
pv = Image.new('RGB', (W, H), (20, 30, 40)); pp = pv.load()
for y in range(H):
    for x in range(W):
        p = pix[x, y]
        if p[3]: pp[x, y] = {1: (230, 230, 230), 2: (230, 200, 140), 3: (230, 90, 70), 4: (120, 200, 255)}[p[1]]
pv.crop((int(px(34.6)), int(py(32.35)), int(px(35.4)), int(py(31.6)))).resize((1000, 1090), Image.NEAREST).save('data/preview_estimate.png')
