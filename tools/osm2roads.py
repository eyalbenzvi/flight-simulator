#!/usr/bin/env python3
"""Road network from OpenStreetMap (run from the repository root): raw/israel_and_palestine.osm.pbf -> src/roads.js.

Download the extract from https://download.openstreetmap.fr/extracts/asia/israel_and_palestine.osm.pbf (pip install osmium).
Keeps motorways and trunk roads (class 2), primary roads (class 1) and secondary roads (class 0) inside the map window,
joins OSM ways into long chains, keeps one line for a dual carriageway (flagged as divided), joins loose ends to the network
(directly, or along tertiary roads and links), simplifies the lines and writes them delta-encoded.
Road data (c) OpenStreetMap contributors, ODbL 1.0."""
import math, json, sys, collections
import osmium

SRC = sys.argv[1] if len(sys.argv) > 1 else 'raw/israel_and_palestine.osm.pbf'
LON0, LON1, LAT0, LAT1 = 33.6, 36.4, 29.2, 33.6
CLS = {'motorway': 2, 'trunk': 2, 'primary': 1, 'secondary': 0}
MX, MZ = 111320 * math.cos(math.radians(31.5)), 110950          # real metres per degree, local equirectangular
Q = 1e4                                                         # stored as 1e-4 degree steps: 2.4 m of game world

GRAPH = ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link')
class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__(); self.ways = []; self.adj = collections.defaultdict(list); self.loc = {}
    def way(self, w):
        hw = w.tags.get('highway')
        if hw not in GRAPH: return
        try: pts = [(n.location.lon, n.location.lat, n.ref) for n in w.nodes]
        except osmium.InvalidLocationError: return
        if len(pts) < 2: return
        if not any(LON0 - 0.05 <= p[0] <= LON1 + 0.05 and LAT0 - 0.05 <= p[1] <= LAT1 + 0.05 for p in pts): return
        for a, b in zip(pts, pts[1:]):                      # every road down to tertiary, for linking up loose ends (step 3)
            self.adj[a[2]].append(b[2]); self.adj[b[2]].append(a[2]); self.loc[a[2]] = a[:2]; self.loc[b[2]] = b[:2]
        c = CLS.get(hw)
        if c is None: return
        ref = (w.tags.get('ref') or '').split(';')[0].strip()
        self.ways.append({'c': c, 'ref': ref if ref.isdigit() else '', 'one': w.tags.get('oneway') in ('yes', '1') or hw == 'motorway', 'mw': hw == 'motorway',
                          'pts': pts, 'a': pts[0][2], 'b': pts[-1][2]})

h = H(); h.apply_file(SRC, locations=True, idx='flex_mem')
print('ways', len(h.ways), collections.Counter(w['c'] for w in h.ways), 'graph nodes', len(h.loc))

# 1. join ways of one class end to end where exactly two of them meet (points keep their OSM node ids)
def join(ways):
    ends = collections.defaultdict(list)
    for i, w in enumerate(ways): ends[(w['c'], w['a'])].append(i); ends[(w['c'], w['b'])].append(i)
    used, out = set(), []
    for i, w in enumerate(ways):
        if i in used: continue
        used.add(i); pts, a, b, refs, one, mw = list(w['pts']), w['a'], w['b'], [w['ref']], w['one'], w['mw']
        for fwd in (True, False):
            while True:
                node = b if fwd else a; nb = [j for j in ends[(w['c'], node)] if j not in used]
                if len(ends[(w['c'], node)]) != 2 or len(nb) != 1: break
                j = nb[0]; v = ways[j]
                if v['one'] != one: break                   # a divided stretch and a single-carriageway stretch stay separate chains
                used.add(j); seg = v['pts'] if (v['a'] == node) == fwd else v['pts'][::-1]
                if fwd: pts += seg[1:]; b = v['b'] if v['a'] == node else v['a']
                else: pts = seg[:-1] + pts; a = v['a'] if v['b'] == node else v['b']
                refs.append(v['ref']); mw = mw or v['mw']
        ref = collections.Counter(r for r in refs if r).most_common(1)
        out.append({'c': w['c'], 'ref': ref[0][0] if ref else '', 'one': one, 'mw': mw, 'pts': pts})
    return out
