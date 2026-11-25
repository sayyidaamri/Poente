/* Poente — shared behaviour: day engine, smooth scroll, loader, transitions, reveals, home sections */
(function () {
  var D = document, H = D.documentElement, $ = function (s, r) { return (r || D).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || D).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(hover: none)').matches;
  var mobile = function () { return innerWidth < 768; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; }, lerp = function (a, b, t) { return a + (b - a) * t; }, ss = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var fmt = function (h) { var m = Math.round(h * 60); return ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + m % 60).slice(-2); };
  var P = window.Poente; P.fmt = fmt; P.clamp = clamp; P.reduce = reduce;

  /* ---------- the day: colour by hour ---------- */
  var DAY = [[5, 'C9C6E3'], [6.6, 'E4D8EA'], [9.5, 'F0E9CF'], [12, 'F5F0B9'], [16, 'F9D79B'], [18.5, 'F2995A'], [19, 'EE8A55'], [19.6, '7E3158'], [21, '2A1436'], [23, '1B0E2A']]
    .map(function (s) { return [s[0], [0, 2, 4].map(function (i) { return parseInt(s[1].substr(i, 2), 16); })]; });
  function colour(h) {
    if (h <= DAY[0][0]) return DAY[0][1];
    for (var i = 1; i < DAY.length; i++) if (h <= DAY[i][0]) { var t = (h - DAY[i - 1][0]) / (DAY[i][0] - DAY[i - 1][0]); return [0, 1, 2].map(function (k) { return lerp(DAY[i - 1][1][k], DAY[i][1][k], t); }); }
    return DAY[DAY.length - 1][1];
  }
  function lum(c) { var f = c.map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; }
  var css = function (c) { return 'rgb(' + c.map(Math.round).join(',') + ')'; };
  P.colour = function (h) { return css(colour(h)); };
  var lastBg = '', inkNow = '', hdEl = $('.hd');
  function paint(h) {
    var c = colour(h), s = css(c); if (s === lastBg) return; lastBg = s;
    /* plain properties, not a root variable: writing --bg on <html> every frame would restyle the whole page */
    H.style.backgroundColor = D.body.style.backgroundColor = s; hdEl.style.setProperty('--hb', s);
    var ink = lum(c) > .2 ? '#2A1733' : '#F7E6C4'; if (ink !== inkNow) { inkNow = ink; H.style.setProperty('--ink', ink); }
  }
  var secs = [], hourNow = 6.6, heroHour = null, pinned = null;
  P.setPageHour = function (h) { pinned = h; };
  function measure() {
    var y = scrollY; secs = [];
    $$('[data-hour]').forEach(function (e) {
      var r = e.getBoundingClientRect(), a = e.dataset.hour.split(',').map(Number), top = r.top + y, bot = r.bottom + y, n = a.length;
      a.forEach(function (h, i) { secs.push([n === 1 ? (top + bot) / 2 : lerp(top + innerHeight * .5, bot - innerHeight * .5, i / (n - 1)), h]); });
    });
    secs.sort(function (a, b) { return a[0] - b[0]; });
  }
  function hourAt(y) {
    var m = y + innerHeight / 2; if (!secs.length) return +(H.dataset.h || 6.6);
    if (m <= secs[0][0]) return secs[0][1];
    for (var i = 1; i < secs.length; i++) if (m <= secs[i][0]) return lerp(secs[i - 1][1], secs[i][1], (m - secs[i - 1][0]) / (secs[i][0] - secs[i - 1][0]));
    return secs[secs.length - 1][1];
  }
  /* header clock */
  var cT = $('.clock time'), cS = $('.clock circle');
  function clock(h) {
    if (!cT) return; var t = fmt(h); if (cT.textContent !== t) { cT.textContent = t; cT.setAttribute('datetime', t); }
    var k = clamp((h - 5) / 17, 0, 1), a = Math.PI * (1 - k); cS.setAttribute('cx', 52 + Math.cos(a) * 48); cS.setAttribute('cy', 24 - Math.sin(a) * 20);
  }
  /* header colour over photographs */
  var hds = $$('.hd .brand,.hd .clock,.hd .nav'), darks = [];
  function collectDark() { darks = $$('[data-dark],.media,.full,.gal figure,.tile,.ring .im'); }
  var pins = $$('.study,.sundial,section.ring');
  function headerTone() {
    var rs = [], i, n = darks.length;
    for (i = 0; i < n; i++) { var r = darks[i].getBoundingClientRect(); if (r.top < 60 && r.bottom > 12 && r.width > 40 && !(darks[i].classList.contains('off'))) rs.push(r); }
    hds.forEach(function (e) {
      var b = e.getBoundingClientRect(), y = b.top + b.height / 2, x = b.left + b.width / 2;
      e.classList.toggle('inv', rs.some(function (r) { return r.top < y && r.bottom > y && r.left < x + b.width * .3 && r.right > x - b.width * .3; }));
    });
    /* fade the page under the header, except over photographs and pinned scenes */
    hdEl.classList.toggle('photo', rs.some(function (r) { return r.width > innerWidth * .94 && r.bottom > 40; }));
    hdEl.classList.toggle('fog', scrollY > 20 && !rs.length && !pins.some(function (p) { var r = p.getBoundingClientRect(); return r.top <= 0 && r.bottom >= innerHeight - 4; }));
  }

  /* ---------- smooth scroll (wheel only) ---------- */
  var ty = scrollY, cy = scrollY, moving = false, locked = false;
  P.lock = function (v) { locked = v; };
  if (!reduce && !touch) {
    addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.defaultPrevented) return; if (locked) { e.preventDefault(); return; }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var sc = e.target.closest && e.target.closest('[data-native]'); if (sc) return;
      e.preventDefault(); var d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1);
      if (!moving || Math.abs(scrollY - Math.round(cy)) > 3) { ty = cy = scrollY; } ty = clamp(ty + d, 0, H.scrollHeight - innerHeight); moving = true;
    }, { passive: false });
    addEventListener('keydown', function () { moving = false; });
    addEventListener('mousedown', function () { moving = false; });
  }
  P.scrollTo = function (y) { if (reduce || touch) scrollTo(0, y); else { cy = scrollY; ty = clamp(y, 0, H.scrollHeight - innerHeight); moving = true; } };
  $$('a[href^="#"]').forEach(function (a) { a.addEventListener('click', function (e) { var t = $(a.getAttribute('href')); if (!t || a.classList.contains('skip')) return; e.preventDefault(); P.scrollTo(t.getBoundingClientRect().top + scrollY - 100); history.replaceState(null, '', a.getAttribute('href')); }); });

  /* ---------- text split + reveal ---------- */
  function split(el) {
    var words = [];
    (function walk(n) {
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var f = D.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (t) { if (!t) return; if (/^\s+$/.test(t)) { f.appendChild(D.createTextNode(' ')); return; } var w = D.createElement('span'), i = D.createElement('i'); w.className = 'w'; i.textContent = t; w.appendChild(i); f.appendChild(w); words.push(w); });
          n.replaceChild(f, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    })(el);
    function lines() { var y = null, l = -1; words.forEach(function (w) { if (y === null || Math.abs(w.offsetTop - y) > 6) { l++; y = w.offsetTop; } w.style.setProperty('--l', Math.min(l, 9)); }); }
    lines(); el._lines = lines;
  }
  function reveals() {
    $$('[data-split]').forEach(split);
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    $$('[data-split]:not(.swap),[data-fade],.media.rv').forEach(function (e) {
      /* clip-path hides a zero-height target from IO: observe its parent instead */
      if (e.classList.contains('media')) { var io2 = new IntersectionObserver(function (x) { if (x[0].isIntersecting) { e.classList.add('in'); io2.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' }); io2.observe(e.parentElement); }
      else io.observe(e);
    });
  }

  /* ---------- per-frame modules ---------- */
  var mods = []; P.onFrame = function (f) { mods.push(f); };
  var sized = []; P.onResize = function (f) { sized.push(f); };
  function prog(el) { var r = el.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); }
  P.prog = prog;
  var near = function (el) { var r = el.getBoundingClientRect(); return r.top < innerHeight * 1.2 && r.bottom > -innerHeight * .2; };

  function parallax() {
    var els = $$('[data-plx]');
    mods.push(function () {
      if (reduce) return;
      els.forEach(function (e) { var p = e.parentElement.getBoundingClientRect(); if (p.bottom < -200 || p.top > innerHeight + 200) return; var k = (p.top + p.height / 2 - innerHeight / 2) / innerHeight; e.style.transform = 'translate3d(0,' + (k * -parseFloat(e.dataset.plx)).toFixed(2) + 'rem,0)'; });
      if (!mobile()) $$('[data-drift]').forEach(function (e) { var r = e.parentElement.getBoundingClientRect(); if (r.bottom < -600 || r.top > innerHeight + 600) return; var o = e.offsetTop + e.offsetParent.getBoundingClientRect().top, k = (o + e.offsetHeight / 2 - innerHeight / 2) / innerHeight; e.style.transform = 'translate3d(0,' + (clamp(k, -1.2, 1.2) * parseFloat(e.dataset.drift)).toFixed(2) + 'rem,0)'; });
    });
  }

  /* hero: drag the sun */
  function hero() {
    var h = $('.hero'); if (!h) return;
    var im = $$('.lay img', h), lay = $('.lay', h), inp = $('.dial input', h), out = $('.dial output', h), word = $('.dial [data-word]', h), sn = $('.dial .sn', h), rg = $('.dial .ring', h);
    var keys = [6, 12.5, 18.8, 21.6], cur = 6, target = 6, user = false, mx = 0, my = 0, px = 0, py = 0;
    var names = [[7.6, 'First light'], [10.5, 'Morning'], [14.5, 'Midday'], [17.4, 'Afternoon'], [19.6, 'Last light'], [99, 'After dark']];
    function set(v) {
      cur = v; heroHour = v;
      /* layers are stacked, each fades in over the one below */
      for (var i = 1; i < 4; i++) im[i].style.opacity = ss((v - keys[i - 1]) / (keys[i] - keys[i - 1])).toFixed(3);
      var k = (v - 5.5) / 17, a = Math.PI * (1 - k), x = 190 + Math.cos(a) * 180, y = 84 - Math.sin(a) * 76;
      sn.setAttribute('cx', x); sn.setAttribute('cy', y); rg.setAttribute('cx', x); rg.setAttribute('cy', y);
      out.textContent = fmt(v); word.textContent = names.filter(function (n) { return v < n[0]; })[0][1];
      if (D.activeElement !== inp || !user) inp.value = v;
      inp.setAttribute('aria-valuetext', fmt(v) + ', ' + word.textContent);
    }
    inp.addEventListener('input', function () { user = true; target = +inp.value; });
    h.addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
    set(reduce ? 12.5 : 6); target = cur;
    P.heroPlay = function () { if (reduce || user) return; var t0 = performance.now(); (function go(n) { if (user) return; var t = clamp((n - t0) / 5200, 0, 1); target = lerp(6, 13, t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); if (t < 1) requestAnimationFrame(go); })(t0); };
    mods.push(function () {
      if (scrollY > innerHeight * 1.1) return;
      if (Math.abs(target - cur) > .004) set(lerp(cur, target, user ? .16 : .3));
      px = lerp(px, mx, .05); py = lerp(py, my, .05);
      lay.style.transform = 'translate3d(' + (-px * 2.4).toFixed(2) + 'rem,' + (-py * 1.4 + scrollY / innerHeight * 14).toFixed(2) + 'rem,0)';
    });
  }

  /* light study canvas */
  function study() {
    var s = $('.study.room'); if (s) {
      var c = $('canvas', s), room = new P.Room(c, { lat: 38.7, facing: 118, a: 3, b: 3 }), oh = $('[data-hr]', s), oa = $('[data-al]', s), n = 0, last = '';
      sized.push(function () { room.resize(); last = ''; });
      mods.push(function () {
        if (!near(s)) return; var p = prog(s); n++;
        room.seed = reduce ? 1 : Math.floor(n / 10) % 4; room.draw_ = ss(p / .16); room.hour = lerp(6.2, 18.2, clamp((p - .12) / .86, 0, 1));
        var k = room.seed + '|' + p.toFixed(4) + H.style.getPropertyValue('--ink'); if (k === last) return; last = k;
        var r = room.render(); oh.textContent = fmt(room.hour); oa.textContent = 'Sun ' + Math.max(0, Math.round(r.v.alt)) + '° above the horizon, at ' + Math.round(r.v.az) + '°';
      });
    }
    var q = $('.study.path'); if (q) {
      var sp = new P.SunPath($('canvas', q), 38.7), m = 0, l2 = '';
      sized.push(function () { sp.resize(); l2 = ''; });
      mods.push(function () { if (!near(q)) return; m++; sp.seed = reduce ? 1 : Math.floor(m / 10) % 4; var p = clamp(prog(q) * 1.15, 0, 1), k = sp.seed + '|' + p.toFixed(4) + H.style.getPropertyValue('--ink'); if (k === l2) return; l2 = k; sp.render(p); });
    }
  }

  /* sundial: twelve spokes that bow with scroll speed */
  function sundial() {
    var s = $('.sundial'); if (!s) return;
    var c = $('canvas', s), g = c.getContext('2d'), W, Hh, tx = $$('.swap', s), lastP = 0, vel = 0, cur = -2;
    function rs() { var r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; Hh = r.height; c.width = W * d; c.height = Hh * d; g.setTransform(d, 0, 0, d, 0, 0); } rs(); sized.push(rs);
    mods.push(function () {
      if (!near(s)) return; var p = prog(s); vel = lerp(vel, clamp((p - lastP) * 60, -1.6, 1.6), .12); lastP = p;
      var rect = s.getBoundingClientRect(), i = rect.top > innerHeight * .45 ? -1 : Math.min(tx.length - 1, Math.floor(p * tx.length * .999));
      if (i !== cur) { cur = i; tx.forEach(function (t, j) { t.classList.toggle('on', j === i); t.classList.toggle('out', j < i); t.setAttribute('aria-hidden', j !== i); }); }
      g.clearRect(0, 0, W, Hh); var ink = inkNow; g.strokeStyle = g.fillStyle = ink; g.lineWidth = 1;
      var m = mobile(), cx = W / 2, cyy = Hh / 2, R1 = m ? W * .39 : Math.min(W * .36, Hh * .47), R0 = R1 * (m ? .5 : .44), rot = p * Math.PI * 1.1 - 1.2, N = 12, hr = lerp(17, 22.5, p);
      var open = clamp(1 - rect.top / innerHeight, 0, 1);
      g.font = '500 ' + (m ? 12 : 14) + 'px "Host Grotesk",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (var k = 0; k < N; k++) {
        var a = rot + k / N * Math.PI * 2, b = a - vel * .5, x0 = cx + Math.cos(a) * R0, y0 = cyy + Math.sin(a) * R0, e = lerp(R0, R1, ss(open)), x1 = cx + Math.cos(b) * e, y1 = cyy + Math.sin(b) * e, mr = (R0 + e) / 2, ma = (a + b) / 2 + vel * .22;
        g.globalAlpha = .5; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx + Math.cos(ma) * mr, cyy + Math.sin(ma) * mr, x1, y1); g.stroke();
        g.globalAlpha = 1; var lr = e + 18; g.fillText(('0' + ((6 + k * 2) % 24)).slice(-2), cx + Math.cos(b) * lr, cyy + Math.sin(b) * lr);
      }
      /* the gnomon's shadow */
      var sa = rot + (hr - 6) / 2 / N * Math.PI * 2; g.globalAlpha = .13; g.beginPath(); g.moveTo(cx, cyy); g.arc(cx, cyy, R1, sa - .2, sa + .2); g.closePath(); g.fill(); g.globalAlpha = 1;
      /* sun low on the dial, sliding out of frame */
      var sx = cx + Math.cos(sa + Math.PI) * (R1 + 44), sy = cyy + Math.sin(sa + Math.PI) * (R1 + 44); g.fillStyle = '#FF5B1F'; g.beginPath(); g.arc(sx, sy, m ? 10 : 16, 0, 7); g.fill();
    });
  }

  /* ring of photographs: rises as an arc, wraps the year, slides aside for the numbers */
  function ring() {
    var s = $('section.ring'); if (!s) return; var im = $$('.im', s), N = im.length, yr = $('.yr', s), st = $('.stats', s), items = $$('.stat', s), head = $('[data-split]', yr);
    mods.push(function () {
      if (!near(s)) return; var p = prog(s), W = innerWidth, V = innerHeight, m = mobile();
      var a = ss(p / .2), b = ss((p - .46) / .14);
      /* phase 0: huge radius, centre far below -> phase 1: round the screen -> phase 2: smaller, left */
      var r1 = m ? W * .5 : Math.min(W * .44, V * .60), r = lerp(lerp(W * 1.05, r1, a), m ? W * .34 : Math.min(W * .25, V * .44), b);
      var x = lerp(W / 2, m ? W * .5 : W * .2, b), y = lerp(lerp(V * .74 + W * 1.05, V / 2, a), m ? V * .3 : V / 2, b);
      var spin = p * Math.PI * 3.1, sc = lerp(1, m ? .86 : .8, b);
      im.forEach(function (e, i) { var t = i / N * Math.PI * 2 + spin; e.style.transform = 'translate3d(' + (x + Math.cos(t) * r).toFixed(1) + 'px,' + (y + Math.sin(t) * r).toFixed(1) + 'px,0) rotate(' + (t * 180 / Math.PI + 90).toFixed(2) + 'deg) scale(' + sc + ')'; });
      yr.style.opacity = clamp(Math.min((p - .16) / .06, (.46 - p) / .05), 0, 1); if (p > .16 && head) head.classList.add('in');
      var q = (p - .5) / .5, h = items.length * V * .56; st.style.transform = 'translate3d(0,' + lerp(V * 1.05, V * .5 - h + V * .28, clamp(q, 0, 1)).toFixed(1) + 'px,0)';
      items.forEach(function (e) { var r2 = e.getBoundingClientRect(), c = r2.top + r2.height * (m ? .75 : .5); e.classList.toggle('on', Math.abs(c - V * (m ? .68 : .5)) < V * .28); });
    });
  }

  /* moon phases round the last line */
  function moons() {
    var s = $('.moons'); if (!s) return; var o = $('.o', s), N = 14;
    for (var i = 0; i < N; i++) {
      var ph = i / N, d = D.createElement('div'); d.className = 'moon';
      var k = Math.cos(ph * Math.PI * 2), right = ph < .5, rx = Math.abs(k) * 50;
      /* lit half + terminator ellipse */
      var dd = 'M50 0A50 50 0 0 ' + (right ? 1 : 0) + ' 50 100A' + rx + ' 50 0 0 ' + ((right ? k > 0 : k <= 0) ? (right ? 0 : 1) : (right ? 1 : 0)) + ' 50 0Z';
      if (!right) dd = 'M50 0A50 50 0 0 0 50 100A' + rx + ' 50 0 0 ' + (k > 0 ? 1 : 0) + ' 50 0Z';
      d.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="#F6E3A1" d="' + (ph === 0 ? '' : dd) + '"/></svg>'; o.appendChild(d);
    }
    var els = $$('.moon', o);
    mods.push(function (t) {
      if (!near(s)) return; var r = s.getBoundingClientRect(), k = (innerHeight - r.top) / (innerHeight + r.height), R = mobile() ? [innerWidth * .4, r.height * .38] : [Math.min(innerWidth * .4, 620), r.height * .4];
      els.forEach(function (e, i) { var a = i / N * Math.PI * 2 - Math.PI / 2 + (reduce ? 0 : k * 1.6); e.style.transform = 'translate(' + (Math.cos(a) * R[0]).toFixed(1) + 'px,' + (Math.sin(a) * R[1]).toFixed(1) + 'px)'; });
    });
  }

  /* footer wordmark: the O is the sun, going down into the line */
  function footer() {
    var wm = $('.wm'); if (!wm) return; var sp = $('span', wm), o = $('.sunO', wm);
    function fit() { wm.style.fontSize = '100px'; sp.style.display = 'inline-flex'; sp.style.gap = '0'; var w = sp.scrollWidth - 2 * parseFloat(getComputedStyle(sp).paddingLeft); sp.style.display = ''; var av = innerWidth - 2 * parseFloat(getComputedStyle(sp).paddingLeft); wm.style.fontSize = Math.min(av / w * 100 * .985, innerHeight * .82) + 'px'; } fit(); sized.push(fit);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(fit);
    mods.push(function () { if (!near(wm) || reduce) return; var r = wm.getBoundingClientRect(), k = clamp((innerHeight - r.top) / (r.height + 60), 0, 1); o.style.transform = 'translate3d(0,' + (lerp(-260, 34, ss(k))).toFixed(1) + '%,0)'; });
    wm.style.overflow = 'visible'; wm.style.clipPath = 'inset(-400vh 0 0 0)';
  }

  /* ---------- page transition ---------- */
  var veil = $('.veil');
  function inner(a) { if (!a.href || a.target || a.hasAttribute('download')) return false; var u = new URL(a.href, location.href); return u.protocol === location.protocol && u.host === location.host && !/^(mailto|tel)/.test(u.protocol) && u.pathname !== location.pathname; }
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button || !inner(a)) return;
    try { sessionStorage.setItem('poente-in', '1'); } catch (x) { }
    if (reduce) return; e.preventDefault(); if (a.dataset.vc) veil.style.setProperty('--vc', a.dataset.vc); try { sessionStorage.setItem('poente-vc', getComputedStyle(veil).getPropertyValue('--vc')); } catch (x) { }
    veil.classList.add('up'); setTimeout(function () { location.href = a.href; }, 760);
  });
  addEventListener('pageshow', function (e) { if (e.persisted) { veil.className = 'veil'; } });

  function ready() { H.classList.add('ready'); if (P.heroPlay) P.heroPlay(); $$('.hero [data-split],.hh [data-split],.ah [data-split]').forEach(function (e) { e.classList.add('in'); }); }
  function enter() {
    var came = H.classList.contains('entering'), ld = $('.ld');
    if (came) {
      veil.classList.add('cover'); H.classList.remove('entering');
      requestAnimationFrame(function () { requestAnimationFrame(function () { veil.style.clipPath = 'circle(150% at 50% -12%)'; void veil.offsetWidth; veil.classList.remove('cover'); veil.classList.add('off'); veil.style.clipPath = ''; setTimeout(ready, 250); setTimeout(function () { veil.className = 'veil'; }, 1000); }); });
      return;
    }
    if (!ld || H.classList.contains('skipld') || reduce) { H.classList.add('done'); ready(); return; }
    /* first visit: the clock runs from 05:00 to sunrise */
    var b = $('b', ld), bar = $('i', ld), sun = $('s', ld), t0 = performance.now(), T = 1900; locked = true;
    var stops = [[27, 14, 42], [92, 46, 92], [233, 160, 140], [228, 216, 234]];
    (function go(n) {
      var t = clamp((n - t0) / T, 0, 1), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, k = e * 2.999, i = Math.floor(k), f = k - i;
      b.textContent = fmt(5 + e * 1.67); bar.style.transform = 'scaleX(' + e + ')'; ld.style.background = css([0, 1, 2].map(function (c) { return lerp(stops[i][c], stops[i + 1][c], f); })); b.style.color = e > .72 ? '#2A1733' : '';
      sun.style.transform = 'translateY(' + (-e * innerHeight * .56) + 'px)';
      if (t < 1) return requestAnimationFrame(go);
      var y = -innerHeight * .56, R = Math.hypot(innerWidth, innerHeight) / sun.offsetWidth * 2.6;
      b.animate([{ transform: 'none' }, { transform: 'translateY(160%)' }], { duration: 500, fill: 'forwards', easing: 'cubic-bezier(.7,0,.2,1)' });
      bar.animate([{ transformOrigin: 'right', transform: 'scaleX(1)' }, { transformOrigin: 'right', transform: 'scaleX(0)' }], { duration: 600, fill: 'forwards', easing: 'cubic-bezier(.7,0,.2,1)' });
      sun.animate([{ transform: 'translateY(' + y + 'px) scale(1)', background: '#FF5B1F' }, { transform: 'translateY(' + y + 'px) scale(' + R + ')', background: '#FFC98F' }], { duration: 850, fill: 'forwards', easing: 'cubic-bezier(.7,0,.2,1)' })
        .onfinish = function () { locked = false; ready(); ld.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: 'forwards' }).onfinish = function () { H.classList.add('done'); }; };
    })(t0);
  }

  /* ---------- boot ---------- */
  function boot() {
    try { sessionStorage.removeItem('poente-in'); } catch (x) { }
    reveals(); parallax(); hero(); study(); sundial(); ring(); moons(); footer();
    if (window.PoentePage) window.PoentePage(P);
    measure(); collectDark();
    addEventListener('load', measure); if (D.fonts && D.fonts.ready) D.fonts.ready.then(measure);
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { sized.forEach(function (f) { f(); }); $$('[data-split]').forEach(function (e) { e._lines && e._lines(); }); measure(); collectDark(); }, 120); });
    P.remeasure = function () { measure(); collectDark(); };
    var fr = 0;
    (function tick(t) {
      /* someone else moved the page (scrollbar, script, find-in-page): let go */
      if (moving && Math.abs(scrollY - Math.round(cy)) > 3) moving = false;
      if (moving) { cy = lerp(cy, ty, .11); if (Math.abs(ty - cy) < .4) { cy = ty; moving = false; } scrollTo(0, cy); }
      var h = hourAt(scrollY); hourNow = h;
      if (pinned != null) { hourNow = P._ph = P._ph == null ? pinned : lerp(P._ph, pinned, .08); h = scrollY > innerHeight * 1.5 && secs.length ? hourAt(scrollY) : hourNow; }
      paint(h);
      var ch = h; if (heroHour != null) { var k = clamp(scrollY / (innerHeight * .9), 0, 1); ch = lerp(heroHour, h, k); } clock(ch);
      if (fr++ % 4 === 0) headerTone();
      for (var i = 0; i < mods.length; i++) mods[i](t);
      requestAnimationFrame(tick);
    })(0);
    enter();
  }
  boot();
})();
