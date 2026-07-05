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


def _build_quarterly_cashflow(inp: FinancialInput) -> list[dict]:
    """Bouw een cashflow-overzicht per kwartaal op."""
    contribution_per_quarter = (
        inp.contribution_per_period * 3
        if inp.contribution_frequency == "monthly"
        else inp.contribution_per_period
    )

    costs_by_quarter: dict[tuple[int, int], Decimal] = {}
    for item in inp.mjop_items:
        if item.planned_quarter:
            key = (item.planned_year, item.planned_quarter)
            costs_by_quarter[key] = costs_by_quarter.get(key, Decimal(0)) + item.planned_amount
        else:
            per_q = item.planned_amount / 4
            for q in range(1, 5):
                key = (item.planned_year, q)
                costs_by_quarter[key] = costs_by_quarter.get(key, Decimal(0)) + per_q

    if not costs_by_quarter:
        return []

    max_year = max(k[0] for k in costs_by_quarter.keys())
    result = []
    balance = inp.current_balance

    for year in range(inp.current_year, max_year + 1):
        for q in range(1, 5):
            if year == inp.current_year and q < inp.current_quarter:
                continue
            raw_costs = costs_by_quarter.get((year, q), Decimal(0))
            if inp.inflatie_percentage > 0:
                quarters_from_now = (year - inp.current_year) * 4 + (q - inp.current_quarter)
                factor = Decimal(str((1 + float(inp.inflatie_percentage) / 100) ** (quarters_from_now / 4)))
                costs = raw_costs * factor
            else:
                costs = raw_costs
            balance += contribution_per_quarter - costs
            result.append({
                "year": year,
                "quarter": q,
                "label": f"{year} Q{q}",
                "costs": costs,
                "contributions": contribution_per_quarter,
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
        # Verschuif 1 kwartaal (als kwartaal bekend) of 1 jaar
        if candidate.planned_quarter is not None:
            new_year, new_q = _add_quarters(candidate.planned_year, candidate.planned_quarter, 1)
        else:
            new_year, new_q = candidate.planned_year + 1, None
        new_items = []
        for item in modified_items:
            if item.id == candidate.id:
                new_items.append(MJOPItemInput(
                    id=item.id,
                    planned_year=new_year,
                    planned_quarter=new_q,
                    planned_amount=item.planned_amount,
                    description=item.description,
                ))
                deferrals.append({
                    "item_id": candidate.id,
                    "description": candidate.description,
                    "original_year": candidate.planned_year,
                    "original_quarter": candidate.planned_quarter,
                    "proposed_year": new_year,
                    "proposed_quarter": new_q,
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


def _add_quarters(year: int, quarter: int, steps: int) -> tuple[int, int]:
    """Verschuif (year, quarter) met `steps` kwartalen vooruit (steps > 0)."""
    total = year * 4 + (quarter - 1) + steps
    return total // 4, total % 4 + 1


def _make_inp(base: FinancialInput, items: list[MJOPItemInput]) -> FinancialInput:
    return FinancialInput(
        current_balance=base.current_balance,
        contribution_per_period=base.contribution_per_period,
        contribution_frequency=base.contribution_frequency,
        mjop_items=items,
        current_year=base.current_year,
        current_quarter=base.current_quarter,
        member_aandelen=base.member_aandelen,
        inflatie_percentage=base.inflatie_percentage,
    )


def _floatify_rows(rows: list[dict]) -> list[dict]:
    return [{k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()} for row in rows]


def smart_planning(inp: FinancialInput, max_shift_quarters: int = 8) -> dict:
    """
    Verschuift de duurste MJOP-posten in tekortjaren naar latere kwartalen/jaren.
    - Posten MET kwartaal: probeert per kwartaal te verschuiven (tot max_shift_quarters).
    - Posten ZONDER kwartaal: verschuift per jaar (tot max_shift_quarters // 4 jaar).
    """
    original_cashflow = _build_yearly_cashflow(inp)
    original_shortfalls = [r for r in original_cashflow if r["shortfall"] > 0]

    if not original_shortfalls:
        return {
            "proposed_shifts": [],
            "new_cashflow": _floatify_rows(original_cashflow),
            "original_cashflow": _floatify_rows(original_cashflow),
            "shortfalls_resolved": True,
            "shortfalls_remaining": [],
        }

    modified_items = list(inp.mjop_items)
    proposed_shifts: list[dict] = []
    shifted_ids: set[int] = set()

    for _ in range(len(inp.mjop_items)):
        cashflow = _build_yearly_cashflow(_make_inp(inp, modified_items))
        shortfall_map = {int(r["year"]): r["shortfall"] for r in cashflow if r["shortfall"] > 0}
        if not shortfall_map:
            break

        candidates = sorted(
            [i for i in modified_items if i.planned_year in shortfall_map and i.id not in shifted_ids],
            key=lambda x: x.planned_amount,
            reverse=True,
        )
        if not candidates:
            break

        made_shift = False
        for candidate in candidates:
            # Bepaal te proberen verschuivingen
            if candidate.planned_quarter is not None:
                shifts_to_try = [
                    _add_quarters(candidate.planned_year, candidate.planned_quarter, delta)
                    for delta in range(1, max_shift_quarters + 1)
                ]
            else:
                max_years = max(1, max_shift_quarters // 4)
                shifts_to_try = [(candidate.planned_year + d, None) for d in range(1, max_years + 1)]

            for target_year, target_q in shifts_to_try:
                test_items = [
                    MJOPItemInput(
                        id=i.id,
                        planned_year=target_year,
                        planned_quarter=target_q if i.id == candidate.id else i.planned_quarter,
                        planned_amount=i.planned_amount,
                        description=i.description,
                    ) if i.id == candidate.id else i
                    for i in modified_items
                ]
                test_cf = _build_yearly_cashflow(_make_inp(inp, test_items))
                new_shortfall = next(
                    (r["shortfall"] for r in test_cf if r["year"] == candidate.planned_year),
                    Decimal(0),
                )
                if new_shortfall < shortfall_map[candidate.planned_year]:
                    original_item = next((i for i in inp.mjop_items if i.id == candidate.id), candidate)
                    proposed_shifts.append({
                        "item_id": candidate.id,
                        "description": candidate.description,
                        "original_year": original_item.planned_year,
                        "original_quarter": original_item.planned_quarter,
                        "proposed_year": target_year,
                        "proposed_quarter": target_q,
                        "amount": float(candidate.planned_amount),
                    })
                    modified_items = test_items
                    shifted_ids.add(candidate.id)
                    made_shift = True
                    break
            if made_shift:
                break

        if not made_shift:
            break

    final_cf = _build_yearly_cashflow(_make_inp(inp, modified_items))
    remaining = [r for r in final_cf if r["shortfall"] > 0]

    return {
        "proposed_shifts": proposed_shifts,
        "new_cashflow": _floatify_rows(final_cf),
        "original_cashflow": _floatify_rows(original_cashflow),
        "shortfalls_resolved": len(remaining) == 0,
        "shortfalls_remaining": _floatify_rows(remaining),
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

    # Risico-items: MJOP-posten in tekortjaren, gesorteerd op bedrag (grootste eerst)
    shortfall_years = {int(r["year"]): r["shortfall"] for r in shortfalls}
    risico_items = []
    for item in sorted(inp.mjop_items, key=lambda x: x.planned_amount, reverse=True):
        if item.planned_year not in shortfall_years:
            continue
        tekort = shortfall_years[item.planned_year]
        # Geeft aan of dit item meer dan de helft van het tekort in dat jaar veroorzaakt
        is_hoofdoorzaak = item.planned_amount >= tekort * Decimal("0.5")
        risico_items.append({
            "id": item.id,
            "description": item.description,
            "planned_year": item.planned_year,
            "planned_quarter": item.planned_quarter,
            "planned_amount": float(item.planned_amount),
            "tekort_in_jaar": float(tekort),
            "is_hoofdoorzaak": is_hoofdoorzaak,
        })

    quarterly_cashflow = _build_quarterly_cashflow(inp)

    def _floatify(rows: list[dict]) -> list[dict]:
        return [{k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()} for row in rows]

    return {
        "current_reservefonds_balance": float(inp.current_balance),
        "contribution_frequency": inp.contribution_frequency,
        "current_contribution_per_period": float(inp.contribution_per_period),
        "total_planned_costs_next_5_years": float(costs_5),
        "total_planned_costs_next_10_years": float(costs_10),
        "projected_balance_by_year": _floatify(cashflow),
        "projected_balance_by_quarter": _floatify(quarterly_cashflow),
        "shortfalls": _floatify(shortfalls),
        "vroege_waarschuwing": vroege_waarschuwing,
        "scenarios": scenarios,
        "risico_items": risico_items,
    }
