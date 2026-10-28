/* Gedeelde bouwstenen voor de bouwstap (bouw.mjs) en de server (server.js): paginaschil, fietskaarten,
   productpagina's, filters, structured data en de sitemap. Zo zien de statische versie en de versie
   die de server met de wijzigingen uit het beheer maakt er precies hetzelfde uit. */
'use strict';

const BASIS = 'https://www.cycle-service.nl/';
const WA = '31628828966';

/* de drie vaste beurten; prijs en duur zijn in het beheer aan te passen */
const DIENSTEN = {
  controle: { naam: 'Controlebeurt race, MTB of gravel', kort: 'Controlebeurt', prijs: 69, duur: 75 },
  onderhoud: { naam: 'Onderhoudsbeurt race, MTB of gravel', kort: 'Onderhoudsbeurt', prijs: 159, duur: 180 },
  ebike: { naam: 'Onderhoudsbeurt e-bike', kort: 'Onderhoudsbeurt e-bike', prijs: 85, duur: 90 },
};

const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const getal = (n) => Number(n).toLocaleString('nl-NL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const prijsTekst = (n) => '€ ' + getal(n);
const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="assets/iconen.svg#i-${n}"/></svg>`;
/* een foto is een bestandsnaam in assets/img (de oorspronkelijke set) of een pad zoals media/abc-800.webp (geüpload) */
const fotoUrl = (f) => (!f ? '' : f.includes('/') ? f : 'assets/img/' + f);
const grootUrl = (p) => fotoUrl(p.fotoGroot || p.foto);
const productPad = (p) => `shop-${p.id}.html`;
const STAAT = { occasion: 'Occasion', demo: 'Demo' };
const wa = (t) => `https://wa.me/${WA}?text=` + encodeURIComponent(t);
/* inkorten op een woordgrens, voor titels en omschrijvingen in Google */
const kort = (t, max) => (t.length <= max ? t : t.slice(0, max - 1).replace(/[\s,.;:]+\S*$/, '') + '…');
const vulTokens = (s, diensten = DIENSTEN) => String(s || '').replace(/\{prijs:([a-z]+)\}/g, (m, k) => (diensten[k] ? getal(diensten[k].prijs) : m));

function categorie(cat, id) { return (cat.categorieen.find((c) => c.id === id)) || { id, naam: id, icoon: 'fiets' }; }

/* ---------- fietskaart (shop, homepage, gerelateerd) ---------- */
function kaart(p, cat) {
  const c = categorie(cat, p.categorie);
  const link = productPad(p);
  const beeld = p.foto
    ? `<a href="${link}" tabindex="-1" aria-hidden="true"><img src="${esc(fotoUrl(p.foto))}" width="800" height="600" alt="${esc(p.alt || p.merk + ' ' + p.naam)}" loading="lazy" decoding="async"></a>`
    : `<span class="foto-volgt" title="Foto volgt">${ico('tas')}<span>Foto volgt</span></span>`;
  const label = !p.voorraad ? '<span class="staat-label">Op bestelling</span>' : STAAT[p.staat] ? `<span class="staat-label">${STAAT[p.staat]}</span>` : '';
  return `      <article class="fiets rand" id="p-${esc(p.id)}" data-categorie="${esc(p.categorie)}" data-merk="${esc(p.merk)}" data-staat="${esc(p.staat)}" data-prijs="${Number(p.prijs)}" data-voorraad="${p.voorraad ? 1 : 0}">
        <div class="beeld">${beeld}${label}</div>
        <div class="inhoud">
          <span class="merknaam">${esc(p.merk)}</span>
          <h3><a class="kaartlink" href="${link}">${esc(p.naam)}</a></h3>
          <p class="spec">${esc(p.intro)}</p>
          <ul class="kenmerken">${(p.kenmerken || []).map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
${opties(p)}
        </div>
        <div class="kaartvoet">
          <div class="voetrij"><span class="type">${ico(c.icoon)} ${esc(c.naam)}${p.maat ? ' · ' + esc(p.maat) : ''}${p.levering === 'verzenden' && p.voorraad ? ' · gratis verzonden' : ''}</span><span class="prijs">${prijsTekst(p.prijs)}</span></div>
          ${actie(p)}
        </div>
      </article>`;
}
/* varianten: alleen leverbare waarden; één waarde = vaste tekst, meer = keuzemenu */
function opties(p) {
  if (!p.voorraad || !p.opties || !p.opties.length) return '';
  return `          <div class="opties">${p.opties.map((o, i) => o.waarden.length > 1
    ? `<label class="optie"><span>${esc(o.naam)}</span><select data-optie="${i}">${o.waarden.map((w) => `<option>${esc(w)}</option>`).join('')}</select></label>`
    : `<p class="optie optie-vast"><span>${esc(o.naam)}</span><strong>${esc(o.waarden[0])}</strong></p>`).join('')}</div>`;
}
function actie(p, groot) {
  const k = groot ? '' : ' knop-klein';
  return p.voorraad
    ? `<a class="knop knop-vol${k}" href="${wa(`Hoi Jay, ik wil graag de ${p.merk} ${p.naam}${p.maat ? ' (' + p.maat + ')' : ''} bestellen.`)}" target="_blank" rel="noopener" data-in-mand="${esc(p.id)}">${ico('tas')}<span data-label>In winkelwagen</span></a>`
    : `<a class="knop knop-lijn${k}" href="${wa(`Hoi Jay, wat is de levertijd van de ${p.merk} ${p.naam}?`)}" target="_blank" rel="noopener">${ico('whatsapp')}<span>Vraag naar levertijd</span></a>`;
}

function filterBalk(cat) {
  const tel = (id) => cat.producten.filter((p) => p.categorie === id).length;
  const chips = [`<button type="button" class="filterchip actief" data-cat="alles" aria-pressed="true">Alles <span>${cat.producten.length}</span></button>`]
    .concat(cat.categorieen.filter((c) => tel(c.id)).map((c) => `<button type="button" class="filterchip" data-cat="${esc(c.id)}" aria-pressed="false">${ico(c.icoon)}${esc(c.naam)} <span>${tel(c.id)}</span></button>`));
  const merken = [...new Set(cat.producten.map((p) => p.merk))].sort();
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
const ldScript = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
function catalogusScript(cat) {
  const lijst = cat.producten.map(({ id, merk, naam, maat, prijs, voorraad, foto, categorie: c, levering, opties: o }) => ({ id, merk, naam, maat, prijs, voorraad, foto: fotoUrl(foto), categorie: c, levering, opties: o }));
  return `<script type="application/json" id="catalogus">${JSON.stringify({ producten: lijst }).replace(/</g, '\\u003c')}</script>`;
}
function itemListLd(cat) {
  return ldScript({ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Fietsen en onderdelen van Cycle Service', itemListElement: cat.producten.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: BASIS + productPad(p), name: `${p.merk} ${p.naam}` })) });
}

/* ---------- structured data voor één product ---------- */
function productLd(p, cat, winkel) {
  const c = categorie(cat, p.categorie);
  const v = (winkel && winkel.verzenden) || { gratisVanaf: 100 };
  const verzendbaar = p.levering === 'verzenden';
  const aanbod = {
    '@type': 'Offer', url: BASIS + productPad(p), priceCurrency: 'EUR', price: Number(p.prijs).toFixed(2),
    availability: p.voorraad ? 'https://schema.org/InStock' : 'https://schema.org/BackOrder',
    itemCondition: p.staat === 'nieuw' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    seller: { '@type': 'Organization', name: 'Cycle Service' },
    hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', applicableCountry: 'NL', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 14, returnMethod: 'https://schema.org/ReturnByMail', returnFees: 'https://schema.org/ReturnShippingFees' },
  };
  if (verzendbaar && v.gratisVanaf != null && p.prijs >= v.gratisVanaf) {
    aanbod.shippingDetails = { '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'EUR' }, shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'NL' }, deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' }, transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 4, unitCode: 'DAY' } } };
  } else if (!verzendbaar) {
    aanbod.availableDeliveryMethod = 'http://purl.org/goodrelations/v1#DeliveryModePickUp';
  }
  const fotos = [p.fotoGroot || p.foto, ...(p.fotos || [])].filter(Boolean).map((f) => BASIS + fotoUrl(f));
  const o = {
    '@context': 'https://schema.org', '@type': 'Product', name: `${p.merk} ${p.naam}${p.maat ? ' ' + p.maat : ''}`, sku: p.id,
    brand: { '@type': 'Brand', name: p.merk }, category: c.naam,
    description: beschrijving(p), image: fotos.length ? fotos : undefined, offers: aanbod,
  };
  if (p.ean) o.gtin = String(p.ean);
  return ldScript(o);
}
const beschrijving = (p) => p.seoOmschrijving || [p.intro, (p.kenmerken || []).join(', ')].filter(Boolean).join(' ');
function kruimelLd(stappen) {
  return ldScript({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: stappen.map(([naam, pad], i) => ({ '@type': 'ListItem', position: i + 1, name: naam, item: BASIS + pad })) });
}

/* ---------- paginaschil ---------- */
function markeerMenu(kop, pad) {
  let k = kop.replace(/ aria-current="page"/g, '');
  k = k.replace(/(<a\b[^>]*?href=")([^"#?]+)("[^>]*>)/g, (t, a, href, b) => (href === pad ? `${a}${href}" aria-current="page${b.slice(0)}` : t));
  return k;
}
function pagina(o) {
  const titel = esc(o.titel), omschrijving = esc(o.omschrijving);
  const url = BASIS + (o.pad === 'index.html' ? '' : o.pad);
  const beeld = o.ogBeeld ? BASIS + o.ogBeeld : BASIS + 'assets/img/og.jpg';
  const scripts = ['js/motion.js', 'js/main.js', 'js/winkel.js', ...(o.scripts || [])].map((s) => `<script src="${s}" defer></script>`).join('\n');
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${titel}</title>
  <meta name="description" content="${omschrijving}">
  <meta name="robots" content="${o.robots || 'index, follow, max-image-preview:large'}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${o.ogType || 'website'}">
  <meta property="og:site_name" content="Cycle Service Sint-Oedenrode">
  <meta property="og:title" content="${esc(o.ogTitel || o.titel)}">
  <meta property="og:description" content="${omschrijving}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${esc(beeld)}">
  <meta property="og:locale" content="nl_NL">
${o.ogExtra || ''}  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0b1730">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <link rel="preload" href="assets/fonts/big-shoulders-display.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
${o.preload || ''}  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/motion.css">
${o.head || ''}
</head>
<body>

<!-- kop:start -->
${markeerMenu(o.kop, o.pad)}<!-- kop:einde -->
<main>
${o.inhoud}
</main>

<!-- voet:start -->
${o.voet}<!-- voet:einde -->
${scripts}
</body>
</html>
`;
}

/* ---------- productpagina ---------- */
function productPagina(p, cat, delen) {
  const c = categorie(cat, p.categorie);
  const naam = `${p.merk} ${p.naam}`;
  const titel = p.seoTitel || kort(`${naam}${p.maat ? ' ' + p.maat : ''}`, 44) + ' | Cycle Service';
  const omschrijving = p.seoOmschrijving || kort(`${naam}${p.maat ? ', ' + p.maat : ''} voor ${prijsTekst(p.prijs)}. ${p.intro || ''} ${p.voorraad ? 'Op voorraad' : 'Op bestelling'} in Sint-Oedenrode${p.levering === 'verzenden' ? ', gratis verzonden' : ', rijklaar afgesteld'}.`.replace(/\s+/g, ' ').trim(), 155);
  const fotos = [{ klein: p.foto, groot: p.fotoGroot || p.foto, alt: p.alt || naam }, ...(p.fotos || []).map((f, i) => ({ klein: f, groot: f, alt: `${naam}, foto ${i + 2}` }))].filter((f) => f.klein);
  const hoofd = fotos[0];
  const galerij = fotos.length > 1 ? `<div class="pf-duimen" role="list">${fotos.map((f, i) => `<button type="button" role="listitem" class="pf-duim${i ? '' : ' actief'}" data-foto="${esc(fotoUrl(f.groot))}" data-alt="${esc(f.alt)}" aria-label="Toon foto ${i + 1}"><img src="${esc(fotoUrl(f.klein))}" alt="" width="120" height="90" loading="lazy" decoding="async"></button>`).join('')}</div>` : '';
  const gerelateerd = cat.producten.filter((x) => x.id !== p.id && x.categorie === p.categorie).slice(0, 3);
  const extra = gerelateerd.length < 3 ? cat.producten.filter((x) => x.id !== p.id && x.categorie !== p.categorie && x.voorraad).slice(0, 3 - gerelateerd.length) : [];
  const omschrijvingHtml = String(p.omschrijving || '').split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean).map((a) => `<p>${esc(a).replace(/\n/g, '<br>')}</p>`).join('\n');
  const usp = [
    p.categorie === 'onderdelen' ? ['truck', p.levering === 'verzenden' ? 'Gratis verzonden binnen Nederland, 1 tot 4 werkdagen' : 'Af te halen in de winkel'] : ['sleutel', 'Rijklaar afgesteld door Jay, op te halen in de winkel'],
    ['schild', p.staat === 'nieuw' ? '14 dagen bedenktijd en wettelijke garantie' : '14 dagen bedenktijd, minimaal een jaar wettelijke garantie'],
    ['uitleg', 'Eerst advies of een maatcheck? Bel of app Jay'],
  ];
  const inhoud = `<section class="pagina-kop compact product-kop" aria-label="Kruimelpad">
  <div class="wrap">
    <nav class="kruimel" aria-label="Kruimelpad"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="fietsen.html">Shop</a><span aria-hidden="true">/</span><a href="fietsen.html#${esc(p.categorie)}">${esc(c.naam)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.naam)}</span></nav>
  </div>
</section>

<section class="sectie product" aria-label="${esc(naam)}">
  <div class="wrap product-raster" data-product="${esc(p.id)}">
    <div class="pf">
      <div class="pf-hoofd rand">${hoofd ? `<img data-pf-hoofd src="${esc(fotoUrl(hoofd.groot))}" width="1200" height="900" alt="${esc(hoofd.alt)}" fetchpriority="high" decoding="async">` : `<span class="foto-volgt">${ico('tas')}<span>Foto volgt</span></span>`}${!p.voorraad ? '<span class="staat-label">Op bestelling</span>' : STAAT[p.staat] ? `<span class="staat-label">${STAAT[p.staat]}</span>` : ''}</div>
      ${galerij}
    </div>
    <div class="pi">
      <span class="merknaam">${esc(p.merk)}</span>
      <h1>${esc(p.naam)}</h1>
      <p class="pi-sub">${ico(c.icoon)} ${esc(c.naam)}${p.maat ? ' · ' + esc(p.maat) : ''}${STAAT[p.staat] ? ' · ' + STAAT[p.staat] : ''}</p>
      <p class="pi-prijs"><strong>${prijsTekst(p.prijs)}</strong><span>inclusief btw</span></p>
      <p class="pi-voorraad ${p.voorraad ? 'ja' : 'nee'}"><span class="stip" aria-hidden="true"></span>${p.voorraad ? 'Op voorraad in Sint-Oedenrode' : 'Op bestelling, vraag Jay naar de levertijd'}</p>
      <p class="pi-intro">${esc(p.intro)}</p>
${opties(p)}
      <div class="pi-knoppen">${actie(p, true)}<a class="knop knop-lijn" href="${wa(`Hoi Jay, ik heb een vraag over de ${naam}${p.maat ? ' (' + p.maat + ')' : ''}.`)}" target="_blank" rel="noopener">${ico('whatsapp')}<span>Stel een vraag</span></a></div>
      <ul class="bullets badges pi-usp">${usp.map(([i, t]) => `<li><span class="bol">${ico(i)}</span><span>${esc(t)}</span></li>`).join('')}</ul>
      ${(p.kenmerken || []).length ? `<div class="pi-specs"><h2>Specificaties</h2><ul class="kenmerken">${p.kenmerken.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}
    </div>
  </div>
</section>
${omschrijvingHtml ? `
<section class="sectie licht2" aria-label="Over deze ${p.categorie === 'onderdelen' ? 'onderdeel' : 'fiets'}">
  <div class="wrap smal product-tekst">
    <h2>Over de ${esc(naam)}</h2>
    ${omschrijvingHtml}
  </div>
</section>` : ''}
${gerelateerd.concat(extra).length ? `
<section class="sectie" aria-label="Ook interessant">
  <div class="wrap">
    <div class="sectiekop"><h2>Ook interessant</h2></div>
    <div class="fietsen-strook shop-raster">
${gerelateerd.concat(extra).map((x) => kaart(x, cat)).join('\n')}
    </div>
  </div>
</section>` : ''}
${catalogusScript({ producten: [p, ...gerelateerd, ...extra] })}`;
  const ogExtra = `  <meta property="product:price:amount" content="${Number(p.prijs).toFixed(2)}">\n  <meta property="product:price:currency" content="EUR">\n  <meta property="product:availability" content="${p.voorraad ? 'in stock' : 'available for order'}">\n  <meta property="product:condition" content="${p.staat === 'nieuw' ? 'new' : 'used'}">\n`;
  return {
    pad: productPad(p),
    html: pagina({
      titel, omschrijving, pad: productPad(p), ogType: 'product', ogExtra, ogBeeld: hoofd ? fotoUrl(hoofd.groot) : '',
      preload: hoofd ? `  <link rel="preload" href="${esc(fotoUrl(hoofd.groot))}" as="image" fetchpriority="high">\n` : '',
      head: kruimelLd([['Home', ''], ['Shop', 'fietsen.html'], [c.naam, 'fietsen.html#' + p.categorie], [naam, productPad(p)]]) + '\n' + productLd(p, cat, delen.winkel),
      kop: delen.kop, voet: delen.voet, inhoud, scripts: ['js/product.js'],
    }),
  };
}

/* ---------- sitemap ---------- */
function sitemap(paginas, cat, datum) {
  const regels = paginas.map(([pad, prio, d]) => `  <url><loc>${BASIS}${pad === 'index.html' ? '' : pad}</loc><lastmod>${d || datum}</lastmod><priority>${prio}</priority></url>`)
    .concat(cat.producten.map((p) => `  <url><loc>${BASIS}${productPad(p)}</loc><lastmod>${(p.bijgewerkt || datum).slice(0, 10)}</lastmod><priority>${p.voorraad ? '0.6' : '0.4'}</priority>${p.foto ? `<image:image><image:loc>${BASIS}${esc(fotoUrl(p.fotoGroot || p.foto))}</image:loc></image:image>` : ''}</url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${regels.join('\n')}\n</urlset>\n`;
}
const PAGINAS = [['index.html', '1.0'], ['werkplaats.html', '0.9'], ['planner.html', '0.9'], ['fietsen.html', '0.8'], ['contact.html', '0.8'], ['over.html', '0.6'], ['voorwaarden.html', '0.3'], ['privacy.html', '0.2']];

module.exports = { BASIS, DIENSTEN, PAGINAS, esc, getal, prijsTekst, fotoUrl, grootUrl, productPad, vulTokens, kaart, filterBalk, catalogusScript, itemListLd, productLd, kruimelLd, pagina, productPagina, sitemap, ldScript, markeerMenu };
