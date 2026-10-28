/* Cycle Service: website, webshop en beheer, powered by Mettafel. Geen dependencies.

   Wat de server doet
   - Serveert de site. Elke pagina wordt gemaakt uit de gebouwde HTML plus wat Jay in het beheer heeft
     aangepast (teksten, foto's, prijzen van de beurten, SEO, producten), en daarna gecachet.
   - Productpagina's (/shop-<id>.html) en /sitemap.xml komen live uit de catalogus.
   - Webshop-API (winkel.js) en beheer-API (beheer.js), met inlog via sessiecookie.
   - Beveiliging: security-headers en CSP, limieten per IP, inlogblokkade, CSRF-controle, geen
     toegang tot broncode of data. Snelheid: gzip en brotli, ETags, lange cache voor bestanden met versie.

   Omgeving
     PORT                  poort (standaard 8141)
     BASIS_URL             publieke adres, bijv. https://www.cycle-service.nl (voor Mollie en https-cookies)
     BEHEER_WACHTWOORD     eerste wachtwoord voor het beheer; Jay kiest daarna zelf een nieuw (verplicht in productie)
     DATA_MAP              map voor data en uploads (standaard ./_data; op Railway een volume)
     MELDING_URL           optioneel: webhook voor een melding bij een nieuwe bestelling of een nieuw bericht
     BETAALPROVIDER, MOLLIE_API_KEY   zie winkel.js */

'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const H = require('./_bouw/html.js');
const S = require('./_bouw/sjabloon.js');
const R = require('./_bouw/regio.js');

/* ---------- INSTELLINGEN ---------- */
const BASIS_URL = process.env.BASIS_URL || 'http://localhost:' + (Number(process.env.PORT) || 8141);
const INSTELLINGEN = {
  bedrijf: 'Cycle Service',
  poort: Number(process.env.PORT) || 8141,
  root: __dirname,
  data: path.resolve(process.env.DATA_MAP || path.join(__dirname, '_data')),
  https: /^https:\/\//.test(BASIS_URL),
  productie: process.env.NODE_ENV === 'production' || /^https:\/\//.test(BASIS_URL),
  meldingUrl: process.env.MELDING_URL || '',
  maxBody: 64 * 1024,
  /* Webshop: alles staat klaar, alleen de betaalprovider moet nog gekoppeld worden (zie winkel.js en README). */
  winkel: {
    betaalprovider: process.env.BETAALPROVIDER || 'geen',
    mollieKey: process.env.MOLLIE_API_KEY || '',
    basisUrl: BASIS_URL,
    /* standaard; Jay past drempel en kosten aan in het beheer (Instellingen) */
    verzenden: { actief: true, gratisVanaf: 100, kosten: null, levertijd: '1 tot 4 werkdagen' },
  },
  soorten: {
    bestelling: { prefix: 'WS', statussen: ['nieuw', 'wacht op betaling', 'betaald', 'klaar om op te halen', 'verzonden', 'afgerond', 'geannuleerd'] },
    aanvraag: { prefix: 'V', statussen: ['nieuw', 'beantwoord', 'afgerond'] },
  },
};

/* ---------- opslag ---------- */
const dataMap = INSTELLINGEN.data;
fs.mkdirSync(path.join(dataMap, 'media'), { recursive: true });
fs.mkdirSync(path.join(dataMap, 'versies'), { recursive: true });
function leesJson(naam, standaard) { try { return JSON.parse(fs.readFileSync(path.join(dataMap, naam + '.json'), 'utf8')); } catch { return standaard; } }
const BEWAARD = new Set(['producten', 'inhoud']);   /* van deze bestanden blijven de laatste 40 versies bewaard */
function schrijfJson(naam, waarde) {
  const f = path.join(dataMap, naam + '.json');
  if (BEWAARD.has(naam) && fs.existsSync(f)) {
    const stempel = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(f, path.join(dataMap, 'versies', `${naam}-${stempel}.json`));
    const oud = fs.readdirSync(path.join(dataMap, 'versies')).filter((x) => x.startsWith(naam + '-')).sort();
    for (const x of oud.slice(0, Math.max(0, oud.length - 40))) fs.unlinkSync(path.join(dataMap, 'versies', x));
  }
  fs.writeFileSync(f + '.tmp', JSON.stringify(waarde, null, 2));
  fs.renameSync(f + '.tmp', f);
  if (BEWAARD.has(naam)) versie++;
}
const lees = (soort) => leesJson(soort, []);
const schrijf = (soort, lijst) => schrijfJson(soort, lijst);
function nieuwNummer(soort, lijst) {
  const jaar = new Date().getFullYear();
  const hoogste = lijst.filter((x) => x.id && x.id.includes('-' + jaar + '-')).reduce((m, x) => Math.max(m, parseInt(x.id.split('-').pop(), 10) || 0), 0);
  return `${INSTELLINGEN.soorten[soort].prefix}-${jaar}-${String(hoogste + 1).padStart(4, '0')}`;
}

