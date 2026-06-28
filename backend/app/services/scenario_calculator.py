"""
Scenario calculator voor het financieel dashboard.

Berekent drie scenario's wanneer het reservefonds tekortschiet:
1. Bijdrage omhoog (contribution_increase)
2. Activiteit(en) verschuiven (defer_activity)
3. Eenmalige eigen bijdrage (one_time_levy)

Houdt rekening met:
- Bijdragefrequentie: maandelijks of per kwartaal
- Aandelen per eigenaar
- MJOP per jaar of per kwartaal
"""
from decimal import Decimal
from dataclasses import dataclass
from datetime import date


@dataclass
class MJOPItemInput:
    id: int
    planned_year: int
    planned_quarter: int | None  # 1-4 of None (heel jaar)
    planned_amount: Decimal
    description: str


@dataclass
class FinancialInput:
    current_balance: Decimal
    contribution_per_period: Decimal
    contribution_frequency: str  # 'monthly' | 'quarterly'
    mjop_items: list[MJOPItemInput]
    current_year: int
    current_quarter: int
    member_aandelen: list[Decimal]
    inflatie_percentage: Decimal = Decimal("0")


def _periods_per_year(frequency: str) -> int:
    return 12 if frequency == "monthly" else 4


def _build_yearly_cashflow(inp: FinancialInput) -> list[dict]:
    """Bouw een cashflow-overzicht per jaar op."""
    periods = _periods_per_year(inp.contribution_frequency)
    annual_contribution = inp.contribution_per_period * periods

    costs_by_year: dict[int, Decimal] = {}
    for item in inp.mjop_items:
        costs_by_year[item.planned_year] = costs_by_year.get(item.planned_year, Decimal(0)) + item.planned_amount

    if not costs_by_year:
        return []

    max_year = max(costs_by_year.keys())
    result = []
    balance = inp.current_balance

    for year in range(inp.current_year, max_year + 1):
        raw_costs = costs_by_year.get(year, Decimal(0))
        if inp.inflatie_percentage > 0:
            years_from_now = year - inp.current_year
            factor = Decimal(str((1 + float(inp.inflatie_percentage) / 100) ** years_from_now))
            costs = raw_costs * factor
        else:
            costs = raw_costs
        balance += annual_contribution - costs
        result.append({
            "year": year,
            "costs": costs,
            "contributions": annual_contribution,
            "balance": balance,
            "shortfall": abs(balance) if balance < 0 else Decimal(0),
        })

    return result


def calculate_shortfalls(inp: FinancialInput) -> list[dict]:
    """Geeft jaren terug waarop het fonds negatief wordt."""
    cashflow = _build_yearly_cashflow(inp)
    return [row for row in cashflow if row["balance"] < 0]


def scenario_contribution_increase(inp: FinancialInput) -> dict:
    """
    Bereken hoeveel de bijdrage per periode omhoog moet om alle kosten te dekken.
    Gebruikt een binaire zoekstrategie.
    """
    periods = _periods_per_year(inp.contribution_frequency)
    total_costs = sum(item.planned_amount for item in inp.mjop_items)
    years = max((item.planned_year for item in inp.mjop_items), default=inp.current_year) - inp.current_year + 1
    if years <= 0:
        years = 1

    # Vereiste jaarlijkse bijdrage zodat saldo nooit negatief wordt
    # Eenvoudige benadering: zorg dat jaarlijkse bijdragen >= gemiddelde jaarkosten
    # en dat het cumulatieve saldo altijd >= 0
    low, high = inp.contribution_per_period, inp.contribution_per_period * 10
    best = high

    for _ in range(50):
        mid = (low + high) / 2
        test_inp = FinancialInput(
            current_balance=inp.current_balance,
            contribution_per_period=mid,
            contribution_frequency=inp.contribution_frequency,
            mjop_items=inp.mjop_items,
            current_year=inp.current_year,
            current_quarter=inp.current_quarter,
            member_aandelen=inp.member_aandelen,
        )
        shortfalls = calculate_shortfalls(test_inp)
        if not shortfalls:
            best = mid
            high = mid
        else:
            low = mid

    increase = best - inp.contribution_per_period
    total_aandeel = sum(inp.member_aandelen) or Decimal(1)

    return {
        "scenario_type": "contribution_increase",
        "description": f"Bijdrage verhogen met €{increase:.2f} per {inp.contribution_frequency.replace('monthly','maand').replace('quarterly','kwartaal')}",
        "new_contribution_per_period": best,
        "increase_per_period": increase,
        "increase_per_period_per_unit_aandeel": increase / total_aandeel,
        "impact_per_period_per_aandeel": best / total_aandeel,
        "total_shortfall": sum(r["shortfall"] for r in _build_yearly_cashflow(FinancialInput(
            current_balance=inp.current_balance,
            contribution_per_period=inp.contribution_per_period,
            contribution_frequency=inp.contribution_frequency,
            mjop_items=inp.mjop_items,
            current_year=inp.current_year,
            current_quarter=inp.current_quarter,
            member_aandelen=inp.member_aandelen,
        ))),
        "coverage_start_year": inp.current_year,
    }


