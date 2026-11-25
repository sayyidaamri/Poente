/* Legal: highlight the section being read */
window.PoentePage = function (P) {
  var a = [].slice.call(document.querySelectorAll('.lg nav a')), s = a.map(function (x) { return document.querySelector(x.getAttribute('href')); });
  P.onFrame(function () { var k = 0; s.forEach(function (e, i) { if (e.getBoundingClientRect().top < innerHeight * .4) k = i; }); a.forEach(function (x, i) { x.classList.toggle('on', i === k); }); });
};
