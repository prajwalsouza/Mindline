// Shared pieces for the terrace scene: seeded randomness, mesh helpers, the wind shader,
// and the shimmer used while parts stream in (ghost placeholders + a glinting build-in front).
import * as THREE from 'three';

export {THREE};

// ---------------------------------------------------------------- randomness + small helpers
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function random(seed) {
  const R = rng(seed);
  return {R, rand: (a, b) => a + (b - a) * R(), pick: list => list[Math.floor(R() * list.length)]};
}
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const col = hex => new THREE.Color(hex);
export const lerpC = (a, b, t, out) => out.copy(col(a)).lerp(col(b), t);
export const lerp = THREE.MathUtils.lerp;

export function canvasTex(w, h, draw, transparent) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!transparent) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({color, roughness: .92, metalness: 0}, extra || {}));
export function mesh(geo, mat, opts) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !(opts && opts.noCast);
  m.receiveShadow = true;
  return m;
}
export function limb(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = mesh(new THREE.CapsuleGeometry(r, Math.max(.001, dir.length()), 6, 14), mat);
  m.position.copy(a).addScaledVector(dir, .5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.normalize());
  return m;
}
export function lathe(points, mat, segs) {
  return mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segs || 40), mat);
}

// ---------------------------------------------------------------- shared uniforms
export const U = {
  time: {value: 0}, wind: {value: .35}, gust: {value: 0}, pointer: {value: V3(0, -50, 0)}, night: {value: 0},
  lightDir: {value: V3(-.07, .07, -1).normalize()},
  shimmer: {value: col('#fff7ea')}, ghost: {value: col('#ebe4d8')}, ghostHi: {value: col('#fbf8f2')}
};
export const SUN = V3(-.07, .07, -1).normalize();
export const MOON = V3(.1, .085, -1).normalize();

// ---------------------------------------------------------------- palettes (day ↔ night)
export const DAY = {
  skyTop: '#d9e8f0', skyHorizon: '#fbf2e8', seaDeep: '#86aebb', seaNear: '#a3c4cb', seaHorizon: '#e6edec', bank: '#9fb19a', warm: '#ffc483', glow: '#ffe3c2', disc: '#fde2c4', spec: '#fff4e0',
  fog: '#f4efe8', hemiSky: '#f3f6f8', hemiGround: '#efe3d2', hemi: 1.35, key: '#fff3e2', keyI: 2.4, fill: .6, exposure: 1.02,
  shimmer: '#fff7ea', ghost: '#e9e2d6', ghostHi: '#fdfaf5'
};
// golden hour into dusk: the middle of the day → night transition
export const DUSK = {
  skyTop: '#55648f', skyHorizon: '#f4ab84', seaDeep: '#56617c', seaNear: '#7d8098', seaHorizon: '#f0b494', bank: '#46495a', warm: '#ffb070', glow: '#ffae78', disc: '#ffbe86', spec: '#ffd4ae',
  fog: '#d7a796', hemiSky: '#d6b4b8', hemiGround: '#6f5c5a', hemi: .95, key: '#ffb27c', keyI: 1.7, fill: .32, exposure: 1.06,
  shimmer: '#ffe2c8', ghost: '#7d6d7a', ghostHi: '#d0aca4'
};
export const NIGHT = {
  skyTop: '#07101f', skyHorizon: '#1f3552', seaDeep: '#0c1c2e', seaNear: '#16304a', seaHorizon: '#243c58', bank: '#0a1420', warm: '#ffb86e', glow: '#8fa8d6', disc: '#f4f1e6', spec: '#dfe6f5',
  fog: '#15223a', hemiSky: '#3a4f78', hemiGround: '#1a1f2b', hemi: .55, key: '#a9bde4', keyI: .75, fill: .12, exposure: 1.15,
  shimmer: '#cfe0ff', ghost: '#1d2a40', ghostHi: '#3b5078'
};

