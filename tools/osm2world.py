#!/usr/bin/env python3
"""The country from OpenStreetMap (run from the repository root): raw/israel_and_palestine.osm.pbf -> src/osmworld.js.

On the same 60 m game grid as the settlement raster (one cell = 240 m of real ground, the map is compressed 4:1):
  LC_PNG  land cover, one class per cell (forest, orchard, field, sand, water, industry, greenhouses, solar ...): see LC below.
  BO_PNG  buildings per cell: R = share of the cell covered by building footprints (0-255 = 0-100 %), G = dominant building class
          (low 4 bits, see BC) and log2 of the building count (high 4 bits), B = the tallest tagged building in metres (0 = untagged).
  SITES   identifiable places: [kind, lon*1e5, lat*1e5, height m, length m, width m, rotation deg], real metres, see SK.
  RAILS   railway lines: [lon*1e4, lat*1e4, dlon, dlat, ...] (tunnels left out).
Needs: pip install osmium pillow. Map data (c) OpenStreetMap contributors, ODbL 1.0."""
import base64, collections, io, json, math, sys
import osmium
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else 'raw/israel_and_palestine.osm.pbf'
LON0, LON1, LAT0, LAT1, KX, KZ, CELL = 33.6, 36.4, 29.2, 33.6, 23750, 27700, 60
W, H = math.ceil((LON1 - LON0) * KX / CELL), math.ceil((LAT1 - LAT0) * KZ / CELL)
px = lambda lon: (lon - LON0) * KX / CELL
py = lambda lat: (LAT1 - lat) * KZ / CELL
MX = lambda lat: 111320 * math.cos(math.radians(lat))
MZ = 110950

# ---- land cover classes (drawn in this order, later ones win) ----
LC = {'farm': 4, 'scrub': 6, 'grass': 5, 'orchard': 2, 'vineyard': 3, 'forest': 1, 'sand': 7, 'rock': 8, 'military': 15, 'cemetery': 16,
      'residential': 11, 'industrial': 12, 'construction': 17, 'greenhouse': 13, 'solar': 14, 'wetland': 10, 'water': 9}
ORDER = ['farm', 'scrub', 'grass', 'orchard', 'vineyard', 'forest', 'sand', 'rock', 'military', 'cemetery', 'residential', 'industrial', 'construction', 'greenhouse', 'solar', 'wetland', 'water']
def lc_of(t):
    lu, na, le, wa, pw = t.get('landuse'), t.get('natural'), t.get('leisure'), t.get('water'), t.get('power')
    if pw in ('plant', 'generator') and 'solar' in (t.get('plant:source', '') + t.get('generator:source', '')): return 'solar'
    if na == 'water' or wa or lu in ('reservoir', 'basin', 'salt_pond', 'aquaculture'): return 'water'
    if na == 'wetland': return 'wetland'
    if lu in ('greenhouse_horticulture',): return 'greenhouse'
    if lu in ('industrial', 'commercial', 'retail', 'railway', 'port', 'depot', 'garages') or t.get('man_made') in ('works', 'wastewater_plant', 'water_works'): return 'industrial'
    if lu in ('construction', 'brownfield', 'landfill'): return 'construction'
    if lu == 'residential': return 'residential'
    if lu == 'cemetery' or t.get('amenity') == 'grave_yard': return 'cemetery'
    if lu == 'military': return 'military'
    if lu == 'quarry' or na in ('bare_rock', 'scree', 'stone'): return 'rock'
    if na in ('sand', 'beach', 'dune') or lu == 'beach': return 'sand'
    if lu == 'forest' or na == 'wood': return 'forest'
    if lu == 'vineyard': return 'vineyard'
    if lu in ('orchard', 'plantation'): return 'orchard'
    if lu in ('grass', 'recreation_ground', 'village_green') or le in ('park', 'garden', 'golf_course', 'nature_reserve') and lu is None and na is None and le != 'nature_reserve': return 'grass'
    if na in ('scrub', 'heath', 'grassland', 'shrubbery'): return 'scrub'
    if lu in ('farmland', 'meadow', 'farmyard', 'allotments', 'animal_keeping', 'flowerbed'): return 'farm'
    return None

