/* Beheer Cycle Service, powered by Mettafel. Eén pagina, schermen via #hash. */
(function () {
  'use strict';

  var csrf = '';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var euro = function (n) { return '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var wanneer = function (iso) { return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  var bedragVeld = function (n) { return n === '' || n == null ? '' : (Number(n) % 1 ? Number(n).toFixed(2) : String(n)).replace('.', ','); };
  var fotoUrl = function (f) { return !f ? '' : f.indexOf('/') > -1 ? '/' + f : '/assets/img/' + f; };
  var inhoud = $('[data-inhoud]');
  var PAGINANAMEN = { 'index.html': 'Homepage', 'werkplaats.html': 'Werkplaats', 'planner.html': 'Plan je beurt', 'fietsen.html': 'Shop', 'over.html': 'Over Jay', 'contact.html': 'Contact', 'voorwaarden.html': 'Voorwaarden', 'privacy.html': 'Privacy', 'afrekenen.html': 'Afrekenen' };

  /* ---------- server ---------- */
  function api(methode, pad, body, ruw) {
    var opties = { method: methode, headers: { 'X-CSRF': csrf }, credentials: 'same-origin' };
    if (ruw) { opties.body = ruw; opties.headers['Content-Type'] = ruw.type || 'application/octet-stream'; }
    else if (body !== undefined) { opties.body = JSON.stringify(body); opties.headers['Content-Type'] = 'application/json'; }
    return fetch('/api/beheer/' + pad, opties).then(function (r) {
      return r.json().catch(function () { return { ok: false, fout: 'Onverwacht antwoord van de server.' }; }).then(function (j) {
        if (j.uitgelogd) { toonInlog(); throw new Error(j.fout); }
        if (j.moetWijzigen && pad !== 'overzicht') { location.hash = '#instellingen'; throw new Error(j.fout); }
        if (!j.ok) throw new Error(j.fout || 'Er ging iets mis.');
        return j;
      });
    });
  }
  var toastTimer;
  function toast(tekst, fout) {
    var t = $('[data-toast]');
    t.textContent = tekst; t.classList.toggle('fout', !!fout); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, fout ? 5000 : 2600);
  }
  var faal = function (e) { toast(e.message || 'Er ging iets mis.', true); };

  /* ---------- inloggen ---------- */
  function toonInlog() {
    $('[data-laden]').hidden = true;
    $('[data-scherm="app"]').hidden = true;
    $('[data-scherm="inlog"]').hidden = false;
    var i = $('[data-inlog] input'); if (i) i.focus();
  }
  function toonApp(moetWijzigen) {
    $('[data-laden]').hidden = true;
    $('[data-scherm="inlog"]').hidden = true;
    $('[data-scherm="app"]').hidden = false;
    if (moetWijzigen) location.hash = '#instellingen';
    route();
  }
  $('[data-inlog]').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, knop = $('button', f), fout = $('[data-inlog-fout]');
    knop.disabled = true; fout.hidden = true;
    fetch('/api/beheer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wachtwoord: f.wachtwoord.value, code: f.code.value }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        knop.disabled = false;
        if (!j.ok) {
          fout.textContent = j.fout; fout.hidden = false;
          if (j.tweeStap) { $('[data-code-veld]').hidden = false; f.code.value = ''; f.code.focus(); } else f.wachtwoord.select();
          return;
        }
        csrf = j.csrf; f.wachtwoord.value = ''; f.code.value = '';
        toonApp(j.moetWijzigen);
      }).catch(function () { knop.disabled = false; fout.textContent = 'Geen verbinding met de server.'; fout.hidden = false; });
  });
  $('[data-uitloggen]').addEventListener('click', function () {
    api('POST', 'uitloggen', {}).catch(function () {}).then(function () { csrf = ''; toonInlog(); });
  });

  /* ---------- schermen ---------- */
  var SCHERMEN = {};
  function route() {
    if ($('[data-scherm="app"]').hidden) return;
    var naam = (location.hash || '#overzicht').slice(1).split('/')[0];
    if (!SCHERMEN[naam]) naam = 'overzicht';
    $$('[data-naar]').forEach(function (a) { if (a.dataset.naar === naam) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    inhoud.innerHTML = '<div class="leeg"><span class="spinner" aria-hidden="true"></span></div>';
    SCHERMEN[naam]((location.hash.split('/')[1] || '')).catch(faal);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  function tellers() {
    api('GET', 'overzicht').then(function (j) {
      [['bestellingen', j.bestellingen.nieuw], ['berichten', j.berichten.nieuw]].forEach(function (x) {
        var t = $('[data-teller="' + x[0] + '"]'); t.textContent = x[1]; t.hidden = !x[1];
      });
    }).catch(function () {});
  }
  function kop(titel, tekst, acties) {
    return '<div class="kop"><div><h1>' + titel + '</h1>' + (tekst ? '<p>' + tekst + '</p>' : '') + '</div>' + (acties ? '<div class="acties">' + acties + '</div>' : '') + '</div>';
  }
  function tekenTeller(veld, min, max) {
    var t = veld.parentNode.querySelector('.teller-tekens');
    if (!t) return;
    var n = veld.value.length;
    t.textContent = n + ' tekens' + (max ? ' (ideaal ' + min + ' tot ' + max + ')' : '');
    t.classList.toggle('te-lang', max && n > max);
    t.classList.toggle('goed', max && n >= min && n <= max);
  }

  /* ---------- overzicht ---------- */
  SCHERMEN.overzicht = function () {
    return api('GET', 'overzicht').then(function (j) {
      tellers();
      inhoud.innerHTML = kop('Goedemorgen, Jay'.replace('Goedemorgen', ['Goedenacht', 'Goedemorgen', 'Goedemiddag', 'Goedenavond'][Math.floor(new Date().getHours() / 6)]), 'Hier pas je de website en de webshop aan. Wat je opslaat staat meteen online.') +
        (j.moetWijzigen ? '<div class="melding">Je gebruikt nog het eerste wachtwoord. <a class="knop klein vol" href="#instellingen">Kies een eigen wachtwoord</a></div>' : '') +
        '<div class="rij">' +
          '<a class="paneel stat' + (j.bestellingen.nieuw ? ' let' : '') + '" href="#bestellingen"><strong>' + j.bestellingen.nieuw + '</strong><span>nieuwe bestellingen</span></a>' +
          '<a class="paneel stat' + (j.berichten.nieuw ? ' let' : '') + '" href="#berichten"><strong>' + j.berichten.nieuw + '</strong><span>nieuwe berichten</span></a>' +
          '<a class="paneel stat" href="#producten"><strong>' + j.producten.voorraad + '<small style="font-size:1.4rem;color:var(--dim)"> / ' + j.producten.totaal + '</small></strong><span>producten op voorraad</span></a>' +
          '<a class="paneel stat" href="#teksten"><strong>' + j.aanpassingen + '</strong><span>eigen teksten en foto\'s</span></a>' +
        '</div>' +
        '<div class="paneel"><h2>Snel naar</h2><div class="knoppen" style="margin:0">' +
          '<a class="knop vol" href="#producten/nieuw">+ Product toevoegen</a>' +
          '<a class="knop" href="#teksten">Teksten en foto\'s aanpassen</a>' +
          '<a class="knop" href="#prijzen">Prijzen van de beurten</a>' +
          '<a class="knop" href="#seo">Vindbaar in Google</a>' +
        '</div></div>' +
        '<div class="paneel"><h2>Laatste wijzigingen</h2>' + (j.logboek.length ? '<ul class="logboek">' + j.logboek.map(function (l) { return '<li><span>' + esc(l.actie) + '</span><time>' + wanneer(l.t) + '</time></li>'; }).join('') + '</ul>' : '<p class="hulp">Nog niets gewijzigd.</p>') + '</div>';
    });
  };

  /* ---------- foto's verkleinen in de browser en uploaden ---------- */
  function naarBlob(canvas) {
    return new Promise(function (ok) {
      canvas.toBlob(function (b) {
        if (b && b.type === 'image/webp') return ok(b);
        canvas.toBlob(function (j) { ok(j); }, 'image/jpeg', 0.85);   /* Safari maakt geen WebP: dan JPEG */
      }, 'image/webp', 0.82);
    });
  }
  function schaal(beeld, breedte) {
    var f = Math.min(1, breedte / beeld.width);
    var c = document.createElement('canvas');
    c.width = Math.round(beeld.width * f); c.height = Math.round(beeld.height * f);
    var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(beeld, 0, 0, c.width, c.height);
    return c;
  }
  function laadBeeld(bestand) {
    if (window.createImageBitmap) return createImageBitmap(bestand, { imageOrientation: 'from-image' }).catch(function () { return laadImg(bestand); });
    return laadImg(bestand);
  }
  function laadImg(bestand) {
    return new Promise(function (ok, fout) {
      var img = new Image(); img.onload = function () { ok(img); }; img.onerror = function () { fout(new Error('Deze foto kan ik niet openen. Probeer een JPG of PNG.')); };
      img.src = URL.createObjectURL(bestand);
    });
  }
  /* geeft { src (1600 breed), klein (800 breed), breed, hoog } */
  function uploadFoto(bestand) {
    if (!/^image\//.test(bestand.type) && !/\.(heic|heif)$/i.test(bestand.name)) return Promise.reject(new Error('Kies een foto (JPG, PNG, WebP of HEIC).'));
    return laadBeeld(bestand).then(function (beeld) {
      var groot = schaal(beeld, 1600), klein = schaal(beeld, 800);
      return Promise.all([naarBlob(groot), naarBlob(klein)]).then(function (b) {
        return api('POST', 'media?maat=1600', undefined, b[0]).then(function (g) {
          return api('POST', 'media?maat=800&groep=' + g.groep, undefined, b[1]).then(function (k) {
            return { src: g.pad, klein: k.pad, breed: groot.width, hoog: groot.height };
          });
        });
      });
    });
  }
  function kiesBestand(meer) {
    return new Promise(function (ok) {
      var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!meer;
      i.addEventListener('change', function () { ok([].slice.call(i.files)); });
      i.click();
    });
  }

  /* ---------- producten ---------- */
  var cat = null;
  SCHERMEN.producten = function (sub) {
    return api('GET', 'producten').then(function (j) {
      cat = j;
      if (sub === 'nieuw') return productForm(null);
      if (sub) { var p = j.producten.find(function (x) { return x.id === sub; }); if (p) return productForm(p); }
      productLijst();
    });
  };
  var filter = { q: '', cat: '' };
  function productLijst() {
    inhoud.innerHTML = kop('Producten', 'Pas prijzen en voorraad direct in de lijst aan. Met de ster zet je een fiets op de homepage (maximaal vier).', '<a class="knop vol" href="#producten/nieuw">+ Nieuw product</a>') +
      '<div class="filterbalk"><input type="search" placeholder="Zoek op merk of naam" value="' + esc(filter.q) + '" data-zoek aria-label="Zoeken">' +
      '<select data-cat aria-label="Categorie"><option value="">Alle categorieën</option>' + cat.categorieen.map(function (c) { return '<option value="' + c.id + '"' + (filter.cat === c.id ? ' selected' : '') + '>' + esc(c.naam) + '</option>'; }).join('') + '</select></div>' +
      '<div class="plijst" data-plijst></div>';
    tekenLijst();
    $('[data-zoek]').addEventListener('input', function (e) { filter.q = e.target.value; tekenLijst(); });
    $('[data-cat]').addEventListener('change', function (e) { filter.cat = e.target.value; tekenLijst(); });
  }
  function tekenLijst() {
    var q = filter.q.toLowerCase();
    var lijst = cat.producten.filter(function (p) { return (!filter.cat || p.categorie === filter.cat) && (!q || (p.merk + ' ' + p.naam + ' ' + (p.maat || '')).toLowerCase().indexOf(q) > -1); });
    var catNaam = function (id) { var c = cat.categorieen.find(function (x) { return x.id === id; }); return c ? c.naam : id; };
    var vol = !filter.q && !filter.cat;
    $('[data-plijst]').innerHTML = lijst.length ? lijst.map(function (p) {
      var i = cat.producten.indexOf(p);
      return '<div class="prod' + (p.voorraad ? '' : ' uit') + '" data-id="' + esc(p.id) + '">' +
        '<div class="duim">' + (p.foto ? '<img src="' + esc(fotoUrl(p.foto)) + '" alt="" loading="lazy">' : '<svg><use href="/assets/iconen.svg#i-tas"/></svg>') + '</div>' +
        '<div class="naam"><strong>' + esc(p.merk + ' ' + p.naam) + '</strong><small>' + esc([catNaam(p.categorie), p.maat, p.staat !== 'nieuw' ? p.staat : ''].filter(Boolean).join(' · ')) + '</small></div>' +
        '<label class="prijsveld"><span>€</span><input type="text" inputmode="decimal" value="' + esc(bedragVeld(p.prijs)) + '" data-prijs aria-label="Prijs van ' + esc(p.merk + ' ' + p.naam) + '"></label>' +
        '<label class="schakel"><input type="checkbox" data-voorraad' + (p.voorraad ? ' checked' : '') + '><span>Op voorraad</span></label>' +
        '<button type="button" class="ster" data-uitgelicht aria-pressed="' + !!p.uitgelicht + '" title="Op de homepage tonen" aria-label="Op de homepage tonen">★</button>' +
        '<div class="acties">' + (vol ? '<button class="pijl" type="button" data-schuif="omhoog" aria-label="Hoger in de lijst"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="pijl" type="button" data-schuif="omlaag" aria-label="Lager in de lijst"' + (i === cat.producten.length - 1 ? ' disabled' : '') + '>↓</button>' : '') +
          '<a class="knop klein" href="/shop-' + esc(p.id) + '.html" target="_blank" rel="noopener">Bekijk</a><a class="knop klein vol" href="#producten/' + esc(p.id) + '">Bewerk</a></div>' +
      '</div>';
    }).join('') : '<p class="leeg">Geen producten gevonden.</p>';
  }
  inhoud.addEventListener('change', function (e) {
    var rij = e.target.closest('.prod'); if (!rij) return;
    var id = rij.dataset.id, p = cat.producten.find(function (x) { return x.id === id; });
    if (e.target.matches('[data-prijs]')) {
      var veld = e.target;
      api('PATCH', 'producten/' + id, { prijs: veld.value }).then(function (j) {
        p.prijs = j.product.prijs; veld.value = bedragVeld(p.prijs);
        veld.classList.add('bewaard'); setTimeout(function () { veld.classList.remove('bewaard'); }, 1400);
        toast('Prijs opgeslagen: ' + euro(p.prijs));
      }).catch(function (err) { veld.value = bedragVeld(p.prijs); faal(err); });
    }
    if (e.target.matches('[data-voorraad]')) {
      var aan = e.target.checked;
      api('PATCH', 'producten/' + id, { voorraad: aan }).then(function () { p.voorraad = aan; rij.classList.toggle('uit', !aan); toast(aan ? 'Op voorraad' : 'Niet op voorraad: toont "Op bestelling"'); }).catch(function (err) { e.target.checked = !aan; faal(err); });
    }
  });
  inhoud.addEventListener('click', function (e) {
    var rij = e.target.closest('.prod'); if (!rij) return;
    var id = rij.dataset.id, p = cat.producten.find(function (x) { return x.id === id; });
    var ster = e.target.closest('[data-uitgelicht]');
    if (ster) {
      var aan = ster.getAttribute('aria-pressed') !== 'true';
      if (aan && cat.producten.filter(function (x) { return x.uitgelicht; }).length >= 4) return toast('Er staan al vier fietsen op de homepage. Haal er eerst een weg.', true);
      api('PATCH', 'producten/' + id, { uitgelicht: aan }).then(function () { p.uitgelicht = aan; ster.setAttribute('aria-pressed', aan); toast(aan ? 'Staat nu op de homepage' : 'Niet meer op de homepage'); }).catch(faal);
    }
    var schuif = e.target.closest('[data-schuif]');
    if (schuif) {
      api('POST', 'producten/' + id + '/' + schuif.dataset.schuif, {}).then(function () {
        var i = cat.producten.indexOf(p), j = schuif.dataset.schuif === 'omhoog' ? i - 1 : i + 1;
        cat.producten[i] = cat.producten[j]; cat.producten[j] = p; tekenLijst();
      }).catch(faal);
    }
  });

  function veld(label, html, hulp, breed) { return '<label class="veld' + (breed ? ' breed' : '') + '"><span>' + label + '</span>' + html + (hulp ? '<small>' + hulp + '</small>' : '') + '</label>'; }
  function productForm(p) {
    var nieuw = !p;
    p = p || { merk: '', naam: '', categorie: cat.categorieen[0].id, staat: 'nieuw', prijs: '', voorraad: true, levering: 'afhalen', kenmerken: [] };
    var staat = { foto: p.foto || '', fotoGroot: p.fotoGroot || '', fotos: (p.fotos || []).slice(), opties: (p.opties || []).map(function (o) { return { naam: o.naam, waarden: o.waarden.join(', ') }; }) };
    inhoud.innerHTML = kop(nieuw ? 'Nieuw product' : esc(p.merk + ' ' + p.naam), nieuw ? 'Vul in wat je weet; je kunt het later altijd aanvullen.' : 'Wijzigingen staan na opslaan meteen in de shop en op de productpagina.', nieuw ? '' : '<a class="knop" href="/shop-' + esc(p.id) + '.html" target="_blank" rel="noopener">Bekijk in de shop</a>') +
      '<form data-pform novalidate>' +
      '<div class="paneel"><h2>Basis</h2><div class="velden">' +
        veld('Merk', '<input name="merk" required maxlength="60" value="' + esc(p.merk) + '">') +
        veld('Naam', '<input name="naam" required maxlength="80" value="' + esc(p.naam) + '">') +
        veld('Maat of uitvoering', '<input name="maat" maxlength="40" value="' + esc(p.maat || '') + '" placeholder="bijv. maat M of 57 cm">') +
        veld('Categorie', '<select name="categorie">' + cat.categorieen.map(function (c) { return '<option value="' + c.id + '"' + (c.id === p.categorie ? ' selected' : '') + '>' + esc(c.naam) + '</option>'; }).join('') + '</select>') +
        veld('Staat', '<select name="staat">' + [['nieuw', 'Nieuw'], ['occasion', 'Occasion'], ['demo', 'Demo']].map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === p.staat ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>') +
        veld('Prijs (inclusief btw)', '<div class="prijsveld"><span>€</span><input name="prijs" inputmode="decimal" required value="' + esc(bedragVeld(p.prijs)) + '" placeholder="1299"></div>') +
        veld('Levering', '<select name="levering"><option value="afhalen"' + (p.levering !== 'verzenden' ? ' selected' : '') + '>Alleen afhalen in de winkel</option><option value="verzenden"' + (p.levering === 'verzenden' ? ' selected' : '') + '>Afhalen of verzenden</option></select>', 'Fietsen haal je rijklaar op; onderdelen kun je ook verzenden.') +
        '<div class="veld" style="align-content:end;gap:.8rem"><label class="schakel"><input type="checkbox" name="voorraad"' + (p.voorraad ? ' checked' : '') + '><span>Op voorraad</span></label><label class="schakel"><input type="checkbox" name="uitgelicht"' + (p.uitgelicht ? ' checked' : '') + '><span>Op de homepage</span></label></div>' +
      '</div></div>' +
      '<div class="paneel"><h2>Foto\'s</h2><p class="hulp">De eerste foto staat op de kaart in de shop. Foto\'s worden automatisch verkleind en licht gemaakt, je kunt ze zo van je telefoon kiezen.</p>' +
        '<div class="fotos" data-fotos></div>' +
        '<div class="velden" style="margin-top:1rem">' + veld('Beschrijving van de hoofdfoto (voor Google en schermlezers)', '<input name="alt" maxlength="200" value="' + esc(p.alt || '') + '" placeholder="bijv. Mondraker Arid in blauw voor de winkel">', '', true) + '</div>' +
      '</div>' +
      '<div class="paneel"><h2>Tekst</h2><div class="velden">' +
        veld('Korte zin onder de naam', '<input name="intro" maxlength="300" value="' + esc(p.intro || '') + '" placeholder="bijv. Veelzijdige carbon gravelbike.">', '', true) +
        veld('Kenmerken (één per regel)', '<textarea name="kenmerken" rows="4" placeholder="SRAM Rival XPLR 13-speed&#10;Mavic Allroad wielen">' + esc((p.kenmerken || []).join('\n')) + '</textarea>', 'De eerste drie staan op de kaart, alle kenmerken op de productpagina.', true) +
        veld('Uitgebreide omschrijving (optioneel)', '<textarea name="omschrijving" rows="6" placeholder="Vertel wat deze fiets bijzonder maakt. Een lege regel begint een nieuwe alinea.">' + esc(p.omschrijving || '') + '</textarea>', 'Goed voor Google: schrijf het zoals je het in de winkel zou uitleggen.', true) +
      '</div></div>' +
      '<div class="paneel"><h2>Keuzes voor de klant (optioneel)</h2><p class="hulp">Bijvoorbeeld Maat met S, M, L of Kleur. Zet er alleen in wat leverbaar is. Eén waarde staat als vaste tekst op de kaart.</p><div data-opties></div><button type="button" class="knop klein" data-optie-erbij>+ Keuze toevoegen</button></div>' +
      '<div class="paneel"><h2>Vindbaar in Google (optioneel)</h2><p class="hulp">Laat leeg, dan maken we zelf een goede titel en omschrijving.</p><div class="seo-kaart"><div class="velden">' +
        veld('Titel in Google', '<input name="seoTitel" maxlength="120" value="' + esc(p.seoTitel || '') + '"><span class="teller-tekens"></span>', '', true) +
        veld('Omschrijving in Google', '<textarea name="seoOmschrijving" rows="3" maxlength="320">' + esc(p.seoOmschrijving || '') + '</textarea><span class="teller-tekens"></span>', '', true) +
        veld('EAN-code (optioneel)', '<input name="ean" inputmode="numeric" maxlength="14" value="' + esc(p.ean || '') + '">', 'De streepjescode op de doos. Helpt bij Google Shopping.') +
      '</div><div><span class="hulp">Zo ziet het er ongeveer uit in Google:</span><div class="google" data-google></div></div></div></div>' +
      '<div class="knoppen"><button class="knop vol" type="submit">' + (nieuw ? 'Product toevoegen' : 'Opslaan') + '</button><a class="knop" href="#producten">Annuleren</a>' + (nieuw ? '' : '<button type="button" class="knop gevaar" data-verwijder style="margin-left:auto">Verwijderen</button>') + '</div>' +
      '</form>';
    var form = $('[data-pform]');

    function tekenFotos() {
      var vakken = '<div class="foto-vak hoofd" data-hoofd role="button" tabindex="0" aria-label="Hoofdfoto kiezen">' + (staat.foto ? '<img src="' + esc(fotoUrl(staat.fotoGroot || staat.foto)) + '" alt=""><button type="button" class="weg" data-weg-hoofd aria-label="Hoofdfoto weghalen">×</button><span class="label">Hoofdfoto</span>' : '<span>+ Hoofdfoto kiezen</span>') + '</div>';
      vakken += staat.fotos.map(function (f, i) { return '<div class="foto-vak"><img src="' + esc(fotoUrl(f)) + '" alt=""><button type="button" class="weg" data-weg="' + i + '" aria-label="Foto weghalen">×</button></div>'; }).join('');
      if (staat.fotos.length < 8) vakken += '<div class="foto-vak" data-extra role="button" tabindex="0" aria-label="Extra foto\'s toevoegen"><span>+ Extra foto\'s</span></div>';
      $('[data-fotos]').innerHTML = vakken;
    }
    function tekenOpties() {
      $('[data-opties]').innerHTML = staat.opties.map(function (o, i) {
        return '<div class="optierij"><input data-onaam="' + i + '" value="' + esc(o.naam) + '" placeholder="Naam, bijv. Maat" aria-label="Naam van de keuze"><input data-owaarden="' + i + '" value="' + esc(o.waarden) + '" placeholder="Waarden met komma, bijv. S, M, L" aria-label="Waarden"><button type="button" class="knop klein gevaar" data-oweg="' + i + '">Weg</button></div>';
      }).join('');
      $('[data-optie-erbij]').hidden = staat.opties.length >= 3;
    }
    function tekenGoogle() {
      var t = form.seoTitel.value || ((form.merk.value + ' ' + form.naam.value).trim() + (form.maat.value ? ' ' + form.maat.value : '') + ' | Cycle Service');
      var o = form.seoOmschrijving.value || ((form.merk.value + ' ' + form.naam.value).trim() + ' voor € ' + (form.prijs.value || '...') + '. ' + form.intro.value);
      $('[data-google]').innerHTML = '<div class="url">www.cycle-service.nl › shop</div><div class="titel">' + esc(t) + '</div><div class="omschr">' + esc(o) + '</div>';
      tekenTeller(form.seoTitel, 30, 60); tekenTeller(form.seoOmschrijving, 70, 155);
    }
    tekenFotos(); tekenOpties(); tekenGoogle();
    form.addEventListener('input', function (e) {
      if (e.target.dataset.onaam) staat.opties[e.target.dataset.onaam].naam = e.target.value;
      if (e.target.dataset.owaarden) staat.opties[e.target.dataset.owaarden].waarden = e.target.value;
      tekenGoogle();
    });
    $('[data-optie-erbij]').addEventListener('click', function () { staat.opties.push({ naam: '', waarden: '' }); tekenOpties(); });
    form.addEventListener('click', function (e) {
      var w = e.target.closest('[data-oweg]');
      if (w) { staat.opties.splice(+w.dataset.oweg, 1); tekenOpties(); return; }
      if (e.target.closest('[data-weg-hoofd]')) { e.stopPropagation(); staat.foto = ''; staat.fotoGroot = ''; tekenFotos(); return; }
      var wf = e.target.closest('[data-weg]');
      if (wf) { staat.fotos.splice(+wf.dataset.weg, 1); tekenFotos(); return; }
      var vak = e.target.closest('[data-hoofd], [data-extra]');
      if (vak) kiesFoto(vak);
    });
    form.addEventListener('keydown', function (e) { var vak = e.target.closest('[data-hoofd], [data-extra]'); if (vak && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); kiesFoto(vak); } });
    function kiesFoto(vak) {
      var hoofd = vak.hasAttribute('data-hoofd');
      kiesBestand(!hoofd).then(function (bestanden) {
        if (!bestanden.length) return;
        vak.classList.add('bezig');
        var rij = Promise.resolve();
        bestanden.slice(0, 8 - staat.fotos.length).forEach(function (b) {
          rij = rij.then(function () { return uploadFoto(b); }).then(function (f) {
            if (hoofd) { staat.foto = f.klein; staat.fotoGroot = f.src; } else staat.fotos.push(f.src);
          });
        });
        rij.then(function () { tekenFotos(); toast('Foto klaar. Vergeet niet op te slaan.'); }).catch(function (err) { vak.classList.remove('bezig'); faal(err); });
      });
    }
    var weg = $('[data-verwijder]');
    if (weg) weg.addEventListener('click', function () {
      if (!confirm('Weet je zeker dat je ' + p.merk + ' ' + p.naam + ' wilt verwijderen? Hij verdwijnt meteen uit de shop.')) return;
      api('DELETE', 'producten/' + p.id).then(function () { toast('Product verwijderd'); location.hash = '#producten'; }).catch(faal);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        merk: form.merk.value, naam: form.naam.value, maat: form.maat.value, categorie: form.categorie.value, staat: form.staat.value,
        prijs: form.prijs.value, levering: form.levering.value, voorraad: form.voorraad.checked, uitgelicht: form.uitgelicht.checked,
        alt: form.alt.value, intro: form.intro.value, kenmerken: form.kenmerken.value.split('\n'), omschrijving: form.omschrijving.value,
        seoTitel: form.seoTitel.value, seoOmschrijving: form.seoOmschrijving.value, ean: form.ean.value,
        foto: staat.foto, fotoGroot: staat.fotoGroot, fotos: staat.fotos,
        opties: staat.opties.map(function (o) { return { naam: o.naam, waarden: o.waarden.split(',') }; }),
      };
      if (data.uitgelicht && !p.uitgelicht && cat.producten.filter(function (x) { return x.uitgelicht; }).length >= 4) return toast('Er staan al vier fietsen op de homepage. Haal er eerst een weg.', true);
      var knop = $('button[type="submit"]', form); knop.disabled = true;
      api(nieuw ? 'POST' : 'PUT', nieuw ? 'producten' : 'producten/' + p.id, data).then(function (j) {
        toast(nieuw ? 'Product toegevoegd' : 'Opgeslagen');
        location.hash = '#producten';
      }).catch(function (err) { knop.disabled = false; faal(err); });
    });
  }

  /* ---------- teksten en foto's ---------- */
  SCHERMEN.teksten = function () {
    return api('GET', 'inhoud').then(function (j) {
      var paginas = ['index.html', 'werkplaats.html', 'planner.html', 'fietsen.html', 'over.html', 'contact.html', 'voorwaarden.html', 'privacy.html'];
      inhoud.innerHTML = kop('Teksten en foto\'s', 'Open een pagina in bewerkmodus en klik op een tekst of foto om die aan te passen. Wat je opslaat staat meteen online. De kop en voet van de site pas je op elke pagina aan; dat geldt dan overal.') +
        '<div class="paginas">' + paginas.map(function (p) {
          return '<div class="paneel pagina-kaart"><h3>' + PAGINANAMEN[p] + '</h3><small>/' + (p === 'index.html' ? '' : p) + '</small><a class="knop vol klein" href="/' + p + '?bewerken=1&foto=1">Bewerk deze pagina</a></div>';
        }).join('') + '</div>' +
        '<div class="melding info" style="margin-top:1rem">Productpagina\'s pas je aan bij <a href="#producten">Producten</a>. De prijzen van de beurten pas je op één plek aan bij <a href="#prijzen">Prijzen</a>; ze veranderen dan overal op de site.</div>' +
        '<div class="paneel"><h2>Wat je hebt aangepast</h2>' + (j.aanpassingen.length ? j.aanpassingen.map(function (a) {
          return '<div class="wijziging"><div><div class="waar">' + esc(a.soort === 'foto' ? 'Foto' : 'Tekst') + ' · ' + esc(PAGINANAMEN[a.pagina] || a.pagina) + '</div>' +
            (a.soort === 'foto' ? '<div style="display:flex;gap:.6rem;align-items:center"><img src="' + esc(fotoUrl(a.was)) + '" alt="" width="80" style="border-radius:6px;opacity:.6"> → <img src="/' + esc(a.nu) + '" alt="" width="80" style="border-radius:6px"></div>' : '<div class="was">' + esc(a.was) + '</div><div>' + esc(a.nu) + '</div>') +
            '</div><button class="knop klein" type="button" data-herstel="' + esc(a.soort === 'foto' ? 'beeld' : 'tekst') + '/' + esc(a.key) + '">Origineel terug</button></div>';
        }).join('') : '<p class="hulp">Je hebt nog niets aangepast. Alles staat zoals het gebouwd is.</p>') + '</div>';
      $$('[data-herstel]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Het origineel terugzetten?')) return;
          api('DELETE', b.dataset.herstel).then(function () { toast('Origineel teruggezet'); route(); }).catch(faal);
        });
      });
    });
  };

  /* ---------- prijzen en verzenden ---------- */
  SCHERMEN.prijzen = function () {
    return api('GET', 'inhoud').then(function (j) {
      var d = j.diensten, v = j.verzenden;
      inhoud.innerHTML = kop('Prijzen en verzenden', 'De prijs van een beurt staat op veel plekken: homepage, werkplaats, planner, contact, footer en in Google. Hier pas je hem één keer aan, dan klopt hij overal.') +
        '<form class="paneel" data-diensten><h2>Prijzen van de beurten</h2><div class="velden">' +
        Object.keys(d).map(function (k) { return veld(esc(d[k].naam), '<div class="prijsveld"><span>€</span><input name="' + k + '" inputmode="decimal" required value="' + esc(bedragVeld(d[k].prijs)) + '"></div>'); }).join('') +
        '</div><div class="knoppen"><button class="knop vol" type="submit">Prijzen opslaan</button></div></form>' +
        '<form class="paneel" data-verzenden><h2>Verzenden van onderdelen</h2><p class="hulp">Fietsen worden altijd afgehaald. Dit geldt voor producten met levering "Afhalen of verzenden".</p><div class="velden">' +
        '<div class="veld" style="align-content:end"><label class="schakel"><input type="checkbox" name="actief"' + (v.actief ? ' checked' : '') + '><span>Verzenden aan</span></label></div>' +
        veld('Gratis verzenden vanaf', '<div class="prijsveld"><span>€</span><input name="gratisVanaf" inputmode="decimal" value="' + esc(bedragVeld(v.gratisVanaf)) + '"></div>', 'Leeg = nooit gratis.') +
        veld('Verzendkosten onder dat bedrag', '<div class="prijsveld"><span>€</span><input name="kosten" inputmode="decimal" value="' + esc(bedragVeld(v.kosten)) + '"></div>', 'Leeg = verzenden kan alleen vanaf het gratis-bedrag.') +
        '</div><div class="knoppen"><button class="knop vol" type="submit">Opslaan</button></div></form>';
      $('[data-diensten]').addEventListener('submit', function (e) {
        e.preventDefault();
        var body = {}; Object.keys(d).forEach(function (k) { body[k] = { prijs: e.target[k].value }; });
        api('PUT', 'diensten', body).then(function () { toast('Prijzen opgeslagen. Ze staan nu overal op de site.'); }).catch(faal);
      });
      $('[data-verzenden]').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target;
        api('PUT', 'verzenden', { actief: f.actief.checked, gratisVanaf: f.gratisVanaf.value, kosten: f.kosten.value }).then(function () { toast('Opgeslagen'); }).catch(faal);
      });
    });
  };

  /* ---------- vindbaar in Google ---------- */
  SCHERMEN.seo = function () {
    return api('GET', 'inhoud').then(function (j) {
      inhoud.innerHTML = kop('Vindbaar in Google', 'Per pagina de titel en de omschrijving die Google toont. Laat een veld leeg om de standaard te gebruiken.') +
        '<div class="melding info">Dit regelt de site al zelf: een sitemap voor Google met alle pagina\'s en producten (<a href="/sitemap.xml" target="_blank" rel="noopener">sitemap.xml</a>), productgegevens met prijs en voorraad voor Google Shopping, bedrijfsgegevens met openingstijden en reviews, en snelle, mobielvriendelijke pagina\'s.</div>' +
        j.seo.map(function (s) {
          var e = s.eigen || {};
          return '<form class="paneel" data-seo="' + esc(s.pad) + '"><h2>' + esc(PAGINANAMEN[s.pad] || s.pad) + '</h2><div class="seo-kaart"><div class="velden">' +
            veld('Titel', '<input name="titel" maxlength="120" value="' + esc(e.titel || '') + '" placeholder="' + esc(s.standaard.titel) + '"><span class="teller-tekens"></span>', '', true) +
            veld('Omschrijving', '<textarea name="omschrijving" rows="3" maxlength="320" placeholder="' + esc(s.standaard.omschrijving) + '">' + esc(e.omschrijving || '') + '</textarea><span class="teller-tekens"></span>', '', true) +
            '</div><div class="google" data-voorbeeld></div></div><div class="knoppen"><button class="knop vol klein" type="submit">Opslaan</button>' + (s.eigen ? '<button class="knop klein" type="button" data-standaard>Standaard terug</button>' : '') + '</div></form>';
        }).join('');
      $$('[data-seo]').forEach(function (f) {
        var s = j.seo.find(function (x) { return x.pad === f.dataset.seo; });
        var teken = function () {
          var t = f.titel.value || s.standaard.titel, o = f.omschrijving.value || s.standaard.omschrijving;
          $('[data-voorbeeld]', f).innerHTML = '<div class="url">www.cycle-service.nl' + (s.pad === 'index.html' ? '' : ' › ' + esc(s.pad.replace('.html', ''))) + '</div><div class="titel">' + esc(t) + '</div><div class="omschr">' + esc(o) + '</div>';
          f.titel.parentNode.querySelector('.teller-tekens').textContent = t.length + ' tekens (ideaal 30 tot 60)';
          f.titel.parentNode.querySelector('.teller-tekens').className = 'teller-tekens ' + (t.length > 60 ? 'te-lang' : t.length >= 30 ? 'goed' : '');
          f.omschrijving.parentNode.querySelector('.teller-tekens').textContent = o.length + ' tekens (ideaal 70 tot 155)';
          f.omschrijving.parentNode.querySelector('.teller-tekens').className = 'teller-tekens ' + (o.length > 155 ? 'te-lang' : o.length >= 70 ? 'goed' : '');
        };
        teken(); f.addEventListener('input', teken);
        f.addEventListener('submit', function (e) { e.preventDefault(); api('PUT', 'seo/' + s.pad, { titel: f.titel.value, omschrijving: f.omschrijving.value }).then(function () { toast('Opgeslagen'); }).catch(faal); });
        var std = $('[data-standaard]', f);
        if (std) std.addEventListener('click', function () { api('DELETE', 'seo/' + s.pad).then(function () { toast('Standaard teruggezet'); route(); }).catch(faal); });
      });
    });
  };

  /* ---------- bestellingen en berichten ---------- */
  function lijstScherm(soort, titel, uitleg) {
    return api('GET', soort).then(function (j) {
      tellers();
      inhoud.innerHTML = kop(titel, uitleg) + (j.items.length ? j.items.map(function (it) {
        var kopje = '<h3>' + esc(it.id) + ' · ' + esc(it.naam) + '</h3><div><a href="tel:' + esc(it.telefoon) + '">' + esc(it.telefoon) + '</a>' + (it.email ? ' · <a href="mailto:' + esc(it.email) + '">' + esc(it.email) + '</a>' : '') + '</div>';
        var detail = soort === 'bestellingen'
          ? '<div><span class="pil">' + euro(it.totaal) + '</span>' + (it.levering === 'verzenden' && it.adres ? 'verzenden naar ' + esc(it.adres.straat + ', ' + it.adres.postcode + ' ' + it.adres.plaats) : 'afhalen in de winkel') + '</div><ul>' + (it.regels || []).map(function (r) { return '<li>' + r.aantal + '× ' + esc(r.naam) + (r.maat ? ' (' + esc(r.maat) + ')' : '') + ' · ' + euro(r.subtotaal) + '</li>'; }).join('') + '</ul>' + (it.opmerking ? '<div><small>Opmerking:</small> ' + esc(it.opmerking) + '</div>' : '') + '<small>Betaling: ' + esc(it.betaling && it.betaling.status) + '</small>'
          : '<p style="white-space:pre-wrap">' + esc(it.bericht) + '</p>';
        var wis = soort === 'berichten' ? '<button type="button" class="wis" data-verwijder-bericht="' + esc(it.id) + '">Bericht verwijderen</button>'
          : it.gewist ? '<small>Persoonsgegevens gewist op ' + wanneer(it.gewist) + '</small>' : '<button type="button" class="wis" data-wis-bestelling="' + esc(it.id) + '">Persoonsgegevens wissen</button>';
        return '<article class="item' + (it.status === j.statussen[0] ? ' nieuw' : '') + '"><div>' + kopje + detail + '<div><small>Binnengekomen ' + wanneer(it.ontvangen) + '</small></div></div><div class="statussen">' +
          j.statussen.map(function (s) { return '<button type="button" class="' + (s === it.status ? 'huidig' : '') + '" data-status="' + esc(s) + '" data-id="' + esc(it.id) + '">' + esc(s) + '</button>'; }).join('') + wis + '</div></article>';
      }).join('') : '<div class="paneel leeg">Nog niets binnen.</div>');
      $$('[data-status]').forEach(function (b) {
        b.addEventListener('click', function () {
          api('POST', soort + '/' + b.dataset.id + '/status', { status: b.dataset.status }).then(function () { toast('Status: ' + b.dataset.status); route(); }).catch(faal);
        });
      });
      $$('[data-verwijder-bericht]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Dit bericht definitief verwijderen? (Back-ups worden na 30 dagen overschreven.)')) return;
          api('DELETE', 'berichten/' + b.dataset.verwijderBericht).then(function () { toast('Bericht verwijderd'); route(); }).catch(faal);
        });
      });
      $$('[data-wis-bestelling]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Naam, e-mail, telefoon, adres en opmerking van deze bestelling wissen? De bedragen blijven staan voor je administratie. Dit kan niet ongedaan worden.')) return;
          api('POST', 'bestellingen/' + b.dataset.wisBestelling + '/wis', {}).then(function () { toast('Persoonsgegevens gewist'); route(); }).catch(faal);
        });
      });
    });
  }
  SCHERMEN.bestellingen = function () { return lijstScherm('bestellingen', 'Bestellingen', 'Nieuwe bestellingen staan bovenaan. Zet de status bij als je de bestelling klaarzet of verstuurt. Bestellingen worden na 7 jaar automatisch verwijderd; vraagt een klant om verwijdering, wis dan de persoonsgegevens (de bedragen blijven voor je administratie).'); };
  SCHERMEN.berichten = function () { return lijstScherm('berichten', 'Berichten', 'Berichten uit het contactformulier. Ze worden na een jaar automatisch verwijderd; vraagt iemand eerder om verwijdering, gebruik dan de knop.'); };

  /* ---------- instellingen ---------- */
  SCHERMEN.instellingen = function () {
    return Promise.all([api('GET', 'overzicht'), api('GET', 'versies').catch(function () { return { items: [] }; }), api('GET', 'logboek').catch(function () { return { items: [] }; })]).then(function (r) {
      var moet = r[0].moetWijzigen;
      inhoud.innerHTML = kop('Instellingen') +
        (moet ? '<div class="melding">Kies eerst een eigen wachtwoord. Daarna kun je alles in het beheer gebruiken.</div>' : '') +
        '<form class="paneel" data-ww><h2>Wachtwoord wijzigen</h2><div class="velden">' +
        veld('Huidig wachtwoord', '<input type="password" name="huidig" autocomplete="current-password" required>') +
        veld('Nieuw wachtwoord', '<input type="password" name="nieuw" autocomplete="new-password" minlength="10" required>', 'Minstens 10 tekens. Een zin van een paar woorden werkt goed.') +
        veld('Nieuw wachtwoord nog een keer', '<input type="password" name="nogmaals" autocomplete="new-password" required>') +
        '</div><div class="knoppen"><button class="knop vol" type="submit">Wachtwoord opslaan</button></div></form>' +
        (moet ? '' :
        '<div class="paneel" data-tweestap><h2>Tweestapsverificatie</h2>' + (r[0].tweeStap
          ? '<p class="hulp">Staat aan. Bij het inloggen vraagt het beheer naast je wachtwoord om de code uit je authenticator-app.</p><form class="velden" data-2fa-uit>' + veld('Wachtwoord', '<input type="password" name="wachtwoord" autocomplete="current-password" required>') + veld('Code uit de app', '<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required>') + '<div class="veld" style="align-content:end"><button class="knop gevaar" type="submit">Uitzetten</button></div></form>'
          : '<p class="hulp">Een extra slot: naast je wachtwoord een code van 6 cijfers uit een app op je telefoon (Google Authenticator, Microsoft Authenticator of de wachtwoordapp van je iPhone). Zelfs met je wachtwoord kan dan niemand zonder je telefoon inloggen.</p><div data-2fa-stap><button class="knop vol" type="button" data-2fa-start>Tweestapsverificatie instellen</button></div>') + '</div>' +
        '<div class="paneel"><h2>Eerdere versies</h2><p class="hulp">Bij elke wijziging bewaart de site de vorige versie van de producten en de teksten (de laatste 40). Iets per ongeluk aangepast of verwijderd? Zet hier een versie terug.</p>' +
          (r[1].items.length ? '<ul class="logboek">' + r[1].items.slice(0, 30).map(function (v) { return '<li><span>' + (v.soort === 'producten' ? 'Producten' : 'Teksten, foto\'s, prijzen en SEO') + ' van ' + wanneer(v.tijd) + '</span><button class="knop klein" type="button" data-versie="' + esc(v.bestand) + '">Terugzetten</button></li>'; }).join('') + '</ul>' : '<p class="hulp">Nog geen eerdere versies.</p>') + '</div>' +
        '<div class="paneel"><h2>Logboek</h2><p class="hulp">Alles wat in het beheer is gedaan, ook inlogpogingen.</p><ul class="logboek">' + r[2].items.slice(0, 60).map(function (l) { return '<li><span>' + esc(l.actie) + '</span><time>' + wanneer(l.t) + '</time></li>'; }).join('') + '</ul></div>');
      $('[data-ww]').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target;
        if (f.nieuw.value !== f.nogmaals.value) return toast('De twee nieuwe wachtwoorden zijn niet gelijk.', true);
        api('POST', 'wachtwoord', { huidig: f.huidig.value, nieuw: f.nieuw.value }).then(function () { toast('Wachtwoord gewijzigd'); f.reset(); if (moet) location.hash = '#overzicht'; else route(); }).catch(faal);
      });
      var start = $('[data-2fa-start]');
      if (start) start.addEventListener('click', function () {
        api('POST', '2fa/start', {}).then(function (j) {
          var groepjes = j.geheim.match(/.{1,4}/g).join(' ');
          $('[data-2fa-stap]').innerHTML = '<ol class="hulp" style="padding-left:1.2rem;display:grid;gap:.4rem;color:var(--inkt)"><li>Installeer een authenticator-app op je telefoon.</li><li>Op je telefoon? Tik op <a href="' + esc(j.uri) + '">deze link</a>. Anders: kies in de app "Sleutel invoeren" en typ deze code over:<br><strong style="font-size:1.15rem;letter-spacing:.06em">' + esc(groepjes) + '</strong></li><li>Vul hieronder de code van 6 cijfers in die de app nu toont.</li></ol>' +
            '<form class="velden" data-2fa-aan style="margin-top:.8rem">' + veld('Code uit de app', '<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required>') + '<div class="veld" style="align-content:end"><button class="knop vol" type="submit">Aanzetten</button></div></form>';
          $('[data-2fa-aan]').addEventListener('submit', function (e) {
            e.preventDefault();
            api('POST', '2fa/aan', { code: e.target.code.value }).then(function () { toast('Tweestapsverificatie staat aan'); route(); }).catch(faal);
          });
        }).catch(faal);
      });
      var uit = $('[data-2fa-uit]');
      if (uit) uit.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!confirm('Tweestapsverificatie uitzetten? Je account is dan alleen nog met je wachtwoord beveiligd.')) return;
        api('POST', '2fa/uit', { wachtwoord: e.target.wachtwoord.value, code: e.target.code.value }).then(function () { toast('Tweestapsverificatie staat uit'); route(); }).catch(faal);
      });
      $$('[data-versie]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!confirm('Deze versie terugzetten? De huidige versie blijft ook bewaard, dus je kunt dit weer ongedaan maken.')) return;
          api('POST', 'versies/herstel', { bestand: b.dataset.versie }).then(function () { toast('Versie teruggezet'); route(); }).catch(faal);
        });
      });
    });
  };

  /* ---------- start ---------- */
  fetch('/api/beheer/sessie', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
    if (!j.ingelogd) return toonInlog();
    csrf = j.csrf; toonApp(j.moetWijzigen);
  }).catch(toonInlog);
})();