// ---------------------------------------------------------------- glass
// A small painted environment (sky, the far bank, the river) for glass to reflect, and the two glass
// materials: clear glazing that stays see-through, and lab glass with real transmission.
let envTex = null;
export function glassEnv() {
  if (envTex) return envTex;
  envTex = canvasTex(512, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * .5);
    sky.addColorStop(0, '#cfe0ea'); sky.addColorStop(1, '#fbf3e8');
    g.fillStyle = sky; g.fillRect(0, 0, w, h * .5);
    g.fillStyle = '#9fb19a'; for (let x = 0; x < w; x += 6) { const t = 6 + Math.abs(Math.sin(x * .07) * 10 + Math.sin(x * .023) * 6); g.fillRect(x, h * .5 - t, 6, t); }
    const water = g.createLinearGradient(0, h * .5, 0, h);
    water.addColorStop(0, '#c9d8d8'); water.addColorStop(1, '#8fb1b8');
    g.fillStyle = water; g.fillRect(0, h * .5, w, h * .5);
    g.fillStyle = 'rgba(255,250,238,.95)'; g.beginPath(); g.ellipse(w * .25, h * .28, 26, 16, 0, 0, 7); g.fill();
  });
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  return envTex;
}
export const glazing = extra => new THREE.MeshPhysicalMaterial(Object.assign({color: '#f4f8f8', metalness: 0, roughness: .03, transparent: true, opacity: .16,
  envMap: glassEnv(), envMapIntensity: 1.6, specularIntensity: 1, depthWrite: false, side: THREE.DoubleSide}, extra || {}));
export const labGlass = extra => new THREE.MeshPhysicalMaterial(Object.assign({color: '#ffffff', metalness: 0, roughness: .04, transmission: 1, thickness: .04, ior: 1.5,
  envMap: glassEnv(), envMapIntensity: 1.3, specularIntensity: 1, transparent: true, side: THREE.DoubleSide}, extra || {}));

// Sparkles: tiny twinkling glints placed on glass rims, so the glassware catches the light.
export function glints(points, size = 1) {
  const pos = new Float32Array(points.length * 3), seed = new Float32Array(points.length);
  points.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); seed[i] = (i * .618) % 1; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: U.time, uNight: U.night, uSize: {value: size}},
    vertexShader: `attribute float seed; uniform float uTime, uSize; varying float vA;
      void main(){ float tw = .5 + .5 * sin(uTime * (.7 + seed * 1.3) + seed * 40.0); vA = pow(tw, 6.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (6.0 + 10.0 * vA) * 10.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight; varying float vA;
      void main(){ vec2 q = gl_PointCoord - .5; float star = max(0.0, 1.0 - length(q) * 2.0); float cross = max(0.0, 1.0 - abs(q.x) * 14.0) * max(0.0, 1.0 - abs(q.y) * 2.0) + max(0.0, 1.0 - abs(q.y) * 14.0) * max(0.0, 1.0 - abs(q.x) * 2.0);
        float a = (pow(star, 3.0) + cross * .5) * vA; vec3 c = mix(vec3(1.0, .97, .9), vec3(1.0, .82, .6), uNight);
        gl_FragColor = vec4(c, a * mix(.9, .6, uNight)); }`
  }));
  pts.frustumCulled = false;
  return pts;
}

// The arch wall sits here; the bougainvillea (garden part) is placed in the same frame.
export const WALL = {x: -4.75, z: -1.05, ry: .42};
export function wallFrame() {
  const g = new THREE.Group();
  g.position.set(WALL.x, 0, WALL.z);
  g.rotation.y = WALL.ry;
  return g;
}

