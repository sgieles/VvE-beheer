# VvE Financieel Beheer — Build Plan

## Visie

VvE Financieel Beheer geeft een VvE-beheerder een helder beeld van toekomstige onderhoudskosten en berekent continu of de maandelijkse bijdragen van eigenaren voldoende zijn om die kosten te dekken. Slimme planning helpt tekorten te voorkomen door kosten efficiënt over periodes te verdelen.

---

## MVP-definitie

### Kern (verplicht voor MVP)

**1. VvE en appartementen**
- VvE aanmaken met naam, adres, bijdrage-frequentie (maand/kwartaal)
- Appartementen toevoegen met: naam/nummer, eigenaar, aandeel (als breuk bv. 2/32)
- Aandelen flexibel aanpassen — totaal hoeft niet per se op 1 uit te komen (breuknotatie)

**2. Bijdragesysteem**
- Bijdrage invoeren per aandeel-eenheid (bv. €57,50 per 1/32 deel)
- App berekent automatisch wat elk appartement betaalt op basis van aandeel × eenheidsbijdrage
- Bijdrage-frequentie: maandelijks of per kwartaal
- Historisch bijdrageplan: meerdere periodes mogelijk (bv. bijdragewijziging per 1 jan)

**3. MJOP beheer**
- Upload Excel/PDF → automatisch geparsed naar posten per jaar/kwartaal
- PDF-parser via Claude API: PDF wordt als document naar Claude gestuurd, die gestructureerde MJOP-posten teruggeeft (betrouwbaarder dan heuristische regex-aanpak)
- Handmatig posten toevoegen (omschrijving, categorie, jaar, kwartaal, bedrag)
- Posten bewerken: datum verschuiven (jaar/kwartaal), bedrag corrigeren, verwijderen
- Categorieën: dak, gevel, installaties, lift, kozijnen, etc.

**4. Reservefonds**
- Huidig saldo invoeren
- Mutaties bijhouden (stortingen, onttrekkingen met datum en omschrijving)
- Automatische maandelijkse bijschrijving: bijdragen worden op de 20ste van elke maand automatisch geboekt als positieve mutatie
- Balanssheet upload: PDF/Excel upload van de bankbalans → systeem leest het saldo en de datum, berekent huidig reservefonds als: saldo op balansdatum + bijdragen van balansdatum tot vandaag

**5. Financieel dashboard (hoofdscherm)**
- KPI-blokken: huidig saldo, bijdrage per maand, kosten komend jaar, kosten komende 5 jaar
- Grafiek reservefonds verloop: lijndiagram saldo (Y-as) over kwartalen (X-as), gecombineerd met staafdiagram bijdragen (groen) en kosten (rood)
- Tekortjaren/-kwartalen rood gemarkeerd
- Bijdrage-overzicht per appartement (wat betaalt elk appartement per periode)
- Financiële gezondheidsanalyse: welke MJOP-posten brengen het fonds in gevaar, en drie concrete interventie-scenario's:
  1. Kosten verschuiven in de tijd — systeem stelt optimaal verschuifmoment voor
  2. Eenmalige extra bijdrage — bedrag per appartement op basis van aandeel
  3. Maandelijkse bijdrage verhogen — nieuw bedrag per 1/N aandeel
- Ad-hoc kostenpost simuleren: voer een tijdelijke post in → analyse herberekent direct of de post haalbaar is, ten koste gaat van begrote posten, of niet gedekt kan worden; oranje markering in grafiek; optie om op te slaan of te verwijderen

**6. Dekkingsanalyse + scenario's**
- Automatische berekening: reservefonds + bijdragen − kosten per periode
- Bij tekort: drie scenario's uitgewerkt met concrete bedragen
  - Bijdrage verhogen (nieuw bedrag per aandeel-eenheid)
  - Kosten uitstellen (welke posten, naar wanneer)
  - Eenmalige extra bijdrage (bedrag per appartement op basis van aandeel)

