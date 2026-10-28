/* Webshop Cycle Service: winkelwagen, mandpaneel en filters, powered by Mettafel.
   Fail-open: zonder JavaScript zijn alle producten zichtbaar en is elke winkelwagenknop
   een gewone WhatsApp-link. De mand leeft in localStorage op dit toestel. */
(function () {
  'use strict';
  var SLEUTEL = 'cs-mand-v1';
  var euro = function (n) { return '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var ico = function (naam) { return '<svg class="ico" aria-hidden="true"><use href="assets/iconen.svg#i-' + naam + '"/></svg>'; };
  var fotoUrl = function (f) { return !f ? '' : f.indexOf('/') > -1 ? f : 'assets/img/' + f; };
  var tekst = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- opslag ---------- */
  function leesMand() { try { var m = JSON.parse(localStorage.getItem(SLEUTEL) || '[]'); return Array.isArray(m) ? m : []; } catch (e) { return []; } }
  function bewaar(m) { try { localStorage.setItem(SLEUTEL, JSON.stringify(m)); } catch (e) {} teken(); document.dispatchEvent(new CustomEvent('mand-gewijzigd')); }
  var catalogus = (function () { var el = document.getElementById('catalogus'); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } })();
  function product(id) { return catalogus && catalogus.producten.find(function (p) { return p.id === id; }); }

  /* een variant is de lijst gekozen waarden, in de volgorde van p.opties; dezelfde regel staat in afrekenen.js en winkel.js op de server */
  function uitvoering(p, keuzes) {
    if (!p.opties || !p.opties.length) return p.maat || '';
    return (keuzes || []).map(function (k, i) { return p.opties[i] && p.opties[i].naam === 'Maat' ? 'maat ' + k : k; }).join(' · ');
  }
  function sleutel(r) { return r.id + '|' + (r.keuzes || []).join('|'); }

  function voegToe(info, keuzes) {
    var m = leesMand();
    var nieuw = { id: info.id, keuzes: keuzes || [] };
    var r = m.find(function (x) { return sleutel(x) === sleutel(nieuw); });
    var max = info.categorie === 'onderdelen' ? 10 : 1;
    if (r) r.aantal = Math.min(max, r.aantal + 1);
    else m.push({ id: info.id, keuzes: nieuw.keuzes, aantal: 1, merk: info.merk, naam: info.naam, maat: uitvoering(info, nieuw.keuzes), prijs: info.prijs, foto: info.foto || '', categorie: info.categorie });
    bewaar(m);
  }

  /* ---------- het paneel ---------- */
  var paneel;
  function bouwPaneel() {
    paneel = document.createElement('div');
    paneel.className = 'mand';
    paneel.hidden = true;
    paneel.innerHTML =
      '<div class="mand-scherm" data-mand-sluit></div>' +
      '<aside class="mand-paneel" role="dialog" aria-modal="true" aria-labelledby="mand-titel">' +
        '<header class="mand-kop"><h2 id="mand-titel">Je winkelwagen</h2><button type="button" class="mand-x" data-mand-sluit aria-label="Winkelwagen sluiten">' + ico('kruis') + '</button></header>' +
        '<div class="mand-regels" data-mand-regels></div>' +
        '<footer class="mand-voet" data-mand-voet>' +
          '<div class="mand-totaal"><span>Subtotaal</span><strong data-mand-totaal></strong></div>' +
          '<p class="mand-noot">Fietsen haal je rijklaar afgesteld op in de winkel aan de Handelsweg 11.</p>' +
          '<a class="knop knop-vol" href="afrekenen.html">Afrekenen ' + ico('pijl') + '</a>' +
          '<button type="button" class="knop knop-lijn" data-mand-sluit>Verder winkelen</button>' +
          '<p class="powered">Webshop powered by Mettafel</p>' +
        '</footer>' +
      '</aside>';
    document.body.appendChild(paneel);
    paneel.addEventListener('click', function (e) {
      if (e.target.closest('[data-mand-sluit]')) { sluit(); return; }
      var knop = e.target.closest('[data-regel]');
      if (!knop) return;
      var m = leesMand(), id = knop.dataset.regel, r = m.find(function (x) { return sleutel(x) === id; });
      if (!r) return;
      var max = r.categorie === 'onderdelen' ? 10 : 1;
      if (knop.dataset.actie === 'plus') r.aantal = Math.min(max, r.aantal + 1);
      if (knop.dataset.actie === 'min') r.aantal = Math.max(1, r.aantal - 1);
      if (knop.dataset.actie === 'weg') m = m.filter(function (x) { return sleutel(x) !== id; });
      bewaar(m);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !paneel.hidden) sluit(); });
  }
  var vorigeFocus = null;
  function open() {
    if (!paneel) bouwPaneel();
    teken();
    vorigeFocus = document.activeElement;
    paneel.hidden = false;
    document.body.classList.add('mand-open');
    requestAnimationFrame(function () { paneel.classList.add('open'); var x = paneel.querySelector('.mand-x'); if (x) x.focus(); });
  }
  function sluit() {
    paneel.classList.remove('open');
    document.body.classList.remove('mand-open');
    setTimeout(function () { paneel.hidden = true; }, 280);
    if (vorigeFocus && vorigeFocus.focus) vorigeFocus.focus();
  }

  function teken() {
    var m = leesMand();
    var aantal = m.reduce(function (s, r) { return s + r.aantal; }, 0);
    document.querySelectorAll('[data-mand-teller]').forEach(function (el) { el.textContent = aantal; el.hidden = !aantal; });
    document.querySelectorAll('[data-mand-open]').forEach(function (el) { el.setAttribute('aria-label', aantal ? 'Winkelwagen, ' + aantal + (aantal === 1 ? ' product' : ' producten') : 'Winkelwagen, leeg'); });
    if (!paneel) return;
    var regels = paneel.querySelector('[data-mand-regels]'), voet = paneel.querySelector('[data-mand-voet]');
    if (!m.length) {
      regels.innerHTML = '<div class="mand-leeg">' + ico('tas') + '<p>Je winkelwagen is nog leeg.</p><a class="knop knop-navy" href="fietsen.html">Bekijk fietsen en onderdelen</a></div>';
      voet.hidden = true; return;
    }
    voet.hidden = false;
    regels.innerHTML = m.map(function (r) {
      var max = r.categorie === 'onderdelen' ? 10 : 1, k = tekst(sleutel(r));
      return '<div class="mand-regel">' +
        (r.foto ? '<img src="' + tekst(fotoUrl(r.foto)) + '" alt="" width="96" height="72">' : '<span class="mand-foto-leeg">' + ico('fiets') + '</span>') +
        '<div class="mand-info"><strong>' + tekst(r.merk) + ' ' + tekst(r.naam) + '</strong>' + (r.maat ? '<small>' + tekst(r.maat) + '</small>' : '') +
          '<div class="mand-aantal">' +
            (max > 1 ? '<button type="button" data-regel="' + k + '" data-actie="min" aria-label="Eén minder">−</button><output>' + r.aantal + '</output><button type="button" data-regel="' + k + '" data-actie="plus" aria-label="Eén meer">+</button>' : '<small>1 stuk</small>') +
            '<button type="button" class="mand-weg" data-regel="' + k + '" data-actie="weg" aria-label="Verwijder ' + tekst(r.merk + ' ' + r.naam) + '">' + ico('prullenbak') + '</button>' +
          '</div></div>' +
        '<span class="mand-prijs">' + euro(r.prijs * r.aantal) + '</span></div>';
    }).join('');
    paneel.querySelector('[data-mand-totaal]').textContent = euro(m.reduce(function (s, r) { return s + r.prijs * r.aantal; }, 0));
  }

  /* ---------- knoppen ---------- */
  document.addEventListener('click', function (e) {
    var openKnop = e.target.closest('[data-mand-open]');
    if (openKnop) { e.preventDefault(); open(); return; }
    var knop = e.target.closest('[data-in-mand]');
    if (!knop) return;
    var info = product(knop.dataset.inMand);
    if (!info) return;                       /* geen catalogus op deze pagina: de WhatsApp-link doet zijn werk */
    e.preventDefault();
    var kaart = knop.closest('.fiets, [data-product]');
    var keuzes = (info.opties || []).map(function (o, i) {
      var s = kaart && kaart.querySelector('select[data-optie="' + i + '"]');
      return s ? s.value : o.waarden[0];
    });
    voegToe(info, keuzes);
    knop.classList.add('toegevoegd');
    var label = knop.querySelector('[data-label]');
    if (label) { var oud = label.textContent; label.textContent = 'Toegevoegd'; setTimeout(function () { label.textContent = oud; knop.classList.remove('toegevoegd'); }, 1400); }
    open();
  });

  /* ---------- filters op de shoppagina ---------- */
  var filters = document.querySelector('[data-filters]');
  var raster = document.querySelector('[data-producten]');
  if (filters && raster) {
    filters.hidden = false;
    var kaarten = [].slice.call(raster.querySelectorAll('[data-categorie]'));
    var staat = { cat: 'alles', merk: '', soort: '', voorraad: false, sort: '' };
    var resultaat = filters.querySelector('[data-resultaat]'), leeg = document.querySelector('[data-geen-resultaat]');
    var volgorde = kaarten.slice();

    var vanHash = function () {
      var h = decodeURIComponent(location.hash.replace('#', ''));
      if (filters.querySelector('[data-cat="' + h + '"]')) staat.cat = h;
    };
    function pas() {
      var zicht = kaarten.filter(function (k) {
        return (staat.cat === 'alles' || k.dataset.categorie === staat.cat) &&
          (!staat.merk || k.dataset.merk === staat.merk) &&
          (!staat.soort || (staat.soort === 'nieuw' ? k.dataset.staat === 'nieuw' : k.dataset.staat !== 'nieuw')) &&
          (!staat.voorraad || k.dataset.voorraad === '1');
      });
      kaarten.forEach(function (k) { k.hidden = zicht.indexOf(k) === -1; });
      var lijst = staat.sort ? kaarten.slice().sort(function (a, b) { return staat.sort === 'op' ? a.dataset.prijs - b.dataset.prijs : b.dataset.prijs - a.dataset.prijs; }) : volgorde;
      lijst.forEach(function (k) { raster.appendChild(k); });
      resultaat.textContent = zicht.length + (zicht.length === 1 ? ' product' : ' producten');
      if (leeg) leeg.hidden = zicht.length > 0;
      filters.querySelectorAll('[data-cat]').forEach(function (b) { var aan = b.dataset.cat === staat.cat; b.classList.toggle('actief', aan); b.setAttribute('aria-pressed', aan); });
    }
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      staat.cat = b.dataset.cat;
      history.replaceState(null, '', staat.cat === 'alles' ? location.pathname : '#' + staat.cat);
      pas();
    });
    filters.addEventListener('change', function (e) {
      if (e.target.matches('[data-merk]')) staat.merk = e.target.value;
      if (e.target.matches('[data-soort]')) staat.soort = e.target.value;
      if (e.target.matches('[data-voorraad]')) staat.voorraad = e.target.checked;
      if (e.target.matches('[data-sort]')) staat.sort = e.target.value;
      pas();
    });
    var wis = document.querySelector('[data-wis-filters]');
    if (wis) wis.addEventListener('click', function () {
      staat = { cat: 'alles', merk: '', soort: '', voorraad: false, sort: '' };
      filters.querySelectorAll('select').forEach(function (s) { s.value = ''; });
      filters.querySelectorAll('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
      history.replaceState(null, '', location.pathname); pas();
    });
    window.addEventListener('hashchange', function () { vanHash(); pas(); });
    vanHash(); pas();
  }

  window.CSMand = { lees: leesMand, bewaar: bewaar, leeg: function () { bewaar([]); }, open: open, uitvoering: uitvoering };
  teken();
})();
