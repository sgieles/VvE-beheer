import { useState } from 'react'
import {
  LayoutDashboard, Home, TrendingUp, CalendarDays, Building2,
  Upload, PlusCircle, Brain, BarChart2, Wallet, Users,
  ChevronDown, ChevronRight, Info, ArrowRight,
  FileSpreadsheet, CheckCircle2, XCircle, RefreshCw,
  Sliders, Clock, AlertTriangle, Calculator,
} from 'lucide-react'

interface Section {
  id: string
  icon: React.ReactNode
  title: string
  color: string
  intro: string
  steps: { title: string; text: string; icon?: React.ReactNode }[]
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    icon: <LayoutDashboard size={20} />,
    title: 'Dashboard',
    color: 'indigo',
    intro:
      'Het dashboard geeft een volledig financieel overzicht van de VvE. Hier zie je in één oogopslag of het reservefonds op de lange termijn toereikend is.',
    steps: [
      {
        icon: <BarChart2 size={16} />,
        title: 'KPI-blokken',
        text: 'Bovenaan staan vier KPI-blokken: huidig saldo, maandelijkse bijdrage, geplande kosten komende 5 jaar en komende 10 jaar.',
      },
      {
        icon: <BarChart2 size={16} />,
        title: 'Grafiek reservefonds',
        text: 'De grafiek toont het verloop van het saldo per jaar of kwartaal. Groene balken zijn bijdragen, rode zijn kosten. Jaren met een tekort worden rood gemarkeerd.',
      },
      {
        icon: <Sliders size={16} />,
        title: 'Jaar-filter en granulariteit',
        text: 'Gebruik de knoppen rechtsboven om de kijkperiode in te stellen (5 / 10 / 20 jaar of aangepast) en te wisselen tussen jaar- en kwartaalweergave.',
      },
      {
        icon: <AlertTriangle size={16} />,
        title: 'Tekortanalyse',
        text: 'Onder de grafiek verschijnt een rode melding bij dreigende tekorten. De drie scenario\'s (bijdrage verhogen, kosten uitstellen, eenmalige bijdrage) tonen concrete bedragen per appartement.',
      },
      {
        icon: <Brain size={16} />,
        title: 'Slim plan',
        text: 'De knop "Bereken slim plan" laat een algoritme tekortjaren oplossen door dure MJOP-posten te verschuiven naar aangrenzende jaren. Gebruik de slider om de maximale verschuiving in te stellen (kwartalen). Bekijk de vergelijkingsgrafiek en klik "Accepteer verschuivingen" om het plan op te slaan.',
      },
    ],
  },
  {
    id: 'financial',
    icon: <TrendingUp size={20} />,
    title: 'Financieel — MJOP',
    color: 'violet',
    intro:
      'Het MJOP (Meerjaren Onderhoudsplan) bevat alle geplande onderhoudskosten per jaar en kwartaal. Je kunt een MJOP uploaden of posten handmatig invoeren.',
    steps: [
      {
        icon: <Upload size={16} />,
        title: 'MJOP uploaden',
        text: 'Klik op "Upload MJOP" en selecteer een Excel- (.xlsx / .xls) of PDF-bestand. De app leest automatisch omschrijving, jaar, kwartaal en bedrag uit. Na verwerking verschijnen de posten in de lijst.',
      },
      {
        icon: <PlusCircle size={16} />,
        title: 'Post handmatig toevoegen',
        text: 'Gebruik het formulier onderaan om een losse post toe te voegen: kies categorie, jaar, optioneel kwartaal en vul het begrote bedrag in.',
      },
      {
        icon: <FileSpreadsheet size={16} />,
        title: 'Post bewerken',
        text: 'Klik op het potlood-icoon naast een post om jaar, kwartaal of bedrag te wijzigen. Zet een vinkje bij "Actueel bedrag" om werkelijke kosten bij te houden nadat een klus is uitgevoerd.',
      },
      {
        icon: <Clock size={16} />,
        title: 'Kwartaalondersteuning',
        text: 'Posten kunnen aan een specifiek kwartaal (Q1–Q4) worden gekoppeld. Gebruik de knop "Wijs Q1 toe aan alle posten zonder kwartaal" om een MJOP dat in jaren is opgesteld snel van kwartalen te voorzien.',
      },
      {
        icon: <Sliders size={16} />,
        title: 'Bulk-bewerking',
        text: 'Selecteer meerdere posten met het selectievakje en gebruik de bulkbalk om ze tegelijk een of meer jaren of kwartalen vooruit of achteruit te schuiven.',
      },
      {
        icon: <XCircle size={16} />,
        title: 'Post annuleren',
        text: 'Klik op het X-icoon om een post te annuleren. Geannuleerde posten worden niet meegenomen in de financiële analyse. Ze blijven zichtbaar in de opvouwbare sectie "Geannuleerde posten" onderaan.',
      },
      {
        icon: <RefreshCw size={16} />,
        title: 'Post heractiveren',
        text: 'Klik op "Heractiveer" bij een geannuleerde post om hem terug in het actieve plan te zetten. Je kunt daarbij een nieuw jaar en kwartaal opgeven.',
      },
    ],
  },
  {
    id: 'reservefonds',
    icon: <Wallet size={20} />,
    title: 'Financieel — Reservefonds',
    color: 'emerald',
    intro:
      'Het reservefonds tabblad toont de saldo-mutaties van de bankrekening van de VvE. Hier houd je bij hoeveel er gestort en onttrokken is.',
    steps: [
      {
        icon: <PlusCircle size={16} />,
        title: 'Saldo-mutatie toevoegen',
        text: 'Voeg een storting (positief bedrag) of onttrekking (negatief bedrag) toe met datum en omschrijving. De app berekent het actuele saldo automatisch.',
      },
      {
        icon: <Upload size={16} />,
        title: 'Bankbalans uploaden',
        text: 'Upload een PDF of Excel van het bankafschrift. De app leest het saldo en de datum automatisch uit en berekent het reservefonds als: banksaldo + bijdragen vanaf balansdatum tot vandaag.',
      },
      {
        icon: <Calculator size={16} />,
        title: 'Automatische bijschrijving',
        text: 'Bijdragen worden automatisch meegerekend op basis van het actieve bijdrageplan. Je hoeft maandelijkse stortingen niet handmatig in te voeren — de app berekent ze op de achtergrond.',
      },
    ],
  },
  {
    id: 'bijdragen',
    icon: <Calculator size={20} />,
    title: 'Financieel — Bijdragen',
    color: 'sky',
    intro:
      'Het bijdragen tabblad toont wat elk appartement per periode betaalt op basis van het aandeel in de VvE.',
    steps: [
      {
        icon: <PlusCircle size={16} />,
        title: 'Bijdrageplan aanmaken',
        text: 'Stel het bedrag per eenheidsaandeel in (bijv. € 57,50 per 1/32 aandeel) en de ingangsdatum. Het vorige plan wordt automatisch afgesloten.',
      },
      {
        icon: <Users size={16} />,
        title: 'Overzicht per appartement',
        text: 'De tabel toont per appartement het aandeel, de bijdrage per periode en de jaarlijkse bijdrage. Grote aandelen betalen proportioneel meer.',
      },
      {
        icon: <Clock size={16} />,
        title: 'Historiek',
        text: 'Eerdere bijdrageplannen blijven zichtbaar met hun ingangsdatum en einddatum. Zo is altijd te achterhalen wat er in een bepaalde periode gold.',
      },
    ],
  },
  {
    id: 'appartementen',
    icon: <Home size={20} />,
    title: 'Appartementen',
    color: 'orange',
    intro:
      'Beheer de appartementen die bij de VvE horen. Elk appartement heeft een naam, nummer, eigenaar en aandeel.',
    steps: [
      {
        icon: <PlusCircle size={16} />,
        title: 'Appartement toevoegen',
        text: 'Klik op "Appartement toevoegen" en vul naam, nummer, eigenaar en aandeel in. Het aandeel is een getal (bijv. 2 voor 2/32 als de VvE 32 eenheden heeft).',
      },
      {
        icon: <FileSpreadsheet size={16} />,
        title: 'Aandeel aanpassen',
        text: 'Het aandeel bepaalt hoeveel een appartement bijdraagt en meebetaalt aan eenmalige bijdragen. Pas het aan via het bewerkpotlood.',
      },
    ],
  },
  {
    id: 'vergaderingen',
    icon: <CalendarDays size={20} />,
    title: 'Vergaderingen',
    color: 'rose',
    intro:
      'Plan en beheer VvE-vergaderingen. Voeg agendapunten toe en bewaar notulen.',
    steps: [
      {
        icon: <PlusCircle size={16} />,
        title: 'Vergadering aanmaken',
        text: 'Geef datum, locatie en titel op. Optioneel kun je een Microsoft Teams-link toevoegen voor hybride vergaderingen.',
      },
      {
        icon: <FileSpreadsheet size={16} />,
        title: 'Agendapunten',
        text: 'Voeg agendapunten toe en bepaal de volgorde. Punten kunnen worden ingediend vóór de vergadering.',
      },
      {
        icon: <Upload size={16} />,
        title: 'Notulen uploaden',
        text: 'Na afloop kun je een notulendocument uploaden. De notulen worden gekoppeld aan de vergadering en zijn terug te vinden in het archief.',
      },
    ],
  },
]

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700' },
}

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  const c = COLOR_MAP[section.color]

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-5 py-4 ${c.bg} hover:brightness-95 transition-all text-left`}
      >
        <span className={`${c.text}`}>{section.icon}</span>
        <span className={`flex-1 font-semibold text-gray-900`}>{section.title}</span>
        <span className={`text-xs ${c.badge} px-2 py-0.5 rounded-full`}>
          {section.steps.length} onderwerpen
        </span>
        {open
          ? <ChevronDown size={16} className="text-gray-400 shrink-0" />
          : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="bg-white px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">{section.intro}</p>
          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className={`mt-0.5 shrink-0 ${c.text}`}>{step.icon ?? <ArrowRight size={16} />}</div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{step.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function InfoPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary-50 rounded-xl">
          <Info size={24} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hoe werkt VvE Beheer?</h1>
          <p className="mt-1 text-gray-500 text-sm leading-relaxed">
            Deze pagina legt uit hoe je de applicatie gebruikt om het reservefonds en MJOP van
            je VvE te beheren. Klik op een onderwerp om de uitleg te openen.
          </p>
        </div>
      </div>

      {/* Quick-start */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" />
          Snel aan de slag — aanbevolen volgorde
        </p>
        <ol className="space-y-2">
          {[
            { n: 1, label: 'Voeg de appartementen en aandelen toe',     page: 'Appartementen' },
            { n: 2, label: 'Upload of voer een bijdrageplan in',         page: 'Financieel → Bijdragen' },
            { n: 3, label: 'Voeg het openingssaldo van het reservefonds toe', page: 'Financieel → Reservefonds' },
            { n: 4, label: 'Upload een MJOP of voeg posten handmatig in', page: 'Financieel → MJOP' },
            { n: 5, label: 'Bekijk het dashboard en gebruik het slim plan om tekorten op te lossen', page: 'Dashboard' },
          ].map(({ n, label, page }) => (
            <li key={n} className="flex items-start gap-3 text-sm text-gray-600">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center mt-0.5">
                {n}
              </span>
              <span>
                {label}{' '}
                <span className="text-gray-400">({page})</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <SectionCard key={s.id} section={s} />
        ))}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <Building2 size={16} className="shrink-0 mt-0.5 text-amber-500" />
        <p>
          <strong>Meerdere VvE's:</strong> Als je toegang hebt tot meer dan één VvE, wissel je
          bovenin de zijbalk van actieve VvE. Alle data (MJOP, reservefonds, bijdragen) is per VvE gescheiden.
        </p>
      </div>
    </div>
  )
}
