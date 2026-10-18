// Architectural lighting, the part that makes dusk feel like a render: three pendants over the bench,
// downlights in the roof overhang washing the platform, uplights into both birches, and slim bollards
// with warm pools on the deck. Each one has its own moment, so the lights come on one by one as the
// sun goes down. Pools of light are cheap additive decals; only a few real lights are added.
import {THREE, std, mesh, canvasTex} from './kit.js';
import {PAV} from './pavilion.js';

let poolTex = null;
function pool(x, y, z, rx, rz, color) {
  poolTex = poolTex || canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.35, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  }, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({map: poolTex, color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false}));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 3;
  return m;
}

export function build({detail = 1} = {}) {
  const group = new THREE.Group();
  const graphite = std('#3d4046', {roughness: .45, metalness: .3});
  const items = [];   // {at: when it comes on (0..1 of dusk), set(k)}
  const glowMat = (day = 0) => new THREE.MeshStandardMaterial({color: '#fff6e6', emissive: new THREE.Color('#ffd29a'), emissiveIntensity: day, roughness: .4});
  const warm = '#ffcf98';

  // ---- pendants over the bench: dark shades on thin cables, a warm disc beneath; dimly on in the day
  const benchZ = PAV.z1 + .62;
  const pendantLight = new THREE.PointLight('#ffd3a0', 0, 4.5, 1.6); pendantLight.position.set(4.45, 1.8, benchZ); group.add(pendantLight);
  [3.15, 4.45, 5.75].forEach((x, i) => {
    const cable = mesh(new THREE.CylinderGeometry(.004, .004, .75, 4), graphite, {noCast: true}); cable.position.set(x, PAV.h - .4, benchZ);
    const shade = mesh(new THREE.CylinderGeometry(.07, .15, .2, 28, 1, true), graphite); shade.position.set(x, PAV.h - .87, benchZ);
    const lens = mesh(new THREE.CircleGeometry(.14, 28), glowMat(.6), {noCast: true}); lens.rotation.x = Math.PI / 2; lens.position.set(x, PAV.h - .965, benchZ);
    const p = pool(x, .935, benchZ, .55, .4, warm);
    group.add(cable, shade, lens, p);
    items.push({at: .02 + i * .05, set: k => { lens.material.emissiveIntensity = .6 + 2.6 * k; p.material.opacity = .08 + .3 * k; if (i === 1) pendantLight.intensity = 3 * k; }});
  });

  // ---- downlights in the roof overhang, front edge, each washing a pool onto the platform and quay
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x = PAV.x0 + .5 + i * (PAV.x1 - PAV.x0 - 1) / (n - 1), z = PAV.z0 + .3;
    const can = mesh(new THREE.CylinderGeometry(.05, .05, .012, 18), glowMat(), {noCast: true}); can.position.set(x, PAV.h - .006, z);
    const p = pool(x, .012, z + .05, .55, .5, '#ffd6a6');
    group.add(can, p);
    items.push({at: .18 + i * .045, set: k => { can.material.emissiveIntensity = 3 * k; p.material.opacity = .42 * k; }});
  }

  // ---- uplights in the birch bed: a small fixture, a warm pool, and a spot raking up the trunk into the crown
  [[10.4, -2.45, 5.2], [11.7, -1.05, 4.1]].forEach(([x, z, h], i) => {
    const fix = mesh(new THREE.CylinderGeometry(.045, .055, .05, 16), glowMat(), {noCast: true}); fix.position.set(x, .36, z);
    const p = pool(x, .345, z, .5, .5, '#ffd9a8');
    group.add(fix, p);
    let spot = null;
    if (detail >= 1 || i === 0) {
      spot = new THREE.SpotLight('#ffd8a6', 0, h + 3, .42, .85, 1.3); spot.position.set(x, .4, z);
      spot.target.position.set(x, h, z - .3); group.add(spot, spot.target);
    }
    items.push({at: .55 + i * .08, set: k => { fix.material.emissiveIntensity = 3 * k; p.material.opacity = .5 * k; if (spot) spot.intensity = 30 * k; }});
  });

  // ---- bollards: slim graphite posts with a lit band, a warm pool on the deck at each foot
  const spill = new THREE.PointLight('#ffc98e', 0, 5, 1.6); spill.position.set(5.2, .9, -2.6); group.add(spill);
  [[1.15, -2.72], [9.25, -2.72], [-.9, -1.5], [9.15, -1.05], [-4.9, -1.75]].forEach(([x, z], i) => {
    const post = mesh(new THREE.CylinderGeometry(.045, .05, .62, 16), graphite); post.position.set(x, .31, z);
    const band = mesh(new THREE.CylinderGeometry(.047, .047, .05, 16), glowMat(), {noCast: true}); band.position.set(x, .57, z);
    const cap = mesh(new THREE.CylinderGeometry(.06, .06, .025, 16), graphite); cap.position.set(x, .63, z);
    const p = pool(x, .006, z, .85, .85, warm);
    group.add(post, band, cap, p);
    items.push({at: .32 + i * .06, set: k => { band.material.emissiveIntensity = 3.2 * k; p.material.opacity = .34 * k; if (i === 0) spill.intensity = 2.6 * k; }});
  });

  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return {
    group, shadows: false,
    theme(lights) { items.forEach(it => it.set(ss(it.at, it.at + .14, lights))); }
  };
}
