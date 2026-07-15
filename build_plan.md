# VvE Beheer Platform — Build Plan

## Visie

VvE Beheer geeft een beheerder een helder beeld van toekomstige onderhoudskosten en berekent continu of de bijdragen van eigenaren voldoende zijn om die kosten te dekken. Naast financieel beheer ondersteunt het platform dagelijkse VvE-taken: vergaderingen plannen, meldingen beheren, documenten bewaren en betalingen bijhouden.

---

## Wat al gebouwd is

### Fase 0 — Fundament ✅
- FastAPI backend + SQLAlchemy ORM (PostgreSQL productie / SQLite lokaal)
- React 18 + TypeScript + Tailwind CSS frontend
- JWT authenticatie (8 uur) + 1 superuser auto-seed
- Render.com deployment (Docker multi-stage + PostgreSQL)
- GitHub repo: `sgieles/VvE-beheer`

### Fase 1 — Financieel MVP ✅
- `Appartement` model + CRUD router
- VvE `share_denominator`: bijdrage per 1/N aandeel-eenheid
- Bijdrage per appartement berekend op basis van aandeel (proportioneel)
- Bijdrage-overzicht per appartement op dashboard
- Historisch bijdrageplan (meerdere ContributionPlan-periodes, actief/historiek)
- Bijdrageplan `effective_to` bewerkbaar (PATCH endpoint + edit-modal in FinancialPage)
- Automatische bijschrijving op de 20ste: saldo berekend per bijdrageplan-periode
- Multi-plan saldo-berekening (correcte berekening bij planwisselingen)
- Balanssheet upload: bankbalans PDF/Excel → saldo + datum extraheren
- MJOP upload (Excel/PDF-parser via pdfplumber)
- MJOP items CRUD + inline editing (kwartaal/bedrag/status/categorie)
- MJOP: bulk-bewerking, bulk-status, geannuleerde posten, heractiveren
- Reservefonds mutaties (toevoegen, overzicht gecombineerd met auto-bijdragen)
- Financieel dashboard: KPI-tiles, prognose-grafiek (gestapeld staaf + saldo-lijn)
- Tekortanalyse + drie scenario's (bijdrage verhogen / kosten uitstellen / eenmalige bijdrage)
- Slimme planning: algoritme herverdeelt kosten, origineel vs. slim plan naast elkaar
- Ad-hoc simulatiepost met oranje markering + opslaan als definitieve post
- Inflatie-/indexatiecorrectie (`?inflatie=X` query param)
- Vroegtijdige waarschuwing: rode banner bij tekort binnen 2 jaar
- MJOP exporteren naar Excel (opgemaakt, kleurcoding)
- MJOP handmatig toevoegen (knop + modal)
- Eigenaar-dashboard: persoonlijke bijdrage-kaart op basis van aandeel
- Demo-seed: Kinderdijkstraat 57-63 (12 app., 32 aandelen, 18 MJOP-posten 2022-2040)
- Lege-staat pagina's + skeleton loaders

### Fase 1b — Platform uitbreiding ✅
- **Rollen**: platform_admin, beheerder, eigenaar (read-only)
- **Multi-tenancy**: vve_id op alle tabellen, query-filtering per VvE
- **Vergaderingen**: model + router + MeetingsPage (agenda samenstellen, notulen, actiepunten, Teams-URL)
- **Actiepunten**: ActionItem model + router + TakenPage (status-cyclus, filter)
- **Betalingen**: ContributionPayment model + router + BetalingenPage (matrix per appartement × periode, genereer jaar, KPI-samenvatting)
- **Meldingen**: Melding model + router + MeldingenPage (urgentie, status-flow, beheerder-notities)
- **Documenten**: VvEDocument model + router + DocumentsPage (upload, categorie-filter, download)
- **Aankondigingen**: Announcement model + router + dashboard-integratie
- **Rapport**: RapportPage (printbare financiële rapportage)
- **Slim plan knop**: altijd zichtbaar voor beheerders (ook zonder tekorten)
- **Bugfixes**: bijdrage-update async refetch, reservefonds multi-plan berekening, slim plan balans

---

## Backlog

### Prioriteit 1 — Bugs (correctheidsproblemen)

