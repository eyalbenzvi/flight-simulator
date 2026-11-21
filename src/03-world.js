'use strict';
// ---------- 6. Airports ----------
let rwyLights = null, dotTex = null;
function lightDot() { if (dotTex) return dotTex; const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return dotTex = new THREE.CanvasTexture(c); }
function runwayTexture(nameNear, nameFar) {
  // drawn in a 128 x 2048 frame, at twice that on desktop: asphalt with grey grain and repair patches, tar seams, rubber in both touchdown zones, full markings
  const K = HIRES ? 2 : 1, c = document.createElement('canvas'); c.width = 128 * K; c.height = 2048 * K; const x = c.getContext('2d'), R = rng(77); x.scale(K, K);
  x.fillStyle = '#2d2f32'; x.fillRect(0, 0, 128, 2048);
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '18,19,21' : '70,72,76'},${0.10 + R() * 0.12})`; x.fillRect(R() * 110, R() * 2048, 10 + R() * 40, 20 + R() * 90); }       // repair patches
  for (let i = 0; i < 5200; i++) { const v = R() < 0.5 ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},${0.02 + R() * 0.035})`; x.fillRect(R() * 128, R() * 2048, 0.6 + R() * 1.2, 1 + R() * 5); }      // grain, grey only
  x.fillStyle = 'rgba(0,0,0,.16)'; for (let y = 0; y < 2048; y += 26) x.fillRect(0, y, 128, 0.6); x.fillRect(42.5, 0, 0.6, 2048); x.fillRect(85, 0, 0.6, 2048);          // slab seams
  for (const [y0, dir] of [[230, 1], [2048 - 230, -1]]) for (let i = 0; i < 150; i++) { const cx = (R() < 0.5 ? 46 : 82) + (R() - 0.5) * 16, len = 60 + R() * 260, y = y0 + dir * R() * 330; x.fillStyle = `rgba(8,8,9,${0.05 + R() * 0.10})`; x.fillRect(cx, dir > 0 ? y : y - len, 1.2 + R() * 2.2, len); }      // rubber
  x.fillStyle = '#ecebe5';
  x.fillRect(3, 0, 2, 2048); x.fillRect(123, 0, 2, 2048);                              // edge lines
  for (let y = 190; y < 1860; y += 44) x.fillRect(62.5, y, 3, 24);                     // centreline
  for (const base of [14, 2048 - 58]) for (let i = 0; i < 12; i++) x.fillRect(10 + i * 9 + (i > 5 ? 6 : 0), base, 5, 44);   // threshold bars
  for (const y of [300, 2048 - 330]) { x.fillRect(30, y, 16, 46); x.fillRect(82, y, 16, 46); }                               // aiming-point blocks
  for (const y of [390, 460, 2048 - 410, 2048 - 480]) for (const u of [30, 36, 42, 82, 88, 94]) x.fillRect(u, y, 3.6, 22);  // touchdown-zone bars
  x.font = 'bold 54px Arial, sans-serif'; x.textAlign = 'center';
  x.save(); x.translate(64, 2048 - 100); x.scale(1, 1.7); x.fillText(nameNear, 0, 0); x.restore();
  x.save(); x.translate(64, 100); x.rotate(Math.PI); x.scale(1, 1.7); x.fillText(nameFar, 0, 0); x.restore();
  const t = new THREE.CanvasTexture(c); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