# ---- building classes ----
BC = {'other': 0, 'house': 1, 'apartments': 2, 'industrial': 3, 'commercial': 4, 'public': 5, 'greenhouse': 6, 'religious': 7, 'ruins': 8}
def bc_of(b, t):
    if b in ('house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'farm', 'cabin', 'villa'): return 'house'
    if b in ('apartments', 'residential', 'dormitory'): return 'apartments'
    if b in ('industrial', 'warehouse', 'factory', 'manufacture', 'hangar', 'storage_tank', 'farm_auxiliary', 'barn', 'cowshed', 'shed'): return 'industrial'
    if b in ('retail', 'commercial', 'office', 'supermarket', 'hotel', 'kiosk'): return 'commercial'
    if b in ('school', 'kindergarten', 'university', 'college', 'public', 'hospital', 'civic', 'government', 'train_station', 'sports_hall', 'stadium'): return 'public'
    if b == 'greenhouse': return 'greenhouse'
    if b in ('mosque', 'synagogue', 'church', 'chapel', 'cathedral', 'religious', 'temple', 'monastery'): return 'religious'
    if b == 'ruins': return 'ruins'
    return 'other'

# ---- identifiable sites ----
SK = ['tall', 'mosque', 'church', 'synagogue', 'watertower', 'tower', 'mast', 'chimney', 'lighthouse', 'tank', 'stadium', 'hospital', 'mall', 'plant', 'turbine', 'fortress', 'ruins', 'silo', 'minaret', 'belltower', 'lookout',
      'school', 'hotel', 'station', 'pitch', 'court', 'pool', 'fuel', 'shop', 'civic', 'monument', 'barn', 'warehouse', 'sewage']
# smallest footprint (m2) for the kinds that are only worth showing from a certain size
MINA = {'school': 350, 'hotel': 400, 'pitch': 2500, 'court': 350, 'pool': 150, 'shop': 600, 'civic': 250, 'barn': 350, 'warehouse': 2500, 'sewage': 2000}
def num(v):
    try: return float(str(v).split(';')[0].replace('m', '').strip())
    except Exception: return None
def height_of(t):
    h = num(t.get('height')) if t.get('height') else None
    if h is None and t.get('building:levels'):
        lv = num(t.get('building:levels')); h = lv * 3.3 + 3 if lv else None
    return h
def site_of(t, is_area):
    b, mm, am, hi, pw, le = t.get('building'), t.get('man_made'), t.get('amenity'), t.get('historic'), t.get('power'), t.get('leisure')
    rel = t.get('religion')
    if b == 'mosque' or (am == 'place_of_worship' and rel == 'muslim'): return 'mosque'
    if b in ('church', 'chapel', 'cathedral', 'monastery') or (am == 'place_of_worship' and rel == 'christian'): return 'church'
    if b == 'synagogue' or (am == 'place_of_worship' and rel == 'jewish'): return 'synagogue'
    if mm == 'water_tower': return 'watertower'
    if mm == 'lighthouse': return 'lighthouse'
    if mm == 'chimney': return 'chimney'
    if mm == 'mast': return 'mast'
    if mm == 'tower':                       # OSM towers are many things: a minaret, a church bell tower, a lookout or guard post, a radio mast
        tt = t.get('tower:type', '')
        if tt == 'minaret': return 'minaret'
        if tt == 'bell_tower': return 'belltower'
        if tt in ('observation', 'watchtower', 'defensive', 'climbing'): return 'lookout'
        if tt == 'cooling': return 'chimney'
        return 'tower'
    if mm == 'silo': return 'silo'
    if mm == 'storage_tank' and is_area: return 'tank'
    if le == 'stadium' and is_area: return 'stadium'
    if am == 'hospital' and is_area: return 'hospital'
    if t.get('shop') == 'mall' and is_area: return 'mall'
    if pw == 'plant' and is_area and 'solar' not in t.get('plant:source', '') and 'wind' not in t.get('plant:source', ''): return 'plant'
    if pw == 'generator' and t.get('generator:source') == 'wind': return 'turbine'
    if hi in ('castle', 'fort', 'citadel', 'city_gate'): return 'fortress'
    if hi in ('archaeological_site', 'ruins') and is_area: return 'ruins'
    isb = bool(b) and b != 'no'; sp = t.get('sport', ''); to = t.get('tourism'); sh = t.get('shop')
    if isb:
        h = height_of(t)
        if h and h >= 40: return 'tall'
    if is_area and (b in ('school', 'kindergarten', 'university', 'college') or (isb and am in ('school', 'kindergarten', 'university', 'college'))): return 'school'
    if is_area and (b == 'hotel' or (isb and to == 'hotel')): return 'hotel'
    if b == 'train_station' or (t.get('railway') == 'station' and t.get('station') not in ('subway', 'light_rail')): return 'station'
    if le == 'pitch' and is_area: return 'pitch' if sp in ('soccer', 'football', 'american_football', 'rugby', 'athletics', 'baseball') else ('court' if sp in ('basketball', 'tennis', 'multi', 'volleyball', 'handball', 'futsal', '') else None)
    if le == 'swimming_pool' and is_area and t.get('access') != 'private': return 'pool'
    if am == 'fuel': return 'fuel'
    if is_area and (sh in ('supermarket', 'department_store') or b in ('supermarket', 'retail')): return 'shop'
    if is_area and (am in ('townhall', 'community_centre', 'library', 'theatre', 'arts_centre', 'cinema', 'fire_station', 'police', 'courthouse') or to == 'museum' or b in ('civic', 'public')): return 'civic'
    if hi == 'monument' or (hi == 'memorial' and t.get('memorial') in (None, 'war_memorial', 'statue', 'obelisk', 'stele', 'sculpture') and t.get('name')): return 'monument'
    if is_area and b in ('cowshed', 'barn', 'farm_auxiliary', 'stable', 'sty'): return 'barn'
    if is_area and b in ('warehouse', 'industrial', 'hangar'): return 'warehouse'
    if mm == 'wastewater_plant' and is_area: return 'sewage'
    if isb:
        h = height_of(t)
        if h and h >= 25: return 'tall'
    return None

def footprint(coords):
    """Centroid, area (m²) and an oriented box (length, width, angle of the long side) of a closed ring, in real metres."""
    if coords[0] == coords[-1]: coords = coords[:-1]
    if len(coords) < 3: return None
    lat0 = sum(c[1] for c in coords) / len(coords); lon0 = sum(c[0] for c in coords) / len(coords); mx = MX(lat0)
    P = [((c[0] - lon0) * mx, (c[1] - lat0) * MZ) for c in coords]
    a = 0.0
    for i in range(len(P)):
        x1, y1 = P[i]; x2, y2 = P[(i + 1) % len(P)]; a += x1 * y2 - x2 * y1
    best = None
    for i in range(len(P)):
        x1, y1 = P[i]; x2, y2 = P[(i + 1) % len(P)]; L = math.hypot(x2 - x1, y2 - y1)
        if L < 0.5: continue
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        us = [p[0] * ux + p[1] * uy for p in P]; vs = [-p[0] * uy + p[1] * ux for p in P]
        box = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or box < best[0]: best = (box, max(us) - min(us), max(vs) - min(vs), math.degrees(math.atan2(uy, ux)))
    if not best: return None
    _, l, w, ang = best
    if w > l: l, w, ang = w, l, ang + 90
    return lon0, lat0, abs(a) / 2, l, w, ang

SMALL = {'water', 'wetland', 'grass', 'cemetery'}
def keep_lc(c, t, coords):
    """Leave out what would only be a blot at 240 m a cell: small ponds, pools, basins, small parks; and covered reservoirs."""
    if c == 'water' and (t.get('covered') == 'yes' or t.get('water') in ('wastewater', 'basin', 'reflecting_pool', 'pond', 'fountain', 'stream') or t.get('landuse') == 'basin'
                         or t.get('intermittent') == 'yes' or t.get('seasonal') not in (None, 'no')): return False      # winter pools and flood basins are dry ground most of the year
    if c in SMALL:
        f = footprint(list(coords))
        if not f or f[2] < (45000 if c == 'water' else 25000): return False      # a cell is 57,600 m2 of real ground: smaller water would be drawn larger than it is
    return True
# Rivers that carry water all year (the many dry stream beds tagged as rivers are left out); the wide ones are drawn wider.
RIVER_NAMES = ['Jordan', 'Litani', 'Hasbani', 'Snir', 'Yarmuk', 'Yarkon', 'Kishon', 'Zarqa', 'Mujib', "Zerka Ma'in", 'Nahal Dan', 'Alexander', 'Taninim', 'Naaman', 'Hadera', 'ירמוך']
RIVER_WIDE = ['Jordan', 'Litani', 'Yarmuk', 'Yarkon', 'ירמוך']
class Handler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.polys = collections.defaultdict(list); self.sites = []; self.rails = []; self.rivers = []
        self.cnt = {}; self.cov = {}; self.cls = {}; self.hmax = {}
    def add_building(self, coords, t):
        f = footprint(coords)
        if not f: return
        lon, lat, area, l, w, ang = f
        i, j = int(px(lon)), int(py(lat))
        if not (0 <= i < W and 0 <= j < H): return
        k = j * W + i; self.cnt[k] = self.cnt.get(k, 0) + 1; self.cov[k] = self.cov.get(k, 0) + area
        c = bc_of(t.get('building'), t)
        if c != 'other': d = self.cls.setdefault(k, collections.Counter()); d[c] += area
        h = height_of(t)
        if h: self.hmax[k] = max(self.hmax.get(k, 0), h)
        return f
    def add_site(self, kind, lon, lat, t, f=None):
        h = height_of(t) or 0
        l, w, ang = (f[3], f[4], f[5]) if f else (0, 0, 0)
        self.sites.append([SK.index(kind), round(lon * 1e5), round(lat * 1e5), round(min(h, 400)), round(min(l, 900)), round(min(w, 900)), round(ang) % 180])
    def node(self, n):
        t = n.tags; k = site_of(t, False)
        if k and k not in ('tall',): self.add_site(k, n.location.lon, n.location.lat, t)
    def way(self, w):
        t = w.tags
        try: coords = [(n.lon, n.lat) for n in w.nodes]
        except osmium.InvalidLocationError: return
        if len(coords) < 2: return
        if t.get('railway') == 'rail' and t.get('service') is None and t.get('tunnel') not in ('yes', 'building_passage') and t.get('usage') not in ('military', 'test'):
            self.rails.append(coords); return
        if t.get('waterway') == 'river' and t.get('intermittent') != 'yes' and t.get('tunnel') is None:
            nm = (t.get('name:en') or '') + ' ' + (t.get('name') or '')
            if any(k in nm for k in RIVER_NAMES): self.rivers.append((1 if any(k in nm for k in RIVER_WIDE) else 0, coords))
            return
        closed = coords[0] == coords[-1] and len(coords) > 3
        if not closed: return
        f = None
        if t.get('building') and t.get('building') != 'no': f = self.add_building(coords, t)
        k = site_of(t, True)
        if k:
            f = f or footprint(coords)
            if f and f[2] >= MINA.get(k, 0): self.add_site(k, f[0], f[1], t, f)
        c = lc_of(t)
        if c and not t.get('building') and keep_lc(c, t, coords): self.polys[c].append([(px(lo), py(la)) for lo, la in coords])
    def relation(self, r):
        pass

h = Handler(); h.apply_file(SRC, locations=True, idx='flex_mem')
# multipolygon land cover (forests, big fields, reservoirs): the outer rings of relations
class Rel(osmium.SimpleHandler):
    def __init__(self, polys): super().__init__(); self.polys = polys; self.n = 0
    def area(self, a):
        if not a.from_way():
            c = lc_of(a.tags)
            if c:
                for ring in a.outer_rings():
                    pts = [(n.lon, n.lat) for n in ring]
                    if keep_lc(c, a.tags, pts): self.polys[c].append([(px(lo), py(la)) for lo, la in pts]); self.n += 1
rel = Rel(h.polys); rel.apply_file(SRC, locations=True, idx='flex_mem')
print('relations', rel.n, 'polygons', {k: len(v) for k, v in h.polys.items()}, 'sites', len(h.sites), 'rails', len(h.rails), 'building cells', len(h.cnt))

# ---- land cover raster ----
lc = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(lc)
for c in ORDER:
    for p in h.polys.get(c, []):
        if len(p) >= 3: dr.polygon(p, fill=LC[c])
# ---- building raster ----
bo = Image.new('RGB', (W, H), (0, 0, 0)); pix = bo.load(); cell_m2 = (CELL * 4) ** 2
for k, n in h.cnt.items():
    i, j = k % W, k // W; cov = min(1.0, h.cov[k] / cell_m2)
    d = h.cls.get(k); c = BC[d.most_common(1)[0][0]] if d else 0
    pix[i, j] = (max(1, round(cov * 255)), c | (min(15, int(math.log2(n)) + 1) << 4), min(255, round(h.hmax.get(k, 0))))
# ---- sites: one of each kind per 60 m of real ground ----
seen, sites = set(), []
for s in h.sites:
    key = (s[0], round(s[1] / 60), round(s[2] / 60))       # 1e-5 deg = about 1 m
    if key in seen: continue
    seen.add(key); sites.append(s)
cnt = collections.Counter(SK[s[0]] for s in sites); print('sites by kind', dict(cnt))
# ---- rails, simplified (Douglas-Peucker, 15 m) ----
def dp(pts, tol=15):
    if len(pts) < 3: return pts
    lat0 = pts[0][1]; P = [(p[0] * MX(lat0), p[1] * MZ) for p in pts]; keep = [False] * len(P); keep[0] = keep[-1] = True; st = [(0, len(P) - 1)]
    while st:
        i, j = st.pop(); (ax, az), (bx, bz) = P[i], P[j]; dx, dz = bx - ax, bz - az; L = math.hypot(dx, dz) or 1; best, k = -1, -1
        for m in range(i + 1, j):
            dd = abs((P[m][0] - ax) * dz - (P[m][1] - az) * dx) / L
            if dd > best: best, k = dd, m
        if best > tol: keep[k] = True; st += [(i, k), (k, j)]
    return [p for p, f in zip(pts, keep) if f]
rails = []
for r in h.rails:
    q = [(round(lo * 1e4), round(la * 1e4)) for lo, la in dp(r)]
    if len(q) < 2: continue
    e = [q[0][0], q[0][1]]
    for i in range(1, len(q)): e += [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]]
    rails.append(e)

