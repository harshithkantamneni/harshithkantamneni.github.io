// One continuous world the camera climbs as you scroll: kernels, then inference, then agents.
// Every time and count shown on the page comes from the audited claims. Geometry is schematic.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import Lenis from 'lenis';
import triton from '../data/triton.json';
import gate from '../data/gate.json';
import routing from '../data/routing.json';

const root = document.documentElement;
const canvas = document.getElementById('world');
const labelsBox = document.getElementById('wlabels');
const scrimL = document.getElementById('wscrim-l');
const scrimR = document.getElementById('wscrim-r');

const CORAL = new THREE.Color('#FF6A4D');
const AMBER = new THREE.Color('#FFB454');
const BLUE = new THREE.Color('#5B9BF0');
const WHITE = new THREE.Color('#F4F6F8');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, f) => a + (b - a) * f;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, root.classList.contains('lite') ? 1.25 : 1.75));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0D1015');
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);

const target = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.32, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- Shared block material: flat-lit graphite, with a per-instance glow on top
const VS = `attribute float aGlow; attribute vec3 aCol; varying vec3 vN; varying float vG; varying vec3 vC;
void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); vG=aGlow; vC=aCol; gl_Position = projectionMatrix*viewMatrix*w; }`;
const FS = `uniform vec3 uBase; uniform float uOp; varying vec3 vN; varying float vG; varying vec3 vC;
void main(){ vec3 n=normalize(vN); float d=.3+.7*max(dot(n,normalize(vec3(.45,1.,.35))),0.); float top=smoothstep(.4,.9,n.y); vec3 c=uBase*d+vC*vG*(.5+1.5*top); gl_FragColor=vec4(c,uOp); }`;

function blocks(geo, n, base, parent) {
  const g = geo.clone();
  const glow = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  glow.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aGlow', glow);
  g.setAttribute('aCol', col);
  const mat = new THREE.ShaderMaterial({ uniforms: { uBase: { value: new THREE.Color(base) }, uOp: { value: 1 } }, vertexShader: VS, fragmentShader: FS, transparent: true });
  const mesh = new THREE.InstancedMesh(g, mat, n);
  mesh.frustumCulled = false;
  parent.add(mesh);
  return { mesh, glow, col, mat, setCol(i, c) { col.setXYZ(i, c.r, c.g, c.b); } };
}
const dummy = new THREE.Object3D();
function place(b, i, x, y, z, sx = 1, sy = 1, sz = 1) {
  dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
  b.mesh.setMatrixAt(i, dummy.matrix);
}
function lines(n, color, parent, opacity = 0.5) {
  const pos = new Float32Array(n * 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const l = new THREE.LineSegments(g, m);
  l.frustumCulled = false;
  parent.add(l);
  return { l, pos, m, g, set(i, a, b) { pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); } };
}
function dots(n, color, size, parent) {
  const pos = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  parent.add(p);
  return { p, pos, m, g };
}

// ---- Labels drawn as page text so they stay crisp
const labels = [];
function label(text, pos, gate2, cls = '') {
  const el = document.createElement('div');
  el.className = 'wl ' + cls;
  el.textContent = text;
  labelsBox.appendChild(el);
  const l = { el, pos, gate: gate2 };
  labels.push(l);
  return l;
}

