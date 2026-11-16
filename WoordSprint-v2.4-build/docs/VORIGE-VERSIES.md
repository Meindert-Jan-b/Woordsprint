# WoordSprint v1.10 – Antwoorden bij Hints en Typen

**Belangrijkste verbetering:** als een woord meerdere betekenissen heeft, is **één volledige juiste betekenis genoeg**. Dit geldt voor Slim leren (Hints en Zelf typen), Typen en Toets, net als voor Meerkeuze. Hoofdletters worden genegeerd.

Bijvoorbeeld: `lawsuit` → `rechtszaak / proces (I ...)`: `rechtszaak` en `proces` zijn allebei correct, ook als StudyGo of OCR er achter `proces` een uitleg tussen haakjes heeft gezet. De scanner kan ook vreemde haakjes of een ontbrekende sluitende haak hebben; de software behandelt die bij deze antwoorden als extra uitleg. Een gewone spelfout wordt niet automatisch goed gerekend.

Na controleren blijft je **ingevoerde antwoord zichtbaar** en staat in de feedback letterlijk wat is beoordeeld. Je kunt een lege invoer niet meer insturen. In Hints mag je ook een andere juiste betekenis invullen dan waar de letters van getoond worden.

## Installeren zonder woordenlijsten kwijt te raken

1. Sluit WoordSprint en sluit ook de oude zwarte terminal.
2. Pak deze ZIP uit in een **nieuwe map**, niet in de vorige map of in het ZIP-venster.
3. Kopieer indien nodig `data/woordsprint.json` vanuit de vorige WoordSprint-map naar `WoordSprint/data/woordsprint.json` in de nieuwe map (maak `data` aan als deze ontbreekt).
4. Dubbelklik op `START-HIER.cmd` en open http://localhost:3000.
5. Ververs met **Ctrl+F5** om verouderde JavaScript uit de browsercache te verwijderen.

De server moet draaien vanuit de nieuwste map. Controleer als er nog fouten zijn welke map in het terminalvenster wordt gestart; er kan nog een oude server op poort 3000 draaien.

## Testen

In `tests/answer-utils.test.js` en `tests/typed-answers-regression.test.js` worden de antwoordalternatieven, OCR-opmerkingen, invoer en hints getest. Eerdere tests blijven beschikbaar. Volledige Windows-installatie niet in deze omgeving getest.

---

# WoordSprint v1.9 – keuzeantwoorden hersteld

Klikken op de juiste meerkeuzeknop wordt nu direct beoordeeld aan de hand van de optie, ook bij meerdere betekenissen. Bij typvragen blijft één correcte vertaling voldoende en worden hoofdletters genegeerd. Oude klikken op een vorige vraag tellen niet mee. In de feedback staat welke knop je hebt gekozen. De JavaScript-bestanden hebben een nieuwe versienaam om oude browsercache te omzeilen.

Installeer door de ZIP volledig uit te pakken en **START-HIER.cmd** te openen. Bewaar je eigen lijsten door eerst `data/woordsprint.json` uit de vorige versie naar de nieuwe map te kopiëren terwijl de server uit staat.

# WoordSprint v1.8 — vernieuwd Slim leren en eenvoudige lijsten

## Nieuw in v1.8

**Waarom meerkeuze soms een correct antwoord als fout zag:** bij `advocaat/jurist` stond de hele tekst op de antwoordknop, maar de controle accepteerde alleen `advocaat` of `jurist` afzonderlijk. Dat is opgelost. De volledige optie, elk afzonderlijk alternatief en verschillen in hoofdletters worden goedgekeurd.

**Slim leren** is vernieuwd naar vier opbouwende stappen (gebaseerd op de algemeen beschreven aanpak van StudyGo, niet hun exacte algoritme):