/* de catalogus en de aanpassingen uit het beheer; de eerste keer de catalogus uit de bouwmap */
let versie = 1;
function catalogus() {
  const eigen = leesJson('producten', null);
  if (eigen) return eigen;
  return JSON.parse(fs.readFileSync(path.join(INSTELLINGEN.root, '_bouw', 'producten.json'), 'utf8'));
}
function inhoud() {
  const i = leesJson('inhoud', {});
  return { teksten: i.teksten || {}, beelden: i.beelden || {}, seo: i.seo || {}, diensten: i.diensten || {}, winkel: i.winkel || {} };
}
function diensten(i = inhoud()) {
  const d = {};
  for (const [k, v] of Object.entries(S.DIENSTEN)) d[k] = { ...v, ...(i.diensten[k] || {}) };
  return d;
}
function winkelInstellingen(i = inhoud()) {
  return { ...INSTELLINGEN.winkel, verzenden: { ...INSTELLINGEN.winkel.verzenden, ...(i.winkel.verzenden || {}) } };
}

/* ---------- hulpjes ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const COMPRIMEER = /^(text\/|application\/(json|xml|manifest\+json)|image\/svg)/;
const ontsmet = (s, max = 1000) => String(s == null ? '' : s).replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function leesBody(req, max = INSTELLINGEN.maxBody) {
  return new Promise((ok, fout) => {
    const delen = []; let grootte = 0, teGroot = false;
    /* te groot: niet meer bewaren maar wel uitlezen, zodat de 413 nog bij de bezoeker aankomt */
    req.on('data', (d) => { grootte += d.length; if (grootte > max) { if (!teGroot) { teGroot = true; delen.length = 0; fout(Object.assign(new Error('te groot'), { code: 413 })); } } else delen.push(d); });
    req.on('end', () => { if (!teGroot) ok(Buffer.concat(delen)); });
    req.on('error', fout);
  });
}
async function leesJsonBody(req, max) {
  const tekst = (await leesBody(req, max)).toString('utf8');
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(tekst));
  try { const v = JSON.parse(tekst || '{}'); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
async function meld(soort, item) {
  if (!INSTELLINGEN.meldingUrl || typeof fetch !== 'function') return;
  try { await fetch(INSTELLINGEN.meldingUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bedrijf: INSTELLINGEN.bedrijf, soort, item }), signal: AbortSignal.timeout(8000) }); }
  catch (e) { console.error('Melding mislukt:', e.message); }
}

/* ---------- beveiliging ---------- */
/* echte IP: x-forwarded-for alleen vertrouwen als het verzoek van een proxy in het eigen netwerk komt (Railway, Render, Fly) */
function ipVan(req) {
  const direct = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const prive = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i.test(direct);
  const xff = req.headers['x-forwarded-for'];
  /* de proxy zet het echte adres achteraan; wat ervoor staat kan de bezoeker zelf verzinnen */
  if (prive && xff) return String(xff).split(',').pop().trim().slice(0, 64);
  return direct;
}
const tellers = new Map();
/* true als dit verzoek binnen de limiet valt: max verzoeken per venster (ms) per sleutel */
function binnenLimiet(sleutel, max, venster) {
  const nu = Date.now();
  let t = tellers.get(sleutel);
  if (!t || t.tot < nu) { t = { n: 0, tot: nu + venster }; tellers.set(sleutel, t); }
  t.n++;
  return t.n <= max;
}
const wisLimiet = (sleutel) => tellers.delete(sleutel);
/* hoeveel er in het huidige venster al geteld is, zonder mee te tellen */
const telling = (sleutel) => { const t = tellers.get(sleutel); return t && t.tot >= Date.now() ? t.n : 0; };
setInterval(() => { const nu = Date.now(); for (const [k, t] of tellers) if (t.tot < nu) tellers.delete(k); }, 60000).unref();

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self'", "connect-src 'self'", "frame-src 'self' https://www.google.com https://maps.google.com",
  "form-action 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "manifest-src 'self'",
].join('; ') + (INSTELLINGEN.https ? '; upgrade-insecure-requests' : '');
function beveiligingsHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (INSTELLINGEN.https) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/* ---------- versies van css, js en iconen (lange cache, nieuwe url bij elke wijziging) ---------- */
const hashCache = new Map();
function bestandsHash(rel) {
  const f = path.join(INSTELLINGEN.root, rel);
  let st; try { st = fs.statSync(f); } catch { return null; }
  const c = hashCache.get(rel);
  if (c && c.m === st.mtimeMs) return c.h;
  const h = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
  hashCache.set(rel, { m: st.mtimeMs, h });
  return h;
}
const versieer = (html) => html.replace(/((?:href|src)=")((?:css|js)\/[a-z0-9-]+\.(?:css|js)|assets\/iconen\.svg)(#[^"]*)?"/g, (t, a, rel, hash) => {
  const h = bestandsHash(rel);
  return h ? `${a}${rel}?v=${h}${hash || ''}"` : t;
});

