'use strict';
// ---------- 5. Three.js scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
/** Render resolution follows the device and the frame rate: it starts at the screen's own pixel density (up to 2×) and steps down only while
    frames run slow, back up when there is time to spare (`autoRes` in the main loop). `?res=1.5` in the address pins it. */
const RES = { max: Math.min(window.devicePixelRatio || 1, 2), min: Math.min(window.devicePixelRatio || 1, 0.75), pr: 1, acc: 0, n: 0, hold: 0, cap: 9, slow: 0, fixed: +(new URLSearchParams(location.search).get('res')) || 0 };
RES.pr = RES.fixed || Math.min(RES.max, 1.75); renderer.setPixelRatio(RES.pr);
/** The player's graphics choice (settings): 0 automatic (resolution follows the frame rate), 1 fast (one screen pixel per pixel at most, no post pass),
    2 best (the screen's full density, pinned). */
function applyGfx(g) {
  DET.lvl = Math.min(DET.lvl, 3); RES.user = g | 0; POST.on = POST.url && g !== 1; const pr = RES.fixed || (g === 1 ? Math.min(1, RES.max) : g === 2 ? RES.max : Math.min(RES.max, 1.75));
  if (pr !== RES.pr) { RES.pr = pr; renderer.setPixelRatio(pr); resize(); }
}
/**
 * The detail governor. Measured on the owner's phone: with the extras for capable devices (building shadows on the ground, longer draw distances,
 * thick forests) and the full pixel density, some places hold 60 frames a second and some fall to 30, and the change between the two is felt as
 * jumps. So when 45 frames average over 19.5 ms the extras are given back one at a time, cheapest loss first: the building shadows, then the draw
 * distance (to 75%, then 55%, with the thick forests), and last, in the "best" graphics setting, the pixel density in quarter steps down to 1.5.
 * One way only for the visit: going back up would be the same jumping again. The automatic resolution (`autoRes`, from 27 ms) comes after it.
 */
const DET = { lvl: 0, far: 1, acc: 0, n: 0, hold: 120 };
function autoDetail(ms) {
  if (ms > 250 || document.hidden || DET.lvl >= 5 || (typeof PERF !== 'undefined' && PERF.busy)) return; if (DET.hold > 0) { DET.hold--; return; }
  DET.acc += ms; if (++DET.n < 45) return; const avg = DET.acc / DET.n; DET.acc = DET.n = 0; if (avg < 19.5) return;
  DET.lvl++; DET.hold = 60;
  if (DET.lvl === 1) { if (TERRAIN_MAT && TERRAIN_MAT.uniforms.uBS.value) { TERRAIN_MAT.uniforms.uBS.value = 0; return; } DET.lvl = 2; }
  if (DET.lvl === 2) DET.far = 0.75;
  else if (DET.lvl === 3) { DET.far = 0.55; if (typeof scatter !== 'undefined' && scatter) scatter.x = 1e9; }
  else if (RES.user === 2 && !RES.fixed && RES.pr > 1.5) { RES.pr = Math.max(1.5, RES.pr - 0.25); renderer.setPixelRatio(RES.pr); resize(); if (RES.pr > 1.5) DET.lvl = 3; }
}
function autoRes(ms) {
  if (RES.fixed || RES.user || ms > 250 || document.hidden) return; RES.acc += ms; if (++RES.n < 45) return; const avg = RES.acc / RES.n; RES.acc = RES.n = 0; if (RES.hold > 0) RES.hold--;
  let pr = RES.pr; if (avg > 30 && pr <= RES.min && POST.on && ++RES.slow > 3) POST.on = false;
  if (avg > 27 && pr > RES.min) { pr = Math.max(RES.min, pr - 0.25); RES.cap = pr; RES.hold = 12; } else if (avg < 14.5 && pr < Math.min(RES.max, RES.cap + (RES.hold ? 0 : 0.25)) && !RES.hold) { pr = Math.min(RES.max, pr + 0.25); RES.hold = 4; }
  if (pr !== RES.pr) { RES.pr = pr; renderer.setPixelRatio(pr); resize(); }
}
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb8d3ee, 0.000028);
/* Built-in materials (buildings, roads, aircraft, sprites) get the same height-aware, blue-shifting haze and the same soft highlight shoulder as the
   terrain and water shaders, by replacing three.js's fog and tone-mapping chunks once, before any material is compiled. */
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float fogDepth; varying float vFogY;\n#endif';
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n fogDepth = length(mvPosition.xyz); vFogY = cameraPosition.y + dot(mvPosition.xyz, vec3(viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y));\n#endif';
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float fogDepth; varying float vFogY;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif';
THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n #ifdef FOG_EXP2\n { float a=(cameraPosition.y+450.0)/1800.0, b=(vFogY+450.0)/1800.0, dd=b-a; float f=abs(dd)<0.02?exp(-a):(exp(-a)-exp(-b))/dd; float k=fogDensity*fogDepth*f*1.45; vec3 T=exp(-k*k*vec3(0.8,1.0,1.35)); gl_FragColor.rgb=gl_FragColor.rgb*T+fogColor*(1.0-T); }\n #else\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, fogDepth));\n #endif\n#endif';
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }', 'vec3 CustomToneMapping( vec3 color ) { vec3 t=max(color-0.55,0.0); vec3 c=min(color,vec3(0.55))+t/(1.0+1.6*t); { float l=dot(c,vec3(0.30,0.59,0.11)); c=mix(vec3(l),c,1.15); c=mix(c,c*c*(3.0-2.0*c),0.35); c+=vec3(-0.010,0.004,0.022)*(1.0-smoothstep(0.0,0.35,l))+vec3(0.018,0.006,-0.020)*smoothstep(0.45,0.9,l); c=max(c,vec3(0.0)); } return c; }');
renderer.toneMapping = THREE.CustomToneMapping;
const HAZE_GLSL = `
  // shared look: haze that thins with height and shifts blue with distance, warm toward a low sun; and a soft shoulder so bright ground does not clip
  float hazeK(float d, float y0, float y1, float den){ float a=(y0+450.0)/1800.0, b=(y1+450.0)/1800.0, dd=b-a; float f=abs(dd)<0.02?exp(-a):(exp(-a)-exp(-b))/dd; return den*d*f*1.45; }
  vec3 hazeCol(vec3 base, vec3 vd, vec3 sdir, vec3 scol){ float low=clamp(1.0-sdir.y*1.6,0.0,1.0); float s=max(dot(normalize(vd.xz+vec2(1e-5)),normalize(sdir.xz+vec2(1e-5))),0.0);
    return base*mix(vec3(1.0),vec3(0.84,0.92,1.10),low*(1.0-s)*0.7)+scol*0.22*low*s*s*s; }
  // the final grade, the same in every shader: a little more colour, a gentle S-curve, blue-teal shadows and warm highlights
  vec3 toneC(vec3 c){ vec3 t=max(c-0.55,0.0); c=min(c,vec3(0.55))+t/(1.0+1.6*t); { float l=dot(c,vec3(0.30,0.59,0.11)); c=mix(vec3(l),c,1.15); c=mix(c,c*c*(3.0-2.0*c),0.35); c+=vec3(-0.010,0.004,0.022)*(1.0-smoothstep(0.0,0.35,l))+vec3(0.018,0.006,-0.020)*smoothstep(0.45,0.9,l); c=max(c,vec3(0.0)); } return c; }
`;
const camera = new THREE.PerspectiveCamera(60, 1, 1, 260000);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1); scene.add(sun);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); postSize(); camera.aspect = w / h; camera.fov = w < h ? 74 : 60; camera.updateProjectionMatrix();
}
/** Post pass: the frame is drawn into a (multisampled) target, its bright parts are blurred at a quarter and an eighth of the size and added back
    (bloom: lamps, the sun on water and glass, the afterburner glow), with a light sharpen. Off with `?post=0`, and switched off by itself on a
    device that stays slow at the lowest resolution. */