// ---- Keyframes. Each is the world's state when that page element is centred.
const BG = { k: [0.0089, 0.0049, 0.0040], i: [0.0074, 0.0056, 0.0030], a: [0.0033, 0.0056, 0.0110] };
const D = { cx: 34, cy: 30, cz: 44, lx: 0, ly: 0, lz: 0, ox: 0, oy: 0, die: 0, occ: 0.6, strip: 0, fan: 0, copy: 1, toy: 0, scat: 0, up: 1, wall: 0, tower: 0, wind: 0, beams: 0, gateA: 0, fall: 0, lit: 0, ring: 0, sl: 0, sr: 0, ty: 8, r: BG.k[0], g: BG.k[1], b: BG.k[2] };
const bg = (x) => ({ r: BG[x][0], g: BG[x][1], b: BG[x][2] });
const RAW = {
  hero: { cx: 34, cy: 31, cz: 46, lx: 0, ly: -1, lz: 0, ox: -0.22, die: 1, occ: 0.62, sl: 0.95, ty: 6 },
  kernels: { cx: 4, cy: 13, cz: 15, lx: 0, ly: 0, lz: 0, die: 1, occ: 0.9, ty: 3 },
  'merged-0': { cx: -5, cy: 35, cz: 42, lx: -5, ly: 3, lz: 2, ox: 0.2, oy: -0.2, die: 0.08, occ: 0.05, strip: 1, sr: 0.9, ty: 8 },
  'merged-1': { cx: -18, cy: 24, cz: 30, lx: 0, ly: 0, lz: 0, ox: 0.1, die: 0.55, occ: 0.3, sr: 0.9, sl: 0.5, ty: 14 },
  'merged-2': { cx: -26, cy: 12, cz: 28, lx: 0, ly: 0, lz: 0, ox: 0.1, die: 0.55, occ: 0.12, sr: 0.9, sl: 0.5, ty: 14 },
  'gqa-0': { cx: -2, cy: 50, cz: 42, lx: -2, ly: 20, lz: 0, ox: 0.2, oy: -0.2, die: 0.12, occ: 0.1, fan: 1, copy: 1, sr: 0.9, ty: 30 },
  'gqa-1': { cx: 6, cy: 48, cz: 44, lx: 0, ly: 20, lz: 0, ox: 0.1, fan: 0.6, copy: 0, sr: 0.9, sl: 0.6, ty: 31 },
  'gqa-2': { cx: -2, cy: 48, cz: 38, lx: -2, ly: 20, lz: 0, ox: 0.2, oy: -0.2, fan: 1, copy: 0, toy: 1, sr: 0.9, ty: 32 },
  'blind-0': { cx: -10, cy: 38, cz: 40, lx: 0, ly: 28, lz: 0, ox: 0.1, fan: 0.12, copy: 0, sr: 0.9, sl: 0.5, ty: 30 },
  'blind-1': { cx: -6, cy: 42, cz: 40, lx: 0, ly: 34, lz: 0, ox: 0.1, sr: 0.9, sl: 0.5, ty: 34 },
  'blind-2': { cx: -2, cy: 46, cz: 42, lx: 0, ly: 40, lz: 0, ox: 0.1, scat: 0.1, sr: 0.9, sl: 0.5, ty: 38 },
  'triton-0': { cx: 0, cy: 66, cz: 56, lx: 0, ly: 46, lz: 0, ox: 0.2, oy: -0.16, scat: 1, up: 0, sr: 0.9, ty: 58 },
  'triton-1': { cx: 0, cy: 64, cz: 52, lx: 0, ly: 47, lz: 0, ox: 0.2, oy: -0.16, scat: 1, up: 1, sr: 0.9, ty: 60 },
  'triton-2': { cx: 0, cy: 62, cz: 50, lx: 0, ly: 46, lz: 0, ox: 0.2, oy: -0.16, scat: 1, up: 1, sr: 0.9, ty: 62 },
  inference: { cx: 0, cy: 74, cz: 62, lx: 0, ly: 88, lz: -10, wall: 1, ...bg('i'), ty: 68 },
  'seconds-0': { cx: 0, cy: 82, cz: 50, lx: 0, ly: 88, lz: -16, ox: 0.08, wall: 1, sr: 0.9, sl: 0.62, ...bg('i'), ty: 76 },
  'seconds-1': { cx: 0, cy: 86, cz: 46, lx: 0, ly: 88, lz: -16, ox: 0.08, wall: 1, sr: 0.9, sl: 0.62, ...bg('i'), ty: 80 },
  'seconds-2': { cx: 0, cy: 90, cz: 42, lx: 0, ly: 88, lz: -16, ox: 0.08, wall: 1, sr: 0.9, sl: 0.62, ...bg('i'), ty: 84 },
  'cache-0': { cx: 12, cy: 96, cz: 52, lx: 0, ly: 90, lz: 0, ox: 0.1, wall: 0.55, sr: 0.9, sl: 0.5, ...bg('i'), ty: 90 },
  'cache-1': { cx: 16, cy: 100, cz: 52, lx: 0, ly: 94, lz: 0, ox: 0.1, wall: 0.45, sr: 0.9, sl: 0.5, ...bg('i'), ty: 94 },
  'edge-0': { cx: 10, cy: 112, cz: 40, lx: 0, ly: 108, lz: 0, ox: 0.1, wall: 0.2, sr: 0.9, sl: 0.5, ...bg('i'), ty: 104 },
  'edge-1': { cx: 6, cy: 122, cz: 40, lx: 0, ly: 118, lz: 0, ox: 0.1, sr: 0.9, sl: 0.5, ...bg('i'), ty: 112 },
  agents: { cx: 8, cy: 136, cz: 62, lx: 0, ly: 146, lz: 0, ox: -0.14, tower: 1, ...bg('a'), ty: 122 },
  'bert-0': { cx: 22, cy: 152, cz: 30, lx: 0, ly: 146, lz: 0, ox: 0.12, tower: 1, wind: 1, sr: 0.9, sl: 0.45, ...bg('a'), ty: 134 },
  'bert-1': { cx: 26, cy: 150, cz: 24, lx: 0, ly: 146, lz: 0, ox: 0.12, tower: 1, beams: 1, sr: 0.9, sl: 0.45, ...bg('a'), ty: 136 },
  'bert-2': { cx: 30, cy: 148, cz: 18, lx: 0, ly: 146, lz: 0, ox: 0.12, tower: 0.7, beams: 1, sr: 0.9, sl: 0.45, ...bg('a'), ty: 138 },
  'audit-0': { cx: 0, cy: 210, cz: 30, lx: 0, ly: 181, lz: 0, ox: 0.2, oy: -0.16, gateA: 1, fall: 0, lit: 0, sr: 0.9, ...bg('a'), ty: 160 },
  'audit-1': { cx: 0, cy: 208, cz: 30, lx: 0, ly: 181, lz: 0, ox: 0.2, oy: -0.16, gateA: 1, fall: 0, lit: 1, sr: 0.9, ...bg('a'), ty: 162 },
  'audit-2': { cx: 0, cy: 192, cz: 44, lx: 0, ly: 166, lz: 0, ox: 0.2, oy: -0.1, gateA: 1, fall: 1, lit: 1, sr: 0.9, ...bg('a'), ty: 164 },
  'audit-3': { cx: 0, cy: 192, cz: 38, lx: 0, ly: 168, lz: 0, ox: 0.2, oy: -0.1, gateA: 1, fall: 1, lit: 1, ring: 1, sr: 0.9, ...bg('a'), ty: 172 },
  end: { cx: 58, cy: 130, cz: 150, lx: 0, ly: 90, lz: 0, die: 0.6, occ: 0.5, wall: 0.6, tower: 0.6, ...bg('a'), ty: 190 },
};

// ---- Page stops
let stops = [];
function measure() {
  const out = [{ key: 'hero', y: 0 }];
  const center = (el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2 - window.innerHeight / 2; };
  document.querySelectorAll('.opener[data-chapter]').forEach((o) => out.push({ key: o.id, y: center(o) }));
  document.querySelectorAll('[data-scene]').forEach((s) => s.querySelectorAll('.step').forEach((st) => out.push({ key: `${s.id}-${st.dataset.step}`, y: center(st) })));
  const log = document.getElementById('log');
  if (log) out.push({ key: 'end', y: log.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.95 });
  stops = out.filter((x) => RAW[x.key]).sort((a, b) => a.y - b.y);
}
const K = { ...D, ...RAW.hero };
const goal = { ...K };
function readScroll() {
  const y = window.scrollY;
  let i = 0;
  while (i < stops.length - 2 && y > stops[i + 1].y) i++;
  const a = stops[i], b = stops[i + 1] || a;
  const f = b === a ? 0 : sstep(0.12, 0.88, (y - a.y) / (b.y - a.y));
  const A = { ...D, ...RAW[a.key] }, B = { ...D, ...RAW[b.key] };
  for (const k in D) goal[k] = mix(A[k], B[k], f);
}

