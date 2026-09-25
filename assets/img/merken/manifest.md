# Merklogo's — Cycle Service Sint-Oedenrode

Trust badges voor de dealerpagina. Alleen echte, gedownloade logo's — niets nagemaakt.

## 1. Mondraker — `mondraker.svg`
- **Bron:** https://mondraker.com (officiële site), asset `https://cdn.mondraker.com/assets/build/images/logo-copy.svg`
- **Formaat:** SVG, viewBox `0 0 147.186 8.968` (wordmark, breed/laag — schaalt naar elke breedte)
- **Kleur:** monochroom. Origineel had `fill="#fff"` (wit, bedoeld voor donkere achtergrond) — aangepast naar `fill="currentColor"` zodat hij overal herkleurbaar is (erft de tekstkleur, standaard zwart). Geverifieerd via gerenderde thumbnail: zwart "MONDRAKER"-wordmark.
- **viewBox aanwezig:** ja (toegevoegd, ontbrak in het origineel; afgeleid uit width/height)
- Let op: dit is de tekst-wordmark. De site heeft ook een apart "M"-beeldmerk-icoon (`mondraker-logo-white.svg`) — niet gebruikt, want de wordmark is herkenbaarder als trust badge.

## 2. Berria — `berria.svg`
- **Bron:** https://berriabikes.com (officiële site, Shopify-CDN), asset `https://berriabikes.com/cdn/shop/files/logo-berria_svg.svg`
- **Formaat:** SVG, viewBox `0 0 139 18`
- **Kleur:** monochroom, `fill="black"` — direct bruikbaar, herkleurbaar door fill aan te passen.
- **viewBox aanwezig:** ja, zat al in het origineel.

## 3. Superior — `superior.svg`
- **Bron:** https://superiorbikes.com (officiële site; superiorbikes.eu redirect hiernaartoe), inline SVG uit de header van de homepage (geen los bestand — outerHTML gekopieerd)
- **Formaat:** SVG, viewBox `0 0 510.24 106.6`
- **Kleur:** monochroom, class `.cls-1{fill:currentColor}` — herkleurbaar, erft standaard zwart.
- **viewBox aanwezig:** ja, zat al in het origineel.
- Wordmark is kleine letters: "superior." (met punt), zo voert het merk het zelf.

## 4. Q'Motiv — `qmotiv.png`
- **Bron:** https://www.q-motiv.be (officiële site — LET OP: niet qmotiv.nl of qmotiv.com, die bestaan niet; dit Belgische merk zit op q-motiv.be), asset `https://www.q-motiv.be/img/logo.png`
- **Formaat:** PNG met transparante achtergrond, **191 × 40 px**
- **Kleur:** grotendeels monochroom donkergrijs/zwart, met één blauw accent (de bliksemschicht/apostrof) — niet 100% eenkleurig.
- **BEPERKING:** dit is de enige logo-variant die de site aanbiedt (naast een lichte variant `logo-light.png` voor donkere achtergronden, ook 191×40). Er is geen SVG, geen grotere PNG, en geen groter exemplaar gevonden op de homepage-assets (`img/home/q-motiv.png` is zelfs kleiner qua bruikbare inhoud, 250×53 met veel witruimte). Niet gevonden op seeklogo.com, worldvectorlogo.com of brandsoftheworld.com (merk is te klein/nieuw). **Voldoet dus niet aan de 400px-breedte eis** — dit is het best beschikbare officiële logo. Aanbevolen: bij gebruik als trust badge extra zorgvuldig opschalen (het is een PNG, dus kwaliteitsverlies bij vergroten), of rechtstreeks bij Q'Motiv een hogere resolutie opvragen.

## 5. Gemini — `gemini.png`
- **Bron:** https://ridegemini.com (Gemini Composites S.L., Barcelona — het carbon-onderdelenmerk; LET OP: gemini-components.com bestaat niet meer/is een geparkeerd advertentiedomein, niet gebruikt), asset `https://ridegemini.com/cdn/shop/files/LOGO_GEMINI_NEGRO.png` (zwarte variant; er is ook `LOGO_GEMINI_WEB_blanco_v2.png` voor donkere achtergronden)
- **Formaat:** PNG met transparante achtergrond, **2520 × 399 px** (ruim boven de 400px-eis)
- **Kleur:** monochroom zwart (grayscale+alpha PNG).
- **viewBox:** n.v.t. (PNG, geen SVG-bronbestand gevonden op de site).

## Niet gelukt
Geen van de vijf merken is volledig mislukt. Enige aandachtspunt: **Q'Motiv** (zie hierboven) levert alleen een logo van 191×40 px, onder de gevraagde minimale breedte van 400px — er bestaat kennelijk geen grotere/vector-versie in publieke omloop.
