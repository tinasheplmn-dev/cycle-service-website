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

  document.querySelectorAll('[data-jaar]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  openstatus();
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

/* Google Maps pas laden na een klik: Google plaatst daarbij cookies */
(function () {
  'use strict';
  var vak = document.querySelector('[data-kaart]');
  if (!vak) return;
  var knop = vak.querySelector('[data-kaart-laden]');
  knop.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.title = 'Kaart met de locatie van Cycle Service, Handelsweg 11 Sint-Oedenrode';
    f.src = vak.dataset.kaart;
    f.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    f.setAttribute('allowfullscreen', '');
    vak.replaceWith(f);
    f.focus();
  });
})();