// ---- Tower furniture: rails, dust and the token that climbs it
const rails = lines(4 + 4 * 60, '#3A4250', scene, 0.5);
{
  let n = 0;
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const [x, z] of [[-36, -30], [36, -30], [-36, 30], [36, 30]]) {
    rails.set(n++, v(x, -6, z), v(x, 200, z));
    for (let t = 0; t < 60; t++) { const y = -4 + t * 3.4; rails.set(n++, v(x, y, z), v(x + (x < 0 ? 1 : -1) * (t % 5 ? 0.4 : 1.2), y, z)); }
  }
}
const dust = dots(1800, '#8D97A8', 0.09, scene);
for (let i = 0; i < 1800; i++) dust.pos.set([(hash(i) - 0.5) * 120, hash(i + 2000) * 230 - 15, (hash(i + 4000) - 0.5) * 110], i * 3);
dust.m.opacity = 0.5;
const token = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5) }));
scene.add(token);
const shaft = lines(1, '#F4F6F8', scene, 0.14);

// ---- Die: 132 SMs and their HBM
const Die = (() => {
  const group = new THREE.Group();
  scene.add(group);
  const cols = 12, rows = 11, S = 1.72, g = 0.26, G = 0.72;
  const base = blocks(new THREE.BoxGeometry(S, 0.34, S), cols * rows, '#232A34', group);
  const core = blocks(new THREE.BoxGeometry(S * 0.62, 0.2, S * 0.62), cols * rows, '#1B2028', group);
  const xy = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = (c - 5.5) * (S + g) + (Math.floor(c / 3) - 1.5) * G;
    const z = (r - 5) * (S + g) + (r < 5 ? -0.5 : r > 5 ? 0.5 : 0) * G;
    const i = xy.length;
    xy.push([x, z, Math.hypot(x, z)]);
    place(base, i, x, 0.17, z);
    place(core, i, x, 0.4, z);
    core.setCol(i, CORAL);
  }
  const under = new THREE.Mesh(new THREE.BoxGeometry(31, 0.28, 27), new THREE.MeshBasicMaterial({ color: '#12161C', transparent: true }));
  under.position.y = -0.14;
  group.add(under);
  const pkg = new THREE.Mesh(new THREE.BoxGeometry(56, 0.4, 38), new THREE.MeshBasicMaterial({ color: '#0B0E12', transparent: true }));
  pkg.position.y = -0.5;
  group.add(pkg);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(pkg.geometry), new THREE.LineBasicMaterial({ color: '#39414D', transparent: true }));
  edge.position.copy(pkg.position);
  group.add(edge);
  const hbm = blocks(new THREE.BoxGeometry(6.4, 0.42, 5.4), 6 * 7, '#3A4350', group);
  const hpos = [];
  for (const sx of [-1, 1]) for (const z of [-9.2, 0, 9.2]) hpos.push([sx * 22, z]);
  hpos.forEach(([x, z], h) => { for (let l = 0; l < 7; l++) { place(hbm, h * 7 + l, x, 0.02 + l * 0.5, z); hbm.setCol(h * 7 + l, CORAL); } });
  // Traces from memory into the die, with traffic moving along them
  const NT = 96;
  const tr = lines(NT, '#5A3026', group, 0.9);
  const ends = [];
  for (let i = 0; i < NT; i++) {
    const [hx, hz] = hpos[i % 6];
    const a = new THREE.Vector3(hx - Math.sign(hx) * 3.2, 0.04, hz + (hash(i) - 0.5) * 4.6);
    const b = new THREE.Vector3(Math.sign(hx) * 15.3, 0.04, (hash(i + 9) - 0.5) * 25);
    tr.set(i, a, b);
    ends.push([a, b]);
  }
  const traffic = dots(NT * 2, CORAL.clone().multiplyScalar(1.5), 0.26, group);
  const mats = [base.mat, core.mat, hbm.mat];
  label('132 SMs, drawn as a schematic', new THREE.Vector3(10, 0.6, 21), (k) => (k.ly < 3 && k.die > 0.85 && k.sl > 0.5 ? 1 : 0));
  return {
    update(t, k) {
      group.visible = k.die > 0.01;
      if (!group.visible) return;
      for (const m of mats) m.uniforms.uOp.value = k.die;
      under.material.opacity = k.die; pkg.material.opacity = k.die; edge.material.opacity = k.die * 0.7; tr.m.opacity = k.die * 0.8;
      for (let i = 0; i < xy.length; i++) {
        const [x, z, d] = xy[i];
        const w = 0.5 + 0.5 * Math.sin(d * 0.62 - t * 1.7 + hash(i) * 1.6);
        const a = sstep(1 - k.occ, 1, w);
        core.glow.setX(i, a * a * 1.7 * k.die);
      }
      core.glow.needsUpdate = true;
      for (let i = 0; i < NT * 2; i++) {
        const [a, b] = ends[i % NT];
        const f = (t * (0.12 + hash(i) * 0.26) + hash(i + 50)) % 1;
        traffic.pos.set([mix(a.x, b.x, f), 0.12, mix(a.z, b.z, f)], i * 3);
      }
      traffic.g.attributes.position.needsUpdate = true;
      traffic.m.opacity = k.die * sstep(0.1, 0.5, k.occ);
    },
  };
})();

