/* Plannerpagina: voorportaal van de online reparatieplanner van CycleSoftware (twsc.nl).
   De planner zelf draait bij CycleSoftware. In een venster op de site loopt hij vast
   (hij heeft cookies nodig die browsers in een ingebouwd venster blokkeren), dus de knop
   opent hem apart: op een groot scherm in een eigen venster naast de site, op mobiel in een nieuw tabblad.
   Komt de bezoeker via planner.html?beurt=..., dan licht die beurt op. */
(function () {
  'use strict';
  var NAMEN = { controle: 'Controlebeurt', onderhoud: 'Onderhoudsbeurt', ebike: 'Onderhoudsbeurt e-bike' };
  var beurt = new URLSearchParams(location.search).get('beurt');
  if (NAMEN[beurt]) {
    var kaart = document.querySelector('[data-beurt="' + beurt + '"]');
    if (kaart) kaart.classList.add('gekozen');
    var regel = document.querySelector('[data-gekozen]');
    if (regel) { regel.textContent = 'Je koos: ' + NAMEN[beurt] + '. Kies die in de planner.'; regel.hidden = false; }
  }

  var knop = document.querySelector('[data-planner-open]');
  if (!knop) return;
  knop.addEventListener('click', function (e) {
    if (window.innerWidth < 900) return;            /* mobiel en tablet: gewoon een nieuw tabblad */
    var b = 560, h = Math.min(900, screen.availHeight - 80);
    var x = (screen.availLeft || 0) + Math.max(0, screen.availWidth - b - 60);
    var y = (screen.availTop || 0) + 40;
    var w = window.open(knop.href, 'cs-planner', 'popup=yes,width=' + b + ',height=' + h + ',left=' + x + ',top=' + y);
    if (w) { w.opener = null; e.preventDefault(); w.focus(); }   /* venster geblokkeerd? dan opent de link gewoon */
  });
})();