**7. Slimme planning**
- Algoritme dat jaarlijkse/kwartaalkosten herverdeelt over aangrenzende periodes
- Doel: kasbalans optimaliseren zonder grote tekortpieken
- Suggereert welke posten verschoven kunnen worden (±1 of 2 jaar/kwartalen)
- Gebruiker ziet "origineel plan" vs. "slim plan" naast elkaar
- Na akkoord worden de verschuivingen opgeslagen als aangepaste planning

**8. Ad-hoc simulatie**
- Knop "Simuleer extra kost" — voer tijdelijke post in
- Dashboard herberekent direct met oranje markering
- Banner: opslaan als definitieve post of verwijderen

**9. Authenticatie**
- 1 superuser (ingesteld via omgevingsvariabelen)
- JWT-gebaseerde sessie (8 uur geldig)

---

## Wat al gebouwd is

### Fase 0 — Fundament ✅
- FastAPI backend + SQLAlchemy ORM
- React + TypeScript + Tailwind CSS frontend
- JWT authenticatie + 1 superuser auto-seed
- MJOP upload (Excel/PDF parser)
- MJOP items CRUD
- Reservefonds mutaties
- Bijdrageplan
- Financieel dashboard (basisversie: balans per jaar)
- Scenario calculator (bijdrageverhoging, uitstellen, eenmalige bijdrage)
- GitHub repo: `sgieles/VvE-beheer`
- Render.com deployment (Docker + PostgreSQL)

---

## Backlog

### Fase 1 — MVP kern (bouwen)

**Appartementen & bijdragen**
- [x] `Appartement` model: naam, nummer, eigenaar, aandeel (Decimal)
- [x] VvE `share_denominator`: bijdrage per 1/N aandeel-eenheid instellen
- [x] Bijdrage per appartement berekenen op basis van aandeel (proportioneel)
- [x] Bijdrage-overzicht per appartement op dashboard
- [ ] Historisch bijdrageplan (meerdere periodes)
- [x] Automatische bijschrijving op de 20ste: bij berekening huidig saldo worden bijdragen sinds laatste entry automatisch meegeteld (geen DB-entries, puur berekend)
- [ ] Balanssheet upload: PDF/Excel bankbalans inlezen → saldo + datum extraheren → reservefonds berekenen als saldo + bijdragen vanaf balansdatum t/m vandaag

**Dashboard & grafiek**
- [x] KPI-blokken: saldo nu, kosten 5/10 jaar
- [x] Vroegtijdige waarschuwing op dashboard (tekort binnen 2 jaar) — suggestie D ✅
- [x] Inflatie-/indexatiecorrectie via query-parameter `?inflatie=X` — suggestie A ✅
- [x] Tijdsgranulariteit instelbaar: jaar / kwartaal (toggle op dashboard)
- [x] Jaar-filter: kijkperiode instellen (5 / 10 / 20 jaar of aangepast)
- [x] Gestapeld staafdiagram: bijdragen (groen) vs. kosten (rood) per periode
- [x] Tekortanalyse: lijst van periodes met tekort + bedrag

**Slimme planning**
- [ ] Algoritme: verschuif duurste posten in tekortperiodes naar aangrenzende periodes
- [ ] Vergelijkingsweergave: origineel plan vs. slim plan
- [ ] Gebruiker kan voorstel accepteren of individuele verschuivingen aanpassen
- [ ] Limiet instellen: maximaal X jaar/kwartalen verschuiven

**MJOP verbeteringen**
- [x] PDF-parser twee-staps aanpak: Claude API (claude-haiku) leest PDF als document → ruwe JSON; Python valideert jaar/bedrag/categorie en flaggt twijfelaars; automatische fallback op heuristische regex als ANTHROPIC_API_KEY niet ingesteld is
- [ ] Categorieën per post (dak, gevel, installaties, lift, kozijnen, overig)
- [ ] Groepeerweergave per categorie met subtotalen — suggestie E (taartdiagram kosten per categorie)
- [ ] Actueel vs. begroot: werkelijke kosten invullen bij afgeronde posten — suggestie C
- [ ] Bulk-bewerking: meerdere posten tegelijk verschuiven