// ---- Decode against recompute: animation periods keep the measured ratio
const DECODE = { 1024: [72.4, 72.8, '1.0×'], 4096: [275.0, 929.4, '3.4×'], 16384: [1082.4, 14190.3, '13.1×'], 65536: [4301.8, 226529.2, '52.7×'] };
const CADENCE = { 1024: 0.9, 4096: 0.5, 16384: 0.25, 65536: 0.12 };
let keysT = 65536;
const Strip = (() => {
  const group = new THREE.Group();
  group.position.set(0, 3.2, 3);
  scene.add(group);
  const NC = 64, NH = 8, sz = 0.5, gap = 0.62;
  const geo = new THREE.BoxGeometry(sz, sz, sz);
  const rec = blocks(geo, NC * NH, '#4A5361', group);
  const dec = blocks(geo, NC * NH, '#4A5361', group);
  const lay = (b, z, c) => { for (let x = 0; x < NC; x++) for (let h = 0; h < NH; h++) { place(b, x * NH + h, (x - NC / 2) * gap, 0, z + h * gap); b.setCol(x * NH + h, c); } };
  lay(rec, -7.4, WHITE);
  lay(dec, 1.6, CORAL);
  let shown = 64, recPhase = 0, decPhase = 0;
  label('Recompute the prefix', new THREE.Vector3(-20, 1.2, -9), (k) => k.strip, 'q');
  label('Decode with the cache', new THREE.Vector3(-20, 1.2, 0), (k) => k.strip, 'q k');
  const target2 = { 1024: 8, 4096: 16, 16384: 32, 65536: 64 };
  return {
    update(t, dt, k) {
      group.visible = k.strip > 0.01;
      if (!group.visible) return;
      rec.mat.uniforms.uOp.value = dec.mat.uniforms.uOp.value = k.strip;
      shown += (target2[keysT] - shown) * (1 - Math.exp(-dt * 5));
      const c = CADENCE[keysT], ratio = DECODE[keysT][1] / DECODE[keysT][0];
      decPhase = (decPhase + dt / c) % 1;
      recPhase = (recPhase + dt / (c * ratio)) % 1;
      const n = Math.round(shown);
      for (let x = 0; x < NC; x++) {
        const on = x < n ? 1 : 0;
        const head = recPhase * n;
        const trail = x <= head ? Math.exp(-(head - x) * 0.45) : 0;
        const last = x === n - 1 ? Math.pow(1 - decPhase, 3) : 0;
        for (let h = 0; h < NH; h++) {
          const i = x * NH + h;
          place(rec, i, (x - NC / 2) * gap, 0, -7.4 + h * gap, on, on, on);
          place(dec, i, (x - NC / 2) * gap, 0, 1.6 + h * gap, on, on, on);
          rec.glow.setX(i, trail * 1.1);
          dec.glow.setX(i, last * 2.4);
        }
      }
      rec.mesh.instanceMatrix.needsUpdate = dec.mesh.instanceMatrix.needsUpdate = true;
      rec.glow.needsUpdate = dec.glow.needsUpdate = true;
    },
  };
})();

// ---- Fan: K/V heads written out once per query head, and the mapping between them
let heads = { q: 8, kv: 4 };
const Fan = (() => {
  const group = new THREE.Group();
  group.position.y = 20;
  scene.add(group);
  const MQ = 64, MK = 8, W = 40;
  const qb = blocks(new THREE.BoxGeometry(0.46, 0.5, 0.9), MQ, '#4A5361', group);
  const kb = blocks(new THREE.BoxGeometry(3.2, 1.1, 1.6), MK, '#5A6472', group);
  for (let i = 0; i < MQ; i++) qb.setCol(i, CORAL);
  for (let i = 0; i < MK; i++) kb.setCol(i, WHITE);
  const good = lines(MQ, '#F4F6F8', group, 0.16);
  const bug = lines(MQ, '#FF6A4D', group, 0);
  const flow = dots(MQ * 3, CORAL.clone().multiplyScalar(1.6), 0.3, group);
  const qx = new Float32Array(MQ), kx = new Float32Array(MK), qs = new Float32Array(MQ), ks = new Float32Array(MK);
  const qz = 8, kz = -8;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const labQ = label('64 query heads', new THREE.Vector3(-10, 18.6, qz + 2), (k) => k.fan * sstep(0.5, 1, k.fan), 'q');
  const labK = label('8 KV heads', new THREE.Vector3(-10, 22.6, kz - 1.6), (k) => k.fan * sstep(0.5, 1, k.fan), 'q');
  const labB = label('Coral wires: the planted bug', new THREE.Vector3(-14, 23.6, 0), (k) => k.fan * k.toy, 'q k');
  return {
    update(t, dt, k) {
      group.visible = k.fan > 0.01;
      if (!group.visible) return;
      qb.mat.uniforms.uOp.value = kb.mat.uniforms.uOp.value = k.fan;
      const q = k.toy > 0.5 ? heads.q : 64, kv = k.toy > 0.5 ? heads.kv : 8;
      labQ.el.textContent = `${q} query heads`;
      labK.el.textContent = `${kv} KV heads`;
      const lerp = 1 - Math.exp(-dt * 6);
      const qGap = Math.min(W / q, 5), kGap = Math.min(W / kv, 10);
      for (let i = 0; i < MQ; i++) {
        const on = i < q ? 1 : 0;
        qx[i] += ((i - (q - 1) / 2) * qGap - qx[i]) * lerp;
        qs[i] += (on - qs[i]) * lerp;
      }
      for (let i = 0; i < MK; i++) {
        const on = i < kv ? 1 : 0;
        kx[i] += ((i - (kv - 1) / 2) * kGap - kx[i]) * lerp;
        ks[i] += (on - ks[i]) * lerp;
      }
      const grow = k.toy > 0.5 ? Math.min(qGap / 0.6, 4) : 1;
      const cycle = (t * 0.55) % 1;
      const copyHot = k.copy;
      for (let i = 0; i < MQ; i++) {
        const c = i < q ? Math.floor(i / (q / kv)) : 0;
        const w = i < q ? Math.floor(i / kv) % kv : 0;
        const wrong = c !== w;
        place(qb, i, qx[i], 0, qz, qs[i] * grow, qs[i], qs[i]);
        const arrive = copyHot * sstep(0, 0.65, cycle - hash(i) * 0.1);
        const pulse = k.toy > 0.5 ? (wrong ? 1.3 : 0.2) : (copyHot > 0.5 ? arrive * 1.0 : 0.3 + 0.2 * Math.sin(t * 3 + i * 0.3));
        qb.glow.setX(i, pulse);
        a.set(qx[i], 0.3, qz - 0.4);
        b.set(kx[c], 0.3, kz + 0.8);
        good.set(i, a, i < q ? b : a);
        b.set(kx[w], 0.3, kz + 0.8);
        bug.set(i, a, wrong && i < q ? b : a);
        for (let j = 0; j < 3; j++) {
          const f = (cycle * 1.6 + j * 0.33 + hash(i) * 0.3) % 1;
          const on = i < q && copyHot > 0.05;
          flow.pos.set(on ? [mix(kx[c], qx[i], f), 0.3, mix(kz + 0.8, qz - 0.4, f)] : [0, -999, 0], (i * 3 + j) * 3);
        }
      }
      for (let i = 0; i < MK; i++) {
        place(kb, i, kx[i], 0, kz, ks[i] * Math.min(kGap / 5, 1.6), ks[i], ks[i]);
        kb.glow.setX(i, 0.2 + 0.5 * copyHot * (1 - cycle));
      }
      qb.mesh.instanceMatrix.needsUpdate = kb.mesh.instanceMatrix.needsUpdate = true;
      qb.glow.needsUpdate = kb.glow.needsUpdate = true;
      good.g.attributes.position.needsUpdate = bug.g.attributes.position.needsUpdate = flow.g.attributes.position.needsUpdate = true;
      good.m.opacity = 0.2 * k.fan * (k.toy > 0.5 ? 2.2 : 1);
      bug.m.opacity = 0.9 * k.toy * k.fan;
      flow.m.opacity = copyHot * k.fan;
    },
  };
})();

