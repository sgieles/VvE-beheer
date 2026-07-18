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
  Oorzaak: backend maakte duplicate plannen bij zelfde `effective_from` (strict `<` check). Opgelost met upsert: als plan met zelfde datum bestaat, wordt `amount_per_period` bijgewerkt i.p.v. nieuw plan aanmaken.

- [x] **Appartementenpage: aandeel-noemer zit geen validatie op als nieuw appartement wordt toegevoegd waardoor de teller hoger wordt dan de noemer**
  Validatie toegevoegd in `handleSubmit`: blokkeert opslaan als teller > noemer of totaal > noemer. Live-hint toont resterend aandeel en waarschuwing bij overschrijding.

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

- [x] **BetalingenPage: notitieveld zichtbaar maken**
  NotitiesModal per rij toegevoegd (MessageSquare-knop). Beheerder kan per periode notities lezen en bewerken via PATCH.

### Prioriteit 3 — Duplicaten & technische schuld

- [x] **Bijdrage aanmaken: verwijder dubbele invoerplek**
  "Bijdrage aanmaken" staat op zowel AppartementsPage als FinancialPage (zelfde endpoint). Knop en modal verwijderd uit FinancialPage BijdragenTab; lege-staat verwijst nu naar AppartementsPage.

- [x] **share_denominator: verwijder dubbele invoerplek**
  `share_denominator` verwijderd uit SettingsPage; blijft uitsluitend in AppartementsPage.

- [ ] **RapportPage: maak het een printbare wrapper, geen datakopie**
  KPI-tiles, prognose-tabel, tekortanalyse en bijdrage-per-appartement zijn identiek aan DashboardPage. Maak RapportPage een `@media print`-view over DashboardPage-data in plaats van een aparte datalaag.

- [x] **TakenPage: duidelijk onderscheid met MeetingsPage actiepunten-tab**
  Dezelfde API, twee UIs. Verwijder het aanmaakformulier uit MeetingsPage (of omgekeerd) en maak TakenPage het primaire overzicht met filter op vergadering.

- [x] **DashboardPage: "Slim plan"-knop staat twee keer op dezelfde pagina**
  Knop verwijderd uit de "financieel gezond"-banner; blijft in de prognose-grafiekheader.

### Prioriteit 4 — Mobiele toegankelijkheid (iOS & Android)

De app moet volledig bruikbaar zijn op telefoon, zowel voor beheerders als eigenaren.

- [x] **Responsive layout app-breed — tabellen**
  MJOP-tabel en betalingsmatrix hebben nu `overflow-x: auto` + `min-w-max/640px` zodat ze horizontaal scrollen op kleine schermen. Inline bewerkformulieren (AppartementsPage, FinancialPage) nog te fixen.

- [x] **PWA (Progressive Web App)**
  `manifest.json` aangemaakt met naam, icoon-placeholders en `display: standalone`. Service worker (`sw.js`) registreert zich via `main.tsx` met network-first strategie. iOS Apple-meta-tags toegevoegd aan `index.html`.

- [x] **Touch-vriendelijke interactie-elementen**
  Icon-only knoppen in tabellen (Power, Pencil, Trash2) krijgen `p-2` padding. Status-cirkel in TakenPage: `w-8 h-8` op mobiel, `sm:w-6 sm:h-6` op desktop. Betaalcellen in BetalingenPage: `w-9 h-9 sm:w-7 sm:h-7`.

- [x] **Mobiele navigatie**
  Hamburger-menu toegevoegd: sidebar schuift in via slide-animatie, overlay sluit het menu, nav-links sluiten het menu bij klikken.

- [ ] **App Store / Play Store (optioneel, later)**
  Als PWA niet voldoende is: verpak de web-app in een native shell via Capacitor of Expo WebView en publiceer als native app. Dit is een later stadium — PWA is de minimale stap.

### Prioriteit 4 — UX & Flow

- [x] **App-breed: succes-feedback na mutaties (toast/snackbar)**
  Toast-systeem toegevoegd (toastStore + Toaster-component). MeldingenPage, MeetingsPage, BetalingenPage gebruiken het al.

- [x] **App-breed: consistente verwijderbevestiging**
  `ConfirmDialog`-component aangemaakt. Alle 7 `window.confirm()`-calls vervangen in: TakenPage, DocumentsPage, MeetingsPage, MembersPage, MeldingenPage, FinancialPage (OfferteModal).

