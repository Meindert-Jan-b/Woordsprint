# WoordSprint 2.6 – gedeelde boekbibliotheek

- Voer `supabase/book-v25.sql` uit als dat bij v2.5 nog niet is gebeurd. Er is geen nieuwe SQL-migratie nodig als die tabel al bestaat.
- Upload de map `WoordSprint-v2.4-build` naar dezelfde GitHub-repository (hoofdmap); behoud de bestaande Render Root Directory. Deploy latest commit en vernieuw met Ctrl+F5. Controleer v2.6.
- Log in als beheerder. Open Finish Up en kies het boekbestand waarvoor je distributietoestemming hebt. Vink de toestemmingsverklaring aan en klik op Publiceer voor iedereen. Doe dit maar één keer. Deel geen boekbestand zonder de benodigde rechten en upload het niet naar GitHub.
- Alle ingelogde accounts kunnen vervolgens de hoofdstukken kiezen zonder eigen import. Alleen de beheerder kan het gedeelde boek vervangen. De bestaande persoonlijke hoofdstuklijsten blijven bewaard; een vervanging overschrijft die niet. De oude privéboekgegevens worden niet verwijderd, maar het boekmenu gebruikt nu de gedeelde catalogus.
- XP, coins, vinkjes en woordenlijsten blijven per account. De snellere antwoordcontrole uit v2.5 (220 ms ingebouwde pauze) blijft behouden. Netwerkvertraging is nog mogelijk.
- De boekinhoud is niet inbegrepen in de website-ZIP. De boektranscriptie is niet volledig handmatig nagekeken. Publiceer alleen met toestemming van de rechthebbende.
- Cadeaubonnen met echte geldwaarde voorlopig uitgeschakeld laten; anti-botbescherming is nog niet afdoende.

## Eerdere installatiehandleiding

# WoordSprint 2.4 ONLINE — Lijstbonus + Render + Supabase + WhatsApp + Vinkjes

Deze versie is gebaseerd op WoordSprint 2.1. De bestaande leermodi, games, accounts, XP, coins, vrienden en cadeaubonaanvragen blijven behouden. **Je pc hoeft na publicatie niet meer aan te blijven.**

**Status:** de code is voorbereid voor online gebruik, maar hij staat nog niet live. De eigenaar moet zelf een Supabase-project, GitHub-repository en Render-service aanmaken. Zonder deze accounts en hun persoonlijke toegang kan niemand de echte URL activeren.

## Vinkjes bij iedere oefenstand (sinds 2.3)

- Open **Mijn woordenlijsten → een lijst**. Bij iedere oefenstand staat `x / totaal woorden` of **✓ Voltooid**.
- Een vinkje verschijnt als je **alle beschikbare unieke woorden van die lijst in die modus correct hebt afgerond**; een afgeronde sessie met fouten is dus nog niet automatisch compleet.
- Bij **Slim leren** moet het woord de laatste typfase halen. Bij **Memory en Koppelspel** worden alle deelrondes samengevoegd. Voor **Context** tellen alleen woorden waarvoor een geldige invulzin bestaat.
- De vinkjes zijn **per gebruiker en per leerrichting**; voor Memory en Koppelspel telt het koppelen onafhankelijk van de richting. Wissel E → N / N → E bovenaan de lijst om beide kanten te zien.
- Een later gewijzigd of toegevoegd woord kan een eerder voltooid vinkje weer op `x / totaal` zetten tot het nieuwe woord is geoefend.
- De server berekent dit zelf, en de voortgang wordt opgeslagen in dezelfde Supabase-gebruikersdata. De oude accounts, lijsten, XP en coins blijven behouden.
- **Let op:** voortgang die vóór 2.3 is geoefend kan niet achteraf per spelmodus worden bewezen; de vinkjes beginnen daarom bij bestaande accounts op 0. Oude XP/coins blijven wel bestaan.

