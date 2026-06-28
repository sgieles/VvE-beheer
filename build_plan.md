# VvE Beheer — Build Plan

## Wat de app doet

Een financieel planningsinstrument voor een Vereniging van Eigenaren. De kern:

- **Inzicht in toekomstige kosten**: het Meerjarenonderhoudsplan (MJOP) geeft per jaar/kwartaal weer welke onderhoudswerkzaamheden gepland staan en wat die kosten.
- **Dekkingsanalyse**: de app berekent of de huidige bijdragen van leden voldoende zijn om het reservefonds op peil te houden tot en met het laatste MJOP-jaar.
- **Simulatie van ad-hoc kosten**: de beheerder voegt een tijdelijke extra kostenpost toe; de grafiek herberekent direct. Na akkoord wordt de post permanent, anders verwijderd.
- **Scenario's bij tekort**: bijdrage verhogen, activiteiten uitstellen of eenmalige extra bijdrage — met bedragen per appartement.

---

## Scope MVP v2 (vereenvoudigd)

### Wat blijft
- MJOP upload (Excel/PDF) + heuristisch parser
- MJOP items handmatig toevoegen en bewerken
- Reservefonds mutaties bijhouden (saldo)
- Bijdrageplan instellen (bedrag per periode, frequentie)
- Financieel dashboard: balans-grafiek per jaar + tekortanalyse
- 3 scenario's: bijdrageverhoging, activiteit uitstellen, eenmalige heffing
- Ad-hoc simulatiekosten (tijdelijke posten met aparte status)

### Wat wordt verwijderd (vereenvoudiging)
- Multi-VvE / multi-tenancy → 1 VvE per installatie
- Rolsysteem (eigenaar / beheerder / platform_admin) → 1 superuser
- Microsoft Teams integratie
- Vergaderbeheer (meetings, agenda, notulen)
- Offertes workflow
- Ledenbeheer wordt minimaal: naam + aandeel per appartement (alleen voor bijdragesplitsing)

### 1 superuser
Enkelvoudige inlogpagina met gebruikersnaam + wachtwoord (in `.env`). Geen registratie, geen rollen, geen lidregistratie.

---

## Kern gebruikersflows

### 1. Onboarding
1. Superuser logt in
2. VvE-info invullen: naam, bijdrage-frequentie (maand/kwartaal), bijdrage per periode
3. Huidig reservefonds saldo invoeren
4. Optioneel: appartementen invoeren met aandeel (voor bijdragesplitsing)

### 2. MJOP beheren
1. Upload Excel/PDF → automatisch geparsed naar items per jaar
2. Of: handmatig items toevoegen (omschrijving, jaar, kwartaal, bedrag)
3. Items aanpassen (jaar verschuiven, bedrag corrigeren, verwijderen)

### 3. Financieel dashboard (hoofdscherm)
1. Grafiek: balans per jaar — bijdragen (groen) vs. kosten (rood)
2. Tekortjaren worden gemarkeerd
3. KPI-blokken: huidig saldo, totale kosten 5 jaar / 10 jaar
4. Scenario-knop: berekent bijdrageverhoging / uitstellen / eenmalige bijdrage

### 4. Ad-hoc simulatie
1. Knop "Simuleer extra kost" → modal met omschrijving, jaar, bedrag
2. Dashboard herberekent onmiddellijk met de extra post (oranje markering)
3. Banner: "Simulatie actief — opslaan als MJOP-post of verwijderen?"
4. Na opslaan: post wordt gewone MJOP-post; simulatie-status vervalt

---

## Backlog

### Fase 1 — Vereenvoudiging (implementeren)
- [ ] Verwijder multi-VvE code; vve_id wordt een vaste constante (1)
- [ ] Verwijder rolsysteem → 1 superuser credentials in `.env`
- [ ] Verwijder meetings / agenda / notulen / Teams router + modellen
- [ ] Verwijder offertes (Quote model en router)
- [ ] Verwijder `vve_access` tabel
- [ ] Vereenvoudig ledenlijst: alleen naam + aandeel (geen login-account per lid)
- [ ] Voeg `simulation` status toe aan MJOPItem + simulatie-flow
- [ ] Dashboard: prominente grafiek als hoofdscherm (vervang huidige pagina-structuur)
- [ ] Bijdragesplitsing per appartement tonen op dashboard

