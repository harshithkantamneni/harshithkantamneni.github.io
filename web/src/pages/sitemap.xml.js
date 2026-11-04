import { CASES } from '../data/site.mjs';

const PATHS = [
  '/', '/kernels/', '/inference/', '/agents/', '/archive/', '/numbers/',
  ...Object.keys(CASES).map((s) => `/work/${s}/`),
  '/notes/kv-copies-gqa/', '/notes/llm-judge-bias/', '/notes/tier-per-task/',
  '/reports/recursive-verification-surface-collapse/',
  '/reports/below-the-measurement-floor-a-pre-registered-dense-vs-moe-null-at-sub-100m-active-parameters/',
];

export function GET({ site }) {
  const urls = PATHS.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
