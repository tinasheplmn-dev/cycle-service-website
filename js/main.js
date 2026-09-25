/* Cycle Service: site-eigen gedrag bovenop motion.js.
   - live openstatus-chip (fail-open: zonder script staat de vaste regel)
   - eerstvolgende vrije plek in de hero-kaart (uit de echte agenda)
   - jaartal in de footer */
(function () {
  'use strict';

  /* openingstijden: [open, dicht] in minuten, per weekdag (0 = zondag) */
  var TIJDEN = { 2: [450, 1050], 3: [450, 1050], 5: [450, 1200], 6: [540, 780] };
  var OPAFSPRAAK = { 1: true, 4: true };
  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var tijd = function (m) { return Math.floor(m / 60) + '.' + String(m % 60).padStart(2, '0'); };
  var iso24 = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  function openstatus() {
    var chip = document.querySelector('[data-openstatus]');
    var tekst = document.querySelector('[data-openstatus-tekst]');
    if (!chip || !tekst) return;
    var nu = new Date();
    var dag = nu.getDay();
    var min = nu.getHours() * 60 + nu.getMinutes();
    var stip = chip.querySelector('.stip');
    var vandaag = TIJDEN[dag];
    if (vandaag && min >= vandaag[0] && min < vandaag[1]) {
      tekst.textContent = 'Nu open, tot ' + tijd(vandaag[1]) + ' uur';
      return;
    }
    if (vandaag && min < vandaag[0]) {
      tekst.textContent = 'Vandaag open vanaf ' + tijd(vandaag[0]) + ' uur';
      if (stip) stip.classList.add('dicht');
      return;
    }
    for (var i = 1; i <= 7; i++) {
      var d = (dag + i) % 7;
      if (TIJDEN[d]) {
        tekst.textContent = (i === 1 ? 'Morgen' : DAGEN[d].charAt(0).toUpperCase() + DAGEN[d].slice(1)) + ' weer open vanaf ' + tijd(TIJDEN[d][0]) + ' uur' ;
        if (stip) stip.classList.add('dicht');
        return;
      }
    }
  }

  /* eerstvolgende vrije plek: vraag 21 dagen op en zoek het eerste blok van 75 minuten */
  function volgendeSlot() {
    var el = document.querySelector('[data-volgende-slot]');
    if (!el || typeof fetch !== 'function') return;
    var van = new Date(); var tot = new Date(); tot.setDate(tot.getDate() + 21);
    var iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    fetch('/api/agenda?van=' + iso(van) + '&tot=' + iso(tot)).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) return;
      var a = j.agenda;
      var toMin = function (t) { var p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]); };
      var start = toMin(a.start), eind = toMin(a.eind);
      var nu = Date.now();
      for (var i = 0; i < j.dagen.length; i++) {
        var dag = j.dagen[i];
        if (!dag.werkdag || dag.gesloten) continue;
        for (var t = start; t + 75 <= eind; t += a.stap) {
          var ms = new Date(dag.datum + 'T' + iso24(t) + ':00').getTime();
          if (ms - nu < a.minUrenVooraf * 3600000) continue;
          var vrij = dag.bezet.every(function (b) { return t >= b.tot || t + 75 <= b.van; });
          if (vrij) {
            var d = new Date(dag.datum + 'T00:00:00');
            el.textContent = DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + d.toLocaleDateString('nl-NL', { month: 'long' }) + ' · ' + tijd(t) + ' uur';
            el.style.textTransform = 'none';
            return;
          }
        }
      }
      el.textContent = 'Bekijk de agenda';
    }).catch(function () {});
  }

  document.querySelectorAll('[data-jaar]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  openstatus();
  volgendeSlot();
})();

/* contactformulier: stuurt naar /api/aanvraag, valt terug op WhatsApp */
(function () {
  'use strict';
  var form = document.querySelector('[data-contactform]');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fouten = 0;
    form.querySelectorAll('[required]').forEach(function (veld) {
      var wrap = veld.closest('.veld'); var ok = veld.value.trim().length > 1;
      wrap.classList.toggle('mis', !ok); var f = wrap.querySelector('.fout'); if (f) f.hidden = ok; if (!ok) fouten++;
    });
    if (fouten) return;
    var data = {}; new FormData(form).forEach(function (v, k) { data[k] = v; });
    var knop = form.querySelector('button[type="submit"]'); knop.disabled = true;
    fetch('/api/aanvraag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.fout);
        form.querySelector('[data-contact-ok]').hidden = false;
        form.querySelectorAll('input, textarea').forEach(function (v) { v.value = ''; });
        knop.disabled = false;
      })
      .catch(function () {
        knop.disabled = false;
        var tekst = 'Hoi Jay, ' + (data.bericht || '') + ' (' + data.naam + ', ' + data.telefoon + ')';
        window.open('https://wa.me/31628828966?text=' + encodeURIComponent(tekst), '_blank', 'noopener');
      });
  });
  /* vandaag markeren in de openingstijdentabel */
  var rij = document.querySelector('[data-tijden-tabel] [data-dag="' + new Date().getDay() + '"]');
  if (rij) rij.classList.add('vandaag');
})();
