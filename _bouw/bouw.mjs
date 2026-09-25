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

for (const bestand of fs.readdirSync(path.join(hier, 'paginas')).filter((f) => f.endsWith('.html'))) {
  const bron = fs.readFileSync(path.join(hier, 'paginas', bestand), 'utf8');
  const m = /<!--\s*meta\s*(\{[\s\S]*?\})\s*-->/.exec(bron);
  if (!m) { console.error('Geen meta in', bestand); continue; }
  const meta = JSON.parse(m[1]);
  const inhoud = bron.slice(m.index + m[0].length).trim();
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
${scripts}
</body>
</html>
`;
  fs.writeFileSync(path.join(root, meta.pad), html);
  console.log('geschreven:', meta.pad);
}