// ---- Scatter: the 76 measured shapes, in a space you can turn
let prec = 'fp16', precF = 0, yawUser = 0, yawVel = 0;
const Scat = (() => {
  const group = new THREE.Group();
  group.position.y = 44;
  scene.add(group);
  const n = triton.length;
  const sp = blocks(new THREE.SphereGeometry(0.46, 18, 14), n, '#59626F', group);
  const stems = lines(n, '#59626F', group, 0.5);
  const xOf = (p) => (Math.log2(p.M) - 9) * 6.2;
  const zOf = (p) => (Math.log2(p.N) - 13.2) * 6.4 + (Math.log2(p.K) - 13.5) * 1.3;
  const yOf = (v) => (v - 1) * 19;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const plane = new THREE.GridHelper(38, 19, '#4A5361', '#2A313C');
  plane.material.transparent = true;
  group.add(plane);
  const best = triton.reduce((m, p) => (p.fp16 > m.fp16 ? p : m));
  const bestP = new THREE.Vector3();
  label('1.73× on the best shape', bestP, (k) => (prec === 'fp16' ? k.scat * k.up : 0), 'q k');
  const paraP = new THREE.Vector3();
  label('Grid: the unfused path', paraP, (k) => k.scat * sstep(0.9, 1, k.scat), 'q');
  const ray = new THREE.Raycaster();
  return {
    group, sp,
    pick(ndc) {
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(sp.mesh)[0];
      return hit ? triton[hit.instanceId] : null;
    },
    update(t, dt, k) {
      group.visible = k.scat > 0.01;
      if (!group.visible) return;
      sp.mat.uniforms.uOp.value = k.scat;
      plane.material.opacity = 0.7 * k.scat;
      stems.m.opacity = 0.45 * k.scat;
      precF += ((prec === 'bf16' ? 1 : 0) - precF) * (1 - Math.exp(-dt * 5));
      yawUser += yawVel * dt; yawVel *= Math.exp(-dt * 2);
      group.rotation.y = t * 0.06 + yawUser;
      for (let i = 0; i < n; i++) {
        const p = triton[i];
        const v = mix(p.fp16, p.bf16, precF);
        const x = xOf(p), z = zOf(p), y = yOf(v);
        const faster = v > 1;
        place(sp, i, x, y, z);
        sp.setCol(i, faster ? CORAL : WHITE);
        sp.glow.setX(i, faster ? 1.0 * k.up : 0.03);
        a.set(x, 0, z); b.set(x, y, z);
        stems.set(i, a, b);
      }
      sp.mesh.instanceMatrix.needsUpdate = true;
      sp.glow.needsUpdate = true; sp.col.needsUpdate = true;
      stems.g.attributes.position.needsUpdate = true;
      bestP.set(xOf(best) + 0.9, yOf(mix(best.fp16, best.bf16, precF)) + 0.6, zOf(best)).applyMatrix4(group.matrixWorld);
      paraP.set(19, 0.4, 19).applyMatrix4(group.matrixWorld);
    },
  };
})();

