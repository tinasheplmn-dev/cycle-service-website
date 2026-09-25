# Cycle Service Sint-Oedenrode: website en onderhoudsplanner

Nieuwe site voor Cycle Service (Jay van der Kallen), Handelsweg 11, Sint-Oedenrode. Vervangt de Jimdo-site op cycle-service.nl. Gebouwd op 24 september 2026 met de website-bouwen skill. Dossier en onderzoek: `_bouw/dossier.md`.

## Het concept

**Kernbelofte:** je racefiets, MTB, gravelbike of e-bike rijdt weer als nieuw, bij één specialist die alleen sportieve fietsen doet, met vaste prijzen en een eigen online planner.

**Het ene idee: de werkplaats die draait.** De werkplaats werkt in vaste blokken (75, 90 of 180 minuten). De planner laat de echte agenda zien en zegt meteen hoe laat je fiets klaarstaat. Het kettingblad dat meedraait met de scroll (hero, slotband, paginakoppen) en de werkplaatslabels (de USP-kaarten met het oog en het touwtje, zoals de labels aan fietsen in de werkplaats) dragen dat idee visueel.

**Huisstijl**
- Navy `#0b1730` en `#14305e` van het gevelbord als drager; koel gebroken wit `#fafbfd` als achtergrond (de opdrachtgever wilde een lichte site).
- Kettingbladgeel `#c6f135` als enig accent: knoppen, markeringen en de verlopende rand (navy naar elektrisch blauw naar geel) op kaarten en beeldkaders. Gekozen omdat geel nog vrij was in het archief en de kleur letterlijk in de winkel zit (zadelwand, hi-vis fietskleding).
- Lettertypen: Big Shoulders Display (koppen, gecondenseerd en atletisch) en Hanken Grotesk (body). Beide zelf gehost in `assets/fonts/`, beide nieuw in het archief.
- Eigen iconenset in `assets/iconen.svg` (kettingblad als bullet-teken, sleutel, schijfrem, accu, agenda, enzovoort).
- Woordmerk: inline SVG in de header en footer, gebaseerd op het gevelbord (CYCLE SERVICE met RACE · MTB · GRAVEL · E-BIKES). Er was geen logobestand; vervang de SVG in `_bouw/kop.html`, `_bouw/voet.html` en `index.html` zodra er een definitief logo is.

## Pagina's

| Bestand | Doel |
|---|---|
| `index.html` | Overtuigen en laten plannen: hero met live planner-kaart, feiten, werkplaatslabels, drie beurten, stappen, Jay, reviews, fietsen, slotband |
| `werkplaats.html` | De drie beurten volledig uitgeschreven, aanvullend werk, garantie, losse reparaties |
| `planner.html` | De onderhoudsplanner (beurt, dag, brengtijd, gegevens, bevestiging met agenda-bestand) |
| `fietsen.html` | De acht fietsen op voorraad, merken en onderdelen, aanvraag via WhatsApp |
| `over.html` | Het verhaal van Jay, hoe hij werkt, de zaak |
| `contact.html` | Adres, kaart, openingstijden, contactformulier, veelgestelde vragen (met FAQ-structured data) |

De subpagina's worden gegenereerd uit `_bouw/paginas/*.html` plus de gedeelde kop en voet (`_bouw/kop.html`, `_bouw/voet.html`):

```bash
node _bouw/bouw.mjs
```

`index.html` is handgeschreven. Pas je het menu of de footer aan, doe dat dan in de partials én in `index.html`.

Geschrapt ten opzichte van de oude site: de koffiebar-pagina (opdracht: daar komt niemand speciaal voor; de koffie wordt één keer genoemd bij de zaak), de losse impressie- en galerijpagina's (beeld zit nu in de secties) en de Jimdo-webshop met PayPal (zie open punten).

## De onderhoudsplanner (powered by Mettafel)

`server.js` is een Node-server zonder dependencies die de site serveert én de planner draait.

