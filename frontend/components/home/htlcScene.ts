import * as THREE from "three";

/** p runs 0 → 4: hero, intent, source lock, destination lock, reveal. px/py: pointer in [-1, 1]. */
export type HtlcStore = { p: number; px: number; py: number };

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const VIOLET = new THREE.Color("#9566f2");
const MINT = new THREE.Color("#00eb98");
const AMBER = new THREE.Color("#ffb547");
const SPAN = 2.3; // vault distance from centre
const ARC_H = 2.4; // bezier control height of the order bridge

const bezier = (t: number, out: THREE.Vector3) =>
  out.set(mix(-SPAN, SPAN, t), 2 * (1 - t) * t * ARC_H, 0);

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const crystalShader = {
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uLock; uniform float uTime;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
      float pulse = 0.5 + 0.5 * sin(uTime * 2.4);
      vec3 c = uColor * (0.12 + f * 1.4) * (0.55 + uLock * (0.8 + 0.25 * pulse));
      gl_FragColor = vec4(c, 0.25 + f * 0.7);
    }`,
};

// Timelock dial: an arc that drains as the lock ages, with hour ticks.
const dialShader = {
  vertexShader: /* glsl */ `
    varying vec2 vP;
    void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uProgress; uniform float uOpacity;
    varying vec2 vP;
    void main() {
      float a = fract(0.25 - atan(vP.y, vP.x) / 6.28318);
      float on = step(a, uProgress);
      float tick = step(0.92, fract(a * 24.0));
      float alpha = (0.12 + on * 0.75 + tick * 0.25) * uOpacity;
      gl_FragColor = vec4(mix(vec3(0.35), uColor, on), alpha);
    }`,
};

const bridgeShader = {
  vertexShader: /* glsl */ `
    attribute float aT; attribute float aSpeed; attribute vec3 aOff; attribute float aDir;
    uniform float uTime; uniform float uIntensity; uniform float uSpread; uniform float uPixel;
    uniform float uSpan; uniform float uArc;
    varying float vT; varying float vA;
    void main() {
      float t = fract(aT + uTime * aSpeed * aDir);
      vec3 p = vec3(mix(-uSpan, uSpan, t), 2.0 * (1.0 - t) * t * uArc, 0.0);
      p += aOff * uSpread * (0.25 + sin(t * 3.14159));
      vT = t;
      vA = uIntensity * smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uPixel * (1.4 + 2.2 * uIntensity) * (6.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uA; uniform vec3 uB; uniform vec3 uS; uniform float uReveal;
    varying float vT; varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float m = smoothstep(0.5, 0.0, d);
      vec3 c = mix(mix(uA, uB, vT), uS, uReveal * (1.0 - abs(vT - 0.5) * 1.4));
      gl_FragColor = vec4(c, m * vA);
    }`,
};

function makeVault(color: THREE.Color, glow: THREE.Texture, time: { value: number }) {
  const group = new THREE.Group();
  const crystalGeo = new THREE.IcosahedronGeometry(0.95, 0);
  const crystalMat = new THREE.ShaderMaterial({
    ...crystalShader,
    uniforms: { uColor: { value: color }, uLock: { value: 0 }, uTime: time },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(crystalGeo),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  crystal.add(edges);

  const ringGeo = new THREE.TorusGeometry(1.55, 0.022, 8, 160);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const ringA = new THREE.Mesh(ringGeo, ringMat);
  const ringB = new THREE.Mesh(ringGeo, ringMat);

  const token = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const tokenGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  tokenGlow.scale.setScalar(1.6);
  token.add(tokenGlow);

  const dialMat = new THREE.ShaderMaterial({
    ...dialShader,
    uniforms: { uColor: { value: color }, uProgress: { value: 1 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const dial = new THREE.Mesh(new THREE.RingGeometry(1.95, 2.02, 160), dialMat);

  group.add(crystal, ringA, ringB, token, dial);
  return { group, crystal, crystalMat, ringA, ringB, ringMat, token, dialMat };
}

export function createHtlcScene(canvas: HTMLCanvasElement, store: HtlcStore, onFirstFrame: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  let dpr = Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x08080d, 9, 22);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const time = { value: 0 };
  const glow = glowTexture();

  const rig = new THREE.Group();
  scene.add(rig);

  const src = makeVault(VIOLET, glow, time);
  const dst = makeVault(MINT, glow, time);
  src.group.position.x = -SPAN;
  dst.group.position.x = SPAN;
  rig.add(src.group, dst.group);

  // Fusion+ order bridge: particles streaming both ways along the arc between the chains.
  const N = 1600;
  const bridgeGeo = new THREE.BufferGeometry();
  const aT = new Float32Array(N), aSpeed = new Float32Array(N), aDir = new Float32Array(N), aOff = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    aT[i] = Math.random();
    aSpeed[i] = 0.04 + Math.random() * 0.08;
    aDir[i] = i % 3 === 0 ? -1 : 1;
    aOff[i * 3] = (Math.random() - 0.5) * 0.6;
    aOff[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
    aOff[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
  }
  bridgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  bridgeGeo.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
  bridgeGeo.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
  bridgeGeo.setAttribute("aDir", new THREE.BufferAttribute(aDir, 1));
  bridgeGeo.setAttribute("aOff", new THREE.BufferAttribute(aOff, 3));
  const bridgeMat = new THREE.ShaderMaterial({
    ...bridgeShader,
    uniforms: {
      uTime: time,
      uIntensity: { value: 0.3 },
      uSpread: { value: 1 },
      uPixel: { value: dpr },
      uSpan: { value: SPAN },
      uArc: { value: ARC_H },
      uA: { value: VIOLET },
      uB: { value: MINT },
      uS: { value: AMBER },
      uReveal: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const bridge = new THREE.Points(bridgeGeo, bridgeMat);
  bridge.frustumCulled = false;
  rig.add(bridge);

  // The secret: an amber preimage caged by its hash (dodecahedron) at the apex of the bridge.
  const apex = bezier(0.5, new THREE.Vector3());
  const secret = new THREE.Group();
  secret.position.copy(apex);
  const secretGlowMat = new THREE.SpriteMaterial({ map: glow, color: AMBER, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const secretCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: AMBER }));
  const secretGlow = new THREE.Sprite(secretGlowMat);
  secretGlow.scale.setScalar(1.4);
  secretCore.add(secretGlow);
  const cageMat = new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.9 });
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(0.55, 0)), cageMat);
  secret.add(secretCore, cage);
  rig.add(secret);

  // Two key shards that travel from the apex to each vault on reveal.
  const keys = [0, 1].map(() => {
    const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: AMBER }));
    const g = new THREE.Sprite(secretGlowMat);
    g.scale.setScalar(1);
    k.add(g);
    rig.add(k);
    return k;
  });

  const floor = new THREE.GridHelper(40, 40, 0x2a2a40, 0x1a1a28);
  floor.position.y = -2.6;
  (floor.material as THREE.Material).transparent = true;
  (floor.material as THREE.Material).opacity = 0.6;
  scene.add(floor);

  // displayed state eases toward the scroll store so scrubbing never snaps
  const cur = { p: store.p, px: 0, py: 0 };
  let portrait = false;
  let width = 0, height = 0;
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    portrait = camera.aspect < 0.9;
    rig.rotation.z = portrait ? -Math.PI / 2 : 0;
    rig.scale.setScalar(portrait ? 0.5 : 1);
    // lift the subject so copy along the bottom stays clear of it
    camera.setViewOffset(width, height, 0, height * (portrait ? 0.2 : 0.16), width, height);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(canvas);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tmp = new THREE.Vector3();
  let raf = 0, last = performance.now(), slow = 0, first = true;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;

    // adaptive quality: drop to 1x if frames stay slow
    slow = dt > 0.022 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 90 && dpr > 1) {
      dpr = 1;
      renderer.setPixelRatio(1);
      bridgeMat.uniforms.uPixel.value = 1;
      resize();
    }

    time.value += dt * (reduced ? 0.2 : 1);
    const t = time.value;
    cur.p += (store.p - cur.p) * Math.min(1, dt * 6);
    cur.px += (store.px - cur.px) * Math.min(1, dt * 3);
    cur.py += (store.py - cur.py) * Math.min(1, dt * 3);
    const p = cur.p;

    const intent = ss(0.5, 1.2, p);
    const srcLock = ss(1.5, 2.2, p);
    const dstLock = ss(2.5, 3.2, p);
    const reveal = ss(3.3, 3.9, p);

    const vaults: [typeof src, number, number][] = [
      [src, srcLock, 0],
      [dst, dstLock, 1],
    ];
    for (const [v, lock, i] of vaults) {
      const open = 1 - lock;
      const wob = Math.sin(t * 0.5 + i * 2) * 1.1;
      v.ringA.rotation.set(mix(wob, Math.PI / 2, lock), mix(t * 0.35 + i, 0, lock), 0);
      v.ringB.rotation.set(mix(-wob * 0.8, 0, lock), mix(t * 0.25 - i, Math.PI / 2, lock), mix(0.6, 0, lock));
      const rs = mix(1.25, 0.82, lock);
      v.ringA.scale.setScalar(rs);
      v.ringB.scale.setScalar(rs);
      v.ringMat.opacity = 0.35 + lock * 0.6;
      v.crystal.rotation.y = t * (0.25 + open * 0.2) + i;
      v.crystal.rotation.x = Math.sin(t * 0.3 + i) * 0.3;
      v.crystalMat.uniforms.uLock.value = lock;
      // deposit: token drops into the vault when it locks
      v.token.position.y = (1 - lock) * 3.2;
      v.token.scale.setScalar(Math.max(0.001, lock));
      // timelock: dial appears with the lock and drains until the secret lands
      v.dialMat.uniforms.uOpacity.value = lock;
      v.dialMat.uniforms.uProgress.value = 1 - 0.55 * ss(i === 0 ? 1.5 : 2.5, 3.9, p);
    }

    secret.visible = reveal < 0.999;
    secretCore.scale.setScalar(mix(0.6, 1, intent) * (1 - reveal));
    secretCore.rotation.y = t * 1.2;
    cage.scale.setScalar(intent * (1 + reveal * 1.8));
    cage.rotation.set(t * 0.4, t * 0.3, 0);
    cageMat.opacity = 0.9 * intent * (1 - reveal);
    keys.forEach((k, i) => {
      bezier(0.5 + (i === 0 ? -0.5 : 0.5) * reveal, tmp);
      k.position.copy(tmp);
      k.visible = reveal > 0.001;
      k.rotation.y = t * 3;
    });

    bridgeMat.uniforms.uIntensity.value = 0.25 + intent * 0.35 + (srcLock + dstLock) * 0.12 + reveal * 0.2;
    bridgeMat.uniforms.uSpread.value = 1 - (srcLock + dstLock) * 0.3;
    bridgeMat.uniforms.uReveal.value = reveal;

    // camera leans toward whichever chain is acting in the current chapter
    const lean = -1.1 * (ss(1.3, 2, p) - ss(2.3, 2.9, p)) + 1.1 * (ss(2.3, 2.9, p) - ss(3.3, 3.9, p));
    const z = portrait ? 12.5 : 12 - intent * 0.6;
    if (portrait) camera.position.set(cur.px * 0.4, -lean * 0.3, z);
    else camera.position.set(lean + cur.px * 0.7, 1.1 + cur.py * 0.4 + reveal * 0.4, z);
    camera.lookAt(portrait ? 0 : lean * 0.7, portrait ? -lean * 0.2 : 0.5, 0);
    (scene.fog as THREE.Fog).near = z - 1.5;
    (scene.fog as THREE.Fog).far = z + 12;

    renderer.render(scene, camera);
    if (first) {
      first = false;
      onFirstFrame();
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    glow.dispose();
    renderer.dispose();
  };
}