// ---- Wall: 36 layers of 128 experts, walked by a recorded routing trace
const ROUTE = Uint8Array.from(atob(routing.data), (c) => c.charCodeAt(0));
let fsKey = '000', fsMs = 20.59;
const Wall = (() => {
  const { T, L, E, k: topK } = routing;
  const group = new THREE.Group();
  group.position.set(0, 88, 0);
  scene.add(group);
  const R = 30, SPAN = 2.95, st = 0.66;
  const bl = blocks(new THREE.BoxGeometry(0.54, 0.54, 0.54), L * E, '#303742', group);
  const where = [];
  for (let l = 0; l < L; l++) for (let e = 0; e < E; e++) {
    const th = ((e + 0.5) / E - 0.5) * SPAN;
    const x = Math.sin(th) * R, z = -Math.cos(th) * R, y = (l - (L - 1) / 2) * st;
    const i = l * E + e;
    where.push(new THREE.Vector3(x, y, z));
    dummy.position.set(x, y, z); dummy.rotation.set(0, -th, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    bl.mesh.setMatrixAt(i, dummy.matrix);
    bl.setCol(i, AMBER);
  }
  const gpu = blocks(new THREE.BoxGeometry(5, 0.5, 4), 1, '#39414D', group);
  place(gpu, 0, 0, 0, 2);
  gpu.setCol(0, AMBER);
  const glow = new Float32Array(L * E);
  // Simple in-browser cache over the real trace. It shows the idea, not a measured policy.
  const SLOTS = Math.round(E * 0.11);
  const cache = Array.from({ length: L }, () => []);
  const nextUse = (l, e, from) => { for (let t = from; t < T; t++) for (let j = 0; j < topK; j++) if (ROUTE[(t * L + l) * topK + j] === e) return t; return Infinity; };
  const arcs = lines(48, '#FFC37A', group, 0.9);
  const arcLife = new Float32Array(48);
  const arcFrom = Array.from({ length: 48 }, () => new THREE.Vector3());
  let arcN = 0;
  const fire = (l, e) => { const j = arcN++ % 48; arcFrom[j].copy(where[l * E + e]); arcLife[j] = 1; };
  let tok = 0, layer = 0, acc = 0;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  const walker = dots(1, new THREE.Color(1.6, 1.6, 1.6), 0.7, group);
  label('Experts held on the GPU glow. A miss sends a copy to it.', new THREE.Vector3(-4, 74.5, -26), (k) => (k.sl > 0.55 ? k.wall : 0), 'q');
  return {
    update(t, dt, k) {
      group.visible = k.wall > 0.01;
      if (!group.visible) return;
      bl.mat.uniforms.uOp.value = gpu.mat.uniforms.uOp.value = k.wall;
      acc += dt;
      // Layer time follows the measured time per token for the current switches
      const stepT = (fsMs / 20.59) * 0.11;
      const oracle = fsKey[0] === '1', once = fsKey[1] === '1', ahead = fsKey[2] === '1';
      let guard = 0;
      while (acc > stepT && guard++ < 8) {
        acc -= stepT;
        const base = (tok * L + layer) * topK;
        for (let j = 0; j < topK; j++) {
          const e = ROUTE[base + j];
          const set = cache[layer];
          const idx = set.indexOf(e);
          if (idx >= 0) { set.splice(idx, 1); set.push(e); glow[layer * E + e] = 1.7; continue; }
          glow[layer * E + e] = 2.6;
          if (ahead && layer + 1 < L) fire(layer + 1, ROUTE[((tok * L + layer + 1) * topK) + j]);
          fire(layer, e);
          if (!once) fire(layer, e);
          if (set.length >= SLOTS) {
            let out = 0;
            if (oracle) { let far = -1; for (let s = 0; s < set.length; s++) { const u = nextUse(layer, set[s], tok + 1); if (u > far) { far = u; out = s; } } }
            set.splice(out, 1);
          }
          set.push(e);
        }
        layer++;
        if (layer >= L) { layer = 0; tok = (tok + 1) % T; }
      }
      const decay = Math.exp(-dt * 2.6);
      for (let i = 0; i < glow.length; i++) glow[i] *= decay;
      for (let l = 0; l < L; l++) for (const e of cache[l]) { const i = l * E + e; if (glow[i] < 0.3) glow[i] = 0.3; }
      for (let i = 0; i < glow.length; i++) bl.glow.setX(i, glow[i] * k.wall);
      bl.glow.needsUpdate = true;
      gpu.glow.setX(0, 0.8 + 0.8 * Math.sin(t * 5)); gpu.glow.needsUpdate = true;
      for (let j = 0; j < 48; j++) {
        arcLife[j] = Math.max(0, arcLife[j] - dt * 3.2);
        const f = 1 - arcLife[j];
        if (arcLife[j] <= 0) { arcs.set(j, v0.set(0, -999, 0), v0); continue; }
        v0.copy(arcFrom[j]).lerp(v1.set(0, 0.2, 2), Math.max(0, f - 0.25));
        v1.copy(arcFrom[j]).lerp(v1.set(0, 0.2, 2), f);
        arcs.set(j, v0, v1);
      }
      arcs.g.attributes.position.needsUpdate = true;
      arcs.m.opacity = k.wall;
      walker.pos.set([0, (layer - (L - 1) / 2) * st, 2], 0);
      walker.g.attributes.position.needsUpdate = true;
      walker.m.opacity = k.wall;
    },
  };
})();

// ---- Tower: a project's memory, the window a reader can hold, retrieval reaching in, and 31 roles around it
const Tower = (() => {
  const group = new THREE.Group();
  group.position.set(0, 134, 0);
  scene.add(group);
  const N = 72, SP = 0.36, HEAD = new THREE.Vector3(0, N * SP + 4, 0);
  const sl = blocks(new THREE.BoxGeometry(9, 0.2, 9), N, '#2C3543', group);
  for (let i = 0; i < N; i++) { place(sl, i, 0, i * SP, 0); sl.setCol(i, BLUE); }
  const corners = lines(4, '#5B9BF0', group, 0.5);
  [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]].forEach(([x, z], i) => corners.set(i, new THREE.Vector3(x, -0.5, z), new THREE.Vector3(x, N * SP + 0.5, z)));
  const beams = lines(6, '#9CC4FF', group, 0.8);
  const hit = new Float32Array(N);
  const origin = new THREE.Vector3(15, 21, 8);
  const v2 = new THREE.Vector3();
  const targets = new Int32Array(6);
  // One node per agent role in the public roster
  const ROLES = 31, RR = 18;
  const nodes = blocks(new THREE.SphereGeometry(0.46, 14, 10), ROLES, '#46505E', group);
  const edges = lines(ROLES, '#5B9BF0', group, 0.25);
  const pulses = dots(ROLES, BLUE.clone().multiplyScalar(1.6), 0.34, group);
  const at = [];
  for (let i = 0; i < ROLES; i++) {
    const th = (i / ROLES) * Math.PI * 2, y = 10 + 10 * hash(i + 77);
    at.push(new THREE.Vector3(Math.cos(th) * RR, y, Math.sin(th) * RR));
    nodes.setCol(i, BLUE);
  }
  let clock2 = 0;
  label('What a capped reader keeps: about the newest 10%', new THREE.Vector3(-22, 159, 0), (k) => k.wind * k.tower, 'q a');
  label('31 agent roles', new THREE.Vector3(-4, 158, 18), (k) => (k.wind < 0.1 && k.beams < 0.1 && k.sl < 0.1 ? k.tower : 0), 'q a');
  return {
    update(t, dt, k) {
      group.visible = k.tower > 0.01;
      if (!group.visible) return;
      sl.mat.uniforms.uOp.value = nodes.mat.uniforms.uOp.value = k.tower;
      corners.m.opacity = 0.45 * k.tower;
      group.rotation.y = t * 0.05;
      clock2 += dt;
      if (clock2 > 0.7) { clock2 = 0; for (let j = 0; j < 6; j++) { targets[j] = Math.floor(hash(t * 13 + j) * N); hit[targets[j]] = 3; } }
      for (let i = 0; i < N; i++) {
        hit[i] *= Math.exp(-dt * 2.2);
        const newest = i >= N * 0.9 ? 1 : 0;
        sl.glow.setX(i, (0.06 + newest * 1.3 * k.wind + hit[i] * 0.55 * k.beams) * k.tower);
      }
      sl.glow.needsUpdate = true;
      const roleOn = (1 - k.wind) * (1 - k.beams);
      for (let i = 0; i < ROLES; i++) {
        place(nodes, i, at[i].x, at[i].y, at[i].z);
        const f = (t * 0.35 + hash(i + 200)) % 1;
        nodes.glow.setX(i, (0.15 + (f > 0.86 ? 1.2 : 0)) * roleOn);
        edges.set(i, HEAD, at[i]);
        v2.copy(HEAD).lerp(at[i], Math.min(f / 0.86, 1));
        pulses.pos.set([v2.x, v2.y, v2.z], i * 3);
      }
      nodes.mesh.instanceMatrix.needsUpdate = true;
      nodes.glow.needsUpdate = true;
      edges.g.attributes.position.needsUpdate = pulses.g.attributes.position.needsUpdate = true;
      edges.m.opacity = 0.2 * k.tower * roleOn;
      pulses.m.opacity = k.tower * roleOn;
      for (let j = 0; j < 6; j++) { v2.set(0, targets[j] * SP, 0); beams.set(j, origin, v2); }
      beams.g.attributes.position.needsUpdate = true;
      beams.m.opacity = 0.75 * k.beams * k.tower;
    },
  };
})();

