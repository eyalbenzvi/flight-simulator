'use strict';
// ---------- 8. Sky, sun, clouds, time of day ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, stars: { value: 0 }, uCir: { value: 0.32 }, uT: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top,hor,sunDir,sunCol; uniform float stars,uCir,uT; varying vec3 vDir;
    float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=hash(vec3(i,1.3)), b=hash(vec3(i+vec2(1.,0.),1.3)), c=hash(vec3(i+vec2(0.,1.),1.3)), e=hash(vec3(i+vec2(1.,1.),1.3)); return mix(mix(a,b,f.x),mix(c,e,f.x),f.y); }
    void main(){ vec3 d=normalize(vDir); float h=max(d.y,0.0);
      vec3 col=mix(hor,top,pow(h,0.5));
      { float low=clamp(1.0-sunDir.y*1.6,0.0,1.0), sh=max(dot(normalize(d.xz+vec2(1e-5)),normalize(sunDir.xz+vec2(1e-5))),0.0), band=1.0-smoothstep(0.0,0.35,h); col=col*mix(vec3(1.0),vec3(0.84,0.92,1.10),low*(1.0-sh)*0.7*band)+sunCol*0.22*low*sh*sh*sh*band; }
      if(d.y<0.0) col=mix(hor,hor*0.78,min(1.0,-d.y*4.0));
      /* high cloud painted into the dome: streaks of cirrus that take the sun's colour (white by day, flaming at sunset, moonlit at night) */
      if(d.y>0.02){ vec2 q=d.xz/(d.y+0.12)*1.6+vec2(uT*0.002,0.0); float ci=vn(q*vec2(1.0,3.2))*0.55+vn(q*vec2(2.3,7.0)+3.1)*0.30+vn(q*vec2(5.0,15.0))*0.15; ci=smoothstep(0.52,0.80,ci)*smoothstep(0.02,0.18,d.y)*uCir; col=mix(col,hor*0.6+sunCol*0.5,ci); }
      float s=max(dot(d,sunDir),0.0);
      if(stars>0.5){ float moon=smoothstep(0.99985,0.99992,s); vec3 md=normalize(d-sunDir*dot(d,sunDir)+vec3(1e-4)); col=mix(col,vec3(0.95,0.96,1.0)*(0.55+0.45*smoothstep(-0.6,0.5,dot(md,vec3(0.6,0.5,0.6))))*(0.88+0.12*hash(floor(md*5.0))),moon); col+=vec3(0.80,0.86,1.0)*(pow(s,300.0)*0.25+pow(s,30.0)*0.06); }   /* the moon and its halo */
      else col+=sunCol*(pow(s,900.0)*2.4+pow(s,60.0)*0.35+pow(s,5.0)*0.2*(1.0-h)+pow(s,8.0)*0.22*clamp(1.0-sunDir.y*1.6,0.0,1.0));   /* disc, glare, Mie haze, a wide warm scatter at a low sun */
      if(stars>0.0&&d.y>0.0){ vec3 sp=d*300.0; float hh=hash(floor(sp)), r=length(fract(sp)-0.5);            /* round stars of different brightness and colour */
        col+=mix(vec3(0.75,0.85,1.0),vec3(1.0,0.9,0.75),fract(hh*917.0))*step(0.996,hh)*smoothstep(0.42,0.08,r)*(0.35+0.65*fract(hh*331.0))*(0.8+0.2*sin(uT*3.0+hh*90.0))*stars*smoothstep(0.0,0.2,d.y); }
      { vec3 t=max(col-0.55,0.0); vec3 c=min(col,vec3(0.55))+t/(1.0+1.6*t); { float l=dot(c,vec3(0.30,0.59,0.11)); c=mix(vec3(l),c,1.15); c=mix(c,c*c*(3.0-2.0*c),0.35); c+=vec3(-0.010,0.004,0.022)*(1.0-smoothstep(0.0,0.35,l))+vec3(0.018,0.006,-0.020)*smoothstep(0.45,0.9,l); c=max(c,vec3(0.0)); } col=c; }
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
  // Clouds: every puff of every cloud in one instanced, camera-facing mesh (one draw call instead of 180 sprites). A puff is lit on its sun side and
  // top and grey-blue underneath, the bases are flat, the rim glows toward a low sun, and puffs fade out as the camera flies into them.
  const NC = HIRES ? 110 : 54, PER = HIRES ? 10 : 7, R = rng(42), aC = new Float32Array(NC * PER * 4), aO = new Float32Array(NC * PER * 4); let n = 0;
  for (let i = 0; i < NC; i++) { const cx = lerp(X0 - 8000, X1 + 8000, R()), cz = lerp(Z0, Z1, R() * R() * 0.9), cy = 1500 + R() * 1700, big = 0.7 + R() * R() * 1.6;     // more cloud in the north
    for (let k = 0; k < PER; k++) { const a = R() * 6.283, rr = Math.sqrt(R()) * 900 * big, up = R() * R() * 520 * big * (1 - rr / (1100 * big)), sz = (520 + R() * 620) * big * (1 - up / (1400 * big));
      aC[n * 4] = cx; aC[n * 4 + 1] = cy; aC[n * 4 + 2] = cz; aC[n * 4 + 3] = sz; aO[n * 4] = Math.cos(a) * rr; aO[n * 4 + 1] = up; aO[n * 4 + 2] = Math.sin(a) * rr * 0.7; aO[n * 4 + 3] = R(); n++; } }
  const cg = new THREE.InstancedBufferGeometry(); cg.index = new THREE.PlaneGeometry(1, 1).index; cg.setAttribute('position', new THREE.PlaneGeometry(1, 1).attributes.position); cg.setAttribute('uv', new THREE.PlaneGeometry(1, 1).attributes.uv);
  cg.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 4)); cg.setAttribute('aO', new THREE.InstancedBufferAttribute(aO, 4)); cg.instanceCount = n;
  cloudMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { tPuff: { value: puffTexture() }, uCol: { value: new THREE.Color(1, 1, 1) }, uOp: { value: 0.9 }, uDrift: { value: 0 }, uSpan: { value: new THREE.Vector2(X0 - 12000, X1 - X0 + 24000) }, uGrow: { value: 1 }, sunDir: ENV.sunDir, sunCol: ENV.sunCol, fogCol: ENV.fogCol, fogDen: ENV.fogDen },
    vertexShader: `attribute vec4 aC, aO; uniform float uDrift, uGrow; uniform vec2 uSpan; uniform vec3 sunDir; varying vec2 vUv; varying float vLit, vDist, vH, vSeed; varying vec3 vW;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ vec3 c=aC.xyz; c.x=uSpan.x+mod(c.x+uDrift-uSpan.x,uSpan.y); vec3 w=c+aO.xyz*vec3(uGrow,1.0,uGrow); float sz=aC.w*uGrow;
        vec4 mv=viewMatrix*vec4(w,1.0); mv.xy+=position.xy*vec2(sz,sz*0.62); vW=w; vDist=length(mv.xyz); vUv=uv; vSeed=aO.w; vH=clamp(aO.y/600.0,0.0,1.0);
        vLit=0.5+0.5*dot(normalize(aO.xyz+vec3(0.0,260.0,0.0)),sunDir); gl_Position=projectionMatrix*mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `uniform sampler2D tPuff; uniform vec3 uCol, sunDir, sunCol, fogCol; uniform float uOp, fogDen; varying vec2 vUv; varying float vLit, vDist, vH, vSeed; varying vec3 vW;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      ${HAZE_GLSL}
      void main(){
        #include <logdepthbuf_fragment>
        float a=texture2D(tPuff,vUv).a*uOp*smoothstep(120.0,650.0,vDist); if(a<0.01) discard;
        float top=smoothstep(0.15,0.85,vUv.y), lit=clamp(vLit*0.75+top*0.35+vH*0.25,0.0,1.0);
        vec3 shade=uCol*vec3(0.56,0.62,0.74), col=mix(shade,uCol*(0.86+0.2*sunCol),lit);
        vec3 vd=normalize(vW-cameraPosition); float rim=pow(max(dot(vd,sunDir),0.0),6.0)*(1.0-sunDir.y); col+=sunCol*rim*0.45*a;                      // a glowing edge toward a low sun
        col*=mix(0.80,1.0,smoothstep(0.0,0.4,vUv.y+vH));                                                                                         // flat, darker bases
        { float k=hazeK(vDist,cameraPosition.y,vW.y,fogDen)*0.75; vec3 T=exp(-k*k*vec3(0.8,1.0,1.35)); col=col*T+hazeCol(fogCol,vd,sunDir,sunCol)*(1.0-T); }
        gl_FragColor=vec4(toneC(col),a); }` });
  cloudMat.extensions = { derivatives: false, fragDepth: true, drawBuffers: false, shaderTextureLOD: false }; cloudMat.color = cloudMat.uniforms.uCol.value;
  { const cm = new THREE.Mesh(cg, cloudMat); cm.frustumCulled = false; cm.renderOrder = 5; clouds.add(cm); }
  scene.add(clouds);
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d'), gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.15, 'rgba(255,240,200,.55)'); gg.addColorStop(1, 'rgba(255,220,160,0)'); gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  glare.scale.set(26000, 26000, 1); scene.add(glare);
}
const TOD = [
  { name: 'DAY', sun: [-0.55, 0.53, 0.64], sunCol: 0xfff0d2, sunI: 1.08, hs: 0xa9c8ff, hg: 0x8a7a5a, hI: 0.52,       /* an afternoon sun, 32 degrees up in the south-west: relief and facades get a lit and a shaded side, and the shade is blue */ top: [0.17, 0.41, 0.80], hor: [0.80, 0.87, 0.93], fog: [0.72, 0.82, 0.93], stars: 0, lights: 0, cloud: [1, 1, 1], glare: 0.9, cir: 0.32 },
  // sunset: an orange sky over cool violet-blue shade, lit windows, no stars yet. Night: moonlit blue (the "sun" is the moon, 25 degrees up in the north-east)
  { name: 'SUNSET', sun: [-0.92, 0.11, 0.22], sunCol: 0xff8a3c, sunI: 1.2, hs: 0x7482cc, hg: 0x6b3c2a, hI: 0.64, top: [0.09, 0.13, 0.36], hor: [1.0, 0.60, 0.30], fog: [0.82, 0.50, 0.38], stars: 0, lights: 0.75, cloud: [1, 0.66, 0.48], glare: 0.7, cir: 0.45, den: 0.00005 },
  { name: 'NIGHT', sun: [0.45, 0.42, -0.55], sunCol: 0xa8c0ff, sunI: 0.38, hs: 0x2c4680, hg: 0x0b0d18, hI: 0.42, top: [0.012, 0.028, 0.085], hor: [0.075, 0.10, 0.20], fog: [0.05, 0.075, 0.15], stars: 1, lights: 1, cloud: [0.20, 0.24, 0.36], glare: 0.0, cir: 0.28, den: 0.000035 }
];
const sunDir = new THREE.Vector3();
function applyTOD(i) {
  const t = TOD[i]; sunDir.set(t.sun[0], t.sun[1], t.sun[2]).normalize();
  sun.color.setHex(t.sunCol); sun.intensity = t.sunI; hemi.color.setHex(t.hs); hemi.groundColor.setHex(t.hg); hemi.intensity = t.hI;
  skyU.top.value.setRGB(t.top[0], t.top[1], t.top[2]); skyU.hor.value.setRGB(t.hor[0], t.hor[1], t.hor[2]); skyU.sunDir.value.copy(sunDir);
  skyU.sunCol.value.setHex(t.sunCol).multiplyScalar(i === 2 ? 0.5 : 1); skyU.stars.value = t.stars; skyU.uCir.value = t.cir;
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
