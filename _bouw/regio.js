/* Regio's in een pagina die uit de catalogus komen. In de bron staat een plaatshouder
   (<!-- producten -->), in de gebouwde pagina een begin- en eindmarkering, zodat de server de
   inhoud opnieuw kan invullen als Jay in het beheer een product aanpast. */
'use strict';
const S = require('./sjabloon.js');

function regio(html, naam, inhoud) {
  const open = `<!-- ${naam}:start -->`, dicht = `<!-- ${naam}:einde -->`;
  const a = html.indexOf(open), b = html.indexOf(dicht);
  if (a !== -1 && b > a) return html.slice(0, a + open.length) + '\n' + inhoud + '\n' + html.slice(b);
  const plaats = `<!-- ${naam} -->`;
  if (html.includes(plaats)) return html.replace(plaats, open + '\n' + inhoud + '\n' + dicht);
  return html;
}
const heeft = (html, naam) => html.includes(`<!-- ${naam} -->`) || html.includes(`<!-- ${naam}:start -->`);

const uitgelicht = (cat) => cat.producten.filter((p) => p.uitgelicht).slice(0, 4);

function vulRegios(html, cat) {
  let h = html;
  const shop = heeft(h, 'producten');
  if (shop) h = regio(h, 'producten', cat.producten.map((p) => S.kaart(p, cat)).join('\n'));
  if (heeft(h, 'filters')) h = regio(h, 'filters', S.filterBalk(cat));
  if (heeft(h, 'uitgelicht')) h = regio(h, 'uitgelicht', uitgelicht(cat).map((p) => S.kaart(p, cat)).join('\n'));
  if (heeft(h, 'catalogus')) {
    const lijst = shop || !heeft(h, 'uitgelicht') ? cat : { ...cat, producten: uitgelicht(cat) };
    h = regio(h, 'catalogus', S.catalogusScript(lijst) + (shop ? '\n' + S.itemListLd(cat) : ''));
  }
  return h;
}

module.exports = { regio, vulRegios, uitgelicht };