1. **Bekijken** — draai de kaart en klik op `Begrepen` of `Nog een keer`.
2. **Meerkeuze** — klik op de vertaling; het juiste antwoord kleurt groen. Na ongeveer één seconde gaat WoordSprint automatisch verder. Je kunt ook op `Volgende woord` klikken.
3. **Hints** — typ de vertaling met de beginletters als hulp.
4. **Zelf typen** — typ de vertaling zonder hints.

De lijst wordt verdeeld in **sets van vijf woorden**. Elk woord moet alle vier de stappen goed doorlopen hebben om als geleerd te tellen. Foute antwoorden komen later in dezelfde set opnieuw langs. Talen, antwoortrichting, meerdere betekenissen en bestaande games blijven werken.

**Mijn woordenlijsten** toont nu een eenvoudige lijst met zoekbalk en de filters `Alle lijsten`, `Geïmporteerd`, `Zelf gemaakt` en `Voorbeelden`. Elk item heeft `Bekijk woorden` en `Slim leren`. Het dashboard toont ook een blok met geïmporteerde lijsten.

**Bestaande geïmporteerde lijsten** uit v1.7 blijven zichtbaar onder `Alle lijsten`. Omdat oudere versies geen importherkomst opsloegen, kunnen die niet altijd automatisch als `Geïmporteerd` worden gelabeld. Nieuwe StudyGo-/scanimports krijgen die herkomst voortaan wel.

## Bijwerken zonder je woordjes kwijt te raken

1. Sluit de oude WoordSprint af.
2. Pak v1.8 volledig uit naar een **nieuwe map**.
3. Kopieer `data/woordsprint.json` uit je oude `WoordSprint`-map naar `WoordSprint/data/woordsprint.json` in de nieuwe map (maak de `data`-map zo nodig aan).
4. Dubbelklik op `START-HIER.cmd`. Open `http://localhost:3000` en druk op **Ctrl+F5**.
5. Begin bij **Mijn woordenlijsten** en klik op **Slim leren**.

De resterende handleiding hieronder geldt nog steeds voor de import en scanner.

---

## Eerdere versie: StudyGo-import


Een eigen woordenleerwebsite met oefenstanden, spelletjes en een scanner voor boeken. **Nieuw: woorden overnemen uit StudyGo zonder foto.**

## Installatie (Windows)

1. Pak **de hele ZIP** uit met **Alles uitpakken** (start het programma niet in het ZIP-venster).
2. Installeer indien nodig **Node.js LTS**: https://nodejs.org/
3. Dubbelklik op **`START-HIER.cmd`**. De eerste start installeert de benodigde npm-pakketten via internet.
4. Open **http://localhost:3000** op je pc. Laat het zwarte venster open zolang je de website gebruikt.
5. Klik links op **StudyGo importeren** (of open **Mijn woordenlijsten → StudyGo importeren**).

Op je telefoon open je WoordSprint vanaf hetzelfde wifi-netwerk via de QR-code op **Woordjes scannen**. De server draait op je eigen pc; er is geen online hosting/account.

## StudyGo importeren

Er zijn drie manieren, met **controle van alle woordparen vóór opslaan**:

### Optie 1: StudyGo-link

Open een **openbare, gedeelde** StudyGo-woordenlijst, kopieer de volledige URL en plak die in WoordSprint onder **Link van StudyGo**. Kies **Haal woordjes op**. Alleen openbare lijstgegevens in HTML of embedded JSON kunnen worden ingelezen; als StudyGo ze uitsluitend na inloggen of via een gesloten applicatie toont, komt er **een uitleg en geen verzonnen lijst**. Niet alle links worden ondersteund. De website leest geen StudyGo-wachtwoorden/cookies en omzeilt geen betaalmuur.

### Optie 2: PDF — aanbevolen

1. Open de gewenste lijst op **studygo.com** (log daar zelf in indien nodig).
2. Kies **Meer opties → Printen → Tabel → Print**.
3. Kies in het printvenster **Opslaan als PDF**.
4. Open **WoordSprint → StudyGo importeren → StudyGo-PDF** en selecteer de PDF.
5. Klik op **Lees PDF uit**. De import leest selecteerbare tekst uit de PDF en koppelt kolommen waar dat mogelijk is. Controleer de resultaten.

