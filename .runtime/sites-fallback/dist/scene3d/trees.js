// The near bank: two silver birches beside the lab, their small leaves moving in the breeze, and a
// low concrete planter of pale grasses on the deck.
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {THREE, V3, std, mesh, canvasTex, random, windMaterial, leafGeo, foliageInBlobs, instanced} from './kit.js';

export function build({detail = 1} = {}) {
  const r = random(808), n = k => Math.max(1, Math.round(k * detail));
  const group = new THREE.Group();

  // birch bark: white with dark horizontal marks, darker towards the foot
  const bark = canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    const foot = g.createLinearGradient(0, h * .82, 0, h); foot.addColorStop(0, 'rgba(70,64,58,0)'); foot.addColorStop(1, 'rgba(70,64,58,.55)');
    g.fillStyle = foot; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(52,48,44,${.35 + r.R() * .5})`; const y = r.R() * h, x = r.R() * w; g.fillRect(x, y, 6 + r.R() * 26, 1.5 + r.R() * 3); }
  });
  const barkMat = std('#ffffff', {map: bark, roughness: .8});
  const leafMat = windMaterial({flex: 1.1, len: .12});
  const greens = ['#a9c47f', '#93b56c', '#bdd496', '#86a862'];

  function birch(x, z, h, lean, crown) {
    const trunk = mesh(new THREE.CylinderGeometry(.06, .12, h, 16), barkMat);
    trunk.position.set(x + lean * h / 2, h / 2, z); trunk.rotation.z = -lean;
    group.add(trunk);
    const top = V3(x + lean * h, h, z);
    // a few slender branches, then the crown as soft blobs of small leaves
    [[.9, .55, .35], [-.8, .62, -.25], [.4, .75, -.6], [-.3, .82, .5]].forEach(([dx, k, dz]) => {
      const a = V3(x + lean * h * k, h * k, z), b = a.clone().add(V3(dx * .7, .9, dz * .7));
      group.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 3, .022, 6), barkMat));
    });
    group.add(foliageInBlobs(r, crown.map(([dx, dy, dz, rx, ry]) => ({x: top.x + dx, y: top.y + dy, z: z + dz, rx, ry, rz: rx})), n(1500), leafGeo(.035, .07), leafMat, greens, [.8, 1.3]));
  }
  birch(10.4, -2.7, 5.3, .035, [[0, -.6, 0, .95, .9], [-.55, -1.3, .25, .7, .7], [.5, -1.5, -.2, .65, .65], [.1, .1, .1, .6, .55], [-.2, -2.2, .1, .5, .5]]);
  birch(11.7, -1.3, 4.2, -.03, [[0, -.5, 0, .8, .75], [.45, -1.1, .2, .55, .55], [-.4, -1.3, -.15, .55, .55], [0, .15, 0, .45, .45]]);

  // a low planter of pale grasses by the lab
  const planter = mesh(new RoundedBoxGeometry(1.7, .42, .52, 3, .05), std('#e3ddd2', {roughness: .95}));
  planter.position.set(-.1, .21, -2.25);
  group.add(planter);
  const soil = mesh(new THREE.BoxGeometry(1.58, .02, .4), std('#6b5846', {roughness: 1}), {noCast: true});
  soil.position.set(-.1, .42, -2.25);
  group.add(soil);
  const blade = leafGeo(.012, .55);
  group.add(instanced(blade, windMaterial({flex: 1.4, len: .55}), n(260), (i, d, c) => {
    d.position.set(-.1 + r.rand(-.74, .74), .41, -2.25 + r.rand(-.17, .17));
    d.rotation.set(r.rand(-.35, .35), r.rand(0, 6.3), r.rand(-.35, .35));
    d.scale.setScalar(r.rand(.7, 1.25));
    c.set(r.pick(['#c2c995', '#adb980', '#d4d4a6', '#b6b07c']));
  }));
  return {group};
}
