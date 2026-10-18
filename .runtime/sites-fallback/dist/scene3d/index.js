// Mindline sign-in: a modern glass testing lab on a riverbank. Engine ported from the bongaus terrace
// scene: the core paints sky and river immediately, lays out shimmering ghost placeholders, then streams
// each part in as its own module (deck -> pavilion -> lab -> trees -> far bank -> garden -> lights) and builds it in with a
// glinting shimmer front. Quiet Light = late morning, Matte Dark = blue dusk with the lab glowing warm.
// Night-only extras load the first time dark mode is shown.
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {THREE, V3, U, DAY, DUSK, NIGHT, SUN, MOON, col, lerpC, lerp, ghost, addShimmer} from './kit.js';

// Ghosts are rough stand-ins in world space: [shape, size, position, rotationY].
const PARTS = [
  {name: 'deck', load: () => import('./deck.js'), ghost: [
    ['box', [8.6, .3, 5.2], [5.2, -.15, -5.6]], ['box', [16, .1, 2.4], [3, .05, -1.6]]]},
  {name: 'pavilion', load: () => import('./pavilion.js'), ghost: [
    ['box', [6.6, 3.0, 4.0], [5.2, 1.5, -5.6]], ['box', [7.8, .18, 5.2], [5.2, 3.15, -5.6]]]},
  {name: 'lab', load: () => import('./lab.js'), ghost: [
    ['box', [4.4, .95, .7], [4.4, .48, -7.0]], ['box', [1.25, 2.1, .8], [7.35, 1.05, -7.0]], ['box', [.7, .7, .6], [2.75, 1.27, -7.0]]]},
  {name: 'trees', load: () => import('./trees.js'), ghost: [
    ['pill', [.3, 5, .3], [10.6, 2.5, -2.6]], ['round', [2.4, 2.6, 2.2], [10.6, 5.2, -2.6]], ['box', [1.6, .5, .6], [-.4, .25, -2.2]]]},
  {name: 'farbank', load: () => import('./farbank.js'), ghost: null},
  {name: 'garden', load: () => import('./garden.js'), ghost: null},
  {name: 'lights', load: () => import('./lights.js'), ghost: null}
];
const NIGHT_PART = {name: 'night', load: () => import('./night.js'), ghost: null};

