/* Geeft elke tekst en elke foto in de bronpagina's een vaste sleutel (data-cms), zodat Jay ze in het
   beheer kan aanpassen. Draai opnieuw na het toevoegen van nieuwe secties: bestaande sleutels blijven
   staan, nieuwe krijgen het volgende nummer.

     node _bouw/annoteer.mjs        daarna: node _bouw/bouw.mjs

   Een element dat alleen tekst en opmaak bevat (h2, p, li, ...) krijgt zelf de sleutel. Staat er een
   icoon naast de tekst (knoppen, bullets), dan komt de tekst in een <span data-cms="..."> te staan. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const H = require('./html.js');
const hier = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(hier, '..');

const BRONNEN = [
  ['kop', path.join(hier, 'kop.html')],
  ['voet', path.join(hier, 'voet.html')],
  ['home', path.join(root, 'index.html')],
  ...fs.readdirSync(path.join(hier, 'paginas')).filter((f) => f.endsWith('.html') && f !== 'afrekenen.html')
    .map((f) => [f.replace('.html', ''), path.join(hier, 'paginas', f)]),
];

const INLINE = new Set(['a', 'strong', 'b', 'em', 'i', 'mark', 'small', 'span', 'br', 'sup', 'sub', 'u', 'abbr', 'time', 's', 'code']);
const NOOIT = new Set(['script', 'style', 'svg', 'select', 'option', 'textarea', 'button', 'input', 'iframe', 'template', 'picture', 'video', 'noscript', 'head', 'title']);
const DYNAMISCH = ['data-filters', 'data-tel', 'data-jaar', 'data-openstatus-tekst', 'data-mand-teller', 'data-resultaat', 'data-gekozen', 'data-producten', 'data-overzicht', 'hidden'];

function overslaan(el) {
  if (NOOIT.has(el.tag)) return true;
  if (DYNAMISCH.some((a) => a in el.attrs)) return true;
  if (el.attrs['aria-hidden'] === 'true') return true;
  const k = ' ' + (el.attrs.class || '') + ' ';
  return / (fiets|sterren|merken|merk|scroll-balk|mand-teller) /.test(k);
}
const heeftTekst = (n) => H.tekstVan(n).replace(/\s+/g, '').length >= 2;
function zuiver(el) {
  for (const k of el.children) {
    if (k.comment != null) return false;
    if (k.text != null) continue;
    if (!INLINE.has(k.tag) || overslaan(k) || 'data-cms' in k.attrs) return false;
    if (!zuiver(k)) return false;
  }
  return true;
}

for (const [prefix, bestand] of BRONNEN) {
  const html = fs.readFileSync(bestand, 'utf8');
  const boom = H.lees(html);
  /* bereik dat we bewerken: op de homepage alleen <main>, en nooit de gegenereerde fietskaarten */
  let van = 0, tot = html.length;
  if (prefix === 'home') { van = html.indexOf('<main>'); tot = html.indexOf('</main>'); }
  const uitgesloten = [];
  const re = /<!-- uitgelicht:start -->[\s\S]*?<!-- uitgelicht:einde -->|<script[\s\S]*?<\/script>/g;
  let m;
  while ((m = re.exec(html))) uitgesloten.push([m.index, m.index + m[0].length]);
  const binnen = (n) => n.start >= van && n.end <= tot && !uitgesloten.some(([a, b]) => n.start < b && n.end > a);

  let hoogste = 0, hoogsteF = 0;
  for (const el of H.elementen(boom)) {
    const s = el.attrs['data-cms'];
    const mm = s && new RegExp('^' + prefix + '-(f?)(\\d+)$').exec(s);
    if (mm) { if (mm[1]) hoogsteF = Math.max(hoogsteF, +mm[2]); else hoogste = Math.max(hoogste, +mm[2]); }
  }
  const invoeg = [];   /* { pos, tekst } */
  const sleutel = () => `${prefix}-${++hoogste}`;
  const gedaan = new Set();
  const attr = (el, naam, waarde) => { gedaan.add(el); invoeg.push({ pos: el.start + 1 + el.tag.length, tekst: ` ${naam}="${waarde}"` }); };
  /* één blok met alleen losse knoppen of links zonder eigen tekst: elk kind apart, niet het blok als geheel */
  const losseDelen = (el) => !el.children.some((k) => k.text != null && k.text.trim()) && el.children.filter((k) => k.tag).length > 1;

  function bezoek(el) {
    if (el.tag !== '#wortel') {
      if (overslaan(el)) return;
      if (el.end <= van || el.start >= tot) return;
    }
    if ('data-cms' in el.attrs || gedaan.has(el)) return;
    if (el.tag === 'img') {
      if (!binnen(el) || /logo/.test(el.attrs.class || '')) return;
      let p = el.parent; while (p && p.tag !== '#wortel') { if (overslaan(p)) return; p = p.parent; }
      const k = `${prefix}-f${++hoogsteF}`;
      attr(el, 'data-cms', k);
      if (el.parent.tag === 'picture') for (const b of el.parent.children) if (b.tag === 'source') attr(b, 'data-cms-bron', k);
      return;
    }
    if (el.tag === 'picture') { for (const k of el.children) if (k.tag === 'img') bezoek(k); return; }
    if (el.tag !== '#wortel' && binnen(el) && zuiver(el) && heeftTekst(el) && !losseDelen(el)) { attr(el, 'data-cms', sleutel()); return; }

    /* gemengd: losse tekstreeksen naast iconen of blokken */
    if (el.tag !== '#wortel' && binnen(el)) {
      const reeksen = []; let r = [];
      for (const k of el.children) {
        const past = k.text != null || (k.tag && INLINE.has(k.tag) && !overslaan(k) && !('data-cms' in k.attrs) && zuiver(k));
        if (past) r.push(k); else { if (r.length) reeksen.push(r); r = []; }
      }
      if (r.length) reeksen.push(r);
      for (let reeks of reeksen) {
        while (reeks.length && reeks[0].text != null && !reeks[0].text.trim()) reeks = reeks.slice(1);
        while (reeks.length && reeks.at(-1).text != null && !reeks.at(-1).text.trim()) reeks = reeks.slice(0, -1);
        if (!reeks.length || !reeks.some(heeftTekst)) continue;
        if (reeks.length === 1 && reeks[0].tag) { if (!losseDelen(reeks[0])) attr(reeks[0], 'data-cms', sleutel()); continue; }
        if (!reeks.some((k) => k.text != null && k.text.trim())) continue;   /* alleen losse elementen: die krijgen elk een eigen sleutel */
        let start = reeks[0].start, eind = reeks.at(-1).end;
        /* spatie aan het begin of eind blijft buiten de span */
        if (reeks[0].text != null) start += reeks[0].text.length - reeks[0].text.trimStart().length;
        if (reeks.at(-1).text != null) eind -= reeks.at(-1).text.length - reeks.at(-1).text.trimEnd().length;
        const k = sleutel();
        invoeg.push({ pos: start, tekst: `<span data-cms="${k}">` }, { pos: eind, tekst: '</span>', sluit: true });
      }
    }
    for (const k of el.children) if (k.tag) bezoek(k);
  }
  bezoek(boom);

  if (!invoeg.length) { console.log(prefix + ': niets nieuws'); continue; }
  /* van achter naar voren invoegen; bij gelijke positie eerst sluiten, dan openen */
  invoeg.sort((a, b) => b.pos - a.pos || (a.sluit ? 1 : 0) - (b.sluit ? 1 : 0));
  let uit = html;
  for (const x of invoeg) uit = uit.slice(0, x.pos) + x.tekst + uit.slice(x.pos);
  fs.writeFileSync(bestand, uit);
  console.log(`${prefix}: ${invoeg.filter((x) => !x.sluit).length} sleutels erbij (tot ${prefix}-${hoogste}, foto's tot ${prefix}-f${hoogsteF})`);
}
