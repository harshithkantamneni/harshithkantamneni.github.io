// Everything on the home and track pages. Copy uses the markup in lib/rich.mjs.
import prData from './prs.json';

export const CHECKED = prData.checked;

const prUrl = (k) => {
  const p = prData.prs[k];
  return `https://github.com/${p.repo}/pull/${p.number}`;
};
export function prState(k) {
  const p = prData.prs[k];
  if (p.merged_at) return 'Merged';
  return p.state === 'open' ? 'Open, in review' : 'Closed, not merged';
}

const GH = 'https://github.com/harshithkantamneni/';

export const LANES = [
  {
    id: 'kernels', cls: 'k', name: 'Kernels', track: '/kernels/',
    title: 'GPU kernels', role: 'GPU kernel engineer',
    resume: { label: 'Kernel résumé', href: '/Harshith_Kantamneni_GPU_Kernel_Resume.pdf' },
    proof: '[[count.merged|3 PRs merged]]: Triton attention kernels and KV-cache decoding in flash-linear-attention, tests in NVIDIA cuDNN frontend.',
    spans: [
      { label: 'Triton vs cuBLAS', start: '2026-01-01', end: '2026-02-28', top: 20, href: '/archive/#triton' },
      { label: 'Upstream kernel PRs, Mar to now', start: '2026-03-01', end: null, top: 20, href: '/kernels/' },
    ],
    marks: [
      { label: '#1287', date: '2026-10-06', top: 44, href: prUrl('cudnn1287') },
      { label: '#1319', date: '2026-10-08', top: 44, href: prUrl('fla1319') },
      { label: '#1412', date: '2026-10-27', top: 44, href: prUrl('fla1412') },
    ],
    labels: [
      { html: ['#1287', '#1319'], hrefs: [prUrl('cudnn1287'), prUrl('fla1319')], style: 'right:7%;top:20px' },
      { html: ['#1412'], hrefs: [prUrl('fla1412')], style: 'right:0;top:20px' },
    ],
    quick: [
      { t: '#1319', href: prUrl('fla1319') },
      { t: '#1412', href: prUrl('fla1412') },
      { t: '#1287', href: prUrl('cudnn1287') },
    ],
  },
  {
    id: 'inference', cls: 'i', name: 'Inference', track: '/inference/',
    title: 'LLM inference', role: 'LLM inference engineer',
    resume: { label: 'Inference résumé', href: '/Harshith_Kantamneni_LLM_Inference_Resume.pdf' },
    proof: 'Built a llama.cpp expert cache for batch-1 MoE decode, measured on [[count.gpus|3 GPU models]]. vLLM RFC measurement and load tests.',
    spans: [
      { label: 'vLLM serving benchmark', start: '2026-06-01', end: '2026-06-30', top: 20, href: GH + 'llm-inference-benchmarking' },
      { label: 'MoE decode: Where the Seconds Go', start: '2026-09-01', end: null, top: 20, right: true, href: '/work/where-the-seconds-go/' },
    ],
    marks: [{ label: '#1412', date: '2026-10-27', top: 44, href: prUrl('fla1412') }],
    labels: [{ html: ['#1412, also in Kernels'], hrefs: [prUrl('fla1412')], style: 'right:0;top:64px' }],
    quick: [
      { t: 'Where the Seconds Go', href: '/work/where-the-seconds-go/' },
      { t: 'RFC comment', href: 'https://github.com/vllm-project/vllm/issues/46295#issuecomment-5788867616' },
    ],
  },
  {
    id: 'agents', cls: 'a', name: 'Agents', track: '/agents/',
    title: 'Agent systems', role: 'Agentic AI engineer',
    resume: { label: 'Agents résumé', href: '/Harshith_Kantamneni_Agentic_AI_Resume.pdf' },
    proof: 'Built sign-off verification for a [[count.roles|31-role]] agent lab and audited it against runner logs. The old gate ran on [[lab.gate|0 of 270]] eligible sessions, by my count. Shipped an improved detector.',
    spans: [
      { label: 'Agent research lab', start: '2026-04-01', end: '2026-09-18', top: 2, href: '/work/lab-verification/' },
      { label: 'bert: memory server for coding agents', start: '2026-05-01', end: '2026-06-30', top: 54, href: '/work/bert/' },
    ],
    marks: [{ label: 'Lab audit', date: '2026-09-18', top: 26, href: GH + 'agi-lab-framework/tree/main/audits' }],
    labels: [{ html: ['Lab audit'], hrefs: [GH + 'agi-lab-framework/tree/main/audits'], style: 'left:calc(84.97% + 14px);top:21px' }],
    quick: [
      { t: 'Lab audit', href: '/work/lab-verification/' },
      { t: 'bert', href: '/work/bert/' },
    ],
  },
];

