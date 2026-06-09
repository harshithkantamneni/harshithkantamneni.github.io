// motion.js — brutalist redesign
// Single interaction: cursor proximity drives Bricolage weight axis on hero.
// Plus theme toggle.
// Plus: external links open in a new tab (target=_blank, rel=noopener noreferrer).

(function () {
  'use strict';

  // External-link policy: any <a href="http(s)://OTHER_HOST"> opens in a new
  // tab. Internal links (same-host, mailto:, tel:, #fragment, relative paths)
  // open in-place. Applied at DOM-ready so curator-generated content inherits
  // the behaviour with no per-page edits.
  function applyExternalLinkPolicy() {
    const here = location.hostname;
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return;            // skip mailto, /, #, relative
      let host;
      try { host = new URL(href, location.href).hostname; } catch (_) { return; }
      if (!host || host === here) return;                 // same-site → stay in tab
      if (!a.target) a.target = '_blank';
      const rels = new Set((a.rel || '').split(/\s+/).filter(Boolean));
      rels.add('noopener');
      rels.add('noreferrer');
      a.rel = Array.from(rels).join(' ');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyExternalLinkPolicy);
  } else {
    applyExternalLinkPolicy();
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  if (!reducedMotion && !coarsePointer) {
    const hero = document.querySelector('[data-hero] .hero-headline');
    if (hero) {
      const PROXIMITY = 240;
      const MIN_WEIGHT = 500;
      const MAX_WEIGHT = 700;
      let raf = null;
      let pendingX = 0;
      let pendingY = 0;

      const update = () => {
        raf = null;
        const rect = hero.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = pendingX - cx;
        const dy = pendingY - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let weight;
        if (distance >= PROXIMITY) {
          weight = MIN_WEIGHT;
        } else {
          const t = 1 - distance / PROXIMITY;
          weight = MIN_WEIGHT + (MAX_WEIGHT - MIN_WEIGHT) * t;
        }
        hero.style.fontVariationSettings = `"wght" ${Math.round(weight)}`;
      };

      window.addEventListener('pointermove', (e) => {
        pendingX = e.clientX;
        pendingY = e.clientY;
        if (raf === null) raf = requestAnimationFrame(update);
      }, { passive: true });
    }
  }

  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    const STORAGE_KEY = 'theme';
    const root = document.documentElement;

    const applyTheme = (theme) => {
      root.setAttribute('data-theme', theme);
      const lightLabel = toggle.querySelector('[data-theme-label="light"]');
      const darkLabel = toggle.querySelector('[data-theme-label="dark"]');
      if (theme === 'dark') {
        if (lightLabel) lightLabel.hidden = true;
        if (darkLabel) darkLabel.hidden = false;
      } else {
        if (lightLabel) lightLabel.hidden = false;
        if (darkLabel) darkLabel.hidden = true;
      }
    };

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      applyTheme(stored);
    } else {
      applyTheme('light');
    }

    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  }
})();
