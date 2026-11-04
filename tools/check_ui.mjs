#!/usr/bin/env node
// Browser checks before cutover. Serve web/dist on BASE, then: node tools/check_ui.mjs
// Needs playwright and @axe-core/playwright, which aren't site dependencies.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4321';
const PAGES = ['/', '/kernels/', '/inference/', '/agents/', '/archive/', '/numbers/', '/404.html',
  '/work/stick-breaking-kernels/', '/work/cudnn-gqa/', '/work/where-the-seconds-go/', '/work/lab-verification/', '/work/bert/'];
const WIDTHS = [320, 390, 1440];
const errors = [];
const browser = await chromium.launch();

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 664 } });
  const page = await ctx.newPage();
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) errors.push(`${path} at ${width}: ${over} px of sideways scroll`);
    const small = await page.evaluate(() => {
      const skip = (e) => e.closest('[aria-hidden="true"]') || e.closest('svg');
      const out = [];
      for (const e of document.querySelectorAll('main *')) {
        if (skip(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const s = getComputedStyle(e);
        if (s.display !== 'none' && parseFloat(s.fontSize) < 13) out.push(`${e.tagName} ${s.fontSize}: ${e.textContent.trim().slice(0, 30)}`);
      }
      return out.slice(0, 3);
    });
    if (small.length) errors.push(`${path} at ${width}: text under 13 px: ${small.join('; ')}`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of axe.violations) {
      errors.push(`${path} at ${width}: axe ${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 70)}`);
    }
  }
  await ctx.close();
}

// A recruiter on a phone sees the positioning, location, availability and the résumé before scrolling.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => ({
    res: [...document.querySelectorAll('.hero .btn')].map((e) => [e.textContent, e.getBoundingClientRect().bottom]),
    height: document.documentElement.scrollHeight,
    text: document.querySelector('.hero').innerText,
    tap: [...document.querySelectorAll('.nav a, .hero .btn')].filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 44).map((e) => e.textContent),
  }));
  for (const [t, b] of r.res) if (b > 664) errors.push(`first screen: ${t} ends at ${Math.round(b)} px, past 664`);
  if (!/open to relocation/i.test(r.text)) errors.push('first screen: location missing');
  if (!/open to full-time/i.test(r.text)) errors.push('first screen: availability missing');
  if (r.height > 17000) errors.push(`home is ${r.height} px on a phone, over 17000`);
  if (r.tap.length) errors.push(`controls under 44 px: ${r.tap.join(', ')}`);
  console.log(`phone home: ${r.height} px, resume links end at ${r.res.map((x) => Math.round(x[1])).join(', ')}`);
  await ctx.close();
}

// A number opens its conditions, Esc closes, and focus returns to the number.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const n = page.locator('.opener a.n').first();
  await n.focus();
  await page.keyboard.press('Enter');
  const open = await page.evaluate(() => document.getElementById('pop').open);
  await page.keyboard.press('Escape');
  const after = await page.evaluate(() => ({ open: document.getElementById('pop').open, focus: document.activeElement.className }));
  if (!open) errors.push('number link: dialog did not open');
  if (after.open) errors.push('number link: Esc did not close');
  if (after.focus !== 'n') errors.push(`number link: focus went to "${after.focus}", not the number`);
  await page.close();
}

// Content must still be there with scripts off, with no layout shift while loading.
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const txt = await page.locator('main').innerText();
  if (!/Résumé/.test(txt) || !/Everything, and where it stands/.test(txt) || !/0 of 270/.test(txt)) errors.push('scripts off: content missing');
  await ctx.close();
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
  const cls = await p2.evaluate(() => window.__cls);
  console.log(`layout shift on load: ${cls.toFixed(4)}`);
  if (cls > 0.01) errors.push(`layout shift ${cls.toFixed(4)}`);
  await p2.close();
}

await browser.close();
console.log(`${errors.length} problems`);
console.log(errors.join('\n'));
process.exit(errors.length ? 1 : 0);