export const WORK = {
  k: [
    {
      title: 'Stick-breaking attention kernels', href: '/work/stick-breaking-kernels/', state: 'Merged Oct 8 and Oct 27',
      blurb: 'Continued #599 to add forward and backward Triton kernels to flash-linear-attention, then KV-cache decoding. Rewrote the backward to fix a silent zero gradient at saturated logits, caught in review. On H100, [[pr1319.tiles|64×32 tiles]] fit [[pr1319.tiles|57-89 KiB]] of shared memory where [[pr1319.tiles|64×64]] needed [[pr1319.tiles|129-193 KiB]]. Nsight Compute shows no saturated pipe at [[pr1319.occupancy|about 12% occupancy]], which I read as stalls on fp32 scans. It still takes [[pr1319.vs_authors|1.04-1.42×]] the original authors\' time.',
    },
    {
      title: 'GQA in NVIDIA cuDNN', href: '/work/cudnn-gqa/', state: 'Tests merged Oct 6. Prototype closed Sep 27',
      blurb: 'On A100 at [[pr1223.copy|64/8 heads]] and a [[pr1223.copy|128K KV cache]], K/V head copies took [[pr1223.copy|7.28 ms]] against a [[pr1223.copy|6.0-6.7 ms]] kernel. Removing them made [[pr1223.batched|6 batched rows 2.6-3.3×]] faster, and [[pr1223.oom|10 more]] stopped running out of memory. The cuDNN backend stayed faster on [[pr1223.backend|27 of 31]] multi-token rows. What merged is tests, which catch [[pr1287.bugs|3 injected bugs]] that NVIDIA\'s SM80 tests missed.',
    },
    {
      title: 'moe-kernels: a timing model of vLLM\'s fused MoE kernel', href: GH + 'moe-kernels/tree/gh200-analysis-2026-09-27', state: 'Public repo. Decode blind test failed',
      blurb: 'Built a model that predicts each call\'s DRAM bytes and time from the routing and the tile, and tested it by freezing predictions before each GH200 rental. Model v3's time predictions held on one [[mk.v3|32×64×64]] test tile, at [[mk.v3|0.51-0.69%]] rms on [[mk.v3|3 models]], while its byte predictions missed by [[mk.v3|11.76%]] rms on OLMoE's first wave. The decode blind test failed: [[mk.decode|11.4%]] rms pooled over [[mk.decode|5 models unseen in decode]], against a [[mk.decode|1.5%]] bar. No model is blind-certified on vLLM\'s own tiles yet.',
    },
    {
      title: 'TransformerEngine #3591: grouped NVFP4 dequantization', href: prUrl('te3591'), pr: 'te3591',
      blurb: 'CUDA kernel and a fixed PyTorch binding, reading offsets on device so it runs in a CUDA graph. Output matches per-tensor results bitwise. I haven\'t timed it.',
    },
    {
      title: 'vLLM #38338: Triton NVFP4 GEMM reference', href: prUrl('vllm38338'), pr: 'vllm38338',
      blurb: 'Ordered grouped tiles and autotuned tile sizes, holding [[pr38338.tflops|1,014-1,076 TFLOP/s]] on RTX 5090 for one shape from [[pr38338.tflops|batch 8192 up]], where the first revision [[pr38338.first|fell to 418]]. On Llama QKV with hot L2: [[pr38338.hot|1.38-3.04× CUTLASS up to batch 128]], [[pr38338.hot|0.77-0.91× above]], and [[pr38338.b200|about 0.27× across 4 Llama shapes on B200 from batch 1024]]. The weakest shape was [[pr38338.weak|0.53-0.57×]]. I closed it after #21014 was closed as not planned.',
    },
  ],
  i: [
    {
      title: 'Where the Seconds Go: MoE decode from host memory', href: '/work/where-the-seconds-go/', state: 'Public manuscript and code, not peer reviewed',
      blurb: 'Built a llama.cpp expert cache for batch-1 MoE decode when the model doesn\'t fit on the GPU. On RTX 5090 hosts, gpt-oss-120b ran at [[sec.speed|58-153 tokens/s]] with [[sec.speed|11-40%]] of its experts on the GPU, and the cache ran faster than FreeToken in [[sec.vs_ft|11 of 12]] configurations, or [[wsg.ft_tuned|0.98-1.17×]] with FreeToken tuned. At gpt-oss\'s smallest cache on [[sec.limit|25 consumer machines]], it reached [[sec.limit|31-54%]] of a computed speed limit. I chose that consumer scope after seeing the data.',
    },
    {
      title: 'vLLM RFC #46295: speculative decoding on MoE', href: 'https://github.com/vllm-project/vllm/issues/46295#issuecomment-5788867616', state: 'Comment on someone else\'s RFC',
      blurb: 'On [[rfc.oracle|one H200]] with CPU ngram drafts, offline and synthetic, a per-workload oracle improved on the best static batch-size table by [[rfc.oracle|at most 1.8%]]. vLLM\'s MFU byte model overcounted expert reads, [[rfc.mfu|up to 3×]] in the worst cell. It's one model, and I built no controller.',
    },
    {
      title: 'flash-linear-attention #1412: KV-cache decoding', href: '/work/stick-breaking-kernels/', state: 'Merged Oct 27, also in Kernels',
      blurb: 'Tested against the uncached forward. On H200 [[pr1412.step|at batch 1]] and [[pr1412.step|64K keys]], [[pr1412.grid|32 programs on 132 SMs]] take [[pr1412.step|4.3 ms]], against a K/V read floor of [[pr1412.floor|about 0.06 ms]] computed from rated bandwidth, not measured.',
    },
    {
      title: 'GQA\'s KV-cache rows in cuDNN', href: '/work/cudnn-gqa/', state: 'Same page as the Kernels entry',
      blurb: 'The same copy removal, seen from decode. Multi-token steps ran [[pr1223.kv|1.15-2.19×]] faster at a 128K KV cache, with the time saved following the copy's size, by my reading. The caveats are on the case study.',
    },
    {
      title: 'vLLM serving benchmark, first pass', href: GH + 'llm-inference-benchmarking', state: 'Public repo',
      blurb: 'Load-tested vLLM with Qwen2.5-7B on H100 NVL across offered rates. TPOT ran [[srv.graphs|31-34%]] lower with CUDA graphs than eager, and FP8 cut it [[srv.fp8|27-36%]]. [[srv.runs|One run per rate]], so treat it as a first pass.',
    },
  ],
  a: [
    {
      title: 'Lab verification and audit', href: '/work/lab-verification/', state: 'Public repo, private logs',
      blurb: 'Designed and ran a lab of [[count.roles|31 Claude Code]] agent roles on one [[lab.memory|18 GB]] MacBook. Built its sign-off verification, audited it against runner logs and shipped an improved detector with regression tests. The old gate ran on [[lab.gate|0 of 270]] eligible sessions, by my count. The new detector is better and still bypassable, and the repo lists the known gaps.',
    },
    {
      title: 'bert: searchable memory for coding agents', href: '/work/bert/', state: 'Public repo',
      blurb: 'A local MCP server with hybrid retrieval. On a [[bert.corpus|1.26M-token]] synthetic project memory, bert and agentic grep [[bert.large|both scored 0.90]], with no significant difference, while full context [[bert.fullctx|fell to 0.08]] because truncation drops history. On code, grep scored higher, [[bert.code|0.97 to 0.86]].',
    },
    {
      title: 'The Obsidian Archive', href: GH + 'obsidian-engine', state: 'Public repo',
      blurb: 'A [[obs.stages|13-stage]] pipeline that researches, writes, renders and uploads a documentary from one topic, with atomic checkpoints and resume, automatic retries, an optional budget cap on Claude spend and failure alerts. A crash during upload can publish twice, and the cap resets on resume.',
    },
  ],
};