// ---------------------------------------------------------------- wind on foliage
// A gentle breeze everywhere plus a push away from the cursor. Displacement is computed in
// world space, then mapped back into each instance's local space.
export function windMaterial(opts) {
  const m = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .8, metalness: 0, side: THREE.DoubleSide, vertexColors: !!opts.vertexColors});
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {uTime: U.time, uWind: U.wind, uGust: U.gust, uPointer: U.pointer, uFlex: {value: opts.flex}, uLen: {value: opts.len}});
    shader.vertexShader = 'uniform float uTime; uniform float uWind; uniform float uGust; uniform vec3 uPointer; uniform float uFlex; uniform float uLen;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        mat4 iw = modelMatrix * instanceMatrix;
      #else
        mat4 iw = modelMatrix;
      #endif
      vec3 ip = iw[3].xyz;
      float ph = dot(ip, vec3(1.7, 2.3, 1.3));
      float along = clamp(position.y / uLen, 0.0, 1.0);
      vec3 s = vec3(sin(uTime * 1.7 + ph), .35 * sin(uTime * 2.3 + ph * 1.3), cos(uTime * 1.3 + ph * .7)) * (.012 + .035 * uWind);
      vec3 away = ip - uPointer;
      float infl = exp(-dot(away, away) / 1.6) * uGust;
      s += normalize(away + vec3(0.0, .001, 0.0)) * infl * .18;
      s += vec3(sin(uTime * 11.0 + ph * 3.0), cos(uTime * 9.0 + ph * 2.0), sin(uTime * 7.0 + ph)) * infl * .035;
      mat3 Rm = mat3(iw);
      float sc = max(dot(Rm[0], Rm[0]), 1e-4);
      transformed += (transpose(Rm) * s) / sc * uFlex * (.35 + along);`);
  };
  m.customProgramCacheKey = () => 'wind';
  return m;
}

export function leafGeo(w, l) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(w, l * .45, 0, l); s.quadraticCurveTo(-w, l * .45, 0, 0);
  return new THREE.ShapeGeometry(s, 5);
}
export function flowerGeo(r) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 40; i++) {
    const a = i / 40 * Math.PI * 2, rr = r * (.7 + .3 * Math.cos(a * 5));
    i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + r) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr + r);
  }
  return new THREE.ShapeGeometry(s, 1);
}
export function instanced(geo, mat, n, place) {
  const im = new THREE.InstancedMesh(geo, mat, n);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < n; i++) { place(i, d, c); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c); }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = true; im.receiveShadow = true;
  return im;
}
export function foliageAlongCurve(r, curve, n, spread, geo, mat, colors, scale, bias) {
  return instanced(geo, mat, n, (i, d, c) => {
    const p = curve.getPoint(Math.pow(r.R(), bias || 1));
    d.position.set(p.x + r.rand(-spread, spread), p.y + r.rand(-spread, spread * .8), p.z + r.rand(-spread * .6, spread * .6));
    d.rotation.set(r.rand(0, Math.PI * 2), r.rand(0, Math.PI * 2), r.rand(0, Math.PI * 2));
    d.scale.setScalar(r.rand(scale[0], scale[1]));
    c.set(r.pick(colors)).offsetHSL(r.rand(-.01, .01), r.rand(-.04, .04), r.rand(-.04, .04));
  });
}
export function foliageInBlobs(r, blobs, n, geo, mat, colors, scale) {
  return instanced(geo, mat, n, (i, d, c) => {
    const b = blobs[Math.floor(r.R() * blobs.length)];
    const u = r.R() * Math.PI * 2, v = Math.acos(2 * r.R() - 1), k = Math.cbrt(r.R());
    d.position.set(b.x + Math.sin(v) * Math.cos(u) * b.rx * k, b.y + Math.cos(v) * b.ry * k, b.z + Math.sin(v) * Math.sin(u) * b.rz * k);
    d.rotation.set(r.rand(-1.2, 1.2), r.rand(0, Math.PI * 2), r.rand(-1.2, 1.2));
    d.scale.set(r.rand(scale[0], scale[1]) * .8, r.rand(scale[0], scale[1]), 1);
    c.set(r.pick(colors)).offsetHSL(0, r.rand(-.05, .05), r.rand(-.05, .05));
  });
}

// ---------------------------------------------------------------- shimmer build-in
// Each streamed part materialises from the ground up: fragments above a noisy front are cut,
// and a glinting band rides the front. Once built, one soft sheen sweeps diagonally across it.
const SH_HEAD = `uniform float uReveal, uSheen, uLow, uHigh, uDLow, uDHigh, uSTime; uniform vec3 uShimmer; varying vec3 vShW;
float shHash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float shNoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(shHash(i), shHash(i + vec3(1,0,0)), f.x), mix(shHash(i + vec3(0,1,0)), shHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(shHash(i + vec3(0,0,1)), shHash(i + vec3(1,0,1)), f.x), mix(shHash(i + vec3(0,1,1)), shHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
export function addShimmer(mat, S) {
  if (!(mat.isMeshStandardMaterial) || mat.userData.shimmer) return;
  mat.userData.shimmer = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    Object.assign(shader.uniforms, {uReveal: S.reveal, uSheen: S.sheen, uLow: S.low, uHigh: S.high, uDLow: S.dlow, uDHigh: S.dhigh, uSTime: U.time, uShimmer: U.shimmer});
    shader.vertexShader = 'varying vec3 vShW;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vShW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vShW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    shader.fragmentShader = SH_HEAD + shader.fragmentShader
      .replace('void main() {', `void main() {
        float shFront = mix(uLow - .4, uHigh + .8, uReveal);
        float shC = vShW.y + (shNoise(vShW * 5.0) - .5) * .45;
        if (uReveal < 1.0 && shC > shFront) discard;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uReveal < 1.0) {
          float shEdge = 1.0 - smoothstep(0.0, .38, shFront - shC);
          float shGlint = .6 + .4 * sin(uSTime * 10.0 + vShW.x * 9.0 + vShW.z * 6.0 + vShW.y * 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uShimmer * 1.15, shEdge * shGlint * .9);
        }
        if (uSheen > 0.0 && uSheen < 1.0) {
          float shD = vShW.x * .45 + vShW.y * .55;
          float shB = exp(-pow((shD - mix(uDLow - 1.0, uDHigh + 1.0, uSheen)) / .32, 2.0));
          gl_FragColor.rgb += uShimmer * shB * .28;
        }`);
  };
  mat.customProgramCacheKey = () => 'shimmer|' + prevKey();
  mat.needsUpdate = true;
}

// Ghost placeholders: soft shapes where a part will appear, with a skeleton-style shimmer band
// sweeping across them until the real geometry arrives.
let ghostBase = null;
function ghostMaterial() {
  if (!ghostBase) ghostBase = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: {uTime: U.time, uBase: U.ghost, uHi: U.ghostHi, uFade: {value: 0}},
    vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uFade; uniform vec3 uBase, uHi; varying vec3 vW; varying vec3 vN;
      void main(){
        float d = vW.x * .55 + vW.y * .45 - uTime * 3.2;
        float b = pow(1.0 - abs(fract(d / 8.0) - .5) * 2.0, 8.0);
        float l = .82 + .18 * dot(normalize(vN), normalize(vec3(-.3, .9, .5)));
        vec3 c = mix(uBase * l, uHi, b * .9);
        gl_FragColor = vec4(c, (.62 + .3 * b) * uFade);
        #include <colorspace_fragment>
      }`
  });
  const m = ghostBase.clone();
  m.uniforms.uTime = U.time; m.uniforms.uBase = U.ghost; m.uniforms.uHi = U.ghostHi; m.uniforms.uFade = {value: 0};
  return m;
}
const GHOST_GEO = {
  box: () => new THREE.BoxGeometry(1, 1, 1, 1, 1, 1),
  round: () => new THREE.SphereGeometry(.5, 24, 16),
  cyl: () => new THREE.CylinderGeometry(.5, .5, 1, 24),
  pill: () => new THREE.CapsuleGeometry(.5, 1, 6, 16)
};
export function ghost(shapes) {
  const g = new THREE.Group(), mat = ghostMaterial();
  shapes.forEach(([kind, size, pos, ry]) => {
    const m = new THREE.Mesh(GHOST_GEO[kind](), mat);
    m.scale.set(...size); m.position.set(...pos); m.rotation.y = ry || 0;
    m.renderOrder = 2;
    g.add(m);
  });
  g.userData.fade = mat.uniforms.uFade;
  return g;
}
