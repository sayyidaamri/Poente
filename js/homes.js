/* Homes index: one set of tiles, three layouts (Grid / List / Gallery) and a light filter */
window.PoentePage = function (P) {
  var hm = document.querySelector('.hm'), st = hm.querySelector('.stage');
  var all = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var tiles = all('.tile', st), caps = all('.cap2', st), rows = all('.row2', st), vb = all('[data-view-btn]'), fb = all('[data-light]'), ft = document.querySelector('.ft');
  var view = 'grid', light = 'all', N = rows.length, kinds = rows.map(function (r) { return r.dataset.kind; });
  var ox = 0, oy = 0, vx = 0, vy = 0, tx = 0, ty = 0, dragging = false, moved = 0, plane = [], PW = 1, PH = 1, liveT;
  var HOURS = { all: 11.4, morning: 7, midday: 12.5, evening: 17.4 };
  function place(e, x, y, w, h) { e.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'; e.style.width = w + 'px'; e.style.height = h + 'px'; }
  function shown() { var o = []; for (var i = 0; i < N; i++) if (light === 'all' || kinds[i] === light) o.push(i); return o; }
  /* grid slots (x, y, w, h at 1440) and gallery cluster (six pictures of one home) */
  var SL = [[24, 0, 640, 400], [776, 130, 640, 400], [24, 690, 360, 520], [492, 650, 546, 400], [776, 1190, 640, 400], [400, 1720, 360, 520], [24, 2370, 640, 400], [870, 2230, 546, 400], [140, 2960, 546, 400], [1010, 2830, 360, 520]];
  var CL = [[250, 110, 510, 319], [24, 50, 204, 153], [64, 226, 164, 219], [250, 452, 276, 207], [782, 236, 178, 237], [782, 92, 178, 120]];

  function layout() {
    var W = document.documentElement.clientWidth, m = W < 768, u = m ? W / 390 : Math.max(W / 1440, .72), vis = shown(), top = (m ? 270 : 345) * u, H = 0;
    clearTimeout(liveT); st.classList.remove('live');
    tiles.forEach(function (t) { t.classList.toggle('off', vis.indexOf(+t.dataset.h) < 0 || (view === 'grid' && t.dataset.i !== '0')); });
    caps.forEach(function (c, i) { c.classList.toggle('show', vis.indexOf(i) >= 0); });
    rows.forEach(function (c, i) { c.classList.toggle('show', vis.indexOf(i) >= 0); });
    if (view === 'grid') {
      vis.forEach(function (h, k) {
        var s = SL[k], kx = W / 1440, x = m ? 16 * u : s[0] * kx, y = top + (m ? k * 300 : s[1]) * u, w = m ? 358 * u : s[2] * kx, hh = (m ? 224 : s[3]) * u;
        tiles.forEach(function (t) { if (+t.dataset.h === h) place(t, x, y, w, hh); });
        place(caps[h], x, y + hh, w, 40); H = Math.max(H, y + hh);
      });
      H += 160 * u;
    } else if (view === 'list') {
      var rh = (m ? 156 : 124) * u;
      vis.forEach(function (h, k) {
        var y = top + k * rh; place(rows[h], (m ? 16 : 24) * u, y, (m ? 358 : 640) * u, rh * .9);
        tiles.forEach(function (t) {
          if (+t.dataset.h !== h) return; var i = +t.dataset.i;
          if (m) place(t, (16 + i * 60) * u, y + 88 * u, 54 * u, 40 * u); else place(t, W - (24 + 638) * u + i * 108 * u, y, 98 * u, 74 * u);
        });
      });
      H = top + vis.length * rh + 120 * u;
    } else {
      /* the plane is packed from the homes the light filter leaves, so it is never empty */
      var f = m ? .62 * u : u, cols = vis.length > 5 ? 5 : vis.length, nr = Math.ceil(vis.length / cols);
      PW = Math.max(980 * cols * f, W + 560 * f); PH = Math.max(690 * nr * f, innerHeight + 340 * f);
      plane = tiles.map(function (t) {
        var k = vis.indexOf(+t.dataset.h), c = CL[+t.dataset.i]; if (k < 0) k = +t.dataset.h % vis.length;
        var cx = (k % cols) * PW / f / cols + (k >= cols ? 420 : 0), cy = Math.floor(k / cols) * PH / f / nr + (k % 2 ? 50 : 0) + (nr === 1 ? (innerHeight / f - 740) / 2 : 0);
        return [(cx + c[0]) * f, (cy + c[1]) * f, c[2] * f, c[3] * f];
      });
      gal(true); liveT = setTimeout(function () { if (view === 'gallery') st.classList.add('live'); }, 1150);
    }
    st.style.height = view === 'gallery' ? '' : H + 'px';
    ft.hidden = view === 'gallery'; P.lock(view === 'gallery');
    setTimeout(function () { P.remeasure && P.remeasure(); }, 1200);
  }
  function gal(first) {
    for (var i = 0; i < tiles.length; i++) {
      var p = plane[i], x = ((p[0] + ox) % PW + PW) % PW, y = ((p[1] + oy) % PH + PH) % PH;
      if (x > PW - p[2] - 60) x -= PW; if (y > PH - p[3] - 60) y -= PH;
      if (first) place(tiles[i], x, y, p[2], p[3]); else tiles[i].style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }
  function setView(v, push) {
    if (v === view && push) return; view = v; hm.dataset.view = v;
    vb.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.viewBtn === v); });
    st.classList.remove('dim'); scrollTo(0, 0); layout(); if (push) history.replaceState(null, '', v === 'grid' ? location.pathname : '#' + v);
  }
  vb.forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.viewBtn, true); }); });
  fb.forEach(function (b) {
    b.addEventListener('click', function () {
      light = b.dataset.light; fb.forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      P.setPageHour(HOURS[light]); if (view !== 'gallery') scrollTo(0, 0); layout();
    });
  });
  P.setPageHour(HOURS.all);

  /* hover: keep this home, dim the rest (list + gallery) */
  function hot(h) { st.classList.toggle('dim', h != null && view !== 'grid'); tiles.forEach(function (t) { t.classList.toggle('hot', +t.dataset.h === h); }); }
  tiles.forEach(function (t) {
    t.addEventListener('pointerenter', function (e) { if (!dragging && e.pointerType === 'mouse') hot(+t.dataset.h); });
    t.addEventListener('pointerleave', function () { hot(null); });
    t.addEventListener('dragstart', function (e) { e.preventDefault(); });
    t.addEventListener('click', function (e) { if (moved > 8) e.preventDefault(); });
  });
  rows.forEach(function (r, i) { r.addEventListener('pointerenter', function () { hot(i); }); r.addEventListener('pointerleave', function () { hot(null); }); });

  /* gallery: endless plane */
  var lx, ly, down = false;
  st.addEventListener('pointerdown', function (e) { moved = 0; if (view !== 'gallery') return; down = true; lx = e.clientX; ly = e.clientY; vx = vy = 0; });
  addEventListener('pointermove', function (e) {
    if (!down) return; var dx = e.clientX - lx, dy = e.clientY - ly; moved += Math.abs(dx) + Math.abs(dy); lx = e.clientX; ly = e.clientY; tx += dx; ty += dy; vx = dx; vy = dy;
    if (moved > 8) { dragging = true; st.classList.add('drag'); hot(null); }
  });
  addEventListener('pointerup', function () { if (!down) return; down = false; dragging = false; st.classList.remove('drag'); tx += vx * 9; ty += vy * 9; });
  st.addEventListener('wheel', function (e) { if (view !== 'gallery') return; e.preventDefault(); tx -= e.deltaX; ty -= e.deltaY; }, { passive: false });
  addEventListener('keydown', function (e) {
    if (view !== 'gallery') return; var k = { ArrowLeft: [160, 0], ArrowRight: [-160, 0], ArrowUp: [0, 160], ArrowDown: [0, -160] }[e.key];
    if (k) { tx += k[0]; ty += k[1]; e.preventDefault(); }
  });
  P.onFrame(function () {
    if (view !== 'gallery' || !st.classList.contains('live')) return;
    if (Math.abs(tx - ox) < .1 && Math.abs(ty - oy) < .1) return; ox += (tx - ox) * .1; oy += (ty - oy) * .1; gal();
  });
  var pill = document.querySelector('.pill'), wm = document.querySelector('.wm');
  P.onFrame(function () { pill.classList.toggle('hide', view !== 'gallery' && wm.getBoundingClientRect().top < innerHeight * .9); });
  P.onResize(layout);
  var h0 = location.hash.slice(1); if (h0 === 'list' || h0 === 'gallery') setView(h0); else layout();
  /* no flight-in from the corner on first paint */
  if (view === 'grid') { st.classList.add('live'); setTimeout(function () { st.classList.remove('live'); }, 80); }
};