export const LOG = [
  { date: 'Oct 27', start: '2026-10-27', end: '2026-10-27', lane: 'k', layer: 'Kernels, Inference', title: 'flash-linear-attention #1412: KV-cache decoding', href: prUrl('fla1412'), pr: 'fla1412' },
  { date: 'Oct 8', start: '2026-10-08', end: '2026-10-08', lane: 'k', layer: 'Kernels', title: 'flash-linear-attention #1319: stick-breaking attention in Triton', href: prUrl('fla1319'), pr: 'fla1319' },
  { date: 'Oct 7', start: '2026-10-07', end: '2026-10-07', lane: 'k', layer: 'Kernels', title: 'vLLM #38338: Triton NVFP4 GEMM reference', href: prUrl('vllm38338'), pr: 'vllm38338' },
  { date: 'Oct 6', start: '2026-10-06', end: '2026-10-06', lane: 'k', layer: 'Kernels', title: 'NVIDIA cuDNN frontend #1287: GQA tests', href: prUrl('cudnn1287'), state: 'Tests merged' },
  { date: 'Sep 27', start: '2026-09-27', end: '2026-09-27', lane: 'k', layer: 'Kernels', title: 'NVIDIA cuDNN frontend #1223: native GQA prototype', href: prUrl('cudnn1223'), pr: 'cudnn1223' },
  { date: 'Sep 23', start: '2026-09-23', end: '2026-09-23', lane: 'i', layer: 'Inference', title: 'vLLM RFC #46295: measurement comment', href: 'https://github.com/vllm-project/vllm/issues/46295#issuecomment-5788867616', state: 'Comment' },
  { date: 'Sep 18', start: '2026-09-18', end: '2026-09-18', lane: 'a', layer: 'Agents', title: 'Lab audit and improved detector', href: '/work/lab-verification/', state: 'Public repo' },
  { date: 'Sep to now', start: '2026-09-01', end: null, lane: 'i', layer: 'Inference', title: 'Where the Seconds Go: MoE decode from host memory', href: '/work/where-the-seconds-go/', state: 'Not peer reviewed' },
  { date: 'Sep to now', start: '2026-09-27', end: null, lane: 'k', layer: 'Kernels', title: 'moe-kernels: timing model of vLLM\'s fused MoE kernel', href: GH + 'moe-kernels/tree/gh200-analysis-2026-09-27', state: 'Public repo' },
  { date: 'Open', start: null, end: null, lane: 'k', layer: 'Kernels', title: 'TransformerEngine #3591: grouped NVFP4 dequantization', href: prUrl('te3591'), pr: 'te3591' },
  { opt: true, date: 'Jun', start: '2026-06-01', end: '2026-06-30', lane: 'i', layer: 'Inference', title: 'vLLM serving benchmark', href: GH + 'llm-inference-benchmarking', state: 'First pass' },
  { opt: true, date: 'May to Jun', start: '2026-05-01', end: '2026-06-30', lane: 'a', layer: 'Agents', title: 'bert: searchable memory for coding agents', href: '/work/bert/', state: 'Public repo' },
  { opt: true, date: 'Apr to Sep', start: '2026-04-01', end: '2026-09-18', lane: 'a', layer: 'Agents', title: 'Autonomous ML research lab', href: '/work/lab-verification/', state: 'Public repo, private logs' },
  { opt: true, date: 'Feb to Sep', start: '2026-02-01', end: '2026-09-30', lane: 'a', layer: 'Agents', title: 'The Obsidian Archive', href: GH + 'obsidian-engine', state: 'Public repo' },
  { opt: true, date: 'Jan to Feb', start: '2026-01-01', end: '2026-02-28', lane: 'k', layer: 'Kernels', title: 'Triton vs cuBLAS benchmark', href: '/archive/#triton', state: 'Public repo' },
];