export function mount(container, {onReady, onProgress, framing, background = false} = {}) {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(screen.width, screen.height) < 700 || innerWidth < 700;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const detail = small || weak ? .6 : 1;

  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, detail < 1 ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'scene3d';
  container.append(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(DAY.fog, 90, 620);
  const camera = new THREE.PerspectiveCamera(34, 1.45, .1, 2000);
  // a gentle 3/4 view from the near bank: high enough to see over the deck into the lab, low enough to keep the sky
  const VIEW = {target: V3(6.2, 1.5, -4.4), polar: 1.36, azimuth: .14};
  camera.position.setFromSphericalCoords(16, VIEW.polar, VIEW.azimuth).add(VIEW.target);

  const skyMat = buildSky(scene), seaMat = buildSea(scene);
  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
  const key = new THREE.DirectionalLight(DAY.key, DAY.keyI);
  key.castShadow = true;
  key.shadow.mapSize.set(detail < 1 ? 1024 : 2048, detail < 1 ? 1024 : 2048);
  Object.assign(key.shadow.camera, {left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34});
  key.target.position.set(4.5, 0, -4);
  scene.add(key.target);
  key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 4;
  const fill = new THREE.DirectionalLight('#fff6ec', DAY.fill);
  fill.position.set(6, 4, -8);
  scene.add(hemi, key, fill);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(VIEW.target);
  Object.assign(controls, {enablePan: false, enableDamping: true, dampingFactor: .06, rotateSpeed: .45, zoomSpeed: .6,
    minAzimuthAngle: -.5, maxAzimuthAngle: .5});
  // left/right orbit only; up/down is held to a sliver around the starting tilt
  const tilt = Math.acos((camera.position.y - controls.target.y) / camera.position.distanceTo(controls.target));
  controls.minPolarAngle = tilt - .025;
  controls.maxPolarAngle = tilt + .025;
  canvas.style.touchAction = 'pan-y';  // vertical swipes keep scrolling the page on phones
  if (background) controls.enableZoom = false;  // the wheel keeps scrolling the page

  // ---------------------------------------------------------------- parts: ghost → stream → shimmer build-in
  const live = [];          // attached parts: {name, tick, theme, S, t, shadowMeshes, ghost}
  const ghosts = new Map(); // name → ghost group
  let clock = 0, lastReveal = -1, loaded = 0;
  const total = PARTS.length;
  const idle = () => new Promise(r => (window.requestIdleCallback || (f => setTimeout(f, 16)))(() => r(), {timeout: 400}));

  function addGhosts() {
    if (reduced) return;
    PARTS.forEach(p => {
      if (!p.ghost) return;
      const g = ghost(p.ghost);
      g.userData.born = clock;
      scene.add(g); ghosts.set(p.name, g);
    });
  }
  function attach(part, built) {
    const {group} = built;
    const shadowMeshes = [];
    group.traverse(o => { if (o.isMesh && o.castShadow && built.shadows !== false) shadowMeshes.push(o); if (o.isMesh) o.castShadow = false; });
    scene.add(group);
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const S = {reveal: {value: reduced || built.instant ? 1 : 0}, sheen: {value: reduced || built.instant ? 1 : 0},
      low: {value: box.min.y}, high: {value: box.max.y}, dlow: {value: box.min.x * .45 + box.min.y * .55}, dhigh: {value: box.max.x * .45 + box.max.y * .55}};
    group.traverse(o => { if (o.material) [].concat(o.material).forEach(m => addShimmer(m, S)); });
    // start after the previous part has had a moment, so the build reads as a sequence
    const start = Math.max(clock, lastReveal + .28);
    lastReveal = start;
    const entry = {name: part.name, tick: built.tick, theme: built.theme, S, start, shadowMeshes, ghost: ghosts.get(part.name), size: box.max.y - box.min.y};
    if (entry.theme) entry.theme(U.night.value, phase);
    if (S.reveal.value >= 1) shadowMeshes.forEach(m => { m.castShadow = true; });
    live.push(entry);
    loaded += part === NIGHT_PART ? 0 : 1;
    container.dataset.parts = loaded + '/' + total;
    onProgress && onProgress(loaded, total, part.name);
    wake(2600);
  }
  async function stream(part) {
    try {
      const mod = await part.load();
      await idle();
      if (destroyed) return;
      attach(part, mod.build({detail}));
    } catch (err) {
      console.warn('scene3d: could not load part', part.name, err);
      const g = ghosts.get(part.name);
      if (g) { scene.remove(g); ghosts.delete(part.name); }
    }
  }
  async function streamAll() {
    // fetch every module in parallel, build them one by one in priority order during idle time
    const fetched = PARTS.map(p => p.load().then(() => p, () => p));
    for (const f of fetched) await stream(await f);
  }
  let nightLoading = false;
  function ensureNight() { if (!nightLoading) { nightLoading = true; stream(NIGHT_PART); } }

  function stepParts(dt) {
    for (const e of live) {
      const S = e.S;
      if (S.reveal.value < 1) {
        const dur = 1.1 + Math.min(1.2, e.size * .12);
        const t = Math.max(0, clock - e.start) / dur;
        S.reveal.value = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
        if (e.ghost && clock >= e.start) e.ghost.userData.fade.value = Math.max(0, e.ghost.userData.fade.value - dt * 1.6);
        if (S.reveal.value > .7 && e.shadowMeshes.length) { e.shadowMeshes.forEach(m => { m.castShadow = true; }); e.shadowMeshes = []; }
        if (S.reveal.value >= 1) S.sheenStart = clock;
      } else if (S.sheen.value < 1) {
        S.sheen.value = Math.min(1, (clock - (S.sheenStart || clock)) / 1.2);
      }
      if (e.ghost && (S.reveal.value >= 1 || e.ghost.userData.fade.value <= 0)) {
        e.ghost.userData.fade.value -= dt * 2;
        if (e.ghost.userData.fade.value <= 0) { scene.remove(e.ghost); ghosts.delete(e.name); e.ghost = null; }
      }
      if (e.tick) e.tick(U.time.value, dt);
    }
    ghosts.forEach(g => {
      if (live.some(e => e.ghost === g)) return;
      g.userData.fade.value = Math.min(1, (clock - g.userData.born) * 1.8);
    });
  }
  const revealing = () => ghosts.size > 0 || live.some(e => e.S.reveal.value < 1 || e.S.sheen.value < 1);

  // ---------------------------------------------------------------- time of day: light = day, dark = night
  // Switching theme doesn't crossfade: `phase` walks 0 (day) → 1 (night) over a few seconds. The sun sinks
  // behind the far hills through a golden, then rose dusk, the moon rises on the right, and the lights come
  // on one by one as the sun goes. Back to light runs the same path in reverse.
  const isNight = () => document.documentElement.dataset.theme === 'matte-dark';
  const TRANSITION = 6;   // seconds, end to end
  let phaseTarget = isNight() ? 1 : 0, phase = phaseTarget;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pal = (k, p, out) => p < .5 ? lerpC(DAY[k], DUSK[k], p * 2, out) : lerpC(DUSK[k], NIGHT[k], p * 2 - 1, out);
  const paln = (k, p) => p < .5 ? lerp(DAY[k], DUSK[k], p * 2) : lerp(DUSK[k], NIGHT[k], p * 2 - 1);
  const sunDir = V3(0, 0, 0), moonDir = V3(0, 0, 0);
  const KEY = [V3(-3, 10, 9), V3(-7, 2.6, -11), V3(9, 9, -7)];   // day, golden hour (low, behind: long shadows), night
  function applyPhase(p) {
    const su = skyMat.uniforms, se = seaMat.uniforms;
    // the sun sets down and to the left; the moon rises on the right once it has gone
    // (it starts only a few degrees up, so the path is short and slow; the far hills hide it as it goes)
    // slides slowly down to the ridge for the first ~40% (a real sunset), then dips out of sight
    const sunY = p < .4 ? lerp(SUN.y, .028, p / .4) : lerp(.028, -.04, ss(.4, .56, p)), mp = ss(.5, 1, p);
    sunDir.set(SUN.x - (SUN.y - sunY) * 1.2, sunY, -1).normalize();
    moonDir.set(lerp(.2, MOON.x, mp), lerp(.0, MOON.y, mp), -1).normalize();
    const sunA = 1 - ss(.38, .56, p), moonA = ss(.5, .72, p);
    su.uSun.value.copy(sunDir); su.uMoon.value.copy(moonDir); su.uSunA.value = sunA; su.uMoonA.value = moonA;
    pal('skyTop', p, su.uTop.value); pal('skyHorizon', p, su.uHorizon.value); pal('glow', p, su.uGlow.value); pal('disc', p, su.uDisc.value);
    pal('seaDeep', p, se.uDeep.value); pal('seaNear', p, se.uNear.value); pal('seaHorizon', p, se.uHorizon.value); pal('spec', p, se.uSpec.value);
    pal('bank', p, se.uBank.value); pal('warm', p, se.uWarm.value);
    U.lightDir.value.copy(sunA >= moonA ? sunDir : moonDir);
    pal('fog', p, scene.fog.color);
    pal('hemiSky', p, hemi.color); pal('hemiGround', p, hemi.groundColor); hemi.intensity = paln('hemi', p);
    pal('key', p, key.color); key.intensity = paln('keyI', p) * (.35 + .65 * Math.max(sunA, moonA * .8, p > .9 ? 1 : 0));
    if (p < .5) key.position.lerpVectors(KEY[0], KEY[1], ss(0, 1, p * 2)); else key.position.lerpVectors(KEY[1], KEY[2], ss(0, 1, p * 2 - 1));
    fill.intensity = paln('fill', p);
    renderer.toneMappingExposure = paln('exposure', p);
    pal('shimmer', p, U.shimmer.value); pal('ghost', p, U.ghost.value); pal('ghostHi', p, U.ghostHi.value);
    renderer.setClearColor(su.uHorizon.value);
    // the lights: off in daylight, coming on through dusk (each part staggers its own)
    const lights = ss(.28, .85, p);
    U.night.value = lights;
    live.forEach(e => e.theme && e.theme(lights, p));
  }
  applyPhase(phase);
  const onTheme = () => { phaseTarget = isNight() ? 1 : 0; if (phaseTarget) ensureNight(); wake(); };
  const themeObserver = new MutationObserver(onTheme);
  themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

  // ---------------------------------------------------------------- cursor breeze
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = V3(0, 0, 0), look = V3(0, 0, 0);
  const pointerTarget = V3(0, -50, 0);
  let lastHit = null, gustTarget = 0, lastMove = 0, interacting = false, idleSince = 0;
  const onMove = e => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(look).negate(), V3(0, 1.8, 0));
    if (ray.ray.intersectPlane(plane, hit)) {
      if (lastHit) gustTarget = Math.min(1.6, gustTarget + hit.distanceTo(lastHit) * 1.8);
      lastHit = (lastHit || V3(0, 0, 0)).copy(hit);
      pointerTarget.copy(hit);
    }
    lastMove = performance.now();
    wake();
  };
  const onLeave = () => { lastHit = null; pointerTarget.set(0, -50, 0); };
  // As a page background the canvas sits under the content, so listen on the whole window.
  const moveTarget = background ? window : canvas;
  moveTarget.addEventListener('pointermove', onMove, {passive: true});
  (background ? document.documentElement : canvas).addEventListener('pointerleave', onLeave);
  controls.addEventListener('start', () => { interacting = true; container.classList.add('grabbing', 'touched'); wake(); });
  controls.addEventListener('end', () => { interacting = false; idleSince = performance.now(); container.classList.remove('grabbing'); });
  controls.addEventListener('change', () => wake());

  // ---------------------------------------------------------------- sizing: keep the terrace framed at any size
  // `framing()` says where on the canvas the terrace should sit ({x0, x1, y0, y1} as fractions). The camera
  // keeps orbiting the terrace; a lens shift (view offset) slides it into that region, and the distance
  // is chosen so the whole terrace fits inside it.
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const f = Object.assign({x0: 0, x1: 1, y0: 0, y1: 1}, framing ? framing(w, h) : null);
    const fw = Math.max(.3, f.x1 - f.x0), fh = Math.max(.3, f.y1 - f.y0);
    camera.aspect = aspect;
    camera.fov = aspect < .8 ? 46 : aspect < 1.3 ? 40 : 34;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = aspect < 1.15 ? 6.6 : 7.2;  // the pavilion plus the birch beside it; on tall screens the birch may crop
    const dist = Math.max(halfW / (tan * aspect * fw), 3.4 / (tan * fh), 10);
    camera.setViewOffset(w, h, (.5 - (f.x0 + f.x1) / 2) * w, (.5 - (f.y0 + f.y1) / 2) * h, w, h);
    camera.updateProjectionMatrix();
    controls.minDistance = dist * (background ? .98 : .82);
    controls.maxDistance = dist * (background ? 1.02 : 1.12);
    const toCamera = camera.position.clone().sub(controls.target).setLength(dist);
    camera.position.copy(controls.target).add(toCamera);
    controls.update();
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const onWinResize = () => resize();
  window.addEventListener('resize', onWinResize);

  // ---------------------------------------------------------------- loop: pauses when hidden, off-screen, or settled
  let visible = true, running = false, raf = 0, last = 0, ready = false, settleUntil = 0, destroyed = false;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) wake(); });
  io.observe(container);
  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener('visibilitychange', onVis);
  function wake(ms) {
    settleUntil = Math.max(settleUntil, performance.now() + (ms || 1600));
    if (!running && !destroyed && visible && !document.hidden) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  const spherical = new THREE.Spherical(), offset = V3(0, 0, 0);
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    clock += dt;
    if (!reduced) U.time.value += dt;
    if (phase !== phaseTarget) {
      const step = reduced ? 1 : dt / TRANSITION;
      phase = phaseTarget > phase ? Math.min(phaseTarget, phase + step) : Math.max(phaseTarget, phase - step);
      applyPhase(phase);
      settleUntil = Math.max(settleUntil, now + 400);
    }
    U.pointer.value.lerp(pointerTarget, Math.min(1, dt * 6));
    gustTarget *= Math.pow(.18, dt);
    U.gust.value += (gustTarget - U.gust.value) * Math.min(1, dt * 5);
    U.wind.value = .35 + U.gust.value * .4;
    stepParts(dt);
    if (!reduced && !interacting && now - idleSince > 3000 && now - lastMove > 3000) {
      offset.copy(camera.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.theta += Math.sin(U.time.value * .08) * .00035;
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    }
    controls.update();
    renderer.render(scene, camera);
    if (!ready) { ready = true; onReady && requestAnimationFrame(() => onReady()); }
    if (visible && !document.hidden && (!reduced || now < settleUntil || interacting || revealing())) raf = requestAnimationFrame(frame);
    else running = false;
  }
  resize();
  // start fetching parts now, not on the first frame: a background tab may not paint for a while
  addGhosts();
  streamAll();
  if (phaseTarget) ensureNight();
  wake();

  return {
    get progress() { return {loaded, total}; },
    camera, controls, resize,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', onWinResize);
      moveTarget.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      (background ? document.documentElement : canvas).removeEventListener('pointerleave', onLeave);
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        [].concat(o.material || []).forEach(m => { Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); }); m.dispose(); });
      });
      if (key.shadow.map) key.shadow.map.dispose();
      controls.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    }
  };
}

