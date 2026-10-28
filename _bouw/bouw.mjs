/* Bouwt de statische site: subpagina's uit _bouw/paginas/*.html plus de gedeelde kop en voet,
   een eigen pagina per product (shop-<id>.html), de regio's op de homepage en de sitemap.
   Gebruik: node _bouw/bouw.mjs

   Elke paginabron begint met <!-- meta {"titel": "...", "omschrijving": "...", "pad": "x.html", "scripts": [...]} -->.
   {prijs:controle} in titel of omschrijving wordt de prijs van die beurt.
   De server (server.js) maakt dezelfde pagina's met de wijzigingen uit het beheer erin; deze bouwstap is
   de basis en de versie voor een host zonder server (GitHub Pages). */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const S = require('./sjabloon.js');
const R = require('./regio.js');
const hier = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(hier, '..');
const kop = fs.readFileSync(path.join(hier, 'kop.html'), 'utf8');
const voet = fs.readFileSync(path.join(hier, 'voet.html'), 'utf8');
const cat = JSON.parse(fs.readFileSync(path.join(hier, 'producten.json'), 'utf8'));
const vandaag = new Date().toISOString().slice(0, 10);

/* ---------- subpagina's ---------- */
for (const bestand of fs.readdirSync(path.join(hier, 'paginas')).filter((f) => f.endsWith('.html'))) {
  const bron = fs.readFileSync(path.join(hier, 'paginas', bestand), 'utf8');
  const m = /<!--\s*meta\s*(\{[\s\S]*?\})\s*-->/.exec(bron);
  if (!m) { console.error('Geen meta in', bestand); continue; }
  const meta = JSON.parse(m[1]);
  const inhoud = R.vulRegios(bron.slice(m.index + m[0].length).trim(), cat);
  const head = S.kruimelLd([['Home', ''], [meta.kruimel || meta.titel.split('|')[0].trim(), meta.pad]]) + (meta.head ? '\n' + meta.head : '');
  const html = S.pagina({
    titel: S.vulTokens(meta.titel), omschrijving: S.vulTokens(meta.omschrijving), ogTitel: meta.ogTitel && S.vulTokens(meta.ogTitel),
    pad: meta.pad, robots: meta.robots, head, kop, voet, inhoud, scripts: meta.scripts,
  });
  fs.writeFileSync(path.join(root, meta.pad), html);
  console.log('geschreven:', meta.pad);
}

/* ---------- productpagina's ---------- */
const nu = new Set();
for (const p of cat.producten) {
  const { pad, html } = S.productPagina(p, cat, { kop, voet, winkel: { verzenden: { gratisVanaf: 100 } } });
  fs.writeFileSync(path.join(root, pad), html);
  nu.add(pad);
}
for (const f of fs.readdirSync(root)) if (/^shop-.+\.html$/.test(f) && !nu.has(f)) { fs.unlinkSync(path.join(root, f)); console.log('verwijderd:', f); }
console.log(`productpagina's: ${nu.size}`);

/* ---------- homepage: kop, voet, uitgelichte fietsen en catalogus uit dezelfde bronnen ---------- */
{
  const f = path.join(root, 'index.html');
  let h = fs.readFileSync(f, 'utf8');
  if (!h.includes('<!-- kop:start -->')) {
    h = h.replace(/<div class="scroll-balk"[\s\S]*?(?=<main>)/, '<!-- kop:start -->\n<!-- kop:einde -->\n');
    h = h.replace(/(<\/main>\s*)[\s\S]*?(?=<script src="js\/motion\.js")/, '$1<!-- voet:start -->\n<!-- voet:einde -->\n');
  }
  h = R.regio(h, 'kop', S.markeerMenu(kop, 'index.html'));
  h = R.regio(h, 'voet', voet);
  h = R.vulRegios(h, cat);
  fs.writeFileSync(f, h);
  console.log('homepage: kop, voet, uitgelichte fietsen en catalogus bijgewerkt');
}

/* ---------- sitemap ---------- */
fs.writeFileSync(path.join(root, 'sitemap.xml'), S.sitemap(S.PAGINAS, cat, vandaag));
console.log('sitemap.xml: ' + (S.PAGINAS.length + cat.producten.length) + ' adressen');