### Nieuw in v2.4 — Complete-lijstbonus van 40 coins per uniek woord

- **25 nieuwe woordparen = 1.000 bonuscoins.** 10 = 400, 15 = 600, 30 = 1.200, 40 = 1.600, 50 = 2.000. Er is geen minimale lijstgrootte nodig: de bonus schaalt lineair.
- Een lijst komt in aanmerking wanneer **alle beschikbare 13 oefenstanden/spellen** zijn afgevinkt. Alleen de Contextstand wordt niet vereist als er geen bruikbare voorbeeldzin in de lijst staat. De modes zijn Slim leren, Typen, Flashcards, Meerkeuze, Dictee, Hints, Toets, In gedachten, Invullen in context, Memory, Koppelspel, Letterpuzzel en Sprint.
- De server houdt bij welke **canonieke woordparen per account al een volledige-lijstbonus** hebben opgeleverd. Een andere naam, kopie, import of omgekeerde leerrichting levert niet opnieuw coins op. Een lijst met bijvoorbeeld 20 eerder beloond woorden en 5 nieuwe woorden kan maximaal 200 bonuscoins opleveren wanneer alle modes weer afgevinkt zijn.
- Na het laatste juiste antwoord van de laatste openstaande oefenstand worden de coins automatisch toegevoegd. Lijsten die vóór v2.4 al volledig af waren, kunnen de bonus **eenmalig claimen** via de knop op de lijstpagina. De knop verdwijnt wanneer de bonus eenmaal is uitbetaald.
- Boven de oefenstanden staat een kaart met voortgang `x/13`, het aantal unieke woorden, maximaal te verdienen coins en een claimknop indien van toepassing. Dit is een **lijstbonus naast de bestaande XP en 2 leercoins per nieuw woord**.
- Cadeaubonprijzen zijn aangepast naar de besproken **1.000 coins = €1**: €5 = 5.000 coins (alleen als officieel beschikbaar), €10 = 10.000 coins. **Dit is een prijsinstelling, geen garantie dat de beheerder kaarten daadwerkelijk aanbiedt.** Aanvragen blijven standaard uit en de beheerder moet ze handmatig goedkeuren.
- **BELANGRIJK:** een financieel waardevolle bonus kan gebruikers aansporen scripts, zelfverzonnen lijsten en gesimuleerde antwoorden te gebruiken. Hoewel dubbele woordparen niet nogmaals betaald worden, is het systeem niet volledig fraudebestendig. Zet echte cadeaubonnen pas aan na aanvullende server-side spelverificatie, rate limits, accountcontroles, misbruikmonitoring en een maximumbudget.


## Wat kost het?

- **Render Free:** $0 voor een hobbyproject binnen de quota. De server gaat na circa **15 minuten zonder bezoek** slapen en kan circa **1 minuut** nodig hebben om op te starten. De lokale schijf is **tijdelijk**, daarom staat je accountdata in Supabase.
- **Supabase Free:** $0 binnen de gratis quota, waaronder een database van **500 MB**. Een ongebruikt gratis project kan na ongeveer **7 dagen** worden gepauzeerd. Maak zelf backups; automatische backups zitten niet in het gratis pakket.
- **Meta WhatsApp Cloud API:** niet gegarandeerd gratis. Uitgaande goedgekeurde sjabloonmeldingen kunnen **per afgeleverd bericht** worden afgerekend; de prijs hangt af van categorie en land. Test eerst zonder echte cadeaubonnen.

Zie: https://render.com/docs/free, https://supabase.com/pricing, https://whatsappbusiness.com/products/platform-pricing/

## A. Supabase maken (eenmalig)