/* ---------- pagina's maken: gebouwde HTML + aanpassingen uit het beheer ---------- */
const bron = (rel) => fs.readFileSync(path.join(INSTELLINGEN.root, rel), 'utf8');
const metaCache = new Map();
/* standaardtitel en -omschrijving van een pagina (met {prijs:..}-tokens), uit de paginabron */
function standaardSeo(pad) {
  if (metaCache.has(pad)) return metaCache.get(pad);
  let r = null;
  if (pad === 'index.html') {
    const h = bron('index.html');
    r = { titel: (/<title>([^<]*)<\/title>/.exec(h) || [])[1], omschrijving: (/<meta name="description" content="([^"]*)"/.exec(h) || [])[1] };
    r.titel = r.titel && r.titel.replace(/&amp;/g, '&'); r.omschrijving = r.omschrijving && r.omschrijving.replace(/&amp;/g, '&');
  } else {
    for (const f of fs.readdirSync(path.join(INSTELLINGEN.root, '_bouw', 'paginas'))) {
      const m = /<!--\s*meta\s*(\{[\s\S]*?\})\s*-->/.exec(bron('_bouw/paginas/' + f));
      if (m) { const meta = JSON.parse(m[1]); if (meta.pad === pad) r = { titel: meta.titel, omschrijving: meta.omschrijving, robots: meta.robots }; }
    }
  }
  metaCache.set(pad, r);
  return r;
}
const attrTekst = (s) => H.attrVeilig(s);
function zetSeo(html, titel, omschrijving) {
  let h = html;
  /* altijd met een functie vervangen: anders krijgen $' en $& in de tekst een speciale betekenis */
  if (titel) {
    h = h.replace(/<title>[^<]*<\/title>/, () => `<title>${attrTekst(titel)}</title>`);
    h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, (t, a, b) => a + attrTekst(titel.split(' | ')[0]) + b);
  }
  if (omschrijving) {
    h = h.replace(/(<meta name="description" content=")[^"]*(")/, (t, a, b) => a + attrTekst(omschrijving) + b);
    h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, (t, a, b) => a + attrTekst(omschrijving) + b);
  }
  return h;
}
function pasInhoudToe(html, pad, i, d) {
  const boom = H.lees(html);
  const vervang = [];
  for (const el of H.elementen(boom)) {
    const k = el.attrs['data-cms'];
    const bronK = el.attrs['data-cms-bron'];
    if (el.tag === 'img' && k && i.beelden[k]) {
      const b = i.beelden[k];
      const a = { ...el.attrs, src: b.src, alt: b.alt != null ? b.alt : el.attrs.alt };
      if (b.klein) { a.srcset = `${b.klein} 800w, ${b.src} 1600w`; a.sizes = el.attrs.sizes || '(max-width: 860px) 100vw, 60vw'; } else delete a.srcset;
      if (b.breed && b.hoog) { a.width = String(b.breed); a.height = String(b.hoog); }
      vervang.push({ start: el.start, end: el.openEnd, tekst: '<img ' + Object.entries(a).map(([n, w]) => (w === '' && n !== 'alt' ? n : `${n}="${attrTekst(w)}"`)).join(' ') + '>' });
    } else if (el.tag === 'source' && bronK && i.beelden[bronK]) {
      const b = i.beelden[bronK];
      vervang.push({ start: el.start, end: el.openEnd, tekst: `<source media="${attrTekst(el.attrs.media || '')}" srcset="${attrTekst(b.klein || b.src)}" data-cms-bron="${attrTekst(bronK)}">` });
    } else if (k && i.teksten[k] != null && el.tag !== 'img') {
      vervang.push({ start: el.openEnd, end: el.closeStart, tekst: i.teksten[k] });
    }
  }
  let h = H.vervang(html, vervang);
  /* prijzen van de beurten */
  h = h.replace(/<span([^>]*?)data-dienst="([a-z]+)"([^>]*)>[^<]*<\/span>/g, (t, a, k, b) => {
    if (!d[k]) return t;
    const p = S.getal(d[k].prijs);
    return `<span${a.replace(/data-tel="[^"]*"/, `data-tel="${p}"`)}data-dienst="${k}"${b.replace(/data-tel="[^"]*"/, `data-tel="${p}"`)}>${p}</span>`;
  });
  /* dezelfde prijzen in de structured data van de homepage */
  h = h.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (t, j) => {
    if (!j.includes('OfferCatalog')) return t;
    try {
      const o = JSON.parse(j);
      for (const e of (o.hasOfferCatalog && o.hasOfferCatalog.itemListElement) || []) {
        const dienst = Object.values(d).find((x) => x.naam === (e.itemOffered && e.itemOffered.name));
        if (dienst) e.price = String(dienst.prijs);
      }
      return `<script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/</g, '\\u003c')}\n</script>`;
    } catch { return t; }
  });
  /* titel en omschrijving: eigen versie uit het beheer, anders de standaard met de actuele prijzen */
  const eigen = i.seo[pad];
  const std = standaardSeo(pad);
  const titel = (eigen && eigen.titel) || (std && std.titel && S.vulTokens(std.titel, d));
  const omschrijving = (eigen && eigen.omschrijving) || (std && std.omschrijving && S.vulTokens(std.omschrijving, d));
  return zetSeo(h, titel, omschrijving);
}

