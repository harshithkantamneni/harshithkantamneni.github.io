#!/usr/bin/env node
// Draws the preview images into web/public/og. Serve web/dist on BASE first, because the fonts come from there.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4321';
const IMAGES = {
  home: { head: 'Harshith Kantamneni', sub: 'GPU kernel, LLM inference and agent systems engineer', rows: [['Kernels', '#FF6A4D'], ['Inference', '#FFB454'], ['Agents', '#6AA8FF']] },
  kernels: { head: 'Harshith Kantamneni', sub: 'GPU kernel engineer', rows: [['Kernels', '#FF6A4D']] },
  inference: { head: 'Harshith Kantamneni', sub: 'LLM inference engineer', rows: [['Inference', '#FFB454']] },
  agents: { head: 'Harshith Kantamneni', sub: 'Agentic AI engineer', rows: [['Agents', '#6AA8FF']] },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [name, c] of Object.entries(IMAGES)) {
  await page.goto(BASE + '/numbers/');
  await page.setContent(`<!doctype html><base href="${BASE}/"><style>
    @font-face{font-family:A;src:url('/fonts/atkinson.woff2');font-weight:200 800}
    @font-face{font-family:I;src:url('/fonts/iosevka-700.woff2');font-weight:700}
    body{margin:0;width:1200px;height:630px;background:#101216;color:#EEEFF1;font-family:A;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box}
    h1{font-size:84px;font-weight:600;letter-spacing:-.02em;margin:0}
    p{font-size:36px;margin:20px 0 50px;color:#D9DBDF}
    .r{display:flex;align-items:center;gap:26px;margin:10px 0;font:700 32px I}
    .r i{display:block;height:22px;width:var(--w);background:var(--c)}
  </style><h1>${c.head}</h1><p>${c.sub}</p>${c.rows.map(([t, col], i) => `<div class="r" style="color:${col};--c:${col};--w:${[640, 520, 420][i]}px"><span style="width:190px">${t}</span><i></i></div>`).join('')}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `web/public/og/${name}.png` });
}
await browser.close();
