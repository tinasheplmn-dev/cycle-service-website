# Cycle Service Sint-Oedenrode: website en onderhoudsplanner

Nieuwe site voor Cycle Service (Jay van der Kallen), Handelsweg 11, Sint-Oedenrode. Vervangt de Jimdo-site op cycle-service.nl. Gebouwd op 24 september 2026 met de website-bouwen skill. Dossier en onderzoek: `_bouw/dossier.md`.

## Het concept

**Kernbelofte:** je racefiets, MTB, gravelbike of e-bike rijdt weer als nieuw, bij één specialist die alleen sportieve fietsen doet, met vaste prijzen en een eigen online planner.

**Het ene idee: de werkplaats die draait.** De werkplaats werkt in vaste blokken (75, 90 of 180 minuten). De planner laat de echte agenda zien en zegt meteen hoe laat je fiets klaarstaat. Het kettingblad dat meedraait met de scroll (hero, slotband, paginakoppen) en de werkplaatslabels (de USP-kaarten met het oog en het touwtje, zoals de labels aan fietsen in de werkplaats) dragen dat idee visueel.

**Huisstijl**
- Navy `#0b1730` en `#14305e` van het gevelbord als drager; koel gebroken wit `#fafbfd` als achtergrond (de opdrachtgever wilde een lichte site).
- Lichtblauw `#8fd3fe` (diepere tint `#6cc2f8`) als accent: knoppen, markeringen en de verlopende rand (navy naar elektrisch blauw naar lichtblauw) op kaarten en beeldkaders. Tot 19 oktober 2026 was dit kettingbladgeel `#c6f135`; Jay vond dat te veel een AI-look hebben en vroeg om lichtblauw.
- Lettertypen: Big Shoulders Display (koppen, gecondenseerd en atletisch) en Hanken Grotesk (body). Beide zelf gehost in `assets/fonts/`, beide nieuw in het archief.
- Eigen iconenset in `assets/iconen.svg` (kettingblad als bullet-teken, sleutel, schijfrem, accu, agenda, enzovoort).
- Logo (nieuw, 19 oktober 2026): een kettingblad-C met een blauwe naaf naast het woordmerk CYCLE SERVICE en de regel RACE · MTB · GRAVEL · E-BIKES. De letters zijn omgezet naar paden, dus het logo hangt niet af van een geladen lettertype. Bestanden: `assets/logo.svg` (op licht), `assets/logo-wit.svg` (op donker), `assets/favicon.svg`, `assets/apple-touch-icon.png` en `assets/favicon-192.png`. Een ander logo vervang je in die bestanden; de HTML hoeft niet mee te veranderen.

## Pagina's

| Bestand | Doel |
|---|---|
| `index.html` | Overtuigen en laten plannen: hero met live planner-kaart, feiten, werkplaatslabels, drie beurten, stappen, Jay, reviews, fietsen, slotband |
| `werkplaats.html` | De drie beurten volledig uitgeschreven, aanvullend werk, garantie, losse reparaties |
| `planner.html` | Voorportaal van de online reparatieplanner van CycleSoftware: drie stappen, de beurten met prijs, knop naar de planner |
| `fietsen.html` | De shop: 20 producten (fietsen op voorraad, Mondraker-modellen, Gemini-onderdelen) met filters en winkelwagen |
| `afrekenen.html` | Checkout: overzicht, gegevens, afhalen of verzenden, betalen (noindex) |
| `voorwaarden.html` | Bestellen, levering, retourbeleid, herroepingsbeleid met modelformulier, wettelijke garantie |
| `over.html` | Het verhaal van Jay, hoe hij werkt, de zaak |
| `contact.html` | Adres, kaart, openingstijden, contactformulier, veelgestelde vragen (met FAQ-structured data) |
| `shop-<id>.html` | Eén pagina per product: foto's, prijs, voorraad, keuzes, specificaties, omschrijving, gerelateerde producten, Product-structured data |

De subpagina's worden gegenereerd uit `_bouw/paginas/*.html` plus de gedeelde kop en voet (`_bouw/kop.html`, `_bouw/voet.html`):

```bash
node _bouw/bouw.mjs
```

`index.html` is handgeschreven, maar de kop, de voet, de uitgelichte fietsen en de catalogus worden door de bouwstap ingevuld (tussen de markeringen `<!-- kop:start -->` enzovoort). Menu of footer pas je dus alleen in de partials aan. De bouwstap maakt ook de productpagina's en `sitemap.xml`.