const PAGINAS = new Set(['index.html', 'werkplaats.html', 'planner.html', 'fietsen.html', 'over.html', 'contact.html', 'voorwaarden.html', 'afrekenen.html']);
const paginaCache = new Map();
function maakPagina(pad) {
  const i = inhoud(), d = diensten(i), cat = catalogus();
  let html;
  const pm = /^shop-([a-z0-9-]+)\.html$/.exec(pad);
  if (pm) {
    const p = cat.producten.find((x) => x.id === pm[1]);
    if (!p) return null;
    html = S.productPagina(p, cat, { kop: bron('_bouw/kop.html'), voet: bron('_bouw/voet.html'), winkel: winkelInstellingen(i) }).html;
    if (p.seoTitel || p.seoOmschrijving) i.seo[pad] = { titel: p.seoTitel, omschrijving: p.seoOmschrijving };
  } else {
    if (!PAGINAS.has(pad)) return null;
    html = R.vulRegios(bron(pad), cat);
  }
  return versieer(pasInhoudToe(html, pad, i, d));
}
/* bron-tijdstempel: verandert als een gebouwde pagina of partial op schijf verandert */
function bronStempel(pad) {
  let m = 0;
  for (const f of [pad, '_bouw/kop.html', '_bouw/voet.html', 'css/style.css', 'css/motion.css', 'js/main.js', 'js/winkel.js', 'js/motion.js']) {
    try { m = Math.max(m, fs.statSync(path.join(INSTELLINGEN.root, f)).mtimeMs); } catch {}
  }
  return m;
}
function pagina(pad) {
  const sleutel = pad;
  const stempel = versie + ':' + bronStempel(pad.startsWith('shop-') ? 'index.html' : pad);
  const c = paginaCache.get(sleutel);
  if (c && c.stempel === stempel) return c;
  const html = maakPagina(pad);
  if (html == null) return null;
  const buf = Buffer.from(html);
  const item = { stempel, buf, etag: '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"', gz: null, br: null };
  paginaCache.set(sleutel, item);
  if (paginaCache.size > 200) paginaCache.delete(paginaCache.keys().next().value);
  return item;
}

