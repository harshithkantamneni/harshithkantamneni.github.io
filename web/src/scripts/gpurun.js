// A small attention kernel run on the visitor's own GPU through WebGPU: once writing K and V out per query head,
// once reading the shared KV heads directly. It shows the idea on their hardware. It isn't the PR's code or its numbers.
const HQ = 64, HKV = 8, S = 4096, D = 32, SQ = 4;

const common = `
struct P { hq: u32, hkv: u32, s: u32, d: u32, sq: u32, pad0: u32, pad1: u32, pad2: u32 };
@group(0) @binding(0) var<uniform> p: P;
`;
const COPY = common + `
@group(0) @binding(1) var<storage, read> kin: array<f32>;
@group(0) @binding(2) var<storage, read> vin: array<f32>;
@group(0) @binding(3) var<storage, read_write> kout: array<f32>;
@group(0) @binding(4) var<storage, read_write> vout: array<f32>;
@compute @workgroup_size(256) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x; let n = p.s * p.d;
  if (i >= p.hq * n) { return; }
  let h = i / n; let off = i % n;
  let src = (h / (p.hq / p.hkv)) * n + off;
  kout[i] = kin[src];
  vout[i] = vin[src];
}`;
// One workgroup per query head and query. Reads K and V through a head mapping chosen by a uniform.
const ATTN = common + `
@group(0) @binding(1) var<storage, read> k: array<f32>;
@group(0) @binding(2) var<storage, read> v: array<f32>;
@group(0) @binding(3) var<storage, read> q: array<f32>;
@group(0) @binding(4) var<storage, read_write> o: array<f32>;
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) g: vec3u) {
  let h = g.x; let t = g.y;
  let kh = select(h, h / (p.hq / p.hkv), p.pad0 == 1u);
  let kbase = kh * p.s * p.d;
  let qbase = (h * p.sq + t) * p.d;
  var total = 0.0;
  var acc = 0.0;
  for (var s = 0u; s < p.s; s++) {
    var dot = 0.0;
    for (var x = 0u; x < p.d; x++) { dot += q[qbase + x] * k[kbase + s * p.d + x]; }
    let w = exp(clamp(dot, -8.0, 8.0));
    total += w;
    acc += w * v[kbase + s * p.d];
  }
  o[h * p.sq + t] = acc / total;
}`;

function fill(n) {
  const a = new Float32Array(n);
  let x = 1234567;
  for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; a[i] = ((x >>> 0) / 4294967296 - 0.5) * 0.5; }
  return a;
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

export async function run(onStatus) {
  if (!navigator.gpu) throw new Error('This browser has no WebGPU.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('This browser found no WebGPU adapter here.');
  const limits = adapter.limits;
  const bytes = HQ * S * D * 4;
  if (limits.maxStorageBufferBindingSize < bytes) throw new Error('This GPU allows smaller buffers than the kernel needs.');
  const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: bytes, maxBufferSize: bytes } });
  const info = adapter.info || {};
  const name = [info.vendor, info.architecture, info.description].filter(Boolean).join(' ').trim() || 'your GPU';
  const buf = (usage, data, size) => {
    const b = device.createBuffer({ size: size || data.byteLength, usage, mappedAtCreation: !!data });
    if (data) { new data.constructor(b.getMappedRange()).set(data); b.unmap(); }
    return b;
  };
  const SB = GPUBufferUsage.STORAGE;
  const uni = (mapped) => buf(GPUBufferUsage.UNIFORM, new Uint32Array([HQ, HKV, S, D, SQ, mapped, 0, 0]));
  const kIn = buf(SB, fill(HKV * S * D)), vIn = buf(SB, fill(HKV * S * D));
  const kOut = buf(SB, null, bytes), vOut = buf(SB, null, bytes);
  const qB = buf(SB, fill(HQ * SQ * D));
  const oB = buf(SB, null, HQ * SQ * 4);
  const pipe = (code) => device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code }), entryPoint: 'main' } });
  const pCopy = pipe(COPY), pAttn = pipe(ATTN);
  const bind = (pl, entries) => device.createBindGroup({ layout: pl.getBindGroupLayout(0), entries: entries.map((b, i) => ({ binding: i, resource: { buffer: b } })) });
  const uCopied = uni(0), uDirect = uni(1);
  const bgCopy = bind(pCopy, [uCopied, kIn, vIn, kOut, vOut]);
  const bgAfter = bind(pAttn, [uCopied, kOut, vOut, qB, oB]);
  const bgDirect = bind(pAttn, [uDirect, kIn, vIn, qB, oB]);
  const once = async (copies) => {
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    if (copies) {
      pass.setPipeline(pCopy); pass.setBindGroup(0, bgCopy);
      pass.dispatchWorkgroups(Math.ceil((HQ * S * D) / 256));
    }
    pass.setPipeline(pAttn); pass.setBindGroup(0, copies ? bgAfter : bgDirect);
    pass.dispatchWorkgroups(HQ, SQ);
    pass.end();
    const t0 = performance.now();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    return performance.now() - t0;
  };
  // Warm up, then alternate so neither path gets the cooler or warmer turn
  onStatus('Warming up');
  await once(true); await once(false);
  const a = [], b = [];
  const ROUNDS = 7;
  for (let i = 0; i < ROUNDS; i++) {
    onStatus(`Round ${i + 1} of ${ROUNDS}`);
    a.push(await once(true));
    b.push(await once(false));
  }
  device.destroy();
  return { name, withCopies: median(a), without: median(b) };
}
