// Across the river: a low far bank with a soft tree line (birches and pines, low-poly clay), rolling
// hills behind it fading into haze, and a slim white footbridge downstream.
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {THREE, V3, std, rng, instanced} from './kit.js';

const WATER = -.55;

function noise2(seed) {
  const r = rng(seed), P = new Uint8Array(512), G = [];
  for (let i = 0; i < 256; i++) { P[i] = i; const a = r() * Math.PI * 2; G.push([Math.cos(a), Math.sin(a)]); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (h, x, y) => { const g = G[h & 255]; return g[0] * x + g[1] * y; };
  return (x, y) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y), u = fade(xf), v = fade(yf);
    const aa = P[P[xi] + yi], ab = P[P[xi] + yi + 1], ba = P[P[xi + 1] + yi], bb = P[P[xi + 1] + yi + 1];
    const x1 = dot(aa, xf, yf) + u * (dot(ba, xf - 1, yf) - dot(aa, xf, yf));
    const x2 = dot(ab, xf, yf - 1) + u * (dot(bb, xf - 1, yf - 1) - dot(ab, xf, yf - 1));
    return x1 + v * (x2 - x1);
  };
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// A heightfield coloured by height, hazed by hand (aerial perspective).
function terrain({w, d, sx, sz, seed, height, low, high, haze, hazeColor}) {
  const n = noise2(seed);
  const fbm = (x, y) => { let a = 0, f = 1, amp = .5; for (let o = 0; o < 5; o++) { a += amp * n(x * f, y * f); f *= 2.03; amp *= .5; } return a; };
  const geo = new THREE.PlaneGeometry(w, d, sx, sz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), lo = new THREE.Color(low), hi = new THREE.Color(high), mist = new THREE.Color(hazeColor), sand = new THREE.Color('#d9d2bd');
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (w / 2), v = pos.getZ(i) / (d / 2), hgt = height(u, v, fbm);
    pos.setY(i, WATER + hgt);
    c.copy(lo).lerp(hi, Math.min(1, Math.max(0, hgt / 9 + fbm(u * 9, v * 9) * .4)));
    if (hgt < .35) c.lerp(sand, .7);
    c.lerp(mist, haze);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1}));
  mesh.receiveShadow = false;
  mesh.userData.heightAt = (x, z) => WATER + height(x / (w / 2), z / (d / 2), fbm);
  return mesh;
}