const POST = { on: new URLSearchParams(location.search).get('post') !== '0', ok: false, k: 1 }; POST.url = POST.on;
function postSetup() {
  try {
    const gl2 = renderer.capabilities.isWebGL2, mk = (ms) => { const t = ms && gl2 ? new THREE.WebGLMultisampleRenderTarget(4, 4, { depthBuffer: true }) : new THREE.WebGLRenderTarget(4, 4, { depthBuffer: !!ms }); t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter; t.texture.generateMipmaps = false; return t; };
    POST.main = mk(true); POST.a = [mk(), mk()]; POST.b = [mk(), mk()];
    POST.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); POST.scene = new THREE.Scene();
    const vs = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';
    const mat = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false, toneMapped: false });
    POST.bright = mat('uniform sampler2D t; uniform vec2 px; varying vec2 vUv; vec3 b(vec2 o){ vec3 c=texture2D(t,vUv+o*px).rgb; float l=max(c.r,max(c.g,c.b)); return c*smoothstep(0.86,1.0,l); } void main(){ gl_FragColor=vec4((b(vec2(-1.0,-1.0))+b(vec2(1.0,-1.0))+b(vec2(-1.0,1.0))+b(vec2(1.0,1.0)))*0.25,1.0); }', { t: { value: null }, px: { value: new THREE.Vector2() } });
    POST.blur = mat('uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 c=texture2D(t,vUv).rgb*0.227; c+=(texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*0.316; c+=(texture2D(t,vUv+d*3.231).rgb+texture2D(t,vUv-d*3.231).rgb)*0.0703; gl_FragColor=vec4(c,1.0); }', { t: { value: null }, d: { value: new THREE.Vector2() } });
    POST.mix = mat('uniform sampler2D t; uniform sampler2D b1; uniform sampler2D b2; uniform vec2 px; uniform float k; varying vec2 vUv; void main(){ vec3 c=texture2D(t,vUv).rgb; vec3 n=(texture2D(t,vUv+vec2(px.x,0.0)).rgb+texture2D(t,vUv-vec2(px.x,0.0)).rgb+texture2D(t,vUv+vec2(0.0,px.y)).rgb+texture2D(t,vUv-vec2(0.0,px.y)).rgb)*0.25; c=max(c+(c-n)*0.22,vec3(0.0)); vec3 bl=texture2D(b1,vUv).rgb*0.75+texture2D(b2,vUv).rgb*0.95; gl_FragColor=vec4(c+bl*k*(1.0-c*0.35),1.0); }', { t: { value: null }, b1: { value: null }, b2: { value: null }, px: { value: new THREE.Vector2() }, k: { value: 1 } });
    POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), POST.bright); POST.quad.frustumCulled = false; POST.scene.add(POST.quad);
    POST.ok = true; postSize();
  } catch (e) { POST.ok = false; }
}
function postSize() {
  if (!POST.ok) return; const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(8, v.x | 0), h = Math.max(8, v.y | 0);
  POST.main.setSize(w, h); for (const t of POST.a) t.setSize(w >> 2 || 2, h >> 2 || 2); for (const t of POST.b) t.setSize(w >> 3 || 2, h >> 3 || 2);
}
function postPass(m, src, dst) { POST.quad.material = m; m.uniforms.t.value = src.texture; renderer.setRenderTarget(dst); renderer.render(POST.scene, POST.cam); }
/** Draw one frame, through the post pass when it is on. */
function renderFrame() {
  if (!POST.on || !POST.ok) { renderer.render(scene, camera); return; }
  const M = POST.main, A = POST.a, B = POST.b;
  renderer.setRenderTarget(M); renderer.render(scene, camera);
  POST.bright.uniforms.px.value.set(1 / M.width, 1 / M.height); postPass(POST.bright, M, A[0]);
  POST.blur.uniforms.d.value.set(1 / A[0].width, 0); postPass(POST.blur, A[0], A[1]); POST.blur.uniforms.d.value.set(0, 1 / A[0].height); postPass(POST.blur, A[1], A[0]);
  POST.blur.uniforms.d.value.set(1 / B[0].width, 0); postPass(POST.blur, A[0], B[0]); POST.blur.uniforms.d.value.set(0, 1 / B[0].height); postPass(POST.blur, B[0], B[1]);
  POST.blur.uniforms.d.value.set(1.6 / B[0].width, 0); postPass(POST.blur, B[1], B[0]); POST.blur.uniforms.d.value.set(0, 1.6 / B[0].height); postPass(POST.blur, B[0], B[1]);
  const u = POST.mix.uniforms; u.b1.value = A[0].texture; u.b2.value = B[1].texture; u.px.value.set(1 / M.width, 1 / M.height); u.k.value = POST.k; postPass(POST.mix, M, null);
}
window.addEventListener('resize', resize); resize(); postSetup();

// Procedural tileable noise texture (used for ground grain and water ripples)
function noiseTexture(size, cells, lo, hi, oct) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), im = x.createImageData(size, size);
  const pn = (u, v, p) => { const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, a = fu * fu * (3 - 2 * fu), b = fv * fv * (3 - 2 * fv);
    const H = (ii, jj) => hash2(((ii % p) + p) % p + p * 7, ((jj % p) + p) % p + p * 13);
    return lerp(lerp(H(i, j), H(i + 1, j), a), lerp(H(i, j + 1), H(i + 1, j + 1), a), b); };
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let n = 0, a = 0.5, f = cells, t = 0;
    for (let o = 0; o < oct; o++) { n += a * pn(px / size * f, py / size * f, f); t += a; a *= 0.5; f *= 2; }
    const v = Math.round(255 * (lo + (hi - lo) * n / t)), k = (py * size + px) * 4;
    im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; return tex;
}

let mapImg = null, depthTex = null, noiseTex = null;

/** Farmland patchwork: recursively split plots in crop, stubble and ploughed-soil colours with furrow lines. */
function fieldsTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'), R = rng(77);
  const pal = ['#5c8038', '#4d7030', '#739140', '#b8a861', '#80664a', '#9e9a5c', '#385c29', '#8a9a48', '#6b5a3e', '#577a35'];
  const split = (x0, y0, w, h, depth) => {
    if (depth > 0 && (w > 70 || h > 70 || (R() < 0.7 && w > 24 && h > 24))) {
      if (w > h) { const s = Math.round(w * (0.35 + R() * 0.3)); split(x0, y0, s, h, depth - 1); split(x0 + s, y0, w - s, h, depth - 1); }
      else { const s = Math.round(h * (0.35 + R() * 0.3)); split(x0, y0, w, s, depth - 1); split(x0, y0 + s, w, h - s, depth - 1); }
      return;
    }
    x.fillStyle = pal[(R() * pal.length) | 0]; x.fillRect(x0, y0, w, h);
    const kind = R();
    if (kind < 0.16 && w > 14 && h > 14) { x.fillStyle = '#51702f'; x.fillRect(x0, y0, w, h); x.fillStyle = '#2c4a1f'; for (let a = 2; a < w - 1; a += 3) for (let b = 2; b < h - 1; b += 3) x.fillRect(x0 + a, y0 + b, 1.6, 1.6); }   // orchard rows
    else if (kind < 0.20) { x.fillStyle = '#d9ddd8'; x.fillRect(x0, y0, w, h); x.fillStyle = '#b4bcb6'; for (let a = 0; a < w; a += 4) x.fillRect(x0 + a, y0, 1, h); }                                                         // greenhouses
    x.globalAlpha = 0.11; x.strokeStyle = R() < 0.5 ? '#000' : '#fff'; x.lineWidth = 1; const st = 3 + R() * 3, vert = R() < 0.5; x.beginPath();
    for (let t = 1; t < (vert ? w : h); t += st) { if (vert) { x.moveTo(x0 + t, y0); x.lineTo(x0 + t, y0 + h); } else { x.moveTo(x0, y0 + t); x.lineTo(x0 + w, y0 + t); } }
    x.stroke(); x.globalAlpha = 1; x.strokeStyle = 'rgba(48,52,34,.6)'; x.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
  };
  split(0, 0, 1024, 1024, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}

