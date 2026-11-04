/* Any element with data-c opens what that number means, its conditions and its source. */
(function () {
  const base = document.currentScript.src;
  let data = null;
  const dlg = document.createElement('dialog');
  dlg.className = 'numd';
  dlg.setAttribute('data-lenis-prevent', '');
  dlg.setAttribute('aria-labelledby', 'numd-v');
  dlg.innerHTML = '<div class="numd-v" id="numd-v"></div><p class="numd-m"></p><p class="numd-c"></p><p class="numd-s"></p><div class="numd-f"><a class="numd-all" href="">Every number on this site</a><button type="button">Close</button></div>';
  const st = document.createElement('style');
  st.textContent = '.numd{width:min(560px,calc(100% - 32px));margin:auto;padding:24px 26px;background:#0c0e11;color:#EEEFF1;border:1px solid rgba(255,255,255,.16);border-radius:16px;font-family:"Space Grotesk",system-ui,sans-serif}.numd::backdrop{background:rgba(0,0,0,.6)}.numd-v{font-family:"JetBrains Mono",monospace;font-size:clamp(28px,5vw,40px);font-weight:700;letter-spacing:-.02em;color:#FFB454;line-height:1.1}.numd-m{font-size:18px;line-height:1.35;margin-top:12px;font-weight:500}.numd-c{font-size:15px;line-height:1.55;color:#A2A7AF;margin-top:10px}.numd-s{font-size:14px;line-height:1.5;color:#A2A7AF;margin-top:10px}.numd-s a,.numd-all{color:#EEEFF1;text-decoration:underline;text-underline-offset:3px}.numd-f{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;font-size:14px}.numd-f button{font-family:"JetBrains Mono",monospace;font-size:12px;color:#EEEFF1;background:none;border:1px solid rgba(255,255,255,.16);border-radius:8px;min-height:40px;padding:0 12px;cursor:pointer}[data-c].has-c{cursor:pointer;transition:opacity .2s}[data-c].has-c:hover{opacity:.82}[data-c].has-c:focus-visible{outline:2px solid #6AA8FF;outline-offset:4px;border-radius:6px}';
  document.head.appendChild(st);
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(dlg));
  if (document.readyState !== 'loading') document.body.appendChild(dlg);
  const q = (s) => dlg.querySelector(s);
  q('button').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  const load = () => (data ? Promise.resolve(data) : fetch(new URL('claims.json', base)).then((r) => r.json()).then((d) => { data = new Map(d.map((c) => [c.id, c])); return data; }));
  async function open(el, e) {
    let m;
    try { m = await load(); } catch (err) { if (el.href) location.href = el.href; return; }
    const c = m.get(el.dataset.c);
    if (!c) return;
    if (e) e.preventDefault();
    q('.numd-v').textContent = el.textContent.trim() || c.shows[0];
    q('.numd-m').textContent = c.means;
    q('.numd-c').textContent = c.conditions;
    q('.numd-s').innerHTML = c.source.map((s) => s.html).join(', ');
    q('.numd-s').querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    q('.numd-all').href = new URL('index.html#' + c.id, base).href;
    dlg.showModal();
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-c]');
    if (!el || dlg.contains(el)) return;
    e.preventDefault();
    open(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest && e.target.closest('[data-c].has-c');
    if (el) { e.preventDefault(); open(el, e); }
  });
})();