- Agenda: dinsdag tot en met vrijdag, 7.30 tot 15.30 uur (8 uur per dag, zoals de eigenaar vroeg), starttijden per kwartier. Eén fiets tegelijk in de werkplaats: blokken overlappen nooit. Instelbaar bovenin `server.js` (`INSTELLINGEN.agenda`), inclusief sluitingsperiodes (`gesloten`) en de minimale tijd vooraf (18 uur).
- Beurten met duur en prijs in `INSTELLINGEN.beurten`.
- `GET /api/agenda?van=&tot=` geeft per dag de bezette blokken (zonder persoonsgegevens); de kalender toont alleen dagen waarop de gekozen beurt nog past.
- `POST /api/boeking` valideert (werkdag, binnen de uren, geen overlap, niet te dichtbij) en slaat op in `_data/boeking.json`. `POST /api/aanvraag` is het contactformulier.
- Beheer: `/beheer?token=...` toont de komende afspraken per dag met statusknoppen (nieuw, bevestigd, in de werkplaats, klaar, opgehaald, geannuleerd). Standaardwachtwoord `cycleservice`; zet in productie `BEHEER_TOKEN`.
- Melding bij een nieuwe afspraak: zet `MELDING_URL` (webhook, bijvoorbeeld een Zapier- of Make-hook naar mail of WhatsApp). Zonder die instelling werkt alles, alleen zonder push.
- De hero-kaart op de homepage haalt de eerstvolgende vrije plek live uit dezelfde agenda.
- Fail-open: zonder JavaScript staat er een WhatsApp-knop met een voorgevuld planbericht.

Getest op 24 september 2026: boeking van begin tot bevestiging, overlap wordt geweigerd, beheerpagina toont de afspraak. Testdata is verwijderd.

## Lokaal draaien

```bash
node server.js
```

Draait op http://localhost:8141 (of `PORT`). In de Claude-app: preview `cycleservice` in `.claude/launch.json`.

## Uitrollen

De site heeft een Node-host nodig vanwege de planner: Railway, Render, Fly of een VPS. Start `node server.js` met de omgevingsvariabelen `PORT`, `BEHEER_TOKEN` en optioneel `MELDING_URL`. `vercel.json` staat erbij voor het geval alleen het statische deel ergens moet staan, maar dan werkt de planner niet.

`_data/` moet op een persistente schijf staan (Railway volume of vergelijkbaar), anders zijn afspraken weg bij een herstart.

## Domein en mail overzetten vanaf Jimdo

De eigenaar stelt dit als eerste eis: het domein moet mee en de mailboxen moeten blijven werken. Stappenplan:

1. **Kijk waar het domein staat.** Bij Jimdo is het domein meestal via Jimdo geregistreerd. Vraag in het Jimdo-dashboard (Domeinen en e-mail) de **autorisatiecode (EPP/auth-code)** op en zet de domeinvergrendeling uit. Jimdo geeft die code alleen aan de accounthouder, dus Jay doet dit zelf of geeft toegang.
2. **Kies de nieuwe registrar** (TransIP, Mijndomein, Cloudflare Registrar). Start daar de verhuizing met de auth-code. Een .nl-verhuizing is meestal binnen een uur rond.
3. **Mail eerst regelen, vóór de verhuizing.** De mailboxen van Jimdo (`@cycle-service.nl`) stoppen zodra het Jimdo-abonnement stopt. Maak dus eerst nieuwe mailboxen aan bij de nieuwe partij (TransIP e-mail, Google Workspace of Microsoft 365), maak dezelfde adressen aan (in elk geval `info@cycle-service.nl`), en laat Jay zijn oude mail exporteren (IMAP-kopie via Mail of Outlook). Zet daarna de MX-records op de nieuwe mailprovider. Tip: doe dit op een moment dat er weinig mail binnenkomt en houd het Jimdo-abonnement nog een maand aan als vangnet.
4. **DNS voor de site:** A- of CNAME-record naar de host van `server.js` (Railway geeft een CNAME-doel). `www` naar hetzelfde. SSL regelt de host.
5. **Controleer** na de overstap: mail sturen én ontvangen op `info@cycle-service.nl`, de site op www en zonder www, en de planner (`/api/agenda`).
6. **Google-bedrijfsprofiel:** website-URL blijft gelijk; controleer of de openingstijden daar gelijk zijn aan de site (Google zegt "gesloten" op maandag en donderdag, de site zegt "op afspraak").