/* ---------- verzenden met compressie en cache ---------- */
function stuur(req, res, item, type, cache) {
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.setHeader('Vary', 'Accept-Encoding');
  if (item.etag) {
    res.setHeader('ETag', item.etag);
    if (req.headers['if-none-match'] === item.etag) { res.writeHead(304); return res.end(); }
  }
  const ae = String(req.headers['accept-encoding'] || '');
  let body = item.buf;
  if (COMPRIMEER.test(type) && item.buf.length > 1024) {
    if (/\bbr\b/.test(ae)) { item.br = item.br || zlib.brotliCompressSync(item.buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10 } }); body = item.br; res.setHeader('Content-Encoding', 'br'); }
    else if (/\bgzip\b/.test(ae)) { item.gz = item.gz || zlib.gzipSync(item.buf, { level: 9 }); body = item.gz; res.setHeader('Content-Encoding', 'gzip'); }
  }
  res.setHeader('Content-Length', body.length);
  res.writeHead(200);
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* css lichtjes verkleinen: commentaar en overbodige witruimte eruit */
const verklein = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n').replace(/\n+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();

const bestandCache = new Map();
/* broncode, data en verborgen mappen nooit uitleveren; alleen de bestanden van de site zelf */
const VERBODEN = /(^|\/)(\.|_|node_modules)|^(server\.js|winkel\.js|beheer\.js|readme|package|vercel\.json|site\.webmanifest\.bak)/i;
function statisch(req, res, pad, q) {
  if (pad.includes('\0') || pad.includes('\\')) return nietGevonden(req, res);
  const rel = path.normalize(pad).replace(/^[/\\]+/, '');
  if (VERBODEN.test(rel)) return nietGevonden(req, res);
  const bestand = path.join(INSTELLINGEN.root, rel);
  if (!bestand.startsWith(INSTELLINGEN.root + path.sep)) return nietGevonden(req, res);
  const ext = path.extname(bestand).toLowerCase();
  if (!MIME[ext] || ext === '.html' || ext === '.json') return nietGevonden(req, res);
  let st; try { st = fs.statSync(bestand); } catch { return nietGevonden(req, res); }
  if (!st.isFile()) return nietGevonden(req, res);
  let item = bestandCache.get(bestand);
  if (!item || item.m !== st.mtimeMs) {
    let buf = fs.readFileSync(bestand);
    if (ext === '.css') buf = Buffer.from(verklein(buf.toString('utf8')));
    item = { m: st.mtimeMs, buf, etag: '"' + st.size.toString(36) + '-' + Math.round(st.mtimeMs).toString(36) + '"', gz: null, br: null };
    bestandCache.set(bestand, item);
  }
  const lang = q.has('v') || ext === '.woff2' ? 'public, max-age=31536000, immutable' : /\.(webp|jpg|jpeg|png|svg|ico|mp4)$/.test(ext) ? 'public, max-age=2592000' : 'public, max-age=3600';
  stuur(req, res, item, MIME[ext], lang);
}
function media(req, res, naam) {
  if (!/^[a-f0-9]{16}-(800|1600)\.(webp|jpg|png)$/.test(naam)) return nietGevonden(req, res);
  const f = path.join(dataMap, 'media', naam);
  fs.readFile(f, (err, buf) => {
    if (err) return nietGevonden(req, res);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    stuur(req, res, { buf, etag: '"' + naam + '"' }, MIME[path.extname(naam)], 'public, max-age=31536000, immutable');
  });
}
function nietGevonden(req, res) {
  const p = pagina('index.html');
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  if (!p) return res.end('<h1>Niet gevonden</h1>');
  /* de homepage met een duidelijke melding bovenaan, zodat de bezoeker verder kan */
  const html = p.buf.toString('utf8')
    .replace(/<title>[^<]*<\/title>/, '<title>Pagina niet gevonden | Cycle Service</title>')
    .replace('<meta name="robots" content="index, follow, max-image-preview:large">', '')
    .replace('<head>', '<head>\n  <meta name="robots" content="noindex">')
    .replace('<main>', '<main>\n<section class="sectie niet-gevonden" aria-label="Pagina niet gevonden"><div class="wrap"><h1>Deze pagina bestaat niet (meer)</h1><p class="lead">Misschien is het product verkocht of is de link veranderd. Kijk in de <a href="fietsen.html">shop</a> of ga naar de <a href="index.html">homepage</a>.</p></div></section>');
  res.end(req.method === 'HEAD' ? undefined : html);
}

function sitemapXml() {
  const cat = catalogus();
  const d = new Date().toISOString().slice(0, 10);
  return S.sitemap(S.PAGINAS, cat, d);
}