- [x] **DashboardPage: eigenaar-bijdragekaart linkt door naar BetalingenPage**
  "Bekijk mijn betalingsoverzicht →" link toegevoegd in de eigenaar-bijdragekaart.

- [x] **MeetingsPage + DocumentsPage: koppel vergaderingsnotulen aan Documenten**
  Backend `approve_minutes` kopieert het notulenbestand naar de documenten-map en maakt automatisch een VvEDocument-record aan (categorie "notulen"). Verschijnt direct in DocumentsPage na goedkeuring.

- [x] **MeldingenPage: maak status- en veldbeheer consistent**
  Status én urgentie slaan direct op via `select onChange`. Alleen notitieveld heeft een aparte opslaanknop (logisch voor vrij tekstveld). Eén consistent patroon.

- [x] **SettingsPage + AppartementsPage: waarschuwing bij wijzigen aandeel-noemer**
  Inline impact-preview toont oud→nieuw bijdrage per appartement zodra denomInput afwijkt. ConfirmDialog vereist bevestiging vóór opslaan.

- [x] **TakenPage: cyclische status-toggle verduidelijken**
  ConfirmDialog toegevoegd voor terugzetten naar "open" (klaar→open). Open→bezig en bezig→klaar werken direct. Title gewijzigd naar "Heropen" bij de terugzet-actie.

- [x] **SettingsPage: verberg tab-balk als eigenaar slechts één tab ziet**
  Tab-balk omsloten met `{isBeheerder && ...}` — eigenaar ziet direct het Profiel-formulier zonder lege tab-navigatie.

- [x] **Mobile-responsive check**
  AppartementsPage: appartement-tabel wrapped in `overflow-x-auto` + `min-w-[640px]`. AppartementsPage: resterende `window.confirm()` voor appartement-delete vervangen door ConfirmDialog.

- [x] **Foutmeldingen en validatie verbeteren**
  `apiError()` utility + toast `onError` callback toegevoegd aan alle key mutations in TakenPage, MeetingsPage, BetalingenPage, DocumentsPage, FinancialPage, AppartementsPage, SettingsPage.

- [ ] **Onboarding-flow voor nieuwe VvE**
  Stap-voor-stap wizard: VvE aanmaken → appartementen toevoegen → bijdrageplan instellen → MJOP uploaden.

### Prioriteit 5 — Nice to have

- [ ] **PDF-rapport exporteren** (echte PDF, niet `window.print()`) — forecast, scenario's, bijdrageoverzicht
- [ ] **Bijdrage-aanpassing wizard** — stap-voor-stap doorrekening nieuwe bijdrage met impact per appartement
- [ ] **Microsoft Teams integratie** — vergadering aanmaken, leden uitnodigen (backend gereed, frontend Teams-flow ontbreekt)
- [ ] **Offertes workflow** — offerte koppelen aan MJOP-post, goedkeuren, status bijhouden
- [x] **Document-preview** — PDF inline in full-screen iframe modal via blob URL; niet-PDF toont download-knop
- [x] **Appartementen import via Excel/CSV** — CSV-import endpoint (POST /appartementen/import), sjabloon-download, "CSV importeren"-knop in AppartementsPage header; fouten worden getoast
- [x] **Zoek- en sorteerfunctie MJOP-tabel** — zoekbalk filtert op omschrijving en categorie; lege zoekresultaatmelding
- [x] **Herinneringsfunctie achterstallige betalers** — achterstalligen-panel in BetalingenPage toont lijst per appartement (naam, eigenaar, # periodes, bedrag) met "Exporteer CSV"-knop voor eigen opvolging
- [x] **standaard format voor agenda aanhouden bij het opmaken van agenda** — "Standaard VvE-agenda toevoegen"-knop in lege agenda-tab; voegt 7 vaste punten toe (Opening, Notulen, Ingekomen stukken, Financiën, MJOP-voortgang, Rondvraag, Sluiting)
- [x] **Dashboard: werkelijke kosten voor afgeronde MJOP-posten**
  Dashboard-berekening gebruikt nu `actual_amount` in plaats van `planned_amount` voor posten met `status == "completed"` en een ingevuld werkelijk bedrag. Geen onduidelijkheden: het veld bestaat al, was alleen niet meegenomen in de prognose.
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