### Fase 2 — Deployment
- [ ] Dockerfile: backend + frontend build in één image
- [ ] FastAPI serveert React `dist/` als static files (1 service, geen nginx nodig)
- [ ] SQLite op persistent volume (Render Disk)
- [ ] GitHub repo aanmaken: `SGieles/vve-beheer`
- [ ] Render.com web service koppelen (project `prj-d8oqd54m0tmc73d1q0h0`)
- [ ] Environment variables instellen op Render (SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD)

### Fase 3 — Kwaliteitsverbetering
- [ ] Jaar-filter op dashboard: kijkperiode instellen (5 / 10 / 20 jaar of handmatig)
- [ ] MJOP items groeperen per categorie (dak, gevel, installaties, etc.) met subtotalen
- [ ] Bijdragesplitsing detailpagina: per appartement hoeveel per maand/kwartaal
- [ ] Mobile-responsive check en aanpassingen (Tailwind breakpoints)
- [ ] Grafiek verbeteren: gestapelde staafdiagrammen bijdragen vs. kosten per jaar

---

## Voorgestelde uitbreidingen (goedkeuring vereist)

De onderstaande functies zijn NIET ingepland — alleen na jouw akkoord:

| # | Functie | Waarde |
|---|---------|--------|
| A | **PDF-rapport exporteren** — 1-klik export van forecast + scenariobedragen als PDF | Handig om in vergadering te tonen |
| B | **Inflatie-/indexatiecorrectie** — MJOP-kosten per jaar met X% ophogen | Realistischere langetermijnprognose |
| C | **Actueel vs. begroot** — werkelijke kosten invoeren bij afgeronde posten zodat historisch saldo klopt | Betere data over tijd |
| D | **Vroegtijdige waarschuwing** — dashboard-badge als reservefonds binnen 24 maanden negatief dreigt te worden | Proactief beheer |
| E | **Vergadernotulen (minimaal)** — markdown tekst opslaan per vergadering, geen Teams | Behoud van relevante functie, sterk vereenvoudigd |

---

## Technische keuze: FastAPI + React vs. Streamlit

**Aanbeveling: behoud FastAPI + React.**

| | Streamlit | FastAPI + React |
|--|-----------|----------------|
| Prototypen | Snel | Meer setup |
| CRUD operaties | Omslachtig | Natuurlijk |
| Auth / routing | Workarounds nodig | Ingebouwd |
| Mobiele UX | Matig | Goed (Tailwind responsive) |
| Interactiviteit | Herlaadt gehele pagina | Instant updates |
| Deployment | 1 Python process | 1 gecombineerde service |

Streamlit is uitstekend voor data-exploratie door data scientists. Voor een CRUD-intensieve app met een inlogscherm, formulieren en directe simulatie-feedback is React beter geschikt. De huidige stack werkt al op mobiel zodra Tailwind responsive breakpoints correct worden toegepast — dat is minder werk dan een Streamlit-rebuild.

**Conclusie**: geen conversie naar Streamlit. Wel de huidige frontend mobile-responsive maken.

---

## Deployment: GitHub → Render.com

### Architectuur (1 gecombineerde service)
```
Render Web Service
└── Docker container
    ├── FastAPI (uvicorn, port 8000)
    │   ├── /api/*  → backend routes
    │   └── /*      → serveert React dist/
    └── SQLite op Render Disk (/data/vve.db)
```

### Stappen
1. GitHub repo aanmaken: `SGieles/vve-beheer` (bevestig naam)
2. `git push origin main`
3. Render web service koppelen aan repo
4. Build command: `pip install -r requirements.txt && cd frontend && npm install && npm run build`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Environment variables op Render:
   - `SECRET_KEY` (willekeurig lang)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `DATABASE_URL=sqlite:////data/vve.db`

### Benodigde bevestigingen van jou
- Naam van de GitHub repo (voorstel: `vve-beheer`)
- Of de repo public of private moet zijn
- Render service naam
- Admin gebruikersnaam + wachtwoord voor productie