Dit gebruikt digitale tekst: geen fotoscan, geen camera, geen OCR. Een PDF die alleen uit een afbeelding bestaat wordt niet ondersteund. Een PDF met sterk afwijkende tabellen kan handmatige correctie vereisen.

### Optie 3: Kopiëren en plakken

Kopieer de woorden met hun betekenissen uit de StudyGo-bewerkpagina, Excel of een tekstbestand. Plak **één woordpaar op iedere regel**, met een **tab**, ` = `, ` - ` of puntkomma tussen beide kolommen. Bijvoorbeeld:

```
lawyer\tjurist/advocaat
trial\tproces/strafzaak
illegal\tonwettig/illegaal
```

(De `\t` hierboven staat voor een **echte tab**; in Excel wordt die automatisch gebruikt als je beide kolommen tegelijk kopieert.) Je kunt ook `lawyer = jurist/advocaat` typen.

Klik op **Verwerk geplakte tekst**.

### Controle en opslaan

Onder de import verschijnen alle gevonden paren. Corrigeer eventueel de woorden en betekenissen, voeg rijen toe of verwijder ze. Kies dan **Nieuwe woordenlijst** of **Toevoegen aan bestaande lijst** en klik op **Bewaren**.

Meerdere betekenissen (zoals `jurist/advocaat`) blijven samen bij één woord. Bij het oefenen wordt één betekenis geaccepteerd en hoofdletters maken niet uit. De eerdere context-oefenstand, flashcards en games zijn behouden.

## Woordenlijsten van een oudere versie behouden

1. Sluit de oude WoordSprint-server af.
2. Pak de nieuwe versie uit in een nieuwe map.
3. Kopieer (indien aanwezig) `data/woordsprint.json` uit de vorige map naar `WoordSprint/data/woordsprint.json` in de nieuwe map.
4. Start de nieuwe versie met `START-HIER.cmd` en vernieuw de browser met Ctrl+F5.

Verander niets aan `server.js` of `package.json` als je je oude gegevens wilt overnemen: alleen het JSON-bestand bevat de lokaal opgeslagen lijsten en scores.

## Beperkingen en privacy

- De PDF- en tekstimport worden **lokaal** op je eigen computer uitgevoerd. De PDF wordt niet als bestand opgeslagen.
- Bij het rechtstreeks importeren van een link haalt je WoordSprint-server de door jou opgegeven openbare pagina op. Alleen HTTPS-links op **studygo.com** zijn toegestaan; redirects worden gecontroleerd.
- WoordSprint staat niet in verbinding met StudyGo, is geen officiële StudyGo-dienst en kan geen privé- of afgeschermde lijsten direct uitlezen.
- Gebruik de geïmporteerde lijsten voor je eigen studie en respecteer eventuele rechten van uitgevers en de gebruiksvoorwaarden van StudyGo.
- Iedereen die op je lokale netwerk toegang heeft tot de WoordSprint-server kan de lijsten bekijken en aanpassen. Stel **poort 3000 niet openbaar beschikbaar**.

## Tests

De import-parser voor HTML, JSON, gekopieerde tekst en PDF-rijposities, de controle tegen foutieve URL's en de route van preview → opslaan zijn met Node.js-tests gecontroleerd. **Een live StudyGo-woordenlijst en de volledige PDF-upload op Windows konden in deze omgeving nog niet end-to-end worden getest**, omdat hier npm-pakketten niet van registry.npmjs.org opgehaald kunnen worden. De import is daarom een werkende lokale implementatie met de genoemde beperkingen, geen garantie voor iedere StudyGo-lijst.

Bij technische problemen: laat `START-HIER.cmd` open en maak een screenshot van de foutmelding.
