/* Contact: pick a home and an hour; the page answers from the sun's position, then opens your mail app */
window.PoentePage = function (P) {
  var f = document.querySelector('.pick form'), sel = f.home, mon = f.month, hint = f.querySelector('.chips small'), err = f.querySelector('.err');
  var q = new URLSearchParams(location.search).get('home');
  if (q) for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === q) sel.selectedIndex = i;
  function upd() {
    var o = sel.options[sel.selectedIndex], h = f.hour.value; err.textContent = '';
    if (!o.value || !h) { hint.textContent = 'Choose a home and an hour and this line will tell you what the sun is doing.'; return; }
    var c = JSON.parse(o.dataset.cfg), v = P.vec(c, P.DAYS[mon.value], +h), on = v.alt > 1.5 && ((c.a && v.x < -.06) || (c.b && v.y < -.06) || (c.roof && v.z > .1));
    hint.textContent = v.alt < 0 ? 'The sun will be down. Good: you will hear the street.' : on ? 'At that hour the main room has direct sun, coming in at ' + Math.round(v.alt) + '°.' : 'At that hour the main room has daylight but no direct sun.';
  }
  f.addEventListener('change', upd); upd();
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!sel.value) { err.textContent = 'Choose a home first.'; sel.focus(); return; }
    if (!f.hour.value) { err.textContent = 'Choose an hour for the visit.'; f.hour[0].focus(); return; }
    var o = sel.options[sel.selectedIndex].text, hr = P.fmt(+f.hour.value), m = mon.options[mon.selectedIndex].text;
    location.href = 'mailto:' + f.dataset.to + '?subject=' + encodeURIComponent('Visit: ' + o + ', ' + hr) + '&body=' + encodeURIComponent('Hello Poente,\n\nI would like to see ' + o + ' at ' + hr + ' (' + m + ').\n\nName: ' + f.who.value + '\n');
  });
};