// ---------------------------------------------------------------- sky + sea (part of the core, painted first)
function buildSky(scene) {
  // a gradient dome with the sun and the moon as separate discs, each with its own glow and visibility,
  // so one can set while the other rises
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {uTop: {value: col(DAY.skyTop)}, uHorizon: {value: col(DAY.skyHorizon)}, uGlow: {value: col(DAY.glow)}, uDisc: {value: col(DAY.disc)},
      uSun: {value: SUN.clone()}, uMoon: {value: MOON.clone()}, uSunA: {value: 1}, uMoonA: {value: 0},
      uMoonGlow: {value: col('#8fa8d6')}, uMoonDisc: {value: col('#f4f1e6')}},
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHorizon, uGlow, uDisc, uSun, uMoon, uMoonGlow, uMoonDisc; uniform float uSunA, uMoonA; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = mix(uHorizon, uTop, pow(clamp(d.y, 0.0, 1.0), .55));
        float above = smoothstep(-.004, .006, d.y);
        float cs = max(dot(d, normalize(uSun)), 0.0);
        c += uGlow * (pow(cs, 7.0) * .22 + pow(cs, 18.0) * .5 + pow(cs, 400.0) * .6) * uSunA;
        c = mix(c, uDisc, smoothstep(cos(.034), cos(.0306), cs) * above * min(1.0, uSunA * 3.0));
        float cm = max(dot(d, normalize(uMoon)), 0.0);
        c += uMoonGlow * (pow(cm, 60.0) * .35 + pow(cm, 900.0) * .4) * uMoonA;
        c = mix(c, uMoonDisc, smoothstep(cos(.022), cos(.0198), cm) * above * min(1.0, uMoonA * 3.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat));
  return mat;
}
function buildSea(scene) {
  // A calm, wide river: the bongaus sea shader, slowed and finer, with the far bank mirrored as a soft
  // dark band and, at dusk, the lab's warm light spilling onto the water round its platform.
  const mat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {uTime: U.time, uNight: U.night, uLight: U.lightDir, uDeep: {value: col(DAY.seaDeep)}, uNear: {value: col(DAY.seaNear)},
      uHorizon: {value: col(DAY.seaHorizon)}, uSpec: {value: col(DAY.spec)}, uBank: {value: col(DAY.bank)}, uWarm: {value: col(DAY.warm)},
      uGlow: {value: new THREE.Vector2(5.2, -5.6)}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uNight; uniform vec3 uLight, uDeep, uNear, uHorizon, uSpec, uBank, uWarm; uniform vec2 uGlow; varying vec3 vW;
      void main(){
        vec2 p = vW.xz; float t = uTime * .45; vec2 grad = vec2(0.0);
        grad += vec2(.8, .22) * cos(p.x * .8 + p.y * .22 + t * .9) * .4;
        grad += vec2(.25, 1.1) * cos(p.x * .25 + p.y * 1.1 - t * .7) * .3;
        grad += vec2(2.0, 1.5) * cos(p.x * 2.0 + p.y * 1.5 + t * 1.7) * .1;
        grad += vec2(-3.6, 2.8) * cos(-p.x * 3.6 + p.y * 2.8 + t * 2.3) * .04;
        vec3 n = normalize(vec3(-grad.x * .22, 1.0, -grad.y * .22));
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(vW.xz - cameraPosition.xz);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 c = mix(uNear, uDeep, smoothstep(8.0, 45.0, dist));
        c = mix(c, uHorizon, clamp(fres * 1.1, 0.0, 1.0) * .8);
        float bank = smoothstep(-24.0, -38.0, p.y) * (.55 + .1 * n.x);   // the far bank, mirrored
        c = mix(c, uBank, bank * .55);
        float s = max(dot(reflect(-V, n), normalize(uLight)), 0.0);
        c += uSpec * (pow(s, 260.0) * 2.4 + pow(s, 40.0) * .3) * mix(1.0, .8, uNight) * (1.0 - bank * .6);
        vec2 g = (p - uGlow) / vec2(6.5, 5.0);
        float pool = exp(-dot(g, g)) + .5 * exp(-pow((p.x - uGlow.x) / 2.4, 2.0)) * smoothstep(-5.0, -9.0, p.y) * smoothstep(-34.0, -12.0, p.y);
        float ripple = .55 + .45 * sin(p.y * 6.0 + n.x * 40.0 + uTime * .8);
        c += uWarm * uNight * pool * ripple * .55;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 160), mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -.55, -82);
  scene.add(sea);
  return mat;
}