rivers = []
for wide, r in h.rivers:
    q = [(round(lo * 1e4), round(la * 1e4)) for lo, la in dp(r, 10)]
    if len(q) < 2: continue
    e = [wide, q[0][0], q[0][1]]
    for i in range(1, len(q)): e += [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]]
    rivers.append(e)
print('rivers', len(rivers))

def png64(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
js = ("'use strict';\n// GENERATED by tools/osm2world.py from OpenStreetMap - do not edit by hand. Map data (c) OpenStreetMap contributors, ODbL 1.0.\n"
      "// LC_PNG land cover per 60 m cell, BO_PNG buildings per cell, SITES identifiable places, RAILS railway lines (see the tool for the formats).\n"
      "const LC_PNG = '" + png64(lc) + "';\nconst BO_PNG = '" + png64(bo) + "';\n"
      "const SITE_KINDS = " + json.dumps(SK) + ";\nconst SITES = " + json.dumps(sites, separators=(',', ':')) + ";\n"
      "const RAILS = " + json.dumps(rails, separators=(',', ':')) + ";\n"
      "// RIVERS: the rivers that flow all year, [wide, lon*1e4, lat*1e4, then deltas]\n"
      "const RIVERS = " + json.dumps(rivers, separators=(',', ':')) + ";\n")
open('src/osmworld.js', 'w', encoding='utf8').write(js)
print('src/osmworld.js', len(js) // 1024, 'KB  (land cover', len(png64(lc)) // 1024, 'KB, buildings', len(png64(bo)) // 1024, 'KB, sites', len(json.dumps(sites, separators=(",", ":"))) // 1024, 'KB)')
