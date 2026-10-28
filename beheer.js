/* Beheer Cycle Service, powered by Mettafel: inloggen en de beheer-API.

   Jay logt in op /beheer met een wachtwoord. Daarna kan hij producten toevoegen, aanpassen en
   verwijderen, de prijzen van de beurten wijzigen, teksten en foto's op de pagina zelf aanpassen
   (/<pagina>?bewerken=1), titels en omschrijvingen voor Google instellen, bestellingen en berichten
   afhandelen, en een eerdere versie terugzetten.

   Beveiliging
   - Wachtwoord met scrypt gehasht in DATA_MAP/beheer.json. Eerste wachtwoord uit BEHEER_WACHTWOORD, of
     zonder die variabele een willekeurig wachtwoord in DATA_MAP/eerste-wachtwoord.txt. Bij de eerste keer
     inloggen kiest Jay een eigen wachtwoord (minstens 10 tekens).
     Wachtwoord vergeten: zet BEHEER_WACHTWOORD op een nieuw wachtwoord plus BEHEER_RESET=1 en herstart.
   - Sessie in een HttpOnly-cookie (SameSite=Strict, Secure op https), 12 uur geldig, 2 uur zonder activiteit.
   - Elke wijziging vraagt een CSRF-token in de header en een Origin van dezelfde site.
   - Na 5 mislukte pogingen is inloggen vanaf dat IP 15 minuten dicht; na 100 mislukte pogingen in totaal 15 minuten voor iedereen.
   - Teksten uit het beheer gaan door een strikte filter (alleen opmaak binnen een regel), uploads moeten echt
     een WebP, JPEG of PNG zijn, en elke wijziging komt in het logboek. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('./_bouw/html.js');

module.exports = function maakBeheer(c) {
  const { INSTELLINGEN, json, leesJsonBody, leesBody, ontsmet, leesJson, schrijfJson, lees, schrijf, catalogus, inhoud, diensten, winkelInstellingen, binnenLimiet, wisLimiet, telling, ipVan, standaardSeo, dataMap, PAGINAS } = c;
  const MAP = path.join(INSTELLINGEN.root, '_beheer');
  const COOKIE = INSTELLINGEN.https ? '__Host-cs_beheer' : 'cs_beheer';
  const IDLE = 2 * 3600 * 1000, MAX = 12 * 3600 * 1000;
  const sessies = new Map();

  /* ---------- wachtwoord ---------- */
  function hash(wachtwoord) {
    const zout = crypto.randomBytes(16);
    const h = crypto.scryptSync(String(wachtwoord), zout, 64, { N: 16384, r: 8, p: 1 });
    return `scrypt$16384$8$1$${zout.toString('base64')}$${h.toString('base64')}`;
  }
  function klopt(wachtwoord, opgeslagen) {
    const [soort, N, r, p, zout, h] = String(opgeslagen || '').split('$');
    if (soort !== 'scrypt') return false;
    const verwacht = Buffer.from(h, 'base64');
    const echt = crypto.scryptSync(String(wachtwoord), Buffer.from(zout, 'base64'), verwacht.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(echt, verwacht);
  }
  const account = () => leesJson('beheer', null);

  /* ---------- tweestapsverificatie (TOTP, RFC 6238): 6 cijfers uit een authenticator-app, elke 30 seconden nieuw ---------- */
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function naarBase32(buf) {
    let bits = 0, waarde = 0, uit = '';
    for (const b of buf) { waarde = (waarde << 8) | b; bits += 8; while (bits >= 5) { uit += B32[(waarde >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) uit += B32[(waarde << (5 - bits)) & 31];
    return uit;
  }
  function vanBase32(s) {
    let bits = 0, waarde = 0; const uit = [];
    for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) { waarde = (waarde << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { uit.push((waarde >>> (bits - 8)) & 255); bits -= 8; } }
    return Buffer.from(uit);
  }
  function totp(geheim, stap) {
    const teller = Buffer.alloc(8);
    teller.writeBigUInt64BE(BigInt(stap));
    const h = crypto.createHmac('sha1', vanBase32(geheim)).update(teller).digest();
    const o = h[h.length - 1] & 15;
    return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0');
  }
  /* geeft de tijdstap van een geldige code (30 seconden speling), of null; een al gebruikte stap telt niet */
  function codeOk(geheim, code, laatste) {
    const c = String(code || '').replace(/\s/g, '');
    if (!geheim || !/^\d{6}$/.test(c)) return null;
    const nu = Math.floor(Date.now() / 30000);
    for (const d of [0, -1, 1]) {
      const stap = nu + d;
      if (stap <= (laatste || 0)) continue;
      if (crypto.timingSafeEqual(Buffer.from(totp(geheim, stap)), Buffer.from(c))) return stap;
    }
    return null;
  }
  function opstart() {
    const env = process.env.BEHEER_WACHTWOORD || process.env.BEHEER_TOKEN || '';
    const a = account();
    if (a && !(process.env.BEHEER_RESET === '1' && env)) return;
    /* geen vast standaardwachtwoord: zonder BEHEER_WACHTWOORD een willekeurig wachtwoord, alleen te lezen
       in de console en in DATA_MAP/eerste-wachtwoord.txt (die verdwijnt zodra Jay een eigen wachtwoord kiest) */
    const eerste = env || crypto.randomBytes(9).toString('base64url');
    schrijfJson('beheer', { hash: hash(eerste), moetWijzigen: true, gewijzigd: new Date().toISOString() });
    sessies.clear();
    if (!env) {
      fs.writeFileSync(path.join(dataMap, 'eerste-wachtwoord.txt'), eerste + '\n', { mode: 0o600 });
      console.log(`Beheer: eerste wachtwoord is ${eerste} (ook in ${path.join(dataMap, 'eerste-wachtwoord.txt')}); bij de eerste keer inloggen kies je een eigen wachtwoord.`);
    } else console.log(a ? 'Beheer: wachtwoord teruggezet vanuit BEHEER_WACHTWOORD. Haal BEHEER_RESET weer weg.' : 'Beheer: eerste wachtwoord ingesteld vanuit BEHEER_WACHTWOORD; bij de eerste keer inloggen kies je een eigen wachtwoord.');
  }

  /* ---------- sessies ---------- */
  function cookies(req) {
    const uit = {};
    for (const deel of String(req.headers.cookie || '').split(';')) {
      const i = deel.indexOf('=');
      if (i > 0) uit[deel.slice(0, i).trim()] = deel.slice(i + 1).trim();
    }
    return uit;
  }
  const sleutelVan = (token) => crypto.createHash('sha256').update(token).digest('hex');
  function sessieVan(req) {
    const t = cookies(req)[COOKIE];
    if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
    const s = sessies.get(sleutelVan(t));
    const nu = Date.now();
    if (!s || s.begin + MAX < nu || s.laatst + IDLE < nu) { if (s) sessies.delete(sleutelVan(t)); return null; }
    s.laatst = nu;
    return s;
  }
  function maakSessie(res) {
    const token = crypto.randomBytes(32).toString('hex');
    const s = { begin: Date.now(), laatst: Date.now(), csrf: crypto.randomBytes(24).toString('hex') };
    sessies.set(sleutelVan(token), s);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX / 1000}${INSTELLINGEN.https ? '; Secure' : ''}`);
    return s;
  }
  function wisCookie(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${INSTELLINGEN.https ? '; Secure' : ''}`); }
  function zelfdeSite(req) {
    const herkomst = req.headers.origin || req.headers.referer;
    if (!herkomst) return true;
    try { return new URL(herkomst).host === req.headers.host; } catch { return false; }
  }
  function csrfOk(req, s) {
    const t = String(req.headers['x-csrf'] || '');
    return t.length === s.csrf.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(s.csrf)) && zelfdeSite(req);
  }

  /* ---------- logboek ---------- */
  function log(req, actie) {
    const l = leesJson('logboek', []);
    l.unshift({ t: new Date().toISOString(), actie: String(actie).slice(0, 200), ip: ipVan(req) });
    schrijfJson('logboek', l.slice(0, 400));
  }

  /* ---------- bestanden van het beheer zelf ---------- */
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
  function beheerBestand(res, naam) {
    if (!/^[a-z-]+\.(html|css|js|svg)$/.test(naam)) { res.writeHead(404); return res.end(); }
    fs.readFile(path.join(MAP, naam), (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(naam)], 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow' });
      res.end(buf);
    });
  }

  /* ---------- controle van invoer ---------- */
  const STAAT = ['nieuw', 'occasion', 'demo'];
  const LEVERING = ['afhalen', 'verzenden'];
  const tekstVeld = (v, max) => ontsmet(v, max);
  const bestaatMedia = (p) => /^media\/[a-f0-9]{16}-(800|1600)\.(webp|jpg|png)$/.test(p) && fs.existsSync(path.join(dataMap, p));
  const bestaatAsset = (f) => /^[a-z0-9-]+\.(webp|jpg|png)$/.test(f) && fs.existsSync(path.join(INSTELLINGEN.root, 'assets', 'img', f));
  const fotoOk = (f) => !f || bestaatMedia(f) || bestaatAsset(f);
  /* Nederlandse notatie: 1.899,50 of 1899,5 of 1899.50 */
  function bedrag(v, max) {
    let t = String(v == null ? '' : v).replace(/[€\s]/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    const n = Math.round(Number(t) * 100) / 100;
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  }
  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'product';
  }
  /* geeft { p } of { fout } */
  function product(v, oud, cat) {
    const p = { ...(oud || {}) };
    p.merk = tekstVeld(v.merk, 60); p.naam = tekstVeld(v.naam, 80);
    if (p.merk.length < 1 || p.naam.length < 1) return { fout: 'Vul een merk en een naam in.' };
    if (!cat.categorieen.some((x) => x.id === v.categorie)) return { fout: 'Kies een categorie.' };
    p.categorie = v.categorie;
    p.staat = STAAT.includes(v.staat) ? v.staat : 'nieuw';
    p.maat = tekstVeld(v.maat, 40);
    const prijs = bedrag(v.prijs, 100000);
    if (prijs == null || prijs <= 0) return { fout: 'Vul een geldige prijs in, bijvoorbeeld 1299 of 49,95.' };
    p.prijs = prijs;
    p.voorraad = !!v.voorraad;
    p.levering = LEVERING.includes(v.levering) ? v.levering : 'afhalen';
    p.uitgelicht = !!v.uitgelicht;
    for (const [veld, max] of [['alt', 200], ['intro', 300], ['seoTitel', 120], ['seoOmschrijving', 320]]) p[veld] = tekstVeld(v[veld], max);
    p.omschrijving = String(v.omschrijving || '').replace(/[<>\u0000]/g, '').replace(/\r/g, '').slice(0, 6000).trim();
    p.kenmerken = (Array.isArray(v.kenmerken) ? v.kenmerken : String(v.kenmerken || '').split('\n')).map((k) => tekstVeld(k, 120)).filter(Boolean).slice(0, 15);
    p.ean = /^\d{8,14}$/.test(String(v.ean || '').trim()) ? String(v.ean).trim() : '';
    if (!fotoOk(v.foto) || !fotoOk(v.fotoGroot)) return { fout: 'Die foto bestaat niet (meer). Upload hem opnieuw.' };
    p.foto = v.foto || ''; p.fotoGroot = v.fotoGroot || '';
    p.fotos = (Array.isArray(v.fotos) ? v.fotos : []).filter((f) => typeof f === 'string' && bestaatMedia(f)).slice(0, 8);
    const opties = Array.isArray(v.opties) ? v.opties : [];
    p.opties = opties.slice(0, 3).map((o) => ({ naam: tekstVeld(o && o.naam, 30), waarden: (Array.isArray(o && o.waarden) ? o.waarden : String((o && o.waarden) || '').split(',')).map((w) => tekstVeld(w, 40)).filter(Boolean).slice(0, 20) }))
      .filter((o) => o.naam && o.waarden.length);
    for (const k of ['alt', 'intro', 'maat', 'seoTitel', 'seoOmschrijving', 'omschrijving', 'ean', 'fotoGroot']) if (!p[k]) delete p[k];
    for (const k of ['fotos', 'opties', 'kenmerken']) if (!p[k].length && k !== 'kenmerken') delete p[k];
    if (!p.uitgelicht) delete p.uitgelicht;
    p.bijgewerkt = new Date().toISOString();
    return { p };
  }

  /* alle sleutels (data-cms) die in de gebouwde pagina's staan, met hun oorspronkelijke inhoud */
  let sleutelCache = null, sleutelStempel = 0;
  function sleutels() {
    const bestanden = [...PAGINAS].map((p) => p).concat(['_bouw/kop.html', '_bouw/voet.html']);
    let stempel = 0;
    for (const f of bestanden) { try { stempel = Math.max(stempel, fs.statSync(path.join(INSTELLINGEN.root, f)).mtimeMs); } catch {} }
    if (sleutelCache && stempel === sleutelStempel) return sleutelCache;
    const uit = new Map();
    for (const f of bestanden) {
      let html; try { html = fs.readFileSync(path.join(INSTELLINGEN.root, f), 'utf8'); } catch { continue; }
      const pagina = f.startsWith('_bouw/') ? 'alle pagina\'s' : f;
      for (const el of H.elementen(H.lees(html))) {
        const k = el.attrs['data-cms'];
        if (!k || uit.has(k)) continue;
        uit.set(k, { pagina, tag: el.tag, origineel: el.tag === 'img' ? { src: el.attrs.src, alt: el.attrs.alt } : html.slice(el.openEnd, el.closeStart) });
      }
    }
    sleutelCache = uit; sleutelStempel = stempel;
    return uit;
  }
  const kaal = (h) => String(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- foto's uploaden ---------- */
  function soortBeeld(buf) {
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    return null;
  }
  async function upload(req, res, url) {
    const maat = url.searchParams.get('maat');
    if (!['800', '1600'].includes(maat)) return json(res, 400, { ok: false, fout: 'Onbekende maat.' });
    let groep = url.searchParams.get('groep');
    if (groep && !/^[a-f0-9]{16}$/.test(groep)) return json(res, 400, { ok: false, fout: 'Ongeldige groep.' });
    const buf = await leesBody(req, 6 * 1024 * 1024);
    const soort = soortBeeld(buf);
    if (!soort) return json(res, 415, { ok: false, fout: 'Dit is geen WebP-, JPEG- of PNG-foto.' });
    if (!groep) groep = crypto.randomBytes(8).toString('hex');
    const naam = `${groep}-${maat}.${soort}`;
    fs.writeFileSync(path.join(dataMap, 'media', naam), buf);
    log(req, `foto geüpload: ${naam}`);
    json(res, 201, { ok: true, pad: 'media/' + naam, groep });
  }

  /* ---------- bewerkmodus op de pagina zelf ---------- */
  function bewerkModus(req, url) { return url.searchParams.get('bewerken') === '1' && !!sessieVan(req); }
  function bewerkPagina(req, res, pad, maakPagina) {
    const s = sessieVan(req);
    const html = maakPagina(pad);
    if (!html) { res.writeHead(404); return res.end(); }
    const i = inhoud();
    const staat = { pad, csrf: s.csrf, teksten: Object.keys(i.teksten), beelden: Object.keys(i.beelden), diensten: Object.fromEntries(Object.entries(diensten(i)).map(([k, d]) => [k, d.kort])) };
    const uit = html
      .replace('</head>', () => '  <link rel="stylesheet" href="/beheer/bewerk.css">\n</head>')
      .replace('</body>', () => `<script type="application/json" id="cms-staat">${JSON.stringify(staat).replace(/</g, '\\u003c')}</script>\n<script src="/beheer/bewerk.js" defer></script>\n</body>`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    res.end(uit);
  }

  /* ---------- API ---------- */
  async function api(req, res, deel, url, s) {
    const m = req.method;
    const body = m === 'GET' || m === 'DELETE' || deel === 'media' ? null : await leesJsonBody(req, 256 * 1024);
    if (body === null && !['GET', 'DELETE'].includes(m) && deel !== 'media') return json(res, 400, { ok: false, fout: 'Ongeldige inhoud.' });
    let r;

    if (deel === 'overzicht' && m === 'GET') {
      const b = lees('bestelling'), a = lees('aanvraag'), cat = catalogus(), i = inhoud();
      return json(res, 200, { ok: true,
        bestellingen: { nieuw: b.filter((x) => ['nieuw', 'betaald'].includes(x.status)).length, totaal: b.length },
        berichten: { nieuw: a.filter((x) => x.status === 'nieuw').length, totaal: a.length },
        producten: { totaal: cat.producten.length, voorraad: cat.producten.filter((p) => p.voorraad).length, zonderFoto: cat.producten.filter((p) => !p.foto).length },
        aanpassingen: Object.keys(i.teksten).length + Object.keys(i.beelden).length,
        logboek: leesJson('logboek', []).slice(0, 8), moetWijzigen: !!(account() || {}).moetWijzigen, tweeStap: !!(account() || {}).totp });
    }

    /* producten */
    if (deel === 'producten' && m === 'GET') { const cat = catalogus(); return json(res, 200, { ok: true, categorieen: cat.categorieen, producten: cat.producten }); }
    if (deel === 'producten' && m === 'POST') {
      const cat = catalogus();
      const u = product(body, null, cat);
      if (u.fout) return json(res, 400, { ok: false, fout: u.fout });
      let id = slug([u.p.merk, u.p.naam, u.p.maat].filter(Boolean).join(' ')), n = 2;
      const basis = id;
      while (cat.producten.some((p) => p.id === id)) id = `${basis}-${n++}`;
      const p = { id, ...u.p };
      cat.producten.unshift(p);
      schrijfJson('producten', cat);
      log(req, `product toegevoegd: ${p.merk} ${p.naam}`);
      return json(res, 201, { ok: true, product: p });
    }
    if ((r = /^producten\/([a-z0-9-]+)$/.exec(deel))) {
      const cat = catalogus();
      const i = cat.producten.findIndex((p) => p.id === r[1]);
      if (i === -1) return json(res, 404, { ok: false, fout: 'Product niet gevonden.' });
      if (m === 'PUT') {
        const u = product(body, cat.producten[i], cat);
        if (u.fout) return json(res, 400, { ok: false, fout: u.fout });
        cat.producten[i] = { id: r[1], ...u.p };
        schrijfJson('producten', cat);
        log(req, `product aangepast: ${u.p.merk} ${u.p.naam}`);
        return json(res, 200, { ok: true, product: cat.producten[i] });
      }
      if (m === 'PATCH') {
        /* snelle wijziging vanuit de lijst: prijs, voorraad of uitgelicht */
        const p = cat.producten[i];
        if ('prijs' in body) { const pr = bedrag(body.prijs, 100000); if (pr == null || pr <= 0) return json(res, 400, { ok: false, fout: 'Ongeldige prijs.' }); p.prijs = pr; }
        if ('voorraad' in body) p.voorraad = !!body.voorraad;
        if ('uitgelicht' in body) { if (body.uitgelicht) p.uitgelicht = true; else delete p.uitgelicht; }
        p.bijgewerkt = new Date().toISOString();
        schrijfJson('producten', cat);
        log(req, `product ${p.merk} ${p.naam}: ${Object.keys(body).join(', ')} gewijzigd`);
        return json(res, 200, { ok: true, product: p });
      }
      if (m === 'DELETE') {
        const [weg] = cat.producten.splice(i, 1);
        schrijfJson('producten', cat);
        log(req, `product verwijderd: ${weg.merk} ${weg.naam}`);
        return json(res, 200, { ok: true });
      }
    }
    if ((r = /^producten\/([a-z0-9-]+)\/(omhoog|omlaag)$/.exec(deel)) && m === 'POST') {
      const cat = catalogus();
      const i = cat.producten.findIndex((p) => p.id === r[1]);
      const j = r[2] === 'omhoog' ? i - 1 : i + 1;
      if (i === -1 || j < 0 || j >= cat.producten.length) return json(res, 400, { ok: false });
      [cat.producten[i], cat.producten[j]] = [cat.producten[j], cat.producten[i]];
      schrijfJson('producten', cat);
      return json(res, 200, { ok: true });
    }

    /* teksten, foto's, SEO, prijzen */
    if (deel === 'inhoud' && m === 'GET') {
      const i = inhoud(), k = sleutels();
      const lijst = [...Object.entries(i.teksten).map(([key, h]) => ({ key, soort: 'tekst', pagina: (k.get(key) || {}).pagina || '?', nu: kaal(h).slice(0, 140), was: kaal((k.get(key) || {}).origineel || '').slice(0, 140) })),
        ...Object.entries(i.beelden).map(([key, b]) => ({ key, soort: 'foto', pagina: (k.get(key) || {}).pagina || '?', nu: b.src, was: ((k.get(key) || {}).origineel || {}).src }))];
      const seo = [...PAGINAS].filter((p) => p !== 'afrekenen.html').map((p) => {
        const std = standaardSeo(p) || {};
        const d = diensten(i);
        const vul = (t) => String(t || '').replace(/\{prijs:([a-z]+)\}/g, (x, n) => (d[n] ? d[n].prijs : x));
        return { pad: p, standaard: { titel: vul(std.titel), omschrijving: vul(std.omschrijving) }, eigen: i.seo[p] || null };
      });
      return json(res, 200, { ok: true, aanpassingen: lijst, seo, diensten: diensten(i), verzenden: winkelInstellingen(i).verzenden });
    }
    if ((r = /^tekst\/([a-z]+-\d+)$/.exec(deel))) {
      const k = sleutels().get(r[1]);
      if (!k || k.tag === 'img') return json(res, 404, { ok: false, fout: 'Deze tekst bestaat niet.' });
      if (m === 'GET') return json(res, 200, { ok: true, origineel: k.origineel });
      const alles = leesJson('inhoud', {}); alles.teksten = alles.teksten || {};
      if (m === 'DELETE') { delete alles.teksten[r[1]]; schrijfJson('inhoud', alles); log(req, `tekst teruggezet: ${r[1]}`); return json(res, 200, { ok: true, html: k.origineel }); }
      if (m === 'PUT') {
        const schoon = H.veiligeHtml(body.html, 6000).trim();
        if (!kaal(schoon) && !/<br>/.test(schoon)) return json(res, 400, { ok: false, fout: 'Een tekst kan niet leeg zijn. Gebruik "Herstel" om terug te gaan naar het origineel.' });
        if (kaal(schoon) === kaal(k.origineel) && schoon.replace(/\s+/g, ' ') === String(k.origineel).trim().replace(/\s+/g, ' ')) delete alles.teksten[r[1]];
        else alles.teksten[r[1]] = schoon;
        if (Object.keys(alles.teksten).length > 3000) return json(res, 400, { ok: false, fout: 'Te veel aanpassingen.' });
        schrijfJson('inhoud', alles);
        log(req, `tekst aangepast (${k.pagina}): ${kaal(schoon).slice(0, 60)}`);
        return json(res, 200, { ok: true, html: schoon });
      }
    }
    if ((r = /^beeld\/([a-z]+-f\d+)$/.exec(deel))) {
      const k = sleutels().get(r[1]);
      if (!k || k.tag !== 'img') return json(res, 404, { ok: false, fout: 'Deze foto bestaat niet.' });
      const alles = leesJson('inhoud', {}); alles.beelden = alles.beelden || {};
      if (m === 'DELETE') { delete alles.beelden[r[1]]; schrijfJson('inhoud', alles); log(req, `foto teruggezet: ${r[1]}`); return json(res, 200, { ok: true, origineel: k.origineel }); }
      if (m === 'PUT') {
        const huidig = alles.beelden[r[1]] || {};
        const src = body.src || huidig.src || k.origineel.src;
        const isOrig = src === k.origineel.src;
        if (!isOrig && !bestaatMedia(src)) return json(res, 400, { ok: false, fout: 'Upload de foto opnieuw.' });
        const b = { src, alt: tekstVeld(body.alt != null ? body.alt : (huidig.alt != null ? huidig.alt : k.origineel.alt), 200) };
        const klein = body.src ? body.klein : huidig.klein;
        if (klein && bestaatMedia(klein)) b.klein = klein;
        const breed = parseInt(body.src ? body.breed : huidig.breed, 10), hoog = parseInt(body.src ? body.hoog : huidig.hoog, 10);
        if (breed > 0 && breed < 10000 && hoog > 0 && hoog < 10000) { b.breed = breed; b.hoog = hoog; }
        alles.beelden[r[1]] = b;
        schrijfJson('inhoud', alles);
        log(req, `foto aangepast (${k.pagina}): ${r[1]}`);
        return json(res, 200, { ok: true, beeld: b });
      }
    }
    if ((r = /^seo\/([a-z0-9-]+\.html)$/.exec(deel))) {
      if (!PAGINAS.has(r[1])) return json(res, 404, { ok: false });
      const alles = leesJson('inhoud', {}); alles.seo = alles.seo || {};
      if (m === 'DELETE') delete alles.seo[r[1]];
      else if (m === 'PUT') {
        const titel = tekstVeld(body.titel, 120), omschrijving = tekstVeld(body.omschrijving, 320);
        if (!titel && !omschrijving) delete alles.seo[r[1]]; else alles.seo[r[1]] = { titel, omschrijving };
      } else return json(res, 405, { ok: false });
      schrijfJson('inhoud', alles);
      log(req, `SEO aangepast: ${r[1]}`);
      return json(res, 200, { ok: true });
    }
    if (deel === 'diensten' && m === 'PUT') {
      const alles = leesJson('inhoud', {}); alles.diensten = alles.diensten || {};
      for (const k of Object.keys(diensten())) {
        if (!body[k]) continue;
        const pr = bedrag(body[k].prijs, 10000);
        if (pr == null || pr <= 0) return json(res, 400, { ok: false, fout: 'Vul geldige prijzen in.' });
        alles.diensten[k] = { prijs: pr };
      }
      schrijfJson('inhoud', alles);
      log(req, 'prijzen beurten: ' + Object.entries(alles.diensten).map(([k, v]) => `${k} € ${v.prijs}`).join(', '));
      return json(res, 200, { ok: true, diensten: diensten() });
    }
    if (deel === 'verzenden' && m === 'PUT') {
      const alles = leesJson('inhoud', {}); alles.winkel = alles.winkel || {};
      const g = body.gratisVanaf === '' || body.gratisVanaf == null ? null : bedrag(body.gratisVanaf, 100000);
      const k = body.kosten === '' || body.kosten == null ? null : bedrag(body.kosten, 1000);
      if ((body.gratisVanaf !== '' && body.gratisVanaf != null && g == null) || (body.kosten !== '' && body.kosten != null && k == null)) return json(res, 400, { ok: false, fout: 'Vul geldige bedragen in.' });
      alles.winkel.verzenden = { gratisVanaf: g, kosten: k, actief: !!body.actief };
      schrijfJson('inhoud', alles);
      log(req, `verzenden: gratis vanaf ${g}, kosten ${k}, ${body.actief ? 'aan' : 'uit'}`);
      return json(res, 200, { ok: true });
    }
    if (deel === 'media' && m === 'POST') return upload(req, res, url);

    /* bestellingen en berichten */
    const SOORT = { bestellingen: 'bestelling', berichten: 'aanvraag' };
    if (SOORT[deel] && m === 'GET') return json(res, 200, { ok: true, items: lees(SOORT[deel]).slice(0, 500).map(({ token, ...x }) => x), statussen: INSTELLINGEN.soorten[SOORT[deel]].statussen });
    if ((r = /^(bestellingen|berichten)\/([A-Z0-9-]+)\/status$/.exec(deel)) && m === 'POST') {
      const soort = SOORT[r[1]];
      if (!INSTELLINGEN.soorten[soort].statussen.includes(body.status)) return json(res, 400, { ok: false, fout: 'Onbekende status.' });
      const lijst = lees(soort);
      const item = lijst.find((x) => x.id === r[2]);
      if (!item) return json(res, 404, { ok: false, fout: 'Niet gevonden.' });
      item.status = body.status; item.bijgewerkt = new Date().toISOString();
      schrijf(soort, lijst);
      log(req, `${soort} ${item.id}: ${body.status}`);
      return json(res, 200, { ok: true, item });
    }

    /* versies en logboek */
    if (deel === 'logboek' && m === 'GET') return json(res, 200, { ok: true, items: leesJson('logboek', []) });
    if (deel === 'versies' && m === 'GET') {
      const v = fs.readdirSync(path.join(dataMap, 'versies')).filter((x) => /^(producten|inhoud)-[\dT-]+Z\.json$/.test(x)).sort().reverse();
      return json(res, 200, { ok: true, items: v.map((x) => ({ bestand: x, soort: x.split('-')[0], tijd: x.replace(/^[a-z]+-/, '').replace('.json', '').replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z/, 'T$1:$2:$3.$4Z') })) });
    }
    if (deel === 'versies/herstel' && m === 'POST') {
      const f = String(body.bestand || '');
      if (!/^(producten|inhoud)-[\dT-]+Z\.json$/.test(f)) return json(res, 400, { ok: false });
      let data; try { data = JSON.parse(fs.readFileSync(path.join(dataMap, 'versies', f), 'utf8')); } catch { return json(res, 404, { ok: false, fout: 'Versie niet gevonden.' }); }
      schrijfJson(f.split('-')[0], data);
      log(req, `versie teruggezet: ${f}`);
      return json(res, 200, { ok: true });
    }
    /* tweestapsverificatie aanzetten: eerst een geheim tonen, dan bevestigen met een code uit de app */
    if (deel === '2fa/start' && m === 'POST') {
      s.nieuwTotp = naarBase32(crypto.randomBytes(20));
      return json(res, 200, { ok: true, geheim: s.nieuwTotp, uri: `otpauth://totp/Cycle%20Service:beheer?secret=${s.nieuwTotp}&issuer=Cycle%20Service&digits=6&period=30` });
    }
    if (deel === '2fa/aan' && m === 'POST') {
      const stap = codeOk(s.nieuwTotp, body.code, 0);
      if (stap == null) return json(res, 400, { ok: false, fout: 'Die code klopt niet. Controleer of de tijd op je telefoon klopt en probeer de volgende code.' });
      schrijfJson('beheer', { ...account(), totp: s.nieuwTotp, laatsteStap: stap });
      delete s.nieuwTotp;
      for (const [k, v] of sessies) if (v !== s) sessies.delete(k);
      log(req, 'tweestapsverificatie aangezet');
      return json(res, 200, { ok: true });
    }
    if (deel === '2fa/uit' && m === 'POST') {
      const a = account();
      if (!a || !klopt(body.wachtwoord, a.hash)) return json(res, 400, { ok: false, fout: 'Je wachtwoord klopt niet.' });
      if (codeOk(a.totp, body.code, a.laatsteStap) == null) return json(res, 400, { ok: false, fout: 'Die code klopt niet.' });
      const { totp: weg, laatsteStap, ...rest } = a;
      schrijfJson('beheer', rest);
      log(req, 'tweestapsverificatie uitgezet');
      return json(res, 200, { ok: true });
    }

    /* AVG: een bericht verwijderen, of de persoonsgegevens van een bestelling wissen (bedragen blijven voor de administratie) */
    if ((r = /^berichten\/([A-Z0-9-]+)$/.exec(deel)) && m === 'DELETE') {
      const lijst = lees('aanvraag');
      if (!lijst.some((x) => x.id === r[1])) return json(res, 404, { ok: false, fout: 'Niet gevonden.' });
      schrijf('aanvraag', lijst.filter((x) => x.id !== r[1]));
      log(req, `bericht ${r[1]} verwijderd`);
      return json(res, 200, { ok: true });
    }
    if ((r = /^bestellingen\/([A-Z0-9-]+)\/wis$/.exec(deel)) && m === 'POST') {
      const lijst = lees('bestelling');
      const b = lijst.find((x) => x.id === r[1]);
      if (!b) return json(res, 404, { ok: false, fout: 'Niet gevonden.' });
      Object.assign(b, { naam: '(gewist)', email: '', telefoon: '', adres: null, opmerking: '', gewist: new Date().toISOString() });
      schrijf('bestelling', lijst);
      log(req, `persoonsgegevens van bestelling ${r[1]} gewist`);
      return json(res, 200, { ok: true });
    }

    if (deel === 'wachtwoord' && m === 'POST') {
      const a = account();
      if (!a || !klopt(body.huidig, a.hash)) return json(res, 400, { ok: false, fout: 'Je huidige wachtwoord klopt niet.' });
      const nieuw = String(body.nieuw || '');
      if (nieuw.length < 10) return json(res, 400, { ok: false, fout: 'Kies een wachtwoord van minstens 10 tekens.' });
      if (nieuw === body.huidig) return json(res, 400, { ok: false, fout: 'Kies een ander wachtwoord dan het huidige.' });
      schrijfJson('beheer', { hash: hash(nieuw), moetWijzigen: false, gewijzigd: new Date().toISOString() });
      try { fs.unlinkSync(path.join(dataMap, 'eerste-wachtwoord.txt')); } catch {}
      /* andere sessies uitloggen, deze houden */
      for (const [k, v] of sessies) if (v !== s) sessies.delete(k);
      log(req, 'wachtwoord gewijzigd');
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { ok: false, fout: 'Onbekend.' });
  }

  async function route(req, res, pad, url) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (pad === '/beheer' || pad === '/beheer/') return beheerBestand(res, 'index.html');
    if (pad.startsWith('/beheer/')) return beheerBestand(res, pad.slice(8));
    const deel = pad.slice('/api/beheer/'.length);
    const ip = ipVan(req);

    if (deel === 'login' && req.method === 'POST') {
      if (!zelfdeSite(req)) return json(res, 403, { ok: false, fout: 'Geen toegang.' });
      /* alleen mislukte pogingen tellen: 5 per IP, en een ruime grens van 100 voor alle IP's samen */
      if (telling('login-ip:' + ip) >= 5 || telling('login-alles') >= 100) {
        return json(res, 429, { ok: false, fout: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.' });
      }
      const body = (await leesJsonBody(req, 4096)) || {};
      const a = account();
      if (!a) return json(res, 503, { ok: false, fout: 'Het beheer is nog niet ingesteld (BEHEER_WACHTWOORD).' });
      const mislukt = (fout, extra) => {
        binnenLimiet('login-ip:' + ip, 5, 15 * 60000); binnenLimiet('login-alles', 100, 15 * 60000);
        log(req, 'mislukte inlogpoging');
        return json(res, 401, { ok: false, fout, ...extra });
      };
      if (!klopt(body.wachtwoord || '', a.hash)) return mislukt('Dat wachtwoord klopt niet.');
      if (a.totp) {
        /* ook een poging zonder code telt mee, zodat dit geen onbeperkte wachtwoordtest wordt */
        if (!body.code) return mislukt('Vul de code uit je authenticator-app in.', { tweeStap: true });
        const stap = codeOk(a.totp, body.code, a.laatsteStap);
        if (stap == null) return mislukt('Die code klopt niet of is al gebruikt. Wacht op de volgende code.', { tweeStap: true });
        schrijfJson('beheer', { ...a, laatsteStap: stap });
      }
      /* gelukt: de tellers voor dit IP weer op nul */
      wisLimiet('login-ip:' + ip);
      const s = maakSessie(res);
      log(req, 'ingelogd');
      return json(res, 200, { ok: true, csrf: s.csrf, moetWijzigen: !!a.moetWijzigen });
    }
    const s = sessieVan(req);
    if (deel === 'sessie' && req.method === 'GET') {
      if (!s) return json(res, 200, { ok: true, ingelogd: false });
      const a = account() || {};
      return json(res, 200, { ok: true, ingelogd: true, csrf: s.csrf, moetWijzigen: !!a.moetWijzigen, tweeStap: !!a.totp });
    }
    if (!s) return json(res, 401, { ok: false, fout: 'Je bent uitgelogd. Log opnieuw in.', uitgelogd: true });
    if (req.method !== 'GET' && !csrfOk(req, s)) return json(res, 403, { ok: false, fout: 'Deze actie is geweigerd. Ververs de pagina en probeer het opnieuw.' });
    if (deel === 'uitloggen' && req.method === 'POST') {
      for (const [k, v] of sessies) if (v === s) sessies.delete(k);
      wisCookie(res);
      return json(res, 200, { ok: true });
    }
    /* zolang het eerste wachtwoord nog actief is, kan alleen het wachtwoord gewijzigd worden */
    if ((account() || {}).moetWijzigen && !(deel === 'wachtwoord' || (deel === 'overzicht' && req.method === 'GET'))) {
      return json(res, 403, { ok: false, fout: 'Kies eerst een eigen wachtwoord.', moetWijzigen: true });
    }
    return api(req, res, deel, url, s);
  }

  return { route, opstart, bewerkModus, bewerkPagina };
};
