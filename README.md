# VvE Financieel Beheer

> Financieel planningsinstrument voor Verenigingen van Eigenaren — met een blik op de toekomst.

**Live:** https://vve-beheer-8lda.onrender.com

---

## Wat doet de app?

VvE Financieel Beheer geeft een VvE-beheerder inzicht in toekomstige onderhoudskosten en berekent of de maandelijkse bijdragen van eigenaren voldoende zijn om die kosten te dekken. De nadruk ligt op financiële planning en transparantie.

### Kernfunctionaliteit

| Functie | Beschrijving |
|---------|--------------|
| **MJOP beheer** | Upload een Excel/PDF-bestand of voer posten handmatig in per jaar, kwartaal en bedrag |
| **Dekkingsanalyse** | Berekent automatisch of het reservefonds toereikend is, jaar voor jaar |
| **Slimme planning** | Herverdeelt jaarlijkse/kwartaalkosten efficiënt over periodes om tekorten te minimaliseren |
| **Financieel dashboard** | Balans-grafiek per jaar/kwartaal/maand met tekortmarkering en KPI's |
| **Scenario's** | Bij een tekort: bijdrage verhogen, kosten uitstellen, of eenmalige extra bijdrage |
| **Bijdragesysteem** | Bijdrage per aandeel instellen (bv. €57,50 per 1/32 aandeel) per maand of kwartaal |
| **Appartementen** | VvE aanmaken met appartementen, flexibele aandelen per appartement |
| **Reservefonds** | Huidig saldo invoeren en mutaties bijhouden |

---

## Lokaal draaien

### Vereisten
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend

# Virtuele omgeving
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

# Kopieer en vul in:
copy .env.example .env       # Windows
# cp .env.example .env       # Mac/Linux

uvicorn app.main:app --reload
```

Backend: http://localhost:8000  
API docs: http://localhost:8000/docs

Bij eerste start wordt automatisch een admin-user aangemaakt op basis van `ADMIN_USERNAME` en `ADMIN_PASSWORD` uit `.env`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

---

## Architectuur

```
VvE Financieel Beheer
├── backend/                  FastAPI + SQLAlchemy + PostgreSQL (prod) / SQLite (lokaal)
│   ├── app/
│   │   ├── models/           VvE, Appartement, MJOPItem, ReserveFonds, Bijdrageplan
│   │   ├── routers/          auth, appartementen, financial
│   │   ├── schemas/          Pydantic request/response schemas
│   │   ├── services/         MJOP parser (Excel/PDF), scenario calculator, smart planner
│   │   └── core/             Config, JWT, dependencies
│   └── uploads/              Geüploade MJOP-bestanden
└── frontend/                 React + TypeScript + Tailwind CSS
    └── src/
        ├── pages/            Login, Dashboard, Appartementen, MJOP, Instellingen
        ├── components/       Grafieken, modals, formulieren
        ├── services/         Axios API client
        ├── store/            Zustand auth store
        └── types/            TypeScript types
```

---

## Deployment

Gehost op [Render.com](https://render.com) via Docker:

- **Backend + frontend**: één gecombineerde service (FastAPI serveert de React-build)
- **Database**: Render PostgreSQL (gratis tier)
- **CI/CD**: automatische deploy bij elke push naar `main`

Configuratie staat in [`render.yaml`](render.yaml) en [`Dockerfile`](Dockerfile).

### Environment variables (Render dashboard)

| Variable | Omschrijving |
|----------|--------------|
| `ADMIN_USERNAME` | Gebruikersnaam voor inloggen |
| `ADMIN_PASSWORD` | Wachtwoord voor inloggen |
| `SECRET_KEY` | JWT signing key (auto-gegenereerd door Render) |
| `DATABASE_URL` | PostgreSQL connection string (auto-gekoppeld door Render) |

---

## Nice to have (later)

- PDF-rapport exporteren (echte PDF, niet window.print())
- App Store / Play Store publicatie via Capacitor of Expo WebView