/** The OpenStreetMap land cover as a one-byte-per-cell texture, sampled without filtering (the shader blurs the edges with noise). */
function landCoverTexture() {
  // mapped water that lies on dry ground here (the formula terrain's shores differ from the real ones, most of all at the Dead Sea) is not painted blue: the water surface itself already is
  for (let j = 0; j < LCR.h; j++) for (let i = 0; i < LCR.w; i++) { const o = (j * LCR.w + i) * 4; if (LCR.d[o] === 9 && !groundAt(X0 + (i + 0.5) * 60, Z0 + (j + 0.5) * 60).water) LCR.d[o] = 0; }
  // The shader's copy is twice as fine in each direction, made with the pixel-art rule "Scale2x": where two neighbours of a cell agree across a corner,
  // that corner takes their class. A staircase of 60 m steps becomes a diagonal of 30 m ones. (Everything else still reads the 60 m grid, `lcAt`.)
  const w = LCR.w, h = LCR.h, at = (i, j) => LCR.d[(Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))) * 4];
  if (renderer.capabilities.maxTextureSize < h * 2) { const a = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) a[i] = LCR.d[i * 4]; const t = new THREE.DataTexture(a, w, h, THREE.LuminanceFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; }
  const a = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const P = at(i, j), A = at(i, j - 1), B = at(i + 1, j), C = at(i - 1, j), D = at(i, j + 1), o = (j * 2) * (w * 2) + i * 2;
    a[o] = C === A && C !== D && A !== B ? A : P; a[o + 1] = A === B && A !== C && B !== D ? B : P; a[o + w * 2] = D === C && D !== B && C !== A ? C : P; a[o + w * 2 + 1] = B === D && B !== A && D !== C ? D : P; }
  const t = new THREE.DataTexture(a, w * 2, h * 2, THREE.LuminanceFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}
/** The real colour of the land from orbit, coarse (`SAT_JPG`, NASA Blue Marble, 512 x 1024 over the map window, water filled from the land beside it):
    the terrain's base tint. `?sat=0` leaves it out. */
function satTexture() {
  const R = window.SATR; if (!R) { const t = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t; }
  const t = new THREE.DataTexture(new Uint8Array(R.d.buffer ? R.d : R.d), R.w, R.h, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
/** The land cover from far away: the classes' typical colours averaged over about 4 x 4 cells, with all the smaller copies a far pixel needs (alpha:
    how much of the area is mapped). Beyond a few kilometres the shader leans on this instead of on single cells, which only flickered there. */
function landCoverFar() {
  const C = LC_PAL, w = LCR.w, h = LCR.h, W2 = 256, H2 = 512, acc = new Float32Array(W2 * H2 * 5);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = C[LCR.d[(j * w + i) * 4]], q = (Math.min(H2 - 1, (j * H2 / h) | 0) * W2 + Math.min(W2 - 1, (i * W2 / w) | 0)) * 5; acc[q + 4]++; if (c && c[3] > 0) { acc[q] += c[0] * c[3]; acc[q + 1] += c[1] * c[3]; acc[q + 2] += c[2] * c[3]; acc[q + 3] += c[3]; } }
  const a = new Uint8Array(W2 * H2 * 4); for (let k = 0; k < W2 * H2; k++) { const m = acc[k * 5 + 3], n = acc[k * 5 + 4] || 1; a[k * 4] = m ? acc[k * 5] / m * 255 : 0; a[k * 4 + 1] = m ? acc[k * 5 + 1] / m * 255 : 0; a[k * 4 + 2] = m ? acc[k * 5 + 2] / m * 255 : 0; a[k * 4 + 3] = m / n * 255; }
  const t = new THREE.DataTexture(a, W2, H2, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
/** One typical colour per land-cover class (alpha 0: the class has none of its own and shows the ground beside it). The shader blends a class toward its
    neighbour's colour along their border, so borders are a soft band and not a line. */
const LC_PAL = [[0, 0, 0, 0], [0.15, 0.24, 0.10, 1], [0.28, 0.32, 0.19, 1], [0.38, 0.37, 0.23, 1], [0.42, 0.45, 0.25, 0.7], [0.28, 0.44, 0.19, 1], [0.42, 0.43, 0.28, 1], [0.80, 0.74, 0.58, 0.7], [0.58, 0.56, 0.51, 0.6], [0.15, 0.31, 0.39, 1],
    [0.19, 0.32, 0.28, 1], [0, 0, 0, 0], [0.58, 0.58, 0.57, 1], [0.76, 0.79, 0.78, 1], [0.16, 0.19, 0.27, 1], [0, 0, 0, 0], [0.50, 0.52, 0.44, 1], [0.67, 0.58, 0.45, 1]];
function landCoverPalette() {
  const C = LC_PAL, a = new Uint8Array(32 * 4);
  C.forEach((c, i) => { for (let k = 0; k < 4; k++) a[i * 4 + k] = Math.round(c[k] * 255); });
  const t = new THREE.DataTexture(a, 32, 1, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}
/** Where the land-cover map has any class, blurred over a cell and filtered: the shader feathers class edges with it. */
function landCoverMask() {
  const w = LCR.w, h = LCR.h, a = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let n = 0, m = 0; for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const x = i + c, y = j + b; if (x < 0 || y < 0 || x >= w || y >= h) continue; n++; if (LCR.d[(y * w + x) * 4]) m++; } a[j * w + i] = 255 * m / n; }
  const t = new THREE.DataTexture(a, w, h, THREE.LuminanceFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}
/** Per-vertex baked light for the terrain: x = in the sun (0 in a mountain's shadow), y = valley occlusion. The shadow is marched across the height
    grid toward the sun, once per time of day (cached); it costs nothing per frame. */
let TERRAIN_MAT = null;
const TLIT = { attr: null, ao: null, cache: {} };
/** The same shadow march as in `bakeTerrainLight`, a few rows at a time (for time that passes); true when the picture for `j.key` is complete. */
function bakeTerrainRows(j, rows) {
  const W = NX + 1, H = NZ + 1, sd = j.sd; if (!j.sh) j.sh = new Float32Array(W * H); const sh = j.sh, cx = (X1 - X0) / NX, cz = (Z1 - Z0) / NZ, hl = Math.hypot(sd.x, sd.z) || 1e-6, ux = sd.x / hl, uz = sd.z / hl, step = Math.min(cx, cz), rise = Math.max(sd.y, 0.02) / hl * step, sx = ux * step / cx, sz = uz * step / cz;
  for (let r = 0; r < rows && j.row < H; r++, j.row++) for (let i = 0, jj = j.row; i < W; i++) { let x = i, z = jj, h = HGT[jj * W + i] + 4, occ = 0;
    for (let n = 0; n < 220; n++) { x += sx; z += sz; h += rise; if (x < 0 || z < 0 || x > NX || z > NZ || h > 2950) break; const t = HGT[(z + 0.5 | 0) * W + (x + 0.5 | 0)] - h; if (t > occ) { occ = t; if (occ > 60) break; } }
    sh[jj * W + i] = 1 - clamp(occ / 60, 0, 1); }
  if (j.row < H) return false; TLIT.cache[j.key] = sh; return true;
}
function bakeTerrainLight(key, sd) {
  if (!TLIT.attr || TLIT.cur === key) return; TLIT.cur = key; const W = NX + 1, H = NZ + 1, arr = TLIT.attr.array;
  if (!TLIT.ao) { const ao = TLIT.ao = new Float32Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let m = 0, n = 0; for (const [a, b] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= W || y >= H) continue; m += HGT[y * W + x]; n++; } ao[j * W + i] = clamp(1 - (m / n - HGT[j * W + i]) / 260, 0.6, 1); } }
  let sh = TLIT.cache[key];
  if (!sh) { sh = TLIT.cache[key] = new Float32Array(W * H); const cx = (X1 - X0) / NX, cz = (Z1 - Z0) / NZ, hl = Math.hypot(sd.x, sd.z) || 1e-6, ux = sd.x / hl, uz = sd.z / hl, step = Math.min(cx, cz), rise = sd.y / hl * step, sx = ux * step / cx, sz = uz * step / cz;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let x = i, z = j, h = HGT[j * W + i] + 4, occ = 0;
      for (let n = 0; n < 220; n++) { x += sx; z += sz; h += rise; if (x < 0 || z < 0 || x > NX || z > NZ || h > 2950) break; const t = HGT[(z + 0.5 | 0) * W + (x + 0.5 | 0)] - h; if (t > occ) { occ = t; if (occ > 60) break; } }
      sh[j * W + i] = 1 - clamp(occ / 60, 0, 1); } }
  for (let k = 0; k < W * H; k++) { arr[k * 2] = sh[k]; arr[k * 2 + 1] = TLIT.ao[k]; } TLIT.attr.needsUpdate = true;
}
const SHADER_VS = `
  attribute vec3 aCol; attribute vec4 aZone; attribute vec2 aLit;
  varying vec3 vW; varying vec3 vN; varying vec3 vCol; varying vec4 vZone; varying float vDist; varying vec2 vLit;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){ vW=position; vN=normal; vCol=aCol; vZone=aZone; vLit=aLit;
    vec4 mv=modelViewMatrix*vec4(position,1.0); vDist=length(mv.xyz); gl_Position=projectionMatrix*mv;
    #include <logdepthbuf_vertex>
  }`;
