/* Bewerkmodus Cycle Service, powered by Mettafel. Alleen geladen als Jay is ingelogd en de pagina
   met ?bewerken=1 opent. Klik op een tekst om hem aan te passen, of op een foto om hem te vervangen. */
(function () {
  'use strict';
  var staat = JSON.parse(document.getElementById('cms-staat').textContent);
  var gewijzigd = { tekst: new Set(staat.teksten), beeld: new Set(staat.beelden) };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ENKEL = /^(H1|H2|H3|H4|A|SPAN|STRONG|SMALL|B|EM|LABEL|SUMMARY|DT|LI|DIV)$/;
  document.documentElement.classList.add('cms-aan');

  function api(methode, pad, body, ruw) {
    var o = { method: methode, headers: { 'X-CSRF': staat.csrf }, credentials: 'same-origin' };
    if (ruw) { o.body = ruw; o.headers['Content-Type'] = ruw.type; }
    else if (body !== undefined) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; }
    return fetch('/api/beheer/' + pad, o).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.fout || 'Opslaan lukte niet.'); return j; });
  }

  /* ---------- balk onderaan ---------- */
  var balk = document.createElement('div');
  balk.className = 'cms-balk';
  balk.innerHTML = '<span><b>Bewerkmodus</b> Klik op een tekst of foto om hem aan te passen.</span>' +
    '<a href="/' + (staat.pad === 'index.html' ? '' : staat.pad) + '" target="_blank" rel="noopener">Bekijk als bezoeker</a>' +
    '<a class="cms-vol" href="/beheer#teksten">Klaar</a>';
  document.body.appendChild(balk);
  var toast = document.createElement('div'); toast.className = 'cms-toast'; toast.hidden = true; toast.setAttribute('role', 'status'); document.body.appendChild(toast);
  var tt;
  function meld(t, fout) { toast.textContent = t; toast.classList.toggle('fout', !!fout); toast.hidden = false; clearTimeout(tt); tt = setTimeout(function () { toast.hidden = true; }, fout ? 5000 : 2200); }

  /* ---------- markeren ---------- */
  var teksten = [].slice.call(document.querySelectorAll('[data-cms]:not(img)'));
  teksten.forEach(function (el) {
    el.classList.add('cms-tekst');
    if (gewijzigd.tekst.has(el.dataset.cms)) el.classList.add('cms-gewijzigd');
    el.querySelectorAll('[data-dienst]').forEach(function (d) { d.setAttribute('contenteditable', 'false'); d.title = 'Prijs van de ' + (staat.diensten[d.dataset.dienst] || 'beurt') + ': pas je aan bij Prijzen in het beheer'; d.classList.add('cms-prijs'); });
  });
  /* alles wat verstopt of geanimeerd is gewoon tonen */
  document.querySelectorAll('[data-rev], [data-stagger] > *, [data-hero-item]').forEach(function (el) { el.classList.add('in'); });

  /* ---------- tekst bewerken ---------- */
  var actief = null, origineel = '', gereedschap = null;
  function maakGereedschap() {
    gereedschap = document.createElement('div');
    gereedschap.className = 'cms-gereedschap';
    gereedschap.innerHTML = '<button type="button" data-cmd="bold" title="Vet (Ctrl+B)"><b>B</b></button><button type="button" data-cmd="italic" title="Cursief (Ctrl+I)"><i>I</i></button>' +
      '<span class="cms-sep"></span><button type="button" class="cms-opslaan" data-actie="opslaan">Opslaan</button><button type="button" data-actie="annuleer">Annuleren</button><button type="button" data-actie="herstel" title="Terug naar de oorspronkelijke tekst">Origineel</button>';
    gereedschap.addEventListener('mousedown', function (e) { e.preventDefault(); });
    gereedschap.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cmd) { document.execCommand(b.dataset.cmd); return; }
      if (b.dataset.actie === 'opslaan') opslaan();
      if (b.dataset.actie === 'annuleer') stop(true);
      if (b.dataset.actie === 'herstel') herstel();
    });
    document.body.appendChild(gereedschap);
  }
  function plaats() {
    if (!actief || !gereedschap) return;
    var r = actief.getBoundingClientRect();
    var boven = r.top - gereedschap.offsetHeight - 10;
    gereedschap.style.top = (boven > 8 ? boven : r.bottom + 10) + 'px';
    gereedschap.style.left = Math.max(8, Math.min(window.innerWidth - gereedschap.offsetWidth - 8, r.left)) + 'px';
  }
  function start(el) {
    if (actief === el) return;
    if (actief) stop(false);
    actief = el; origineel = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.classList.add('cms-bezig');
    el.focus();
    var sel = window.getSelection(), r = document.createRange();
    r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
    if (!gereedschap) maakGereedschap();
    gereedschap.hidden = false;
    gereedschap.querySelector('[data-actie="herstel"]').hidden = !gewijzigd.tekst.has(el.dataset.cms);
    plaats();
  }
  function stop(terug) {
    if (!actief) return;
    if (terug) actief.innerHTML = origineel;
    actief.removeAttribute('contenteditable');
    actief.classList.remove('cms-bezig');
    actief = null;
    if (gereedschap) gereedschap.hidden = true;
  }
  function opslaan() {
    var el = actief; if (!el) return;
    if (el.innerHTML === origineel) { stop(false); return; }
    var knop = gereedschap.querySelector('.cms-opslaan'); knop.disabled = true;
    api('PUT', 'tekst/' + el.dataset.cms, { html: el.innerHTML }).then(function (j) {
      knop.disabled = false;
      el.innerHTML = j.html;
      el.querySelectorAll('[data-dienst]').forEach(function (d) { d.setAttribute('contenteditable', 'false'); d.classList.add('cms-prijs'); });
      gewijzigd.tekst.add(el.dataset.cms); el.classList.add('cms-gewijzigd');
      origineel = el.innerHTML; stop(false);
      meld('Opgeslagen. Staat meteen online.');
    }).catch(function (e) { knop.disabled = false; meld(e.message, true); });
  }
  function herstel() {
    var el = actief; if (!el || !confirm('De oorspronkelijke tekst terugzetten?')) return;
    api('DELETE', 'tekst/' + el.dataset.cms).then(function (j) {
      el.innerHTML = j.html; origineel = el.innerHTML; stop(false);
      gewijzigd.tekst.delete(el.dataset.cms); el.classList.remove('cms-gewijzigd');
      meld('Origineel teruggezet. Ververs de pagina voor de actuele prijzen.');
    }).catch(function (e) { meld(e.message, true); });
  }
  document.addEventListener('keydown', function (e) {
    if (!actief) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(true); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); opslaan(); }
    else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); }
    else if (e.key === 'Enter' && ENKEL.test(actief.tagName)) { e.preventDefault(); opslaan(); }
    else if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
  });
  /* plakken: alleen platte tekst, geen opmaak van Word of een website */
  document.addEventListener('paste', function (e) {
    if (!actief || !actief.contains(e.target)) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t.replace(/\s*\n\s*/g, ' '));
  });
  window.addEventListener('scroll', plaats, { passive: true });
  window.addEventListener('resize', plaats);

  /* ---------- foto's ---------- */
  var paneel = null;
  function fotoPaneel(img) {
    stop(false);
    if (paneel) paneel.remove();
    var k = img.dataset.cms;
    paneel = document.createElement('div');
    paneel.className = 'cms-paneel';
    paneel.setAttribute('role', 'dialog'); paneel.setAttribute('aria-modal', 'true'); paneel.setAttribute('aria-label', 'Foto aanpassen');
    paneel.innerHTML = '<div class="cms-paneel-binnen"><h2>Foto aanpassen</h2><img src="' + esc(img.currentSrc || img.src) + '" alt="" data-voorbeeld>' +
      '<label><span>Beschrijving (voor Google en schermlezers)</span><input type="text" maxlength="200" value="' + esc(img.alt) + '" data-alt></label>' +
      '<p class="cms-hulp">Kies een liggende foto van goede kwaliteit. Hij wordt automatisch verkleind en snel gemaakt.</p>' +
      '<div class="cms-knoppen"><button type="button" data-kies>Nieuwe foto kiezen</button><button type="button" class="cms-vol" data-bewaar>Opslaan</button><button type="button" data-sluit>Sluiten</button>' +
      (gewijzigd.beeld.has(k) ? '<button type="button" data-herstel-foto>Origineel terug</button>' : '') + '</div></div>';
    document.body.appendChild(paneel);
    var nieuw = null;
    var sluit = function () { paneel.remove(); paneel = null; };
    paneel.addEventListener('click', function (e) {
      if (e.target === paneel || e.target.closest('[data-sluit]')) return sluit();
      if (e.target.closest('[data-kies]')) {
        var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
        i.addEventListener('change', function () {
          if (!i.files[0]) return;
          var b = paneel.querySelector('[data-kies]'); b.disabled = true; b.textContent = 'Bezig met verkleinen...';
          window.CSFoto.upload(i.files[0], api).then(function (f) {
            nieuw = f; paneel.querySelector('[data-voorbeeld]').src = '/' + f.src;
            b.disabled = false; b.textContent = 'Andere foto kiezen';
          }).catch(function (err) { b.disabled = false; b.textContent = 'Nieuwe foto kiezen'; meld(err.message, true); });
        });
        i.click();
      }
      if (e.target.closest('[data-bewaar]')) {
        var body = { alt: paneel.querySelector('[data-alt]').value };
        if (nieuw) { body.src = nieuw.src; body.klein = nieuw.klein; body.breed = nieuw.breed; body.hoog = nieuw.hoog; }
        api('PUT', 'beeld/' + k, body).then(function (j) {
          img.removeAttribute('srcset');
          img.src = '/' + j.beeld.src; img.alt = j.beeld.alt;
          var bron = img.parentNode.tagName === 'PICTURE' ? img.parentNode.querySelectorAll('source') : [];
          [].forEach.call(bron, function (s) { s.srcset = '/' + (j.beeld.klein || j.beeld.src); });
          gewijzigd.beeld.add(k); sluit(); meld('Foto opgeslagen. Staat meteen online.');
        }).catch(function (err) { meld(err.message, true); });
      }
      if (e.target.closest('[data-herstel-foto]')) {
        if (!confirm('De oorspronkelijke foto terugzetten?')) return;
        api('DELETE', 'beeld/' + k).then(function () { gewijzigd.beeld.delete(k); sluit(); location.reload(); }).catch(function (err) { meld(err.message, true); });
      }
    });
    paneel.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluit(); });
    paneel.querySelector('[data-alt]').focus();
  }

  /* ---------- klikken: tekst of foto onder de muis zoeken, links niet volgen ---------- */
  function onder(x, y) {
    var stapel = document.elementsFromPoint(x, y);
    for (var i = 0; i < stapel.length; i++) {
      var el = stapel[i];
      if (el.closest('.cms-balk, .cms-gereedschap, .cms-paneel, .cms-toast')) return { ui: true };
      var t = el.closest('.cms-tekst');
      if (t) return { tekst: t };
      if (el.tagName === 'IMG' && el.dataset.cms) return { foto: el };
    }
    return {};
  }
  document.addEventListener('click', function (e) {
    var w = onder(e.clientX, e.clientY);
    if (w.ui) return;
    if (actief && actief.contains(e.target)) { e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation();
    if (w.tekst) start(w.tekst);
    else if (w.foto) fotoPaneel(w.foto);
    else if (actief) stop(false);
  }, true);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  /* foto onder de muis zichtbaar maken */
  var hover = null, bezig = false;
  document.addEventListener('mousemove', function (e) {
    if (bezig) return; bezig = true;
    requestAnimationFrame(function () {
      bezig = false;
      var w = onder(e.clientX, e.clientY);
      var nieuw = w.foto || null;
      if (nieuw !== hover) { if (hover) hover.classList.remove('cms-foto-hover'); hover = nieuw; if (hover) hover.classList.add('cms-foto-hover'); }
      document.documentElement.classList.toggle('cms-wijs', !!(w.foto || w.tekst));
    });
  });

  /* ---------- foto verkleinen (zelfde werkwijze als in het beheer) ---------- */
  window.CSFoto = {
    upload: function (bestand, api) {
      var laad = window.createImageBitmap ? createImageBitmap(bestand, { imageOrientation: 'from-image' }) : Promise.reject();
      return laad.catch(function () {
        return new Promise(function (ok, fout) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { fout(new Error('Deze foto kan ik niet openen. Probeer een JPG of PNG.')); }; im.src = URL.createObjectURL(bestand); });
      }).then(function (beeld) {
        var schaal = function (b) { var f = Math.min(1, b / beeld.width), c = document.createElement('canvas'); c.width = Math.round(beeld.width * f); c.height = Math.round(beeld.height * f); var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(beeld, 0, 0, c.width, c.height); return c; };
        var blob = function (c) { return new Promise(function (ok) { c.toBlob(function (b) { if (b && b.type === 'image/webp') return ok(b); c.toBlob(ok, 'image/jpeg', 0.85); }, 'image/webp', 0.82); }); };
        var g = schaal(1600), k = schaal(800);
        return Promise.all([blob(g), blob(k)]).then(function (b) {
          return api('POST', 'media?maat=1600', undefined, b[0]).then(function (x) {
            return api('POST', 'media?maat=800&groep=' + x.groep, undefined, b[1]).then(function (y) { return { src: x.pad, klein: y.pad, breed: g.width, hoog: g.height }; });
          });
        });
      });
    },
  };
})();
