# VvE Beheer Platform — MVP

## Vereisten

- **Python 3.11+** voor de backend
- **Node.js 18+** voor de frontend

---

## Backend opstarten

```bash
cd backend

# Virtuele omgeving aanmaken
python -m venv venv
venv\Scripts\activate          # Windows
# of: source venv/bin/activate  # Mac/Linux

# Afhankelijkheden installeren
pip install -r requirements.txt

# Demo data aanmaken (eenmalig)
python seed.py

# Server starten
uvicorn app.main:app --reload
```

Backend draait op: http://localhost:8000
API docs: http://localhost:8000/docs

Demo accounts:
- `beheerder` / `beheerder123` — beheerder rol
- `eigenaar1` / `eigenaar123` — eigenaar rol
- `eigenaar2` / `eigenaar123` — eigenaar rol

---

## Frontend opstarten

```bash
cd frontend

# Afhankelijkheden installeren
npm install

# Development server starten
npm run dev
```

Frontend draait op: http://localhost:5173

---

## Microsoft Teams integratie (optioneel)

Vul in `backend/.env` de Azure-gegevens in:

```
AZURE_CLIENT_ID=<jouw-app-id>
AZURE_CLIENT_SECRET=<jouw-secret>
AZURE_TENANT_ID=<jouw-tenant-id>
```

Vereiste Graph API permissies: `OnlineMeetings.ReadWrite`, `Calendars.ReadWrite`

---

## Architectuur

```
VvE Beheer Platform
├── backend/           FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── models/    Database modellen (VvE, User, MJOP, Meeting)
│   │   ├── routers/   API routes (auth, users, financial, meetings)
│   │   ├── schemas/   Pydantic schemas (request/response)
│   │   ├── services/  MJOP parser, scenario calculator, Teams
│   │   └── core/      Config, security, JWT
│   └── uploads/       Geüploade bestanden (MJOP, offertes, notulen)
└── frontend/          React + TypeScript + Tailwind CSS
    └── src/
        ├── pages/     LoginPage, Dashboard, Members, Financial, Meetings
        ├── components/ Layout, UI componenten
        ├── services/  Axios API client
        ├── store/     Zustand auth store
        └── types/     TypeScript types
```