/* ---------- contactformulier ---------- */
async function nieuwBericht(req, res) {
  const v = await leesJsonBody(req);
  if (!v) return json(res, 400, { ok: false, fout: 'Ongeldige inhoud.' });
  if (v.website) return json(res, 201, { ok: true });   /* honeypot ingevuld: een bot, stil negeren */
  const item = { naam: ontsmet(v.naam, 100), telefoon: ontsmet(v.telefoon, 30), email: ontsmet(v.email, 150), bericht: ontsmet(v.bericht, 3000) };
  if (item.naam.length < 2 || item.telefoon.replace(/\D/g, '').length < 9 || item.bericht.length < 2) return json(res, 400, { ok: false, fout: 'Vul je naam, telefoonnummer en bericht in.' });
  if (item.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email)) return json(res, 400, { ok: false, fout: 'Controleer je e-mailadres.' });
  const lijst = lees('aanvraag');
  Object.assign(item, { id: nieuwNummer('aanvraag', lijst), soort: 'aanvraag', status: 'nieuw', ontvangen: new Date().toISOString() });
  lijst.unshift(item);
  schrijf('aanvraag', lijst.slice(0, 2000));
  meld('aanvraag', item);
  json(res, 201, { ok: true, id: item.id });
}

/* ---------- modules ---------- */
const ctx = { INSTELLINGEN, lees, schrijf, leesJson, schrijfJson, nieuwNummer, json, leesBody, leesJsonBody, ontsmet, meld, catalogus, inhoud, diensten, winkelInstellingen, binnenLimiet, wisLimiet, telling, ipVan, standaardSeo, dataMap, PAGINAS };
const winkel = require('./winkel')(ctx);
const beheer = require('./beheer')(ctx);

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  beveiligingsHeaders(res);
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  let pad;
  try { pad = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  const ip = ipVan(req);
  try {
    if (!binnenLimiet('alles:' + ip, 600, 60000)) { res.writeHead(429, { 'Retry-After': '60' }); return res.end('Te veel verzoeken. Probeer het over een minuut opnieuw.'); }
    if (req.method !== 'GET' && req.method !== 'HEAD' && !binnenLimiet('post:' + ip, 60, 60000)) return json(res, 429, { ok: false, fout: 'Te veel verzoeken. Probeer het over een minuut opnieuw.' });

    if (pad === '/beheer' || pad.startsWith('/beheer/') || pad.startsWith('/api/beheer/')) return await beheer.route(req, res, pad, url);
    if (pad.startsWith('/api/')) {
      if (await winkel(req, res, pad)) return;
      if (pad === '/api/aanvraag' && req.method === 'POST') {
        if (!binnenLimiet('aanvraag:' + ip, 5, 600000)) return json(res, 429, { ok: false, fout: 'Je hebt al een paar berichten gestuurd. Bel of app Jay gerust.' });
        return await nieuwBericht(req, res);
      }
      return json(res, 404, { ok: false, fout: 'Onbekend.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }

    if (pad.startsWith('/media/')) return media(req, res, pad.slice(7));
    if (pad === '/sitemap.xml') return stuur(req, res, { buf: Buffer.from(sitemapXml()) }, MIME['.xml'], 'public, max-age=3600');

    /* pagina's: /, /werkplaats, /werkplaats.html, /shop-<id> */
    let p = pad === '/' ? 'index.html' : pad.slice(1);
    if (!path.extname(p) && !p.includes('/')) p += '.html';
    if (p.endsWith('.html') && !p.includes('/')) {
      if (beheer.bewerkModus(req, url)) return beheer.bewerkPagina(req, res, p, maakPagina);
      const item = pagina(p);
      if (!item) return nietGevonden(req, res);
      return stuur(req, res, item, MIME['.html'], 'no-cache');
    }
    statisch(req, res, pad, url.searchParams);
  } catch (e) {
    if (e && e.code === 413) { res.setHeader('Connection', 'close'); return json(res, 413, { ok: false, fout: 'Het bestand of bericht is te groot.' }); }
    console.error(e);
    if (!res.headersSent) json(res, 500, { ok: false, fout: 'Er ging iets mis. Bel ons gerust: 06 28828966.' });
  }
});
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 5000;
server.listen(INSTELLINGEN.poort, () => {
  console.log(`${INSTELLINGEN.bedrijf}: http://localhost:${INSTELLINGEN.poort}  (beheer: /beheer)`);
  beheer.opstart();
});