/* Terrain surface: everything finer than the 277 m mesh is synthesised per pixel –
   relief shading from two noise scales, field patchwork, scrub, wadis, rock strata, snow, streets, cloud shadows. */
const TERRAIN_FS = `
  uniform sampler2D tNoise, tFields, tLC, tLCa, tBS, tPal, tSat, tLCf; uniform float uSat; uniform vec2 uSatK; uniform vec3 sunDir, sunCol, skyCol, gndCol, fogCol; uniform float fogDen, uLights, uTime, uBS, uWet; uniform vec2 uOrg; uniform vec4 uLCr, uB;
  varying vec3 vW; varying vec3 vN; varying vec3 vCol; varying vec4 vZone; varying float vDist; varying vec2 vLit;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float nz(vec2 p){ return texture2D(tNoise,p).r; }
  ${HAZE_GLSL}
  void main(){
    #include <logdepthbuf_fragment>
    vec2 P=vW.xz; float farm=vZone.x, arid=vZone.y, urban=vZone.z, rough=vZone.w;
    vec2 pB=P/5300.0+0.37, pC=P/700.0+0.11;
    float nA=nz(P/23000.0), nB=nz(pB), nC=nz(pC), nD=nz(P/90.0+0.7);
    // relief: gradient of a synthetic detail height field bends the mesh normal
    float near=1.0-smoothstep(5000.0,22000.0,vDist);
    vec2 gB=vec2(nz(pB+vec2(60.0/5300.0,0.0))-nB, nz(pB+vec2(0.0,60.0/5300.0))-nB)/60.0;
    vec2 gC=vec2(0.0); if(near>0.01){ gC=vec2(nz(pC+vec2(8.0/700.0,0.0))-nC, nz(pC+vec2(0.0,8.0/700.0))-nC)/8.0; }          /* each layer of detail is only looked up where it can be seen: this shader is what a phone spends its frame on */
    // close-up grain: a third, metre-scale layer that only shows near the ground
    vec2 pE=mat2(0.8,-0.6,0.6,0.8)*P/43.0+0.53; float nE=0.5, close=1.0-smoothstep(250.0,2200.0,vDist); vec2 gE=vec2(0.0); if(close>0.01){ nE=nz(pE); gE=vec2(nz(pE+vec2(1.0/43.0,0.0))-nE, nz(pE+vec2(0.0,1.0/43.0))-nE)*2.2; }       /* one noise tile now spans 43 m, turned 37 degrees, so no 13 m lattice shows on bare ground */
    vec2 g=(gB*__UB__+gC*__UC__*near+gE*3.0*close)*rough;
    vec3 N=normalize(vec3(vN.x-g.x, vN.y, vN.z-g.y));
    float slope=1.0-N.y;
    /* the ground's base colour leans on the real one, seen from orbit: true desert hues and their patterns, the real greens and browns of the hills */
    vec3 vC=vCol; if(uSat>0.5){ vec2 su=(P-uB.xy)/(uB.zw-uB.xy); if(su.x>0.0&&su.x<1.0&&su.y>0.0&&su.y<1.0){ vec3 st=texture2D(tSat,su).rgb; vC=mix(vCol,st*uSatK.x,uSatK.y); } }
    vec3 col=vC*(0.80+0.40*nA)*(1.0+(nE-0.5)*0.26*close);
    col=mix(col, vC*mix(vec3(0.93,0.80,0.66),vec3(1.10,1.04,0.94),nA)*(1.0+(nE-0.5)*0.26*close), arid);          // desert: the patches differ in hue (ochre to cream), not in grey value
    { float c2=1.0-smoothstep(30.0,650.0,vDist); if(c2>0.01){ float nF=nz(mat2(0.6,0.8,-0.8,0.6)*P/29.0+0.19), nG=nz(P/8.3+0.61); col*=1.0+((nF-0.5)*0.30+(nG-0.5)*0.16*(1.0-smoothstep(10.0,160.0,vDist)))*c2*(0.5+0.5*rough); } }      // low and close: stones, tufts and furrows, so the ground stays sharp right under the aircraft
    // farmland
    col=mix(col, mix(texture2D(tFields,P/3000.0).rgb,col,0.22)*(0.80+0.30*nC), farm*0.85);
    // woodland and scrub clumps on green hills
    float veg=(1.0-arid)*(1.0-farm)*(1.0-urban);
    col=mix(col, vec3(0.12,0.22,0.09), veg*smoothstep(0.46,0.64,nC*0.55+nD*0.45)*0.8);
    // desert: pale wadi beds, darker gravel plains
    float wadi=pow(1.0-abs(2.0*nB-1.0),7.0);
    col=mix(col, col*1.2+0.04, arid*wadi*0.8);
    col*=1.0-arid*0.08*smoothstep(0.45,0.8,nC);
    // land cover from OpenStreetMap (one class per 60 m cell, ragged edges); fine patterns fade out with distance
    float lcG=0.0;
    /* three scales of wobble: the 60 m cells of the land cover lose their straight edges and square corners */
    { vec2 jit=(vec2(nz(P/170.0+0.31),nz(P/170.0+0.77))-0.5)*uLCr.zw*85.0;
      { float j2=1.0-smoothstep(4000.0,9000.0,vDist), j3=1.0-smoothstep(900.0,2500.0,vDist), jf=smoothstep(1800.0,6000.0,vDist);
        if(j2>0.01){ jit+=(vec2(nz(P/41.0+0.13),nz(P/41.0+0.59))-0.5)*uLCr.zw*46.0*j2; }
        if(j3>0.01){ jit+=(vec2(nz(P/13.0+0.71),nz(P/13.0+0.27))-0.5)*uLCr.zw*14.0*j3; }
        if(jf>0.01){ jit+=(vec2(nz(P/520.0+0.43),nz(P/520.0+0.91))-0.5)*uLCr.zw*70.0*jf; } }          /* from high up the fine wobble is below a pixel: a broad one takes over, so borders wander instead of stepping */
      vec2 uvL=(P-uLCr.xy)*uLCr.zw+jit; float lc=floor(texture2D(tLC,uvL).r*255.0+0.5); vec3 col0=col; float lcA=texture2D(tLCa,(P-uLCr.xy)*uLCr.zw+jit*0.5).r; lcG=lc;
      float fine=1.0-smoothstep(900.0,4500.0,vDist), fineS=1.0-smoothstep(220.0,1000.0,vDist), fineG=1.0-smoothstep(110.0,520.0,vDist);       /* rows a few metres apart fade out sooner: far away they only shimmer */ vec3 soil=vec3(0.47,0.40,0.30)*(0.9+0.2*nC);
      if(lc>0.5){
        if(lc<1.5){ float h1=nz(P/16.0+0.21), can=smoothstep(0.40,0.66,h1*0.55+nD*0.45), h2=nz((P+sunDir.xz*9.0)/16.0+0.21);          /* forest: a canopy of crowns, each lit on its sun side with a shadowed gap behind */
          col=mix(vec3(0.20,0.29,0.13),vec3(0.10,0.19,0.08),mix(0.55,can,fine))*(0.85+0.3*nC)*mix(1.0,mix(0.70,1.14,smoothstep(-0.07,0.11,h1-h2)),fine); urban=0.0; }
        else if(lc<2.5){ vec2 r=fract(P/vec2(7.0,9.0)); float t=smoothstep(0.44,0.26,length(r-0.5)); col=mix(mix(soil,vec3(0.13,0.25,0.10),0.55),mix(soil,vec3(0.12,0.24,0.09),t),fineS); urban=0.0; }
        else if(lc<3.5){ float t=smoothstep(0.32,0.12,abs(fract(P.x/5.0+P.y/41.0)-0.5)); col=mix(mix(soil,vec3(0.26,0.34,0.14),0.45),mix(soil,vec3(0.24,0.33,0.12),t),fineS); }
        else if(lc<4.5){ col=mix(texture2D(tFields,P/3000.0).rgb,col,0.15)*(0.85+0.25*nC); urban=0.0; }
        else if(lc<5.5){ col=vec3(0.28,0.44,0.19)*(0.85+0.3*nD); }
        else if(lc<6.5){ col=mix(vec3(0.54,0.51,0.37),vec3(0.29,0.35,0.19),smoothstep(0.48,0.74,nD))*(0.9+0.2*nC); }
        else if(lc<7.5){ col=mix(col,vec3(0.88,0.80,0.60),0.6)*(0.93+0.12*nD); urban=0.0; }
        else if(lc<8.5){ col=mix(col,vec3(0.60,0.58,0.53),0.5)*(0.86+0.22*nC)*(0.95+0.10*nD); urban=0.0; }       /* rock and sand take half their colour from the ground around them */
        else if(lc<9.5){ col=vec3(0.15,0.31,0.39)+0.05*nD; urban=0.0; }
        else if(lc<10.5){ col=mix(vec3(0.20,0.33,0.23),vec3(0.18,0.30,0.36),smoothstep(0.5,0.7,nD)); }
        else if(lc<11.5){ urban=max(urban,0.7); }
        else if(lc<12.5){ vec2 q=fract((P-uOrg)/30.0); col=mix(vec3(0.62,0.62,0.60),vec3(0.40,0.41,0.42),step(0.88,max(q.x,q.y))*fine)*(0.9+0.15*nD); urban=0.0; }
        else if(lc<13.5){ float t=step(0.5,fract(P.x/3.0+P.y/90.0)); col=mix(vec3(0.74,0.77,0.76),mix(vec3(0.80,0.83,0.81),vec3(0.72,0.75,0.74),t),fineG)*(0.93+0.14*nD)*(1.0-0.5*uLights); urban=0.0; }
        else if(lc<14.5){ vec2 q=fract(P/vec2(4.0,6.5)); col=mix(vec3(0.16,0.19,0.27),mix(vec3(0.10,0.13,0.22),vec3(0.58,0.60,0.62),step(0.84,max(q.x,q.y))),fineS); urban=0.0; }
        else if(lc<15.5){ }
        else if(lc<16.5){ col=mix(vec3(0.64,0.63,0.59),vec3(0.24,0.33,0.19),smoothstep(0.52,0.70,nD)); }
        else { col=vec3(0.67,0.58,0.45)*(0.9+0.2*nC); }
        col=mix(col0,col,smoothstep(0.10,0.70,lcA+(nD-0.5)*0.35));          // mapped areas feather into their surroundings instead of ending in 60 m steps
      }
      /* soft borders: half a cell away, to one side or the other, lies perhaps another class; the colour leans a third of the way toward it */
      if(vDist<40000.0){ vec2 hd=uLCr.zw*30.0*(nD>0.5?1.0:-1.0)*(0.7+0.6*nC);
        float l1=floor(texture2D(tLC,uvL+vec2(hd.x,0.0)).r*255.0+0.5), l2=floor(texture2D(tLC,uvL+vec2(0.0,hd.y)).r*255.0+0.5);
        if(abs(l1-lc)>0.5){ vec4 pc=texture2D(tPal,vec2((l1+0.5)/32.0,0.5)); col=mix(col,mix(col0,pc.rgb*(0.85+0.3*nC),pc.a),0.36); }
        if(abs(l2-lc)>0.5){ vec4 pc=texture2D(tPal,vec2((l2+0.5)/32.0,0.5)); col=mix(col,mix(col0,pc.rgb*(0.85+0.3*nC),pc.a),0.36); } }
      /* far away a pixel covers many cells: the averaged cover stands in for the single cell, which could only flicker */
      { float lf=smoothstep(4500.0,13000.0,vDist); if(lf>0.01){ vec4 fa=texture2D(tLCf,(P-uLCr.xy)*uLCr.zw); col=mix(col,mix(col0,fa.rgb*(0.88+0.24*nC),fa.a),lf); } } }
    /* the beach: ground a few metres above the sea is sand, pale and dry higher up, darker and wet at the water's edge (only the open coasts lie between -3 and 5 m) */
    { float bh=vW.y+(nC-0.5)*2.2+(nD-0.5)*1.2, beach=(1.0-smoothstep(1.6,4.6,bh))*step(-3.0,vW.y); if(beach>0.01){ col=mix(col,mix(vec3(0.62,0.55,0.41),vec3(0.86,0.79,0.62),smoothstep(0.2,1.5,bh))*(0.93+0.14*nD),beach); urban*=1.0-beach; } }
    float outside=max(max(uB.x-P.x,P.x-uB.z),max(uB.y-P.y,P.y-uB.w));
    if(outside>0.0){ col=vCol*(0.80+0.40*nA)*(0.88+0.24*nB); urban=0.0; }          // beyond the map: plain regional ground, fading into the haze
    // layered rock on steep ground
    float steep=smoothstep(0.13,0.40,slope)*(0.3+0.7*rough);
    float strata=0.5+0.5*sin(vW.y*0.085+nC*5.0+nB*9.0);
    col=mix(col, mix(vec3(0.50,0.47,0.41),vec3(0.72,0.47,0.30),arid)*(0.82+0.28*strata), steep);
    // snow above the Hermon snow line, thinner on cliffs
    col=mix(col, vec3(0.95,0.96,1.0), smoothstep(1750.0,2150.0,vW.y+(nC-0.5)*520.0-normalize(vN).z*520.0-normalize(vN).x*140.0)*(1.0-0.55*steep));          /* snow lies lower on slopes that face north, away from the sun */
    vec3 emis=vec3(0.0); vec3 warm=vec3(1.0,0.72,0.36);
    // towns: street grid, roofs, trees; street lamps at night
    if(urban>0.01){ vec2 q=(P-uOrg)/60.0; vec2 cq=floor(q); vec2 fq=abs(fract(q)-0.5);
      // local streets between the blocks: thin and light, and only on some block edges, so towns do not look like a waffle
      float ex=step(0.45,fract(sin(dot(cq+vec2(0.5,0.0),vec2(12.99,78.23)))*43758.5)), ez=step(0.45,fract(sin(dot(cq+vec2(0.0,0.5),vec2(39.35,11.13)))*24634.6));
      float road=max(smoothstep(0.455,0.475,fq.x)*ex, smoothstep(0.455,0.475,fq.y)*ez)*(1.0-smoothstep(1500.0,6000.0,vDist));
      vec3 uc=mix(vec3(0.55,0.54,0.51),vec3(0.73,0.69,0.61),nz(cq/61.0));
      uc=mix(uc,vec3(0.26,0.37,0.20),smoothstep(0.66,0.76,nD)*0.6);
      { // low over a town the ground is not a beige carpet: each block has a yard, a car park or paving, the streets are asphalt with a pavement beside them and a dashed line
        float nearU=1.0-smoothstep(300.0,1500.0,vDist);
        if(nearU>0.01){ float ih=fract(sin(dot(cq,vec2(27.1,61.7)))*4375.5);
          vec3 inter=ih<0.35?vec3(0.30,0.40,0.22):ih<0.60?mix(vec3(0.27,0.28,0.30),vec3(0.82),step(0.86,fract(P.x/2.6))*step(0.55,fract(P.y/11.0))*0.55*(1.0-smoothstep(200.0,600.0,vDist))):vec3(0.60,0.57,0.52);
          uc=mix(uc,inter*(0.9+0.2*nD),nearU*0.7);
          float pave=max(smoothstep(0.425,0.44,fq.x)*ex, smoothstep(0.425,0.44,fq.y)*ez); uc=mix(uc,vec3(0.66,0.64,0.60),clamp(pave-road,0.0,1.0)*nearU*0.8); }
        uc=mix(uc,mix(vec3(0.43,0.44,0.45),vec3(0.23,0.24,0.26),nearU),road*0.8);
        float dash=max(smoothstep(0.4935,0.4975,fq.x)*ex*step(0.5,fract(P.y/8.0)), smoothstep(0.4935,0.4975,fq.y)*ez*step(0.5,fract(P.x/8.0)))*(1.0-smoothstep(150.0,500.0,vDist)); uc=mix(uc,vec3(0.85),dash*0.8); }
      col=mix(col,uc,urban*0.9); { float fg=smoothstep(1200.0,6000.0,vDist), spk=smoothstep(0.50,0.56,nz(P/95.0+0.3))*smoothstep(0.42,0.50,nz(P/31.0+0.7)); emis+=warm*uLights*urban*(road*0.45+0.08+fg*(0.25+1.5*spk)); } }       /* from altitude a city is a field of gold, not a dark patch */
    // scattered village lights at night
    { vec2 cq=P/420.0; float hv=fract(sin(dot(floor(cq),vec2(127.1,311.7)))*43758.5453);
      emis+=warm*uLights*(1.0-arid*0.92)*step(0.80,hv)*smoothstep(0.07,0.0,length(fract(cq)-0.5))*0.8*step(-405.0,vW.y); }
    // light: sun (dimmed under drifting cloud shadows) + sky/ground hemisphere
    float cs=smoothstep(0.50,0.70,nz((P+vec2(uTime*6.0,uTime*2.0))/16000.0+0.2));
    // buildings cast shadows on the ground: the main block of each 60 m cell is in a texture (offset, half-size, height); a fragment looks at its own
    // cell and the cells toward the sun, in two columns. No shadow map: 77,000 blocks drawn twice would not run on a phone.
    float bsh=0.0, cao=0.0;
    if(uBS>0.5 && vDist<3800.0){ vec2 sd2=normalize(sunDir.xz+vec2(1e-5)), lat=vec2(-sd2.y,sd2.x); float lenK=length(sunDir.xz)/max(sunDir.y,0.10);
      for(int n=0;n<5;n++){ for(int m=0;m<2;m++){ vec2 cp=P+sd2*(60.0*float(n))+lat*(m==0?0.0:(fract(dot((P-uLCr.xy)/60.0,lat))<0.5?-60.0:60.0));
          vec2 cell=floor((cp-uLCr.xy)/60.0); vec4 b=texture2D(tBS,(cell+0.5)*60.0*uLCr.zw); float H=b.a*255.0; if(H<1.0) continue;
          vec2 ctr=uLCr.xy+(cell+0.5)*60.0+(b.xy-0.5)*60.0; float half2=b.z*42.0; vec2 rel=ctr-P; float t=dot(rel,sd2), l=abs(dot(rel,lat));
          float s=smoothstep(half2+2.5,half2-1.0,l)*smoothstep(-half2-2.0,-half2+1.5,t)*smoothstep(H*lenK+half2,H*lenK*0.82+half2-2.0,t); bsh=max(bsh,s);
          if(n==0){ float dO=max(abs(rel.x),abs(rel.y))-half2; cao=max(cao,1.0-smoothstep(-0.5,7.5,dO)); } } }          /* and the ground right beside a wall is darker: a building stands in the ground, it does not lie on it */
      bsh*=1.0-smoothstep(2600.0,3800.0,vDist); col*=1.0-0.30*cao*(1.0-smoothstep(1400.0,2800.0,vDist)); }
    float lowSun=clamp(1.0-sunDir.y*1.6,0.0,1.0), shB=max(vLit.x,0.22*lowSun);          // at a low sun a mountain's shadow is not black
    float dif=max(dot(N,sunDir),0.0)*(1.0-0.42*cs)*shB*(1.0-0.80*bsh);                        // vLit: baked mountain shadow and valley occlusion
    col*=1.0-0.26*uWet;
    vec3 c=col*(sunCol*dif+mix(gndCol,skyCol,N.y*0.5+0.5)*mix(0.80,1.0,shB)*vLit.y)+emis;
    { vec3 V=normalize(cameraPosition-vW);
      /* the sun flashes off solar fields and greenhouse roofs, panel by panel, when the camera is where the mirror points */
      if(lcG>12.5&&lcG<14.5&&vDist<26000.0){ vec3 Hh=normalize(V+sunDir); float pn=nz(floor(P/14.0)*0.37); vec3 pnl=normalize(vec3((pn-0.5)*0.10,1.0,lcG>13.5?0.34:0.04)); float sp=pow(max(dot(Hh,pnl),0.0),lcG>13.5?260.0:220.0);
        c+=sunCol*sp*(lcG>13.5?2.2:0.45)*shB*(1.0-0.6*cs)*step(0.25,pn)*smoothstep(350.0,1500.0,vDist); }
      /* rain: wet ground is darker and mirrors the sky at a low angle */
      c=mix(c,skyCol*1.25+fogCol*0.25,uWet*0.42*pow(1.0-max(V.y,0.0),5.0)*smoothstep(0.75,0.98,N.y)); }
    { float k=hazeK(vDist,cameraPosition.y,vW.y,fogDen)*(1.0+max(outside,0.0)/9000.0); vec3 T=exp(-k*k*vec3(0.8,1.0,1.35)); c=c*T+hazeCol(fogCol,vW-cameraPosition,sunDir,sunCol)*(1.0-T); }
    c=toneC(c);
    gl_FragColor=vec4(c,1.0);
  }`;
