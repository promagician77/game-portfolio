import * as THREE from 'three';

/*
  War FX layer — a transparent WebGL canvas composited over the photographic
  backdrop: drifting battle smoke, two layers of embers, tracer fire (ground
  bursts and anti-air streams) and explosion cues for the page (flash + shake).
*/

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.02+11.0;a*=0.5;}return s;}
`;

function emberSystem({ count, spread, size, speed, color1, color2 }) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos.set([(Math.random() - 0.5) * spread.x, (Math.random() - 0.5) * spread.y, -Math.random() * spread.z + 4], i * 3);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uLevel: { value: 1 }, uPR: { value: 1 }, uSize: { value: size }, uSpeed: { value: speed },
      uH: { value: spread.y }, uC1: { value: new THREE.Color(color1) }, uC2: { value: new THREE.Color(color2) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uLevel; uniform float uPR; uniform float uSize; uniform float uSpeed; uniform float uH;
      attribute vec4 aSeed;
      varying float vAlpha; varying float vMix;
      void main(){
        vec3 p = position;
        float h = uH;
        p.y = mod(position.y + h * 0.5 + uTime * uSpeed * (0.5 + aSeed.x * 1.6), h) - h * 0.5;
        p.x += sin(uTime * 0.8 + aSeed.y * 30.0) * 0.7 + sin(uTime * 0.27 + aSeed.x * 12.0) * 1.1 + uTime * 0.25 * (aSeed.z - 0.3);
        p.x = mod(p.x + 23.0, 46.0) - 23.0;
        float life = (p.y + h * 0.5) / h;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.6 + aSeed.z) * uPR * (10.0 / -mv.z);
        vAlpha = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.55, 1.0, life)) * (0.55 + 0.45 * sin(uTime * 9.0 + aSeed.y * 40.0)) * uLevel;
        vMix = aSeed.w;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC1; uniform vec3 uC2;
      varying float vAlpha; varying float vMix;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 c = mix(uC1, uC2, vMix) * (0.8 + a);
        gl_FragColor = vec4(c, a * a * vAlpha);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export function createScene(canvas, { reducedMotion = false, onFlash = () => {} } = {}) {
  const mobile = window.innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const PR = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(PR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 10);

  const state = { intensity: 1, scroll: 0 };
  const k = mobile ? 0.55 : 1;

  /* ---------- Battle smoke banks ---------- */
  const fogUniforms = [];
  [-3, -9, -15, -22].forEach((z, i) => {
    const u = { uTime: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: i * 7.3 }, uSpeed: { value: 0.035 + i * 0.012 } };
    fogUniforms.push(u);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 34),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: u,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uOpacity; uniform float uSeed; uniform float uSpeed;
          varying vec2 vUv;
          ${NOISE}
          void main(){
            vec2 p = vUv * vec2(3.2, 1.6);
            float n = fbm(vec3(p.x + uTime * uSpeed, p.y - uTime * uSpeed * 0.35, uSeed + uTime * 0.02));
            float band = mix(0.4, 1.0, smoothstep(1.0, 0.2, vUv.y)) * smoothstep(0.0, 0.12, vUv.y);
            float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
            float a = smoothstep(-0.15, 0.65, n) * band * edge * uOpacity;
            // smoke lit from below by fires: warm at the base, ash-grey on top
            vec3 col = mix(vec3(0.32, 0.12, 0.05), vec3(0.13, 0.1, 0.09), smoothstep(0.1, 0.8, vUv.y));
            gl_FragColor = vec4(col, a);
          }`,
      })
    );
    m.position.set(0, -3 - i * 0.4, z);
    scene.add(m);
  });

  /* ---------- Embers: a dense far layer and a big near layer ---------- */
  const embersFar = emberSystem({ count: Math.round(1800 * k), spread: { x: 46, y: 26, z: 26 }, size: 6, speed: 1, color1: '#ff4a0a', color2: '#ffc266' });
  const embersNear = emberSystem({ count: Math.round(220 * k), spread: { x: 30, y: 18, z: 4 }, size: 16, speed: 1.6, color1: '#ff5a14', color2: '#ffd28a' });
  embersNear.position.z = 2;
  scene.add(embersFar, embersNear);

  /* ---------- Tracer fire ---------- */
  const TRACERS = 90;
  const tPos = new Float32Array(TRACERS * 6);
  const tCol = new Float32Array(TRACERS * 6);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  const tracerLines = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  tracerLines.frustumCulled = false;
  scene.add(tracerLines);
  const tracers = Array.from({ length: TRACERS }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, len: 2.6 }));
  const queue = [];
  function burst(now) {
    const antiAir = Math.random() < 0.3;
    const left = Math.random() < 0.5;
    const o = antiAir
      ? new THREE.Vector3((Math.random() - 0.5) * 30, -12, -14 - Math.random() * 8)
      : new THREE.Vector3(left ? -30 : 30, -7 + Math.random() * 9, -10 - Math.random() * 12);
    const d = antiAir
      ? new THREE.Vector3((Math.random() - 0.5) * 0.7, 1, (Math.random() - 0.5) * 0.2).normalize()
      : new THREE.Vector3(left ? 1 : -1, 0.03 + Math.random() * 0.12, (Math.random() - 0.5) * 0.2).normalize();
    const n = antiAir ? 10 + ((Math.random() * 10) | 0) : 5 + ((Math.random() * 8) | 0);
    const sweep = (Math.random() - 0.5) * 0.02;
    for (let i = 0; i < n; i++) {
      queue.push({ at: now + i * (antiAir ? 0.06 : 0.075), o: o.clone(), d: d.clone().add(new THREE.Vector3(sweep * i, (Math.random() - 0.5) * 0.03, 0)).normalize(), s: antiAir ? 45 : 58, len: antiAir ? 2 : 2.8 });
    }
  }

  /* ---------- Interaction ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = (e.clientY / window.innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onPointer, { passive: true });
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  /* ---------- Loop ---------- */
  const timer = new THREE.Timer();
  timer.connect(document);
  const speed = reducedMotion ? 0.3 : 1;
  [embersFar, embersNear].forEach((s) => (s.material.uniforms.uPR.value = PR));
  let nextBurst = 0.6, nextFlash = 2.2, raf = 0;

  function tick(ts) {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.05) * speed;
    const now = timer.getElapsed() * speed;
    const I = state.intensity;

    embersFar.material.uniforms.uTime.value = now;
    embersNear.material.uniforms.uTime.value = now;
    embersFar.material.uniforms.uLevel.value = I;
    embersNear.material.uniforms.uLevel.value = I * 0.8;
    fogUniforms.forEach((u, i) => { u.uTime.value = now; u.uOpacity.value = 0.5 * (0.6 + 0.4 * I) * (1 - i * 0.12); });

    if (now > nextBurst) { burst(now); nextBurst = now + (0.35 + Math.random() * 1.0) / Math.max(I, 0.3); }
    if (now > nextFlash && I > 0.3) { onFlash('war'); nextFlash = now + 2 + Math.random() * 2.2; }
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].at <= now) {
        const q = queue[i];
        const t = tracers.find((x) => !x.on);
        if (t) { t.on = true; t.p.copy(q.o); t.v.copy(q.d).multiplyScalar(q.s); t.life = 0; t.len = q.len; }
        queue.splice(i, 1);
      }
    }
    for (let i = 0; i < TRACERS; i++) {
      const t = tracers[i], o = i * 6;
      if (!t.on) { tPos.fill(0, o, o + 6); tCol.fill(0, o, o + 6); continue; }
      t.life += dt;
      t.p.addScaledVector(t.v, dt);
      if (t.life > 1.4) { t.on = false; continue; }
      const dir = t.v.clone().normalize();
      tPos[o] = t.p.x; tPos[o + 1] = t.p.y; tPos[o + 2] = t.p.z;
      tPos[o + 3] = t.p.x - dir.x * t.len; tPos[o + 4] = t.p.y - dir.y * t.len; tPos[o + 5] = t.p.z - dir.z * t.len;
      const h = 2.4 * I;
      tCol[o] = h; tCol[o + 1] = h * 0.7; tCol[o + 2] = h * 0.3;
      tCol[o + 3] = tCol[o + 4] = tCol[o + 5] = 0;
    }
    tracerGeo.attributes.position.needsUpdate = true;
    tracerGeo.attributes.color.needsUpdate = true;

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    camera.position.x = mouse.x * 1.4;
    camera.position.y = -mouse.y * 0.8 - state.scroll * 3;
    camera.lookAt(0, -state.scroll * 3, -10);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    state,
    destroy() {
      cancelAnimationFrame(raf);
      timer.dispose();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