- [x] **BetalingenPage: totaalrij berekent incorrect bij ongelijke aandelen**
  `tfoot` gebruikt `payments[0]?.expected_amount × apps.length`. Vervang door de werkelijke som van alle `expected_amount`-waarden uit de betaalrecords.

- [x] **BetalingenPage: samenvatting laadt niet direct na "Genereer jaar"**
  Summary-query had `enabled: payments.length > 0`. Na genereren zijn de records nog niet in React-state geladen. Opgelost: `enabled: !!vveId`.

- [x] **BetalingenPage: historische data ouder dan 2 jaar onbereikbaar**
  Jaar-selector uitgebreid naar 10 jaar (huidig jaar − 7 t/m huidig jaar + 2).

- [x] **MeldingenPage: onopgeslagen urgentie/notitie verdwijnt stil bij kaart sluiten**
  Urgentie slaat nu direct op zoals status. Alleen notitieveld heeft nog een save-knop.

- [x] **MeldingenPage: melding aanmaken stuurt lange tekst als URL query params**
  Backend gebruikt nu `Form()` params; frontend verstuurt FormData inclusief foto-upload.

- [x] **Appartementenpage: nieuw bijdragenplan slaat niet op na 2 iteraties vanuit deze pagina. Wel wordt het bijdragnplan opgeslagen in Tabblad Financieel**
  Voer een analyse uit voordat je het oplost.

- [x] **Appartementenpage: aandeel-noemer zit geen validatie op als nieuw appartement wordt toegevoegd waardoor de teller hoger wordt dan de noemer**
  Voer een analyse uit voordat je het oplost.

### Prioriteit 2 — Ontbrekende functionaliteit

- [x] **MeldingenPage: foto-upload**
  Frontend heeft nu een bestandskiezer. FormData stuurt foto mee naar de backend.

- [x] **MeetingsPage: vergadering bewerkbaar na aanmaken**
  Bewerkknop (potlood) toegevoegd aan elke vergaderingskaart. EditMeetingModal gebruikt bestaand PATCH-endpoint.

- [x] **MeetingsPage: notulen uploaden als PDF-bestand**
  UploadMinutesForm ondersteunt nu bestandsupload (PDF/DOCX) naast tekst via FormData.

- [x] **MeetingsPage: vergadering verwijderen**
  DELETE-endpoint toegevoegd aan backend; verwijderknop toegevoegd aan vergaderingskaart.

- [x] **AppartementsPage: appartement deactiveren/activeren**
  Power-knop toegevoegd in de appartementen-tabel; PATCH met `{ is_active }` via bestaand endpoint.

- [x] **App-breed: 404-pagina**
  NotFoundPage aangemaakt; catch-all `*`-route toegevoegd in App.tsx.

- [ ] **App-breed: e-mailnotificaties**
  Eigenaar krijgt geen bericht bij nieuw betalingsverzoek, opgeloste melding of nieuwe aankondiging. SMTP-integratie als minimale stap.

- [ ] **BetalingenPage: notitieveld zichtbaar maken**
  Backend heeft `notes` op `ContributionPayment` en is patchbaar, maar de UI exposeert het niet. Voeg een notitieveld toe in de betaalcel of een apart detailpaneel.

### Prioriteit 3 — Duplicaten & technische schuld

- [ ] **Bijdrage aanmaken: verwijder dubbele invoerplek**
  "Bijdrage aanmaken" staat op zowel AppartementsPage als FinancialPage (zelfde endpoint). Verwijder de knop uit FinancialPage; AppartementsPage → Bijdragen is de bron van waarheid.

- [ ] **share_denominator: verwijder dubbele invoerplek**
  `share_denominator` is instelbaar via AppartementsPage én SettingsPage (`PATCH /vves/{id}`). Verwijder het uit SettingsPage, houd het in AppartementsPage met een waarschuwing over financiële impact.

- [ ] **RapportPage: maak het een printbare wrapper, geen datakopie**
  KPI-tiles, prognose-tabel, tekortanalyse en bijdrage-per-appartement zijn identiek aan DashboardPage. Maak RapportPage een `@media print`-view over DashboardPage-data in plaats van een aparte datalaag.

- [ ] **TakenPage: duidelijk onderscheid met MeetingsPage actiepunten-tab**
  Dezelfde API, twee UIs. Verwijder het aanmaakformulier uit MeetingsPage (of omgekeerd) en maak TakenPage het primaire overzicht met filter op vergadering.