function strip(ax, az, bx, bz, w, y, mat) {
  const len = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set((ax + bx) / 2, y, (az + bz) / 2); m.rotation.y = -Math.atan2(bx - ax, -(bz - az)); scene.add(m); return m;
}
function buildAirports() {
  const taxi = new THREE.MeshLambertMaterial({ color: 0x3a3c40 }), apron = new THREE.MeshLambertMaterial({ color: 0x4a4c50 });
  const wall = new THREE.MeshLambertMaterial({ color: 0xcfd6dc }), glass = new THREE.MeshPhongMaterial({ color: 0x5f87a8, shininess: 90 });
  const LP = [], LC = [];
  const light = (x, y, z, r, g, b) => { LP.push(x, y, z); LC.push(r, g, b); };
  for (const rw of RUNWAYS) {
    const ap = AIRPORTS[rw.ap], y = rw.elev, hx = rw.dx * rw.len / 2, hz = rw.dz * rw.len / 2, rx = -rw.dz, rz = rw.dx;   // right-hand vector
    const recip = String(Math.round(((rw.hdg + 180) % 360) / 10)).padStart(2, '0');
    const m = strip(rw.x - hx, rw.z - hz, rw.x + hx, rw.z + hz, rw.w, y, new THREE.MeshLambertMaterial({ map: runwayTexture(rw.name, recip) }));
    m.position.y = y;
    // parallel taxiway on the terminal side, with three connectors
    const tx = ap.x + ap.term[0], tz = ap.z + ap.term[1], side = Math.sign((tx - rw.x) * rx + (tz - rw.z) * rz) || 1, ox = rx * 170 * side, oz = rz * 170 * side;
    strip(rw.x - hx + ox, rw.z - hz + oz, rw.x + hx + ox, rw.z + hz + oz, 26, y - 0.15, taxi);
    for (let s2 = -rw.len / 2; s2 <= rw.len / 2; s2 += 60) for (const e of [-1, 1]) light(rw.x + rw.dx * s2 + ox + rx * e * 14, y + 0.5, rw.z + rw.dz * s2 + oz + rz * e * 14, 0.15, 0.35, 1);          // blue taxiway edge lights
    for (let k = 0; k < 4; k++) light(rw.tx + rw.dx * 300 - rx * side * (rw.w / 2 + 14 + k * 9), y + 0.9, rw.tz + rw.dz * 300 - rz * side * (rw.w / 2 + 14 + k * 9), 1, k < 2 ? 0.15 : 0.95, k < 2 ? 0.1 : 0.9);      // PAPI: two red, two white beside the touchdown zone
    for (const f of [-0.97, 0, 0.97]) strip(rw.x + hx * f, rw.z + hz * f, rw.x + hx * f + ox, rw.z + hz * f + oz, 26, y - 0.15, taxi);
    strip(rw.x + ox, rw.z + oz, tx, tz, 26, y - 0.2, taxi);
    // edge, threshold, end and approach lights
    for (let s = -rw.len / 2; s <= rw.len / 2; s += 60) for (const e of [-1, 1]) light(rw.x + rw.dx * s + rx * e * (rw.w / 2 + 2), y + 0.6, rw.z + rw.dz * s + rz * e * (rw.w / 2 + 2), 1, 0.95, 0.8);
    for (let e = -4.5; e <= 4.5; e++) { light(rw.tx + rx * e * rw.w / 10, y + 0.6, rw.tz + rz * e * rw.w / 10, 0.2, 1, 0.3); light(rw.x + hx + rx * e * rw.w / 10, y + 0.6, rw.z + hz + rz * e * rw.w / 10, 1, 0.15, 0.1); }
    if (rw.ils) for (let s = 60; s <= 720; s += 60) for (const e of [-1, 0, 1]) { const px = rw.tx - rw.dx * s + rx * e * 8, pz = rw.tz - rw.dz * s + rz * e * 8; light(px, Math.max(y, heightAt(px, pz)) + 2, pz, 1, 1, 1); }
  }
  // the apron: concrete slabs with joints, yellow taxi lines and aircraft stands (drawn once)
  const apc = document.createElement('canvas'); apc.width = 1024; apc.height = 512; { const x = apc.getContext('2d'), R = rng(31); x.fillStyle = '#55585c'; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 2600; i++) { const v = R() < 0.5 ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},${0.02 + R() * 0.03})`; x.fillRect(R() * 1024, R() * 512, 2 + R() * 6, 2 + R() * 6); }
    x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 1; for (let u = 0; u < 1024; u += 32) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u, 512); x.stroke(); } for (let v = 0; v < 512; v += 32) { x.beginPath(); x.moveTo(0, v); x.lineTo(1024, v); x.stroke(); }
    x.strokeStyle = '#e3c23a'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 470); x.lineTo(1024, 470); x.stroke();
    for (const u of [240, 420, 604, 784]) { x.beginPath(); x.moveTo(u, 470); x.lineTo(u, 330); x.stroke(); x.beginPath(); x.moveTo(u - 26, 330); x.lineTo(u + 26, 330); x.stroke(); x.strokeStyle = 'rgba(240,240,235,.8)'; x.strokeRect(u - 60, 250, 120, 190); x.strokeStyle = '#e3c23a'; } }
  const apronTex = new THREE.CanvasTexture(apc); apronTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const apronM = new THREE.MeshLambertMaterial({ map: apronTex }), wallW = windowize(new THREE.MeshLambertMaterial({ color: 0xd6dce1 })), roofM = new THREE.MeshPhongMaterial({ color: 0xb9c4cc, shininess: 60 });
  for (const ap of AIRPORTS) {
    const tx = ap.x + ap.term[0], tz = ap.z + ap.term[1], y = ap.elev, s = ap.big ? 1 : 0.45;
    const a = new THREE.Mesh(new THREE.PlaneGeometry(620 * s, 420 * s).rotateX(-Math.PI / 2), apronM); a.position.set(tx, y - 0.3, tz); scene.add(a);
    const box = (w, h, d, x, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(tx + x, y + h / 2, tz + z); scene.add(b); return b; };
    // terminal: a windowed hall (lit at night) under a curved roof, a glass front, piers with jet bridges out to the stands
    box(300 * s, 24, 70 * s, 0, 0, wallW); box(296 * s, 16, 2, 0, 35 * s + 0.6, glass).position.y = y + 11;
    { const rf = new THREE.Mesh(new THREE.CylinderGeometry(40 * s, 40 * s, 304 * s, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), roofM); rf.scale.set(1, 0.22, 1); rf.position.set(tx, y + 24, tz); scene.add(rf); }
    if (ap.big) { for (const px of [-110, 0, 110]) { box(30, 14, 150, px, 105, wallW); box(34, 2, 154, px, 105, roofM).position.y = y + 15; for (const sg of [-1, 1]) box(42, 3.4, 3.6, px + sg * 34, 150, wall).position.y = y + 7.2; }
      box(120, 22, 60, 230, -40, wallW); box(90, 16, 70, -250, -30, new THREE.MeshLambertMaterial({ color: 0xaeb6bd })); }                    // cargo building and a hangar
    // control tower: a flared shaft, a glass cab with a roof, an antenna
    { const tp = [[7.5, 0], [5.2, 8], [4.4, 52], [5.5, 60], [9.5, 64], [9.5, 65]].map(p => new THREE.Vector2(p[0], p[1])), tw = new THREE.Mesh(new THREE.LatheGeometry(tp, 14), wall); tw.position.set(tx - 200 * s, y, tz - 90 * s); scene.add(tw);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 9.5, 8, 14), glass); cab.position.set(tx - 200 * s, y + 69, tz - 90 * s); scene.add(cab);
      const cr = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 12.5, 1.6, 14), wall); cr.position.set(tx - 200 * s, y + 73.8, tz - 90 * s); scene.add(cr);
      const an = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 14, 6), wall); an.position.set(tx - 200 * s, y + 81.5, tz - 90 * s); scene.add(an); light(tx - 200 * s, y + 89, tz - 90 * s, 1, 0.1, 0.1); }
    for (let k = 0; k < 6; k++) light(tx + (k - 2.5) * 100 * s, y + 22, tz + 190 * s, 1, 0.92, 0.75);                                    // apron floodlights
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3));
  rwyLights = new THREE.Points(g, clampPoints(new THREE.PointsMaterial({ size: 5, map: lightDot(), vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 2.0, 10));
  scene.add(rwyLights);
}

// ---------- 7. Cities & landmarks ----------
const cityMeshes = []; let cityLights = null, bldMat = null;
/** Adds a procedural window grid (lit at night) to a building material. */
/** Point lights stay points: near ones do not balloon into fog balls and far ones do not vanish (sizes in device pixels). */
function clampPoints(mat, lo, hi) { mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <logdepthbuf_vertex>', 'gl_PointSize = clamp(gl_PointSize, ' + lo.toFixed(1) + ', ' + hi.toFixed(1) + ');\n#include <logdepthbuf_vertex>'); }; return mat; }
function windowize(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uLights = ENV.uLights; sh.uniforms.uSunD = ENV.sunDir; sh.uniforms.uSunC = ENV.sunCol; sh.uniforms.uSkyT = ENV.skyTop; sh.uniforms.uSkyH = ENV.skyHor;
    sh.vertexShader = 'varying vec3 vBp; varying vec3 vBn; varying vec3 vBs; varying float vBid; varying float vIn; varying vec3 vWv; varying vec3 vWn;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBp = position; vBn = normal;
      #ifdef USE_INSTANCING
        { vec4 wp4 = modelMatrix * instanceMatrix * vec4(position, 1.0); vWv = cameraPosition - wp4.xyz; vWn = mat3(modelMatrix) * (mat3(instanceMatrix) * normal); }
        vBs = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)); vBid = fract(instanceMatrix[3].x * 0.0137 + instanceMatrix[3].z * 0.0173); vIn = 1.0;
      #else
        vBs = vec3(1.0); vBid = 0.0; vIn = 0.0; { vec4 wp4 = modelMatrix * vec4(position, 1.0); vWv = cameraPosition - wp4.xyz; vWn = mat3(modelMatrix) * normal; }
      #endif`);
    sh.fragmentShader = 'uniform float uLights; uniform vec3 uSunD, uSunC, uSkyT, uSkyH; varying vec3 vBp; varying vec3 vBn; varying vec3 vBs; varying float vBid; varying float vIn; varying vec3 vWv; varying vec3 vWn;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float side = step(abs(vBn.y), 0.5);
        vec2 wc = vec2((abs(vBn.x) > 0.5 ? vBp.z * vBs.z : vBp.x * vBs.x) / 3.6, vBp.y * vBs.y / 3.4), wf = fract(wc);
        float win = side * step(0.22, wf.x) * step(wf.x, 0.80) * step(0.30, wf.y) * step(wf.y, 0.78);
        float wh = fract(sin(dot(floor(wc) + vBid * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
        float wfade = 1.0 - smoothstep(600.0, 2400.0, 1.0 / gl_FragCoord.w);          // far away the windows blend into an even tone instead of sparkling
        diffuseColor.rgb *= mix(mix(1.0, 0.85, side), mix(1.0, 0.40 + 0.22 * wh, win), wfade) * mix(0.86, 1.0, side);
        // glass is glass: each pane reflects the sky (more at a grazing angle), and some panes, each tilted a hair differently, flash the sun as the aircraft passes
        { vec3 Vd = normalize(vWv), Nw = normalize(vWn), R = reflect(-Vd, Nw); R.xz += (vec2(wh, fract(wh * 7.7)) - 0.5) * 0.07; R = normalize(R);
          float fr = pow(1.0 - max(dot(Vd, Nw), 0.0), 4.0), gls = win * wfade; vec3 skyR = mix(uSkyH, uSkyT, pow(max(R.y, 0.0), 0.5));
          diffuseColor.rgb = mix(diffuseColor.rgb, skyR * 0.8, gls * (0.16 + 0.62 * fr));
          totalEmissiveRadiance += uSunC * pow(max(dot(R, uSunD), 0.0), 110.0) * gls * step(0.35, wh) * 1.7 * (1.0 - uLights * 0.55) * (1.0 - smoothstep(900.0, 2400.0, 1.0 / gl_FragCoord.w) * 0.6); }
        if (vIn > 0.5) { float hy = vBp.y * vBs.y;                                   // instanced blocks: height above the (sunk) base in metres
          diffuseColor.rgb *= mix(0.70, 1.0, smoothstep(7.0, 30.0, hy));              // a street canyon: walls are darker toward the ground, lighter where they stand clear
          totalEmissiveRadiance += vec3(1.0, 0.70, 0.38) * diffuseColor.rgb * uLights * side * exp(-max(hy - 8.0, 0.0) / 7.0) * 0.30;   // at night the street lamps light the lowest floors
          diffuseColor.rgb *= mix(1.0, 0.86, side * step(0.88, fract(hy / 3.4)) * step(9.0, hy));   // a balcony shadow at every floor
          diffuseColor.rgb *= mix(1.0, 1.13, side * step(vBs.y - 1.4, hy)); }        // the light parapet along the roof
        if (side < 0.5 && vBn.y > 0.5) {   // flat roofs carry solar water heaters: a white tank and a dark panel per flat
          vec2 rm = vec2(vBp.x * vBs.x, vBp.z * vBs.z), re = vec2(vBs.x, vBs.z) * 0.5 - abs(rm); float edge = min(re.x, re.y), rfade = 1.0 - smoothstep(180.0, 520.0, 1.0 / gl_FragCoord.w);
          diffuseColor.rgb *= 0.90; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.16, smoothstep(1.3, 0.9, edge));                 // a darker deck inside a light parapet
          vec2 rc = rm / 7.5 + 0.5, rf = fract(rc); float rh = fract(sin(dot(floor(rc) + vBid * 37.0, vec2(41.3, 17.7))) * 9431.7), has = step(0.62, rh) * step(3.0, edge) * rfade;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.17, 0.27), has * smoothstep(0.30, 0.26, abs(rf.x - 0.5)) * smoothstep(0.15, 0.12, abs(rf.y - 0.34)));   // a solar panel
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96), has * smoothstep(0.13, 0.10, length(rf - vec2(0.5, 0.66)))); }                                            // and its white tank, seen only from near
        { float w2 = fract(wh * 57.3); vec3 wcol = w2 < 0.66 ? vec3(1.0, 0.78, 0.48) : w2 < 0.88 ? vec3(0.86, 0.93, 1.0) : vec3(0.45, 0.60, 1.0);          // warm lamps, cool white, the blue of a television
          totalEmissiveRadiance += wcol * uLights * win * step(0.60, wh) * (0.65 + 0.5 * fract(wh * 13.7)); } }`);
  };
  return mat;
}
let BLD = null;      // settlement raster decoded from BLD_PNG: one pixel per 60 m block (R height, G style, B seed, A present)
let LCR = null, BOR = null;      // OpenStreetMap land cover and buildings on the same grid (src/osmworld.js, tools/osm2world.py)
/** Land cover class at a world point: 0 none, 1 forest, 2 orchard, 3 vineyard, 4 fields, 5 parks and lawns, 6 scrub, 7 sand, 8 rock and quarries,
    9 water, 10 wetland, 11 residential, 12 industrial, 13 greenhouses, 14 solar, 15 military, 16 cemetery, 17 construction. */
const LCN = { forest: 1, orchard: 2, vineyard: 3, fields: 4, park: 5, scrub: 6, sand: 7, rock: 8, water: 9, wetland: 10, residential: 11, industrial: 12, greenhouse: 13, solar: 14, military: 15, cemetery: 16, construction: 17 };
const lcAt = (x, z) => { const i = Math.floor((x - X0) / 60), j = Math.floor((z - Z0) / 60); return (!LCR || i < 0 || j < 0 || i >= LCR.w || j >= LCR.h) ? 0 : LCR.d[(j * LCR.w + i) * 4]; };
const bldAt = (i, j) => (i < 0 || j < 0 || i >= BLD.w || j >= BLD.h) ? 0 : BLD.d[(j * BLD.w + i) * 4 + 3];
/** How built-up the ground is around a point (0…1), from the raster. */
function urbanAt(x, z) { const i = Math.floor((x - X0) / 60), j = Math.floor((z - Z0) / 60); let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (bldAt(i + di, j + dj)) n++; return Math.min(1, n / 5); }
/** Every settlement is built from the raster: apartment blocks and towers in the cities, stone houses in Arab towns, red roofs in kibbutzim and moshavim. */
const FIT_OFFS = [[0, 0], [18, 0], [-18, 0], [0, 18], [0, -18], [13, 13], [-13, 13], [13, -13], [-13, -13]];
function buildCities() {
  bldMat = windowize(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));
  const houseMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const PAL = { 1: [0xd9dde0, 0xc9ced4, 0xe8e4da, 0xdcd8cc, 0xcfd6dc], 2: [0xe2d6b8, 0xd8c9a3, 0xe9dfc6, 0xcdbf9c], 4: [0x9db2c6, 0xb4c2cf, 0x8fa6ba] };
  // every region has its own colours: Jerusalem and the hill towns are stone (the towers too), the coast is white and grey with blue glass, the Negev is sand
  const STONE = [0xd9c9a3, 0xcfbd94, 0xe0d2b0, 0xc8b48a], PALR = { hills: { 1: STONE, 2: STONE, 4: [0xcdbf9f, 0xc4b592, 0xd4c8aa] }, coast: { 1: [0xcfd3d6, 0xc2c8ce, 0xd8d4ca, 0xd4d8da], 2: PAL[2], 4: [0x7f9db8, 0x9fb6c8, 0x6f8fae] },
    negev: { 1: [0xd6c6a4, 0xcbb891, 0xddd0b4, 0xd2c8b2], 2: [0xd6c6a4, 0xcbb891, 0xddd0b4], 4: [0xa9b4ba, 0xbfc3c0, 0x98a8b4] } };
  const palAt = (x, z) => { const lon = x2lon(x), lat = z2lat(z); return lat < 31.42 && lon < 35.15 ? PALR.negev : lon > 35.02 && lat > 31.3 && lat < 32.35 ? PALR.hills : PALR.coast; };
  const base = new THREE.BoxGeometry(1, 1, 1); base.translate(0, 0.5, 0); base.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.attributes.position.count * 3).fill(1), 3));
  const LP = [], boxes = new Map(), houses = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), cc = new THREE.Color(), { w, h, d } = BLD;
  const BK = 6000, push = (map, x, z, v) => { const k = Math.floor(x / BK) + ':' + Math.floor(z / BK); let a = map.get(k); if (!a) map.set(k, a = []); a.push(v); };
  planLandmarks();                                   // landmarks first, so the blocks keep off their ground
  // Each 60 m cell combines the satellite raster (built-up surface, average height) with OpenStreetMap (building type, how many, tagged heights):
  // industrial zones get wide flat sheds, greenhouses get rows of long low tunnels, house neighbourhoods get houses and apartment
  // neighbourhoods blocks, dense cells two or three blocks, tagged heights replace the satellite average, and neighbourhoods newer
  // than the satellite data (OpenStreetMap buildings where the raster is empty) are added. Buildings of 40 m and more are sites (03c).
  const flat = new Map(), bo = BOR.d, IND = [0xd5d7d8, 0xe6e4de, 0xc9c3b5, 0xbfc8cf, 0xdedbd2, 0xb9bdc0];
  const fit = (x, z, bw, bd) => { const r0 = Math.max(bw, bd) * 0.6; if (!nearRoad(x, z, r0)) return [x, z, 1];
    for (const k of [0.75, 0.55]) for (const [ox, oz] of FIT_OFFS) if (!nearRoad(x + ox, z + oz, r0 * k)) return [x + ox, z + oz, k]; return null; };
  const styleNear = (i, j) => { for (let r = 1; r <= 3; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue; const oo = (jj * w + ii) * 4; if (d[oo + 3]) return d[oo + 1] & 7; } return 0; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = (j * w + i) * 4, inRaster = d[o + 3] > 0, cov = bo[o] / 255, bc = bo[o + 1] & 15, nlog = bo[o + 1] >> 4, bh = bo[o + 2], lc = LCR.d[o];
    // the ground and what stands on it agree: a cell the satellite alone calls built (no mapped building) is not built where the land cover says forest,
    // orchard, field, scrub, sand, rock, solar field or cemetery; and a cell mapped as residential or industrial with nothing in it or beside it gets a
    // house or a shed (half of them), so no painted neighbourhood stands empty
    let fill = false;
    if (inRaster && !nlog && cov === 0 && (lc === 1 || lc === 2 || lc === 3 || lc === 4 || lc === 5 || lc === 6 || lc === 7 || lc === 8 || lc === 14 || lc === 16)) continue;
    if (lc === 16 || lc === 9) continue;
    if (!inRaster && !((cov >= 0.012 && nlog >= 2) || nlog >= 3 || cov >= 0.03)) { if ((lc !== 11 && lc !== 12) || hash2(i * 0.73 + 1.3, j * 1.19 + 4.1) > 0.5) continue;
      let near = false; for (let a = -1; a <= 1 && !near; a++) for (let c = -1; c <= 1; c++) { const ii = i + a, jj = j + c; if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue; const oo = (jj * w + ii) * 4; if (d[oo + 3] > 0 || (bo[oo + 1] >> 4) >= 2) { near = true; break; } } if (near) continue; fill = true; }          /* also the few houses of a small village, a farmyard, a lone large building (it used to take eight buildings or 5% cover) */
    const sd = inRaster ? d[o + 2] / 255 : hash2(i * 1.7 + 3.1, j * 2.3 + 1.7), s2 = (sd * 7.31) % 1, s3 = (sd * 3.77) % 1, szc = inRaster ? d[o + 1] >> 3 : Math.min(3, Math.round(cov * 6)), szk = 0.7 + 0.13 * szc;
    let st = inRaster ? d[o + 1] & 7 : 0, ht = inRaster ? d[o] : 0;
    if (bc === 3 || (lc === 12 && (bc === 0 || bc === 4) && cov > 0.04)) st = 5;                              // industrial sheds
    else if ((bc === 6 || lc === 13) && !inRaster) st = 6;                                                     // greenhouses
    else if (inRaster) { if (bc === 2 && st === 3) st = 1; else if (bc === 1 && st === 1 && ht < 14) st = 3; }  // apartments or houses, as mapped
    else { const sn = styleNear(i, j); st = bc === 1 ? (sn === 2 ? 2 : 3) : bc === 2 || bc === 4 || bc === 5 ? (sn === 2 ? 2 : 1) : sn || (cov > 0.2 ? 1 : 3); }
    if (fill) st = lc === 12 ? 5 : 3;
    if (!ht) ht = st === 3 ? 7 : st === 5 ? 9 + s2 * 5 : st === 6 ? 5 : st === 2 ? 7 + cov * 14 : 10 + cov * 30;
    if (bh > 0 && bh < 40) ht = st === 3 ? Math.min(bh, 10) : bh;                                           // the tallest tagged building in the cell
    const x = X0 + (i + 0.5) * 60 + (sd - 0.5) * 9, z = Z0 + (j + 0.5) * 60 + (s2 - 0.5) * 9, g = groundAt(x, z); if (g.water || wetAt(x, z, 34) || airfieldAt(x, z, 40) || landmarkAt(x, z, st === 3 ? 26 : 24)) continue;          /* not in the sea, and not on a mapped lake or reservoir either */
    const y = heightAt(x, z);
    if (st === 3) { for (let k = 0; k < 1 + Math.min(2, szc); k++) { const a = sd * 6.283 + k * 2.1, hx = x + Math.cos(a) * 17, hz = z + Math.sin(a) * 17; let ux = hx, uz = hz; if (nearRoad(ux, uz, 10)) { ux = x - Math.cos(a) * 17; uz = z - Math.sin(a) * 17; if (nearRoad(ux, uz, 10)) { ux = x; uz = z; if (nearRoad(ux, uz, 9)) continue; } } push(houses, ux, uz, [ux, heightAt(ux, uz) - 1, uz, 12 + s2 * 7, 8 + s3 * 3, 10 + sd * 6, Math.floor(s3 * 4) * 0.785, 0.93 + s2 * 0.07]); } }
    else if (st === 5) {                                                                                      // sheds and factories: wide, low, flat, no windows
      for (let k = 0; k < (cov > 0.3 ? 2 : 1); k++) { const bw = 34 + sd * 18 - k * 8, bd = 26 + s3 * 16 - k * 6, ox = k ? (s2 - 0.5) * 30 : 0, oz = k ? (sd - 0.5) * 30 : 0, f = fit(x + ox, z + oz, bw, bd); if (!f || obstBox(f[0], f[1], bw * f[2] / 2, bd * f[2] / 2)) continue;
        const by = heightAt(f[0], f[1]); push(flat, f[0], f[1], [f[0], by - 4, f[1], bw * f[2], ht + 4, bd * f[2], 0, IND[((s3 + k * 0.37) * IND.length | 0) % IND.length]]); addObst(f[0], f[1], bw * f[2], bd * f[2], 0, by - 4, by + ht); } }
    else if (st === 6) {                                                                                      // greenhouse tunnels in rows
      const rot = s3 < 0.5 ? 0 : 1.5708; for (let k = -1; k <= 1; k++) { const gx = x + (rot ? k * 17 : 0), gz = z + (rot ? 0 : k * 17); if (nearRoad(gx, gz, 26)) continue;
        push(flat, gx, gz, [gx, heightAt(gx, gz) - 1, gz, 52, 5, 12, rot, 0xe4e9e6]); } }
    else { const n = st === 1 ? (cov > 0.42 ? 3 : cov > 0.28 ? 2 : 1) : 1, kk = n === 1 ? 1 : n === 2 ? 0.74 : 0.62, pr = palAt(x, z), pal = pr[st] || pr[1];
      for (let k = 0; k < n; k++) {                                                                           // dense cells: two or three blocks
        let bw = (st === 4 ? 30 + sd * 10 : ht < 10 ? 20 + sd * 14 : 26 + sd * 16) * szk * kk, bd = (st === 4 ? 30 + s2 * 10 : ht < 10 ? 20 + s2 * 14 : 26 + s2 * 16) * szk * kk;
        // two or three blocks stand side by side along one axis, each within its own slot of the 60 m cell (they used to be staggered on a diagonal and ran through each other)
        const alongX = s3 < 0.5, slot = 54 / n; if (n > 1) { if (alongX) bw = Math.min(bw, slot - 4); else bd = Math.min(bd, slot - 4); }
        const ox = n === 1 || !alongX ? 0 : (k - (n - 1) / 2) * slot, oz = n === 1 || alongX ? 0 : (k - (n - 1) / 2) * slot, f = fit(x + ox, z + oz, bw, bd); if (!f) continue;
        let w2 = bw * f[2], d2 = bd * f[2]; if (obstBox(f[0], f[1], w2 / 2, d2 / 2)) { w2 *= 0.7; d2 *= 0.7; if (obstBox(f[0], f[1], w2 / 2, d2 / 2)) continue; }       // something stands there already: a smaller block, or none
        const by = heightAt(f[0], f[1]), h2 = ht * (k ? 0.75 + ((s2 + k * 0.3) % 1) * 0.4 : 1);
        // a block that stands alone in its cell turns to face the nearest street (when its turned corners stay clear of the road and of its neighbours)
        let rot = n === 1 && st !== 4 ? roadDirAt(f[0], f[1], 130) : 0; if (rot) { const rr = Math.hypot(w2, d2) / 2; if (nearRoad(f[0], f[1], rr - 3) || obstBox(f[0], f[1], rr, rr) || landmarkAt(f[0], f[1], rr)) rot = 0; }
        push(boxes, f[0], f[1], [f[0], by - 8, f[1], w2, h2 + 8, d2, rot, pal[((s3 + k * 0.29) * pal.length | 0) % pal.length]]); addObst(f[0], f[1], w2, d2, rot, by - 8, by + h2); } }
    if (sd < 0.75 && st !== 6) LP.push(x + (s2 - 0.5) * 40, y + 5 + ht * 0.5 * s3, z + (s3 - 0.5) * 40);
  }
  // small localities the satellite raster missed (desert kibbutzim, hilltop villages): a cluster of red-roofed houses at the listed point
  for (const l of LOCS) { const x = lon2x(l[2]), z = lat2z(l[3]), i0 = Math.floor((x - X0) / 60), j0 = Math.floor((z - Z0) / 60); let any = false;
    for (let dj = -4; dj <= 4 && !any; dj++) for (let di = -4; di <= 4; di++) if (bldAt(i0 + di, j0 + dj)) { any = true; break; }
    if (any || wetAt(x, z, 40) || airfieldAt(x, z, 60)) continue;
    const R = rng(Math.round(l[2] * 9973 + l[3] * 7919)), n = clamp(Math.round(6 + l[4] * 4), 6, 22);
    for (let k = 0; k < n; k++) { const a = k * 2.39996 + R() * 0.4, r = 22 + 15 * Math.sqrt(k) + R() * 6, hx = x + Math.cos(a) * r, hz = z + Math.sin(a) * r; if (nearRoad(hx, hz, 10)) continue;
      push(houses, hx, hz, [hx, heightAt(hx, hz) - 1, hz, 11 + R() * 6, 8 + R() * 3, 10 + R() * 5, Math.floor(R() * 4) * 0.785, 0.93 + R() * 0.07]); } }
  // the ground-shadow texture (desktop, and phones with memory to spare): per 60 m cell, the tallest block standing in it as [offset x, offset z, half-size, height]
  if (BIGGRID && TERRAIN_MAT) { const a = new Uint8Array(w * h * 4), put = b => { const ci = Math.floor((b[0] - X0) / 60), cj = Math.floor((b[2] - Z0) / 60); if (ci < 0 || cj < 0 || ci >= w || cj >= h) return; const o = (cj * w + ci) * 4, top = b[4] - (b[4] > 12 ? 8 : 4), H = clamp(Math.round(top), 1, 255); if (H <= a[o + 3]) return;
      a[o] = clamp(Math.round(((b[0] - X0) / 60 - ci) * 255), 0, 255); a[o + 1] = clamp(Math.round(((b[2] - Z0) / 60 - cj) * 255), 0, 255); a[o + 2] = clamp(Math.round((b[3] + b[5]) / 4 / 42 * 255), 1, 255); a[o + 3] = H; };
    for (const list of boxes.values()) list.forEach(put); for (const list of flat.values()) list.forEach(b => { if (b[6] === 0 && b[4] > 6) put(b); });
    const t = new THREE.DataTexture(a, w, h, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; TERRAIN_MAT.uniforms.tBS.value = t; TERRAIN_MAT.uniforms.uBS.value = 1; }
  const centre = k => { const [bx, bz] = k.split(':').map(Number), cx = (bx + 0.5) * BK, cz = (bz + 0.5) * BK; return [cx, cz, new THREE.Sphere(new THREE.Vector3(cx, heightAt(cx, cz), cz), BK * 0.71 + 400)]; };
  for (const [k, list] of boxes) { const [cx, cz, bs] = centre(k), geo = base.clone(); geo.boundingSphere = bs; const im = new THREE.InstancedMesh(geo, bldMat, list.length);
    list.forEach((b, n) => { p.set(b[0], b[1], b[2]); sc.set(b[3], b[4], b[5]); if (b[6]) { e.set(0, b[6], 0); q.setFromEuler(e); } else q.set(0, 0, 0, 1); m4.compose(p, q, sc); im.setMatrixAt(n, m4); im.setColorAt(n, cc.setHex(b[7]).multiplyScalar(0.88)); });          /* walls a little under white: pure white is kept for the aircraft, clouds, snow and surf */
    im.matrixAutoUpdate = false; im.userData = { x: cx, z: cz, half: BK / 2, far: HIRES ? 22000 : BIGGRID ? 16000 : 11000 }; scene.add(im); cityMeshes.push(im); }
  const flatMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const [k, list] of flat) { const [cx, cz, bs] = centre(k), geo = base.clone(); geo.boundingSphere = bs; const im = new THREE.InstancedMesh(geo, flatMat, list.length);
    list.forEach((b, n) => { e.set(0, b[6], 0); q.setFromEuler(e); p.set(b[0], b[1], b[2]); sc.set(b[3], b[4], b[5]); m4.compose(p, q, sc); im.setMatrixAt(n, m4); im.setColorAt(n, cc.setHex(b[7])); });
    im.matrixAutoUpdate = false; im.userData = { x: cx, z: cz, half: BK / 2, far: HIRES ? 18000 : BIGGRID ? 13500 : 9000 }; scene.add(im); cityMeshes.push(im); }
  // What stands on the roofs, seen from low down (not on small phones): a tall block ends in a set-back top floor, sometimes with a mast; a lower one
  // carries its stair house and the white boiler tanks with their dark collectors that every Israeli roof has. Small plain boxes, drawn only near.
  if (BIGGRID) try { for (const [k, list] of boxes) { const out = [];
      for (const b of list) { const sx = b[3], H = b[4], sz = b[5]; if (H < 9 || Math.min(sx, sz) < 10) continue;
        const R = rng(Math.round(Math.abs(b[0] * 13.7 + b[2] * 7.3)) + 1), ry = b[6] || 0, co = Math.cos(ry), si = Math.sin(ry), top = b[1] + H, at = (ox, oz, wd, ht, dp, colr) => out.push([b[0] + ox * co + oz * si, top, b[2] - ox * si + oz * co, wd, ht, dp, ry, colr]);
        if (H > 34) { at(0, 0, sx * 0.62, 4 + R() * 5, sz * 0.62, 0x8f959b); if (R() < 0.5) at((R() - 0.5) * sx * 0.3, (R() - 0.5) * sz * 0.3, 2.2, 7 + R() * 8, 2.2, 0x6f757c); }
        else { if (R() < 0.7) at((R() - 0.5) * sx * 0.5, (R() - 0.5) * sz * 0.5, 4.2, 2.8, 3.6, 0xb9b4a8); const nT = 1 + Math.floor(R() * 2); for (let i = 0; i < nT; i++) { const ox = (R() - 0.5) * (sx - 6), oz = (R() - 0.5) * (sz - 4); at(ox, oz, 1.3, 1.5, 1.3, 0xeeeeea); at(ox + 1.9, oz, 2.0, 0.5, 1.4, 0x2c3440); } } }
      if (!out.length) continue; const [cx, cz, bs] = centre(k), geo = base.clone(); geo.boundingSphere = bs; const im = new THREE.InstancedMesh(geo, flatMat, out.length);
      out.forEach((b, n) => { e.set(0, b[6], 0); q.setFromEuler(e); p.set(b[0], b[1], b[2]); sc.set(b[3], b[4], b[5]); m4.compose(p, q, sc); im.setMatrixAt(n, m4); im.setColorAt(n, cc.setHex(b[7])); });
      im.matrixAutoUpdate = false; im.userData = { x: cx, z: cz, half: BK / 2, far: 3000 }; scene.add(im); cityMeshes.push(im); } } catch (err) { console.warn('roof detail left out', err); }
  for (const [k, list] of houses) { const [cx, cz, bs] = centre(k), geo = GEO.house.clone(); geo.boundingSphere = bs; const im = new THREE.InstancedMesh(geo, houseMat, list.length);
    list.forEach((b, n) => { e.set(0, b[6], 0); q.setFromEuler(e); p.set(b[0], b[1], b[2]); sc.set(b[3], b[4], b[5]); m4.compose(p, q, sc); im.setMatrixAt(n, m4); im.setColorAt(n, cc.setRGB(b[7], b[7] - 0.02, b[7] - 0.07)); });
    im.matrixAutoUpdate = false; im.userData = { x: cx, z: cz, half: BK / 2, far: HIRES ? 11000 : BIGGRID ? 8500 : 6000 }; scene.add(im); cityMeshes.push(im); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
  cityLights = new THREE.Points(lg, clampPoints(new THREE.PointsMaterial({ size: 30, map: lightDot(), color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 1.6, 12));
  cityLights.visible = false; scene.add(cityLights);
}
function buildLandmarks() {
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };
  // Azrieli Center: round, triangular and square towers
  const tg = windowize(new THREE.MeshPhongMaterial({ color: 0xa9c4da, shininess: 110, specular: 0xffffff }));
  { const x = lon2x(34.78) + 330, z = lat2z(32.075) - 120, y = heightAt(x, z) - 4;
    add(new THREE.CylinderGeometry(23, 23, 191, 28), tg, x, y + 95, z);
    add(new THREE.CylinderGeometry(29, 29, 173, 3), tg, x + 75, y + 86, z + 20);
    add(new THREE.BoxGeometry(38, 158, 38), tg, x + 30, y + 79, z + 78);
    add(new THREE.BoxGeometry(170, 22, 150), new THREE.MeshLambertMaterial({ color: 0xc9ced4 }), x + 35, y + 11, z + 35); }
  // Jerusalem: Temple Mount platform, Old City walls and the golden Dome of the Rock (drawn oversized so it reads from the air)
  { const x = lon2x(35.21) + 520, z = lat2z(31.78) + 60, y = heightAt(x, z) - 6, stone = new THREE.MeshLambertMaterial({ color: 0xdccfae });
    add(new THREE.BoxGeometry(260, 16, 320), stone, x, y + 8, z);
    add(new THREE.CylinderGeometry(60, 60, 36, 8), new THREE.MeshLambertMaterial({ color: 0x8fb8c9 }), x, y + 34, z);
    add(new THREE.CylinderGeometry(36, 36, 22, 20), new THREE.MeshLambertMaterial({ color: 0xe8ddb8 }), x, y + 63, z);
    add(new THREE.SphereGeometry(37, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xe0a91c, emissive: 0x4a3200, shininess: 120, specular: 0xfff0b0 }), x, y + 73, z);
  }          /* the walls and the houses inside them: buildOldCity */
  // Masada mesa above the Dead Sea shore
  { const x = lon2x(35.354), z = lat2z(31.316), y = heightAt(x, z);
    add(new THREE.CylinderGeometry(250, 430, 380, 9), new THREE.MeshLambertMaterial({ color: 0xb99668 }), x, y + 170, z).rotation.y = 0.4;
    add(new THREE.BoxGeometry(120, 10, 60), new THREE.MeshLambertMaterial({ color: 0xd9c9a0 }), x - 40, y + 364, z - 60); }
}

// ---------- 7b. Map detail: roads, traffic, trees, villages, ponds, industry, ships ----------
let ZONE = null, roadPaths = [], traffic = null, scatter = null, turbines = [];
/** Exact height of the terrain mesh (same two triangles per cell as the geometry), so draped objects sit on it. */
function triHeight(x, z) {
  const fi = clamp((x - X0) / (X1 - X0) * NX, 0, NX - 0.0001), fj = clamp((z - Z0) / (Z1 - Z0) * NZ, 0, NZ - 0.0001), i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, k = j * (NX + 1) + i;
  const a = HGT[k], c = HGT[k + 1], b = HGT[k + NX + 1], d = HGT[k + NX + 2];
  return u + v <= 1 ? a + (c - a) * u + (b - a) * v : d + (b - d) * (1 - u) + (c - d) * (1 - v);
}
const zoneAt = (x, z) => 4 * (Math.round(clamp((z - Z0) / (Z1 - Z0) * NZ, 0, NZ)) * (NX + 1) + Math.round(clamp((x - X0) / (X1 - X0) * NX, 0, NX)));
/** Dense, smooth polyline through lon/lat waypoints (Catmull-Rom), about `step` metres between points. */
function splinePath(pts, step) {
  const Q = pts.map(p => [lon2x(p[0]), lat2z(p[1])]), out = [], cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < Q.length - 1; i++) { const a = Q[Math.max(i - 1, 0)], b = Q[i], c = Q[i + 1], d = Q[Math.min(i + 2, Q.length - 1)], n = Math.max(2, Math.round(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
    for (let s = 0; s < n; s++) { const t = s / n, x = cr(a[0], b[0], c[0], d[0], t), z = cr(a[1], b[1], c[1], d[1], t), w = (fbm(x / 900, z / 900, 2) - 0.5) * 260 * Math.sin(Math.PI * (i + t) / (Q.length - 1));   // gentle wander away from the ends
      out.push([x + w, z + w * 0.6]); } }
  out.push(Q[Q.length - 1]); return out;
}
// [class, waypoints]  class 2 = motorway, 1 = two-lane road
const ROADS = [
  [2, [[34.79, 32.10], [34.82, 32.165], [34.865, 32.33], [34.915, 32.44], [34.94, 32.57], [34.965, 32.70], [34.985, 32.78]]],
  [2, [[34.59, 31.67], [34.67, 31.80], [34.75, 31.88], [34.80, 31.96], [34.82, 32.07], [34.89, 32.11], [34.90, 32.18], [34.915, 32.44]]],
  [2, [[34.80, 32.06], [34.79, 31.99], [34.83, 31.92], [34.90, 31.895], [34.98, 31.87], [35.08, 31.80], [35.20, 31.785], [35.30, 31.78], [35.44, 31.81], [35.49, 31.77]]],
  [2, [[34.79, 31.25], [34.78, 31.45], [34.78, 31.61], [34.87, 31.80], [34.955, 31.95], [34.96, 32.19], [35.0, 32.40], [35.08, 32.62], [35.2, 32.75]]],
  [2, [[35.575, 33.27], [35.57, 33.21], [35.545, 32.97], [35.535, 32.80], [35.565, 32.70], [35.51, 32.50], [35.53, 32.2], [35.47, 31.86], [35.46, 31.77]]],
  [1, [[35.44, 31.74], [35.37, 31.46], [35.35, 31.32], [35.35, 31.20], [35.37, 31.0], [35.25, 30.6], [35.15, 30.2], [35.06, 29.89], [34.99, 29.66], [34.95, 29.565]]],
  [1, [[34.79, 31.25], [34.79, 30.87], [34.80, 30.61], [34.95, 30.3], [35.07, 30.02]]],
  [1, [[34.79, 31.25], [35.03, 31.07], [35.25, 31.0], [35.37, 31.0]]],
  [1, [[34.79, 31.25], [35.0, 31.25], [35.21, 31.26], [35.33, 31.21]]],
  [1, [[34.79, 31.25], [34.95, 31.40], [35.10, 31.53], [35.20, 31.705], [35.20, 31.785], [35.205, 31.90], [35.26, 32.22], [35.30, 32.46], [35.29, 32.61], [35.30, 32.70]]],
  [1, [[34.915, 32.44], [35.15, 32.52], [35.29, 32.61], [35.42, 32.72], [35.535, 32.80]]],
  [2, [[35.0, 32.775], [35.12, 32.80], [35.10, 32.93], [35.10, 33.01], [35.105, 33.08]]],
  [1, [[35.09, 32.93], [35.30, 32.92], [35.47, 32.94], [35.545, 32.97]]],
  [1, [[35.0, 32.775], [35.11, 32.66], [35.24, 32.675], [35.30, 32.70]]],
  [1, [[34.265, 31.29], [34.31, 31.345], [34.47, 31.51], [34.55, 31.61], [34.59, 31.67]]],
  [1, [[34.59, 31.67], [34.60, 31.525], [34.59, 31.42], [34.62, 31.31], [34.79, 31.25]]],
  [1, [[35.66, 32.76], [35.69, 32.99], [35.80, 33.12], [35.77, 33.27]]],
  [1, [[35.01, 29.53], [35.12, 29.9], [35.30, 30.5], [35.45, 31.0], [35.70, 31.18], [35.79, 31.72], [35.93, 31.95], [35.88, 32.28], [35.85, 32.555]]],
  [1, [[35.93, 31.95], [35.75, 31.90], [35.56, 31.85], [35.47, 31.86]]],
  [1, [[34.78, 31.61], [34.81, 31.895], [34.865, 31.915]]],
  [1, [[35.57, 33.21], [35.69, 33.25], [35.77, 33.27]]],
  [1, [[35.20, 33.27], [35.105, 33.08]]]
];
const ROADNUM = ['2', '4', '1', '6', '90', '90', '40', '25', '31', '60', '65', '4', '85', '75', '', '34', '98', '', '', '40', '99', '', '20', '5', '443', '38', '71'], ROADLBL = [];
ROADS.push([2, [[34.795, 32.115], [34.797, 32.07], [34.79, 32.03], [34.79, 31.99]]], [2, [[34.82, 32.11], [34.90, 32.115], [35.0, 32.11], [35.17, 32.105]]], [1, [[34.98, 31.87], [35.08, 31.88], [35.17, 31.85], [35.205, 31.83]]],
  [1, [[34.99, 31.84], [34.99, 31.75], [34.97, 31.66], [34.90, 31.60]]], [1, [[35.29, 32.61], [35.40, 32.56], [35.50, 32.50]]]);
/** Half-width in metres (real widths, since the buildings beside them are full size too). A single carriageway: secondary 7 m,
    primary 10 m, trunk 12 m. A divided road (both carriageways and the median, `dual` from tools/osm2roads.py): 16, 18 and 22 m. */
const roadHW = (cls, dual) => dual ? [8, 9, 11][cls] : [3.5, 5, 6][cls];
/** Drawing order where roads cross: a bigger road lies a little higher, so the smaller one passes under it instead of flickering. */
const roadRank = (cls, dual) => dual ? (cls === 2 ? 4 : cls + 2) : cls;
let ROADLINES = null;
/** Where a road cannot be drawn: 1 on water, 2 on an airfield (runways are full size on the compressed map, so they cover real roads), 0 elsewhere.
    A short stretch of water (up to about 400 m: a river mouth, a bay the modelled coast cuts into the real road) is not a cut: the road crosses it
    as a causeway at the water's level. */
function roadCuts(D, hw) {
  const cut = D.map(([x, z]) => groundAt(x, z).water ? 1 : airfieldAt(x, z, hw) ? 2 : 0);
  for (let i = 0; i < D.length;) { if (cut[i] !== 1) { i++; continue; } let j = i; while (j + 1 < D.length && cut[j + 1] === 1) j++; if (j - i < 9 && i > 0 && j < D.length - 1) for (let k = i; k <= j; k++) cut[k] = 0; i = j + 1; }
  return cut;
}
/** Every road as a dense polyline in world metres (points at most 45 m apart): the OpenStreetMap network in Israel and Palestine
    (src/roads.js, from tools/osm2roads.py), plus the hand-drawn roads in ROADS that run mostly beyond it (Jordan, Lebanon, Sinai). */
let RAILLINES = null;
/** Water courses as world polylines: the rivers that flow all year, from OpenStreetMap (`RIVERS`; `hw` is half the width of the water), and the dry
    desert stream beds drawn by hand (Besor, Zin, Paran, the Arava stream, Qelt, Arugot, the Be'er Sheva stream; `dry`). Built once: the meshes and the
    index that keeps buildings, sites and trees off them use the same lines. */
let RIVERLINES = null;
function riverLines() {
  if (RIVERLINES) return RIVERLINES; RIVERLINES = [];
  for (const e of (typeof RIVERS === 'undefined' ? [] : RIVERS)) { const D = []; let lo = e[1], la = e[2], px = 0, pz = 0;
    for (let i = 1; i < e.length; i += 2) { if (i > 1) { lo += e[i]; la += e[i + 1]; } const x = lon2x(lo / 1e4), z = lat2z(la / 1e4); if (x < X0 || x > X1 || z < Z0 || z > Z1) { if (D.length > 1) RIVERLINES.push({ D: D.slice(), hw: e[0] ? 8 : 5 }); D.length = 0; continue; }
      if (D.length) { const n = Math.ceil(Math.hypot(x - px, z - pz) / 40); for (let k = 1; k < n; k++) D.push([px + (x - px) * k / n, pz + (z - pz) * k / n]); }
      D.push([x, z]); px = x; pz = z; }
    if (D.length > 1) RIVERLINES.push({ D, hw: e[0] ? 8 : 5 }); }
  for (const pts of [[[34.7, 31.2], [34.55, 31.28], [34.42, 31.44]], [[34.8, 30.83], [34.95, 30.88], [35.15, 30.92], [35.33, 30.93]], [[34.75, 30.15], [34.95, 30.35], [35.15, 30.42], [35.22, 30.5]], [[35.1, 30.0], [35.2, 30.45], [35.32, 30.85]], [[35.3, 31.84], [35.4, 31.845], [35.47, 31.84]], [[35.25, 31.5], [35.33, 31.465], [35.385, 31.455]], [[35.0, 31.22], [34.82, 31.235], [34.7, 31.2]]])
    RIVERLINES.push({ D: splinePath(pts, 40), hw: 14, dry: true });
  // Water does not run uphill. The ground here is modelled, not surveyed, so a mapped course sometimes crosses a ridge that is not there in reality: going
  // downstream, any stretch that stands more than 14 m above the lowest point passed so far is left out, and so are scraps under 350 m that touch nothing.
  { const out = []; for (const r of RIVERLINES) { let D = r.D; if (groundAt(D[0][0], D[0][1]).h < groundAt(D[D.length - 1][0], D[D.length - 1][1]).h) D = D.slice().reverse(); let lo = Infinity, run = [];
      const flush = () => { if (run.length >= 5) out.push({ D: run, hw: r.hw, dry: r.dry }); run = []; };
      for (const p of D) { const h = groundAt(p[0], p[1]).h; if (h <= lo + 14) run.push(p); else flush(); lo = Math.min(lo, h); } flush(); }
    const touches = (p, i) => groundAt(p[0], p[1]).water || lcAt(p[0], p[1]) === 9 || out.some((o, j) => j !== i && o.D.some(q => Math.abs(q[0] - p[0]) < 110 && Math.abs(q[1] - p[1]) < 110));
    RIVERLINES = out.filter((r, i) => { let len = 0; for (let k = 1; k < r.D.length; k++) len += Math.hypot(r.D[k][0] - r.D[k - 1][0], r.D[k][1] - r.D[k - 1][1]); return len > 350 || touches(r.D[0], i) || touches(r.D[r.D.length - 1], i); }); }
  return RIVERLINES;
}
/** True on water: the sea and the lakes of the terrain, and the lakes, reservoirs and ponds of the land cover (class 9), at the point or within `r` of it. */
function wetAt(x, z, r) {
  if (groundAt(x, z).water || lcAt(x, z) === 9) return true; if (!r) return false;
  for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (lcAt(x + a, z + b) === 9 || groundAt(x + a, z + b).water) return true; return false;
}
/** Railway lines from OpenStreetMap (RAILS), as world polylines with points at most 45 m apart. */
function railLines() {
  if (RAILLINES) return RAILLINES; RAILLINES = [];
  for (const e of RAILS) { const D = []; let lo = e[0], la = e[1], px = 0, pz = 0;
    for (let i = 0; i < e.length; i += 2) { if (i) { lo += e[i]; la += e[i + 1]; } const x = lon2x(lo / 1e4), z = lat2z(la / 1e4);
      if (D.length) { const n = Math.ceil(Math.hypot(x - px, z - pz) / 45); for (let k = 1; k < n; k++) D.push([px + (x - px) * k / n, pz + (z - pz) * k / n]); }
      D.push([x, z]); px = x; pz = z; }
    if (D.length > 1) RAILLINES.push(D); }
  return RAILLINES;
}
function roadLines() {
  if (ROADLINES) return ROADLINES; ROADLINES = []; const cov = new Set(), C = 800, ck = (x, z) => Math.floor(x / C) * 100003 + Math.floor(z / C);
  for (const [cls, ref, e, dual] of OSM_ROADS) { const D = []; let lo = e[0], la = e[1], px = 0, pz = 0;
    for (let i = 0; i < e.length; i += 2) { if (i) { lo += e[i]; la += e[i + 1]; } const x = lon2x(lo / 1e4), z = lat2z(la / 1e4);
      if (D.length) { const n = Math.ceil(Math.hypot(x - px, z - pz) / 45); for (let k = 1; k < n; k++) D.push([px + (x - px) * k / n, pz + (z - pz) * k / n]); }
      D.push([x, z]); px = x; pz = z; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) cov.add(ck(x + a * C, z + b * C)); }
    ROADLINES.push({ cls, ref, D, dual: !!dual }); }
  // a hand-drawn road keeps only the stretches the OSM extract does not cover (it reaches a few km past the borders)
  ROADS.forEach(([cls, pts], i) => { let run = []; const flush = () => { if (run.length > 12) ROADLINES.push({ cls, ref: ROADNUM[i] || '', D: run, dual: cls === 2 }); run = []; };
    for (const p of splinePath(pts, 45)) { if (cov.has(ck(p[0], p[1]))) flush(); else run.push(p); } flush(); });
  // Roads that lead nowhere are left out: a piece that touches no other road at either end (unless it is long), and a short spur whose loose end is not
  // at a settlement, the edge of the map, water or an airfield. (About 300 ends of 18,000 were loose: left-overs of the extract, not real roads' ends.)
  { const PH = new Map(), all = ROADLINES; all.forEach((r, i) => r.D.forEach(p => { const k = Math.floor(p[0] / 80) + ':' + Math.floor(p[1] / 80); (PH.get(k) || PH.set(k, []).get(k)).push([p[0], p[1], i]); }));
    // first, an end that stops 70 to 400 m short of another road is joined to it by a straight link (the street that connects them is below the classes
    // the extract keeps), unless the link would cross water or an airfield
    const edge = (x, z) => x < X0 + 2500 || x > X1 - 2500 || z < Z0 + 2500 || z > Z1 - 2500;
    const joinEnds = all => { const SH = new Map(); all.forEach((r, i) => { const hw = roadHW(r.cls, r.dual); for (let k = 0; k + 1 < r.D.length; k++) { const sg = [r.D[k][0], r.D[k][1], r.D[k + 1][0], r.D[k + 1][1], i, hw];
          for (let gx = Math.floor(Math.min(sg[0], sg[2]) / 100); gx <= Math.floor(Math.max(sg[0], sg[2]) / 100); gx++) for (let gz = Math.floor(Math.min(sg[1], sg[3]) / 100); gz <= Math.floor(Math.max(sg[1], sg[3]) / 100); gz++) { const k2 = gx + ':' + gz; (SH.get(k2) || SH.set(k2, []).get(k2)).push(sg); } } });
      // the nearest point on any other road (on its segments, not only at its points): an end that does not reach that road's surface is carried on to its
      // centreline, however small the gap (hundreds of ends stopped a few metres to a hundred metres short of the road they belong to)
      all.forEach((r, i) => { for (const head of [true, false]) { const [x, z] = head ? r.D[0] : r.D[r.D.length - 1]; if (edge(x, z) || groundAt(x, z).water || airfieldAt(x, z, 250)) continue; let bx = 0, bz = 0, bd = 400, bhw = 0;
          for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) for (const sg of (SH.get((Math.floor(x / 100) + a) + ':' + (Math.floor(z / 100) + c)) || [])) { if (sg[4] === i) continue; const dx = sg[2] - sg[0], dz = sg[3] - sg[1], t = clamp(((x - sg[0]) * dx + (z - sg[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1), qx = sg[0] + dx * t, qz = sg[1] + dz * t, d = Math.hypot(qx - x, qz - z); if (d < bd) { bd = d; bx = qx; bz = qz; bhw = sg[5]; } }
          if (bd >= 400 || bd <= bhw * 0.5) continue; const n = Math.ceil(bd / 40), link = []; let ok = true; for (let k = 1; k <= n; k++) { const px = x + (bx - x) * k / n, pz = z + (bz - z) * k / n; if (groundAt(px, pz).water || lcAt(px, pz) === 9 || airfieldAt(px, pz, 30)) { ok = false; break; } link.push([px, pz]); }
          if (ok) { if (head) r.D = link.reverse().concat(r.D); else r.D = r.D.concat(link); } } }); };
    joinEnds(all);
    // second, every road is split where it runs into the sea, a lake or an airfield, and the ends that makes are loose ends like any other: a stub left
    // between the last junction and the water or the fence is removed below (roads used to stop dead at the shore and at the airfields)
    { const parts = []; for (const r of all) { const cut = roadCuts(r.D, roadHW(r.cls, r.dual)); if (!cut.some(c => c)) { parts.push(r); continue; }
        for (let a = 0; a < r.D.length;) { if (cut[a]) { a++; continue; } let b = a; while (b + 1 < r.D.length && !cut[b + 1]) b++; if (b - a >= 1) parts.push({ cls: r.cls, ref: r.ref, dual: r.dual, D: r.D.slice(a, b + 1), cutHead: a > 0, cutTail: b < r.D.length - 1 }); a = b + 1; } }
      all.length = 0; for (const q of parts) all.push(q); PH.clear(); all.forEach((r, i) => r.D.forEach(p => { const k = Math.floor(p[0] / 80) + ':' + Math.floor(p[1] / 80); (PH.get(k) || PH.set(k, []).get(k)).push([p[0], p[1], i]); })); }
    const loose = (p, i, wasCut) => { const [x, z] = p; if (x < X0 + 2500 || x > X1 - 2500 || z < Z0 + 2500 || z > Z1 - 2500 || (!wasCut && (groundAt(x, z).water || airfieldAt(x, z, 250)))) return 0;
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const q of (PH.get((Math.floor(x / 80) + a) + ':' + (Math.floor(z / 80) + c)) || [])) if (q[2] !== i && Math.hypot(q[0] - x, q[1] - z) < 70) return 0;
      if (wasCut) return 2; if (urbanAt(x, z) > 0.02 || LOCS.some(l => Math.abs(lon2x(l[2]) - x) < 900 && Math.abs(lat2z(l[3]) - z) < 900)) return 1; return 2; };          // 1: ends at a settlement, 2: ends nowhere
    ROADLINES = all.filter((r, i) => { let len = 0; for (let k = 1; k < r.D.length; k++) len += Math.hypot(r.D[k][0] - r.D[k - 1][0], r.D[k][1] - r.D[k - 1][1]); const a = loose(r.D[0], i, r.cutHead), b = loose(r.D[r.D.length - 1], i, r.cutTail);
      if (a && b && len < 6500) return false; if ((a === 2 || b === 2) && len < 1600) return false;
      // a longer road with an end in the middle of nowhere: its tail is cut back to the last junction (when that is within 9 km)
      const cutAt = (D) => { let t = 0; for (let k = 1; k < D.length; k++) { t += Math.hypot(D[k][0] - D[k - 1][0], D[k][1] - D[k - 1][1]); if (t > 9000) return 0; const [x, z] = D[k];
          for (let u = -1; u <= 1; u++) for (let c = -1; c <= 1; c++) for (const q of (PH.get((Math.floor(x / 80) + u) + ':' + (Math.floor(z / 80) + c)) || [])) if (q[2] !== i && Math.hypot(q[0] - x, q[1] - z) < 60) return k; } return 0; };
      if (a === 2) { const k = cutAt(r.D); if (k) r.D = r.D.slice(k); } if (b === 2) { const k = cutAt(r.D.slice().reverse()); if (k) r.D = r.D.slice(0, r.D.length - k); }
      return r.D.length >= 2; });
    joinEnds(ROADLINES); }          /* once more: cutting a tail back to its junction leaves it a few metres short of the road there */
  return ROADLINES;
}
/** Road and railway corridors, so nothing is built on a road. Every centreline segment (the same splines the road meshes use)
    goes into 400 m buckets, padded by its half-width plus the largest object radius we ever ask about. */
let ROADIDX = null; const RIDX_C = 400, RIDX_PAD = 300;
function roadIndex() {
  ROADIDX = new Map(); const add = (D, hw) => { for (let i = 0; i + 1 < D.length; i++) { const [ax, az] = D[i], [bx, bz] = D[i + 1], seg = [ax, az, bx, bz, hw], e = hw + RIDX_PAD;
    for (let cz = Math.floor((Math.min(az, bz) - e) / RIDX_C); cz <= Math.floor((Math.max(az, bz) + e) / RIDX_C); cz++) for (let cx = Math.floor((Math.min(ax, bx) - e) / RIDX_C); cx <= Math.floor((Math.max(ax, bx) + e) / RIDX_C); cx++) {
      const k = cx * 100003 + cz; let a = ROADIDX.get(k); if (!a) ROADIDX.set(k, a = []); a.push(seg); } } };
  for (const r of roadLines()) add(r.D, roadHW(r.cls, r.dual));
  for (const D of railLines()) add(D, 5);
  for (const r of riverLines()) add(r.D, r.hw + (r.dry ? 2 : 9));          // rivers and stream beds with their banks: nothing is built or planted on them
}
/** True when a round object of radius r (metres) centred at x, z would touch a road or railway, with a 4 m verge. */
function nearRoad(x, z, r) {
  if (!ROADIDX) roadIndex(); r = Math.min(r, RIDX_PAD); const a = ROADIDX.get(Math.floor(x / RIDX_C) * 100003 + Math.floor(z / RIDX_C)); if (!a) return false;
  for (const [ax, az, bx, bz, hw] of a) { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < hw + r + 4) return true; }
  return false;
}
/** Direction (rotation about Y, folded into -45..45 degrees) of the nearest road within `far` metres, or 0: a lone block turns to face its street. */
function roadDirAt(x, z, far) {
  if (!ROADIDX) roadIndex(); const a = ROADIDX.get(Math.floor(x / RIDX_C) * 100003 + Math.floor(z / RIDX_C)); if (!a) return 0; let best = far, rot = 0;
  for (const [ax, az, bx, bz] of a) { const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) { best = d; rot = Math.atan2(dx, dz); } }
  rot = ((rot % 1.5708) + 1.5708) % 1.5708; if (rot > 0.7854) rot -= 1.5708; return Math.abs(rot) < 0.12 ? 0 : rot;
}
/** Level junctions and crossings get a plain asphalt patch on top, so the edge lines and dashes of the roads that meet do not run
    across each other. A patch sits on the wider road's centreline with that road's asphalt half-width, so it never spills past it.
    A road that crosses a motorway (not ending on it) is taken to be a bridge or an underpass: no patch, the smaller road passes under. */
let ROAD_JUNCTIONS = [];
function roadJunctions() {
  const L = roadLines(), C = 120, grid = new Map(), J = [];
  L.forEach((r, li) => { r.hw = roadHW(r.cls, r.dual); r.mw = r.cls === 2 && r.dual; const D = r.D;
    for (let i = 0; i + 1 < D.length; i++) { const [ax, az] = D[i], [bx, bz] = D[i + 1];
      for (let cz = Math.floor(Math.min(az, bz) / C); cz <= Math.floor(Math.max(az, bz) / C); cz++) for (let cx = Math.floor(Math.min(ax, bx) / C); cx <= Math.floor(Math.max(ax, bx) / C); cx++) {
        const k = cx * 100003 + cz; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(li, i); } } });
  const add = (x, z, r, m) => J.push([x, z, r, m]);
  // crossings: two segments of different roads that intersect
  for (const a of grid.values()) for (let p = 0; p < a.length; p += 2) for (let q = p + 2; q < a.length; q += 2) {
    const la = a[p], lb = a[q]; if (la === lb) continue; const A = L[la], B = L[lb]; if (A.mw || B.mw) continue;
    const [ax, az] = A.D[a[p + 1]], [bx, bz] = A.D[a[p + 1] + 1], [cx, cz] = B.D[a[q + 1]], [dx, dz] = B.D[a[q + 1] + 1];
    const e1x = bx - ax, e1z = bz - az, e2x = dx - cx, e2z = dz - cz, den = e1x * e2z - e1z * e2x; if (Math.abs(den) < 1e-6) continue;
    const t = ((cx - ax) * e2z - (cz - az) * e2x) / den, u = ((cx - ax) * e1z - (cz - az) * e1x) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    const W = A.hw >= B.hw ? A : B; add(ax + e1x * t, az + e1z * t, W.hw, Math.max(A.hw, B.hw) === Math.min(A.hw, B.hw) ? 0 : 1); }
  // T-junctions: the end of a road that lies on another road
  L.forEach((r, li) => { for (const [ei, [ex, ez]] of [r.D[0], r.D[r.D.length - 1]].entries()) { const a = grid.get(Math.floor(ex / C) * 100003 + Math.floor(ez / C)); if (!a) continue; let best = null;
    for (let p = 0; p < a.length; p += 2) { if (a[p] === li) continue; const B = L[a[p]], [ax, az] = B.D[a[p + 1]], [bx, bz] = B.D[a[p + 1] + 1], dx = bx - ax, dz = bz - az;
      const t = clamp(((ex - ax) * dx + (ez - az) * dz) / (dx * dx + dz * dz || 1), 0, 1), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(ex - px, ez - pz);
      if (d < B.hw + 2 && (!best || d < best.d)) best = { d, px, pz, B }; }
    if (best) { add(best.px, best.pz, best.B.hw, 1); if (best.B.hw < r.hw) r['e' + ei] = best.B.hw; } } });      // on the through road, at its width (a wider road ending on it would leave a round bulb)
  // one patch per junction (crossings found in several cells, both ends of a short link), off water and airfields
  const P = [], N = [], I = [], seen = new Map(), S2 = 20;
  for (const [x, z, hw] of J) { const k = Math.round(x / S2) * 100003 + Math.round(z / S2); if (seen.has(k)) continue; seen.set(k, 1);
    if (groundAt(x, z).water || airfieldAt(x, z, hw)) continue; ROAD_JUNCTIONS.push([x, z, hw]); const r = hw * 0.78, n = 14, c0 = P.length / 3, hc = triHeight(x, z);
    P.push(x, hc + 3.3, z); N.push(0, 1, 0);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, vx = x + Math.cos(a) * r, vz = z + Math.sin(a) * r; P.push(vx, Math.max(triHeight(vx, vz), hc) + 3.3, vz); N.push(0, 1, 0); }
    for (let i = 0; i < n; i++) I.push(c0, c0 + 1 + (i + 1) % n, c0 + 1 + i); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x6a6c6f, side: THREE.DoubleSide })); m.frustumCulled = false; m.matrixAutoUpdate = false; scene.add(m);
  return ROAD_JUNCTIONS.length;
}
function buildRoads() {
  // surfaces: a two-lane road, and a dual carriageway with a planted median for divided roads
  const mk = (w, draw) => { const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = w * 4; c.height = 256; c.getContext('2d').scale(4, 4); draw(x);          /* four times the old resolution: the lines stay crisp close up */
    for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; x.fillRect(Math.random() * w, Math.random() * 64, 0.5 + Math.random(), 0.5 + Math.random() * 2); }      // asphalt grain
    const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
  // asphalt grey, light shoulders, white edge lines and dashes. The strips face up (their winding used to face down, so the lit
  // side was the underside and roads, rails and rivers looked black)
  const tex = { 1: mk(32, x => { x.fillStyle = '#958f7e'; x.fillRect(0, 0, 32, 64); x.fillStyle = '#6c6e71'; x.fillRect(4, 0, 24, 64); x.fillStyle = '#e8e6de'; x.fillRect(15, 0, 2, 34); x.fillRect(5, 0, 1, 64); x.fillRect(26, 0, 1, 64); }),
    2: mk(64, x => { x.fillStyle = '#958f7e'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#66686b'; x.fillRect(4, 0, 24, 64); x.fillRect(36, 0, 24, 64); x.fillStyle = '#6f8a52'; x.fillRect(29, 0, 6, 64); x.fillStyle = '#c9c9c4'; x.fillRect(28, 0, 1, 64); x.fillRect(35, 0, 1, 64);
      x.fillStyle = '#eeece4'; for (const u of [5, 26, 37, 58]) x.fillRect(u, 0, 1, 64); x.fillRect(15, 0, 1, 30); x.fillRect(48, 0, 1, 30); }) };
  const G = { 1: { P: [], U: [], N: [], I: [] }, 2: { P: [], U: [], N: [], I: [] } };
  roadJunctions();          // first: it also notes where a wide road ends on a narrower one (e0, e1), so that end can taper to fit
  for (const [li, { cls, D, dual, e0, e1 }] of roadLines().entries()) {
    // where a road meets water or an airfield it is cut (runways are full size on the compressed map, so they cover real roads);
    // a short stub left beside an airfield is dropped rather than drawn as a road that ends in a field
    const cut = roadCuts(D, roadHW(cls, dual)), runs = [];
    for (let i = 0; i < D.length;) { if (cut[i]) { i++; continue; } let j = i; while (j + 1 < D.length && !cut[j + 1]) j++;
      const nearField = (i > 0 && cut[i - 1] === 2) || (j + 1 < D.length && cut[j + 1] === 2); if (j - i >= (nearField ? 10 : 1)) runs.push([i, j]); i = j + 1; }          /* a run of two points is drawn too: 2,750 short pieces by the junctions used to be left out, each a gap in its road */
    const hw = roadHW(cls, dual), lift = 2.2 + roadRank(cls, dual) * 0.2 + (cls === 2 && dual ? (li % 4) * 0.04 : 0), { P, U, N, I } = G[dual ? 2 : 1];
    for (const [i0, i1] of runs) { let prev = -1, path = [], len = 0;
      for (let i = i0; i <= i1; i++) {
        const a = D[Math.max(i - 1, 0)], b = D[Math.min(i + 1, D.length - 1)], [px, pz] = D[i], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / tl, nz = (b[0] - a[0]) / tl;
        const tp = Math.min(e0 !== undefined ? i / 3 : 1, e1 !== undefined ? (D.length - 1 - i) / 3 : 1), hwI = tp < 1 ? lerp(i < 3 && e0 !== undefined ? e0 : e1, hw, Math.max(tp, 0)) : hw;
        const k = P.length / 3; len += i > i0 ? Math.hypot(px - D[i - 1][0], pz - D[i - 1][1]) : 0;
        const gw = groundAt(px, pz), wl = gw.water ? gw.h - 1 : -1e9;          /* over a short stretch of water the road is a causeway just above it */
        for (const s of [-1, 1]) { const vx = px + nx * hwI * s, vz = pz + nz * hwI * s; P.push(vx, Math.max(triHeight(vx, vz), triHeight(px, pz), wl) + lift, vz); N.push(0, 1, 0); U.push(s < 0 ? 0 : 1, len / 40); }
        if (prev >= 0) I.push(prev, prev + 1, k, prev + 1, k + 1, k);
        prev = k; path.push([px, Math.max(triHeight(px, pz), wl) + 3.8, pz, cls]);
      }
      if (path.length > 4) roadPaths.push(path); }
  }
  for (const cls of [1, 2]) { const { P, U, N, I } = G[cls], g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex[cls], side: THREE.DoubleSide })); m.frustumCulled = false; m.matrixAutoUpdate = false; scene.add(m); }
  // route-number shields for the map: the middle of each numbered road longer than about 7 km, one per number within 36 km
  for (const r of roadLines().filter(r => /^[1-9][0-9]{0,2}$/.test(r.ref) && r.D.length > 40).sort((a, b) => b.D.length - a.D.length)) { const [x, z] = r.D[r.D.length >> 1];
    if (!ROADLBL.some(o => o.n === r.ref && Math.hypot(o.x - x, o.z - z) < 9000)) ROADLBL.push({ x, z, n: r.ref, cls: r.cls === 2 ? 2 : 1 }); }
  // traffic: light points that drive along the roads (headlights at night)
  const n = 560, R = rng(99), cars = [], tp = new Float32Array(n * 3);
  const cum = []; let tot = 0; for (const p of roadPaths) cum.push(tot += p.length);          // cars spread by road length
  for (let i = 0; i < n; i++) { const t = R() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; } const p = roadPaths[lo]; cars.push({ p, s: R() * (p.length - 2), v: (R() < 0.5 ? -1 : 1) * (22 + R() * 12) / 45 }); }
  const tg = new THREE.BufferGeometry(), tc = new Float32Array(n * 3).fill(1); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
  traffic = { cars, pts: new THREE.Points(tg, clampPoints(new THREE.PointsMaterial({ size: 9, map: lightDot(), color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false }), 1.6, 9)) };
  traffic.pts.frustumCulled = false; scene.add(traffic.pts);
}
function updateTraffic(dt) {
  const a = traffic.pts.geometry.attributes.position, arr = a.array, ca = traffic.pts.geometry.attributes.color, col = ca.array, night = ENV.uLights.value > 0.3, cx = camera.position.x, cz = camera.position.z;
  traffic.cars.forEach((c, i) => { c.s += c.v * dt; const m = c.p.length - 1; if (c.s >= m) c.s -= m; else if (c.s < 0) c.s += m; const k = c.s | 0, f = c.s - k, p = c.p[k], q = c.p[Math.min(k + 1, m)];
    arr[i * 3] = p[0] + (q[0] - p[0]) * f; arr[i * 3 + 1] = p[1] + (q[1] - p[1]) * f; arr[i * 3 + 2] = p[2] + (q[2] - p[2]) * f;
    // at night a car coming toward the camera shows white headlights, one going away red tail lights: roads become red and white ribbons. By day, paint colours
    if (night) { const toward = ((q[0] - p[0]) * (cx - arr[i * 3]) + (q[2] - p[2]) * (cz - arr[i * 3 + 2])) * c.v > 0; col[i * 3] = 1; col[i * 3 + 1] = toward ? 0.95 : 0.12; col[i * 3 + 2] = toward ? 0.82 : 0.06; }
    else { const h = (i * 0.6180339) % 1; col[i * 3] = h < 0.5 ? 0.96 : h < 0.7 ? 0.75 : h < 0.85 ? 0.25 : 0.8; col[i * 3 + 1] = h < 0.5 ? 0.95 : h < 0.7 ? 0.76 : h < 0.85 ? 0.3 : 0.2; col[i * 3 + 2] = h < 0.5 ? 0.92 : h < 0.7 ? 0.78 : h < 0.85 ? 0.42 : 0.18; } });
  a.needsUpdate = true; ca.needsUpdate = true;
}

/** Merge simple geometries into one, each with its own vertex colour: [[geometry, r, g, b], ...]. */
function mergeGeo(parts) {
  const P = [], N = [], C = [];
  for (const [g0, r, gg, b] of parts) { const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i += 3) { P.push(p[i], p[i + 1], p[i + 2]); N.push(n[i], n[i + 1], n[i + 2]); C.push(r, gg, b); } }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); o.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return o;
}
const GEO = {};
/** Trees and villages are instanced only around the camera and re-seeded as it moves. Villages come in two kinds:
    red-roofed moshav/kibbutz houses around a water tower, and flat-roofed stone houses around a minaret. */
function buildScatter() {
  // every tree stands on its own soft shadow (a dark disc, offset away from the afternoon sun), and is darker underneath: no more floating lollipops
  const shDisc = () => new THREE.CircleGeometry(0.62, 9).rotateX(-Math.PI / 2).translate(0.2, 0.035, -0.22);
  GEO.tree = mergeGeo([[new THREE.ConeGeometry(0.5, 0.62, 7).translate(0, 0.62, 0), 1, 1, 1], [new THREE.ConeGeometry(0.42, 0.5, 7).translate(0, 0.32, 0), 0.72, 0.72, 0.72], [new THREE.CylinderGeometry(0.06, 0.08, 0.2, 5).translate(0, 0.1, 0), 0.32, 0.24, 0.16], [shDisc(), 0.30, 0.34, 0.42]]);
  { const cr = new THREE.IcosahedronGeometry(0.5, 1).scale(1, 0.85, 1).translate(0, 0.62, 0), lo = new THREE.SphereGeometry(0.46, 8, 5, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(1.04, 0.85, 1.04).translate(0, 0.62, 0);
    GEO.crown = mergeGeo([[cr, 1, 1, 1], [lo, 0.62, 0.62, 0.62], [new THREE.CylinderGeometry(0.07, 0.09, 0.3, 5).translate(0, 0.15, 0), 0.34, 0.26, 0.18], [shDisc(), 0.30, 0.34, 0.42]]); }
  GEO.house = mergeGeo([[new THREE.BoxGeometry(1, 0.6, 1).translate(0, 0.3, 0), 1, 1, 1], [new THREE.ConeGeometry(0.78, 0.42, 4).rotateY(Math.PI / 4).translate(0, 0.81, 0), 0.76, 0.29, 0.21]]);
  GEO.stone = mergeGeo([[new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 1, 1, 1]]);
  GEO.tower = mergeGeo([[new THREE.CylinderGeometry(0.1, 0.13, 0.72, 8).translate(0, 0.36, 0), 0.8, 0.8, 0.78], [new THREE.CylinderGeometry(0.5, 0.36, 0.3, 12).translate(0, 0.86, 0), 0.92, 0.92, 0.9]]);
  GEO.minaret = mergeGeo([[new THREE.CylinderGeometry(0.03, 0.06, 0.9, 8).translate(0, 0.45, 0), 0.96, 0.95, 0.9], [new THREE.ConeGeometry(0.05, 0.14, 8).translate(0, 0.97, 0), 0.25, 0.5, 0.35], [new THREE.CylinderGeometry(0.085, 0.085, 0.03, 8).translate(0, 0.7, 0), 0.9, 0.9, 0.86]]);
  const mk = (g, n) => { const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }), n); m.frustumCulled = false; m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.array.fill(1); m.count = 0; scene.add(m); return m; };
  scatter = { bm: mk(GEO.crown, 2600), tm: mk(GEO.tree, 3200), hm: mk(GEO.house, 650), sm: mk(GEO.stone, 550), wm: mk(GEO.tower, 40), mm: mk(GEO.minaret, 40), x: 1e9, z: 1e9, col: new THREE.Color(), e: new THREE.Euler() };
}
function updateScatter() {
  const S2 = scatter, cx = camera.position.x, cz = camera.position.z; if (Math.hypot(cx - S2.x, cz - S2.z) < 170) return; S2.x = cx; S2.z = cz;
  const { tm, bm, hm, sm, wm, mm, col, e } = S2; let nt = 0, nb = 0, nh = 0, ns = 0, nw = 0, nm = 0;
  if (camera.position.y - heightAt(cx, cz) < 2600) {
    const CELL = 42, RAD = 1500, n = Math.ceil(RAD / CELL), gx0 = Math.round(cx / CELL), gz0 = Math.round(cz / CELL), m4 = tmpM, q = tmpQ, p = tmpV, sc = tmpV2;
    for (let gz = gz0 - n; gz <= gz0 + n; gz++) for (let gx = gx0 - n; gx <= gx0 + n; gx++) {
      const h = hash2(gx * 1.37 + 11, gz * 2.11 + 7), x = (gx + hash2(gx + 3.3, gz + 9.1) - 0.5) * CELL, z = (gz + hash2(gx + 7.7, gz + 1.9) - 0.5) * CELL, d = Math.hypot(x - cx, z - cz); if (d > RAD) continue;
      const zi = zoneAt(x, z), farm = ZONE[zi], arid = ZONE[zi + 1], urban = ZONE[zi + 2], wood = (1 - arid) * (1 - farm) * (1 - urban), clump = FOREST[zi >> 2] > 0.3 ? 1.5 : vnoise(gx * 0.11, gz * 0.11) > 0.47 ? 1 : 0.22;
      // one coarse cell in four holds a village; its kind depends on the region
      const vx = Math.floor(gx / 14), vz = Math.floor(gz / 14), lon = x2lon(vx * 14 * CELL), lat = z2lat(vz * 14 * CELL);
      const stoneV = (lon > 35.03 && lon < 35.45 && lat > 31.32 && lat < 32.55) || (lon < 34.52 && lat < 31.6) || lon > 35.72 || (lat > 32.75 && lat < 32.98 && lon > 35.15 && lon < 35.42) || arid > 0.55;
      const vd = Math.hypot(gx - (vx * 14 + 7), gz - (vz * 14 + 7)), vill = false && urban < 0.2 && (stoneV ? arid < 0.8 && farm < 0.9 : farm > 0.35) && hash2(vx * 5.1 + 2, vz * 3.7 + 5) < (stoneV ? 0.2 : 0.27) && vd < 4.4;
      if (vill) {
        const g = groundAt(x, z); if (g.water || lcAt(x, z) === 9 || airfieldAt(x, z, 14) || nearRoad(x, z, 14)) continue; const y = triHeight(x, z);
        if (vd < 0.6) { p.set(x, y, z); q.set(0, 0, 0, 1); if (stoneV && nm < 40) { sc.set(40, 40, 40); m4.compose(p, q, sc); mm.setMatrixAt(nm++, m4); } else if (!stoneV && nw < 40) { sc.set(11, 24, 11); m4.compose(p, q, sc); wm.setMatrixAt(nw++, m4); } continue; }
        if (h > (stoneV ? 0.7 : 0.55)) continue;
        e.set(0, Math.floor(hash2(vx, vz) * 4) * 0.4 + (stoneV ? h * 3 : 0), 0); q.setFromEuler(e); p.set(x, y - 1, z);
        if (stoneV) { if (ns >= 550) continue; sc.set(9 + h * 9, 5 + hash2(gx, gz) * 6, 8 + h * 8); m4.compose(p, q, sc); sm.setMatrixAt(ns, m4); const k = hash2(gx + 1, gz); sm.setColorAt(ns++, col.setRGB(0.86 + k * 0.08, 0.80 + k * 0.08, 0.66 + k * 0.1)); }
        else { if (nh >= 650) continue; sc.set(10 + h * 9, 8 + h * 4, 9 + hash2(gx, gz) * 6); m4.compose(p, q, sc); hm.setMatrixAt(nh, m4); const k = hash2(gx + 1, gz); hm.setColorAt(nh++, col.setRGB(0.93 + k * 0.07, 0.92 + k * 0.06, 0.86 + k * 0.1)); }
        continue;
      }
      // where OpenStreetMap knows the land cover, it decides: pines in forests, round crowns in orchards, parks and towns, shrubs in scrub, nothing on sand, water, industry
      const lc = lcAt(x, z), LP = [0, 0.9, 0.8, 0.12, 0.03, 0.5, 0.18, 0, 0.01, 0, 0.12, 0.22, 0, 0, 0, 0.04, 0.3, 0.02][lc];
      const pr = lc ? LP : wood * 0.6 * clump + farm * 0.05 + arid * 0.025 + urban * 0.16; if (h > pr) continue;
      const g = groundAt(x, z); if (g.water || lcAt(x, z) === 9 || airfieldAt(x, z, 6) || nearRoad(x, z, 6) || (urban > 0.05 || lc === 11 || lc === 12 ? obstBox(x, z, 3, 3) : false)) continue;
      const k = hash2(gx + 5.5, gz + 2.5), fade = ss(RAD, RAD * 0.8, d), shrub = lc ? lc === 6 : arid > 0.6, pine = lc ? lc === 1 || (lc === 16 && k < 0.6) : !shrub && clump > 0.9;
      if (pine) { if (nt >= 3200) continue; const ht = (10 + k * 10) * fade, wd = (5 + k * 3) * fade; p.set(x, triHeight(x, z) - 0.5, z); sc.set(wd, ht, wd); q.set(0, 0, 0, 1); m4.compose(p, q, sc); tm.setMatrixAt(nt, m4);
        tm.setColorAt(nt++, col.setRGB(0.09 + k * 0.06, 0.20 + k * 0.10, 0.08 + k * 0.04)); continue; }
      if ((urban > 0.25 || lc === 16 || lc === 11) && !shrub && hash2(gx + 9.1, gz + 4.7) < 0.14 && nt < 3200) {       // a cypress now and then in towns and cemeteries: tall, thin, almost black
        p.set(x, triHeight(x, z) - 0.5, z); sc.set(3 + k, (15 + k * 6) * fade, 3 + k); q.set(0, 0, 0, 1); m4.compose(p, q, sc); tm.setMatrixAt(nt, m4); tm.setColorAt(nt++, col.setRGB(0.07, 0.15, 0.08)); continue; }
      if (nb >= 2600) continue;
      const orch = lc === 2, ht = (shrub ? 3 + k * 2.5 : orch ? 6 + k * 2 : 8 + k * 8) * fade, wd = (shrub ? 5 + k * 3 : orch ? 6 + k * 1.5 : 7 + k * 6) * fade;
      p.set(x, triHeight(x, z) - 0.3, z); sc.set(wd, ht, wd); q.set(0, 0, 0, 1); m4.compose(p, q, sc); bm.setMatrixAt(nb, m4);
      bm.setColorAt(nb++, shrub ? col.setRGB(0.33 + k * 0.05, 0.34 + k * 0.05, 0.22) : orch ? col.setRGB(0.12 + k * 0.04, 0.26 + k * 0.06, 0.10) : col.setRGB(0.13 + k * 0.07, 0.24 + k * 0.09, 0.10 + k * 0.04));       /* natural greens: olive-grey scrub, deep orchard, darker crowns */
    }
  }
  [[tm, nt], [bm, nb], [hm, nh], [sm, ns], [wm, nw], [mm, nm]].forEach(([m, c]) => { m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
}

function buildDetails() {
  const lam = c => new THREE.MeshLambertMaterial({ color: c }), put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };
  // --- ponds: Dead Sea evaporation pans, fish ponds, salt pans, greenhouses ---
  const P = [], C = [], I = [], col = new THREE.Color();
  const ponds = (lon, lat, cols, rows, w, d, pal, rot) => { const cx = lon2x(lon), cz = lat2z(lat), R = rng(Math.round(lon * 977 + lat * 131)), ca = Math.cos(rot), sa = Math.sin(rot);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const lx = (i - (cols - 1) / 2) * (w + 28), lz = (j - (rows - 1) / 2) * (d + 28), x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca, g = groundAt(x, z); if (g.water || airfieldAt(x, z, Math.hypot(w, d) / 2) || nearRoad(x, z, Math.hypot(w, d) / 2) || obstBox(x, z, w / 2, d / 2)) continue;
      { const hs = [triHeight(x - w * 0.4, z), triHeight(x + w * 0.4, z), triHeight(x, z - d * 0.4), triHeight(x, z + d * 0.4)]; if (Math.max(...hs) - Math.min(...hs) > 7) continue; }          /* a pan is level water: not on a slope, where it would hang in the air as a tilted slab */
      const y = triHeight(x, z) + 2.5, k = P.length / 3; col.setHex(pal[(R() * pal.length) | 0]);
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const ox = sx * w / 2, oz = sz * d / 2; P.push(x + ox * ca - oz * sa, y, z + ox * sa + oz * ca); C.push(col.r, col.g, col.b); }
      I.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); } };
  ponds(35.415, 31.16, 5, 13, 330, 520, [0x3fc7c0, 0x7fded2, 0xbfe9e0, 0xe9efe8, 0x2aa7b0], 0.18);          // Dead Sea Works
  // (the fish ponds of the Beit She'an valley, the Hula and the Carmel coast are in the land cover, where they really are: the hand-drawn grids are gone)
  ponds(34.985, 29.60, 3, 5, 150, 230, [0xe7d9d2, 0xd8a9a4, 0xf0ece6, 0xc98f93], 0.2);                      // Eilat salt pans
  for (const [lo, la] of [[35.07, 29.93], [35.19, 30.62], [35.33, 30.93], [34.44, 31.31], [35.50, 32.03]]) ponds(lo, la, 6, 5, 60, 150, [0xf2f4f2, 0xe4e8e6, 0xd8dedc], 0.3);   // greenhouse clusters
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); pg.setIndex(I); pg.computeVertexNormals();
  const pm = new THREE.Mesh(pg, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, side: THREE.DoubleSide })); pm.frustumCulled = false; scene.add(pm);
  // --- power-station stacks with red and white bands ---
  const sc = document.createElement('canvas'); sc.width = 4; sc.height = 64; const sx = sc.getContext('2d'); for (let i = 0; i < 8; i++) { sx.fillStyle = i < 3 && i % 2 === 0 ? '#c8443a' : '#e6e3dc'; sx.fillRect(0, i * 8, 4, 8); }
  const stackM = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(sc) }), plant = lam(0xb9bcc0);
  for (const [lo, la, hs] of [[34.886, 32.47, [250, 250, 300]], [34.537, 31.63, [250, 250]], [34.668, 31.845, [150, 150]], [34.776, 32.106, [150]]]) {
    const x = lon2x(lo), z = lat2z(la), y = heightAt(x, z); hs.forEach((h, i) => put(new THREE.CylinderGeometry(7, 11, h, 12), stackM, x + i * 60, y + h / 2, z)); put(new THREE.BoxGeometry(60 * hs.length + 80, 55, 90), plant, x + 30 * (hs.length - 1), y + 27, z + 80); }
  // --- Haifa: refinery cooling towers and the golden Bahá'í dome on the Carmel slope ---
  { const x = lon2x(35.105), z = lat2z(32.80), y = heightAt(x, z), cool = lam(0xd9d6cf); for (const o of [0, 95]) { put(new THREE.CylinderGeometry(24, 38, 46, 20, 1, true), cool, x + o, y + 23, z).material.side = THREE.DoubleSide; put(new THREE.CylinderGeometry(30, 24, 34, 20, 1, true), cool, x + o, y + 63, z); }
    const bx = lon2x(34.988), bz = lat2z(32.814), by = heightAt(bx, bz); put(new THREE.CylinderGeometry(26, 30, 34, 8), lam(0xf0ead8), bx, by + 17, bz);
    put(new THREE.SphereGeometry(20, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: 0xe0a91c, emissive: 0x4a3200, shininess: 120 }), bx, by + 34, bz);
    for (let i = 1; i < 9; i++) put(new THREE.BoxGeometry(150 - i * 8, 3, 34), lam(i % 2 ? 0x3f7a35 : 0xcfc9b4), bx, heightAt(bx, bz - i * 42) + 2, bz - i * 42); }
  // --- Ashalim solar tower in the Negev: a tall mast with a blinding receiver ---
  { const x = lon2x(34.73), z = lat2z(30.96), y = heightAt(x, z); put(new THREE.CylinderGeometry(9, 14, 250, 12), lam(0x8d9196), x, y + 125, z);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightDot(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.position.set(x, y + 252, z); s.scale.set(170, 170, 1); scene.add(s);
    const hel = lam(0x7f95ad), R = rng(8); for (let i = 0; i < 70; i++) { const a = R() * 6.283, r = 250 + R() * 700, hx = x + Math.cos(a) * r, hz = z + Math.sin(a) * r; if (nearRoad(hx, hz, 28)) continue; put(new THREE.BoxGeometry(46, 2, 30), hel, hx, triHeight(hx, hz) + 5, hz).rotation.y = -a; } }
  // --- wind turbines on the Golan and Mount Gilboa (blades turn) ---
  const tw = lam(0xe9ebed), blade = new THREE.BoxGeometry(5, 66, 1.5).translate(0, 33, 0), R2 = rng(31);
  for (const [lo, la, n] of [[35.80, 33.04, 8], [35.76, 32.93, 5], [35.42, 32.47, 5]]) for (let i = 0; i < n; i++) {
    const x = lon2x(lo) + (R2() - 0.5) * 2600, z = lat2z(la) + (R2() - 0.5) * 2600, y = heightAt(x, z); if (nearRoad(x, z, 40)) continue; put(new THREE.CylinderGeometry(2.2, 3.6, 120, 8), tw, x, y + 60, z);
    const hub = new THREE.Group(); hub.position.set(x, y + 120, z + 4); for (let b = 0; b < 3; b++) { const m = new THREE.Mesh(blade, tw); m.rotation.z = b * 2.094; hub.add(m); } hub.userData.v = 0.8 + R2() * 0.5; scene.add(hub); turbines.push(hub); }
  // --- shipping: freighters off the ports, sailboats off the beaches and on the Kinneret ---
  const wakeMat = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'), im = x.createImageData(64, 256);
    for (let v = 0; v < 256; v++) for (let u = 0; u < 64; u++) { const t = (v + 22) / 278, half = 3 + t * 27, d = Math.abs(u - 31.5), arm = Math.exp(-Math.pow((d - half * 0.86) / (1.6 + t * 3), 2)), core = Math.exp(-d * d / (10 + t * 60)) * (1 - t) * 0.8, n = 0.7 + 0.3 * hash2(u * 3.1, v * 1.7), a = clamp((arm * 0.75 + core) * (1 - t * t) * n * (v < 6 ? v / 6 : 1), 0, 1), o = (v * 64 + u) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = a * 235; }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); })();
  const hull = [lam(0x2c3e55), lam(0x7a2d2a), lam(0x1f2a33)], wht = lam(0xf2f2ee), box = [lam(0xc65b3a), lam(0x3c78a8), lam(0x6d9a4b)], R3 = rng(57);
  for (const [lo, la, hdg] of [[34.93, 32.87, 0.5], [34.90, 32.90, 0.7], [34.955, 32.845, 0.3], [34.60, 31.86, 1.1], [34.57, 31.90, 1.3], [34.50, 31.70, 0.2], [34.70, 32.12, 0], [34.74, 32.45, 0.1], [34.965, 29.50, 0.35], [34.955, 29.44, 0.4]]) {
    const x = lon2x(lo), z = lat2z(la); if (!groundAt(x, z).water) continue; const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = hdg; scene.add(g);
    // a hull with a pointed, flared bow and a rounded stern, a red boot line, a bridge with a funnel, rows of containers, and a foam wake behind
    { const hg = new THREE.BoxGeometry(30, 14, 190, 2, 1, 12), hp = hg.attributes.position; for (let k = 0; k < hp.count; k++) { const zz = hp.getZ(k), yy = hp.getY(k), bow = clamp((-zz - 55) / 40, 0, 1), st = clamp((zz - 80) / 15, 0, 1); hp.setX(k, hp.getX(k) * (1 - bow * bow * 0.96) * (1 - st * 0.35) * (yy < 0 ? 0.82 : 1)); if (bow > 0 && yy > 0) hp.setZ(k, zz - bow * 9); }
      hg.computeVertexNormals(); const h = new THREE.Mesh(hg, hull[(R3() * 3) | 0]); h.position.y = 4; g.add(h); const bl = new THREE.Mesh(new THREE.BoxGeometry(25.5, 2.2, 150), lam(0x8c2a22)); bl.position.set(0, -1.6, 12); g.add(bl); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(27, 24, 16), wht); br.position.set(0, 23, 76); g.add(br); const wn = new THREE.Mesh(new THREE.BoxGeometry(27.4, 3, 16.4), lam(0x22303c)); wn.position.set(0, 31, 76); g.add(wn);
    const fn = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 13, 10), lam(0x1d2a44)); fn.position.set(0, 41, 82); g.add(fn);
    for (let i = 0; i < 9; i++) for (let j = -1; j <= 1; j++) { if (R3() < 0.12) continue; const ch = 5.2 * (1 + ((R3() * 3) | 0)); const cb = new THREE.Mesh(new THREE.BoxGeometry(8, ch, 12.6), box[(R3() * 3) | 0]); cb.position.set(j * 8.6, 11 + ch / 2, -52 + i * 13.4); g.add(cb); }
    { const wk = new THREE.Mesh(new THREE.PlaneGeometry(120, 620).rotateX(-Math.PI / 2), wakeMat); wk.position.set(0, 0.7, 250); wk.renderOrder = 2; g.add(wk); } }
  const sail = new THREE.ConeGeometry(7, 22, 3).translate(0, 13, 0);
  for (const [lo, la, lvl, n, sp] of [[34.755, 32.08, 0, 7, 900], [34.80, 32.17, 0, 5, 800], [34.84, 32.33, 0, 4, 700], [34.955, 29.535, 0, 6, 600], [35.585, 32.80, -212, 8, 2200], [34.96, 32.82, 0, 4, 700]]) for (let i = 0; i < n; i++) {
    const x = lon2x(lo) + (R3() - 0.5) * sp, z = lat2z(la) + (R3() - 0.5) * sp; if (!groundAt(x, z).water) continue; put(sail, wht, x, lvl, z).rotation.y = R3() * 6; put(new THREE.BoxGeometry(4, 2.5, 14), wht, x, lvl + 1, z); }
  // --- aircraft parked on the aprons ---
  const body = new THREE.CylinderGeometry(1.9, 1.9, 34, 10).rotateX(Math.PI / 2), wing = new THREE.BoxGeometry(32, 0.5, 5), fin = new THREE.BoxGeometry(0.4, 7, 5), tailc = [lam(0x1557a8), lam(0xb83232), lam(0x2f8f6a)];
  AIRPORTS.forEach((ap, ai) => { const n = ap.big ? 5 : 2, s = ap.big ? 1 : 0.55; for (let i = 0; i < n; i++) { const g = new THREE.Group(); g.position.set(ap.x + ap.term[0] + (ap.big ? [-165, -55, 55, 165, 250][i] : (i - 0.5) * 70), ap.elev + 3.6 * s, ap.z + ap.term[1] + (ap.big ? (i === 4 ? 40 : 150) : 70));       /* on the stands between the piers (three used to stand inside them) */ g.scale.setScalar(s); scene.add(g);
    g.add(new THREE.Mesh(body, wht)); const w = new THREE.Mesh(wing, wht); w.position.set(0, -1, 1); g.add(w); const f = new THREE.Mesh(fin, tailc[(i + ai) % 3]); f.position.set(0, 4.5, 14.5); g.add(f); } });
}
/** Bake roads and every town onto the minimap image. */
function bakeMap() {
  // twice the terrain image resolution, so roads and town outlines stay sharp on the enlarged map
  const hi = document.createElement('canvas'); hi.width = mapImg.width * 2; hi.height = mapImg.height * 2;
  const x = hi.getContext('2d'), W = hi.width, H = hi.height, mx = v => (v - X0) / (X1 - X0) * W, mz = v => (v - Z0) / (Z1 - Z0) * H;
  x.imageSmoothingQuality = 'high'; x.drawImage(mapImg, 0, 0, W, H); mapImg = hi; x.lineJoin = 'round';
  for (const c of [0, 1, 2]) for (const p of roadPaths) { if (p[0][3] !== c) continue; x.strokeStyle = c === 2 ? 'rgba(255,236,170,.95)' : c === 1 ? 'rgba(240,240,235,.7)' : 'rgba(230,230,225,.38)'; x.lineWidth = c === 2 ? 2.2 : c === 1 ? 1.2 : 0.8; x.beginPath(); p.forEach((q, i) => i ? x.lineTo(mx(q[0]), mz(q[2])) : x.moveTo(mx(q[0]), mz(q[2]))); x.stroke(); }
  x.fillStyle = 'rgba(238,232,220,.8)'; const sx = W / BLD.w, sy = H / BLD.h; for (let j = 0; j < BLD.h; j++) for (let i = 0; i < BLD.w; i++) if (BLD.d[(j * BLD.w + i) * 4 + 3]) x.fillRect(i * sx, j * sy, sx + 0.35, sy + 0.35);      // the real outline of every settlement
}

// ---------- 7c. Things that make it Israel: Hebrew place names, mosques, the Nahalal circle, pivot fields, seafronts, railways ----------
const HE = ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'אילת', 'נתניה', 'אשדוד', 'טבריה', 'נצרת', 'עכו', 'אשקלון', 'ראשון לציון', 'רחובות', 'פתח תקווה', 'הרצליה', 'כפר סבא', 'חדרה', 'קיסריה', 'זכרון יעקב', 'יקנעם',
  'עפולה', 'מגדל העמק', 'בית שאן', 'צפת', 'ראש פינה', 'קריית שמונה', 'מטולה', 'קצרין', 'מג׳דל שמס', 'נהריה', 'מעלות', 'כרמיאל', 'סח׳נין', 'שפרעם', 'קריית ביאליק', 'אום אל-פחם', 'מודיעין', 'רמלה', 'יבנה', 'בית שמש',
  'קריית גת', 'שדרות', 'נתיבות', 'אופקים', 'רהט', 'ערד', 'דימונה', 'ירוחם', 'שדה בוקר', 'מצפה רמון', 'עין גדי', 'עין בוקק', 'יריחו', 'מעלה אדומים', 'בית לחם', 'חברון', 'רמאללה', 'שכם', 'ג׳נין', 'טולכרם',
  'קלקיליה', 'אריאל', 'עזה', 'ח׳אן יונס', 'רפיח', 'יטבתה', 'עקבה', 'עמאן', 'אירביד', 'מידבא', 'כרכ', 'צור', 'קוניטרה', 'עין גב'];
CITIES.forEach((c, i) => c.he = HE[i] || c.name);
// Second tier of places: [English, Hebrew, lon, lat, size 1-5, style].  Sizes: 1 hamlet … 5 city.
const MORE = [
  ['Ramat Gan','רמת גן',34.815,32.078,4,'g'],['Bnei Brak','בני ברק',34.835,32.088,4,'g'],['Holon','חולון',34.78,32.015,4,'g'],['Bat Yam','בת ים',34.752,32.022,4,'g'],['Ra’anana','רעננה',34.87,32.186,3,'g'],['Hod HaSharon','הוד השרון',34.89,32.152,3,'g'],
  ['Rosh HaAyin','ראש העין',34.955,32.095,3,'m'],['Ness Ziona','נס ציונה',34.80,31.93,3,'g'],['Gedera','גדרה',34.78,31.812,2,'m'],['Kiryat Malakhi','קריית מלאכי',34.745,31.73,2,'m'],['Shoham','שוהם',34.948,31.998,2,'m'],['Elad','אלעד',34.952,32.052,2,'g'],
  ['Kfar Yona','כפר יונה',34.935,32.317,2,'m'],['Tira','טירה',34.95,32.233,3,'s'],['Tayibe','טייבה',35.01,32.266,3,'s'],['Baqa al-Gharbiyye','באקה אל-גרביה',35.04,32.42,3,'s'],['Pardes Hanna','פרדס חנה',34.97,32.475,3,'m'],['Binyamina','בנימינה',34.95,32.52,2,'m'],
  ['Or Akiva','אור עקיבא',34.92,32.508,2,'m'],['Atlit','עתלית',34.94,32.69,2,'m'],['Tirat Carmel','טירת כרמל',34.972,32.76,3,'m'],['Nesher','נשר',35.045,32.765,3,'m'],['Kiryat Ata','קריית אתא',35.11,32.81,4,'g'],['Kiryat Tiv’on','קריית טבעון',35.13,32.72,2,'m'],
  ['Daliyat al-Karmel','דאלית אל-כרמל',35.047,32.693,3,'s'],['Isfiya','עספיא',35.063,32.72,2,'s'],['Ramat Yishai','רמת ישי',35.17,32.705,2,'m'],['Nof HaGalil','נוף הגליל',35.33,32.71,3,'m'],['Kafr Kanna','כפר כנא',35.34,32.747,3,'s'],['Tur’an','טורעאן',35.375,32.777,2,'s'],
  ['Arraba','עראבה',35.335,32.851,3,'s'],['Maghar','מגאר',35.407,32.89,3,'s'],['Rameh','ראמה',35.367,32.938,2,'s'],['Peki’in','פקיעין',35.33,32.975,1,'s'],['Hurfeish','חורפיש',35.348,33.017,2,'s'],['Shlomi','שלומי',35.147,33.075,2,'m'],
  ['Tamra','טמרה',35.2,32.853,3,'s'],['Majd al-Krum','מג׳ד אל-כרום',35.255,32.92,3,'s'],['Kabul','כאבול',35.21,32.87,2,'s'],['Hatzor HaGlilit','חצור הגלילית',35.545,32.98,2,'m'],['Yesud HaMa’ala','יסוד המעלה',35.6,33.057,1,'m'],['Kfar Blum','כפר בלום',35.61,33.172,1,'m'],
  ['Dan','דן',35.652,33.24,1,'m'],['Mas’ade','מסעדה',35.755,33.232,2,'s'],['Buq’ata','בוקעאתא',35.78,33.2,2,'s'],['Merom Golan','מרום גולן',35.777,33.133,1,'m'],['Ramot','רמות',35.668,32.85,1,'m'],['Degania','דגניה',35.575,32.708,1,'m'],
  ['Kinneret','כנרת',35.562,32.722,1,'m'],['Yavne’el','יבנאל',35.5,32.708,2,'m'],['Kfar Tavor','כפר תבור',35.42,32.688,2,'m'],['Migdal','מגדל',35.505,32.84,1,'m'],['Ginosar','גינוסר',35.523,32.848,1,'m'],['Capernaum','כפר נחום',35.575,32.88,1,'s'],
  ['Beit Alfa','בית אלפא',35.43,32.517,1,'m'],['Nir David','ניר דוד',35.458,32.505,1,'m'],['Sde Eliyahu','שדה אליהו',35.513,32.44,1,'m'],['Mehola','מחולה',35.52,32.37,1,'m'],['Argaman','ארגמן',35.52,32.17,1,'m'],['Fasa’el','פצאל',35.44,32.05,1,'m'],
  ['Kalia','קליה',35.47,31.75,1,'m'],['Mitzpe Shalem','מצפה שלם',35.395,31.57,1,'m'],['Neve Zohar','נווה זוהר',35.36,31.15,1,'m'],['Ne’ot HaKikar','נאות הכיכר',35.375,30.935,1,'m'],['Hatzeva','חצבה',35.25,30.77,1,'m'],['Ein Yahav','עין יהב',35.185,30.66,1,'m'],
  ['Sapir','ספיר',35.18,30.61,1,'m'],['Tzofar','צופר',35.18,30.56,1,'m'],['Paran','פארן',35.15,30.365,1,'m'],['Ketura','קטורה',35.06,29.97,1,'m'],['Grofit','גרופית',35.07,29.94,1,'m'],['Eilot','אילות',34.975,29.583,1,'m'],
  ['Taba','טאבה',34.89,29.492,2,'s'],['Ashalim','אשלים',34.7,30.96,1,'m'],['Revivim','רביבים',34.72,31.045,1,'m'],['Tze’elim','צאלים',34.535,31.2,1,'m'],['Nitzana','ניצנה',34.39,30.885,1,'m'],['Lehavim','להבים',34.815,31.372,2,'m'],
  ['Omer','עומר',34.85,31.265,2,'m'],['Meitar','מיתר',34.94,31.325,2,'m'],['Hura','חורה',34.935,31.298,2,'s'],['Tel Sheva','תל שבע',34.86,31.245,2,'s'],['Kuseife','כסיפה',35.09,31.245,2,'s'],['Ar’ara BaNegev','ערערה בנגב',35.02,31.16,2,'s'],
  ['Segev Shalom','שגב שלום',34.84,31.2,2,'s'],['Laqiya','לקיה',34.87,31.325,2,'s'],['Zikim','זיקים',34.52,31.61,1,'m'],['Yad Mordechai','יד מרדכי',34.558,31.588,1,'m'],['Erez','ארז',34.565,31.56,1,'m'],['Nir Am','ניר עם',34.58,31.52,1,'m'],
  ['Mefalsim','מפלסים',34.56,31.503,1,'m'],['Kfar Aza','כפר עזה',34.535,31.484,1,'m'],['Nahal Oz','נחל עוז',34.498,31.473,1,'m'],['Sa’ad','סעד',34.535,31.47,1,'m'],['Alumim','עלומים',34.51,31.45,1,'m'],['Be’eri','בארי',34.49,31.425,1,'m'],
  ['Re’im','רעים',34.46,31.385,1,'m'],['Kissufim','כיסופים',34.4,31.375,1,'m'],['Ein HaShlosha','עין השלושה',34.4,31.352,1,'m'],['Nirim','נירים',34.395,31.335,1,'m'],['Nir Oz','ניר עוז',34.402,31.31,1,'m'],['Magen','מגן',34.43,31.3,1,'m'],
  ['Nir Yitzhak','ניר יצחק',34.36,31.24,1,'m'],['Sufa','סופה',34.34,31.235,1,'m'],['Holit','חולית',34.325,31.228,1,'m'],['Kerem Shalom','כרם שלום',34.283,31.228,1,'m'],['Urim','אורים',34.525,31.305,1,'m'],['Gvulot','גבולות',34.47,31.21,1,'m'],
  ['Latrun','לטרון',34.98,31.838,1,'s'],['Abu Ghosh','אבו גוש',35.11,31.806,2,'s'],['Mevaseret Zion','מבשרת ציון',35.15,31.802,3,'s'],['Tzur Hadassa','צור הדסה',35.097,31.72,2,'s'],['Efrat','אפרת',35.155,31.655,2,'s'],['Beitar Illit','ביתר עילית',35.12,31.698,3,'s'],
  ['Giv’at Ze’ev','גבעת זאב',35.17,31.862,2,'s'],['Modi’in Illit','מודיעין עילית',35.045,31.932,3,'s'],['Salfit','סלפית',35.18,32.085,2,'s'],['Tubas','טובאס',35.37,32.32,3,'s'],['Qabatiya','קבאטיה',35.28,32.41,3,'s'],['Yatta','יטא',35.09,31.448,3,'s'],
  ['Dura','דורא',35.03,31.507,3,'s'],['ad-Dhahiriya','א-דאהרייה',34.972,31.41,3,'s'],['Abu Dis','אבו דיס',35.262,31.762,2,'s'],['Karnei Shomron','קרני שומרון',35.097,32.172,2,'s'],['Shilo','שילה',35.29,32.053,1,'s'],['Ofra','עפרה',35.26,31.955,1,'s'],
  ['Beit El','בית אל',35.223,31.94,2,'s'],['Tekoa','תקוע',35.23,31.652,1,'s'],['Kfar Adumim','כפר אדומים',35.335,31.823,1,'s'],['Beit Hanoun','בית חאנון',34.535,31.54,3,'s'],['Beit Lahia','בית לאהיא',34.495,31.552,3,'s'],['Deir al-Balah','דיר אל-בלח',34.35,31.418,3,'s'],
  ['Nuseirat','נוסייראת',34.39,31.45,3,'s'],['Salt','א-סלט',35.73,32.04,4,'s'],['Jerash','ג׳רש',35.9,32.28,3,'s'],['Ajloun','עג׳לון',35.75,32.333,2,'s'],['Tafila','טפילה',35.6,30.84,3,'s'],['Petra','פטרה',35.48,30.322,2,'s'],
  ['Shobak','שובכ',35.56,30.53,1,'s'],['Zarqa','זרקא',36.09,32.07,5,'s'],['Naqoura','נאקורה',35.14,33.118,1,'s'],['Bint Jbeil','בינת ג׳בייל',35.43,33.12,3,'s'],['Marjayoun','מרג׳ עיון',35.59,33.36,2,'s'],['Nabatieh','נבטיה',35.48,33.38,4,'s'],
  ['Daraa','דרעא',36.1,32.62,4,'s'],['Nawa','נווא',36.04,32.89,3,'s'],['El Arish','אל-עריש',33.81,31.13,4,'s'],['Sheikh Zuweid','שייח׳ זוויד',34.11,31.21,2,'s'],['Megiddo','מגידו',35.19,32.58,1,'m'],['Nahalal','נהלל',35.197,32.69,1,'m']
];
for (const p of MORE) { const [r, n] = [[150, 12], [220, 24], [320, 46], [440, 80], [620, 150]][p[4] - 1]; if (p[0] !== 'Nahalal') CITIES.push({ name: p[0], he: p[1], lon: p[2], lat: p[3], r, n, style: p[5] === 'g' ? 'grid' : p[5] === 's' ? 'stone' : 'mixed' }); }
// more roads, routed through the towns by name so they really connect them
{ const CP = {}; for (const c of CITIES) CP[c.name.replace(/’/g, "'")] = [c.lon, c.lat]; const via = (...a) => a.map(v => typeof v === 'string' ? (CP[v] || console.warn('no place', v) || [35, 31.5]) : v);
  const add = (cls, num, ...a) => { ROADS.push([cls, via(...a)]); ROADNUM[ROADS.length - 1] = num; };
  add(1, '232', 'Sderot', 'Mefalsim', 'Kfar Aza', "Sa'ad", "Be'eri", "Re'im", 'Urim', 'Magen', 'Nir Yitzhak', 'Kerem Shalom');
  add(1, '3', 'Ashkelon', 'Kiryat Malakhi', [34.88, 31.80], 'Latrun', "Modi'in");
  add(1, '35', 'Ashkelon', 'Kiryat Gat', [34.95, 31.60], 'Hebron'); add(1, '57', 'Netanya', 'Kfar Yona', 'Tulkarm', [35.15, 32.28], 'Nablus');
  add(1, '55', 'Kfar Saba', 'Qalqilya', 'Karnei Shomron', 'Nablus'); add(1, '444', 'Rosh HaAyin', 'Tira', 'Tayibe', 'Baqa al-Gharbiyye');
  add(1, '70', "Zikhron Ya'akov", 'Yokneam', "Kiryat Tiv'on", 'Shefa-Amr', 'Tamra', 'Kabul', [35.16, 33.0], 'Shlomi'); add(1, '66', 'Yokneam', 'Megiddo', 'Jenin');
  add(1, '77', 'Ramat Yishai', [35.30, 32.765], 'Kafr Kanna', "Tur'an", [35.47, 32.785], 'Tiberias'); add(1, '79', 'Kiryat Bialik', 'Shefa-Amr', 'Nazareth');
  add(1, '89', 'Nahariya', "Ma'alot", 'Hurfeish', [35.44, 33.0], 'Safed'); add(1, '91', 'Rosh Pina', [35.63, 33.01], [35.72, 33.05], 'Merom Golan');
  add(1, '92', 'Degania', 'Ein Gev', 'Ramot', [35.645, 32.90]); add(1, '87', 'Capernaum', [35.64, 32.93], 'Katzrin'); add(1, '65', 'Afula', 'Kfar Tavor', [35.45, 32.76], 'Maghar');
  add(1, '204', 'Dimona', 'Yeruham', 'Sde Boker'); add(1, '211', 'Nitzana', [34.55, 30.91], 'Ashalim', 'Yeruham'); add(1, '222', "Tze'elim", 'Revivim', 'Ashalim');
  add(1, '12', 'Eilat', [34.88, 29.62], [34.84, 29.80], [34.93, 29.96]); add(1, '60', 'Beer Sheva', 'Meitar', 'ad-Dhahiriya', 'Hebron'); add(1, '31', 'Lehavim', 'Hura', 'Kuseife', 'Arad');
  add(1, '375', 'Beit Shemesh', 'Tzur Hadassa', 'Beitar Illit', 'Bethlehem'); add(1, '1', 'Jerusalem', 'Mevaseret Zion', 'Abu Ghosh', [35.04, 31.82], 'Latrun');
  add(1, '458', "Ma'ale Adumim", 'Kfar Adumim', [35.33, 31.95], 'Shilo'); add(1, '90', 'Jericho', "Fasa'el", 'Argaman', 'Mehola', 'Sde Eliyahu', "Beit She'an");
  add(1, '90', 'Kalia', 'Mitzpe Shalem', 'Ein Gedi'); add(1, '90', 'Hatzeva', 'Ein Yahav', 'Sapir', 'Tzofar', 'Paran', [35.10, 30.12], 'Ketura', 'Yotvata');
  add(1, '35', 'Aqaba', [35.25, 29.80], 'Petra', 'Shobak', 'Tafila', 'Karak'); add(1, '35', 'Amman', 'Jerash', 'Irbid'); add(1, '30', 'Amman', 'Salt', [35.62, 32.08]); add(1, '', 'Tyre', 'Naqoura', 'Shlomi');
  add(1, '98', 'Majdal Shams', "Mas'ade", "Buq'ata", 'Merom Golan', 'Quneitra'); add(1, '', 'Gaza', 'Nuseirat', 'Deir al-Balah', 'Khan Yunis'); add(1, '', 'Rafah', 'Sheikh Zuweid', 'El Arish'); }

const GEO_LABELS = [['הר חרמון', 'Mount Hermon', 35.86, 33.42, 500], ['הכנרת', 'Sea of Galilee', 35.59, 32.82, 250], ['הר תבור', 'Mount Tabor', 35.39, 32.687, 300], ['עמק יזרעאל', 'Jezreel Valley', 35.25, 32.62, 500], ['הכרמל', 'Mount Carmel', 35.05, 32.72, 350],
  ['נהלל', 'Nahalal', 35.197, 32.69, 250], ['נתב״ג', 'Ben Gurion Airport', 34.885, 32.005, 300], ['מדבר יהודה', 'Judean Desert', 35.36, 31.60, 500], ['ים המלח', 'Dead Sea', 35.47, 31.52, 350], ['מצדה', 'Masada', 35.354, 31.316, 560],
  ['מכתש רמון', 'Makhtesh Ramon', 34.92, 30.60, 500], ['הערבה', 'The Arava', 35.17, 30.35, 500], ['מפרץ אילת', 'Gulf of Eilat', 34.96, 29.50, 300], ['רמת הגולן', 'Golan Heights', 35.78, 32.98, 500], ['עמק החולה', 'Hula Valley', 35.61, 33.10, 350],
  ['הגלבוע', 'Mount Gilboa', 35.41, 32.47, 400], ['הנגב', 'The Negev', 34.75, 30.95, 600], ['הירדן', 'Jordan River', 35.555, 32.25, 300], ['ראש הנקרה', 'Rosh HaNikra', 35.105, 33.09, 250], ['הרודיון', 'Herodium', 35.241, 31.666, 350]];
const LABELS = [];
function buildLabels() {
  const mk = (he, en, lon, lat, up, far, gold, pop) => { const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d'); x.textAlign = 'center'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,.85)';
    // quiet names: a soft shadow instead of a heavy black outline, so they do not shout over the picture
    x.shadowColor = 'rgba(8,16,34,.75)'; x.shadowBlur = 7; x.shadowOffsetY = 1; x.strokeStyle = 'rgba(8,16,34,.35)';
    x.font = '600 31px Arial, "Arial Hebrew", "Noto Sans Hebrew", sans-serif'; x.lineWidth = 2; x.strokeText(he, 128, 36); x.fillStyle = gold ? 'rgba(255,215,106,.95)' : 'rgba(255,255,255,.93)'; x.fillText(he, 128, 36); x.fillText(he, 128, 36);
    x.font = '15px Arial, sans-serif'; x.lineWidth = 1.5; x.fillStyle = gold ? 'rgba(243,226,174,.75)' : 'rgba(223,232,238,.72)'; x.fillText(en, 128, 62); x.fillText(en, 128, 62);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Object.assign(new THREE.CanvasTexture(c), { generateMipmaps: false, minFilter: THREE.LinearFilter }), transparent: true, depthWrite: false, fog: false, sizeAttenuation: false })), px = lon2x(lon), pz = lat2z(lat);
    s.scale.set(0.2, 0.0625, 1); s.position.set(px, groundAt(px, pz).h + up, pz); s.visible = false; scene.add(s); LABELS.push({ s, far, pop: pop || 100 }); };
  // Names in the sky: only towns of 80,000 people and more, seen from far (6 to 20 km of game world, which is 24 to 80 km of real ground: the map is compressed 4:1).
  for (const l of LOCS) if (l[4] >= 80) mk(l[0], l[1], l[2], l[3], 300 + Math.sqrt(l[4]) * 22, clamp(6000 + l[4] * 30, 8000, 20000), false, l[4]);
}
/** Which names show: at most four, the towns that lie ahead along the direction of flight (within 65 degrees of it; the town right below counts too),
    the nearest and most nearly straight ahead first. A name that would overlap one already shown, or sit under the readouts, is left out. */
function updateLabels() {
  const on = S.names && S.started && !PH.on && TNOW - (S.spawnT || 0) >= 1.5 && Math.abs(S.bank) < 0.8;          // none in the first moments of a flight or in a steep turn
  const pm = camera.projectionMatrix.elements, hw = 0.2 * pm[0] / 2 + 0.01, hh = 0.0625 * pm[5] / 2 + 0.01, shown = [], cand = [];
  const vh = Math.hypot(S.vel.x, S.vel.z), fx = vh > 3 ? S.vel.x / vh : Math.sin(S.hdg * DEG), fz = vh > 3 ? S.vel.z / vh : -Math.cos(S.hdg * DEG);
  for (const l of LABELS) { l.s.visible = false; if (!on) continue; const dx = l.s.position.x - S.pos.x, dz = l.s.position.z - S.pos.z, d = Math.hypot(dx, dz); if (d > l.far) continue;
    const off = d < 2500 ? 0 : Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1)); if (off > 65 * DEG) continue; cand.push([d * (1 + 1.6 * (off / (65 * DEG)) ** 2) / (0.6 + Math.min(l.pop, 500) / 250), l, d]); }          /* a big city comes before a smaller neighbour whose name would cover it */
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, l, d] of cand) { if (shown.length >= 4) break; const p = tmpV.copy(l.s.position).project(camera); if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) continue;
    if (Math.abs(p.x) < 0.45 && p.y > 0.62) continue;                                                        // not under the readouts at the top
    if (shown.some(q => Math.abs(q.x - p.x) < 2 * hw && Math.abs(q.y - p.y) < 2 * hh)) continue; shown.push({ x: p.x, y: p.y });
    l.s.visible = true; l.s.material.opacity = clamp((l.far - d) / (l.far * 0.12), 0, 1) * 0.95; }
}
const RAIL = { paths: [], trains: [], mesh: null };
// the coast line from Nahariya to Beer Sheva, and the fast line up to Jerusalem
const RAIL_LINES = [[[35.095, 33.0], [35.085, 32.925], [35.095, 32.86], [35.0, 32.795], [34.962, 32.70], [34.943, 32.58], [34.898, 32.44], [34.862, 32.30], [34.812, 32.17], [34.80, 32.08], [34.80, 32.0], [34.84, 31.925], [34.82, 31.89], [34.70, 31.79], [34.61, 31.68], [34.63, 31.50], [34.70, 31.36], [34.785, 31.265]], [[34.84, 31.925], [34.92, 31.89], [35.0, 31.85], [35.10, 31.80], [35.19, 31.79]]];
function buildIsrael() {
  const lam = c => new THREE.MeshLambertMaterial({ color: c }), put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; }, R = rng(2026);
  const inst = (geo, list, s) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(1, 1, 1);
    list.forEach((b, i) => { e.set(0, b[3] || 0, 0); q.setFromEuler(e); m4.compose(tmpV.set(b[0], b[1], b[2]), q, tmpV2.set(b[4] || s[0], b[5] || s[1], b[6] || s[2])); m.setMatrixAt(i, m4); m.setColorAt(i, col); }); m.frustumCulled = false; scene.add(m); return m; };
  // --- minarets and domes in Arab towns ---
  const ARAB = new Set(['Nazareth', 'Acre', 'Umm al-Fahm', 'Sakhnin', 'Shefa-Amr', 'Rahat', 'Jericho', 'Bethlehem', 'Hebron', 'Ramallah', 'Nablus', 'Jenin', 'Tulkarm', 'Qalqilya', 'Gaza', 'Khan Yunis', 'Rafah', 'Aqaba', 'Amman', 'Irbid', 'Madaba', 'Karak', 'Tyre', 'Quneitra']);
  const mins = [], domes = [];
  for (const c of CITIES) { if (!ARAB.has(c.name)) continue; const n = clamp(Math.round(c.n / 22), 2, 12), cx = lon2x(c.lon), cz = lat2z(c.lat);
    for (let i = 0; i < n; i++) { const a = R() * 6.283, r = c.r * 0.8 * Math.sqrt(R()), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, g = groundAt(x, z); if (g.water || airfieldAt(x, z, 22) || nearRoad(x, z, 22) || landmarkAt(x, z, 12) || obstBox(x, z, 3, 3)) continue; mins.push([x, g.h - 2, z]); domes.push([x + 12, g.h + 9, z + 6]); } }
  // Jaffa and East Jerusalem get a few too
  for (const [lo, la] of [[34.752, 32.052], [34.755, 32.049], [35.236, 31.781], [35.228, 31.787], [35.242, 31.775]]) { const x = lon2x(lo), z = lat2z(la), g = groundAt(x, z); if (!g.water) { mins.push([x, g.h, z]); domes.push([x + 12, g.h + 9, z + 6]); } }
  inst(GEO.minaret, mins, [42, 42, 42]);
  inst(mergeGeo([[new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0.62, 0.72, 0.66], [new THREE.BoxGeometry(2.6, 1.2, 2.6).translate(0, -0.6, 0), 0.9, 0.86, 0.76]]), domes, [8, 8, 8]);
  // --- Tel Aviv: hotel wall along the beach, breakwaters, Jaffa's hill and clock tower, the Kirya antenna tower ---
  const slab = windowize(lam(0xe9e6de)), rock = lam(0x4a4d50), stone = lam(0xd9c79f), rockF = new THREE.MeshLambertMaterial({ color: 0x6b6258, flatShading: true });
  for (let i = 0; i < 12; i++) { const lat = 32.062 + i * 0.0042, x = lon2x(coastLon(lat) + 0.0075), z = lat2z(lat), h = 55 + R() * 55; if (!groundAt(x, z).water) put(new THREE.BoxGeometry(24, h, 62), slab, x, heightAt(x, z) + h / 2 - 3, z).rotation.y = 0.25;
    { const g = new THREE.CylinderGeometry(8, 8, 84, 9, 10).rotateX(Math.PI / 2), p = g.attributes.position;          /* a detached breakwater is a low mound of boulders, not a slab */
      for (let k = 0; k < p.count; k++) { const e = 1 - Math.pow(Math.abs(p.getZ(k)) / 42, 4); p.setXYZ(k, p.getX(k) * (0.75 + R() * 0.5) * (0.35 + 0.65 * e), p.getY(k) * 0.34 * (0.7 + R() * 0.6) * (0.3 + 0.7 * e), p.getZ(k) + (R() - 0.5) * 5); }
      g.computeVertexNormals(); put(g, rockF, lon2x(coastLon(lat) - 0.0065), 0.1, z).rotation.y = 0.3; } }
  { const x = lon2x(34.754), z = lat2z(32.0535), y = heightAt(x, z); for (let i = 0; i < 46; i++) { const a = R() * 6.283, r = 190 * Math.sqrt(R()), w = 14 + R() * 14, h = 10 + R() * 12 + (190 - r) * 0.08, bx = x + Math.cos(a) * r + 60, bz = z + Math.sin(a) * r; if (!nearRoad(bx, bz, w * 0.71)) put(new THREE.BoxGeometry(w, h, w), stone, bx, y + 8, bz); }
    put(new THREE.BoxGeometry(7, 34, 7), stone, x + 150, y + 17, z - 120); put(new THREE.ConeGeometry(6, 9, 4), lam(0x8a4a3a), x + 150, y + 38, z - 120);
    const kx = lon2x(34.787), kz = lat2z(32.073), ky = heightAt(kx, kz); put(new THREE.BoxGeometry(16, 110, 16), lam(0xbfc4c8), kx, ky + 55, kz); put(new THREE.CylinderGeometry(0.8, 2.5, 34, 6), lam(0xd8443a), kx, ky + 127, kz); }
  // --- Jerusalem: Knesset, Shrine of the Book, the Chords Bridge mast, Mount Scopus tower ---
  { const jx = lon2x(35.21), jz = lat2z(31.78), at = (dx, dz) => heightAt(jx + dx, jz + dz), cream = lam(0xe6dcc0), white = lam(0xf4f2ec);
    put(new THREE.BoxGeometry(110, 20, 95), cream, jx - 820, at(-820, 60) + 10, jz + 60); put(new THREE.BoxGeometry(128, 5, 112), cream, jx - 820, at(-820, 60) + 23, jz + 60);
    put(new THREE.SphereGeometry(20, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), white, jx - 1010, at(-1010, 260) + 6, jz + 260).scale.set(1, 1.25, 1); put(new THREE.BoxGeometry(8, 22, 46), lam(0x1d1f22), jx - 960, at(-960, 260) + 11, jz + 260);
    const mast = put(new THREE.CylinderGeometry(1.2, 3, 118, 8), white, jx - 1500, at(-1500, -250) + 56, jz - 250); mast.rotation.z = 0.32;
    for (let i = 0; i < 9; i++) { const cb = put(new THREE.CylinderGeometry(0.35, 0.35, 120, 4), white, jx - 1500 + 30 + i * 6, at(-1500, -250) + 46, jz - 250 + (i - 4) * 10); cb.rotation.z = 0.95; cb.rotation.y = (i - 4) * 0.09; }
    put(new THREE.BoxGeometry(12, 62, 12), cream, jx + 760, at(760, -1150) + 31, jz - 1150); }
  // --- Haifa: university tower on the Carmel ridge, the Sail Tower downtown; Eilat: hotel strip and the reef observatory ---
  { const x = lon2x(35.02), z = lat2z(32.762); put(new THREE.BoxGeometry(34, 102, 34), windowize(lam(0x8f9499)), x, heightAt(x, z) + 51, z); const sx = lon2x(35.0), sz = lat2z(32.812); put(new THREE.CylinderGeometry(14, 22, 110, 3), windowize(lam(0xbdd3e2)), sx, heightAt(sx, sz) + 55, sz);
    for (let i = 0; i < 8; i++) { const ex = lon2x(34.953 + i * 0.0032), ez = lat2z(29.5535 - (i % 2) * 0.0012), h = 30 + R() * 26; if (!groundAt(ex, ez).water && !nearRoad(ex, ez, 27)) put(new THREE.BoxGeometry(46, h, 26), slab, ex, heightAt(ex, ez) + h / 2 - 2, ez); }
    const ox = lon2x(34.922), oz = lat2z(29.505); if (groundAt(ox, oz).water) { put(new THREE.CylinderGeometry(5, 7, 26, 12), lam(0xf1f1ec), ox, 11, oz); put(new THREE.CylinderGeometry(11, 11, 4, 16), lam(0xf1f1ec), ox, 24, oz); } }
  // --- Nahalal: the circular moshav, houses on a ring with farm plots radiating out ---
  { const cx = lon2x(35.197), cz = lat2z(32.69), list = [], y0 = triHeight(cx, cz);
    for (let i = 0; i < 76; i++) { const a = i / 76 * 6.283, x = cx + Math.cos(a) * 430, z = cz + Math.sin(a) * 430; if (!nearRoad(x, z, 12)) list.push([x, triHeight(x, z) - 1, z, -a, 15, 11, 12]); }
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, x = cx + Math.cos(a) * 150, z = cz + Math.sin(a) * 150; if (!nearRoad(x, z, 15)) list.push([x, triHeight(x, z) - 1, z, -a, 22, 12, 16]); }
    inst(GEO.house, list, [14, 10, 12]); const ring = put(new THREE.RingGeometry(380, 396, 72), lam(0x55575a), cx, y0 + 2.4, cz); ring.rotation.x = -Math.PI / 2;
    const sp = []; for (let i = 0; i < 38; i++) { const a = i / 38 * 6.283, r = 800, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if ([-380, -190, 0, 190, 380].some(o => nearRoad(x + Math.cos(a) * o, z + Math.sin(a) * o, 3))) continue; sp.push([x, triHeight(x, z) + 1.2, z, -a, 760, 0.8, 4]); } inst(GEO.stone, sp, [1, 1, 1]).material.color.setHex(0x3f5a2c);
    put(GEO.tower, new THREE.MeshLambertMaterial({ vertexColors: true }), cx, y0, cz).scale.set(13, 28, 13); }
  // --- centre-pivot irrigation circles in the north-western Negev ---
  { const P = [], C = [], col = new THREE.Color(), pal = [0x4f8a3a, 0x67a046, 0x3f7430, 0x8a9a4a, 0x7a6a48];
    for (let t = 0; t < 400 && P.length < 60 * 24 * 9; t++) { const lon = 34.40 + R() * 0.42, lat = 31.16 + R() * 0.32, x = lon2x(lon), z = lat2z(lat), r = 150 + R() * 90, g = groundAt(x, z); if (g.water || airfieldAt(x, z, r) || ZONE[zoneAt(x, z) + 2] > 0.1 || nearRoad(x, z, r)) continue;
      const hs = [triHeight(x + r, z), triHeight(x - r, z), triHeight(x, z + r), triHeight(x, z - r)], hi = Math.max(...hs), lo = Math.min(...hs); if (hi - lo > 7) continue; col.setHex(pal[(R() * pal.length) | 0]); const y = hi + 1.6;
      for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, b = (k + 1) / 24 * 6.283, sh = 0.85 + 0.15 * ((k >> 1) % 2); P.push(x, y, z, x + Math.cos(b) * r, y, z + Math.sin(b) * r, x + Math.cos(a) * r, y, z + Math.sin(a) * r); for (let v = 0; v < 3; v++) C.push(col.r * sh, col.g * sh, col.b * sh); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.frustumCulled = false; scene.add(m); }
  // --- railways: the coast line from Nahariya to Beer Sheva and the fast line up to Jerusalem, with red trains ---
  const P = [], N = [], I = [];
  for (const D of railLines()) {
    let prev = -1, path = [];
    for (let i = 0; i < D.length; i++) { const a = D[Math.max(i - 1, 0)], b = D[Math.min(i + 1, D.length - 1)], [px, pz] = D[i], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / tl, nz = (b[0] - a[0]) / tl, g = groundAt(px, pz);
      if (g.water || airfieldAt(px, pz, 5)) { prev = -1; if (path.length > 30) RAIL.paths.push(path); path = []; continue; }
      const k = P.length / 3; for (const s of [-1, 1]) { const vx = px + nx * 5 * s, vz = pz + nz * 5 * s; P.push(vx, Math.max(triHeight(vx, vz), triHeight(px, pz)) + 3, vz); N.push(0, 1, 0); }
      if (prev >= 0) I.push(prev, prev + 1, k, prev + 1, k + 1, k); prev = k; path.push([px, triHeight(px, pz) + 5.2, pz]); }
    if (path.length > 30) RAIL.paths.push(path); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); rg.setIndex(I);
  const rm = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: 0x5a4a3c, side: THREE.DoubleSide })); rm.frustumCulled = false; scene.add(rm);
  const cars = 6, nT = 8; RAIL.mesh = new THREE.InstancedMesh(GEO.stone, new THREE.MeshLambertMaterial({ vertexColors: true }), nT * cars); RAIL.mesh.frustumCulled = false; scene.add(RAIL.mesh);
  for (let t = 0; t < nT; t++) { const p = RAIL.paths[t % RAIL.paths.length]; RAIL.trains.push({ p, s: R() * (p.length - 2), v: (t % 2 ? -1 : 1) * 42 / 45 }); for (let c = 0; c < cars; c++) RAIL.mesh.setColorAt(t * cars + c, new THREE.Color(c === 0 ? 0xd2372f : 0xdfe3e6)); }
}
function updateTrains(dt) {
  const cars = 6, m4 = tmpM, e = scatter.e;
  RAIL.trains.forEach((tr, t) => { const m = tr.p.length - 1; tr.s += tr.v * dt; if (tr.s >= m) tr.s -= m; else if (tr.s < 0) tr.s += m;
    for (let c = 0; c < cars; c++) { const s = tr.s - Math.sign(tr.v) * c * 0.6, ok = s > 0 && s < m - 1, k = ok ? s | 0 : 0, f = ok ? s - k : 0, a = tr.p[k], b = tr.p[k + 1];
      e.set(0, Math.atan2(b[0] - a[0], b[2] - a[2]), 0); tmpQ.setFromEuler(e); m4.compose(tmpV.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 2, a[2] + (b[2] - a[2]) * f), tmpQ, tmpV2.set(ok ? 3.6 : 0, 4.2, 25)); RAIL.mesh.setMatrixAt(t * cars + c, m4); } });
  RAIL.mesh.instanceMatrix.needsUpdate = true;
}

/** Streams draped on the terrain: perennial rivers in blue over a green bank, desert wadis as pale gravel beds. */
let DIAMOND = null;
function buildRivers() {
  // a strip per water course: for a river a green bank and the water on it, at its real width; for a dry stream bed pale gravel. Where a line runs
  // into the sea or a lake it stops; roads are laid higher, so a road that crosses reads as a bridge
  const mk = (pick, wid, yo, color) => { const P = [], N = [], I = [];
    for (const r of riverLines()) { if (!pick(r)) continue; const D = r.D, hw = wid(r); let prev = -1;
      for (let i = 0; i < D.length; i++) { const a = D[Math.max(i - 1, 0)], b = D[Math.min(i + 1, D.length - 1)], [px, pz] = D[i], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / tl, nz = (b[0] - a[0]) / tl, g = groundAt(px, pz);
        if (g.water || g.field || airfieldAt(px, pz, hw)) { prev = -1; continue; } const k = P.length / 3;
        for (const s of [-1, 1]) { const vx = px + nx * hw * s, vz = pz + nz * hw * s; P.push(vx, Math.max(triHeight(vx, vz), triHeight(px, pz)) + yo, vz); N.push(0, 1, 0); }
        if (prev >= 0) I.push(prev, prev + 1, k, prev + 1, k + 1, k); prev = k; } }
    if (!I.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })); m.frustumCulled = false; m.matrixAutoUpdate = false; scene.add(m); };
  mk(r => !r.dry, r => r.hw + 7, 1.1, 0x4a6034); mk(r => !r.dry, r => r.hw, 1.6, 0x3d6f7c); mk(r => r.dry, r => r.hw, 1.2, 0xdccba4);
  // Ramat Gan's Diamond Exchange tower, the tallest thing on the Tel Aviv skyline for years
  let tx = lon2x(34.803), tz = lat2z(32.084); for (let k = 0, done = false; k <= 6 && !done; k++) for (let q = 0; q < (k ? 8 : 1); q++) { const px = lon2x(34.803) + Math.cos(q * 0.785) * k * 22, pz = lat2z(32.084) + Math.sin(q * 0.785) * k * 22; if (!nearRoad(px, pz, 24)) { tx = px; tz = pz; done = true; break; } }          /* off the road it used to stand on */
  DIAMOND = [tx, tz]; const tw = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 235, 20), windowize(new THREE.MeshPhongMaterial({ color: 0x9fb4c4, shininess: 100 }))); tw.position.set(tx, heightAt(tx, tz) + 117, tz); scene.add(tw);
}
