'use strict';
// ---------- 5. Three.js scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
/** Render resolution follows the device and the frame rate: it starts at the screen's own pixel density (up to 2×) and steps down only while
    frames run slow, back up when there is time to spare (`autoRes` in the main loop). `?res=1.5` in the address pins it. */
const RES = { max: Math.min(window.devicePixelRatio || 1, 2), min: Math.min(window.devicePixelRatio || 1, 0.75), pr: 1, acc: 0, n: 0, hold: 0, cap: 9, fixed: +(new URLSearchParams(location.search).get('res')) || 0 };
RES.pr = RES.fixed || Math.min(RES.max, 1.75); renderer.setPixelRatio(RES.pr);
function autoRes(ms) {
  if (RES.fixed || ms > 250 || document.hidden) return; RES.acc += ms; if (++RES.n < 45) return; const avg = RES.acc / RES.n; RES.acc = RES.n = 0; if (RES.hold > 0) RES.hold--;
  let pr = RES.pr; if (avg > 27 && pr > RES.min) { pr = Math.max(RES.min, pr - 0.25); RES.cap = pr; RES.hold = 12; } else if (avg < 14.5 && pr < Math.min(RES.max, RES.cap + (RES.hold ? 0 : 0.25)) && !RES.hold) { pr = Math.min(RES.max, pr + 0.25); RES.hold = 4; }
  if (pr !== RES.pr) { RES.pr = pr; renderer.setPixelRatio(pr); resize(); }
}
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xb8d3ee, 0.000028);
const camera = new THREE.PerspectiveCamera(60, 1, 1, 260000);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1); scene.add(sun);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 74 : 60; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

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
  const n = LCR.w * LCR.h, a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = LCR.d[i * 4];
  const t = new THREE.DataTexture(a, LCR.w, LCR.h, THREE.LuminanceFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
}
const SHADER_VS = `
  attribute vec3 aCol; attribute vec4 aZone;
  varying vec3 vW; varying vec3 vN; varying vec3 vCol; varying vec4 vZone; varying float vDist;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){ vW=position; vN=normal; vCol=aCol; vZone=aZone;
    vec4 mv=modelViewMatrix*vec4(position,1.0); vDist=length(mv.xyz); gl_Position=projectionMatrix*mv;
    #include <logdepthbuf_vertex>
  }`;
/* Terrain surface: everything finer than the 277 m mesh is synthesised per pixel –
   relief shading from two noise scales, field patchwork, scrub, wadis, rock strata, snow, streets, cloud shadows. */