chains = join(h.ways)

def xy(p): return (p[0] * MX, p[1] * MZ)
def length(pts): return sum(math.dist(xy(pts[i]), xy(pts[i + 1])) for i in range(len(pts) - 1))
for c in chains: c['len'] = length(c['pts'])

# 2. dual carriageways: OSM maps each direction as its own one-way line. Keep one line per road: the parts of a one-way chain that run
#    within 110 m of an already kept line of the same class, in the opposite direction, are dropped; the rest of the chain stays (dropping
#    the whole chain used to leave roads ending in mid-field). The kept line is drawn as a divided road.
CELL = 200
class Grid:
    def __init__(self): self.g = collections.defaultdict(list)
    def add(self, pts, tag=None):
        for i in range(len(pts) - 1):
            (ax, az), (bx, bz) = xy(pts[i]), xy(pts[i + 1])
            for gx in range(int(min(ax, bx) // CELL) - 1, int(max(ax, bx) // CELL) + 2):
                for gz in range(int(min(az, bz) // CELL) - 1, int(max(az, bz) // CELL) + 2): self.g[(gx, gz)].append((ax, az, bx, bz, tag))
    def near(self, x, z, r, dirn=None, tag=None):
        best = None
        for ax, az, bx, bz, t in self.g.get((int(x // CELL), int(z // CELL)), ()):
            if tag is not None and t[0] != tag: continue
            dx, dz = bx - ax, bz - az
            if dirn:                                  # the twin runs parallel (within 45 degrees): opposite to a one-way line, either way along a two-way one
                cs = (dx * dirn[0] + dz * dirn[1]) / (math.hypot(dx, dz) or 1)
                if (cs > -0.7) if t[1] else (abs(cs) < 0.7): continue
            u = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz or 1))); d = math.hypot(x - ax - dx * u, z - az - dz * u)
            if d < r and (best is None or d < best[0]): best = (d, ax + dx * u, az + dz * u)
        return best
kept, grid, dropgrid, dropped_km = [], Grid(), Grid(), 0
for c in sorted(chains, key=lambda c: (-c['c'], -c['len'])):
    if c['len'] < 40: continue
    pts = c['pts']
    if not c['one']: kept.append(c); grid.add(pts, (c['c'], False)); continue
    near = []
    for i, p in enumerate(pts):
        q0, q1 = xy(pts[max(i - 1, 0)]), xy(pts[min(i + 1, len(pts) - 1)]); dn = (q1[0] - q0[0], q1[1] - q0[1]); L = math.hypot(*dn) or 1
        x, z = xy(p); near.append(grid.near(x, z, 110, (dn[0] / L, dn[1] / L), c['c']) is not None)
    runs, i = [], 0                               # runs of points away from a kept twin, each with one point of overlap at both ends
    while i < len(pts):
        if near[i]: i += 1; continue
        j = i
        while j + 1 < len(pts) and not near[j + 1]: j += 1
        runs.append((max(i - 1, 0), min(j + 1, len(pts) - 1))); i = j + 1
    nd = sum(near) / len(pts)
    if nd > 0: dropgrid.add(pts, (c['c'], True))
    for a, b in runs:
        part = dict(c, pts=pts[a:b + 1]); part['len'] = length(part['pts'])
        if part['len'] < (40 if nd == 0 else 250): continue
        kept.append(part); grid.add(part['pts'], (c['c'], True))
    dropped_km += c['len'] * nd / 1000
# a kept one-way line is a divided road when a dropped twin runs beside it for most of its length; a motorway always is
for c in kept:
    if c['mw']: c['dual'] = 1; continue
    if not c['one']: c['dual'] = 0; continue
    s = [xy(p) for p in c['pts']]; c['dual'] = int(sum(dropgrid.near(x, z, 110, None, c['c']) is not None for x, z in s) > 0.5 * len(s))
print('chains', len(chains), 'kept', len(kept), 'km dropped as twin carriageway', round(dropped_km), 'divided', sum(c['dual'] for c in kept))

# 3. loose ends: a chain end that touches no other kept road is joined up, either straight to a kept road within 60 m (an end that met
#    the dropped twin carriageway, or a junction that OSM leaves a few metres open), or along the smaller roads (tertiary and links,
#    up to 3 km), so main roads no longer stop in the middle of nowhere where their class changes
owner = collections.defaultdict(set)
for k, c in enumerate(kept):
    for p in c['pts']: owner[p[2]].add(k)
def edge(p): return not (LON0 + 0.02 < p[0] < LON1 - 0.02 and LAT0 + 0.02 < p[1] < LAT1 - 0.02)
snapped = linked = loose = 0; extra = []
for k, c in enumerate(kept):
    for end in (0, -1):
        p = c['pts'][end]
        if edge(p) or owner[p[2]] - {k}: continue
        x, z = xy(p); far = None
        # straight snap to the nearest other kept road (any direction), skipping the chain itself
        best = None
        for ax, az, bx, bz, t in grid.g.get((int(x // CELL), int(z // CELL)), ()):
            dx, dz = bx - ax, bz - az; u = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz or 1))); d = math.hypot(x - ax - dx * u, z - az - dz * u)
            if 0.5 < d < 60 and (best is None or d < best[0]): best = (d, (ax + dx * u) / MX, (az + dz * u) / MZ)
        own = Grid(); own.add(c['pts'][-6:] if end == -1 else c['pts'][:6])
        if best and not own.near(best[1] * MX, best[2] * MZ, 1):
            q = (best[1], best[2], -1); c['pts'] = c['pts'] + [q] if end == -1 else [q] + c['pts']; snapped += 1; continue
        # breadth-first along the OSM graph (Dijkstra by length) to the nearest node of another kept chain
        import heapq
        dist, prev, hq, goal = {p[2]: 0}, {}, [(0, p[2])], None
        while hq:
            d, n = heapq.heappop(hq)
            if d > dist.get(n, 1e18): continue
            if n != p[2] and owner[n] - {k}: goal = n; break
            if d > 3000: break
            for m in h.adj[n]:
                if m in owner and k in owner[m] and m != p[2]: continue       # not back along the chain itself
                nd2 = d + math.dist(xy(h.loc[n]), xy(h.loc[m]))
                if nd2 < dist.get(m, 1e18): dist[m] = nd2; prev[m] = n; heapq.heappush(hq, (nd2, m))
        if goal is None: loose += 1; continue
        path = [goal]
        while path[-1] != p[2]: path.append(prev[path[-1]])
        extra.append({'c': 0, 'ref': '', 'one': False, 'mw': False, 'dual': 0, 'pts': [(*h.loc[n], n) for n in path[::-1]]}); linked += 1
        for n in path: owner[n].add(-1)
for c in extra: c['len'] = length(c['pts'])
kept += extra
print('loose ends: snapped', snapped, 'linked along smaller roads', linked, 'still loose', loose)

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
    out.append([c['c'], c['ref'], enc, c['dual']]); npts += len(q)
total = collections.Counter(); [total.__setitem__(c['c'], total[c['c']] + c['len'] / 1000) for c in kept]
print('roads', len(out), 'points', npts, 'km by class', {k: round(v) for k, v in sorted(total.items())})
js = ("'use strict';\n// GENERATED by tools/osm2roads.py from OpenStreetMap - do not edit by hand. Road data (c) OpenStreetMap contributors, ODbL 1.0.\n"
      "// OSM_ROADS: [class (2 motorway/trunk, 1 primary, 0 secondary), route number, [lon, lat, dlon, dlat, ...] in 1e-4 degree steps, divided (1) or single carriageway (0)]\n"
      "const OSM_ROADS = " + json.dumps(out, separators=(',', ':')) + ";\n")
open('src/roads.js', 'w', encoding='utf8').write(js); print('src/roads.js', len(js) // 1024, 'KB')