Let op: op de huidige site toont de contactpagina `info@cycle-service.nl`, maar de mailto-link wijst naar `cycle-service@outlook.com`. Bevestig welk adres leidend is (zie open punten).

## Beeld

- Eigen foto's (WhatsApp-kwaliteit, 1200 tot 2000 px): pand (drone), gevelbord, Jay voor de deur, winkel met bar, werkplaats, onderdelenwand. In `assets/img/` als webp op 700 tot 1600 breed.
- **Fietsfoto's:** de acht productfoto's van de huidige Jimdo-winkelpagina, opgehaald van het Jimdo-CDN op 24 september 2026 en lokaal opgeslagen als `assets/img/fiets-*.webp` (800 px). Het zijn eigen foto's van Jay: elke fiets staat voor de gevel van de zaak, met "Cycle Service" op de ramen. Gekoppeld aan de fietsen op de volgorde waarin ze op de winkelpagina staan; die koppeling staat als open punt om te bevestigen.
- **Merklogo's** in `assets/img/merken/` (Mondraker, Berria en Superior als SVG, Q'Motiv en Gemini als PNG), gedownload van de officiële merksites. Bronnen en kanttekeningen: `assets/img/merken/manifest.md`. Ze staan als trust badges onder de kop "Samenwerkingen met o.a." op de homepage en de fietsenpagina, in één grijstint en op 72 procent dekking zodat ze de pagina niet overheersen.
- Stockbeeld van Unsplash (gratis licentie), bewust koel daglicht en zonder Alpen-romantiek: racefietsers op de weg (hero), gravel in het bos, MTB, e-bike display, cassette, monteur met momentsleutel. Bronnen en fotografen: `_bouw/stock-manifest.md`.
- OG-beeld: `assets/img/og.jpg` (1200 bij 630), gerenderd uit `_bouw/og.html`.
- Favicon en apple-touch-icon in `assets/`.

## Wijzigingen na de eerste oplevering (24 september 2026)

- Fietsfoto's van de huidige winkelpagina toegevoegd aan de kaarten op de homepage en de fietsenpagina.
- Prijs en type staan nu in een vaste voet onderaan elke fietskaart, met een gestippelde scheidingslijn. Daardoor staan alle prijzen in een rij exact op dezelfde hoogte, ongeacht de lengte van de specificaties.
- De foto's in de drie werkplaatslabels sluiten nu aan op de onderrand van de kaart (de kaart is een flexkolom, het beeld heeft `margin-top: auto`). De witte strook onder de foto's op desktop is daarmee weg.
- De foto bij "Geen tijd? Wij halen hem op" toont nu een fiets die op een auto wordt geladen, in plaats van een gravelfiets in het bos.
- De merkenrij is vervangen door echte merklogo's als trust badges, met het bijschrift "Samenwerkingen met o.a.".

**Tweede correctieronde (zelfde dag)**

- **Contrastfout op alle subpagina's hersteld.** De introzin onder de kop van werkplaats, planner, fietsen, over en contact stond in de grijstint voor lichte achtergronden, terwijl die koppen een navy achtergrond hebben. Daardoor was die zin nauwelijks leesbaar. De regel in `css/style.css` dekt nu ook `.pagina-kop` en `.hero`. Oorzaak dat het bleef staan: bij de eerste oplevering had ik het contrast alleen op de homepage en de planner gemeten, niet op elke pagina. Nu op alle zes gemeten, alle schoon.
- **Klassenbotsing opgelost.** De voet van een fietskaart heette `.voet`, net als de footer van de site. Daardoor kreeg die kaartvoet de achtergrond en de padding van de footer, met onleesbare tekst erin. De kaartvoet heet nu `.kaartvoet` en is bewust donker vormgegeven: navy balk, prijs in wit, type in de lichte grijstint met een geel icoon.
- **Prijzenkader bij het aanvullende werk** oogde los omdat de ruimte tussen de secties bovenop de eigen regelafstand kwam. De regels zitten nu in een `.prijslijst` zonder extra ruimte, en de prijs kan niet meer buiten het kader vallen (`minmax(0, 1fr)` plus `justify-self: end`).
- **Koppen op twee regels.** De drie beurt-koppen breken nu op een gekozen plek (`<span class="regel">`), zodat ze gelijkmatig over twee regels staan in plaats van een korte en een volle regel. Op mobiel vervalt die breuk. De koppen van de over- en fietsenpagina waren tien en elf woorden en liepen over drie regels; die zijn ingekort tot "Een fietsenmaker die zelf fietst" en "Een fiets die bij jouw ritten past".
- **Prijsblok per beurt** (prijs groot, duur ernaast, afsluitende lijn eronder) in plaats van losse tekst direct onder de kop.
- Footerlinks en inline links in hulpteksten zijn nu minimaal 24 pixels hoog.

