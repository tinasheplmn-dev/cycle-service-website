/* Webshop-backend Cycle Service, powered by Mettafel.
   Winkelwagen en checkout zijn compleet; alleen de betaalprovider moet nog worden gekoppeld.

   Routes (afgehandeld vóór de algemene /api/<soort>-routes in server.js):
     GET  /api/winkel                       instellingen voor de checkout (provider, verzenden)
     GET  /api/producten                    de catalogus uit _bouw/producten.json
     POST /api/bestelling                   nieuwe bestelling; prijzen worden hier opnieuw berekend
     GET  /api/bestelling/<id>?t=<token>    status van één bestelling (alleen met het token uit de bevestiging)
     POST /api/bestelling/<id>/betaal?t=    nieuwe betaalpoging voor een onbetaalde bestelling
     POST /api/betaling/webhook             Mollie meldt hier een statuswijziging

   Betaalprovider kiezen met BETAALPROVIDER:
     geen   (standaard) bestelling komt binnen als 'nieuw'; de klant betaalt bij ophalen of via een betaalverzoek
     mollie iDEAL, Bancontact, creditcard via Mollie. Nodig: MOLLIE_API_KEY (test_... of live_...) en BASIS_URL
            (de publieke https-adres van de site, voor de terugkeer- en webhook-URL). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = function maakWinkel(c) {
  const { INSTELLINGEN, lees, schrijf, nieuwNummer, json, leesBody, ontsmet, meld } = c;
  const W = INSTELLINGEN.winkel;
  const catalogusBestand = path.join(INSTELLINGEN.root, '_bouw', 'producten.json');

  function catalogus() { return JSON.parse(fs.readFileSync(catalogusBestand, 'utf8')); }
  const bedrag = (n) => Math.round(n * 100) / 100;
  const euro = (n) => bedrag(n).toFixed(2);

  async function leesJson(req) {
    const buf = await leesBody(req);
    const ct = req.headers['content-type'] || '';
    const tekst = buf.toString('utf8');
    if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(tekst));
    try { return JSON.parse(tekst || '{}'); } catch { return null; }
  }

  /* ---------- Mollie (alleen gebruikt als BETAALPROVIDER=mollie) ---------- */
  async function mollie(methode, pad, body) {
    if (!W.mollieKey) throw new Error('MOLLIE_API_KEY ontbreekt');
    const r = await fetch('https://api.mollie.com/v2' + pad, {
      method: methode,
      headers: { Authorization: 'Bearer ' + W.mollieKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Mollie ' + r.status + ': ' + (j.detail || j.title || 'onbekende fout'));
    return j;
  }
  function publiek(url) { return /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url); }

  async function startBetaling(bestelling) {
    const basis = W.basisUrl.replace(/\/$/, '');
    const body = {
      amount: { currency: 'EUR', value: euro(bestelling.totaal) },
      description: 'Cycle Service bestelling ' + bestelling.id,
      redirectUrl: `${basis}/afrekenen.html?bestelling=${encodeURIComponent(bestelling.id)}&t=${bestelling.token}`,
      metadata: { bestelling: bestelling.id },
    };
    if (publiek(basis)) body.webhookUrl = basis + '/api/betaling/webhook';
    const p = await mollie('POST', '/payments', body);
    bestelling.betaling = { provider: 'mollie', id: p.id, status: p.status, aangemaakt: new Date().toISOString() };
    return p._links && p._links.checkout && p._links.checkout.href;
  }

  /* Mollie-status overnemen op de bestelling. Webhook en terugkeerpagina gebruiken dit allebei,
     zodat de status ook klopt als de webhook (bijvoorbeeld lokaal) niet bereikbaar is. */
  async function ververs(bestelling) {
    if (!bestelling.betaling || bestelling.betaling.provider !== 'mollie') return false;
    const p = await mollie('GET', '/payments/' + bestelling.betaling.id);
    const was = bestelling.status;
    bestelling.betaling.status = p.status;
    if (p.status === 'paid' && ['wacht op betaling', 'nieuw'].includes(bestelling.status)) {
      bestelling.status = 'betaald'; bestelling.betaling.betaald = p.paidAt || new Date().toISOString();
    }
    return was !== bestelling.status;
  }

  /* gratis vanaf het drempelbedrag; daaronder het vaste bedrag, of null als dat nog niet is ingesteld */
  function verzendkostenVoor(subtotaal) {
    const v = W.verzenden;
    if (v.gratisVanaf != null && subtotaal >= v.gratisVanaf) return 0;
    return v.kosten == null ? null : Number(v.kosten);
  }

  /* ---------- bestelling ---------- */
  function berekenRegels(invoer, cat) {
    if (!Array.isArray(invoer) || !invoer.length) return { fout: 'Je winkelwagen is leeg.' };
    const perId = Object.fromEntries(cat.producten.map((p) => [p.id, p]));
    const regels = [];
    for (const r of invoer.slice(0, 30)) {
      const p = perId[r && r.id];
      if (!p) return { fout: 'Een product in je winkelwagen bestaat niet meer. Ververs de pagina.' };
      if (!p.voorraad) return { fout: `${p.merk} ${p.naam} is niet meer op voorraad.` };
      /* variant: alleen waarden die in producten.json als leverbaar staan */
      const opties = p.opties || [];
      const keuzes = Array.isArray(r.keuzes) ? r.keuzes.map(String) : [];
      if (keuzes.length !== opties.length || !opties.every((o, i) => o.waarden.includes(keuzes[i]))) return { fout: `Kies opnieuw een uitvoering van de ${p.merk} ${p.naam}; deze is niet (meer) leverbaar.` };
      const uitvoering = opties.length ? keuzes.map((k, i) => (opties[i].naam === 'Maat' ? 'maat ' + k : k)).join(' · ') : (p.maat || '');
      const max = p.categorie === 'onderdelen' ? 10 : 1;
      const aantal = Math.min(max, Math.max(1, parseInt(r.aantal, 10) || 1));
      regels.push({ id: p.id, naam: `${p.merk} ${p.naam}`, maat: uitvoering, keuzes, aantal, prijs: p.prijs, subtotaal: bedrag(p.prijs * aantal), verzendbaar: p.levering === 'verzenden' });
    }
    return { regels, subtotaal: bedrag(regels.reduce((s, r) => s + r.subtotaal, 0)) };
  }

  async function nieuweBestelling(req, res) {
    const v = await leesJson(req);
    if (!v) return json(res, 400, { ok: false, fout: 'Ongeldige inhoud.' });
    const naam = ontsmet(v.naam), email = ontsmet(v.email), telefoon = ontsmet(v.telefoon);
    if (naam.length < 2) return json(res, 400, { ok: false, fout: 'Vul je naam in.', veld: 'naam' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { ok: false, fout: 'Controleer je e-mailadres.', veld: 'email' });
    if (telefoon.replace(/\D/g, '').length < 9) return json(res, 400, { ok: false, fout: 'Vul je telefoonnummer in.', veld: 'telefoon' });
    if (!v.akkoord) return json(res, 400, { ok: false, fout: 'Ga akkoord met de voorwaarden om te bestellen.', veld: 'akkoord' });

    const b = berekenRegels(v.regels, catalogus());
    if (b.fout) return json(res, 409, { ok: false, fout: b.fout });

    let levering = v.levering === 'verzenden' ? 'verzenden' : 'afhalen';
    let verzendkosten = 0, adres = null;
    if (levering === 'verzenden') {
      const k = verzendkostenVoor(b.subtotaal);
      if (!W.verzenden.actief || k == null) return json(res, 400, { ok: false, fout: 'Verzenden kan bij dit bedrag nog niet. Kies afhalen in de winkel, of bel 06 28828966.' });
      if (!b.regels.every((r) => r.verzendbaar)) return json(res, 400, { ok: false, fout: 'Fietsen worden rijklaar afgeleverd in de winkel. Kies afhalen.' });
      adres = { straat: ontsmet(v.straat), postcode: ontsmet(v.postcode), plaats: ontsmet(v.plaats) };
      if (!adres.straat || !/^\d{4}\s?[A-Za-z]{2}$/.test(adres.postcode) || !adres.plaats) return json(res, 400, { ok: false, fout: 'Vul je volledige adres in.', veld: 'straat' });
      verzendkosten = k;
    }

    const lijst = lees('bestelling');
    const bestelling = {
      id: nieuwNummer('bestelling', lijst), soort: 'bestelling',
      status: W.betaalprovider === 'mollie' ? 'wacht op betaling' : 'nieuw',
      ontvangen: new Date().toISOString(), token: crypto.randomBytes(12).toString('hex'),
      naam, email, telefoon, levering, adres, opmerking: ontsmet(v.opmerking),
      regels: b.regels, subtotaal: b.subtotaal, verzendkosten, totaal: bedrag(b.subtotaal + verzendkosten),
      betaling: { provider: W.betaalprovider, status: W.betaalprovider === 'mollie' ? 'open' : 'bij ophalen of via betaalverzoek' },
    };

    let checkoutUrl = null;
    if (W.betaalprovider === 'mollie') {
      try { checkoutUrl = await startBetaling(bestelling); }
      catch (e) {
        console.error('Betaling starten mislukt:', e.message);
        return json(res, 502, { ok: false, fout: 'Online betalen lukt nu even niet. Probeer het zo opnieuw of bel 06 28828966.' });
      }
    }
    lijst.unshift(bestelling); schrijf('bestelling', lijst); meld('bestelling', bestelling);
    console.log(`[${INSTELLINGEN.bedrijf}] nieuwe bestelling ${bestelling.id} van ${naam}, € ${euro(bestelling.totaal)}`);
    json(res, 201, { ok: true, id: bestelling.id, token: bestelling.token, status: bestelling.status, checkoutUrl, totaal: bestelling.totaal, provider: W.betaalprovider });
  }

  function zoek(id, token) {
    const lijst = lees('bestelling');
    const b = lijst.find((x) => x.id === id);
    if (!b || !token || b.token !== token) return { lijst, b: null };
    return { lijst, b };
  }
  const publiekeVorm = (b) => ({ id: b.id, status: b.status, levering: b.levering, regels: b.regels.map(({ verzendbaar, keuzes, ...r }) => r), subtotaal: b.subtotaal, verzendkosten: b.verzendkosten, totaal: b.totaal, betaling: b.betaling && { provider: b.betaling.provider, status: b.betaling.status } });

  async function status(req, res, id) {
    const t = new URL(req.url, 'http://x').searchParams.get('t');
    const { lijst, b } = zoek(id, t);
    if (!b) return json(res, 404, { ok: false, fout: 'Bestelling niet gevonden.' });
    if (b.status === 'wacht op betaling') {
      try { if (await ververs(b)) schrijf('bestelling', lijst); } catch (e) { console.error('Status ophalen mislukt:', e.message); }
    }
    json(res, 200, { ok: true, bestelling: publiekeVorm(b) });
  }

  async function opnieuwBetalen(req, res, id) {
    const t = new URL(req.url, 'http://x').searchParams.get('t');
    const { lijst, b } = zoek(id, t);
    if (!b) return json(res, 404, { ok: false, fout: 'Bestelling niet gevonden.' });
    if (W.betaalprovider !== 'mollie' || b.status !== 'wacht op betaling') return json(res, 409, { ok: false, fout: 'Deze bestelling hoeft niet (meer) betaald te worden.' });
    try { const url = await startBetaling(b); schrijf('bestelling', lijst); json(res, 200, { ok: true, checkoutUrl: url }); }
    catch (e) { console.error(e.message); json(res, 502, { ok: false, fout: 'Online betalen lukt nu even niet. Probeer het zo opnieuw.' }); }
  }

  async function webhook(req, res) {
    const v = (await leesJson(req)) || {};
    const lijst = lees('bestelling');
    const b = lijst.find((x) => x.betaling && x.betaling.id === v.id);
    if (b) { try { if (await ververs(b)) { schrijf('bestelling', lijst); meld('bestelling', b); } } catch (e) { console.error('Webhook:', e.message); } }
    res.writeHead(200); res.end('ok');   /* Mollie wil altijd 200, ook bij een onbekende id */
  }

  /* ---------- router ---------- */
  return async function winkel(req, res, pad) {
    if (pad === '/api/winkel' && req.method === 'GET') {
      const v = W.verzenden;
      json(res, 200, { ok: true, betaalprovider: W.betaalprovider, verzenden: { actief: !!(v.actief && (v.kosten != null || v.gratisVanaf != null)), kosten: v.kosten, gratisVanaf: v.gratisVanaf, levertijd: v.levertijd } });
      return true;
    }
    if (pad === '/api/producten' && req.method === 'GET') { json(res, 200, { ok: true, ...catalogus() }); return true; }
    if (pad === '/api/bestelling' && req.method === 'POST') { await nieuweBestelling(req, res); return true; }
    if (pad === '/api/betaling/webhook' && req.method === 'POST') { await webhook(req, res); return true; }
    let m = /^\/api\/bestelling\/([A-Z0-9-]+)\/betaal$/.exec(pad);
    if (m && req.method === 'POST') { await opnieuwBetalen(req, res, m[1]); return true; }
    m = /^\/api\/bestelling\/([A-Z0-9-]+)$/.exec(pad);
    if (m && req.method === 'GET' && new URL(req.url, 'http://x').searchParams.get('t')) { await status(req, res, m[1]); return true; }
    return false;
  };
};