Elke tekst en elke foto heeft een vaste sleutel (`data-cms="home-12"`), zodat Jay hem in het beheer kan aanpassen. Voeg je een nieuwe sectie toe, draai dan eerst `node _bouw/annoteer.mjs` en daarna `node _bouw/bouw.mjs`. Bestaande sleutels blijven staan.

Geschrapt ten opzichte van de oude site: de koffiebar-pagina (opdracht: daar komt niemand speciaal voor; de koffie wordt één keer genoemd bij de zaak), de losse impressie- en galerijpagina's (beeld zit nu in de secties) en PayPal (de webshop zelf is wel nagebouwd, zie hieronder).

## De webshop (powered by Mettafel)

Winkelwagen en checkout zijn compleet. Alleen de betaalprovider moet nog gekoppeld worden.

**Catalogus.** Jay beheert de producten in het beheer (zie hieronder); die staan dan in `DATA_MAP/producten.json`. `_bouw/producten.json` is de beginstand en de bron voor de statische versie. Velden: id, merk, naam, categorie (race, gravel, mtb, ebike, onderdelen), staat (nieuw, occasion, demo), prijs, voorraad, levering (`afhalen` of `verzenden`), foto, spec en eventueel `opties`. Voor de statische versie draai je na een wijziging `node _bouw/bouw.mjs`. De server leest de catalogus live en rekent elke bestelling zelf opnieuw uit, dus een prijs in de browser aanpassen werkt niet.

**Varianten.** `opties` is een lijst zoals `[{"naam": "Kleur", "waarden": ["Team Issue"]}, {"naam": "Maat", "waarden": ["S","M","L","XL"]}]`. Zet er alleen leverbare waarden in. Eén waarde verschijnt als vaste tekst, meerdere als keuzemenu. De server weigert een variant die niet in de lijst staat.

**Filters** op de shoppagina: categorie (ook via de link, bijvoorbeeld `fietsen.html#onderdelen`), merk, nieuw of gebruikt, sorteren op prijs en alleen op voorraad.

**Winkelwagen.** Het paneel schuift van rechts in en de teller staat in de header. De inhoud wordt op het toestel bewaard (`localStorage`). Je kunt maximaal één stuk per fiets in een bepaalde maat bestellen en tien per onderdeel.

**Levering.** Fietsen worden altijd afgehaald, rijklaar afgesteld. Onderdelen kunnen ook verzonden worden, binnen Nederland, zoals op de oude site: gratis vanaf € 100, levertijd 1 tot 4 werkdagen. Het bedrag onder € 100 is niet bekend, dus verzenden kan nu alleen vanaf € 100. Alle huidige onderdelen kosten meer dan dat. Instellen in `server.js`, `INSTELLINGEN.winkel.verzenden` (`gratisVanaf`, `kosten`).

**Betalen.** Standaard (`BETAALPROVIDER=geen`) komt de bestelling binnen als "nieuw". De klant betaalt dan bij het ophalen, of Jay stuurt een betaalverzoek. Online betalen met iDEAL, Bancontact en creditcard via Mollie zet je zo aan:

1. Maak een Mollie-account aan en kopieer de API-sleutel (eerst `test_...`, na goedkeuring `live_...`).
2. Zet op de host `BETAALPROVIDER=mollie`, `MOLLIE_API_KEY=...` en `BASIS_URL=https://www.cycle-service.nl`.
3. Herstart. De checkout toont dan "Bestellen en betalen" en stuurt door naar Mollie. Na het betalen keert de klant terug op `afrekenen.html`, die de status ophaalt. Mollie meldt de betaling ook via `POST /api/betaling/webhook`.

Een andere provider koppelen? Vervang dan `startBetaling` en `ververs` in `winkel.js`; de rest blijft gelijk.

**Bestellingen** komen binnen in het beheer (tabblad Bestellingen) met de statusknoppen nieuw, wacht op betaling, betaald, klaar om op te halen, verzonden, afgerond en geannuleerd. Een nieuwe bestelling gaat ook naar `MELDING_URL`.

**Zonder server** (bijvoorbeeld op GitHub Pages) werkt de winkelwagen gewoon. Bij het afrekenen opent dan een WhatsApp-bericht aan Jay met de bestelling.

## Beheer voor Jay (sinds 28 oktober 2026)

Op `/beheer` logt Jay in met een wachtwoord. Werkt alleen met de Node-server (niet op GitHub Pages). Wat hij kan:

| Tabblad | Wat |
|---|---|
| Overzicht | Nieuwe bestellingen en berichten, aantal producten op voorraad, laatste wijzigingen |
| Producten | Toevoegen, aanpassen en verwijderen. Prijs en voorraad direct in de lijst, ster = op de homepage (maximaal vier), volgorde met pijltjes. Per product: merk, naam, maat, categorie, staat, prijs, levering, hoofdfoto en tot acht extra foto's, korte zin, kenmerken, omschrijving, keuzes (maat, kleur), eigen titel en omschrijving voor Google, EAN |
| Teksten en foto's | Opent een pagina in bewerkmodus (`/<pagina>?bewerken=1`): klik op een tekst om hem te typen (vet en cursief kan), klik op een foto om hem te vervangen en de beschrijving aan te passen. Per tekst of foto "Origineel terug". Kop en voet gelden op alle pagina's |
| Prijzen en verzenden | De drie beurtprijzen op één plek: ze veranderen overal (alle pagina's, footer, structured data, meta-omschrijvingen). Verzenden aan of uit, gratis vanaf, kosten daaronder |
| Vindbaar in Google | Per pagina titel en omschrijving met tekenteller en Google-voorbeeld |
| Bestellingen, Berichten | Afhandelen met statusknoppen |
| Instellingen | Wachtwoord wijzigen, eerdere versies terugzetten (de laatste 40 van producten en van teksten/prijzen/SEO), logboek van alles wat in het beheer is gebeurd |

Foto's worden in de browser verkleind naar 1600 en 800 pixels breed en als WebP opgeslagen (Safari: JPEG). Ze komen in `DATA_MAP/media/` en staan op de site met `srcset`.

Hoe het werkt: de server maakt elke pagina uit de gebouwde HTML plus `DATA_MAP/inhoud.json` (teksten, foto's, prijzen, SEO) en `DATA_MAP/producten.json`, en cachet het resultaat tot er iets verandert. Code: `server.js` (pagina's maken, beveiliging, cache), `beheer.js` (inloggen en API), `_beheer/` (dashboard en bewerkmodus), `_bouw/html.js` (HTML lezen en teksten veilig maken), `_bouw/sjabloon.js` en `_bouw/regio.js` (gedeeld met de bouwstap).

## SEO

- Per pagina: title, meta description, canonical, robots, Open Graph (ook `og:site_name`), Twitter-card, `theme-color`, webmanifest.
- Structured data: BikeStore met adres, openingstijden, reviews en de beurten met actuele prijs (homepage), BreadcrumbList (alle pagina's), FAQPage (contact), ItemList (shop) en per product een Product met merk, prijs, voorraad, staat, retourbeleid (14 dagen) en verzending of afhalen.
- Eigen pagina per product (`shop-<id>.html`) met een unieke titel en omschrijving, ingekort tot wat Google toont.
- `sitemap.xml` komt live uit de catalogus (met productfoto's); `robots.txt` sluit beheer, API, afrekenen en de bewerkmodus uit.
- Een verwijderd product geeft een echte 404 met een link naar de shop.

## Beveiliging

- Headers op elke pagina: Content-Security-Policy (alleen eigen scripts, geen inline JavaScript), `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` en HSTS op https.
- Broncode, `_data`, `_bouw`, `.git` en verborgen bestanden worden nooit uitgeleverd; pad-trucs (`../`) geven 404.
- Inloggen: wachtwoord met scrypt gehasht; het eerste wachtwoord moet bij de eerste keer inloggen vervangen worden (minstens 10 tekens). Sessie in een HttpOnly-cookie, SameSite=Strict, Secure op https, 12 uur geldig en 2 uur zonder activiteit. Na 5 mislukte pogingen is inloggen vanaf dat IP 15 minuten dicht, na 100 mislukte pogingen in totaal voor iedereen. Het IP komt van de proxy zelf (de laatste waarde in `X-Forwarded-For`), zodat een bezoeker het niet kan vervalsen.
- Elke wijziging in het beheer vraagt een CSRF-token en een Origin van de eigen site.
- Teksten uit het beheer gaan door een filter die alleen opmaak binnen een regel toelaat (vet, cursief, links naar http, mail of telefoon). Uploads moeten echt WebP, JPEG of PNG zijn (gecontroleerd op de inhoud, niet de naam), maximaal 6 MB, met een willekeurige bestandsnaam.
- Limieten per IP: 600 verzoeken per minuut, 60 wijzigende verzoeken per minuut, 6 bestellingen en 5 contactberichten per 10 minuten. Honeypot in het contactformulier. Invoer wordt ingekort en ontdaan van HTML.
- Getest op 28 oktober 2026: fout wachtwoord, geen sessie, geen CSRF-token, andere Origin, XSS in een tekst (`<script>`, `onerror`, `javascript:` ook met een tab ertussen), `$'` in een SEO-titel, een nep-afbeelding, te grote verzoeken (nette 413), een vervalst IP en pad-trucs (ook `/%2Fserver.js`) worden allemaal goed afgehandeld. Een onafhankelijke review vond negen punten; alle negen zijn opgelost.

## Snelheid en mobiel

- gzip en brotli voor HTML, CSS, JS, SVG en XML; ETags met 304; CSS wordt licht verkleind.
- CSS, JS en de iconen krijgen een versie in de URL (`?v=`), zodat de browser ze een jaar mag bewaren en toch meteen de nieuwe versie ziet na een wijziging. Foto's 30 dagen, lettertypen en uploads een jaar.
- Foto's: de zwaarste WebP's opnieuw gecomprimeerd (ongeveer 500 KB minder, geen zichtbaar verschil), kleinere varianten voor mobiel met `srcset` en `sizes`, `loading="lazy"` en `decoding="async"`, de hero-foto vooraf geladen per schermbreedte.
- Gemeten op 390 breed: HTML 4 tot 9 KB gecomprimeerd, een subpagina in totaal ongeveer 105 KB, geen horizontale scroll, tikdoelen in footer, kruimelpad en kaarten minstens 44 px, keuzemenu's 16 px (geen inzoomen op iPhone). Het beheer werkt ook op een telefoon.

## Plannen via CycleSoftware (sinds 28 oktober 2026)

Afspraken lopen via de online reparatieplanner van CycleSoftware: https://accounts.twsc.nl/cycle-service-sint-oedenrode/. Jay wil dat systeem houden.

- **Waarom geen ingebouwd venster (iframe).** Getest op 28 oktober 2026. In een iframe loopt de planner vast: hij stuurt 21 keer door tussen `www.twsc.nl` en `accounts.twsc.nl` en geeft dan een foutpagina. Oorzaak: zijn sessie hangt aan cookies die een browser in een ingebouwd venster van een andere site niet meestuurt (een cookie zonder `SameSite=None`, en Safari blokkeert ze sowieso). CycleSoftware biedt geen officiële embedcode.
- **Wat er nu staat.** `planner.html` is een voorportaal in de huisstijl: drie stappen (inloggen, reparatie plannen, prijsopgave van Jay), de drie beurten met prijs, en één knop "Open de reparatieplanner". Op een groot scherm opent die knop de planner in een eigen venster naast de site, op mobiel in een nieuw tabblad (`js/planner.js`). Komt iemand via `planner.html?beurt=onderhoud`, dan licht die beurt op.
- **Alle "Plan je beurt"-knoppen** op de site wijzen naar `planner.html`. De kaart in de header toont geen "eerstvolgende vrije plek" meer (die kwam uit de eigen agenda).
- **Biedt CycleSoftware later wel een widget of embedcode?** Vraag het na bij CycleSoftware. Dan kan het venster alsnog in `planner.html`.

De eigen planner van Mettafel (agenda, boekingen) is op 28 oktober 2026 uit `server.js` gehaald; geen pagina gebruikte hem nog. Hij staat in de git-geschiedenis als hij ooit terug moet.

## Lokaal draaien

```bash
node server.js
```

Draait op http://localhost:8141 (of `PORT`). Het beheer staat op `/beheer`. Zonder `BEHEER_WACHTWOORD` maakt de server bij de eerste start een willekeurig wachtwoord; dat staat in de console en in `_data/eerste-wachtwoord.txt`. Bij de eerste keer inloggen kies je een eigen wachtwoord, en dan verdwijnt dat bestand.

## Uitrollen

De site heeft een Node-host nodig voor de webshop en het beheer: Railway, Render, Fly of een VPS. Start `node server.js` (Node 18 of nieuwer, geen dependencies) met:

| Variabele | Waarvoor |
|---|---|
| `PORT` | poort (de host zet hem meestal zelf) |
| `BASIS_URL` | `https://www.cycle-service.nl`; zet https-cookies, HSTS en de Mollie-adressen aan |
| `BEHEER_WACHTWOORD` | eerste wachtwoord voor het beheer (aanbevolen; zonder deze variabele staat een willekeurig wachtwoord in `DATA_MAP/eerste-wachtwoord.txt`) |
| `DATA_MAP` | map op een persistente schijf (Railway volume), anders zijn bestellingen, producten, teksten en foto's weg na een herstart |
| `MELDING_URL` | optioneel: webhook voor een melding bij een nieuwe bestelling of een nieuw bericht |
| `BETAALPROVIDER`, `MOLLIE_API_KEY` | online betalen, zie "De webshop" |

Wachtwoord vergeten: zet `BEHEER_WACHTWOORD` op een nieuw wachtwoord plus `BEHEER_RESET=1`, herstart, log in en haal `BEHEER_RESET` weer weg.

Na een herstart moet Jay opnieuw inloggen (sessies staan in het geheugen). `vercel.json` en GitHub Pages tonen alleen de statische versie: zonder beheer en zonder online bestellen (de winkelwagen valt dan terug op WhatsApp).

## Domein en mail overzetten vanaf Jimdo

**Status: gebeurt als laatste**, na akkoord op de site. Het stappenplan hieronder ligt klaar.

De eigenaar stelt dit als eerste eis: het domein moet mee en de mailboxen moeten blijven werken. Stappenplan:

1. **Kijk waar het domein staat.** Bij Jimdo is het domein meestal via Jimdo geregistreerd. Vraag in het Jimdo-dashboard (Domeinen en e-mail) de **autorisatiecode (EPP/auth-code)** op en zet de domeinvergrendeling uit. Jimdo geeft die code alleen aan de accounthouder, dus Jay doet dit zelf of geeft toegang.
2. **Kies de nieuwe registrar** (TransIP, Mijndomein, Cloudflare Registrar). Start daar de verhuizing met de auth-code. Een .nl-verhuizing is meestal binnen een uur rond.
3. **Mail eerst regelen, vóór de verhuizing.** De mailboxen van Jimdo (`@cycle-service.nl`) stoppen zodra het Jimdo-abonnement stopt. Maak dus eerst nieuwe mailboxen aan bij de nieuwe partij (TransIP e-mail, Google Workspace of Microsoft 365), maak dezelfde adressen aan (in elk geval `info@cycle-service.nl`), en laat Jay zijn oude mail exporteren (IMAP-kopie via Mail of Outlook). Zet daarna de MX-records op de nieuwe mailprovider. Tip: doe dit op een moment dat er weinig mail binnenkomt en houd het Jimdo-abonnement nog een maand aan als vangnet.
4. **DNS voor de site:** A- of CNAME-record naar de host van `server.js` (Railway geeft een CNAME-doel). `www` naar hetzelfde. SSL regelt de host.
5. **Controleer** na de overstap: mail sturen én ontvangen op `info@cycle-service.nl`, de site op www en zonder www, en de planner (`/api/agenda`).
6. **Google-bedrijfsprofiel:** website-URL blijft gelijk; controleer of de openingstijden daar gelijk zijn aan de site (Google zegt "gesloten" op maandag en donderdag, de site zegt "op afspraak").

Let op: op de oude site wees de mailto-link naar `cycle-service@outlook.com`. Leidend is `info@cycle-service.nl` (bevestigd op 19 oktober 2026); zorg dat die mailbox na de verhuizing werkt.

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

## Wijzigingen na feedback van Jay (19 oktober 2026)

- **Nieuw logo**, zie Huisstijl.
- **Groen/geel wordt lichtblauw** in de hele site, inclusief iconen, verlopen, favicon en deelafbeelding (`assets/img/og.jpg`, opnieuw gemaakt uit `_bouw/og.html`).
- **Vijf stappen in plaats van vier:** stap 4 is nu "Prijsopgave per e-mail". Jay mailt vooraf een prijsopgave en begint pas na akkoord. Dezelfde belofte staat ook in de planner-bevestiging, het werkplaatslabel en de veelgestelde vragen op de contactpagina.
- **Shop met filters**, en de twaalf producten van de Jimdo-webshop toegevoegd: drie Gemini-onderdelen en negen Mondraker-modellen. Alleen de varianten die daar leverbaar waren, zijn te kiezen. De zes modellen die daar "niet op voorraad" stonden, tonen het label "Op bestelling" en de knop "Vraag naar levertijd". De productfoto's zijn de merkfoto's van de oude shop (`assets/img/shop-*.webp`).
- **Winkelwagen, checkout en beheer van bestellingen** gebouwd; alleen de betaalprovider moet nog gekoppeld worden.
- **Voorwaardenpagina** met de retour-, herroepings- en garantieteksten van de oude site. De open plek in het herroepingsbeleid van Jimdo ("naam van de webshop-eigenaar...") is ingevuld met de gegevens van Cycle Service.
- **Planner en domein** in de wacht, zie hierboven.

## Keuring en controle

Op 28 oktober 2026 opnieuw: 0 fouten. Nieuwe waarschuwingen zijn verwacht: het beheer heeft geen canonical, og:image en structured data (het staat op noindex), en de sitemap mist `afrekenen.html` (ook noindex). `node ~/.claude/skills/website-bouwen/scripts/keuring.mjs .` gaf eerder ook 0 fouten. Waarschuwingen die bewust blijven staan: `opacity` op twee decoratieve SVG-elementen (het kettingblad en het touwtje van het label, geen tekst) en "geen JSON-LD" op subpagina's (die hebben nu BreadcrumbList; de contactpagina ook FAQPage). In de browser gemeten op 1440 en 390: geen horizontale scroll, hero-kop 115 px op desktop en 48 px op mobiel, bullets één regel, contrast van alle tekst minimaal 7:1 (de sterren en stapnummers zijn na de meting van goud en verloop naar navy en geel gezet). Reveals fail-open (`?foto=1` toont alles statisch).

## Open punten (bevestigen of aanleveren)

1. **De 39 Google-reviews.** De bijlage met reviews zat niet bij de opdracht. Nu staan de zes reviews op de site die publiek leesbaar waren (drie met naam, drie zonder). Lever de rest als tekst met naam, dan zet ik ze in de reviewsectie op de homepage.
2. **E-mailadres:** bevestigd op 19 oktober 2026: `info@cycle-service.nl` is leidend. Dat staat overal op de site. Let bij de domeinverhuizing op dat deze mailbox blijft werken.
3. **Naam van de tweede persoon** op de foto voor de deur (nu alleen Jay genoemd).
4. **Instagram-handle** (bestaat, niet geverifieerd; nu alleen Facebook in de footer).
5. **Fietsfoto's:** elke fiets heeft nu de foto van de huidige winkelpagina. De koppeling foto-fiets volgt de volgorde van die pagina; loop ze één keer na of elke foto bij de juiste fiets staat (vooral de twee Berria's en de twee Mondraker Arids lijken op elkaar).
6. **Q'Motiv-logo** is maar 191 pixels breed, het enige formaat dat het merk aanbiedt. Op een scherm met hoge resolutie kan het iets zachter ogen. Vraag Q'Motiv om een SVG of een grotere PNG.
7. **Betaalprovider:** Mollie aanvragen (KvK-nummer en bankrekening nodig), dan de drie omgevingsvariabelen zetten. Zie "De webshop".
8. **Algemene voorwaarden, KvK-nummer en btw-nummer:** die stonden op de oude site alleen als Jimdo-placeholder. Voor een webshop moeten ze er wel staan. Lever ze aan, dan komen ze op `voorwaarden.html` en in de footer.
9. **Verzendkosten onder € 100**, en of verzenden naar België of de rest van de EU moet kunnen. De oude site noemde alleen "gratis boven € 100" en "alleen EU".
10. **Webshopprijzen en voorraad:** overgenomen van de oude shop op 19 oktober 2026. Loop ze na, vooral de Mondraker Arid Carbon R: die staat er twee keer, één keer op voorraad in de winkel (maat M, € 3.499) en één keer als nieuw model op bestelling (€ 4.499). Klopt dat?
11. **Retouradres en terugbetaaltermijn:** het retourbeleid zegt "terugbetaling binnen 5 werkdagen" en het herroepingsbeleid "uiterlijk binnen veertien dagen". Dat botst niet, maar kies bij voorkeur één termijn.
12. **Productfoto's:** de Mondraker- en Gemini-foto's zijn merkfoto's. Bevestig dat Jay ze als dealer mag gebruiken (meestal wel).
13. **Tarieven** bevestigen vóór livegang (€ 69, € 159, € 85 en de toeslagen). Jay past ze daarna zelf aan in het beheer.
14. **Bevestigingsmail:** bestellingen en berichten komen in het beheer en via `MELDING_URL`; een automatische bevestigingsmail naar de klant (via een mail-API) is de logische volgende stap.
15. **Hosting met beheer:** kies een Node-host met een volume (Railway), zet de variabelen uit "Uitrollen" en geef Jay het eerste wachtwoord.