/* Water: animated wave normals, Fresnel sky reflection, sun glitter, depth-tinted shallows and surf at the shoreline. */
const WATER_FS = `
  uniform sampler2D tNoise, tDepth; uniform vec3 sunDir, sunCol, skyCol, fogCol, skyTop, skyHor, deepCol, shalCol, foamCol; uniform vec4 mapRect; uniform float fogDen, uTime;
  varying vec3 vW; varying float vDist;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float nz(vec2 p){ return texture2D(tNoise,p).r; }
  ${HAZE_GLSL}
  void main(){
    #include <logdepthbuf_fragment>
    vec2 P=vW.xz; vec3 V=normalize(cameraPosition-vW);
    float depth=texture2D(tDepth,(P-mapRect.xy)*mapRect.zw).r*128.0-20.0;
    vec2 p1=P/110.0+vec2(uTime*0.030,uTime*0.018), p2=P/27.0+vec2(-uTime*0.045,uTime*0.036); float e=0.012;
    float a=nz(p1), b=nz(p2);
    vec2 g=vec2(nz(p1+vec2(e,0.0))-a, nz(p1+vec2(0.0,e))-a)+0.7*vec2(nz(p2+vec2(e,0.0))-b, nz(p2+vec2(0.0,e))-b);
    { float w1=1.0-smoothstep(900.0,3800.0,vDist), w2=1.0-smoothstep(350.0,1400.0,vDist), w3=1.0-smoothstep(120.0,520.0,vDist);                // swell: three wave trains from the west, fading with distance (the noise alone looked like camouflage close up)
      vec2 d1=vec2(0.94,0.34), d2=vec2(0.80,-0.60), d3=vec2(0.55,0.83);
      g+=d1*0.016*w1*cos(dot(d1,P)*0.105+uTime*0.9+a*5.0)+d2*0.012*w2*cos(dot(d2,P)*0.27-uTime*1.3+b*4.0)+d3*0.009*w3*cos(dot(d3,P)*0.70+uTime*1.9+a*3.0); }       /* each train fades before its wavelength shrinks to a pixel, or the horizon fills with rings */
    vec3 N=normalize(vec3(-g.x*WK, 1.0+vDist/900.0, -g.y*WK));
    float fres=0.02+0.98*pow(1.0-max(dot(V,N),0.0),5.0);
    vec3 R=reflect(-V,N); R.y=abs(R.y);
    vec3 skyR=mix(skyHor,skyTop,pow(R.y,0.5));
    float sd=max(dot(R,sunDir),0.0), rgh=clamp(vDist/14000.0,0.0,1.0); float glint=pow(sd,mix(420.0,38.0,rgh))*mix(1.25,0.42,rgh)+pow(sd,20.0)*0.08;       // the sun's path widens toward the horizon instead of dying out
    vec3 light=skyCol+sunCol*max(dot(N,sunDir),0.0);
    vec3 body=mix(deepCol,shalCol,exp(-max(depth,0.0)/14.0))*light; body=mix(body,fogCol*0.55,clamp((fogDen-0.00006)*9000.0,0.0,0.6));          // under dust or storm the sea greys with the air
    vec3 c=mix(body,skyR,fres)+sunCol*glint;
    float surf=smoothstep(4.0,0.6,depth+sin(uTime*0.9+a*9.0)*1.3)*smoothstep(0.30,0.55,b+a*0.4);
    surf=max(surf, smoothstep(5.5,0.3,depth)*smoothstep(0.55,0.95,sin(depth*1.5-uTime*1.1+a*6.0))*0.75*(1.0-smoothstep(1500.0,7000.0,vDist)));          // lines of surf running in parallel to the beach
    c=mix(c,foamCol*light,surf*0.85);
    { float k=hazeK(vDist,cameraPosition.y,vW.y,fogDen); vec3 T=exp(-k*k*vec3(0.8,1.0,1.35)); c=c*T+hazeCol(fogCol,vW-cameraPosition,sunDir,sunCol)*(1.0-T); }
    c=toneC(c);
    gl_FragColor=vec4(c,1.0);
  }`;