export const WRITING = [
  { date: 'Nov 2026', kind: 'Worklog', title: 'When the K/V copy costs more than the attention', href: '/notes/kv-copies-gqa/', blurb: 'What removing cuDNN\'s K/V head copies did and didn\'t do, and the tests that merged.' },
  { date: 'May 2026', kind: 'Report, not peer reviewed', title: 'Below the Measurement Floor: a pre-registered dense-vs-MoE null', href: '/reports/below-the-measurement-floor-a-pre-registered-dense-vs-moe-null-at-sub-100m-active-parameters/', blurb: 'Every cell lands below the measurement floor, and the null is the result.' },
  { date: 'May 2026', kind: 'Report, not peer reviewed', title: 'Recursive Verification-Surface Collapse', href: '/reports/recursive-verification-surface-collapse/', blurb: 'The null-set principal problem in self-grading labs, from [[writing.cycles|about 90 autonomous cycles]].' },
  { date: 'May 2026', kind: 'Note', title: 'When the LLM judge is biased', href: '/notes/llm-judge-bias/', blurb: 'Same-family preference leakage when [[note.judges|four Claude instances]] review the same proposals, read against an ICLR 2026 result.' },
  { date: 'May 2026', kind: 'Note', title: 'Tier-per-task: routing models by the job', href: '/notes/tier-per-task/', blurb: 'Why model tiering belongs at the task level, not the role level.' },
];