**Simulatie & gezondheidsanalyse**
- [ ] Ad-hoc simulatiepost toevoegen (oranje in grafiek)
- [ ] Heranalyse na toevoegen ad-hoc post: systeem toont of post haalbaar is, welke begrote posten erdoor in gevaar komen, of het fonds tekort schiet
- [ ] Opslaan als definitieve post of verwijderen
- [ ] Financiële gezondheidsanalyse prominent op dashboard: welke posten vormen risico, drie scenario's uitgewerkt met concrete bedragen per appartement
- [ ] Scenario 1 — kosten verschuiven: algoritme stelt optimaal verschuifmoment voor (minste impact op fonds)
- [ ] Scenario 2 — eenmalige bijdrage: berekening per appartement op basis van aandeel
- [ ] Scenario 3 — bijdrage verhogen: nieuw maandbedrag per 1/N aandeel om tekorten te dekken

### Fase 2 — Kwaliteit & UX

- [ ] Mobile-responsive check (Tailwind breakpoints)
- [ ] Lege-staat pagina's (wat te doen als er nog geen MJOP is)
- [ ] Foutmeldingen en validatie verbeteren
- [ ] Laadstatus / skeleton loaders
- [ ] Onboarding-flow voor nieuwe VvE (stap-voor-stap wizard)

### Fase 3 — Nice to have (uit MVP-definitie)

- [ ] PDF-rapport exporteren (forecast, scenario's, bijdrageoverzicht) — suggestie B
- [ ] Bijdrage-aanpassing wizard (stap-voor-stap doorrekening nieuwe bijdrage) — suggestie F
- [ ] Microsoft Teams integratie (vergadering aanmaken, leden uitnodigen)
- [ ] Vergaderbeheer (agenda, notulen uploaden)
- [ ] Offertes workflow (offerte koppelen aan MJOP-post, goedkeuren)

---

## Uitbreidingen — status

| # | Functie | Status |
|---|---------|--------|
| A | **Inflatie-/indexatiecorrectie** | ✅ Gebouwd — query param `?inflatie=X` op dashboard-endpoint |
| B | **PDF-rapport exporteren** | 📋 Backlog Fase 3 |
| C | **Actueel vs. begroot** | 📋 Backlog Fase 1 (MJOP-module) |
| D | **Vroegtijdige waarschuwing** | ✅ Gebouwd — rode banner op dashboard bij tekort binnen 2 jaar |
| E | **MJOP categorieën-dashboard** | 📋 Backlog Fase 1 (MJOP-module) |
| F | **Bijdrage-aanpassing wizard** | 📋 Backlog Fase 3 |

---

## Architectuur (huidig)

```
Render Web Service (Docker)
├── FastAPI (uvicorn)
│   ├── /api/auth          JWT login
│   ├── /api/vves          VvE + appartementen
│   ├── /api/vves/1/financial   MJOP, reservefonds, bijdrageplan, dashboard
│   └── /*                 React SPA (dist/)
└── Render PostgreSQL
    ├── vves
    ├── users              (tijdelijk, wordt vervangen door appartementen)
    ├── mjop_uploads / mjop_items
    ├── reservefonds_entries
    └── contribution_plans
```

### Tech stack

| Laag | Technologie |
|------|-------------|
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| Database | PostgreSQL (productie) / SQLite (lokaal) |
| Frontend | React 18 + TypeScript + Tailwind CSS + Recharts |
| Auth | JWT (Bearer token, 8 uur) |
| Hosting | Render.com (Docker, gratis tier) |
| Repo | github.com/sgieles/VvE-beheer |

---

## Deployment

- **Repo**: https://github.com/sgieles/VvE-beheer
- **Live**: https://vve-beheer-8lda.onrender.com
- **CI/CD**: push naar `main` → automatische Docker build + deploy op Render
- **Database**: Render PostgreSQL (gratis, 256MB)
- **Uploads**: ephemeral (verdwijnen bij redeploy) — acceptabel zolang we richting handmatige invoer gaan