const SIMPLE_VS = `
  varying vec3 vW; varying float vDist;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){ vW=position; vec4 mv=modelViewMatrix*vec4(position,1.0); vDist=length(mv.xyz); gl_Position=projectionMatrix*mv;
    #include <logdepthbuf_vertex>
  }`;

function buildTerrain() {
  const nv = (NX + 1) * (NZ + 1), pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), zone = new Float32Array(nv * 4);
  ZONE = zone; FOREST = new Float32Array(nv);
  for (let j = 0, k = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++, k++) {
    pos[k * 3] = X0 + (X1 - X0) * i / NX; pos[k * 3 + 1] = HGT[k]; pos[k * 3 + 2] = Z0 + (Z1 - Z0) * j / NZ;
  }
  // normals from a full-index pass, then reuse the shared attributes in culled chunks (cheap LOD-style culling)
  const full = new THREE.BufferGeometry(), idx = new Uint32Array(NX * NZ * 6);
  for (let j = 0, t = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + NX + 1, c = a + 1, d = b + 1;
    idx[t++] = a; idx[t++] = b; idx[t++] = c; idx[t++] = c; idx[t++] = b; idx[t++] = d;
  }
  const pAttr = new THREE.BufferAttribute(pos, 3);
  full.setAttribute('position', pAttr); full.setIndex(new THREE.BufferAttribute(idx, 1)); full.computeVertexNormals();
  const nAttr = full.getAttribute('normal'), o = [0, 0, 0, 0, 0, 0, 0, 0];
  // colours, zones, water-depth map and minimap image
  const dc = document.createElement('canvas'); dc.width = NX + 1; dc.height = NZ + 1; const dx = dc.getContext('2d'), dim = dx.createImageData(NX + 1, NZ + 1);
  for (let j = 0, k = 0; j <= NZ; j++) { const lat = LAT1 - (LAT1 - LAT0) * j / NZ;
    for (let i = 0; i <= NX; i++, k++) { const lon = LON0 + (LON1 - LON0) * i / NX;
      terrainColor(lon, lat, HGT[k], nAttr.getY(k), o); col[k * 3] = o[0]; col[k * 3 + 1] = o[1]; col[k * 3 + 2] = o[2];
      zone[k * 4] = o[3]; zone[k * 4 + 1] = o[4]; zone[k * 4 + 2] = o[5]; zone[k * 4 + 3] = o[6]; FOREST[k] = o[7];
      const lvl = (lat > 32.68 && lat < 32.94 && lon > 35.48 && lon < 35.70) ? -212 : (lat > 30.98 && lat < 31.86 && lon > 35.25 && lon < 35.68) ? -430 : 0;
      const v = clamp((lvl - HGT[k] + 20) / 128, 0, 1) * 255; dim.data[k * 4] = dim.data[k * 4 + 1] = dim.data[k * 4 + 2] = v; dim.data[k * 4 + 3] = 255; } }
  dx.putImageData(dim, 0, 0);
  depthTex = new THREE.CanvasTexture(dc); depthTex.flipY = false; depthTex.generateMipmaps = false; depthTex.minFilter = THREE.LinearFilter;
  const mc = document.createElement('canvas'); mc.width = 320; mc.height = 588;
  const mx = mc.getContext('2d'), mim = mx.createImageData(320, 588);
  for (let py = 0; py < 588; py++) for (let px = 0; px < 320; px++) {
    const i = Math.round(px / 319 * NX), j = Math.round(py / 587 * NZ), k = j * (NX + 1) + i, q = (py * 320 + px) * 4;
    const lon = LON0 + (LON1 - LON0) * i / NX, lat = LAT1 - (LAT1 - LAT0) * j / NZ, wet = waterLevel(lon, lat, HGT[k]) !== null;
    const sh = 0.55 + 0.45 * nAttr.getY(k);
    mim.data[q] = wet ? 22 : col[k * 3] * 200 * sh; mim.data[q + 1] = wet ? 58 : col[k * 3 + 1] * 200 * sh; mim.data[q + 2] = wet ? 98 : col[k * 3 + 2] * 200 * sh; mim.data[q + 3] = 255;
  }
  mx.putImageData(mim, 0, 0); mapImg = mc;
  // stretch the outer ring to the horizon so the world never ends
  for (let j = 0; j <= NZ; j++) { pos[(j * (NX + 1)) * 3] = -FAR; pos[(j * (NX + 1) + NX) * 3] = FAR; }
  for (let i = 0; i <= NX; i++) { pos[i * 3 + 2] = -FAR; pos[(NZ * (NX + 1) + i) * 3 + 2] = FAR; }
  const cAttr = new THREE.BufferAttribute(col, 3), zAttr = new THREE.BufferAttribute(zone, 4), lAttr = TLIT.attr = new THREE.BufferAttribute(new Float32Array(nv * 2).fill(1), 2);
  noiseTex = noiseTexture(HIRES ? 512 : 256, 8, 0, 1, HIRES ? 6 : 5);
  const mat = new THREE.ShaderMaterial({
    uniforms: { tNoise: { value: noiseTex }, tFields: { value: fieldsTexture() }, tLC: { value: landCoverTexture() }, tPal: { value: landCoverPalette() }, tLCf: { value: landCoverFar() }, tSat: { value: satTexture() }, uSat: { value: window.SATR ? 1 : 0 }, uSatK: { value: new THREE.Vector2(1.35, 0.6) }, tLCa: { value: landCoverMask() }, tBS: { value: null }, uWet: { value: 0 }, uBS: { value: 0 }, uB: { value: new THREE.Vector4(X0, Z0, X1, Z1) }, uLCr: { value: new THREE.Vector4(X0, Z0, 1 / (LCR.w * 60), 1 / (LCR.h * 60)) }, uOrg: { value: new THREE.Vector2(X0, Z0) }, sunDir: ENV.sunDir, sunCol: ENV.sunCol, skyCol: ENV.skyCol, gndCol: ENV.gndCol, fogCol: ENV.fogCol, fogDen: ENV.fogDen, uLights: ENV.uLights, uTime: ENV.uTime },
    vertexShader: SHADER_VS, fragmentShader: TERRAIN_FS.replace("__UB__", "330.0").replace("__UC__", "34.0")
  });
  mat.extensions = { derivatives: false, fragDepth: true, drawBuffers: false, shaderTextureLOD: false }; TERRAIN_MAT = mat;
  const CX = NX / 8, CZ = NZ / 11;
  // the bed of the sea and of the two lakes is never seen (the water is opaque), and the depth buffer here cannot reject it early, so every pixel of it
  // was shaded in full and then painted over: quads with all four corners well under a water surface are left out of the mesh
  const sunk = (i, j) => { const lon = LON0 + (LON1 - LON0) * i / NX, lat = LAT1 - (LAT1 - LAT0) * j / NZ, h = HGT[j * (NX + 1) + i];
    if (lon < coastLon(lat)) return lat >= 31.0 && h < -2.5; if (lat < 29.57 && lon > 34.55 && lon < 35.45) return h < -2.5;
    if (lat > 32.68 && lat < 32.94 && lon > 35.48 && lon < 35.70) return h < -214.5; if (lat > 30.98 && lat < 31.86 && lon > 35.25 && lon < 35.68) return h < -432.5; return false; };
  for (let cj = 0; cj < NZ; cj += CZ) for (let ci = 0; ci < NX; ci += CX) {
    const ix = new Uint32Array(CX * CZ * 6); let t = 0, lo = 1e9, hi = -1e9, edge = false;
    for (let j = cj; j < cj + CZ; j++) for (let i = ci; i < ci + CX; i++) {
      const a = j * (NX + 1) + i, b = a + NX + 1, c = a + 1, d = b + 1;
      lo = Math.min(lo, HGT[a]); hi = Math.max(hi, HGT[a]); if (sunk(i, j) && sunk(i + 1, j) && sunk(i, j + 1) && sunk(i + 1, j + 1)) continue;
      ix[t++] = a; ix[t++] = b; ix[t++] = c; ix[t++] = c; ix[t++] = b; ix[t++] = d;
    }
    if (!t) continue;
    if (ci === 0 || cj === 0 || ci + CX >= NX || cj + CZ >= NZ) edge = true;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pAttr); g.setAttribute('normal', nAttr); g.setAttribute('aCol', cAttr); g.setAttribute('aZone', zAttr); g.setAttribute('aLit', lAttr);
    g.setIndex(new THREE.BufferAttribute(ix.slice(0, t), 1));
    const xa = X0 + (X1 - X0) * ci / NX, xb = X0 + (X1 - X0) * (ci + CX) / NX, za = Z0 + (Z1 - Z0) * cj / NZ, zb = Z0 + (Z1 - Z0) * (cj + CZ) / NZ;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((xa + xb) / 2, (lo + hi) / 2, (za + zb) / 2), Math.hypot(xb - xa, zb - za, hi - lo) / 2 + 300);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = !edge; m.matrixAutoUpdate = false; scene.add(m);
  }
}