- [ ] **DashboardPage: "Slim plan"-knop staat twee keer op dezelfde pagina**
  Eén keer in de gezondheidsanalyse-banner, eén keer in de prognose-grafiekheader. Verwijder de knop uit de banner; de grafiekheader is de logische vaste locatie.

### Prioriteit 4 — Mobiele toegankelijkheid (iOS & Android)

De app moet volledig bruikbaar zijn op telefoon, zowel voor beheerders als eigenaren.

- [ ] **Responsive layout app-breed**
  Alle pagina's controleren en fixen op smallere schermen (≤ 390px). Huidige knelpunten: MJOP-tabel (te breed voor scroll), inline bewerkformulieren (AppartementsPage, FinancialPage), betalingsmatrix. Gebruik Tailwind `sm:`/`md:` breakpoints en `overflow-x: auto` op tabellen.

- [ ] **PWA (Progressive Web App)**
  Voeg een `manifest.json` en service worker toe zodat de app als icoon op het startscherm geïnstalleerd kan worden (iOS Safari "Voeg toe aan beginscherm", Android Chrome "Installeren"). Minimaal vereist: `manifest.json` met naam, icoon en `display: standalone`, en een basis service worker voor offline-fallback.

- [ ] **Touch-vriendelijke interactie-elementen**
  Buttons en klikgebieden minimaal 44×44 px (Apple HIG-richtlijn). Inline cel-editing in de MJOP-tabel werkt niet goed met touch — vervang door een tap-to-edit patroon met een kleine popup of bottom sheet op mobiel.

- [ ] **Mobiele navigatie**
  De huidige zijbalk is te smal op telefoon. Voeg een hamburger-menu of een bottom navigation bar toe voor telefoonformaat.

- [ ] **App Store / Play Store (optioneel, later)**
  Als PWA niet voldoende is: verpak de web-app in een native shell via Capacitor of Expo WebView en publiceer als native app. Dit is een later stadium — PWA is de minimale stap.

### Prioriteit 4 — UX & Flow

- [ ] **App-breed: succes-feedback na mutaties (toast/snackbar)**
  De meeste mutaties (bijdrageplan aanmaken, vergadering plannen, document uploaden, aankondiging) geven geen visuele bevestiging. Voeg een consistente toast-component toe voor gebruik door alle pagina's.

- [ ] **App-breed: consistente verwijderbevestiging**
  Sommige pagina's gebruiken `window.confirm()`, andere verwijderen direct. Vervang door één in-app bevestigingsdialoog voor alle destructieve acties.

- [ ] **DashboardPage: eigenaar-bijdragekaart linkt door naar BetalingenPage**
  De eigenaar-kaart toont bijdragebedrag maar heeft geen CTA naar eigen betalingshistorie. Voeg een "Bekijk mijn betalingen"-link toe.

- [ ] **MeetingsPage + DocumentsPage: koppel vergaderingsnotulen aan Documenten**
  Na goedkeuring van notulen in MeetingsPage zou het document automatisch in DocumentsPage moeten verschijnen onder categorie "Vergadering".

- [ ] **MeldingenPage: maak status- en veldbeheer consistent**
  Status slaat direct op via `select`, urgentie en notitie vereisen een aparte knop. Kies één patroon — bij voorkeur alles via één bewaar-knop.

- [ ] **SettingsPage + AppartementsPage: waarschuwing bij wijzigen aandeel-noemer**
  Wijziging van `share_denominator` herberekent direct alle bijdragen, de betalingsmatrix en het reservefonds-saldo. Toon een preview van de nieuwe bijdragen per appartement en vraag bevestiging vóór opslaan.

- [ ] **TakenPage: cyclische status-toggle verduidelijken**
  Klikken doorloopt open → bezig → klaar → open zonder onderscheid tussen "voortgang" en "reset". Voeg een bevestigingsstap toe bij terugzetten naar "open", of gebruik aparte knoppen.

- [ ] **SettingsPage: verberg tab-balk als eigenaar slechts één tab ziet**
  Eigenaar ziet "Profiel" als enige tab — een lege tab-balk ziet er onaf uit. Toon de tab-balk alleen als er meer dan één tab zichtbaar is.