def scenario_defer_activity(inp: FinancialInput) -> dict:
    """
    Stel voor welke activiteiten verschoven kunnen worden om tekorten op te lossen.
    Kiest de duurste activiteiten in tekortjaren en stelt voor deze 1 jaar te verschuiven.
    """
    shortfalls = calculate_shortfalls(inp)
    if not shortfalls:
        return {
            "scenario_type": "defer_activity",
            "description": "Geen tekort — geen activiteiten hoeven verschoven te worden",
            "suggested_deferrals": [],
            "impact_per_period_per_aandeel": Decimal(0),
            "total_shortfall": Decimal(0),
            "coverage_start_year": inp.current_year,
        }

    shortfall_years = {r["year"] for r in shortfalls}
    # Sorteer items in tekortjaren op bedrag (aflopend)
    candidates = sorted(
        [i for i in inp.mjop_items if i.planned_year in shortfall_years],
        key=lambda x: x.planned_amount,
        reverse=True,
    )

    deferrals = []
    modified_items = list(inp.mjop_items)

    for candidate in candidates:
        # Verschuif 1 jaar naar voren
        new_items = []
        for item in modified_items:
            if item.id == candidate.id:
                new_items.append(MJOPItemInput(
                    id=item.id,
                    planned_year=item.planned_year + 1,
                    planned_quarter=item.planned_quarter,
                    planned_amount=item.planned_amount,
                    description=item.description,
                ))
                deferrals.append({
                    "item_id": candidate.id,
                    "description": candidate.description,
                    "original_year": candidate.planned_year,
                    "proposed_year": candidate.planned_year + 1,
                    "amount": float(candidate.planned_amount),
                })
            else:
                new_items.append(item)
        modified_items = new_items

        test_inp = FinancialInput(
            current_balance=inp.current_balance,
            contribution_per_period=inp.contribution_per_period,
            contribution_frequency=inp.contribution_frequency,
            mjop_items=modified_items,
            current_year=inp.current_year,
            current_quarter=inp.current_quarter,
            member_aandelen=inp.member_aandelen,
        )
        if not calculate_shortfalls(test_inp):
            break

    total_aandeel = sum(inp.member_aandelen) or Decimal(1)
    return {
        "scenario_type": "defer_activity",
        "description": f"{len(deferrals)} activiteit(en) 1 jaar verschuiven",
        "suggested_deferrals": deferrals,
        "impact_per_period_per_aandeel": Decimal(0),
        "total_shortfall": sum(r["shortfall"] for r in shortfalls),
        "coverage_start_year": inp.current_year,
    }


def scenario_one_time_levy(inp: FinancialInput) -> dict:
    """
    Bereken een eenmalige bijdrage per eigenaar om het tekort te dichten.
    """
    cashflow = _build_yearly_cashflow(inp)
    # Diepste tekort bepaalt de vereiste eenmalige bijdrage
    max_shortfall = max((r["shortfall"] for r in cashflow), default=Decimal(0))
    total_aandeel = sum(inp.member_aandelen) or Decimal(1)
    levy_per_full_aandeel = max_shortfall / total_aandeel

    per_member = [
        {"aandeel": float(a), "levy": float(a * levy_per_full_aandeel)}
        for a in inp.member_aandelen
    ]

    return {
        "scenario_type": "one_time_levy",
        "description": f"Eenmalige bijdrage van gemiddeld €{levy_per_full_aandeel:.2f} per aandeel",
        "total_levy": float(max_shortfall),
        "levy_per_full_aandeel": float(levy_per_full_aandeel),
        "per_member_breakdown": per_member,
        "impact_per_period_per_aandeel": Decimal(0),
        "total_shortfall": max_shortfall,
        "coverage_start_year": inp.current_year,
    }


def calculate_all_scenarios(inp: FinancialInput) -> dict:
    """Bereken alle drie scenario's en het volledige dashboard."""
    cashflow = _build_yearly_cashflow(inp)
    shortfalls = [r for r in cashflow if r["shortfall"] > 0]

    total_aandeel = sum(inp.member_aandelen) or Decimal(1)

    now_year = inp.current_year
    costs_5 = sum(i.planned_amount for i in inp.mjop_items if now_year <= i.planned_year <= now_year + 5)
    costs_10 = sum(i.planned_amount for i in inp.mjop_items if now_year <= i.planned_year <= now_year + 10)

    # Vroege waarschuwing: saldo negatief binnen 2 jaar
    vroege_waarschuwing = None
    for row in cashflow:
        if row["year"] <= now_year + 2 and row["balance"] < 0:
            vroege_waarschuwing = {
                "jaar": int(row["year"]),
                "verwacht_tekort": float(abs(row["balance"])),
            }
            break

    scenarios = []
    if shortfalls:
        scenarios = [
            scenario_contribution_increase(inp),
            scenario_defer_activity(inp),
            scenario_one_time_levy(inp),
        ]

    return {
        "current_reservefonds_balance": float(inp.current_balance),
        "contribution_frequency": inp.contribution_frequency,
        "current_contribution_per_period": float(inp.contribution_per_period),
        "total_planned_costs_next_5_years": float(costs_5),
        "total_planned_costs_next_10_years": float(costs_10),
        "projected_balance_by_year": [
            {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}
            for row in cashflow
        ],
        "shortfalls": [
            {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}
            for row in shortfalls
        ],
        "vroege_waarschuwing": vroege_waarschuwing,
        "scenarios": scenarios,
    }
