(function () {
  var root = document.documentElement;

  /* A number opens its conditions. Esc closes and focus returns to the number. */
  var d = document.getElementById('pop');
  if (d && d.showModal) {
    var pt = document.getElementById('pop-t'), pc = document.getElementById('pop-c'), pa = document.getElementById('pop-a');
    document.addEventListener('click', function (e) {
      var n = e.target.closest && e.target.closest('a.n');
      if (!n || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      pt.textContent = n.dataset.m;
      pc.textContent = n.dataset.c;
      pa.href = n.getAttribute('href');
      d.showModal();
    });
    document.getElementById('pop-x').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  }

  /* Shared tooltip */
  var tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add('on');
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
    tip.style.top = Math.max(8, y - h - 12) + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }

  /* The story drives the pinned figure */
  var scenes = [].slice.call(document.querySelectorAll('[data-scene]'));
  function setState(scene, n) {
    scene.dataset.state = n;
    scene.querySelectorAll('.frame').forEach(function (f) { f.classList.toggle('active', (f.dataset.f || '').split(',').indexOf(String(n)) > -1); });
  }
  var hooks = {};
  function runHook(name) { var p = name.split(':'); if (hooks[p[0]]) hooks[p[0]](p[1]); }
  if (root.classList.contains('story')) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var s = e.target.closest('[data-scene]');
        setState(s, e.target.dataset.step);
        s.querySelectorAll('.step').forEach(function (x) { x.classList.toggle('on', x === e.target); });
        if (e.target.dataset.run) runHook(e.target.dataset.run);
      });
    }, { rootMargin: '-46% 0px -46% 0px' });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); seen.unobserve(e.target); } });
    }, { rootMargin: '-25% 0px -25% 0px' });
    scenes.forEach(function (s) {
      setState(s, '0');
      var steps = s.querySelectorAll('.step');
      if (steps[0]) steps[0].classList.add('on');
      steps.forEach(function (st) { io.observe(st); });
      seen.observe(s);
    });
  }

  /* Foresight switches: measured states on one machine */
  var fs = document.getElementById('foresight');
  if (fs) {
    var MS = { '000': 20.59, '010': 20.18, '100': 20.11, '110': 15.13, '111': 13.78 };
    var NAME = { '000': 'The deployed cache, with no foresight.', '010': 'The deployed cache\'s set, each expert read once.', '100': 'The oracle\'s set, still read twice.', '110': 'The oracle\'s set, each expert read once.', '111': 'The oracle\'s set, read once, with copies issued ahead.' };
    var TOP = 20.59;
    var sw = [].slice.call(fs.querySelectorAll('.sw')), out = document.getElementById('fs-v'), bar = document.getElementById('fs-b');
    var note = document.getElementById('fs-n');
    function read() { return sw.map(function (b) { return b.getAttribute('aria-pressed') === 'true' ? '1' : '0'; }).join(''); }
    function paint() {
      var ok = sw[0].getAttribute('aria-pressed') === 'true' && sw[1].getAttribute('aria-pressed') === 'true';
      sw[2].disabled = !ok;
      if (!ok) sw[2].setAttribute('aria-pressed', 'false');
      var v = MS[read()];
      out.textContent = v.toFixed(2);
      bar.style.transform = 'scaleX(' + (v / TOP).toFixed(4) + ')';
      note.textContent = NAME[read()];
    }
    sw.forEach(function (b) { b.addEventListener('click', function () { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); paint(); }); });
    hooks.fs = function (key) { sw.forEach(function (b, i) { b.setAttribute('aria-pressed', key[i] === '1' ? 'true' : 'false'); }); paint(); };
  }

  /* Two formulas, one head mapping */
  var hm = document.getElementById('heads');
  if (hm) {
    var cA = document.getElementById('hm-a'), cB = document.getElementById('hm-b'), vd = document.getElementById('hm-v');
    function drawHeads(q, kv) {
      var r = Math.floor(q / kv), a = [], b = [];
      for (var h = 0; h < q; h++) { a.push(Math.floor(h / r)); b.push(Math.floor(h / kv) % kv); }
      function fill(el, xs, label) {
        el.style.gridTemplateColumns = 'repeat(' + q + ', minmax(0, 1fr))';
        el.setAttribute('aria-label', label + ': ' + xs.join(' '));
        el.innerHTML = xs.map(function (x) { return '<i class="c' + (x % 4) + '" data-n="' + x + '"></i>'; }).join('');
      }
      fill(cA, a, 'Correct mapping');
      fill(cB, b, 'Buggy mapping');
      var same = a.join() === b.join();
      vd.textContent = same ? 'Same mapping. A test at this shape can\'t see the bug.' : 'Different mapping. A test at this shape catches the bug.';
      vd.classList.toggle('same', same);
    }
    hm.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        hm.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        drawHeads(+b.dataset.q, +b.dataset.kv);
      });
    });
  }

  /* Cache grid explorer */
  var gx = document.getElementById('gridx');
  if (gx) {
    var pick = { host: 'B', model: 'gpt' };
    function showGrid() { gx.querySelectorAll('[data-combo]').forEach(function (c) { c.hidden = c.dataset.combo !== pick.host + pick.model; }); }
    gx.querySelectorAll('.seg').forEach(function (seg) {
      seg.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          pick[seg.dataset.k] = b.dataset.v;
          showGrid();
        });
      });
    });
    showGrid();
  }

  /* Scatter: precision and tooltips */
  var sc = document.getElementById('scatter');
  if (sc) {
    sc.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('circle');
      if (!c) return hideTip();
      showTip('<b>' + c.dataset.s + '</b><br>' + c.dataset.v + '× against unfused', e.clientX, e.clientY);
    });
    sc.addEventListener('pointerleave', hideTip);
    var tog = document.getElementById('scatter-seg');
    if (tog) tog.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        tog.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        sc.querySelectorAll('[data-g]').forEach(function (g) { g.style.display = g.dataset.g === b.dataset.v ? '' : 'none'; });
      });
    });
    sc.querySelectorAll('[data-g="bf16"]').forEach(function (g) { g.style.display = 'none'; });
  }

  /* The year as a trace: move across it to read what was happening */
  var tr = document.getElementById('trace'), td = document.getElementById('trace-data');
  if (tr && td) {
    var data = JSON.parse(td.textContent), box = tr.querySelector('.tracks'), line = tr.querySelector('.play'), ro = tr.querySelector('.readout'), dflt = ro.innerHTML;
    var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    box.addEventListener('pointermove', function (e) {
      var r = box.getBoundingClientRect(), p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), t = data.start + p * (data.end - data.start);
      line.style.left = (p * 100) + '%';
      tr.classList.add('scrub');
      var dt = new Date(t * 864e5), hits = data.items.filter(function (i) { return i.m ? Math.abs(i.s - t) < 4 : t >= i.s && t <= i.e; });
      ro.innerHTML = '<b>' + mon[dt.getUTCMonth()] + ' 2026:</b> ' + (hits.length ? hits.map(function (h) { return h.t; }).join('. ') + '.' : 'Nothing logged here.');
    });
    box.addEventListener('pointerleave', function () { tr.classList.remove('scrub'); ro.innerHTML = dflt; });
  }

  /* Which layer am I in? Ground colour, nav, gauge and the résumé link all follow it. */
  var navres = document.getElementById('navres');
  var chapters = [].slice.call(document.querySelectorAll('[data-chapter]'));
  var gauge = document.querySelector('.gauge');
  if (chapters.length) {
    var dflt2 = navres ? navres.getAttribute('href') : '';
    var layerIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var c = e.target.dataset.chapter;
        if (e.isIntersecting) {
          document.body.dataset.layer = c;
          document.querySelectorAll('.layers a[data-l]').forEach(function (a) { a.classList.toggle('on', a.dataset.l === c); });
          if (gauge) { gauge.classList.add('show'); gauge.querySelectorAll('a').forEach(function (a) { a.classList.toggle('on', a.dataset.l === c); }); }
          if (navres) navres.href = e.target.dataset.resume || dflt2;
        } else if ((e.target === chapters[0] && e.boundingClientRect.top > 0) || (e.target === chapters[chapters.length - 1] && e.boundingClientRect.top < 0)) {
          delete document.body.dataset.layer;
          document.querySelectorAll('.layers a[data-l]').forEach(function (a) { a.classList.remove('on'); });
          if (gauge) gauge.classList.remove('show');
          if (navres) navres.href = dflt2;
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    chapters.forEach(function (c) { layerIO.observe(c); });
    var tok = gauge && gauge.querySelector('.tok');
    if (tok) {
      var first = chapters[0], last = chapters[chapters.length - 1], tick = false;
      window.addEventListener('scroll', function () {
        if (tick) return;
        tick = true;
        requestAnimationFrame(function () {
          tick = false;
          var a = first.offsetTop, b = last.offsetTop + last.offsetHeight - window.innerHeight, p = Math.max(0, Math.min(1, (window.scrollY - a) / (b - a)));
          tok.style.top = ((1 - p) * gauge.offsetHeight) + 'px';
        });
      }, { passive: true });
    }
  }

  /* Filter the full list */
  var fl = document.getElementById('filters');
  if (fl) {
    var rows = document.querySelectorAll('.lrow');
    fl.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        fl.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        var f = b.dataset.f;
        rows.forEach(function (r) { r.hidden = !(f === 'all' || (r.dataset.layers || '').indexOf(f) > -1 || (f === 'merged' && r.dataset.merged === '1')); });
      });
    });
  }
})();