const TERRAIN_FS = `
  uniform sampler2D tNoise, tFields, tLC; uniform vec3 sunDir, sunCol, skyCol, gndCol, fogCol; uniform float fogDen, uLights, uTime; uniform vec2 uOrg; uniform vec4 uLCr;
  varying vec3 vW; varying vec3 vN; varying vec3 vCol; varying vec4 vZone; varying float vDist;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float nz(vec2 p){ return texture2D(tNoise,p).r; }
  void main(){
    #include <logdepthbuf_fragment>
    vec2 P=vW.xz; float farm=vZone.x, arid=vZone.y, urban=vZone.z, rough=vZone.w;
    vec2 pB=P/5300.0+0.37, pC=P/700.0+0.11;
    float nA=nz(P/23000.0), nB=nz(pB), nC=nz(pC), nD=nz(P/90.0+0.7);
    // relief: gradient of a synthetic detail height field bends the mesh normal
    float near=1.0-smoothstep(5000.0,22000.0,vDist);
    vec2 gB=vec2(nz(pB+vec2(60.0/5300.0,0.0))-nB, nz(pB+vec2(0.0,60.0/5300.0))-nB)/60.0;
    vec2 gC=vec2(nz(pC+vec2(8.0/700.0,0.0))-nC, nz(pC+vec2(0.0,8.0/700.0))-nC)/8.0;
    // close-up grain: a third, metre-scale layer that only shows near the ground
    vec2 pE=P/13.0+0.53; float nE=nz(pE), close=1.0-smoothstep(250.0,2200.0,vDist); vec2 gE=vec2(nz(pE+vec2(1.0/13.0,0.0))-nE, nz(pE+vec2(0.0,1.0/13.0))-nE);
    vec2 g=(gB*__UB__+gC*__UC__*near+gE*3.0*close)*rough;
    vec3 N=normalize(vec3(vN.x-g.x, vN.y, vN.z-g.y));
    float slope=1.0-N.y;
    vec3 col=vCol*(0.80+0.40*nA)*(1.0+(nE-0.5)*0.26*close);
    { float c2=1.0-smoothstep(30.0,650.0,vDist); if(c2>0.01){ float nF=nz(P/3.1+0.19), nG=nz(P/0.9+0.61); col*=1.0+((nF-0.5)*0.30+(nG-0.5)*0.16*(1.0-smoothstep(10.0,160.0,vDist)))*c2*(0.5+0.5*rough); } }      // low and close: stones, tufts and furrows, so the ground stays sharp right under the aircraft
    // farmland
    col=mix(col, mix(texture2D(tFields,P/3000.0).rgb,col,0.22)*(0.80+0.30*nC), farm*0.85);
    // woodland and scrub clumps on green hills
    float veg=(1.0-arid)*(1.0-farm)*(1.0-urban);
    col=mix(col, vec3(0.12,0.22,0.09), veg*smoothstep(0.46,0.64,nC*0.55+nD*0.45)*0.8);
    // desert: pale wadi beds, darker gravel plains
    float wadi=pow(1.0-abs(2.0*nB-1.0),7.0);
    col=mix(col, col*1.2+0.04, arid*wadi*0.8);
    col*=1.0-arid*0.2*smoothstep(0.45,0.8,nC);
    // land cover from OpenStreetMap (one class per 60 m cell, ragged edges); fine patterns fade out with distance
    { vec2 jit=(vec2(nz(P/170.0+0.31),nz(P/170.0+0.77))-0.5)*uLCr.zw*55.0; float lc=floor(texture2D(tLC,(P-uLCr.xy)*uLCr.zw+jit).r*255.0+0.5);
      float fine=1.0-smoothstep(900.0,4500.0,vDist), fineS=1.0-smoothstep(220.0,1000.0,vDist), fineG=1.0-smoothstep(110.0,520.0,vDist);       /* rows a few metres apart fade out sooner: far away they only shimmer */ vec3 soil=vec3(0.47,0.40,0.30)*(0.9+0.2*nC);
      if(lc>0.5){
        if(lc<1.5){ float can=smoothstep(0.40,0.66,nz(P/16.0+0.21)*0.55+nD*0.45); col=mix(vec3(0.17,0.24,0.11),vec3(0.06,0.13,0.05),mix(0.55,can,fine))*(0.85+0.3*nC); urban=0.0; }
        else if(lc<2.5){ vec2 r=fract(P/vec2(7.0,9.0)); float t=smoothstep(0.44,0.26,length(r-0.5)); col=mix(mix(soil,vec3(0.13,0.25,0.10),0.55),mix(soil,vec3(0.12,0.24,0.09),t),fineS); urban=0.0; }
        else if(lc<3.5){ float t=smoothstep(0.32,0.12,abs(fract(P.x/5.0+P.y/41.0)-0.5)); col=mix(mix(soil,vec3(0.26,0.34,0.14),0.45),mix(soil,vec3(0.24,0.33,0.12),t),fineS); }
        else if(lc<4.5){ col=mix(texture2D(tFields,P/3000.0).rgb,col,0.15)*(0.85+0.25*nC); urban=0.0; }
        else if(lc<5.5){ col=vec3(0.28,0.44,0.19)*(0.85+0.3*nD); }
        else if(lc<6.5){ col=mix(vec3(0.54,0.51,0.37),vec3(0.29,0.35,0.19),smoothstep(0.48,0.74,nD))*(0.9+0.2*nC); }
        else if(lc<7.5){ col=vec3(0.88,0.81,0.62)*(0.93+0.12*nD); urban=0.0; }
        else if(lc<8.5){ col=vec3(0.80,0.78,0.72)*(0.84+0.22*nC); urban=0.0; }
        else if(lc<9.5){ col=vec3(0.15,0.31,0.39)+0.05*nD; urban=0.0; }
        else if(lc<10.5){ col=mix(vec3(0.20,0.33,0.23),vec3(0.18,0.30,0.36),smoothstep(0.5,0.7,nD)); }
        else if(lc<11.5){ urban=max(urban,0.7); }
        else if(lc<12.5){ vec2 q=fract((P-uOrg)/30.0); col=mix(vec3(0.62,0.62,0.60),vec3(0.40,0.41,0.42),step(0.88,max(q.x,q.y))*fine)*(0.9+0.15*nD); urban=0.0; }
        else if(lc<13.5){ float t=step(0.5,fract(P.x/3.0+P.y/90.0)); col=mix(vec3(0.82,0.84,0.83),mix(vec3(0.89,0.91,0.89),vec3(0.77,0.80,0.79),t),fineG)*(0.93+0.14*nD); urban=0.0; }
        else if(lc<14.5){ vec2 q=fract(P/vec2(4.0,6.5)); col=mix(vec3(0.16,0.19,0.27),mix(vec3(0.10,0.13,0.22),vec3(0.58,0.60,0.62),step(0.84,max(q.x,q.y))),fineS); urban=0.0; }
        else if(lc<15.5){ }
        else if(lc<16.5){ col=mix(vec3(0.64,0.63,0.59),vec3(0.24,0.33,0.19),smoothstep(0.52,0.70,nD)); }
        else { col=vec3(0.67,0.58,0.45)*(0.9+0.2*nC); }
      } }
    // layered rock on steep ground
    float steep=smoothstep(0.13,0.40,slope)*(0.3+0.7*rough);
    float strata=0.5+0.5*sin(vW.y*0.085+nC*5.0+nB*9.0);
    col=mix(col, mix(vec3(0.50,0.47,0.41),vec3(0.60,0.40,0.27),arid)*(0.70+0.40*strata), steep);
    // snow above the Hermon snow line, thinner on cliffs
    col=mix(col, vec3(0.95,0.96,1.0), smoothstep(1750.0,2150.0,vW.y+(nC-0.5)*520.0)*(1.0-0.55*steep));
    vec3 emis=vec3(0.0); vec3 warm=vec3(1.0,0.72,0.36);
    // towns: street grid, roofs, trees; street lamps at night
    if(urban>0.01){ vec2 q=(P-uOrg)/60.0; vec2 cq=floor(q); vec2 fq=abs(fract(q)-0.5);
      // local streets between the blocks: thin and light, and only on some block edges, so towns do not look like a waffle
      float ex=step(0.45,fract(sin(dot(cq+vec2(0.5,0.0),vec2(12.99,78.23)))*43758.5)), ez=step(0.45,fract(sin(dot(cq+vec2(0.0,0.5),vec2(39.35,11.13)))*24634.6));
      float road=max(smoothstep(0.455,0.475,fq.x)*ex, smoothstep(0.455,0.475,fq.y)*ez)*(1.0-smoothstep(1500.0,6000.0,vDist));
      vec3 uc=mix(vec3(0.55,0.54,0.51),vec3(0.73,0.69,0.61),nz(cq/61.0));
      uc=mix(uc,vec3(0.26,0.37,0.20),smoothstep(0.66,0.76,nD)*0.6); uc=mix(uc,vec3(0.43,0.44,0.45),road*0.8);
      col=mix(col,uc,urban*0.9); emis+=warm*uLights*urban*(road*0.45+0.08); }
    // scattered village lights at night
    { vec2 cq=P/420.0; float hv=fract(sin(dot(floor(cq),vec2(127.1,311.7)))*43758.5453);
      emis+=warm*uLights*(1.0-arid*0.92)*step(0.80,hv)*smoothstep(0.07,0.0,length(fract(cq)-0.5))*0.8*step(-405.0,vW.y); }
    // light: sun (dimmed under drifting cloud shadows) + sky/ground hemisphere
    float cs=smoothstep(0.50,0.70,nz((P+vec2(uTime*6.0,uTime*2.0))/16000.0+0.2));
    float dif=max(dot(N,sunDir),0.0)*(1.0-0.42*cs);
    vec3 c=col*(sunCol*dif+mix(gndCol,skyCol,N.y*0.5+0.5))+emis;
    c=mix(c,fogCol,1.0-exp(-fogDen*fogDen*vDist*vDist));
    gl_FragColor=vec4(c,1.0);
  }`;
