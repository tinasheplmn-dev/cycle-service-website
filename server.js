/* Cycle Service: statische site plus eigen onderhoudsplanner, powered by Mettafel.
   Geen dependencies. Gebaseerd op het Mettafel-backendpatroon.

   Routes:
     GET  /...                          statische bestanden (cleanUrls)
     GET  /api/agenda?van=YYYY-MM-DD&tot=YYYY-MM-DD   bezette blokken per dag (zonder persoonsgegevens)
     POST /api/boeking                  nieuwe onderhoudsafspraak
     GET  /api/boeking?token=...        lijst voor de beheerpagina
     POST /api/boeking/<id>/status      status wijzigen
     GET  /beheer?token=...             beheerpagina (dagoverzicht)

   Omgeving: PORT, BEHEER_TOKEN (verplicht in productie), MELDING_URL (optioneel webhook). */

'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

/* ---------- INSTELLINGEN ---------- */
const INSTELLINGEN = {
  bedrijf: 'Cycle Service',
  poort: Number(process.env.PORT) || 8141,
  root: __dirname,
  beheerToken: process.env.BEHEER_TOKEN || 'cycleservice',
  meldingUrl: process.env.MELDING_URL || '',
  maxBody: 1024 * 1024,
  /* De werkplaatsagenda: dinsdag t/m vrijdag, 8 uur per dag (opdracht eigenaar). */
  agenda: {
    werkdagen: [2, 3, 4, 5],           /* 0 = zondag ... 6 = zaterdag */
    start: '07:30',
    eind: '15:30',                     /* 8 uur planbaar per dag, vanaf openingstijd */
    stap: 15,                          /* minuten tussen starttijden */
    vooruit: 90,                       /* dagen vooruit boekbaar */
    minUrenVooraf: 18,                 /* vanaf hoeveel uur vooraf een slot nog boekbaar is */
    gesloten: [['2026-09-26', '2026-10-10']], /* vakantie of sluiting: [van, tot] inclusief, staat zo op de huidige site */
  },
  beurten: {
    onderhoud:  { naam: 'Onderhoudsbeurt race, MTB of gravel', duur: 180, prijs: 159 },
    controle:   { naam: 'Controlebeurt race, MTB of gravel',   duur: 75,  prijs: 69 },
    ebike:      { naam: 'Onderhoudsbeurt e-bike',              duur: 90,  prijs: 85 },
  },
  soorten: {
    boeking: { prefix: 'CS', verplicht: ['naam', 'telefoon', 'email', 'beurt', 'datum', 'tijd'], statussen: ['nieuw', 'bevestigd', 'in de werkplaats', 'klaar', 'opgehaald', 'geannuleerd'] },
    aanvraag: { prefix: 'V', verplicht: ['naam', 'telefoon'], statussen: ['nieuw', 'beantwoord', 'afgerond'] },
  },
};

/* ---------- opslag ---------- */
const dataMap = path.join(INSTELLINGEN.root, '_data');
fs.mkdirSync(dataMap, { recursive: true });
function lees(soort) { try { return JSON.parse(fs.readFileSync(path.join(dataMap, soort + '.json'), 'utf8')); } catch { return []; } }
function schrijf(soort, lijst) {
  const f = path.join(dataMap, soort + '.json');
  fs.writeFileSync(f + '.tmp', JSON.stringify(lijst, null, 2));
  fs.renameSync(f + '.tmp', f);
}
function nieuwNummer(soort, lijst) {
  const jaar = new Date().getFullYear();
  const n = lijst.filter((x) => x.id && x.id.includes('-' + jaar + '-')).length + 1;
  return `${INSTELLINGEN.soorten[soort].prefix}-${jaar}-${String(n).padStart(4, '0')}`;
}

