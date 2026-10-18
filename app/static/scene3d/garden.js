// Planting, the way an architect's render dresses a building: a long bed of clipped shrubs, grasses and
// white flowers along the quay, a fern and grass bed round the birches' feet, two olive trees in tall pots
// beside the lab, a fiddle-leaf fig inside it, a sedum green roof, and a soft mass of grasses in the
// near foreground to frame the view.
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {THREE, V3, std, mesh, canvasTex, random, windMaterial, leafGeo, flowerGeo, instanced} from './kit.js';
import {PAV} from './pavilion.js';

export function build({detail = 1} = {}) {
  const r = random(4242), n = k => Math.max(1, Math.round(k * detail));
  const group = new THREE.Group();
  const stone = std('#e6e1d7', {roughness: .95}), soilMat = std('#5e4e40', {roughness: 1});
  const tint = [];   // materials that cool and darken towards night

  // leaves scattered through soft ellipsoids, weighted by volume so big shrubs get more
  function blobs(list, count, geo, mat, colors, scale, tilt = 1.2) {
    const vol = list.map(b => b.rx * b.ry * b.rz), sum = vol.reduce((a, b) => a + b, 0);
    return instanced(geo, mat, count, (i, d, c) => {
      let u = r.R() * sum, k = 0; while (u > vol[k] && k < vol.length - 1) u -= vol[k++];
      const b = list[k], a = r.R() * Math.PI * 2, v = Math.acos(2 * r.R() - 1), s = Math.cbrt(.25 + .75 * r.R());
      d.position.set(b.x + Math.sin(v) * Math.cos(a) * b.rx * s, b.y + Math.cos(v) * b.ry * s, b.z + Math.sin(v) * Math.sin(a) * b.rz * s);
      d.rotation.set(r.rand(-tilt, tilt), r.rand(0, Math.PI * 2), r.rand(-tilt, tilt));
      const sc = r.rand(scale[0], scale[1]); d.scale.set(sc * .85, sc, 1);
      c.set(r.pick(colors)).offsetHSL(r.rand(-.012, .012), r.rand(-.05, .05), r.rand(-.06, .05));
    });
  }
  // grass blades in a footprint, bending outwards
  function grasses(cx, y, cz, rx, rz, count, len, colors, mat) {
    return instanced(leafGeo(.012, len), mat, count, (i, d, c) => {
      const a = r.R() * Math.PI * 2, k = Math.sqrt(r.R());
      d.position.set(cx + Math.cos(a) * rx * k, y, cz + Math.sin(a) * rz * k);
      d.rotation.set(Math.sin(a) * r.rand(.1, .5), r.rand(0, 6.3), -Math.cos(a) * r.rand(.1, .5));
      d.scale.setScalar(r.rand(.65, 1.2));
      c.set(r.pick(colors));
    });
  }
  function bed(w, h, dp, x, z) {
    const b = mesh(new RoundedBoxGeometry(w, h, dp, 3, .05), stone); b.position.set(x, h / 2, z);
    const s = mesh(new THREE.BoxGeometry(w - .12, .02, dp - .12), soilMat, {noCast: true}); s.position.set(x, h - .015, z);
    group.add(b, s);
    return h;
  }

  const leafMat = windMaterial({flex: .45, len: .14}); tint.push(leafMat);
  const bigLeafMat = windMaterial({flex: .3, len: .25}); tint.push(bigLeafMat);
  const grassMat = windMaterial({flex: 1.4, len: .6}); tint.push(grassMat);
  const flowerMat = windMaterial({flex: .8, len: .1});
  const box = ['#5f8a4e', '#6f9a58', '#557f46', '#7aa45f'];         // clipped shrubs, glossy mid-greens
  const soft = ['#9dbb78', '#8bb06a', '#b2c98b', '#7ea35f'];        // airy, sunlit
  const fern = ['#6e9c4f', '#7fae5a', '#5d8b44'];
  const straw = ['#c9c792', '#b7bb83', '#d6d1a0', '#aab27a'];
  const leaf = leafGeo(.05, .1), bigLeaf = leafGeo(.09, .2), fernLeaf = leafGeo(.04, .34);

  // ---- along the quay, left of the lab: a long bed of shrubs, grasses and white flowers
  const lh = bed(3.7, .46, 1.05, -2.9, -2.45);
  group.add(blobs([
    {x: -4.25, y: lh + .32, z: -2.45, rx: .42, ry: .34, rz: .38}, {x: -3.45, y: lh + .26, z: -2.35, rx: .34, ry: .28, rz: .32},
    {x: -1.6, y: lh + .3, z: -2.5, rx: .4, ry: .32, rz: .36}], n(1300), leaf, leafMat, box, [.8, 1.2]));
  group.add(grasses(-2.55, lh, -2.45, .55, .32, n(320), .7, straw, grassMat));
  group.add(instanced(flowerGeo(.035), flowerMat, n(70), (i, d, c) => {
    d.position.set(r.rand(-4.5, -1.3), lh + r.rand(.18, .5), -2.45 + r.rand(-.4, .4));
    d.rotation.set(-Math.PI / 2 + r.rand(-.5, .5), r.rand(0, 6.3), 0); d.scale.setScalar(r.rand(.7, 1.2));
    c.set(r.pick(['#fbfaf4', '#f3eee4', '#e9e3f2']));
  }));

  // ---- round the birches: a low bed of ferns, grasses and two soft shrubs
  const bh = bed(3.3, .34, 2.7, 11.1, -1.95);
  group.add(blobs([{x: 9.95, y: bh + .28, z: -1.2, rx: .5, ry: .32, rz: .45}, {x: 12.15, y: bh + .26, z: -2.75, rx: .45, ry: .3, rz: .4}],
    n(900), leaf, leafMat, soft, [.8, 1.2]));
  group.add(instanced(fernLeaf, bigLeafMat, n(260), (i, d, c) => {   // fern fronds arching out of a few crowns
    const crowns = [[10.8, -2.2], [11.4, -1.0], [10.3, -2.9], [12.1, -1.6]], [x, z] = crowns[i % crowns.length], a = r.R() * Math.PI * 2;
    d.position.set(x + Math.cos(a) * .06, bh, z + Math.sin(a) * .06);
    d.rotation.set(Math.sin(a) * r.rand(.6, 1.1), a, -Math.cos(a) * r.rand(.6, 1.1)); d.scale.setScalar(r.rand(.7, 1.15));
    c.set(r.pick(fern)).offsetHSL(0, 0, r.rand(-.04, .04));
  }));
  group.add(grasses(11.6, bh, -2.6, .5, .4, n(200), .6, straw, grassMat));

  // ---- olive trees in tall pots on the platform, either side of the lab
  const potMat = std('#d9d2c5', {roughness: .9}), trunkMat = std('#7c6f60', {roughness: .9});
  const olive = ['#9aa883', '#8a9a74', '#a9b591', '#7d8e69'];
  [[1.32, -4.35], [9.08, -4.6]].forEach(([x, z], k) => {
    const pot = mesh(new THREE.CylinderGeometry(.3, .24, .7, 28), potMat); pot.position.set(x, .35, z); group.add(pot);
    const s = mesh(new THREE.CylinderGeometry(.27, .27, .02, 24), soilMat, {noCast: true}); s.position.set(x, .69, z); group.add(s);
    const tops = [];
    [[-.08, .05], [.1, -.06], [0, .1]].forEach(([dx, dz], j) => {   // a multi-stem trunk, leaning out a little
      const a = V3(x + dx * .3, .7, z + dz * .3), b = V3(x + dx * 2.2, 1.75 + j * .12, z + dz * 2.2);
      group.add(mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, V3(x + dx, 1.2, z + dz), b), 8, .028, 6), trunkMat));
      tops.push({x: b.x, y: b.y + .32, z: b.z, rx: .42, ry: .34, rz: .42});
    });
    group.add(blobs(tops, n(700), leafGeo(.022, .09), leafMat, olive, [.8, 1.25], 1.4));
  });

  // ---- inside: a fiddle-leaf fig in a white pot, front left
  const fx = PAV.x0 + .55, fz = PAV.z0 - .5;
  const fpot = mesh(new THREE.CylinderGeometry(.22, .18, .42, 28), std('#f4f2ec', {roughness: .6})); fpot.position.set(fx, .21, fz); group.add(fpot);
  group.add(mesh(new THREE.CylinderGeometry(.018, .025, 1.3, 8), trunkMat).translateX(fx).translateY(.95).translateZ(fz));
  group.add(blobs([{x: fx, y: 1.45, z: fz, rx: .32, ry: .5, rz: .32}, {x: fx + .08, y: .95, z: fz + .05, rx: .26, ry: .2, rz: .26}],
    n(90), bigLeaf, bigLeafMat, ['#3f6b38', '#4b7a40', '#36602f'], [.9, 1.3], .9));

  // ---- the green roof: a sedum carpet inside a slim parapet, with tufts
  const sedum = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#93a868'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2200; k++) { g.fillStyle = r.pick(['#a7b878', '#7f9658', '#b9a96e', '#c49a78', '#8ea364', '#a3b46f']); const s = 1 + r.R() * 3; g.beginPath(); g.arc(r.R() * w, r.R() * h, s, 0, 7); g.fill(); }
  });
  sedum.wrapS = sedum.wrapT = THREE.RepeatWrapping; sedum.repeat.set(3, 2);
  const W = PAV.x1 - PAV.x0 + .9, D = PAV.z0 - PAV.z1 + .9, rcx = (PAV.x0 + PAV.x1) / 2, rcz = (PAV.z0 + PAV.z1) / 2;
  const roofMat = std('#ffffff', {map: sedum, roughness: 1}); tint.push(roofMat);
  const carpet = mesh(new THREE.BoxGeometry(W, .05, D), roofMat, {noCast: true}); carpet.position.set(rcx, PAV.h + .225, rcz); group.add(carpet);
  group.add(instanced(leafGeo(.03, .1), leafMat, n(700), (i, d, c) => {
    d.position.set(rcx + r.rand(-W / 2 + .05, W / 2 - .05), PAV.h + .25, rcz + r.rand(-D / 2 + .05, D / 2 - .05));
    d.rotation.set(r.rand(-1, 1), r.rand(0, 6.3), r.rand(-1, 1)); d.scale.setScalar(r.rand(.6, 1.2));
    c.set(r.pick(['#9db56f', '#88a35f', '#b6b878', '#c79d7a']));
  }));

  // ---- the near foreground, bottom right: a soft drift of tall grasses round a shrub, half out of frame
  group.add(blobs([{x: 12.4, y: .45, z: 2.6, rx: .8, ry: .5, rz: .7}, {x: 11.2, y: .3, z: 3.2, rx: .55, ry: .32, rz: .5}], n(1000), leaf, leafMat, soft, [.9, 1.4]));
  group.add(grasses(11.3, 0, 2.4, 1.3, .9, n(380), .95, straw, grassMat));

  const day = new THREE.Color('#ffffff'), night = new THREE.Color('#56617a');
  return {
    group,
    theme(k) { tint.forEach(m => m.color.copy(day).lerp(night, k * .85)); }
  };
}