1. Ga naar **https://supabase.com/dashboard** en maak een gratis project, bijvoorbeeld `woordsprint`.
2. Wacht tot de database beschikbaar is. Open **SQL Editor → New query**.
3. Open het bestand **`supabase/schema.sql`** uit deze map, kopieer de volledige inhoud naar de SQL Editor en klik **Run**. Dit maakt de tabel `public.woordsprint_state`.
4. Ga in je Supabase-project naar **Settings → API Keys** (de precieze naam kan iets afwijken) en vind de **Project URL** en een **secret** key met voorvoegsel `sb_secret_`. Nieuwe sleutels zijn geen JWT's.
5. Bewaar beide waarden privé. **Plak ze nooit in GitHub, publieke chatberichten of bestanden in `public/`.** De secret key mag alleen onder Render → Environment.

De website gebruikt een **server-only service key**. Geen van de gebruikers mag direct bij de database. De Supabase-tabel heeft Row Level Security zonder publieke lees-/schrijfregels.

## B. Code op GitHub zetten

1. Ga naar **https://github.com/new** en maak een **Private** repository, bijvoorbeeld `woordsprint`.
2. Pak deze zip uit en upload de bestanden uit `WoordSprint-v2.4-build` naar die repository (je kunt ook Git op je pc gebruiken).
3. Upload **nooit** de map `data`, je oude `accounts.json`, een `.env`-bestand, toegangstokens of beheerderscodes. `.gitignore` beschermt dit bij `git add .`, maar controleer je bestanden zelf als je via de website uploadt.
4. Controleer dat **`render.yaml`**, `server.js`, `package.json`, `lib/`, `public/`, `supabase/` en `scripts/` in de repo staan.

Via Git op je pc kan dat bijvoorbeeld zo:

```powershell
git init
git add .
git commit -m "WoordSprint 2.4 online"
git branch -M main
git remote add origin https://github.com/JOUW-USERNAME/woordsprint.git
git push -u origin main
```

Vervang de repositorylink door de link uit je eigen GitHub-account.

## C. Render activeren

1. Open **https://dashboard.render.com/** en log in.
2. Kies **New → Blueprint** (of **New → Web Service**), verbind GitHub en selecteer je privérepository.
3. Render herkent `render.yaml`. Kies een **Free** web service. Bij handmatige configuratie: Runtime = Node, Build Command = `npm install --omit=dev`, Start Command = `node server.js`, Health Check = `/health`.
4. Vul onder **Environment** in:

   | Naam | Wat moet erin? |
   |---|---|
   | `SUPABASE_URL` | `https://jouw-project.supabase.co` uit Supabase |
   | `SUPABASE_SECRET_KEY` | De geheime Supabase `sb_secret_...` sleutel |
   | `OWNER_SETUP_CODE` | Een zelfgekozen **willekeurige code van minstens 24 tekens**. Bewaar privé. |
   | `NODE_ENV` | `production` |

   Voor een willekeurige beheerderscode kun je op je pc met Node.js dit uitvoeren:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```

5. Laat de `WA_`-variabelen eerst leeg; die kun je later instellen.
6. Klik **Deploy**. De eerste installatie kan langer duren doordat Sharp en Tesseract OCR-pakketten nodig zijn.
7. Na een succesvolle deploy krijgt je site een Render-URL die eindigt op **`.onrender.com`**. Je kunt die URL op elke telefoon of pc openen, ook als jouw pc uitstaat. Render biedt hiervoor automatisch HTTPS.
8. Controleer `https://JOUW-RENDER-URL/health`. De pagina moet `"ok":true` en `"storage":"supabase"` tonen. Gebruik de echte URL van Render, geen voorbeeld-URL.
9. Registreer je persoonlijke account; ga naar **Mijn profiel**, voer de `OWNER_SETUP_CODE` in en activeer de beheerder. Bewaar de code uit het zicht van anderen.

**Let op:** Render Free kan slapen en je gamesessie onderbreken, maar je **opgeslagen XP, accounts en woordenlijsten** blijven in Supabase staan. Voor een altijd onmiddellijk bereikbare server is doorgaans betaalde hosting nodig.

## D. Bestaande 2.0 / 2.1 accounts, XP en lijsten overzetten

