// Night-only extras, fetched the first time dark mode is shown: twinkling stars and fireflies.
import {THREE, U, random} from './kit.js';

export function build() {
  const r = random(909);
  const group = new THREE.Group();

  const n = 900, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = r.R() * Math.PI * 2, y = r.rand(.04, 1), k = Math.sqrt(1 - y * y);
    pos.set([Math.cos(u) * k * 850, y * 850, Math.sin(u) * k * 850], i * 3);
    seed[i] = r.R();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  group.add(new THREE.Points(sg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: {uTime: U.time, uNight: U.night},
    vertexShader: 'attribute float seed; uniform float uTime; varying float vA; void main(){ vA = .55 + .45 * sin(uTime * (1.0 + seed * 2.0) + seed * 40.0); gl_PointSize = 1.2 + seed * 1.8; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uNight; varying float vA; void main(){ float a = smoothstep(.5, .0, length(gl_PointCoord - .5)); gl_FragColor = vec4(vec3(1.0, .97, .9), a * vA * uNight); }'
  })));

  const f = 40, fpos = new Float32Array(f * 3), fseed = new Float32Array(f);
  for (let i = 0; i < f; i++) { fpos.set([r.rand(-1.5, 9.5), r.rand(.6, 3.2), r.rand(-3.6, 1.4)], i * 3); fseed[i] = r.R(); }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fg.setAttribute('seed', new THREE.BufferAttribute(fseed, 1));
  group.add(new THREE.Points(fg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: {uTime: U.time, uNight: U.night, uPointer: U.pointer, uGust: U.gust},
    vertexShader: `attribute float seed; uniform float uTime, uGust; uniform vec3 uPointer; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * .4 + seed * 20.0) * .35, sin(uTime * .6 + seed * 13.0) * .25, cos(uTime * .3 + seed * 7.0) * .3);
        vec3 away = p - uPointer; p += normalize(away + .001) * exp(-dot(away, away) / 1.2) * uGust * .5;
        vA = .5 + .5 * sin(uTime * 2.0 + seed * 30.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 90.0 / -mv.z; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform float uNight; varying float vA; void main(){ float a = smoothstep(.5, .0, length(gl_PointCoord - .5)); gl_FragColor = vec4(1.0, .86, .5, a * a * vA * uNight); }'
  })));
  group.children.forEach(p => { p.frustumCulled = false; });
  return {group, shadows: false, instant: true};
}