function quadXZ(x0, x1, z0, z1, y) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z1], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]); return g;
}
function waterMat(deep, shal, foam, wk) {
  const m = new THREE.ShaderMaterial({
    uniforms: { tNoise: { value: noiseTex }, tDepth: { value: depthTex }, sunDir: ENV.sunDir, sunCol: ENV.sunCol, skyCol: ENV.skyCol, fogCol: ENV.fogCol, fogDen: ENV.fogDen, uTime: ENV.uTime, skyTop: ENV.skyTop, skyHor: ENV.skyHor,
      deepCol: { value: new THREE.Color(deep[0], deep[1], deep[2]) }, shalCol: { value: new THREE.Color(shal[0], shal[1], shal[2]) }, foamCol: { value: new THREE.Color(foam[0], foam[1], foam[2]) },
      mapRect: { value: new THREE.Vector4(X0, Z0, 1 / (X1 - X0), 1 / (Z1 - Z0)) } },
    vertexShader: SIMPLE_VS, fragmentShader: WATER_FS.replace(/WK/g, wk.toFixed(1))
  });
  m.extensions = { derivatives: false, fragDepth: true, drawBuffers: false, shaderTextureLOD: false }; return m;
}

function buildWater() {
  // Mediterranean: a strip that follows the coastline row by row and runs west to the horizon
  const P = [], I = []; let rows = 0;
  const addRow = (z, xe) => { P.push(-FAR, 0, z, xe, 0, z); rows++; };
  addRow(-FAR, lon2x(coastLon(LAT1) + 0.012));
  for (let lat = LAT1; lat >= 31.0; lat -= 0.02) addRow(lat2z(lat), lon2x(coastLon(lat) + 0.012));
  for (let r = 0; r < rows - 1; r++) { const a = r * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const med = new THREE.BufferGeometry(); med.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); med.setIndex(I);
  const white = [0.95, 0.97, 1.0];
  const mm = new THREE.Mesh(med, waterMat([0.03, 0.21, 0.40], [0.18, 0.66, 0.68], white, 26)); mm.frustumCulled = false; scene.add(mm);
  // Gulf of Eilat / Red Sea with its bright reef fringe
  const rs = new THREE.Mesh(quadXZ(lon2x(34.55), lon2x(35.45), lat2z(29.57), FAR, 0), waterMat([0.02, 0.12, 0.32], [0.12, 0.62, 0.62], white, 20)); rs.frustumCulled = false; scene.add(rs);
  // Sea of Galilee, and the Dead Sea: milky turquoise over salt
  scene.add(new THREE.Mesh(quadXZ(lon2x(35.48), lon2x(35.70), lat2z(32.94), lat2z(32.68), -212), waterMat([0.05, 0.19, 0.31], [0.20, 0.42, 0.42], [0.8, 0.86, 0.85], 14)));
  scene.add(new THREE.Mesh(quadXZ(lon2x(35.25), lon2x(35.68), lat2z(31.86), lat2z(30.98), -430), waterMat([0.03, 0.40, 0.46], [0.62, 0.92, 0.86], [0.97, 0.97, 0.94], 8)));
  // Jordan River: a meandering ribbon from the Kinneret to the Dead Sea, with a green riparian band beneath it
  for (const [hw, yo, colr] of [[70, 3, 0x4a6034], [26, 5, 0x3d6f7c]]) {
    const rp = [], rn = [], ri = []; let n = 0;
    for (let lat = 32.705; lat >= 31.765; lat -= 0.004, n++) {
      const lon = riftLon(lat) + 0.014 * Math.sin(lat * 75) + 0.006 * Math.sin(lat * 210 + 1), x = lon2x(lon), z = lat2z(lat), y = heightAt(x, z) + yo;
      rp.push(x - hw, y, z, x + hw, y, z); rn.push(0, 1, 0, 0, 1, 0);
    }
    for (let r = 0; r < n - 1; r++) { const a = r * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(rn, 3)); rg.setIndex(ri);
    scene.add(new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ color: colr, side: THREE.DoubleSide })));
  }
}
