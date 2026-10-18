// The riverside: a pale timber deck along the bank, a stone quay edge, and a platform on slim piles
// reaching out over the water, where the glass lab stands.
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {THREE, std, mesh, canvasTex, rng} from './kit.js';

// Shared with the other parts: the platform the lab stands on (x0..x1, z0 (bank) .. z1 (river)).
export const PLATFORM = {x0: .9, x1: 9.5, z0: -3.2, z1: -8.4};

function boards(seed, lengthwise) {
  const t = canvasTex(512, 512, (g, w, h) => {
    const R = rng(seed), n = 6, s = w / n;
    for (let i = 0; i < n; i++) {
      const v = 234 + Math.round(R() * 9);
      g.fillStyle = `rgb(${v + 5},${v - 1},${v - 13})`; g.fillRect(i * s, 0, s, h);
      for (let k = 0; k < 24; k++) {
        g.strokeStyle = `rgba(160,132,96,${.03 + R() * .05})`; g.lineWidth = .6 + R() * 1.3;
        const x = i * s + R() * s; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + R() * 6 - 3, h * .3, x + R() * 6 - 3, h * .7, x + R() * 4 - 2, h); g.stroke();
      }
      g.fillStyle = 'rgba(150,125,92,.2)'; g.fillRect(i * s, R() * h, s, 2);
    }
    g.fillStyle = 'rgba(150,125,92,.3)';
    for (let i = 0; i <= n; i++) g.fillRect(i * s - 1, 0, 2, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (lengthwise) t.rotation = Math.PI / 2;
  return t;
}

export function build() {
  const group = new THREE.Group();
  const concrete = std('#e8e4dc', {roughness: .95}), concreteDark = std('#d9d3c8', {roughness: 1});

  // the deck along the bank: boards run parallel to the river; wide enough for a full-page background
  const deckTex = boards(3, true);
  deckTex.repeat.set(46 / 3.2, 120 / 3.2);
  const deck = mesh(new THREE.PlaneGeometry(120, 46), std('#ffffff', {map: deckTex, roughness: .85}), {noCast: true});
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, 19.8);
  group.add(deck);
  // quay: a pale concrete edge with a coping stone, dropping to the water
  const quay = mesh(new THREE.BoxGeometry(120, 1.3, .6), concreteDark, {noCast: true});
  quay.position.set(0, -.6, -3.15);
  const coping = mesh(new RoundedBoxGeometry(120, .12, .7, 2, .04), concrete);
  coping.position.set(0, .03, -3.1);
  group.add(quay, coping);

  // the platform: boards running out over the water, a thin concrete slab, slim round piles
  const {x0, x1, z0, z1} = PLATFORM, W = x1 - x0, D = z0 - z1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const slab = mesh(new RoundedBoxGeometry(W, .26, D, 3, .05), concrete);
  slab.position.set(cx, -.13, cz);
  const platTex = boards(7, false);
  platTex.repeat.set(W / 3.2, D / 3.2);
  const top = mesh(new THREE.PlaneGeometry(W - .08, D - .08), std('#ffffff', {map: platTex, roughness: .85}), {noCast: true});
  top.rotation.x = -Math.PI / 2; top.position.set(cx, .004, cz);
  group.add(slab, top);
  const pileMat = std('#cfc9be', {roughness: .9});
  for (let i = 0; i < 4; i++) for (const z of [z0 - 1.6, z1 + .5]) {
    const pile = mesh(new THREE.CylinderGeometry(.11, .11, 1.6, 20), pileMat);
    pile.position.set(x0 + .5 + i * (W - 1) / 3, -1.0, z);
    group.add(pile);
  }
  return {group};
}
