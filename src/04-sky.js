'use strict';
// ---------- 8. Sky, sun, clouds, time of day ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, stars: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top,hor,sunDir,sunCol; uniform float stars; varying vec3 vDir;
    float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main(){ vec3 d=normalize(vDir); float h=max(d.y,0.0);
      vec3 col=mix(hor,top,pow(h,0.5));
      { float low=clamp(1.0-sunDir.y*1.6,0.0,1.0), sh=max(dot(normalize(d.xz+vec2(1e-5)),normalize(sunDir.xz+vec2(1e-5))),0.0), band=1.0-smoothstep(0.0,0.35,h); col=col*mix(vec3(1.0),vec3(0.84,0.92,1.10),low*(1.0-sh)*0.7*band)+sunCol*0.22*low*sh*sh*sh*band; }
      if(d.y<0.0) col=mix(hor,hor*0.78,min(1.0,-d.y*4.0));
      float s=max(dot(d,sunDir),0.0);
      col+=sunCol*(pow(s,900.0)*3.0+pow(s,60.0)*0.35+pow(s,5.0)*0.2*(1.0-h));   // disc, glare, Mie haze
      if(stars>0.0&&d.y>0.0){ col+=vec3(step(0.9975,hash(floor(d*220.0))))*stars*smoothstep(0.0,0.2,d.y); }
      { vec3 t=max(col-0.55,0.0); col=min(col,vec3(0.55))+t/(1.0+1.6*t); }
      gl_FragColor=vec4(col,1.0); }`
}));
// lighting/fog uniforms shared by the terrain, water and building shaders
const ENV = { sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, skyCol: { value: new THREE.Color() }, gndCol: { value: new THREE.Color() }, fogCol: { value: new THREE.Color() },
  fogDen: { value: 0.000028 }, uLights: { value: 0 }, uTime: { value: 0 }, skyTop: skyU.top, skyHor: skyU.hor };
sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), R = rng(5);
  for (let i = 0; i < 16; i++) { const px = 34 + R() * 60, py = 44 + R() * 44, r = 16 + R() * 22, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  return new THREE.CanvasTexture(c);
}
const clouds = new THREE.Group(); let cloudMat = null, glare = null;
function buildSkyObjects() {
  cloudMat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.9 });
  const R = rng(42);
  for (let i = 0; i < 46; i++) {
    const cx = lerp(X0 - 8000, X1 + 8000, R()), cz = lerp(Z0, Z1, R() * R() * 0.9), cy = 1500 + R() * 1700, n = 3 + (R() * 3 | 0);   // more cloud in the north
    for (let k = 0; k < n; k++) { const s = new THREE.Sprite(cloudMat), sz = 700 + R() * 900; s.position.set(cx + (R() - 0.5) * 1300, cy + (R() - 0.5) * 220, cz + (R() - 0.5) * 900); s.scale.set(sz, sz * 0.55, 1); clouds.add(s); }
  }
  scene.add(clouds);
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d'), gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.15, 'rgba(255,240,200,.55)'); gg.addColorStop(1, 'rgba(255,220,160,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  glare.scale.set(26000, 26000, 1); scene.add(glare);
}
const TOD = [
  { name: 'DAY', sun: [-0.55, 0.53, 0.64], sunCol: 0xfff0d2, sunI: 1.08, hs: 0xa9c8ff, hg: 0x8a7a5a, hI: 0.52,       /* an afternoon sun, 32 degrees up in the south-west: relief and facades get a lit and a shaded side, and the shade is blue */ top: [0.17, 0.41, 0.80], hor: [0.72, 0.83, 0.93], fog: [0.72, 0.83, 0.93], stars: 0, lights: 0, cloud: [1, 1, 1], glare: 0.9 },
  { name: 'SUNSET', sun: [-0.92, 0.11, 0.2], sunCol: 0xff9648, sunI: 0.9, hs: 0x8f80b4, hg: 0x5a4030, hI: 0.52, top: [0.15, 0.19, 0.42], hor: [0.93, 0.58, 0.36], fog: [0.78, 0.55, 0.44], stars: 0.15, lights: 0.55, cloud: [1, 0.74, 0.58], glare: 1 },
  { name: 'NIGHT', sun: [0.3, 0.6, -0.4], sunCol: 0x8fa8ff, sunI: 0.2, hs: 0x24365c, hg: 0x0a0a12, hI: 0.3, top: [0.01, 0.02, 0.06], hor: [0.05, 0.07, 0.14], fog: [0.04, 0.055, 0.11], stars: 1, lights: 1, cloud: [0.16, 0.18, 0.26], glare: 0.12 }
];
const sunDir = new THREE.Vector3();
function applyTOD(i) {
  const t = TOD[i]; sunDir.set(t.sun[0], t.sun[1], t.sun[2]).normalize();
  sun.color.setHex(t.sunCol); sun.intensity = t.sunI; hemi.color.setHex(t.hs); hemi.groundColor.setHex(t.hg); hemi.intensity = t.hI;
  skyU.top.value.setRGB(t.top[0], t.top[1], t.top[2]); skyU.hor.value.setRGB(t.hor[0], t.hor[1], t.hor[2]); skyU.sunDir.value.copy(sunDir);
  skyU.sunCol.value.setHex(t.sunCol).multiplyScalar(i === 2 ? 0.5 : 1); skyU.stars.value = t.stars;
  scene.fog.color.setRGB(t.fog[0], t.fog[1], t.fog[2]);
  ENV.sunDir.value.copy(sunDir); ENV.sunCol.value.setHex(t.sunCol).multiplyScalar(t.sunI); ENV.skyCol.value.setHex(t.hs).multiplyScalar(t.hI); ENV.gndCol.value.setHex(t.hg).multiplyScalar(t.hI);
  ENV.fogCol.value.copy(scene.fog.color); ENV.uLights.value = t.lights;
  if (cloudMat) cloudMat.color.setRGB(t.cloud[0], t.cloud[1], t.cloud[2]);
  if (TR) TR.mat.uniforms.uCol.value.setRGB(t.cloud[0], t.cloud[1], t.cloud[2]);
  if (glare) { glare.material.opacity = t.glare; glare.material.color.setHex(t.sunCol); }
  if (cityLights) { cityLights.visible = t.lights > 0; cityLights.material.opacity = t.lights; }
  if (siteLights) { siteLights.visible = t.lights > 0; siteLights.material.opacity = Math.min(1, t.lights * 1.4); }
  applyWeather(); bakeTerrainLight(i, sunDir);
  if (traffic) { traffic.pts.material.size = 9 + 17 * t.lights; traffic.pts.material.color.setHex(t.lights > 0.3 ? 0xffe2a8 : 0xf4f1e6); }
  if (rwyLights) { rwyLights.material.opacity = 0.55 + 0.45 * t.lights; rwyLights.material.size = 5 + 11 * t.lights; }
  if (bldMat) bldMat.emissive.setRGB(0.035 * t.lights, 0.03 * t.lights, 0.02 * t.lights);
  if (AC.cabinMat) AC.cabinMat.color.setHex(t.lights > 0.3 ? 0xffe9a8 : 0x1b2430);
  for (const m of AC.livery) m.emissiveIntensity = t.lights > 0.3 ? 0.95 : 0;                       // cabin windows light up
  for (const g of AC.glow) g.scale.setScalar(g.userData.r * (1 + 1.5 * t.lights));                  // the aircraft's lights bloom at night
  bakeSkyReflection();
}