export function build() {
  const group = new THREE.Group();
  const tint = [];   // materials darkened towards night

  // the far bank: a narrow shore that rises gently into a wooded strip
  const bank = terrain({w: 420, d: 60, sx: 210, sz: 40, seed: 41, low: '#a9b78f', high: '#8ea27a', haze: .3, hazeColor: '#dfe6e3',
    height: (u, v, fbm) => { const shore = smooth(.95, .62, v + fbm(u * 6, 0) * .08); return -.4 + shore * (1.1 + 2.2 * smooth(.6, -.4, v) + fbm(u * 5, v * 3) * 2.2); }});
  bank.position.set(0, 0, -62);
  group.add(bank); tint.push(bank.material);
  const hAt = (x, z) => bank.userData.heightAt(x, z + 62);

  // rolling hills behind, softer and paler with distance
  const hills = terrain({w: 900, d: 180, sx: 220, sz: 50, seed: 17, low: '#a3b393', high: '#8d9f86', haze: .55, hazeColor: '#dbe3e6',
    height: (u, v, fbm) => { const back = smooth(.9, -.2, v), ends = Math.min(1, (1 - Math.abs(u)) * 3); return Math.max(-1, (2 + 16 * back * (.6 + fbm(u * 3.2, v * 1.6)) + fbm(u * 8, v * 4) * 4 * back) * ends); }});
  hills.position.set(40, 0, -190);
  group.add(hills); tint.push(hills.material);

  // the tree line: birches (white trunks, light rounded crowns) and pines (stacked cones), all instanced
  const r = rng(77), birches = [], pines = [];
  for (let k = 0; k < 900 && (birches.length < 70 || pines.length < 80); k++) {
    const x = -90 + r() * 180, z = -36 - r() * 18, y = hAt(x, z);
    if (y < WATER + .5) continue;
    if (Math.abs(x - 26.5) < 2.2 && z > -40) continue;   // keep the bridge landing clear
    (r() < .5 ? (birches.length < 70 && birches.push([x, y, z, .8 + r() * .6])) : (pines.length < 80 && pines.push([x, y, z, .8 + r() * .7])));
  }
  const crownMat = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, flatShading: true});
  const trunkMat = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1});
  tint.push(crownMat, trunkMat);
  const haze = new THREE.Color('#dfe6e3');
  const hazed = (hex, k) => new THREE.Color(hex).lerp(haze, k);
  group.add(instanced(new THREE.CylinderGeometry(.06, .09, 1, 6).translate(0, .5, 0), trunkMat, birches.length, (i, d, c) => {
    const [x, y, z, s] = birches[i]; d.position.set(x, y - .1, z); d.scale.set(s, s * 2.6, s); d.rotation.set(0, 0, 0); c.copy(hazed('#efece4', .2));
  }));
  group.add(instanced(new THREE.IcosahedronGeometry(1, 1), crownMat, birches.length, (i, d, c) => {
    const [x, y, z, s] = birches[i]; d.position.set(x, y + s * 2.6, z); d.scale.set(s * .85, s * 1.25, s * .85); d.rotation.set(0, r() * 6, 0);
    c.copy(hazed(['#b3c78f', '#a2bb80', '#c1d19d'][i % 3], .25));
  }));
  const pineGeo = mergeGeometries([
    new THREE.ConeGeometry(.9, 1.8, 7).translate(0, 1.5, 0),
    new THREE.ConeGeometry(.7, 1.5, 7).translate(0, 2.4, 0),
    new THREE.ConeGeometry(.45, 1.2, 7).translate(0, 3.2, 0),
    new THREE.CylinderGeometry(.08, .1, .8, 6).translate(0, .4, 0)
  ]);
  group.add(instanced(pineGeo, crownMat, pines.length, (i, d, c) => {
    const [x, y, z, s] = pines[i]; d.position.set(x, y - .1, z); d.scale.set(s, s * (1 + r() * .35), s); d.rotation.set(0, r() * 6, 0);
    c.copy(hazed(['#6f8a6c', '#62806a', '#7a9474'][i % 3], .3));
  }));

  // a slim white footbridge downstream, arching low across the river
  const white = std('#f1f1ec', {roughness: .6});
  const path = new THREE.CatmullRomCurve3([V3(26, .1, -3.3), V3(26.3, 1.3, -12), V3(26.6, 1.8, -19), V3(26.9, 1.3, -26), V3(27.2, hAt(27.2, -36) + .1, -36)]);
  const pts = path.getSpacedPoints(48);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], seg = new THREE.Mesh(new THREE.BoxGeometry(1.5, .12, a.distanceTo(b) + .02), white);
    seg.position.copy(a).lerp(b, .5); seg.lookAt(b); group.add(seg);
  }
  [-1, 1].forEach(s => {
    const rail = new THREE.CatmullRomCurve3(pts.map(p => p.clone().add(V3(s * .72, .95, 0))));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(rail, 64, .03, 6), white));
    for (let i = 0; i < pts.length; i += 4) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .95, 6), white);
      post.position.copy(pts[i]).add(V3(s * .72, .48, 0)); group.add(post);
    }
  });
  tint.push(white);

  const day = new THREE.Color('#ffffff'), night = new THREE.Color('#4a5670');
  return {
    group,
    shadows: false,
    theme(k) { tint.forEach(m => { if (m === white) m.color.set('#f1f1ec').lerp(night, k * .8); else m.color.copy(day).lerp(night, k); }); }
  };
}