// ---- Gate: every runner log, in date order, passing a gate that never fires
const Gate = (() => {
  const group = new THREE.Group();
  group.position.y = 160;
  scene.add(group);
  const flags = gate.flags.split('').map(Number);
  const n = flags.length, COLS = 39, sp = 0.62;
  const cubes = blocks(new THREE.BoxGeometry(0.46, 0.46, 0.46), n, '#39414D', group);
  for (let i = 0; i < n; i++) cubes.setCol(i, BLUE);
  const SEG = 32;
  const ring = blocks(new THREE.BoxGeometry(2.6, 0.34, 0.5), SEG, '#39414D', group);
  const GAPS = new Set([3, 11, 12, 19, 26]);
  for (let i = 0; i < SEG; i++) {
    const th = (i / SEG) * Math.PI * 2;
    dummy.position.set(Math.cos(th) * 13.4, 8, Math.sin(th) * 13.4);
    dummy.rotation.set(0, -th + Math.PI / 2, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    ring.mesh.setMatrixAt(i, dummy.matrix);
    ring.setCol(i, BLUE);
  }
  label('The gate', new THREE.Vector3(-16, 169, 8), (k) => k.gateA * (k.fall > 0.2 ? 1 : 0), 'q a');
  return {
    update(t, dt, k) {
      group.visible = k.gateA > 0.01;
      if (!group.visible) return;
      cubes.mat.uniforms.uOp.value = ring.mat.uniforms.uOp.value = k.gateA;
      for (let i = 0; i < n; i++) {
        const c = i % COLS, r = Math.floor(i / COLS);
        const x0 = (c - (COLS - 1) / 2) * sp, z0 = (r - 10) * sp;
        const f = clamp(k.fall * 1.7 - (i / n) * 0.7);
        const e = f * f;
        const squeeze = 1 - 0.42 * Math.sin(Math.min(f * 1.15, 1) * Math.PI);
        place(cubes, i, x0 * squeeze, mix(22, -14, e), z0 * squeeze);
        cubes.glow.setX(i, flags[i] ? 1.2 * k.lit : 0.03);
      }
      cubes.mesh.instanceMatrix.needsUpdate = true;
      cubes.glow.needsUpdate = true;
      for (let i = 0; i < SEG; i++) {
        const open = GAPS.has(i);
        ring.glow.setX(i, open ? 0 : k.ring * 1.6);
      }
      ring.glow.needsUpdate = true;
    },
  };
})();

// ---- Input from the page
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener('pointermove', (e) => { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; }, { passive: true });
window.addEventListener('world:heads', (e) => { heads = e.detail; });
window.addEventListener('world:fs', (e) => { fsKey = e.detail.key; fsMs = e.detail.ms; });
window.addEventListener('world:prec', (e) => { prec = e.detail; });

// Keys: the buttons set the strip and the measured readout
document.querySelectorAll('[data-keys]').forEach((b) => b.addEventListener('click', () => {
  keysT = +b.dataset.keys;
  document.querySelectorAll('[data-keys]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  const [d, r, x] = DECODE[keysT];
  const out = document.getElementById('dec-read'), sub = document.getElementById('dec-sub');
  if (out) out.textContent = x;
  if (sub) sub.textContent = `at ${keysT} keys: ${d.toFixed(1)} microseconds to decode, ${r.toFixed(1)} to recompute`;
}));

// Turning and hovering the scatter
const scatterZone = document.querySelector('#triton .stage');
if (scatterZone) {
  let drag = null;
  const tip = document.querySelector('.tip');
  const ndc = new THREE.Vector2();
  scatterZone.addEventListener('pointerdown', (e) => { if (e.target.closest('button,a')) return; drag = e.clientX; scatterZone.setPointerCapture(e.pointerId); scatterZone.classList.add('grab'); });
  scatterZone.addEventListener('pointerup', () => { drag = null; scatterZone.classList.remove('grab'); });
  scatterZone.addEventListener('pointermove', (e) => {
    if (drag !== null) { const dx = e.clientX - drag; drag = e.clientX; yawUser += dx * 0.008; yawVel = dx * 0.4; return; }
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const p = Scat.pick(ndc);
    if (p && tip) {
      tip.innerHTML = `<b>M=${p.M}, N=${p.N}, K=${p.K}</b><br>${(prec === 'fp16' ? p.fp16 : p.bf16).toFixed(2)}× against unfused`;
      tip.classList.add('on');
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14) + 'px';
      tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 12) + 'px';
    } else if (tip) tip.classList.remove('on');
  });
  scatterZone.addEventListener('pointerleave', () => { if (tip) tip.classList.remove('on'); });
}