export const OLDER = [
  { id: 'triton', title: 'Triton vs cuBLAS', href: '/archive/#triton', tag: 'Kernels', blurb: 'A fused GEMM, bias and GeLU kernel across [[tri.shapes|76 LLM-shaped GEMMs]] on an A100. [[tri.median|Median 0.96×]] against the unfused path, with [[tri.best|1.73×]] on one shape.' },
  { id: 'jetson', title: 'Jetson Orin Nano profiling', href: GH + 'edge-llm-gpu-profiling', tag: 'Inference, edge', blurb: 'Attention and KV-cache decode kernels profiled with Nsight on a [[jet.power|15 W]] edge SoC. Fused SDPA ran [[jet.fused|2.78-5.55×]] faster than a manual matmul and softmax baseline across [[jet.fused|5 sizes]].' },
  { id: 'gem5', title: 'MI300X and gem5 modeling', href: '/archive/#gem5', tag: 'Team project, ECE 752', blurb: 'Built the gem5 full-system setup and wrote HIP benchmarks for the AMD MI300X memory hierarchy. [[gem5.team|Team of 3]].' },
  { id: 'ml', title: 'ML-guided kernel config', href: GH + 'Ml-Guided-CUDA-Config', tag: 'Team project, ECE 759', blurb: 'A PyTorch model predicts kernel runtime and picks a config by argmin over a grid. [[ml.team|Team of 4]].' },
  { id: 'hive', title: 'HIVE', href: GH + 'hive-engine', tag: 'Agents', blurb: 'A privacy-first peer-to-peer reasoning engine in Rust. Alpha research prototype.' },
];

export const CASES = {
  'stick-breaking-kernels': { lane: 'k', title: 'Stick-breaking attention kernels', lead: 'Forward, backward and KV-cache decoding kernels in Triton, merged in flash-linear-attention.', state: 'Merged Oct 8 and Oct 27, 2026', next: 'cudnn-gqa' },
  'cudnn-gqa': { lane: 'k', title: 'GQA in NVIDIA cuDNN', lead: 'What removing K/V head copies did on an A100, why that code closed, and the tests that merged.', state: 'Tests merged Oct 6, 2026. Prototype closed Sep 27, 2026', next: 'stick-breaking-kernels' },
  'where-the-seconds-go': { lane: 'i', title: 'Where the Seconds Go', lead: 'A llama.cpp expert cache for batch-1 MoE decode when the model doesn\'t fit on the GPU, and a computed limit to read it against.', state: 'Public manuscript and code, not peer reviewed', next: 'stick-breaking-kernels' },
  'lab-verification': { lane: 'a', title: 'Lab verification and audit', lead: 'Sign-off verification for a lab of Claude Code agent roles, an audit of it against runner logs, and an improved detector.', state: 'Public repo, private logs', next: 'bert' },
  bert: { lane: 'a', title: 'bert', lead: 'A local MCP server that gives a coding agent searchable memory of a project, measured against agentic grep, including where grep scored higher.', state: 'Public repo', next: 'lab-verification' },
};
