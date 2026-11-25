/* House page: light plan (month + hour) and the gallery's three layouts */
window.PoentePage = function (P) {
  var lp = document.querySelector('.lp');
  if (lp) {
    var cfg = JSON.parse(lp.dataset.cfg), c = lp.querySelector('.box canvas'), room = new P.Room(c, cfg);
    var inp = lp.querySelector('.rng'), out = lp.querySelector('.ctl output'), note = lp.querySelector('.ctl p'), btns = [].slice.call(lp.querySelectorAll('[data-day]')), idx = 0, n = 0, last = '';
    var auto = !P.reduce, seen = 0;
    var thumbs = btns.map(function (b) { var r = new P.Room(b.querySelector('canvas'), cfg); r.day = P.DAYS[b.dataset.day]; return r; });
    function pick(i) { idx = (i + btns.length) % btns.length; btns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === idx); }); room.day = P.DAYS[btns[idx].dataset.day]; last = ''; }
    btns.forEach(function (b, i) { b.addEventListener('click', function () { pick(i); }); });
    lp.querySelector('[data-prev]').addEventListener('click', function () { pick(idx - 1); });
    lp.querySelector('[data-next]').addEventListener('click', function () { pick(idx + 1); });
    inp.addEventListener('input', function () { last = ''; auto = false; });
    P.onResize(function () { room.resize(); thumbs.forEach(function (t) { t.resize(); t.render({ north: false }); }); last = ''; });
    P.onFrame(function () {
      var r = lp.getBoundingClientRect(); if (r.top > innerHeight || r.bottom < 0) return; n++;
      if (auto && r.top < innerHeight * .5) { seen = Math.min(1, seen + 1 / 260); inp.value = 7 + (+inp.dataset.to - 7) * (1 - Math.pow(1 - seen, 3)); if (seen === 1) auto = false; }
      room.hour = +inp.value; room.draw_ = 1; room.seed = P.reduce ? 1 : Math.floor(n / 10) % 4;
      var k = room.seed + '|' + room.hour + '|' + room.day + document.documentElement.style.getPropertyValue('--ink'); if (k === last) return; last = k;
      var res = room.render(); out.textContent = P.fmt(room.hour); inp.setAttribute('aria-valuetext', P.fmt(room.hour));
      note.textContent = res.v.alt < 0 ? 'The sun is down.' : res.any ? 'Direct sun in the main room.' : 'Daylight, no direct sun.';
      if (n % 5 === 1) thumbs.forEach(function (t) { t.hour = room.hour; t.render({ north: false }); });
    });
    thumbs.forEach(function (t) { t.hour = 10; t.render({ north: false }); }); pick(0);
  }

  var g = document.querySelector('.gal'), pill = document.querySelector('.pill'), bs = [].slice.call(document.querySelectorAll('[data-gal]')), figs = [].slice.call(g.children);
  function to(v) {
    var A = figs.map(function (f) { return f.getBoundingClientRect(); });
    g.dataset.v = v; g.scrollLeft = 0; if (v === 'slider') g.tabIndex = 0; else g.removeAttribute('tabindex');
    bs.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.gal === v); });
    var top = g.getBoundingClientRect().top; if (top < -40 || v === 'slider') scrollTo(0, scrollY + top - 90);
    if (!P.reduce) figs.forEach(function (f, i) {
      var a = A[i], b = f.getBoundingClientRect(); if (!b.width) return;
      f.animate([{ transformOrigin: '0 0', transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + a.width / b.width + ',' + a.height / b.height + ')' }, { transformOrigin: '0 0', transform: 'none' }], { duration: 950, easing: 'cubic-bezier(.7,0,.2,1)' });
    });
    P.remeasure();
  }
  bs.forEach(function (b) { b.addEventListener('click', function () { if (g.dataset.v !== b.dataset.gal) to(b.dataset.gal); }); });
  P.onFrame(function () { var r = g.getBoundingClientRect(); pill.classList.toggle('hide', r.top > innerHeight * .7 || r.bottom < innerHeight * .35); });
  var dn = false, lx = 0, v = 0;
  g.addEventListener('pointerdown', function (e) { if (g.dataset.v !== 'slider' || e.pointerType === 'touch') return; dn = true; lx = e.clientX; v = 0; g.classList.add('drag'); });
  addEventListener('pointermove', function (e) { if (!dn) return; v = e.clientX - lx; lx = e.clientX; g.scrollLeft -= v; });
  addEventListener('pointerup', function () { dn = false; g.classList.remove('drag'); });
  P.onFrame(function () { if (!dn && Math.abs(v) > .3) { g.scrollLeft -= v; v *= .94; } });
};