- [ ] **Mobile-responsive check**
  Tailwind-breakpoints controleren op alle pagina's; inline bewerkformulieren (AppartementsPage, FinancialPage) breken op smallere schermen.

- [ ] **Foutmeldingen en validatie verbeteren**
  API-foutberichten (HTTP 400/422/500) worden momenteel onbewerkt getoond. Vertaal naar gebruiksvriendelijke tekst per actie.

- [ ] **Onboarding-flow voor nieuwe VvE**
  Stap-voor-stap wizard: VvE aanmaken → appartementen toevoegen → bijdrageplan instellen → MJOP uploaden.

### Prioriteit 5 — Nice to have

- [ ] **PDF-rapport exporteren** (echte PDF, niet `window.print()`) — forecast, scenario's, bijdrageoverzicht
- [ ] **Bijdrage-aanpassing wizard** — stap-voor-stap doorrekening nieuwe bijdrage met impact per appartement
- [ ] **Microsoft Teams integratie** — vergadering aanmaken, leden uitnodigen (backend gereed, frontend Teams-flow ontbreekt)
- [ ] **Offertes workflow** — offerte koppelen aan MJOP-post, goedkeuren, status bijhouden
- [ ] **Document-preview** — PDF inline weergeven zonder download
- [ ] **Appartementen import via Excel/CSV**
- [ ] **Zoek- en sorteerfunctie MJOP-tabel** (bij 100+ posten onhanteerbaar)
- [ ] **Herinneringsfunctie achterstallige betalers** — manuele trigger of automatische e-mail
- [ ] **standaard format voor agenda aanhouden bij het opmaken van agenda** — Hier zitten de formaliteiten in
- [ ] **In het dashboard wil ik dat werkelijke kosten die gemaakt zijn worden overgenomen ipv de begrote kosten indien de activiteit op afgerond is gezet** — Voer eerst een analyse uit wat nodig is en of er onduidelijkheden zijn
---

## Architectuur (huidig)

```
Render Web Service (Docker)
├── FastAPI (uvicorn, port 8000)
│   ├── /api/auth                    JWT login + /me profiel
│   ├── /api/vves                    VvE CRUD + leden
│   ├── /api/vves/{id}/appartementen Appartementen CRUD
│   ├── /api/vves/{id}/financial     MJOP, reservefonds, bijdrageplan, dashboard
│   ├── /api/vves/{id}/meetings      Vergaderingen, agenda, notulen
│   ├── /api/vves/{id}/tasks         Actiepunten
│   ├── /api/vves/{id}/payments      Bijdrage-betalingen (matrix)
│   ├── /api/vves/{id}/meldingen     Onderhouds­meldingen
│   ├── /api/vves/{id}/documents     Documenten
│   ├── /api/vves/{id}/announcements Aankondigingen
│   └── /*                           React SPA (dist/)
└── Render PostgreSQL
    ├── vves
    ├── users
    ├── appartementen
    ├── user_vve_access
    ├── mjop_uploads / mjop_items / quotes
    ├── reservefonds_entries / contribution_plans / scenario_choices
    ├── meetings / agenda_items / meeting_minutes
    ├── action_items
    ├── contribution_payments
    ├── meldingen
    ├── vve_documents
    └── announcements
```

### Tech stack

| Laag | Technologie |
|------|-------------|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2.x |
| Database | PostgreSQL (productie) / SQLite (lokaal) |
| Frontend | React 18 + TypeScript + Tailwind CSS + Recharts |
| Auth | JWT Bearer token (8 uur), rollen: platform_admin / beheerder / eigenaar |
| Hosting | Render.com (Docker multi-stage, gratis tier) |
| Repo | github.com/sgieles/VvE-beheer |

---

## Deployment

- **Repo**: https://github.com/sgieles/VvE-beheer
- **Live**: https://vve-beheer-8lda.onrender.com
- **CI/CD**: push naar `main` → automatische Docker build + deploy op Render
- **Develop**: feature-werk op `develop`, mergen naar `main` om te deployen
- **Database**: Render PostgreSQL (gratis, 256 MB), migrations via `_run_migrations()` in `main.py`
- **Uploads**: ephemeral (verdwijnen bij redeploy) — acceptabel voor huidige fase
- **Demo**: gebruiker `beheerder` / wachtwoord `vvebeheer123`, auto-aangemaakt bij opstart