Voer dit uit **voordat er nieuwe accounts op de online site worden gemaakt**.

1. Maak op je pc een kopie van het oude bestand `data/accounts.json` uit WoordSprint 2.1. Het bevat gevoelige gegevens: behandel het als privéback-up.
2. Open Windows PowerShell in de nieuwe WoordSprint-map (waar `package.json` staat).
3. Zet de gegevens voor deze ene PowerShell-sessie in de omgevingsvariabelen:

   ```powershell
   $env:SUPABASE_URL = "https://jouw-project.supabase.co"
   $env:SUPABASE_SECRET_KEY = "JOUW-PRIVE-SB-SECRET-KEY"
   ```

4. Controleer de import zonder iets te wijzigen:

   ```powershell
   node scripts/import-accounts.js "C:\pad\naar\WoordSprint-v2.1\data\accounts.json" --dry-run
   ```

5. Als de controle slaagt, voer je dezelfde opdracht uit **zonder** `--dry-run`.
6. Oude gebruikers kunnen op de online website inloggen met hun bestaande gebruikersnaam en wachtwoord. Hun wachtwoordhashes, XP, coins, badges, vrienden en lijsten zijn dan behouden. Eerdere sessies zijn bewust ongeldig gemaakt, dus gebruikers moeten opnieuw inloggen.
7. Verwijder vervolgens de tijdelijke sleutels uit de PowerShell-sessie:

   ```powershell
   Remove-Item Env:SUPABASE_URL
   Remove-Item Env:SUPABASE_SECRET_KEY
   ```

**Veiligheidscontrole:** de migratiescript stopt als er al accounts of aanvragen in Supabase staan. Het overschrijft dus niet zomaar gegevens van gebruikers.

## E. Automatische WhatsApp-berichten aan de beheerder

WoordSprint gebruikt **de officiële Meta WhatsApp Business Platform Cloud API**. Niet de gewone WhatsApp Web-app of een browserautomatisering. Bij een nieuwe officiële-cadeaubonaanvraag stuurt de server een sjabloonbericht **aan jouw beheerdersnummer**. De website vraagt geen telefoonnummers van leerlingen.

### 1. Meta / WhatsApp instellen

1. Ga naar **https://developers.facebook.com/apps/** en maak een Meta-app die toegang heeft tot **WhatsApp Business Platform / Cloud API**. Meta kan om een Business Portfolio, verificatie of een betalingsmethode vragen.
2. Open de WhatsApp-instellingen, vaak via **WhatsApp → API Setup**. Je ziet een testnummer, een **Phone Number ID** en een tijdelijk **Access Token**.
3. Voeg jouw eigen WhatsAppnummer toe als geautoriseerde ontvanger om testberichten te ontvangen. Gebruik internationaal formaat zonder `+` of spaties, bijvoorbeeld `31612345678` (uitsluitend een voorbeeld).
4. Voor blijvend gebruik: koppel een geschikt WhatsApp Business-nummer aan je WhatsApp Business Account en maak een **langdurige system-user access token** met de rechten `whatsapp_business_messaging` (en indien nodig `whatsapp_business_management`). Een tijdelijk testtoken stopt later met werken. Houd je eigen nummer en de uitzendende business-ID apart.
5. Ga naar **WhatsApp Manager → Message Templates → Create template**. Maak een sjabloon met:

   **Naam:** `woordsprint_aanvraag`  
   **Taal:** Nederlands (`nl`)  
   **Body:** `Nieuwe WoordSprint-aanvraag van {{1}} voor {{2}}. Aanvraag-ID: {{3}}. Log in op WoordSprint om de aanvraag te bekijken.`

   Dien het sjabloon in ter goedkeuring; Meta bepaalt de juiste categorie en kan het afwijzen. De code werkt pas als de template is **Approved**. De volgorde van de drie velden moet precies overeenkomen met de bovenstaande tekst.
