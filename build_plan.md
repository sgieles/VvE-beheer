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
- Handmatig posten toevoegen (omschrijving, categorie, jaar, kwartaal, bedrag)
- Posten bewerken: datum verschuiven (jaar/kwartaal), bedrag corrigeren, verwijderen
- Categorieën: dak, gevel, installaties, lift, kozijnen, etc.

**4. Reservefonds**
- Huidig saldo invoeren
- Mutaties bijhouden (stortingen, onttrekkingen met datum en omschrijving)

**5. Financieel dashboard (hoofdscherm)**
- Balans-grafiek met instelbare tijdsperiode (per jaar / kwartaal / maand)
- Tekortjaren/-kwartalen rood gemarkeerd
- KPI-blokken: huidig saldo, verwacht saldo over 5/10 jaar, totale geplande kosten
- Bijdrage-overzicht per appartement (wat betaalt elk appartement per periode)

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
- [ ] Verwijder huidig ledenmodel (login per lid) → vervang door eenvoudig `Appartement` model
- [ ] Appartement: naam, nummer, eigenaar, aandeel (Decimal breuk)
- [ ] Bijdrage-eenheid instellen: bedrag per 1/N aandeel + frequentie
- [ ] Bijdrage-overzicht per appartement op dashboard
- [ ] Historisch bijdrageplan (meerdere periodes)

**Dashboard & grafiek**
- [ ] Tijdsgranulariteit instelbaar: per jaar / kwartaal / maand
- [ ] Jaar-filter: kijkperiode instellen (5 / 10 / 20 jaar of aangepast)
- [ ] Gestapeld staafdiagram: bijdragen (groen) vs. kosten (rood) per periode
- [ ] KPI-blokken: saldo nu, saldo over 5/10 jaar, totale geplande kosten
- [ ] Tekortanalyse: lijst van periodes met tekort + bedrag

**Slimme planning**
- [ ] Algoritme: verschuif duurste posten in tekortperiodes naar aangrenzende periodes
- [ ] Vergelijkingsweergave: origineel plan vs. slim plan
- [ ] Gebruiker kan voorstel accepteren of individuele verschuivingen aanpassen
- [ ] Limiet instellen: maximaal X jaar/kwartalen verschuiven

**MJOP verbeteringen**
- [ ] Categorieën per post (dak, gevel, installaties, lift, kozijnen, overig)
- [ ] Groepeerweergave per categorie met subtotalen
- [ ] Bulk-bewerking: meerdere posten tegelijk verschuiven

**Simulatie**
- [ ] Ad-hoc simulatiepost toevoegen (oranje in grafiek)
- [ ] Simulatie vergelijken met basisplan
- [ ] Opslaan of verwijderen van simulatiepost

### Fase 2 — Kwaliteit & UX

- [ ] Mobile-responsive check (Tailwind breakpoints)
- [ ] Lege-staat pagina's (wat te doen als er nog geen MJOP is)
- [ ] Foutmeldingen en validatie verbeteren
- [ ] Laadstatus / skeleton loaders
- [ ] Onboarding-flow voor nieuwe VvE (stap-voor-stap wizard)

### Fase 3 — Nice to have (uit MVP-definitie)

- [ ] Microsoft Teams integratie (vergadering aanmaken, leden uitnodigen)
- [ ] Vergaderbeheer (agenda, notulen uploaden)
- [ ] Offertes workflow (offerte koppelen aan MJOP-post, goedkeuren)

---

## Voorgestelde uitbreidingen — goedkeuring vereist

De onderstaande functies zijn **niet ingepland** en worden alleen gebouwd na jouw expliciete akkoord:

| # | Functie | Waarde | Complexiteit |
|---|---------|--------|--------------|
| A | **Inflatie-/indexatiecorrectie** — MJOP-kosten automatisch verhogen met X% per jaar | Realistischere prognose over 10-20 jaar | Laag |
| B | **PDF-rapport exporteren** — 1-klik export van forecast, scenario's en bijdrageoverzicht | Handig voor vergadering presenteren | Middel |
| C | **Actueel vs. begroot** — werkelijke kosten invullen bij afgeronde posten, historisch saldo corrigeren | Betrouwbaardere data over tijd | Laag |
| D | **Vroegtijdige waarschuwing** — badge/melding als reservefonds binnen 12 maanden negatief dreigt te worden | Proactief bijsturen zonder de grafiek te lezen | Laag |
| E | **MJOP categorieën-dashboard** — taartdiagram en barchart van kosten per categorie (dak, gevel, etc.) | Snel inzicht in waar het geld naartoe gaat | Laag |
| F | **Bijdrage-aanpassing wizard** — stap-voor-stap doorrekening van een nieuwe bijdrage-eenheid, met impact per appartement | Transparantie naar eigenaren | Middel |

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