/* ---------- hulpjes ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.ics': 'text/calendar; charset=utf-8',
};
const ontsmet = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 1000);
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function tokenOk(req) {
  const u = new URL(req.url, 'http://x');
  const t = u.searchParams.get('token') || req.headers['x-beheer-token'] || '';
  return t && t === INSTELLINGEN.beheerToken;
}
function leesBody(req) {
  return new Promise((ok, fout) => {
    const delen = []; let grootte = 0;
    req.on('data', (d) => { grootte += d.length; if (grootte > INSTELLINGEN.maxBody) { fout(new Error('te groot')); req.destroy(); } else delen.push(d); });
    req.on('end', () => ok(Buffer.concat(delen)));
    req.on('error', fout);
  });
}
async function meld(soort, item) {
  if (!INSTELLINGEN.meldingUrl || typeof fetch !== 'function') return;
  try { await fetch(INSTELLINGEN.meldingUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bedrijf: INSTELLINGEN.bedrijf, soort, item }) }); }
  catch (e) { console.error('Melding mislukt:', e.message); }
}

/* ---------- agenda-logica ---------- */
const minuten = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const tijd = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isoDag = (d) => d.toISOString().slice(0, 10);
function geldigeDatum(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00').getTime()); }

/* bezette blokken op een dag: [{van, tot}] in minuten, alleen niet-geannuleerde boekingen */
function bezet(datum, lijst) {
  return lijst
    .filter((b) => b.datum === datum && b.status !== 'geannuleerd')
    .map((b) => ({ van: minuten(b.tijd), tot: minuten(b.tijd) + Number(b.duur || 60) }));
}
function dagInfo(datum, lijst) {
  const a = INSTELLINGEN.agenda;
  const d = new Date(datum + 'T00:00:00');
  const dicht = (a.gesloten || []).some(([v, t]) => datum >= v && datum <= t);
  const werkdag = a.werkdagen.includes(d.getDay()) && !dicht;
  const blokken = werkdag ? bezet(datum, lijst) : [];
  const totaal = minuten(a.eind) - minuten(a.start);
  const gebruikt = blokken.reduce((s, b) => s + (b.tot - b.van), 0);
  return { datum, werkdag, gesloten: dicht, bezet: blokken, vrij: Math.max(0, totaal - gebruikt) };
}
/* toets of een gewenst blok past (binnen werktijd, niet overlappend, niet te kort dag) */
function pastBlok(datum, start, duur, lijst) {
  const a = INSTELLINGEN.agenda;
  const info = dagInfo(datum, lijst);
  if (info.gesloten) return 'Op die dag is de werkplaats gesloten wegens vakantie.';
  if (!info.werkdag) return 'Op die dag is de werkplaats gesloten.';
  const van = minuten(start), tot = van + duur;
  if (van < minuten(a.start) || tot > minuten(a.eind)) return 'Die tijd valt buiten de werkplaatsuren.';
  if ((van - minuten(a.start)) % a.stap !== 0) return 'Kies een tijd op het kwartier.';
  const nu = Date.now();
  const startMs = new Date(datum + 'T' + start + ':00').getTime();
  if (startMs - nu < a.minUrenVooraf * 3600 * 1000) return 'Die tijd is te dichtbij. Kies een later moment of bel ons.';
  if (startMs - nu > a.vooruit * 86400 * 1000) return 'Zo ver vooruit kun je nog niet plannen.';
  if (info.bezet.some((b) => van < b.tot && tot > b.van)) return 'Die tijd is inmiddels bezet. Kies een andere tijd.';
  return null;
}

/* ---------- API ---------- */
function apiAgenda(req, res) {
  const u = new URL(req.url, 'http://x');
  const van = u.searchParams.get('van'), tot = u.searchParams.get('tot');
  if (!geldigeDatum(van) || !geldigeDatum(tot)) return json(res, 400, { ok: false, fout: 'Ongeldige datum.' });
  const lijst = lees('boeking');
  const dagen = [];
  const d = new Date(van + 'T00:00:00'); const eind = new Date(tot + 'T00:00:00');
  let teller = 0;
  while (d <= eind && teller++ < 120) { dagen.push(dagInfo(isoDag(new Date(d.getTime() - d.getTimezoneOffset() * 60000)), lijst)); d.setDate(d.getDate() + 1); }
  json(res, 200, { ok: true, agenda: INSTELLINGEN.agenda, beurten: INSTELLINGEN.beurten, dagen });
}

async function apiNieuw(req, res, soort) {
  const cfg = INSTELLINGEN.soorten[soort];
  if (!cfg) return json(res, 404, { ok: false, fout: 'Onbekende soort' });
  let velden = {};
  try { velden = JSON.parse((await leesBody(req)).toString('utf8') || '{}'); } catch { return json(res, 400, { ok: false, fout: 'Ongeldige inhoud.' }); }
  const item = { id: null, soort, status: cfg.statussen[0], ontvangen: new Date().toISOString() };
  for (const [k, v] of Object.entries(velden)) item[k] = typeof v === 'string' ? ontsmet(v) : v;
  const mist = cfg.verplicht.filter((v) => !item[v]);
  if (mist.length) return json(res, 400, { ok: false, fout: 'Ontbrekend: ' + mist.join(', '), mist });

  if (soort === 'boeking') {
    const beurt = INSTELLINGEN.beurten[item.beurt];
    if (!beurt) return json(res, 400, { ok: false, fout: 'Onbekende beurt.' });
    if (!geldigeDatum(item.datum) || !/^\d{2}:\d{2}$/.test(item.tijd)) return json(res, 400, { ok: false, fout: 'Ongeldige datum of tijd.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email)) return json(res, 400, { ok: false, fout: 'Controleer je e-mailadres.' });
    item.duur = beurt.duur; item.prijs = beurt.prijs; item.beurtNaam = beurt.naam;
    const probleem = pastBlok(item.datum, item.tijd, beurt.duur, lees('boeking'));
    if (probleem) return json(res, 409, { ok: false, fout: probleem });
  }
  const lijst = lees(soort);
  item.id = nieuwNummer(soort, lijst);
  lijst.unshift(item);
  schrijf(soort, lijst);
  meld(soort, item);
  console.log(`[${INSTELLINGEN.bedrijf}] nieuwe ${soort} ${item.id} van ${item.naam || '?'} (${item.datum || ''} ${item.tijd || ''})`);
  json(res, 201, { ok: true, id: item.id, status: item.status, item: { datum: item.datum, tijd: item.tijd, duur: item.duur, beurtNaam: item.beurtNaam, prijs: item.prijs } });
}
function apiLijst(req, res, soort) {
  if (!tokenOk(req)) return json(res, 401, { ok: false, fout: 'Geen toegang.' });
  if (!INSTELLINGEN.soorten[soort]) return json(res, 404, { ok: false });
  json(res, 200, { ok: true, items: lees(soort), statussen: INSTELLINGEN.soorten[soort].statussen });
}
async function apiStatus(req, res, soort, id) {
  if (!tokenOk(req)) return json(res, 401, { ok: false, fout: 'Geen toegang.' });
  const cfg = INSTELLINGEN.soorten[soort];
  if (!cfg) return json(res, 404, { ok: false });
  let body = {};
  try { body = JSON.parse((await leesBody(req)).toString('utf8') || '{}'); } catch {}
  if (!cfg.statussen.includes(body.status)) return json(res, 400, { ok: false, fout: 'Onbekende status.' });
  const lijst = lees(soort);
  const item = lijst.find((x) => x.id === id);
  if (!item) return json(res, 404, { ok: false, fout: 'Niet gevonden.' });
  item.status = body.status; item.bijgewerkt = new Date().toISOString();
  schrijf(soort, lijst);
  json(res, 200, { ok: true, item });
}

/* ---------- beheerpagina ---------- */
function beheerPagina(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  if (!tokenOk(req)) {
    return res.end(`<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beheer Cycle Service</title>
<style>body{font:16px/1.5 system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f3f4f6;color:#0b1730}form{background:#fff;padding:2rem;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.08);display:grid;gap:.8rem;min-width:280px}input,button{font:inherit;padding:.7rem .9rem;border-radius:6px;border:1px solid #ccc}button{background:#0b1730;color:#fff;border:0;cursor:pointer}small{color:#4a5568}</style>
<form><strong>Cycle Service: werkplaatsagenda</strong><input name="token" type="password" placeholder="Wachtwoord" autofocus><button>Openen</button><small>Powered by Mettafel</small></form></html>`);
  }
  res.end(`<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Werkplaatsagenda Cycle Service</title>
<style>
:root{--inkt:#0b1730;--papier:#f3f4f6;--vlak:#fff;--lijn:#dfe3ea;--ok:#1d7a4a;--nieuw:#c8102e;--merk:#0b1730}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui;background:var(--papier);color:var(--inkt)}
header{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.25rem;background:var(--vlak);border-bottom:1px solid var(--lijn);position:sticky;top:0;flex-wrap:wrap}
nav button{font:inherit;padding:.5rem .9rem;border:1px solid var(--lijn);background:var(--vlak);border-radius:999px;margin-right:.4rem;cursor:pointer}nav button.actief{background:var(--inkt);color:#fff;border-color:var(--inkt)}
main{padding:1rem 1.25rem;max-width:1100px;margin:0 auto}
h2{font-size:1.05rem;margin:1.4rem 0 .5rem;color:#334}
.kaart{background:var(--vlak);border:1px solid var(--lijn);border-radius:10px;padding:1rem 1.1rem;margin-bottom:.8rem;display:grid;grid-template-columns:1fr auto;gap:.6rem 1rem}
.kaart.nieuw{border-left:5px solid var(--nieuw)}.kaart h3{margin:0 0 .2rem;font-size:1.05rem}.kaart small{color:#4a5568}
.status{display:flex;gap:.35rem;flex-wrap:wrap;align-items:flex-start;max-width:320px;justify-content:flex-end}
.status button{font:inherit;font-size:.85rem;padding:.4rem .7rem;border-radius:6px;border:1px solid var(--lijn);background:var(--vlak);cursor:pointer}
.status button.huidig{background:var(--ok);color:#fff;border-color:var(--ok)}
.leeg{color:#4a5568;padding:2rem;text-align:center}.tel{font-weight:600}
.slot{display:inline-block;background:#eef1f6;border-radius:6px;padding:.1rem .5rem;margin-right:.3rem;font-size:.9rem}
footer{text-align:center;color:#4a5568;font-size:.85rem;padding:2rem}
@media(max-width:640px){.kaart{grid-template-columns:1fr}.status{justify-content:flex-start;max-width:none}}
</style>
<header><strong>Cycle Service · werkplaatsagenda</strong><nav id="tabs"></nav></header>
<main id="lijst"><p class="leeg">Laden...</p></main>
<footer>Beheer powered by Mettafel · vernieuwt elke 30 seconden</footer>
<script>
const TOKEN=new URL(location).searchParams.get('token');const SOORTEN=${JSON.stringify(Object.keys(INSTELLINGEN.soorten))};let actief=SOORTEN[0];
const tabs=document.getElementById('tabs');const lijst=document.getElementById('lijst');
const tekst=x=>String(x==null?'':x).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const dagNaam=iso=>new Date(iso+'T00:00:00').toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});
const wanneer=iso=>new Date(iso).toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const eindtijd=(t,d)=>{const [h,m]=t.split(':').map(Number);const e=h*60+m+Number(d||0);return String(Math.floor(e/60)).padStart(2,'0')+':'+String(e%60).padStart(2,'0')};
async function laad(){const r=await fetch('/api/'+actief+'?token='+encodeURIComponent(TOKEN));const j=await r.json();if(!j.ok){lijst.innerHTML='<p class="leeg">'+tekst(j.fout)+'</p>';return}
 tabs.innerHTML=SOORTEN.map(s=>'<button class="'+(s===actief?'actief':'')+'" data-s="'+s+'">'+(s==='boeking'?'Afspraken':'Aanvragen')+'</button>').join('');
 if(!j.items.length){lijst.innerHTML='<p class="leeg">Nog niets binnen.</p>';return}
 const kaart=it=>{const velden=Object.entries(it).filter(([k])=>!['id','soort','status','ontvangen','bijgewerkt','naam','telefoon','datum','tijd','duur','beurt','beurtNaam','prijs'].includes(k)&&it[k]);
  return '<article class="kaart '+(it.status===j.statussen[0]?'nieuw':'')+'"><div><h3>'+tekst(it.id)+' · '+tekst(it.naam)+' <span class="tel">'+tekst(it.telefoon)+'</span></h3>'
   +(it.datum?'<div><span class="slot">'+tekst(it.tijd)+' tot '+eindtijd(it.tijd,it.duur)+'</span> '+tekst(it.beurtNaam)+' · € '+tekst(it.prijs)+'</div>':'')
   +'<small>binnengekomen '+wanneer(it.ontvangen)+'</small>'
   +velden.map(([k,v])=>'<div><small>'+tekst(k)+':</small> '+tekst(v)+'</div>').join('')+'</div><div class="status">'
   +j.statussen.map(s=>'<button class="'+(s===it.status?'huidig':'')+'" data-id="'+it.id+'" data-status="'+s+'">'+s+'</button>').join('')+'</div></article>'};
 if(actief==='boeking'){const vandaag=new Date().toISOString().slice(0,10);const komend=j.items.filter(i=>i.datum>=vandaag&&i.status!=='geannuleerd').sort((a,b)=>(a.datum+a.tijd).localeCompare(b.datum+b.tijd));const rest=j.items.filter(i=>!komend.includes(i));
  let html='';let dag='';komend.forEach(it=>{if(it.datum!==dag){dag=it.datum;html+='<h2>'+dagNaam(dag)+'</h2>'}html+=kaart(it)});
  if(rest.length){html+='<h2>Afgerond of geannuleerd</h2>'+rest.map(kaart).join('')}
  lijst.innerHTML=html||'<p class="leeg">Nog geen afspraken.</p>'}
 else lijst.innerHTML=j.items.map(kaart).join('')}
tabs.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;actief=b.dataset.s;laad()});
lijst.addEventListener('click',async e=>{const b=e.target.closest('button[data-status]');if(!b)return;await fetch('/api/'+actief+'/'+b.dataset.id+'/status?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:b.dataset.status})});laad()});
laad();setInterval(laad,30000);
</script></html>`);
}

/* ---------- statisch ---------- */
function statisch(req, res, pad) {
  if (pad.startsWith('/_data') || pad.startsWith('/_bouw') || pad.includes('..') || pad === '/server.js') { res.writeHead(404); return res.end('Niet gevonden'); }
  let bestand = path.join(INSTELLINGEN.root, pad);
  if (pad === '/') bestand = path.join(INSTELLINGEN.root, 'index.html');
  else if (!path.extname(bestand) && fs.existsSync(bestand + '.html')) bestand += '.html';
  fs.readFile(bestand, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>Niet gevonden</h1>'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(bestand).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

/* ---------- server ---------- */
http.createServer(async (req, res) => {
  const pad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (pad === '/beheer') return beheerPagina(req, res);
    if (pad === '/api/agenda' && req.method === 'GET') return apiAgenda(req, res);
    const api = /^\/api\/([a-z]+)(?:\/([^/]+)\/status)?$/.exec(pad);
    if (api) {
      const [, soort, id] = api;
      if (id && req.method === 'POST') return await apiStatus(req, res, soort, id);
      if (req.method === 'POST') return await apiNieuw(req, res, soort);
      if (req.method === 'GET') return apiLijst(req, res, soort);
      return json(res, 405, { ok: false });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false });
    statisch(req, res, pad);
  } catch (e) {
    console.error(e);
    json(res, 500, { ok: false, fout: 'Er ging iets mis. Bel ons gerust.' });
  }
}).listen(INSTELLINGEN.poort, () => {
  console.log(`${INSTELLINGEN.bedrijf}: http://localhost:${INSTELLINGEN.poort}  (beheer: /beheer?token=${INSTELLINGEN.beheerToken})`);
  if (!process.env.BEHEER_TOKEN) console.log('Let op: BEHEER_TOKEN niet gezet, standaardwachtwoord actief. Zet hem in productie.');
});