## Keuring en controle

`node ~/.claude/skills/website-bouwen/scripts/keuring.mjs .` gaf 0 fouten. Waarschuwingen die bewust blijven staan: `opacity` op twee decoratieve SVG-elementen (het kettingblad en het touwtje van het label, geen tekst) en "geen JSON-LD" op subpagina's (die hebben nu BreadcrumbList; de contactpagina ook FAQPage). In de browser gemeten op 1440 en 390: geen horizontale scroll, hero-kop 115 px op desktop en 48 px op mobiel, bullets één regel, contrast van alle tekst minimaal 7:1 (de sterren en stapnummers zijn na de meting van goud en verloop naar navy en geel gezet). Reveals fail-open (`?foto=1` toont alles statisch).

## Open punten (bevestigen of aanleveren)

1. **De 39 Google-reviews.** De bijlage met reviews zat niet bij de opdracht. Nu staan de zes reviews op de site die publiek leesbaar waren (drie met naam, drie zonder). Lever de rest als tekst met naam, dan zet ik ze in de reviewsectie op de homepage.
2. **E-mailadres:** `info@cycle-service.nl` (op de site) of `cycle-service@outlook.com` (de werkende link op de oude site)?
3. **Plannerwindow:** 7.30 tot 15.30 uur, dinsdag tot en met vrijdag, één fiets tegelijk. Klopt dat? Aanpassen kan bovenin `server.js`.
4. **Sluiting 26 september tot 10 oktober** staat op de oude site en is in de planner geblokkeerd. Klopt dat voor 2026?
5. **Naam van de tweede persoon** op de foto voor de deur (nu alleen Jay genoemd).
6. **Instagram-handle** (bestaat, niet geverifieerd; nu alleen Facebook in de footer).
7. **Fietsfoto's:** elke fiets heeft nu de foto van de huidige winkelpagina. De koppeling foto-fiets volgt de volgorde van die pagina; loop ze één keer na of elke foto bij de juiste fiets staat (vooral de twee Berria's en de twee Mondraker Arids lijken op elkaar).
8. **Q'Motiv-logo** is maar 191 pixels breed, het enige formaat dat het merk aanbiedt. Op een scherm met hoge resolutie kan het iets zachter ogen. Vraag Q'Motiv om een SVG of een grotere PNG.
9. **Webshop:** de Jimdo-webshop (Mondraker-modellen, Gemini-onderdelen, PayPal) is niet nagebouwd; de fietsenpagina werkt met een aanvraag via WhatsApp. Wil Jay online verkopen, dan is een eigen bestelsysteem (zelfde backendpatroon) of een lichte shop de volgende stap.
10. **Juridische pagina's:** impressum, herroepingsrecht en algemene voorwaarden staan op de oude site nog als Jimdo-placeholder. Zonder webshop zijn ze niet nodig; met webshop wel.
11. **Tarieven** bevestigen vóór livegang (€ 69, € 159, € 85 en de toeslagen).
12. **Betaling en mailbevestiging:** de planner slaat op en meldt via webhook; automatische bevestigingsmail naar de klant (via `MELDING_URL` of een mail-API) is de logische volgende stap.
