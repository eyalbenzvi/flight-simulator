#!/usr/bin/env python3
"""Road network from OpenStreetMap (run from the repository root): raw/israel_and_palestine.osm.pbf -> src/roads.js.

Download the extract from https://download.openstreetmap.fr/extracts/asia/israel_and_palestine.osm.pbf (pip install osmium).
Keeps motorways and trunk roads (class 2), primary roads (class 1) and secondary roads (class 0) inside the map window,
joins OSM ways into long chains, keeps one line for a dual carriageway, simplifies the lines and writes them delta-encoded.
Road data (c) OpenStreetMap contributors, ODbL 1.0."""
import math, json, sys, collections
import osmium

SRC = sys.argv[1] if len(sys.argv) > 1 else 'raw/israel_and_palestine.osm.pbf'
LON0, LON1, LAT0, LAT1 = 33.6, 36.4, 29.2, 33.6
CLS = {'motorway': 2, 'trunk': 2, 'primary': 1, 'secondary': 0}
MX, MZ = 111320 * math.cos(math.radians(31.5)), 110950          # real metres per degree, local equirectangular
Q = 1e4                                                         # stored as 1e-4 degree steps: 2.4 m of game world

class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__(); self.ways = []
    def way(self, w):
        c = CLS.get(w.tags.get('highway'))
        if c is None: return
        try: pts = [(n.location.lon, n.location.lat, n.ref) for n in w.nodes]
        except osmium.InvalidLocationError: return
        if len(pts) < 2: return
        if not any(LON0 <= p[0] <= LON1 and LAT0 <= p[1] <= LAT1 for p in pts): return
        ref = (w.tags.get('ref') or '').split(';')[0].strip()
        self.ways.append({'c': c, 'ref': ref if ref.isdigit() else '', 'one': w.tags.get('oneway') in ('yes', '1') or w.tags.get('highway') == 'motorway',
                          'pts': [(p[0], p[1]) for p in pts], 'a': pts[0][2], 'b': pts[-1][2]})

h = H(); h.apply_file(SRC, locations=True, idx='flex_mem')
print('ways', len(h.ways), collections.Counter(w['c'] for w in h.ways))

# 1. join ways of one class end to end where exactly two of them meet
def join(ways):
    ends = collections.defaultdict(list)
    for i, w in enumerate(ways): ends[(w['c'], w['a'])].append(i); ends[(w['c'], w['b'])].append(i)
    used, out = set(), []
    for i, w in enumerate(ways):
        if i in used: continue
        used.add(i); pts, a, b, refs, one = list(w['pts']), w['a'], w['b'], [w['ref']], w['one']
        for fwd in (True, False):
            while True:
                node = b if fwd else a; nb = [j for j in ends[(w['c'], node)] if j not in used]
                if len(ends[(w['c'], node)]) != 2 or len(nb) != 1: break
                j = nb[0]; v = ways[j]; used.add(j); seg = v['pts'] if (v['a'] == node) == fwd else v['pts'][::-1]
                if fwd: pts += seg[1:]; b = v['b'] if v['a'] == node else v['a']
                else: pts = seg[:-1] + pts; a = v['a'] if v['b'] == node else v['b']
                refs.append(v['ref']); one = one and v['one']
        ref = collections.Counter(r for r in refs if r).most_common(1)
        out.append({'c': w['c'], 'ref': ref[0][0] if ref else '', 'one': one, 'pts': pts})
    return out
chains = join(h.ways)

def xy(p): return (p[0] * MX, p[1] * MZ)
def length(pts): return sum(math.dist(xy(pts[i]), xy(pts[i + 1])) for i in range(len(pts) - 1))
for c in chains: c['len'] = length(c['pts'])

# 2. dual carriageways: drop a one-way chain that mostly runs within 110 m of a road already kept (the other direction)
CELL = 200; grid = collections.defaultdict(list); kept = []
def add(pts):
    for i in range(len(pts) - 1):
        (ax, az), (bx, bz) = xy(pts[i]), xy(pts[i + 1])
        for gx in range(int(min(ax, bx) // CELL) - 1, int(max(ax, bx) // CELL) + 2):
            for gz in range(int(min(az, bz) // CELL) - 1, int(max(az, bz) // CELL) + 2): grid[(gx, gz)].append((ax, az, bx, bz))
def near(x, z, r):
    for ax, az, bx, bz in grid.get((int(x // CELL), int(z // CELL)), ()):
        dx, dz = bx - ax, bz - az; t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz or 1)))
        if math.hypot(x - ax - dx * t, z - az - dz * t) < r: return True
    return False
def samples(pts, step=80):
    out = []
    for i in range(len(pts) - 1):
        (ax, az), (bx, bz) = xy(pts[i]), xy(pts[i + 1]); n = max(1, int(math.dist((ax, az), (bx, bz)) // step))
        out += [(ax + (bx - ax) * k / n, az + (bz - az) * k / n) for k in range(n)]
    return out
dropped = 0
for c in sorted(chains, key=lambda c: (-c['c'], -c['len'])):
    if c['len'] < 40: continue
    if c['one']:
        s = samples(c['pts']); hit = sum(near(x, z, 110) for x, z in s)
        if s and hit / len(s) > 0.5: dropped += 1; continue
    kept.append(c); add(c['pts'])
print('chains', len(chains), 'kept', len(kept), 'dropped as twin carriageway', dropped)

# 3. simplify (Douglas-Peucker, 12 m of real ground), clip to the map window, encode
def dp(pts, tol=12):
    if len(pts) < 3: return pts
    P = [xy(p) for p in pts]; keep = [False] * len(P); keep[0] = keep[-1] = True; st = [(0, len(P) - 1)]
    while st:
        i, j = st.pop(); (ax, az), (bx, bz) = P[i], P[j]; dx, dz = bx - ax, bz - az; L = math.hypot(dx, dz) or 1; best, k = -1, -1
        for m in range(i + 1, j):
            d = abs((P[m][0] - ax) * dz - (P[m][1] - az) * dx) / L
            if d > best: best, k = d, m
        if best > tol: keep[k] = True; st += [(i, k), (k, j)]
    return [p for p, f in zip(pts, keep) if f]
out, npts = [], 0
for c in kept:
    pts = [p for p in dp(c['pts']) if LON0 <= p[0] <= LON1 and LAT0 <= p[1] <= LAT1]
    if len(pts) < 2: continue
    q = [(round(p[0] * Q), round(p[1] * Q)) for p in pts]; enc = [q[0][0], q[0][1]]
    for i in range(1, len(q)): enc += [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]]
    out.append([c['c'], c['ref'], enc]); npts += len(q)
total = collections.Counter(); [total.__setitem__(c['c'], total[c['c']] + c['len'] / 1000) for c in kept]
print('roads', len(out), 'points', npts, 'km by class', {k: round(v) for k, v in sorted(total.items())})
js = ("'use strict';\n// GENERATED by tools/osm2roads.py from OpenStreetMap - do not edit by hand. Road data (c) OpenStreetMap contributors, ODbL 1.0.\n"
      "// OSM_ROADS: [class (2 motorway/trunk, 1 primary, 0 secondary), route number, [lon, lat, dlon, dlat, ...] in 1e-4 degree steps]\n"
      "const OSM_ROADS = " + json.dumps(out, separators=(',', ':')) + ";\n")
open('src/roads.js', 'w', encoding='utf8').write(js); print('src/roads.js', len(js) // 1024, 'KB')
