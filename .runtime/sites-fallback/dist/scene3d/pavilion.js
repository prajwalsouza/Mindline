// The lab pavilion: floor-to-ceiling glazing between slim pale aluminium frames, one white solid panel,
// and a thin flat roof that overhangs on every side. At dusk the ceiling light strips glow warm, the
// glazing picks up the light, and two lamps light the bench from inside.
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {THREE, std, mesh, glazing} from './kit.js';

// Shared with the lab: the inside of the glass box.
export const PAV = {x0: 1.8, x1: 8.6, z0: -3.7, z1: -7.8, h: 3.0};

export function build() {
  const group = new THREE.Group();
  const {x0, x1, z0, z1, h} = PAV, W = x1 - x0, D = z0 - z1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const alu = std('#eceeec', {roughness: .38, metalness: .25}), white = std('#f6f5f1', {roughness: .7});

  // floor inside: pale terrazzo
  const floor = mesh(new THREE.BoxGeometry(W, .03, D), std('#efece6', {roughness: .55}), {noCast: true});
  floor.position.set(cx, .015, cz);
  group.add(floor);

  // frames: corner posts, mullions, a head and a sill all round
  const bar = (w, hh, d, x, y, z) => { const b = mesh(new THREE.BoxGeometry(w, hh, d), alu); b.position.set(x, y, z); group.add(b); return b; };
  [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].forEach(([x, z]) => bar(.09, h, .09, x, h / 2, z));
  [z0, z1].forEach(z => { bar(W, .08, .08, cx, h - .04, z); bar(W, .05, .08, cx, .045, z); });
  [x0, x1].forEach(x => { bar(.08, .08, D, x, h - .04, cz); bar(.08, .05, D, x, .045, cz); });
  const bays = 6;
  for (let i = 1; i < bays; i++) { const x = x0 + W * i / bays; bar(.04, h, .07, x, h / 2, z0); bar(.04, h, .07, x, h / 2, z1); }
  for (let i = 1; i < 4; i++) { const z = z0 - D * i / 4; bar(.07, h, .04, x1, h / 2, z); if (i < 2) bar(.07, h, .04, x0, h / 2, z); }

  // glazing: one pane per facade between the frames; glass casts no shadow, so the sun reaches inside
  const glass = glazing({emissive: new THREE.Color('#ffcf98'), emissiveIntensity: 0});
  const pane = (w, x, z, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h - .1), glass); p.position.set(x, h / 2, z); p.rotation.y = ry; p.renderOrder = 5; group.add(p); };
  pane(W, cx, z0, 0); pane(W, cx, z1, 0);
  pane(D, x1, cz, Math.PI / 2);
  pane(D / 2, x0, z0 - D / 4, Math.PI / 2);
  // the solid white panel: the back half of the left side, behind the incubator
  const panel = mesh(new THREE.BoxGeometry(.12, h - .02, D / 2), white);
  panel.position.set(x0, h / 2, z1 + D / 4);
  group.add(panel);

  // roof: a thin slab overhanging every side, with a slim fascia
  const roof = mesh(new RoundedBoxGeometry(W + 1.1, .2, D + 1.1, 3, .05), white);
  roof.position.set(cx, h + .1, cz);
  const fascia = mesh(new RoundedBoxGeometry(W + 1.14, .04, D + 1.14, 2, .015), alu);
  fascia.position.set(cx, h + .005, cz);
  group.add(roof, fascia);

  // ceiling light strips, and the lamps that make the lab glow at dusk
  const glowMat = new THREE.MeshStandardMaterial({color: '#fbf6ec', emissive: new THREE.Color('#ffd7a2'), emissiveIntensity: .15, roughness: .5});
  [cz + .9, cz - .9].forEach(z => { const s = mesh(new THREE.BoxGeometry(W - 1.2, .03, .14), glowMat, {noCast: true}); s.position.set(cx, h - .03, z); group.add(s); });
  const lamps = [new THREE.PointLight('#ffcf9a', 0, 10, 1.4), new THREE.PointLight('#ffcf9a', 0, 10, 1.4), new THREE.PointLight('#ffc98c', 0, 9, 1.6)];
  lamps[0].position.set(x0 + 1.6, h - .45, cz); lamps[1].position.set(x1 - 1.6, h - .45, cz); lamps[2].position.set(cx, 1.4, z0 + .6);   // the last spills out onto the deck
  group.add(...lamps);

  return {
    group,
    theme(n) {
      glowMat.emissiveIntensity = .15 + 2.4 * n;
      glass.emissiveIntensity = .35 * n; glass.opacity = .16 + .06 * n; glass.envMapIntensity = 1.6 - 1.1 * n;
      lamps[0].intensity = lamps[1].intensity = 9 * n; lamps[2].intensity = 4 * n;
    }
  };
}