/* Water: animated wave normals, Fresnel sky reflection, sun glitter, depth-tinted shallows and surf at the shoreline. */
const WATER_FS = `
  uniform sampler2D tNoise, tDepth; uniform vec3 sunDir, sunCol, skyCol, fogCol, skyTop, skyHor, deepCol, shalCol, foamCol; uniform vec4 mapRect; uniform float fogDen, uTime;
  varying vec3 vW; varying float vDist;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  float nz(vec2 p){ return texture2D(tNoise,p).r; }
  void main(){
    #include <logdepthbuf_fragment>
    vec2 P=vW.xz; vec3 V=normalize(cameraPosition-vW);
    float depth=texture2D(tDepth,(P-mapRect.xy)*mapRect.zw).r*128.0-20.0;
    vec2 p1=P/110.0+vec2(uTime*0.030,uTime*0.018), p2=P/27.0+vec2(-uTime*0.045,uTime*0.036); float e=0.012;
    float a=nz(p1), b=nz(p2);
    vec2 g=vec2(nz(p1+vec2(e,0.0))-a, nz(p1+vec2(0.0,e))-a)+0.7*vec2(nz(p2+vec2(e,0.0))-b, nz(p2+vec2(0.0,e))-b);
    vec3 N=normalize(vec3(-g.x*WK, 1.0+vDist/900.0, -g.y*WK));
    float fres=0.02+0.98*pow(1.0-max(dot(V,N),0.0),5.0);
    vec3 R=reflect(-V,N); R.y=abs(R.y);
    vec3 skyR=mix(skyHor,skyTop,pow(R.y,0.5));
    float sd=max(dot(R,sunDir),0.0); float glint=(pow(sd,180.0)*1.1+pow(sd,20.0)*0.10)/(1.0+vDist/9000.0);
    vec3 light=skyCol+sunCol*max(dot(N,sunDir),0.0);
    vec3 body=mix(deepCol,shalCol,exp(-max(depth,0.0)/14.0))*light;
    vec3 c=mix(body,skyR,fres)+sunCol*glint;
    float surf=smoothstep(4.0,0.6,depth+sin(uTime*0.9+a*9.0)*1.3)*smoothstep(0.30,0.55,b+a*0.4);
    c=mix(c,foamCol*light,surf*0.85);
    c=mix(c,fogCol,1.0-exp(-fogDen*fogDen*vDist*vDist));
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
  const cAttr = new THREE.BufferAttribute(col, 3), zAttr = new THREE.BufferAttribute(zone, 4);
  noiseTex = noiseTexture(HIRES ? 512 : 256, 8, 0, 1, HIRES ? 6 : 5);
  const mat = new THREE.ShaderMaterial({
    uniforms: { tNoise: { value: noiseTex }, tFields: { value: fieldsTexture() }, tLC: { value: landCoverTexture() }, uLCr: { value: new THREE.Vector4(X0, Z0, 1 / (LCR.w * 60), 1 / (LCR.h * 60)) }, uOrg: { value: new THREE.Vector2(X0, Z0) }, sunDir: ENV.sunDir, sunCol: ENV.sunCol, skyCol: ENV.skyCol, gndCol: ENV.gndCol, fogCol: ENV.fogCol, fogDen: ENV.fogDen, uLights: ENV.uLights, uTime: ENV.uTime },
    vertexShader: SHADER_VS, fragmentShader: TERRAIN_FS.replace("__UB__", "330.0").replace("__UC__", "34.0")
  });
  mat.extensions = { derivatives: false, fragDepth: true, drawBuffers: false, shaderTextureLOD: false };
  const CX = NX / 8, CZ = NZ / 11;
  for (let cj = 0; cj < NZ; cj += CZ) for (let ci = 0; ci < NX; ci += CX) {
    const ix = new Uint32Array(CX * CZ * 6); let t = 0, lo = 1e9, hi = -1e9, edge = false;
    for (let j = cj; j < cj + CZ; j++) for (let i = ci; i < ci + CX; i++) {
      const a = j * (NX + 1) + i, b = a + NX + 1, c = a + 1, d = b + 1;
      ix[t++] = a; ix[t++] = b; ix[t++] = c; ix[t++] = c; ix[t++] = b; ix[t++] = d;
      lo = Math.min(lo, HGT[a]); hi = Math.max(hi, HGT[a]);
    }
    if (ci === 0 || cj === 0 || ci + CX >= NX || cj + CZ >= NZ) edge = true;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pAttr); g.setAttribute('normal', nAttr); g.setAttribute('aCol', cAttr); g.setAttribute('aZone', zAttr);
    g.setIndex(new THREE.BufferAttribute(ix, 1));
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
  const mm = new THREE.Mesh(med, waterMat([0.02, 0.13, 0.30], [0.16, 0.56, 0.58], white, 26)); mm.frustumCulled = false; scene.add(mm);
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