6. Zorg dat je het bericht naar jouw ontvangende nummer mag versturen (opt-in/ontvangerstoestemming). Test dit eerst met Meta's testinstellingen.

### 2. Variabelen in Render

Ga naar **Render → jouw Web Service → Environment** en voeg toe:

| Variabele | Waarde |
|---|---|
| `WA_ACCESS_TOKEN` | Privé system-user access token van Meta |
| `WA_PHONE_NUMBER_ID` | Phone Number ID van het *verzendende* WhatsApp Business-nummer (niet de Business Account ID) |
| `WA_OWNER_NUMBER` | Jouw ontvangende WhatsApp-nummer in internationaal formaat, zonder `+` |
| `WA_TEMPLATE_NAME` | `woordsprint_aanvraag` |
| `WA_TEMPLATE_LANG` | `nl` |
| `WA_GRAPH_VERSION` | `v27.0` (of een op dat moment ondersteunde versie) |

Sla op en laat Render opnieuw deployen.

### 3. Testen

1. Log in als beheerder en open **Beheerder**.
2. Controleer of bij *Automatische WhatsApp* de melding **Ingesteld** staat.
3. Test met een account met genoeg coins en vraag een cadeaubon aan. Zet echte geldbeloningen nog niet breed beschikbaar.
4. De server slaat de aanvraag eerst op in Supabase en roept daarna Meta's Cloud API aan.
5. In het beheerderspaneel staat `sent` als Meta de API-aanvraag heeft geaccepteerd (dat **bewijst niet dat het bericht is afgeleverd**) en `failed` met een foutmelding bij een afwijzing. Gebruik **Melding opnieuw sturen** als je de fout hebt opgelost; er geldt een cooldown van vijf minuten.
6. Als het WhatsApp-bericht niet aankomt, controleer het goedgekeurde sjabloon, de tokenrechten, ontvangerstoestemming, het verzendende Phone Number ID en eventuele betaling/verificatie bij Meta.

**Kosten:** templateberichten kunnen geld kosten per afgeleverd bericht en tarief verschilt per land en categorie. Er is geen garantie dat automatische WhatsApp gratis blijft. Zie https://whatsappbusiness.com/products/platform-pricing/.

## Veiligheid, grenzen en eerlijke beloningen

- Dit is een **hobbyproject**, geen compleet geaudite productie-app. De backend gebruikt één opgeslagen JSONB-snapshot in Supabase. Dat werkt eenvoudig voor **één** Render-instantie, maar is nog geen schaalbare multi-serverarchitectuur.
- De browser kan nooit direct met de geheime Supabase-sleutel werken. Wachtwoorden worden als salted `scrypt`-hash opgeslagen.
- Beheerdersmeldingen vermelden alleen de gebruikersnaam, cadeaubon en het aanvraag-ID. Geen Roblox-wachtwoorden of cadeauboncodes.
- Roblox verbiedt directe externe Robux-handel. Gebruik uitsluitend een toegestane methode, zoals officiële Roblox-cadeaubonnen: https://about.roblox.com/nl/community-standards.
- **Echte cadeaubonnen voorlopig uitgeschakeld laten.** De huidige games en XP-regels zijn niet beveiligd tegen alle mogelijke scripts, bots of zelfgemaakte woordlijsten. Dat iemand coins heeft, bewijst niet dat diegene echt heeft geleerd. Controleer aanvragen handmatig en verbeter de anti-fraudebeveiliging voordat er beloningen met geldwaarde komen.
- Beveilig accountregistratie tegen misbruik en maak regelmatig backups. Als veel minderjarigen de site gebruiken, let dan ook op passende privacyinformatie, dataminimalisatie en ouderlijke toestemmingsregels waar vereist.
- Gebruik `npm test` om de losse programmeerfuncties te testen. De complete live deploy, Supabase-verbinding en WhatsApp-berichtaflevering kunnen pas met jouw eigen accounts en echte sleutels worden gecontroleerd.