// ---- Frame loop
const lenis = root.classList.contains('lite') ? { raf() {} } : new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: { offset: -60 } });
const v = new THREE.Vector3();
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  measure();
}
window.addEventListener('resize', resize);
window.addEventListener('load', measure);
new ResizeObserver(measure).observe(document.body);

let last = performance.now(), clock = 0, slow = 0, frames = 0, dpr = renderer.getPixelRatio();
const renderOnce = composer.render.bind(composer), noop = () => {};
const STILL = location.search.includes('worldtest');
const LITE = root.classList.contains('lite');
function frame(now) {
  if (!STILL) requestAnimationFrame(frame);
  lenis.raf(now);
  const dt = STILL ? 1 / 30 : Math.min(0.05, (now - last) / 1000);
  const raw = STILL ? 0 : (now - last) / 1000;
  last = now;
  const logTop = document.getElementById('log').getBoundingClientRect().top;
  if (logTop <= 0 || document.hidden || (LITE && window.scrollY > window.innerHeight * 1.2)) { canvas.style.visibility = 'hidden'; return; }
  canvas.style.visibility = 'visible';
  clock += dt;
  if (!LITE) readScroll();
  const ease = 1 - Math.exp(-dt * 7);
  for (const k in K) K[k] += (goal[k] - K[k]) * ease;
  pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
  pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
  camera.position.set(K.cx + pointer.sx * 3.2, K.cy - pointer.sy * 2.2, K.cz);
  camera.lookAt(K.lx, K.ly, K.lz);
  const W = window.innerWidth, H = window.innerHeight;
  camera.setViewOffset(W, H, K.ox * W, K.oy * H, W, H);
  scene.background.setRGB(K.r, K.g, K.b);

  Die.update(clock, K);
  Strip.update(clock, dt, K);
  Fan.update(clock, dt, K);
  Scat.update(clock, dt, K);
  Wall.update(clock, dt, K);
  Tower.update(clock, dt, K);
  Gate.update(clock, dt, K);

  token.position.set(0, K.ty + Math.sin(clock * 1.4) * 0.25, 0);
  token.rotation.y = clock * 0.9;
  shaft.set(0, v.set(0, -2, 0), token.position);
  shaft.g.attributes.position.needsUpdate = true;
  scrimL.style.opacity = K.sl.toFixed(3);
  scrimR.style.opacity = K.sr.toFixed(3);

  camera.updateMatrixWorld();
  for (const l of labels) {
    const op = l.gate(K);
    if (op < 0.02) { l.el.style.opacity = 0; continue; }
    v.copy(l.pos).project(camera);
    const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    l.el.style.opacity = v.z < 1 ? op.toFixed(2) : 0;
    l.el.style.transform = `translate(${clamp(x, 12, W - 320).toFixed(1)}px,${clamp(y, 72, H - 28).toFixed(1)}px)`;
  }
  composer.render(dt);

  // Hold the frame rate on slower GPUs
  frames++;
  if (raw > 0.03) slow++;
  if (frames === 90) {
    if (slow > 45) {
      if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr); }
      else if (bloom.enabled) bloom.enabled = false;
    }
    frames = 0; slow = 0;
  }
}
resize();
if (LITE) Object.assign(goal, { cx: 26, cy: 46, cz: 58, lx: 0, ly: -6, lz: 0, ox: 0, oy: -0.16, occ: 0.5, sl: 0, ty: 6 });
else readScroll();
Object.assign(K, goal);
canvas.classList.add('on');
root.classList.add('world-live');
window.dispatchEvent(new CustomEvent('world:ready'));
if (STILL) window.__worldTick = (n) => { let t = performance.now(); for (let i = 0; i < n; i++) { composer.render = i === n - 1 ? renderOnce : noop; t += 33; frame(t); } };
else requestAnimationFrame(frame);
