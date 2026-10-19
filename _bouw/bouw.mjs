/* Bouwt de subpagina's uit _bouw/paginas/*.html plus de gedeelde kop en voet.
   Gebruik: node _bouw/bouw.mjs   (index.html blijft handgeschreven)
   Elke paginabron begint met <!-- meta {"titel": "...", "omschrijving": "...", "pad": "x.html", "scripts": ["js/planner.js"], "actief": "werkplaats.html", "og": "..."} --> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(hier, '..');
const kop = fs.readFileSync(path.join(hier, 'kop.html'), 'utf8');
const voet = fs.readFileSync(path.join(hier, 'voet.html'), 'utf8');
const BASIS = 'https://www.cycle-service.nl/';

/* ---------- webshop: catalogus, kaarten en filters uit _bouw/producten.json ---------- */
const catalogus = JSON.parse(fs.readFileSync(path.join(hier, 'producten.json'), 'utf8'));
const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prijsTekst = (n) => '€ ' + Number(n).toLocaleString('nl-NL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="assets/iconen.svg#i-${n}"/></svg>`;
const catPer = Object.fromEntries(catalogus.categorieen.map((c) => [c.id, c]));
const STAAT = { occasion: 'Occasion', demo: 'Demo' };

function kaart(p) {
  const cat = catPer[p.categorie] || { naam: p.categorie, icoon: 'fiets' };
  const wa = (t) => 'https://wa.me/31628828966?text=' + encodeURIComponent(t);
  const beeld = p.foto
    ? `<img src="assets/img/${esc(p.foto)}" width="800" height="600" alt="${esc(p.alt || p.merk + ' ' + p.naam)}" loading="lazy">`
    : `<span class="foto-volgt" title="Foto volgt">${ico('tas')}<span>Foto volgt</span></span>`;
  /* varianten: alleen leverbare waarden staan in producten.json; één waarde = vaste tekst, meer = keuzemenu */
  const opties = p.voorraad && p.opties ? `
          <div class="opties">${p.opties.map((o, i) => o.waarden.length > 1
            ? `<label class="optie"><span>${esc(o.naam)}</span><select data-optie="${i}">${o.waarden.map((w) => `<option>${esc(w)}</option>`).join('')}</select></label>`
            : `<p class="optie optie-vast"><span>${esc(o.naam)}</span><strong>${esc(o.waarden[0])}</strong></p>`).join('')}</div>` : '';
  const label = !p.voorraad ? '<span class="staat-label">Op bestelling</span>' : STAAT[p.staat] ? `<span class="staat-label">${STAAT[p.staat]}</span>` : '';
  const actie = p.voorraad
    ? `<a class="knop knop-vol knop-klein" href="${wa(`Hoi Jay, ik wil graag de ${p.merk} ${p.naam}${p.maat ? ' (' + p.maat + ')' : ''} bestellen.`)}" target="_blank" rel="noopener" data-in-mand="${esc(p.id)}">${ico('tas')}<span data-label>In winkelwagen</span></a>`
    : `<a class="knop knop-lijn knop-klein" href="${wa(`Hoi Jay, wat is de levertijd van de ${p.merk} ${p.naam}?`)}" target="_blank" rel="noopener">${ico('whatsapp')}<span>Vraag naar levertijd</span></a>`;
  return `      <article class="fiets rand" id="p-${esc(p.id)}" data-categorie="${esc(p.categorie)}" data-merk="${esc(p.merk)}" data-staat="${esc(p.staat)}" data-prijs="${p.prijs}" data-voorraad="${p.voorraad ? 1 : 0}">
        <div class="beeld">${beeld}${label}</div>
        <div class="inhoud">
          <span class="merknaam">${esc(p.merk)}</span>
          <h3>${esc(p.naam)}</h3>
          <p class="spec">${esc(p.spec)}</p>
${opties}
        </div>
        <div class="kaartvoet">
          <div class="voetrij"><span class="type">${ico(cat.icoon)} ${esc(cat.naam.replace(/fietsen$|bikes$/, (m) => m))}${p.maat ? ' · ' + esc(p.maat) : ''}${p.levering === 'verzenden' && p.voorraad ? ' · gratis verzonden' : ''}</span><span class="prijs">${prijsTekst(p.prijs)}</span></div>
          ${actie}
        </div>
      </article>`;
}
function filterBalk() {
  const tel = (id) => catalogus.producten.filter((p) => p.categorie === id).length;
  const chips = [`<button type="button" class="filterchip actief" data-cat="alles" aria-pressed="true">Alles <span>${catalogus.producten.length}</span></button>`]
    .concat(catalogus.categorieen.filter((c) => tel(c.id)).map((c) => `<button type="button" class="filterchip" data-cat="${c.id}" aria-pressed="false">${ico(c.icoon)}${esc(c.naam)} <span>${tel(c.id)}</span></button>`));
  const merken = [...new Set(catalogus.producten.map((p) => p.merk))].sort();
  return `<div class="filters" data-filters hidden>
      <div class="filter-cats" role="group" aria-label="Kies een categorie">${chips.join('')}</div>
      <div class="filter-rest">
        <label class="filterveld"><span>Merk</span><select data-merk><option value="">Alle merken</option>${merken.map((m) => `<option>${esc(m)}</option>`).join('')}</select></label>
        <label class="filterveld"><span>Staat</span><select data-soort><option value="">Nieuw en gebruikt</option><option value="nieuw">Alleen nieuw</option><option value="gebruikt">Occasion en demo</option></select></label>
        <label class="filterveld"><span>Sorteren</span><select data-sort><option value="">Aanbevolen</option><option value="op">Prijs laag naar hoog</option><option value="af">Prijs hoog naar laag</option></select></label>
        <label class="schakel"><input type="checkbox" data-voorraad><span>Alleen op voorraad</span></label>
        <p class="resultaat" data-resultaat aria-live="polite"></p>
      </div>
    </div>`;
}
const catalogusScript = `<script type="application/json" id="catalogus">${JSON.stringify({ producten: catalogus.producten.map(({ id, merk, naam, maat, prijs, voorraad, foto, categorie, levering, opties }) => ({ id, merk, naam, maat, prijs, voorraad, foto, categorie, levering, opties })) })}</script>`;

for (const bestand of fs.readdirSync(path.join(hier, 'paginas')).filter((f) => f.endsWith('.html'))) {
  const bron = fs.readFileSync(path.join(hier, 'paginas', bestand), 'utf8');
  const m = /<!--\s*meta\s*(\{[\s\S]*?\})\s*-->/.exec(bron);
  if (!m) { console.error('Geen meta in', bestand); continue; }
  const meta = JSON.parse(m[1]);
  const inhoud = bron.slice(m.index + m[0].length).trim()
    .replace('<!-- producten -->', catalogus.producten.map(kaart).join('\n'))
    .replace('<!-- filters -->', filterBalk())
    + (meta.catalogus ? '\n' + catalogusScript : '');
  let kopHtml = kop.replace(/<a class="streep" href="([^"]+)">/g, (t, href) => href === meta.pad ? `<a class="streep" href="${href}" aria-current="page">` : t);
  kopHtml = kopHtml.replace('<a href="index.html" aria-current="page">Home</a>', '<a href="index.html">Home</a>')
    .replace(`<a href="${meta.pad}">`, `<a href="${meta.pad}" aria-current="page">`);
  const kruimel = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: BASIS }, { '@type': 'ListItem', position: 2, name: meta.kruimel || meta.titel.split('|')[0].trim(), item: BASIS + meta.pad }] })}</script>`;
  const extraHead = kruimel + (meta.head || '');
  const scripts = (meta.scripts || []).map((s) => `<script src="${s}" defer></script>`).join('\n');
  const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${meta.titel}</title>
  <meta name="description" content="${meta.omschrijving}">
  <link rel="canonical" href="${BASIS}${meta.pad}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${meta.ogTitel || meta.titel}">
  <meta property="og:description" content="${meta.omschrijving}">
  <meta property="og:url" content="${BASIS}${meta.pad}">
  <meta property="og:image" content="${BASIS}assets/img/og.jpg">
  <meta property="og:locale" content="nl_NL">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="preload" href="assets/fonts/big-shoulders-display.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/motion.css">
${extraHead}
</head>
<body>

${kopHtml}<main>
${inhoud}
</main>

${voet}<script src="js/motion.js" defer></script>
<script src="js/main.js" defer></script>
<script src="js/winkel.js" defer></script>
${scripts}
</body>
</html>
`;
  fs.writeFileSync(path.join(root, meta.pad), html);
  console.log('geschreven:', meta.pad);
}

/* homepage: de uitgelichte fietsen en de catalogus komen uit dezelfde bron als de shop */
const UITGELICHT = ['mondraker-arid-carbon-r-m', 'berria-belador-pro-57', 'superior-iblox-63-l', 'scott-addict-rc-30-54'];
{
  const f = path.join(root, 'index.html');
  let h = fs.readFileSync(f, 'utf8');
  const kaarten = UITGELICHT.map((id) => catalogus.producten.find((p) => p.id === id)).filter(Boolean).map(kaart).join('\n');
  h = h.replace(/<!-- uitgelicht:start -->[\s\S]*?<!-- uitgelicht:einde -->/, `<!-- uitgelicht:start -->\n${kaarten}\n<!-- uitgelicht:einde -->`);
  h = h.replace(/<!-- catalogus -->(\s*<script type="application\/json" id="catalogus">.*?<\/script>)?/s, '<!-- catalogus -->\n' + catalogusScript);
  fs.writeFileSync(f, h);
  console.log('homepage: uitgelichte fietsen en catalogus bijgewerkt');
}
