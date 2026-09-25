# Dossier Cycle Service Sint-Oedenrode

Onderzoek 24 september 2026: huidige site (Jimdo, via browser), Google Maps, Facebook, MooiRooiKrant, concurrentie, branche-benchmarks. Zie `_bouw/onderzoek-*.md` voor de ruwe uitkomsten.

## Kernbelofte

**Je racefiets, MTB, gravelbike of e-bike rijdt weer als nieuw, op de dag die jij zelf kiest.** Eén specialist (Jay) die alleen sportieve fietsen doet, met vaste prijzen, online te plannen, en met een haal- en brengservice voor wie geen tijd heeft.

## Bewijs

- 5,0 uit 39 Google-reviews (Google Maps, 24-09-2026), terugkerende thema's: deskundig, communicatie, racefiets, mountainbike
- Ruim 300 tevreden fietsers als klantenbestand (cycle-service.nl/over)
- Opleiding fietstechniek en eerste fietstechniek, Koning Willem I College Den Bosch; werkervaring Cycletrend Nuenen en Canyon Eindhoven (cycle-service.nl/over, MooiRooiKrant)
- Eén jaar garantie na elke onderhoudsbeurt op perfect rollen, remmen en schakelen, slijtagedelen uitgezonderd (cycle-service.nl/werkplaats)
- Vaste prijzen met vaste duur: controlebeurt 75 min € 69, onderhoudsbeurt 180 min € 159, e-bike 90 min € 85 (site + opdracht eigenaar)
- Haal- en brengservice (site + review-snippet "Fiets werd thuis opgehaald en netjes weer thuis afgeleverd")
- Open vanaf 7.30 uur op dinsdag, woensdag en vrijdag: fiets brengen vóór je werk
- Sinds 2020; eigen winkel, werkplaats en webshop; merken Mondraker, Berria, Superior, Q'Motiv, Gemini

## Huisstijl nu

`kleuren.mjs` kon de site niet ophalen (Cloudflare 403). Gemeten door onderzoeker A in de browser:

| Kleur | Gebruik nu | Wat we doen |
|---|---|---|
| #000000 zwart | knop, footer, overlays | Vervangen door het navy van het gevelbord (#0B1730-familie). Het bord is het echte merk, de site was zwart-wit omdat Jimdo dat standaard is. |
| #FFFFFF wit | achtergronden | Houden als lichte toon (opdracht: witte achtergrond), gebroken naar #FAFBFD zodat het niet hard staat |
| #323335 grijs | navigatie | Vervangen door een navy-grijs met 7:1 |
| Poppins 600/700 + Roboto | koppen en body | Jimdo-standaard, geen keuze. Vervangen door een eigen koppel (zie ontwerpplan) |
| Logo | geen bestand, tekst in de hero-foto | Eigen woordmerk bouwen in de stijl van het gevelbord: CYCLE SERVICE met de regel RACE · MTB · GRAVEL · E-BIKES |

Wat werkt: het gevelbord (navy vlak, witte kapitalen, de vier disciplines eronder) is een sterk, rustig merkbeeld. Dat nemen we als basis. Wat mis is: geen accent, generieke fonts, geen logo, geen boekingssysteem, drie juridische pagina's nog op Jimdo-placeholders.

## Visueel concept

Licht, technisch en premium: veel wit, navy als drager, en één elektrische accentkleur (kettingblad-geel/chartreuse, de kleur van hi-vis fietskleding en van de zadelwand in de winkel) die alleen op knoppen, markeringen en de verlopende randen voorkomt. Het gevoel van een goed onderhouden werkplaats: strak, schoon, alles op zijn plek, en één plek waar de energie zit. Foto's koel en daglicht; geen zonsondergang-romantiek.

## Het ene idee

**"Klaar op de tijd die jij kiest."** De werkplaats werkt in vaste blokken (75, 90 of 180 minuten). De site draait om dat ritme: je kiest een beurt, een dag en een tijd, en je weet meteen wanneer je fiets klaarstaat. Dat idee zit in de hero (de planner-kaart met de eerstvolgende vrije plek), in de beurtkaarten (als werkplaatslabels met tijd en prijs), in de motion (het kettingblad dat meedraait met je scroll, als een werkplaats die draait) en in de copy (tijden, geen vage beloftes).

## Ontwerpplan

**Kleur**
- `--papier` #FAFBFD: achtergrond, koel gebroken wit
- `--papier-2` #EEF2F7: tweede vlak voor sectieritme
- `--inkt` #0B1730: navy van het gevelbord; tekst, donkere secties, primaire vlakken
- `--merk` #14305E: navy-blauw voor koppen-accenten, iconen, lijnen
- `--cta` #C6F135: kettingbladgeel, alleen op knoppen (navy tekst), markeringen en het verloop
- `--dim` #465266: zachte tekst op licht (7,4:1); `--dim-op-donker` #C5CEDD op navy
- Verloop-rand (signatuur): navy #14305E naar elektrisch blauw #2F6BFF naar #C6F135, als 1,5 px `border-image`-achtige rand via een gemaskeerd pseudo-element op kaarten en beeldkaders

