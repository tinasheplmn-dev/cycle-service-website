/* Afrekenen Cycle Service, powered by Mettafel.
   Stappen: overzicht controleren, gegevens, levering, betalen.
   De server berekent prijzen opnieuw; deze pagina toont alleen.
   Zonder backend (bijvoorbeeld op een statische preview) gaat de bestelling als WhatsApp-bericht naar Jay. */
(function () {
  'use strict';
  var wortel = document.querySelector('[data-afrekenen]');
  if (!wortel || !window.CSMand) return;
  var $ = function (s) { return wortel.querySelector(s); };
  var euro = function (n) { return '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var tekst = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var catalogus = (function () { var el = document.getElementById('catalogus'); try { return JSON.parse(el.textContent); } catch (e) { return { producten: [] }; } })();
  var winkel = { betaalprovider: 'geen', verzenden: { actief: false, kosten: null, gratisVanaf: null }, online: false };
  var form = $('[data-checkout]'), melding = $('[data-melding]');

  function toon(t) { melding.textContent = t; melding.hidden = !t; if (t) melding.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  /* de mand bijwerken met de actuele catalogus: prijs en voorraad komen altijd van de winkel */
  function actueleMand() {
    var weg = [];
    var m = CSMand.lees().map(function (r) {
      var p = catalogus.producten.find(function (x) { return x.id === r.id; });
      var keuzes = r.keuzes || [];
      var opties = p && p.opties || [];
      var geldig = p && p.voorraad && keuzes.length === opties.length && opties.every(function (o, i) { return o.waarden.indexOf(keuzes[i]) !== -1; });
      if (!geldig) { weg.push(r.merk + ' ' + r.naam + (r.maat ? ' (' + r.maat + ')' : '')); return null; }
      return { id: p.id, keuzes: keuzes, aantal: r.aantal, merk: p.merk, naam: p.naam, maat: CSMand.uitvoering(p, keuzes), prijs: p.prijs, foto: p.foto, categorie: p.categorie, verzendbaar: p.levering === 'verzenden' };
    }).filter(Boolean);
    if (weg.length) { CSMand.bewaar(m); toon('Niet meer beschikbaar en uit je winkelwagen gehaald: ' + weg.join(', ') + '.'); }
    return m;
  }

  function levering() { var r = form.querySelector('input[name="levering"]:checked'); return r ? r.value : 'afhalen'; }

  var afgerond = false;              /* na de bevestiging tekent een lege mand de pagina niet meer om */
  function tekenOverzicht() {
    if (afgerond) return [];
    var m = actueleMand();
    var lijst = $('[data-overzicht]');
    if (!m.length) {
      $('[data-checkout-stappen]').hidden = true;
      $('[data-leeg]').hidden = false;
      return m;
    }
    $('[data-checkout-stappen]').hidden = false;
    $('[data-leeg]').hidden = true;
    lijst.innerHTML = m.map(function (r) {
      return '<li><img src="' + tekst(String(r.foto || '').indexOf('/') > -1 ? r.foto : 'assets/img/' + r.foto) + '" alt="" width="72" height="54"><div><strong>' + tekst(r.merk) + ' ' + tekst(r.naam) + '</strong><small>' + (r.maat ? tekst(r.maat) + ' · ' : '') + r.aantal + '×</small></div><span>' + euro(r.prijs * r.aantal) + '</span></li>';
    }).join('');
    var sub = m.reduce(function (s, r) { return s + r.prijs * r.aantal; }, 0);

    /* verzenden alleen als het aanstaat, alles verzendbaar is (fietsen worden afgehaald) en er een prijs is:
       gratis vanaf het drempelbedrag, daaronder alleen als Jay een vast bedrag heeft ingesteld */
    var v = winkel.verzenden, gratis = v.gratisVanaf != null && sub >= v.gratisVanaf;
    var kanVerzenden = v.actief && m.every(function (r) { return r.verzendbaar; }) && (gratis || v.kosten != null);
    var optie = $('[data-optie-verzenden]');
    optie.hidden = !kanVerzenden;
    if (!kanVerzenden && levering() === 'verzenden') form.querySelector('input[value="afhalen"]').checked = true;
    var kosten = gratis ? 0 : Number(v.kosten || 0);
    var prijsLabel = optie.querySelector('[data-verzendprijs]');
    if (prijsLabel) prijsLabel.textContent = kosten ? euro(kosten) : 'Gratis';
    var verzend = levering() === 'verzenden' ? kosten : 0;
    $('[data-subtotaal]').textContent = euro(sub);
    $('[data-verzend]').textContent = verzend ? euro(verzend) : 'Gratis';
    $('[data-totaal]').textContent = euro(sub + verzend);
    $('[data-adres]').hidden = levering() !== 'verzenden';
    return m;
  }

  function tekenBetalen() {
    var online = winkel.online && winkel.betaalprovider === 'mollie';
    $('[data-betaal-online]').hidden = !online;
    $('[data-betaal-later]').hidden = online;
    $('[data-verstuur-label]').textContent = online ? 'Bestellen en betalen' : 'Bestelling plaatsen';
  }

  /* ---------- terugkeer van de betaalprovider ---------- */
  var q = new URLSearchParams(location.search);
  if (q.get('bestelling') && q.get('t')) {
    $('[data-checkout-stappen]').hidden = true;
    var st = $('[data-status]'); st.hidden = false;
    var poging = 0;
    (function kijk() {
      fetch('/api/bestelling/' + encodeURIComponent(q.get('bestelling')) + '?t=' + encodeURIComponent(q.get('t'))).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.fout);
        var b = j.bestelling;
        if (b.status === 'betaald' || (b.betaling && b.betaling.status === 'paid')) { bevestig(b, true); CSMand.leeg(); return; }
        if (b.betaling && ['canceled', 'expired', 'failed'].indexOf(b.betaling.status) !== -1) {
          st.innerHTML = '<h2>De betaling is niet gelukt</h2><p class="lead">Je bestelling ' + tekst(b.id) + ' staat nog open. Probeer het opnieuw, of bel 06 28828966.</p><button type="button" class="knop knop-vol" data-opnieuw>Opnieuw betalen</button>';
          st.querySelector('[data-opnieuw]').addEventListener('click', function () {
            fetch('/api/bestelling/' + encodeURIComponent(b.id) + '/betaal?t=' + encodeURIComponent(q.get('t')), { method: 'POST' }).then(function (r) { return r.json(); }).then(function (k) { if (k.checkoutUrl) location.href = k.checkoutUrl; else st.insertAdjacentHTML('beforeend', '<p class="melding">' + tekst(k.fout) + '</p>'); });
          });
          return;
        }
        if (poging++ < 10) setTimeout(kijk, 1500);
        else st.innerHTML = '<h2>We wachten nog op je bank</h2><p class="lead">Zodra de betaling binnen is, krijg je een bevestiging per e-mail. Vragen? Bel 06 28828966.</p>';
      }).catch(function () { st.innerHTML = '<h2>Bestelling niet gevonden</h2><p class="lead">Bel of app 06 28828966, dan zoekt Jay het voor je uit.</p>'; });
    })();
    return;
  }

  /* ---------- bevestiging ---------- */
  function bevestig(b, betaald) {
    afgerond = true;
    $('[data-checkout-stappen]').hidden = true;
    $('[data-leeg]').hidden = true;
    $('[data-status]').hidden = true;
    var bev = $('[data-bevestiging]'); bev.hidden = false;
    bev.querySelector('[data-b-nummer]').textContent = b.id;
    bev.querySelector('[data-b-totaal]').textContent = euro(b.totaal);
    bev.querySelector('[data-b-regels]').innerHTML = b.regels.map(function (r) { return '<li>' + r.aantal + '× ' + tekst(r.naam) + (r.maat ? ' (' + tekst(r.maat) + ')' : '') + '</li>'; }).join('');
    var verzenden = b.levering === 'verzenden';
    bev.querySelector('[data-b-volgende]').textContent = betaald
      ? (verzenden ? 'Je betaling is binnen. Jay verstuurt je bestelling; je hebt hem binnen 1 tot 4 werkdagen in huis.' : 'Je betaling is binnen. Jay mailt je zodra je bestelling klaarstaat.')
      : verzenden
        ? 'Jay neemt binnen één werkdag contact met je op en stuurt je een betaalverzoek. Na betaling verstuurt hij je bestelling; je hebt hem binnen 1 tot 4 werkdagen in huis.'
        : 'Jay neemt binnen één werkdag contact met je op om de bestelling te bevestigen. Je betaalt bij het ophalen in de winkel, of via een betaalverzoek.';
    bev.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- versturen ---------- */
  form.addEventListener('change', function (e) { if (e.target.name === 'levering') tekenOverzicht(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); toon('');
    var fouten = 0;
    form.querySelectorAll('[required]').forEach(function (veld) {
      if (veld.closest('[hidden]')) return;
      var wrap = veld.closest('.veld') || veld.closest('.vink');
      var ok = veld.type === 'checkbox' ? veld.checked : veld.value.trim().length > 1 && (veld.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(veld.value));
      if (wrap) { wrap.classList.toggle('mis', !ok); var f = wrap.querySelector('.fout'); if (f) f.hidden = ok; }
      if (!ok) fouten++;
    });
    if (fouten) { var eerste = form.querySelector('.mis input'); if (eerste) eerste.focus(); return; }
    var m = actueleMand();
    if (!m.length) { tekenOverzicht(); return; }
    var data = { regels: m.map(function (r) { return { id: r.id, keuzes: r.keuzes, aantal: r.aantal }; }), levering: levering(), akkoord: true };
    ['naam', 'email', 'telefoon', 'straat', 'postcode', 'plaats', 'opmerking'].forEach(function (k) { var v = form.elements[k]; if (v) data[k] = v.value; });

    if (!winkel.online) {             /* geen backend: de bestelling gaat als bericht naar Jay */
      var bericht = 'Hoi Jay, ik wil graag bestellen:\n' + m.map(function (r) { return '- ' + r.aantal + 'x ' + r.merk + ' ' + r.naam + (r.maat ? ' (' + r.maat + ')' : '') + ', ' + euro(r.prijs * r.aantal); }).join('\n') + '\n' + (data.levering === 'verzenden' ? 'Graag verzenden naar ' + data.straat + ', ' + data.postcode + ' ' + data.plaats + '.' : 'Ik haal het op in de winkel.') + (data.opmerking ? '\nOpmerking: ' + data.opmerking : '') + '\n' + data.naam + ', ' + data.telefoon + ', ' + data.email;
      window.open('https://wa.me/31628828966?text=' + encodeURIComponent(bericht), '_blank', 'noopener');
      return;
    }
    var knop = form.querySelector('button[type="submit"]'); knop.disabled = true; knop.classList.add('bezig');
    fetch('/api/bestelling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) {
          toon(j.fout || 'Er ging iets mis. Probeer het opnieuw of bel 06 28828966.');
          if (j.veld && form.elements[j.veld]) form.elements[j.veld].focus();
          knop.disabled = false; knop.classList.remove('bezig'); return;
        }
        if (j.checkoutUrl) { location.href = j.checkoutUrl; return; }
        bevestig({ id: j.id, totaal: j.totaal, levering: data.levering, regels: m.map(function (r) { return { aantal: r.aantal, naam: r.merk + ' ' + r.naam, maat: r.maat }; }) }, false);
        CSMand.leeg();
      })
      .catch(function () { toon('De verbinding viel weg. Probeer het nog eens of bel 06 28828966.'); knop.disabled = false; knop.classList.remove('bezig'); });
  });

  /* ---------- start ---------- */
  fetch('/api/winkel').then(function (r) { return r.json(); }).then(function (j) {
    if (j.ok) { winkel.betaalprovider = j.betaalprovider; winkel.verzenden = j.verzenden; winkel.online = true; }
  }).catch(function () {}).then(function () {
    tekenOverzicht(); tekenBetalen();
    if (!winkel.online) $('[data-statisch]').hidden = false;
  });
  document.addEventListener('mand-gewijzigd', tekenOverzicht);
})();
