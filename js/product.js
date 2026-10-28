/* Productpagina: wissel de grote foto met de miniaturen. */
(function () {
  'use strict';
  var hoofd = document.querySelector('[data-pf-hoofd]');
  var duimen = document.querySelectorAll('[data-foto]');
  if (!hoofd || !duimen.length) return;
  duimen.forEach(function (d) {
    d.addEventListener('click', function () {
      hoofd.src = d.dataset.foto;
      hoofd.alt = d.dataset.alt || '';
      duimen.forEach(function (x) { x.classList.toggle('actief', x === d); });
    });
  });
})();
