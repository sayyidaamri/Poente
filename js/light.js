/* Poente — sun position and light-in-a-room drawing.
   No images involved: the sun is computed from latitude, date and solar hour,
   each window is projected along the sun's rays onto floor and walls. */
(function (root) {
  var R = Math.PI / 180;

  /* Sun altitude + azimuth (degrees, azimuth clockwise from north) in solar time */
  function sun(lat, day, hour) {
    var d = 23.44 * Math.sin(R * 360 * (284 + day) / 365) * R, p = lat * R, H = 15 * (hour - 12) * R;
    var alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    var az = 180 + Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p)) / R;
    return { alt: alt / R, az: (az + 360) % 360 };
  }

  var DAYS = { jun: 172, sep: 265, dec: 355 };

  /* Room in metres. x=0 wall faces `facing`, y=0 wall faces facing+90. */
  var ROOM = { w: 7, d: 6, h: 3.1 };
  function windowsFor(cfg) {
    var out = [], i, n, span, w;
    n = cfg.a; span = ROOM.d / Math.max(n, 1); w = Math.min(1.25, span * .62);
    for (i = 0; i < n; i++) { var c = span * (i + .5); out.push({ wall: 'a', pts: [[0, c - w / 2, .35], [0, c + w / 2, .35], [0, c + w / 2, 2.6], [0, c - w / 2, 2.6]] }); }
    n = cfg.b; span = ROOM.w / Math.max(n, 1); w = Math.min(1.35, span * .6);
    for (i = 0; i < n; i++) { var k = span * (i + .5); out.push({ wall: 'b', pts: [[k - w / 2, 0, .35], [k + w / 2, 0, .35], [k + w / 2, 0, 2.6], [k - w / 2, 0, 2.6]] }); }
    n = cfg.roof || 0; span = ROOM.w / Math.max(n, 1);
    for (i = 0; i < n; i++) { var m = span * (i + .5); out.push({ wall: 'roof', pts: [[m - .45, 1, ROOM.h], [m + .45, 1, ROOM.h], [m + .45, 5, ROOM.h], [m - .45, 5, ROOM.h]] }); }
    return out;
  }
  function vec(cfg, day, hour) {
    var s = sun(cfg.lat, day, hour), e = s.alt * R, a = (s.az - cfg.facing) * R;
    return { x: -Math.cos(e) * Math.cos(a), y: -Math.cos(e) * Math.sin(a), z: Math.sin(e), alt: s.alt, az: s.az };
  }
  function lit(v, wall) {
    if (v.alt < 1.5) return false;
    return wall === 'a' ? v.x < -.06 : wall === 'b' ? v.y < -.06 : v.z > .1;
  }
  /* Hours of direct sun in the main room on a given day */
  function sunHours(cfg, day) {
    var t = 0, w = [];
    if (cfg.a) w.push('a'); if (cfg.b) w.push('b'); if (cfg.roof) w.push('roof');
    for (var h = 3; h < 21; h += 1 / 12) { var v = vec(cfg, day, h); if (w.some(function (k) { return lit(v, k); })) t += 1 / 12; }
    return Math.round(t * 10) / 10;
  }

  /* Sutherland–Hodgman clip of [u,v] polygon to rectangle */
  function clip(poly, U, V) {
    var tests = [[0, 0, 1], [0, U, -1], [1, 0, 1], [1, V, -1]];
    tests.forEach(function (t) {
      var k = t[0], lim = t[1], sg = t[2], out = [];
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length], ia = (A[k] - lim) * sg >= 0, ib = (B[k] - lim) * sg >= 0;
        if (ia) out.push(A);
        if (ia !== ib) { var f = (lim - A[k]) / (B[k] - A[k]); out.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]); }
      }
      poly = out;
    });
    return poly.length > 2 ? poly : null;
  }

  function Room(canvas, cfg) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.cfg = cfg; this.wins = windowsFor(cfg);
    this.hour = 9; this.day = DAYS.sep; this.draw_ = 1; this.seed = 1; this.resize();
  }
  Room.prototype.set = function (cfg) { this.cfg = cfg; this.wins = windowsFor(cfg); };
  Room.prototype.resize = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height; this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var C = Math.cos(30 * R);
    this.S = Math.min(this.W / ((ROOM.w + ROOM.d) * C + 1.4), this.H / ((ROOM.w + ROOM.d) * .5 + ROOM.h + 1));
    this.ox = this.W / 2 - (ROOM.w - ROOM.d) * C * this.S / 2;
    this.oy = (this.H - ((ROOM.w + ROOM.d) * .5 + ROOM.h) * this.S) / 2 + ROOM.h * this.S;
  };
  Room.prototype.p = function (a) { return [this.ox + (a[0] - a[1]) * .8660254 * this.S, this.oy + (a[0] + a[1]) * .5 * this.S - a[2] * this.S]; };
  function rnd(n) { var s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s) - .5; }
  /* A line as a hand would draw it: two passes, slightly bowed, overshooting the corner */
  Room.prototype.line = function (a, b, id, amp) {
    var g = this.g, A = this.p(a), B = this.p(b), k = this.draw_, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, o = 5 / L;
    amp = amp == null ? 1.6 : amp;
    for (var n = 0; n < 2; n++) {
      var q = id * 13 + n * 7 + this.seed * 3, bx = rnd(q) * amp * 2, by = rnd(q + 1) * amp * 2;
      g.beginPath();
      g.moveTo(A[0] - dx * o + rnd(q + 2) * amp, A[1] - dy * o + rnd(q + 3) * amp);
      g.quadraticCurveTo(A[0] + dx * k / 2 + bx, A[1] + dy * k / 2 + by, A[0] + dx * (k + o * k) + rnd(q + 4) * amp, A[1] + dy * (k + o * k) + rnd(q + 5) * amp);
      g.stroke();
    }
  };
  Room.prototype.poly = function (pts) {
    var g = this.g, self = this; g.beginPath();
    pts.forEach(function (a, i) { var q = self.p(a); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
    g.closePath();
  };
  Room.prototype.render = function (o) {
    o = o || {};
    var g = this.g, self = this, st = getComputedStyle(this.c), ink = st.color, lightC = st.getPropertyValue('--beam').trim() || '#FFB02E';
    var v = vec(this.cfg, this.day, this.hour), W = ROOM.w, D = ROOM.d, H = ROOM.h;
    g.clearRect(0, 0, this.W, this.H); g.lineCap = 'round'; g.lineJoin = 'round';
    /* faint ground shade */
    g.fillStyle = ink; g.globalAlpha = .05; this.poly([[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]]); g.fill();
    g.globalAlpha = .03; this.poly([[0, 0, 0], [0, D, 0], [0, D, H], [0, 0, H]]); g.fill();
    g.globalAlpha = 1;
    var any = false, strength = Math.min(1, Math.max(.25, v.alt / 35)) * this.draw_;
    this.wins.forEach(function (w) {
      if (!lit(v, w.wall)) return;
      var faces = [
        { f: function (P) { var t = P[2] / v.z; return [P[0] - v.x * t, P[1] - v.y * t]; }, U: W, V: D, b: function (q) { return [q[0], q[1], 0]; } }
      ];
      if (w.wall !== 'a' && v.x > .02) faces.push({ f: function (P) { var t = P[0] / v.x; return [P[1] - v.y * t, P[2] - v.z * t]; }, U: D, V: H, b: function (q) { return [0, q[0], q[1]]; } });
      if (w.wall !== 'b' && v.y > .02) faces.push({ f: function (P) { var t = P[1] / v.y; return [P[0] - v.x * t, P[2] - v.z * t]; }, U: W, V: H, b: function (q) { return [q[0], 0, q[1]]; } });
      faces.forEach(function (F) {
        var q = clip(w.pts.map(F.f), F.U, F.V); if (!q) return; any = true;
        var pts = q.map(F.b), c0 = self.p(w.pts[0]), c1 = self.p(pts[0]);
        /* the beam in the air */
        var gr = g.createLinearGradient(c0[0], c0[1], c1[0], c1[1]);
        gr.addColorStop(0, lightC); gr.addColorStop(1, lightC);
        g.fillStyle = gr; g.globalAlpha = .10 * strength;
        for (var i = 0; i < w.pts.length; i++) {
          var a = w.pts[i], b = w.pts[(i + 1) % 4], m = pts[i % pts.length], n = pts[(i + 1) % pts.length];
          self.poly([a, b, n, m]); g.fill();
        }
        /* the patch it leaves */
        g.globalAlpha = .88 * strength; g.fillStyle = lightC; self.poly(pts); g.fill();
        g.globalAlpha = 1;
      });
      g.globalAlpha = .55 * strength; g.fillStyle = lightC; self.poly(w.pts); g.fill(); g.globalAlpha = 1;
    });
    /* construction lines */
    g.strokeStyle = ink; g.lineWidth = 1;
    var L = [[[0, 0, 0], [W, 0, 0]], [[0, 0, 0], [0, D, 0]], [[W, 0, 0], [W, D, 0]], [[0, D, 0], [W, D, 0]], [[0, 0, 0], [0, 0, H]], [[W, 0, 0], [W, 0, H]], [[0, D, 0], [0, D, H]], [[0, 0, H], [W, 0, H]], [[0, 0, H], [0, D, H]]];
    L.forEach(function (l, i) { self.line(l[0], l[1], i); });
    this.wins.forEach(function (w, j) {
      for (var i = 0; i < 4; i++) self.line(w.pts[i], w.pts[(i + 1) % 4], 40 + j * 9 + i, 1);
      var mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
      g.lineWidth = .7; self.line(mid(w.pts[0], w.pts[1]), mid(w.pts[2], w.pts[3]), 45 + j * 9, .7); g.lineWidth = 1;
    });
    /* a table and a bench for scale */
    var box = function (x, y, w, d, z, id) {
      var T = [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]];
      g.lineWidth = .8;
      T.forEach(function (a, i) { self.line(a, T[(i + 1) % 4], id + i, .9); self.line(a, [a[0], a[1], 0], id + 5 + i, .9); });
      g.lineWidth = 1;
    };
    box(3.6, 2.6, 1.9, .95, .74, 200); box(3.8, 3.95, 1.5, .4, .44, 220);
    /* north arrow on the floor plane */
    if (o.north !== false) {
      var an = -this.cfg.facing * R, nx = -Math.cos(an), ny = -Math.sin(an);
      var dx = (nx - ny) * .866, dy = (nx + ny) * .5, m = Math.hypot(dx, dy), X = this.W - 44, Y = this.H - 44;
      dx /= m; dy /= m; g.lineWidth = 1; g.beginPath(); g.moveTo(X - dx * 18, Y - dy * 18); g.lineTo(X + dx * 18, Y + dy * 18);
      g.moveTo(X + dx * 18 - dx * 7 - dy * 4, Y + dy * 18 - dy * 7 + dx * 4); g.lineTo(X + dx * 18, Y + dy * 18); g.lineTo(X + dx * 18 - dx * 7 + dy * 4, Y + dy * 18 - dy * 7 - dx * 4); g.stroke();
      g.fillStyle = ink; g.font = '500 13px "Host Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', X + dx * 31, Y + dy * 31);
    }
    return { v: v, any: any };
  };

  /* Sky dome with three sun paths, drawn progressively (k 0..1) */
  function SunPath(canvas, lat) { this.c = canvas; this.g = canvas.getContext('2d'); this.lat = lat; this.seed = 1; this.resize(); }
  SunPath.prototype.resize = function () {
    var r = this.c.getBoundingClientRect(), dpr = Math.min(2, root.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height; this.c.width = r.width * dpr; this.c.height = r.height * dpr;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.Rr = Math.min(this.W * .4, this.H * .66); this.cx = this.W / 2; this.cy = this.H * .8;
  };
  SunPath.prototype.pt = function (alt, az) { /* view from the south, tilted */
    var e = alt * R, a = az * R, x = Math.sin(a) * Math.cos(e), n = Math.cos(a) * Math.cos(e), z = Math.sin(e);
    return [this.cx - x * this.Rr, this.cy + n * this.Rr * .3 - z * this.Rr * .94];
  };
  SunPath.prototype.render = function (k) {
    var g = this.g, self = this, st = getComputedStyle(this.c), ink = st.color, beam = st.getPropertyValue('--beam').trim() || '#FF5B1F';
    g.clearRect(0, 0, this.W, this.H); g.strokeStyle = ink; g.lineWidth = 1; g.lineCap = 'round';
    function wob(i) { return rnd(i + self.seed * 11) * 1.4; }
    /* horizon */
    [0, 1].forEach(function (n) {
      g.beginPath();
      for (var a = 0; a <= 360 * Math.min(1, k * 2.4); a += 4) { var q = self.pt(0, 90 + a); g[a ? 'lineTo' : 'moveTo'](q[0] + wob(a + n * 400), q[1] + wob(a + 1 + n * 400)); }
      g.stroke();
    });
    /* altitude rings */
    g.globalAlpha = .22;
    [30, 60].forEach(function (al) {
      g.beginPath(); for (var a = 0; a <= 360 * Math.min(1, k * 2); a += 4) { var q = self.pt(al, 90 + a); g[a ? 'lineTo' : 'moveTo'](q[0], q[1]); } g.stroke();
    });
    g.globalAlpha = 1;
    g.fillStyle = ink; g.font = '500 13px "Host Grotesk", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var lab = [['E', 90], ['S', 180], ['W', 270], ['N', 0]];
    if (k > .15) lab.forEach(function (l) { var q = self.pt(0, l[1]); var dx = q[0] - self.cx, dy = q[1] - self.cy, m = Math.hypot(dx, dy) || 1; g.fillText(l[0], q[0] + dx / m * 18, q[1] + dy / m * 18); });
    [['June', DAYS.jun, 0], ['September', DAYS.sep, .18], ['December', DAYS.dec, .36]].forEach(function (s, j) {
      var kk = Math.max(0, Math.min(1, (k - s[2]) / .55)); if (!kk) return;
      var pts = [], h; for (h = 3; h <= 21; h += .1) { var u = sun(self.lat, s[1], h); if (u.alt > 0) pts.push([h, self.pt(u.alt, u.az), u]); }
      var n = Math.max(2, Math.floor(pts.length * kk));
      for (var r = 0; r < 2; r++) {
        g.beginPath(); for (var i = 0; i < n; i++) { var q = pts[i][1]; g[i ? 'lineTo' : 'moveTo'](q[0] + (i % 6 ? 0 : wob(i + j * 90 + r * 50)), q[1]); } g.stroke();
      }
      for (i = 0; i < n; i++) { var hr = pts[i][0]; if (Math.abs(hr - Math.round(hr)) < .04) { g.beginPath(); g.arc(pts[i][1][0], pts[i][1][1], 2.4, 0, 7); g.fill(); } }
      var last = pts[n - 1][1];
      g.fillStyle = beam; g.beginPath(); g.arc(last[0], last[1], kk < 1 ? 15 : 9, 0, 7); g.fill(); g.fillStyle = ink;
      if (kk > .5) { var top = pts[Math.floor(pts.length / 2)][1]; g.fillText(s[0], top[0], top[1] + (j ? 17 : -15)); }
    });
  };

  root.Poente = { sun: sun, vec: vec, sunHours: sunHours, Room: Room, SunPath: SunPath, DAYS: DAYS };
})(typeof window !== 'undefined' ? window : globalThis);