**Typografie**
- Display: Big Shoulders Display (700 tot 900), gecondenseerd en atletisch, verwant aan rugnummers en frame-decals. Nooit eerder gebruikt in het archief.
- Body: Hanken Grotesk (400 tot 700), neutraal en goed leesbaar. Nooit eerder gebruikt.
- Koppen strak (line-height 0,92 tot 1,05), body 1,6 tot 1,7.

**Layout**
Topbalk (positionering links, score en telefoon rechts) · sticky header met woordmerk en knop "Plan je beurt" · hero over de volle breedte met een grote fietsfoto, kop op één regel, vier bullets met merkicoon, twee knoppen, en rechts een zwevende planner-kaart met de eerstvolgende vrije plek · USP-sectie: drie werkplaatslabels · beurten: drie kaarten met tijd en prijs · "zo werkt het" in vier stappen · de werkplaats en Jay (echte foto's) · reviews: uitgelicht + raster + knop naar Google · fietsen en merken (kort, met knop naar de fietsenpagina) · donkere slotband met planner-knop · footer.

**Signatuur**
Het kettingblad dat draait met de scroll (groot, dun, navy op wit, deels buiten beeld in de hero en klein in de footer) plus de werkplaatslabels: kaarten in de vorm van het label dat aan een fiets in de werkplaats hangt (gaatje, ring, verlopende rand). Eén scroll-effect, één kaartvorm.

**Toets: zou ik dit voor een willekeurige fietsenmaker opschrijven?** Navy plus wit ja, dat is de gevel. Het chartreuse-accent, de werkplaatslabels en het draaiende kettingblad niet: die komen uit deze zaak (de zadelwand, de labels aan de fietsen, de vaste tijdsblokken). Veranderd ten opzichte van mijn eerste ingeving: eerst wilde ik een blauw verloop als accent, maar dat leest als de standaard AI-look. Chartreuse is uniek in het archief (geel was nog vrij) en zit letterlijk in de winkel.

## Gegevens

- Cycle Service, Handelsweg 11, 5492 NL Sint-Oedenrode
- Telefoon 06 28828966 (tel:+31628828966), WhatsApp wa.me/31628828966
- E-mail: de site toont info@cycle-service.nl maar de mailto-link wijst naar cycle-service@outlook.com. Op de site zetten we info@cycle-service.nl (het domeinadres) en melden het als open punt.
- Openingstijden (site): ma op afspraak, di 7.30-17.30, wo 7.30-17.30, do op afspraak, vr 7.30-20.00, za 9.00-13.00, zo gesloten
- Sluiting: 26 september tot 10 oktober (2026) staat op de huidige site; in de planner geblokkeerd, te bevestigen
- Planner (opdracht eigenaar): dinsdag tot en met vrijdag, 8 uur per dag. Ingesteld op 7.30 tot 15.30, aanpasbaar in `server.js`
- Google: 5,0 uit 39 reviews, categorie fietsenwinkel. Reviewlink: https://www.google.com/maps?q=Cycle+Service+Sint-Oedenrode
- Facebook: facebook.com/p/Cycle-Service-Sint-Oedenrode-61580216900790/ (60 volgers; vermeldt nog het oude adres Anjerlaan 55)
- Instagram: bestaat, handle niet geverifieerd (open punt)
- Eigenaar: Jay van der Kallen, uit Nijnsel. Op de foto staat een tweede persoon (partner) met koffieblad; naam onbekend.

## Aanbod en prijzen

Alle beurten exclusief materiaal (site). Eén jaar garantie op rollen, remmen en schakelen na een onderhoudsbeurt, slijtagedelen uitgezonderd.

**Controlebeurt race, gravel of MTB: € 69, 75 minuten.** Bikewash en protective wax; remmen afstellen en uitlijnen; versnellingen afstellen; controle wiellagers, balhoofdlagers, trapaslagers, banden; elk boutje op het juiste moment vastzetten.

**Onderhoudsbeurt (jaarlijks) race, gravel of MTB: € 159, 180 minuten.** Alles van de controlebeurt plus: volledig demonteren en opnieuw opbouwen; intensief reinigen aandrijflijn; wielen richten en spaakspanning controleren; nieuw vet in balhoofd, trapas, derailleurpad; nieuw vet in trapaslagers; nieuw vet tussen pedalen en crank; nieuw vet in zadelpen; vervangen handvatten of stuurlint.

Aanvullend (onderhoudsprijs): achterbrug service full suspension MTB + € 30,00; vervangen balhoofdlagers interne kabelgeleiding + € 45,00; vervangen wiellagers per wiel + € 15,00; vervangen tubeless sealant + € 12,50.

**Onderhoudsbeurt (jaarlijks) e-bike: € 85, 90 minuten.** Bikewash en protective wax; reinigen aandrijflijn; remmen afstellen en uitlijnen; versnellingen afstellen; controle wiellagers, balhoofdlagers, trapaslagers, banden; nieuw vet tussen pedalen en crank; nieuw vet in zadelpen; elk boutje vastzetten; software-update.

## Catalogus (fietsen op voorraad, 24-09-2026)

Zie `_bouw/catalogus.json`. Acht fietsen: Scott Addict RC 30 occasion € 2.799; Mondraker Arid Carbon R medium € 3.499; Mondraker Arid Carbon R custom large € 5.299; Mondraker F-Podium RR custom demo large € 5.499; Superior iBLOX 6.3 large € 2.750; Q'Motiv € 1.999; Berria Belador Pro 57 € 3.499; Berria Belador Pro 55 € 2.499. Webshop: Gemini (3 onderdelen) en Mondraker (9 modellen, meeste niet op voorraad). Foto's van de fietsen staan op de Jimdo-site zonder alt-tekst; welke foto bij welke fiets hoort is niet betrouwbaar vast te stellen, dus de fietsenpagina toont kaarten met specificaties en een aanvraagknop, met beeldplek als open punt.

## Reviews

Verbatim beschikbaar (Google Maps, 24-09-2026):
- Nimr Abbasi: "Jay heeft veel passie voor z'n werk, dat zie je terug in hoe je fiets wordt gemaakt! Ik ben voor het eerste keer naar hem geweest, maar zeker niet de laatste. M'n gravel bike voelt als nieuw!"
- Frank de Waard: "Supervriendelijk, wist meteen wat het probleem was en hoe het op te lossen (derailleurpad moest gericht worden). Nam ook nog de tijd om uit te leggen wat het probleem was en hoe hij het zou oplossen. Zeer tevreden!"
- Patrick Bolk: "Kundig met faire prijzen maar bovenal eerlijk & erg fijn persoon om een fiets bij te kopen! Is stukje rijden maar mij 't wel waard: Jay keep up the good work!"
- Zonder naam zichtbaar: "Fiets werd thuis opgehaald en netjes weer thuis afgeleverd." / "Enorm kundige vakman met geduld en kennis van zaken, een aanrader!" / "Onderhoud voor mijn MTB laten doen door Jay, zeer goede ervaring !!"

De eigenaar noemt 39 vijfsterrenreviews als bijlage; die bijlage zat niet bij de opdracht. De reviewsectie leest uit `_bouw/reviews.json`, zodat de rest er zo in kan.

## Beeld

Aangeleverd (6 foto's, WhatsApp-kwaliteit, 1200 tot 2000 px): dronefoto pand (2000x1125, hero-waardig), gevelbord (1600x1066, scherp), Jay en partner voor de deur met Mondraker (1600x1066), winkel met bar en werkplaats (1600x1200), werkplaats met montagestandaard (1600x1200), onderdelenwand (1200x1600). Alle bruikbaar tot 1600 breed. Stockbeeld (Unsplash/Pexels, gedownload) voor race, gravel, MTB, e-bike en detailwerk, koel daglicht, zie `assets/img/` en `_bouw/stock-manifest.md`.

## Branche-inzichten

Bezoeker wil: (1) een beurt plannen, (2) weten of zijn type fiets hier past, (3) prijs, (4) openingstijden en plek, (5) bewijs. Afhakers: geen prijs, geen planner, onduidelijk verschil tussen beurten. Verwacht: online tijdslot, beurtkeuze met prijs, wat je moet weten voor de afspraak, WhatsApp. Zoektermen: fietsenmaker Sint-Oedenrode, racefiets onderhoud, e-bike onderhoud Sint-Oedenrode, mountainbike reparatie, gravelbike onderhoud, fietsenmaker Meierijstad.

## Sitemap

- `index.html`: overtuigen en laten plannen
- `werkplaats.html`: de drie beurten volledig, aanvullend werk, garantie, wat je meeneemt
- `planner.html`: de onderhoudsplanner (beurt, dag, tijd, gegevens, bevestiging)
- `fietsen.html`: fietsen op voorraad en merken, aanvraag via WhatsApp of formulier
- `over.html`: Jay, de werkplaats, de werkwijze, haal- en brengservice
- `contact.html`: adres, kaart, openingstijden, formulier, veelgestelde vragen

Geschrapt: koffiebar (opdracht), impressie en galerij als losse pagina's (beeld gaat in de secties), webshop als losse winkel (Jimdo-webshop met PayPal; wordt een aanvraagflow, zie open punten).

## Open punten

1. De 39 reviews: bijlage ontbrak. Aanleveren als tekst; ze gaan in `_bouw/reviews.json`.
2. E-mailadres: info@cycle-service.nl of cycle-service@outlook.com als het adres op de site.
3. Plannerwindow: 7.30 tot 15.30 aangenomen (8 uur, dinsdag tot en met vrijdag). Bevestigen.
4. Sluiting 26 september tot 10 oktober: klopt dat voor 2026?
5. Naam en rol van de tweede persoon op de foto voor de deur.
6. Instagram-handle.
7. Fietsfoto's per fiets (webshop-beeld zonder alt-tekst is niet betrouwbaar te koppelen).
8. Tarieven bevestigen vóór livegang.
9. Algemene voorwaarden, impressum en herroepingsrecht zijn op de huidige site Jimdo-placeholders; echte tekst nodig als de webshop meegaat.
10. Domein en mailboxen bij Jimdo: overzetplan staat in README.
