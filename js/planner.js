/* Onderhoudsplanner Cycle Service, powered by Mettafel.
   Stappen: beurt kiezen, dag kiezen (maandkalender uit de echte agenda), tijd kiezen, gegevens, bevestiging.
   Fail-open: zonder script staat er een formulier dat als WhatsApp-bericht werkt (zie planner.html). */
(function () {
  'use strict';
  var wortel = document.querySelector('[data-planner]');
  if (!wortel || typeof fetch !== 'function') return;
  wortel.classList.add('actief');

  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var toMin = function (t) { var p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  var iso24 = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  var mooi = function (m) { return Math.floor(m / 60) + '.' + String(m % 60).padStart(2, '0'); };
  var isoDag = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  var $ = function (s, r) { return (r || wortel).querySelector(s); };

  var staat = { beurt: null, datum: null, tijd: null, agenda: null, beurten: null, dagen: {}, maand: new Date() };
  staat.maand.setDate(1);

  var elBeurt = $('[data-beurt-keuze]');
  var elKalender = $('[data-kalender]');
  var elTijden = $('[data-tijden]');
  var elStap3 = $('[data-stap-tijd]');
  var elStap4 = $('[data-stap-gegevens]');
  var elSamen = $('[data-samenvatting]');
  var form = $('form[data-boekform]');
  var melding = $('[data-melding]');

  /* ---------- stap 1: beurt ---------- */
  var vooraf = new URLSearchParams(location.search).get('beurt');
  elBeurt.addEventListener('change', function (e) {
    if (e.target.name !== 'beurt') return;
    staat.beurt = e.target.value; staat.tijd = null;
    laadMaand().then(function () { tekenKalender(); if (staat.datum) tekenTijden(); bijwerken(); });
  });
  if (vooraf && elBeurt.querySelector('input[value="' + vooraf + '"]')) {
    elBeurt.querySelector('input[value="' + vooraf + '"]').checked = true;
    staat.beurt = vooraf;
  } else {
    var eerste = elBeurt.querySelector('input[name="beurt"]:checked');
    if (eerste) staat.beurt = eerste.value;
  }

  /* ---------- agenda ophalen per maand ---------- */
  function laadMaand() {
    var m = staat.maand;
    var van = new Date(m.getFullYear(), m.getMonth(), 1);
    var tot = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    return fetch('/api/agenda?van=' + isoDag(van) + '&tot=' + isoDag(tot)).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.fout || 'Agenda niet beschikbaar');
      staat.agenda = j.agenda; staat.beurten = j.beurten;
      j.dagen.forEach(function (d) { staat.dagen[d.datum] = d; });
    }).catch(function () {
      toon('De agenda is even niet bereikbaar. Bel of app ons, dan plannen we het samen in.');
    });
  }

  /* welke starttijden passen op een dag voor de gekozen beurt */
  function vrijeTijden(dag) {
    if (!dag || !dag.werkdag || !staat.beurt || !staat.agenda) return [];
    var a = staat.agenda, duur = staat.beurten[staat.beurt].duur;
    var start = toMin(a.start), eind = toMin(a.eind), nu = Date.now(), uit = [];
    for (var t = start; t + duur <= eind; t += a.stap) {
      var ms = new Date(dag.datum + 'T' + iso24(t) + ':00').getTime();
      if (ms - nu < a.minUrenVooraf * 3600000) continue;
      if (ms - nu > a.vooruit * 86400000) continue;
      var past = dag.bezet.every(function (b) { return t >= b.tot || t + duur <= b.van; });
      if (past) uit.push(t);
    }
    return uit;
  }

  /* ---------- stap 2: kalender ---------- */
  function tekenKalender() {
    var m = staat.maand, jaar = m.getFullYear(), maand = m.getMonth();
    var vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
    var eersteDag = new Date(jaar, maand, 1);
    var offset = (eersteDag.getDay() + 6) % 7; /* maandag eerst */
    var aantal = new Date(jaar, maand + 1, 0).getDate();
    var html = '<div class="maandkop"><button type="button" data-vorige aria-label="Vorige maand"' + (maand === vandaag.getMonth() && jaar === vandaag.getFullYear() ? ' disabled' : '') + '><svg class="ico" style="rotate:180deg"><use href="assets/iconen.svg#i-pijl"/></svg></button><h3>' + MAANDEN[maand] + ' ' + jaar + '</h3><button type="button" data-volgende aria-label="Volgende maand"><svg class="ico"><use href="assets/iconen.svg#i-pijl"/></svg></button></div>';
    html += '<div class="dagnamen"><span>ma</span><span>di</span><span>wo</span><span>do</span><span>vr</span><span>za</span><span>zo</span></div><div class="dagen">';
    for (var i = 0; i < offset; i++) html += '<span class="dag leeg"></span>';
    for (var d = 1; d <= aantal; d++) {
      var datum = isoDag(new Date(jaar, maand, d));
      var info = staat.dagen[datum];
      var klas = 'dag', label = '';
      if (new Date(jaar, maand, d) < vandaag || !info || !info.werkdag) { klas += ' dicht'; label = info && info.gesloten ? 'gesloten wegens vakantie' : 'werkplaats gesloten'; }
      else if (vrijeTijden(info).length) { klas += ' vrij'; label = 'vrije plekken'; }
      else { klas += ' vol'; label = 'vol'; }
      if (datum === staat.datum) klas += ' gekozen';
      html += '<button type="button" class="' + klas + '" data-datum="' + datum + '" aria-label="' + DAGEN[new Date(jaar, maand, d).getDay()] + ' ' + d + ' ' + MAANDEN[maand] + ', ' + label + '"' + (klas.indexOf('vrij') === -1 && klas.indexOf('gekozen') === -1 ? ' disabled' : '') + '>' + d + '</button>';
    }
    html += '</div><div class="legenda"><span><i style="background:var(--cta);box-shadow:0 0 0 1px var(--inkt)"></i> vrije plekken</span><span><i style="background:var(--papier-2);box-shadow:0 0 0 1px var(--lijn)"></i> vol</span><span><i style="background:transparent;box-shadow:0 0 0 1px var(--lijn)"></i> gesloten</span></div>';
    elKalender.innerHTML = html;
  }
  elKalender.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-vorige')) { staat.maand.setMonth(staat.maand.getMonth() - 1); laadMaand().then(tekenKalender); return; }
    if (b.hasAttribute('data-volgende')) { staat.maand.setMonth(staat.maand.getMonth() + 1); laadMaand().then(tekenKalender); return; }
    if (b.dataset.datum && !b.disabled) {
      staat.datum = b.dataset.datum; staat.tijd = null;
      tekenKalender(); tekenTijden(); bijwerken();
      elStap3.hidden = false;
      elStap3.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ---------- stap 3: tijd ---------- */
  function tekenTijden() {
    var tijden = vrijeTijden(staat.dagen[staat.datum]);
    if (!tijden.length) { elTijden.innerHTML = '<p class="geen">Op deze dag past deze beurt niet meer. Kies een andere dag.</p>'; return; }
    var duur = staat.beurten[staat.beurt].duur;
    elTijden.innerHTML = tijden.map(function (t) {
      return '<button type="button" data-tijd="' + iso24(t) + '" class="' + (iso24(t) === staat.tijd ? 'gekozen' : '') + '" aria-label="Brengen om ' + mooi(t) + ', klaar om ' + mooi(t + duur) + '">' + mooi(t) + '</button>';
    }).join('');
  }
  elTijden.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tijd]');
    if (!b) return;
    staat.tijd = b.dataset.tijd;
    tekenTijden(); bijwerken();
    elStap4.hidden = false;
    elStap4.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- samenvatting ---------- */
  function bijwerken() {
    var b = staat.beurt && staat.beurten ? staat.beurten[staat.beurt] : null;
    $('[data-s-beurt]', elSamen).textContent = b ? b.naam : 'Nog niet gekozen';
    $('[data-s-prijs]', elSamen).textContent = b ? '€ ' + b.prijs + ',- excl. materiaal' : '';
    $('[data-s-datum]', elSamen).textContent = staat.datum ? mooiDatum(staat.datum) : 'Kies een dag';
    $('[data-s-tijd]', elSamen).textContent = staat.tijd ? 'Brengen om ' + mooi(toMin(staat.tijd)) + ' uur' : 'Kies een tijd';
    var klaar = $('[data-s-klaar]', elSamen);
    if (b && staat.tijd) { klaar.textContent = mooi(toMin(staat.tijd) + b.duur) + ' uur'; klaar.parentElement.hidden = false; }
    else klaar.parentElement.hidden = true;
    var knop = $('[data-s-knop]', elSamen);
    knop.disabled = !(b && staat.datum && staat.tijd);
  }
  function mooiDatum(iso) { var d = new Date(iso + 'T00:00:00'); return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()]; }
  $('[data-s-knop]', elSamen).addEventListener('click', function () { elStap4.hidden = false; elStap4.scrollIntoView({ behavior: 'smooth' }); var n = form.querySelector('input[name="naam"]'); if (n) n.focus(); });

  /* ---------- stap 4: gegevens en versturen ---------- */
  function toon(tekst) { melding.textContent = tekst; melding.hidden = !tekst; if (tekst) melding.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    toon('');
    var fouten = 0;
    form.querySelectorAll('[required]').forEach(function (veld) {
      var wrap = veld.closest('.veld');
      var ok = veld.value.trim().length > 1 && (veld.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(veld.value));
      wrap.classList.toggle('mis', !ok);
      var f = wrap.querySelector('.fout'); if (f) f.hidden = ok;
      if (!ok) fouten++;
    });
    if (fouten) return;
    if (!(staat.beurt && staat.datum && staat.tijd)) { toon('Kies eerst een beurt, een dag en een tijd.'); return; }
    var data = { beurt: staat.beurt, datum: staat.datum, tijd: staat.tijd };
    new FormData(form).forEach(function (v, k) { if (k !== 'beurt') data[k] = v; });
    var knop = form.querySelector('button[type="submit"]');
    knop.disabled = true; knop.textContent = 'Even geduld...';
    fetch('/api/boeking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) { toon(j.fout || 'Er ging iets mis. Probeer het nog eens of bel ons.'); knop.disabled = false; knop.textContent = 'Bevestig je afspraak'; if (j.fout && /bezet/.test(j.fout)) { laadMaand().then(function () { tekenKalender(); tekenTijden(); }); } return; }
        toonBevestiging(j, data);
      })
      .catch(function () { toon('De verbinding viel weg. Probeer het nog eens of app ons.'); knop.disabled = false; knop.textContent = 'Bevestig je afspraak'; });
  });

  function toonBevestiging(j, data) {
    var b = staat.beurten[staat.beurt];
    var eind = iso24(toMin(staat.tijd) + b.duur);
    var bev = $('[data-bevestiging]');
    $('[data-b-nummer]', bev).textContent = j.id;
    $('[data-b-wanneer]', bev).textContent = mooiDatum(staat.datum) + ', brengen om ' + mooi(toMin(staat.tijd)) + ' uur';
    $('[data-b-beurt]', bev).textContent = b.naam + ' · € ' + b.prijs + ',- excl. materiaal';
    $('[data-b-klaar]', bev).textContent = 'Klaar om ' + mooi(toMin(staat.tijd) + b.duur) + ' uur';
    $('[data-b-mail]', bev).textContent = data.email;
    /* agenda-bestand */
    var stamp = function (iso, t) { return iso.replace(/-/g, '') + 'T' + t.replace(':', '') + '00'; };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cycle Service//Planner//NL', 'BEGIN:VEVENT', 'UID:' + j.id + '@cycle-service.nl',
      'DTSTART;TZID=Europe/Amsterdam:' + stamp(staat.datum, staat.tijd), 'DTEND;TZID=Europe/Amsterdam:' + stamp(staat.datum, eind),
      'SUMMARY:Fiets brengen bij Cycle Service (' + b.naam + ')', 'LOCATION:Handelsweg 11\\, 5492 NL Sint-Oedenrode',
      'DESCRIPTION:Afspraak ' + j.id + '. Klaar om ' + mooi(toMin(staat.tijd) + b.duur) + ' uur. Vragen: 06 28828966.', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = $('[data-b-ics]', bev);
    a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    a.download = 'cycle-service-' + staat.datum + '.ics';
    wortel.querySelector('[data-planner-stappen]').hidden = true;
    bev.hidden = false;
    bev.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- start ---------- */
  laadMaand().then(function () {
    tekenKalender(); bijwerken();
    /* kies automatisch de eerste vrije dag als er nog geen dag is */
    var eerste = elKalender.querySelector('.dag.vrij');
    if (eerste) { staat.datum = eerste.dataset.datum; tekenKalender(); tekenTijden(); bijwerken(); elStap3.hidden = false; }
  });
})();
