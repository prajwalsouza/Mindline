// The susceptibility-testing bench, along the back glazing, left to right: an incubator with a glass door
// and a warm glow, a compact automated analyser with a small screen, a microscope, agar plates (two show
// disk diffusion: white antibiotic disks with clear rings where nothing grows), a rack of capped culture
// tubes, and a floor-standing biosafety cabinet with a glass sash and a lit interior.
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {THREE, V3, U, std, mesh, lathe, canvasTex, rng, labGlass, glints} from './kit.js';
import {PAV} from './pavilion.js';

const TOP = .92;   // bench height

export function build() {
  const group = new THREE.Group();
  const white = std('#f7f6f2', {roughness: .5}), oak = std('#e2cba8', {roughness: .7}), alu = std('#dfe2e2', {roughness: .35, metalness: .4});
  const graphite = std('#4b4f55', {roughness: .5}), glass = labGlass();
  const sparkle = [];
  const z = PAV.z1 + .48;                // bench centre, in front of the back glazing
  const glows = [];                      // [material, day, night]
  const glow = (color, emissive, day, night, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({color, emissive: new THREE.Color(emissive), emissiveIntensity: day, roughness: .4}, extra)); glows.push([m, day, night]); return m; };
  const add = (geo, mat, x, y, zz, opts = {}) => { const m = mesh(geo, mat, opts); m.position.set(x, y, zz); if (opts.ry) m.rotation.y = opts.ry; group.add(m); return m; };

  // ---- the bench: white top, oak fronts, slim legs
  const bx0 = PAV.x0 + .25, bx1 = PAV.x1 - 1.75, bw = bx1 - bx0, bcx = (bx0 + bx1) / 2;
  add(new RoundedBoxGeometry(bw, .05, .74, 2, .015), white, bcx, TOP - .025, z);
  add(new THREE.BoxGeometry(bw - .1, .62, .04), oak, bcx, TOP - .4, z - .3);
  [bx0 + .08, bcx, bx1 - .08].forEach(x => add(new THREE.BoxGeometry(.05, TOP - .05, .6), alu, x, (TOP - .05) / 2, z - .02));

  // ---- incubator: white body, a glass door, shelves of plates, a warm glow inside
  const ix = bx0 + .45, iw = .66, ih = .7, idp = .58, iy = TOP + ih / 2;
  // the body is a shell: a solid back block and a frame round an open, lit chamber
  add(new RoundedBoxGeometry(iw, ih, idp - .24, 3, .03), white, ix, iy, z - .06 - .12);
  [-1, 1].forEach(s => { add(new THREE.BoxGeometry(.05, ih, .26), white, ix + s * (iw / 2 - .025), iy, z + .11); add(new THREE.BoxGeometry(iw, .05, .26), white, ix, iy + s * (ih / 2 - .025), z + .11); });
  const warm = glow('#fff1dc', '#ffc78a', .55, 1.8);
  add(new THREE.BoxGeometry(iw - .1, ih - .1, .01), warm, ix, iy, z - .005, {noCast: true});
  [-.1, .1].forEach(dy => {
    add(new THREE.BoxGeometry(iw - .1, .008, .22), alu, ix, iy + dy, z + .11, {noCast: true});
    for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(.045, .045, .028, 24), std('#f3e2b7', {roughness: .4}), ix - .15 + k * .15, iy + dy + .02, z + .11, {noCast: true});
  });
  add(new THREE.BoxGeometry(iw - .02, ih - .02, .012), glass, ix, iy, z + .25, {noCast: true});
  add(new THREE.BoxGeometry(.012, .2, .03), alu, ix + iw / 2 - .06, iy, z + .27);
  const incLed = glow('#d8f1e4', '#7fe0b0', .8, 2.2);
  add(new THREE.BoxGeometry(.08, .02, .01), incLed, ix - .2, iy + ih / 2 - .035, z + .257, {noCast: true});
  sparkle.push(V3(ix + iw / 2 - .05, iy + ih / 2 - .05, z + .26), V3(ix - iw / 2 + .08, iy - .1, z + .26));

  // ---- analyser: a clean white instrument, a lid seam, a card slot, a small glowing screen
  const ax = ix + .95, aw = .82, ah = .46, ad = .56, ay = TOP + ah / 2, af = z - .04 + ad / 2;
  add(new RoundedBoxGeometry(aw, ah, ad, 4, .06), white, ax, ay, z - .04);
  add(new RoundedBoxGeometry(aw - .04, .06, ad - .04, 3, .025), std('#eef0f0', {roughness: .45}), ax, TOP + ah - .01, z - .04);
  add(new THREE.BoxGeometry(aw - .12, .005, .005), graphite, ax, TOP + ah - .05, af);
  add(new THREE.BoxGeometry(.3, .02, .01), graphite, ax - .14, ay - .06, af);
  const screenMat = glow('#203038', '#9fd8e4', .7, 2.0);
  const screen = add(new THREE.BoxGeometry(.22, .14, .012), screenMat, ax + .22, ay + .06, af + .004, {noCast: true});
  screen.rotation.x = -.18;
  const okLed = glow('#d8f1e4', '#6fd6a0', .9, 2.4);
  add(new THREE.SphereGeometry(.009, 10, 8), okLed, ax - .32, ay + .12, af + .002, {noCast: true});

  // ---- microscope: base, a curved arm, stage, objectives, an angled binocular head
  const m = new THREE.Group();
  m.add(mesh(new RoundedBoxGeometry(.2, .05, .26, 3, .02), white).translateY(.025));
  const arm = new THREE.CatmullRomCurve3([V3(0, .04, -.08), V3(0, .2, -.11), V3(0, .33, -.07), V3(0, .38, .01)]);
  m.add(mesh(new THREE.TubeGeometry(arm, 24, .035, 12), white));
  m.add(mesh(new THREE.BoxGeometry(.16, .015, .14), graphite).translateY(.17).translateZ(.03));
  m.add(mesh(new THREE.CylinderGeometry(.04, .04, .05, 20), graphite).translateY(.31).translateZ(.04));
  [-.025, .025].forEach(dx => m.add(mesh(new THREE.CylinderGeometry(.011, .009, .06, 12), alu).translateX(dx).translateY(.26).translateZ(.04)));
  const head = mesh(new THREE.CylinderGeometry(.03, .035, .14, 16), white); head.position.set(0, .41, .05); head.rotation.x = -.6; m.add(head);
  [-.03, .03].forEach(dx => { const o = mesh(new THREE.CylinderGeometry(.013, .013, .06, 12), graphite); o.position.set(dx, .47, .1); o.rotation.x = -.6; m.add(o); });
  m.position.set(ax + .78, TOP, z - .02); m.rotation.y = -.35;
  group.add(m);

  // ---- agar plates: pale agar; two show the disk-diffusion test
  const lawn = canvasTex(256, 256, (g, w, h) => {
    const R = rng(23);
    g.fillStyle = '#ecdcb0'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(255,250,235,${R() * .18})`; g.fillRect(R() * w, R() * h, 2, 2); }
    // clear zones around five disks: agar without growth is more translucent and amber
    [[.5, .5, .2], [.25, .3, .14], [.74, .3, .1], [.27, .72, .17], [.73, .72, .06]].forEach(([x, y, r]) => {
      const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      gr.addColorStop(0, '#d8bb7c'); gr.addColorStop(.92, '#dcc188'); gr.addColorStop(1, 'rgba(236,220,176,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x * w, y * h, r * w, 0, 7); g.fill();
    });
  });
  const lawnMat = new THREE.MeshPhysicalMaterial({map: lawn, roughness: .3, clearcoat: .6, clearcoatRoughness: .2});
  const plainAgar = new THREE.MeshPhysicalMaterial({color: '#efdfb3', roughness: .3, clearcoat: .6, clearcoatRoughness: .2});
  const disk = std('#ffffff', {roughness: .9});
  const R = .09;
  function plate(x, y, zz, test, ry = 0) {
    const p = new THREE.Group();
    p.add(lathe([[0, 0], [R, 0], [R + .002, .003], [R + .002, .02], [R - .002, .02]], glass, 48));
    const agar = mesh(new THREE.CylinderGeometry(R - .004, R - .004, .01, 48), test ? lawnMat : plainAgar, {noCast: true});
    agar.position.y = .007; p.add(agar);
    if (test) [[.5, .5], [.25, .3], [.74, .3], [.27, .72], [.73, .72]].forEach(([u, v]) => {
      const d = mesh(new THREE.CylinderGeometry(.0075, .0075, .002, 16), disk, {noCast: true});
      d.position.set((u - .5) * 2 * (R - .004), .0128, (v - .5) * 2 * (R - .004)); p.add(d);
    });
    p.position.set(x, y, zz); p.rotation.y = ry;
    group.add(p);
    sparkle.push(V3(x + R * .7, y + .02, zz + R * .7));
  }
  const px = m.position.x + .5;
  plate(px, TOP, z + .14, true, .4);
  plate(px + .24, TOP, z + .1, true, 1.3);
  plate(px + .12, TOP, z - .14, false);
  plate(px + .12, TOP + .022, z - .14, false, .7);

  // ---- culture tubes in a rack, coloured caps
  const rx = px + .68, rack = std('#f2f1ee', {roughness: .55});
  add(new RoundedBoxGeometry(.48, .018, .12, 2, .008), rack, rx, TOP + .1, z);
  add(new RoundedBoxGeometry(.48, .018, .12, 2, .008), rack, rx, TOP + .03, z);
  [-.23, .23].forEach(dx => add(new THREE.BoxGeometry(.016, .11, .12), rack, rx + dx, TOP + .055, z));
  const caps = ['#e98f7d', '#7fb8c1', '#e8c46a', '#a99ad3', '#9cc49a', '#e98f7d', '#7fb8c1'];
  const broth = new THREE.MeshPhysicalMaterial({color: '#f1d89a', roughness: .2, transmission: .6, thickness: .03});
  caps.forEach((c, i) => {
    const row = i > 3 ? 1 : 0, tx = rx - .19 + (i - row * 4) * .125 + row * .06, tz = z + (row ? .03 : -.03);
    const tube = new THREE.Group();
    tube.add(mesh(new THREE.CylinderGeometry(.016, .016, .15, 16, 1, true), glass, {noCast: true}).translateY(.09));
    tube.add(mesh(new THREE.SphereGeometry(.016, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glass, {noCast: true}).translateY(.015));
    tube.add(mesh(new THREE.CylinderGeometry(.014, .014, .08, 16), broth, {noCast: true}).translateY(.055));
    tube.add(mesh(new THREE.CylinderGeometry(.019, .019, .035, 16), std(c, {roughness: .5})).translateY(.18));
    tube.position.set(tx, TOP + .005, tz);
    group.add(tube);
    if (i % 3 === 0) sparkle.push(V3(tx + .012, TOP + .13, tz + .015));
  });

  // ---- biosafety cabinet, floor-standing at the end of the bench
  const cx = PAV.x1 - .82, cw = 1.25, cy0 = .74, ch = 1.32, cd = .78, cz = z + .02;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => add(new THREE.BoxGeometry(.05, cy0, .05), alu, cx + sx * (cw / 2 - .06), cy0 / 2, cz + sz * (cd / 2 - .08)));
  add(new THREE.BoxGeometry(cw - .1, .03, cd - .1), alu, cx, .2, cz);
  // shell: back, sides, top and the motor housing; the front is open under the sash
  add(new THREE.BoxGeometry(cw, ch, .06), white, cx, cy0 + ch / 2, cz - cd / 2 + .03);
  [-1, 1].forEach(s => add(new THREE.BoxGeometry(.06, ch, cd), white, cx + s * (cw / 2 - .03), cy0 + ch / 2, cz));
  add(new RoundedBoxGeometry(cw, .32, cd, 3, .03), white, cx, cy0 + ch + .14, cz);
  add(new THREE.BoxGeometry(cw - .12, .06, cd - .1), white, cx, cy0 + .03, cz);
  // inside: a stainless work surface and a light bar
  add(new THREE.BoxGeometry(cw - .14, .015, cd - .16), alu, cx, cy0 + .065, cz, {noCast: true});
  const cabLight = glow('#f4f8fb', '#e2f1ff', .7, 2.6);
  add(new THREE.BoxGeometry(cw - .2, .025, .05), cabLight, cx, cy0 + ch - .07, cz - .05, {noCast: true});
  const cabInner = glow('#f4f6f6', '#dfeefa', .12, .55, {roughness: .8});
  add(new THREE.BoxGeometry(cw - .14, ch - .14, .01), cabInner, cx, cy0 + ch / 2, cz - cd / 2 + .065, {noCast: true});
  // front: a fascia with a display, and the glass sash leaning back slightly
  add(new THREE.BoxGeometry(cw, .2, .05), white, cx, cy0 + ch - .1, cz + cd / 2 - .02);
  const cabScreen = glow('#203038', '#9fd8e4', .6, 1.8);
  add(new THREE.BoxGeometry(.16, .06, .01), cabScreen, cx + .38, cy0 + ch - .1, cz + cd / 2 + .008, {noCast: true});
  const sash = add(new THREE.BoxGeometry(cw - .12, .78, .012), glass, cx, cy0 + ch - .6, cz + cd / 2 - .06, {noCast: true});
  sash.rotation.x = .07;
  add(new THREE.BoxGeometry(cw - .1, .03, .05), alu, cx, cy0 + ch - .99, cz + cd / 2 - .03);
  sparkle.push(V3(cx - .45, cy0 + ch - .25, cz + cd / 2 - .04), V3(cx + .3, cy0 + ch - .75, cz + cd / 2 - .02));
  const cabLamp = new THREE.PointLight('#e9f3ff', 0, 2.2, 2);
  cabLamp.position.set(cx, cy0 + ch - .25, cz + .05);
  group.add(cabLamp);

  // ---- glints on the glass, and a few motes drifting in the sun inside the pavilion
  group.add(glints(sparkle, 1));
  const MOTES = 34, mp = new Float32Array(MOTES * 3), ms = new Float32Array(MOTES);
  const r = rng(5);
  for (let i = 0; i < MOTES; i++) { mp.set([PAV.x0 + .4 + r() * (PAV.x1 - PAV.x0 - .8), 1.0 + r() * 1.7, PAV.z0 - .3 - r() * 3.3], i * 3); ms[i] = r(); }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('seed', new THREE.BufferAttribute(ms, 1));
  const motes = new THREE.Points(mg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: U.time, uNight: U.night},
    vertexShader: `attribute float seed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position + vec3(sin(uTime * .21 + seed * 30.0) * .3, sin(uTime * .13 + seed * 17.0) * .25, cos(uTime * .17 + seed * 9.0) * .2);
        vA = .3 + .7 * pow(.5 + .5 * sin(uTime * (.6 + seed) + seed * 50.0), 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.6 + seed * 1.6) * 84.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uNight; varying float vA;
      void main(){ float a = smoothstep(.5, .0, length(gl_PointCoord - .5)); gl_FragColor = vec4(mix(vec3(1.0, .96, .88), vec3(1.0, .85, .66), uNight), a * a * vA * .55); }`
  }));
  motes.frustumCulled = false;
  group.add(motes);

  // glass casts no hard shadow
  group.traverse(o => { if (o.isMesh && o.material === glass) o.castShadow = false; });

  return {
    group,
    theme(n) {
      glows.forEach(([mat, d, nt]) => { mat.emissiveIntensity = d + (nt - d) * n; });
      cabLamp.intensity = 1.6 * n;
      glass.envMapIntensity = 1.3 - .8 * n;
    }
  };
}
