"""
Parser voor MJOP bestanden (Excel en PDF).

PDF-strategie (twee stappen):
  1. Claude API leest het PDF-document en produceert ruwe JSON
  2. Python validatiestap controleert plausibiliteit en flaggt twijfelcases

Fallback: als ANTHROPIC_API_KEY niet is ingesteld, gebruikt de parser de
heuristische regex-aanpak (originele implementatie).
"""
import base64
import json
import logging
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gedeelde helpers
# ---------------------------------------------------------------------------

YEAR_PATTERNS = re.compile(r"\b(20\d{2})\b")
QUARTER_PATTERNS = re.compile(r"\bQ([1-4])\b|\bkwartaal\s*([1-4])\b", re.IGNORECASE)
AMOUNT_KEYWORDS = {"bedrag", "kosten", "prijs", "amount", "cost", "budget", "geraamd"}
YEAR_KEYWORDS = {"jaar", "year", "periode"}
DESC_KEYWORDS = {"omschrijving", "beschrijving", "activiteit", "onderhoud", "werkzaamheden", "description"}


def _normalize_amount(value) -> Decimal | None:
    if value is None:
        return None
    try:
        s = str(value).replace("€", "").replace(".", "").replace(",", ".").strip()
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


# ---------------------------------------------------------------------------
# Excel-parser (ongewijzigd)
# ---------------------------------------------------------------------------

def _detect_columns(df: pd.DataFrame) -> dict:
    mapping = {"year": None, "quarter": None, "description": None, "amount": None}
    for col in df.columns:
        col_lower = str(col).lower().strip()
        if any(k in col_lower for k in YEAR_KEYWORDS) and mapping["year"] is None:
            mapping["year"] = col
        if "kwartaal" in col_lower or col_lower in ("q1", "q2", "q3", "q4", "quarter") and mapping["quarter"] is None:
            mapping["quarter"] = col
        if any(k in col_lower for k in DESC_KEYWORDS) and mapping["description"] is None:
            mapping["description"] = col
        if any(k in col_lower for k in AMOUNT_KEYWORDS) and mapping["amount"] is None:
            mapping["amount"] = col
    return mapping


def _parse_year_quarter_from_cell(cell_value) -> tuple[int | None, int | None]:
    s = str(cell_value)
    year_match = YEAR_PATTERNS.search(s)
    quarter_match = QUARTER_PATTERNS.search(s)
    year = int(year_match.group(1)) if year_match else None
    quarter = None
    if quarter_match:
        quarter = int(quarter_match.group(1) or quarter_match.group(2))
    return year, quarter


def parse_excel(file_path: str) -> list[dict]:
    path = Path(file_path)
    xl = pd.ExcelFile(path)

    sheet_name = xl.sheet_names[0]
    for name in xl.sheet_names:
        if any(k in name.lower() for k in ("mjop", "onderhoud", "plan", "meerjaren")):
            sheet_name = name
            break

    df = pd.read_excel(path, sheet_name=sheet_name, header=None)

    header_row = 0
    for i, row in df.iterrows():
        non_empty = row.dropna()
        if len(non_empty) >= 3 and non_empty.apply(lambda x: isinstance(x, str)).sum() >= 2:
            header_row = i
            break

    df = pd.read_excel(path, sheet_name=sheet_name, header=header_row)
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")

    mapping = _detect_columns(df)
    items = []

    for _, row in df.iterrows():
        year, quarter, description, amount = None, None, None, None

        if mapping["year"]:
            year, q = _parse_year_quarter_from_cell(row.get(mapping["year"], ""))
            if q:
                quarter = q
        if mapping["quarter"] and not quarter:
            _, quarter = _parse_year_quarter_from_cell(row.get(mapping["quarter"], ""))
        if mapping["description"]:
            description = str(row.get(mapping["description"], "")).strip()
        if mapping["amount"]:
            amount = _normalize_amount(row.get(mapping["amount"]))

        if year is None:
            for val in row:
                y, q = _parse_year_quarter_from_cell(val)
                if y:
                    year = y
                    if q and not quarter:
                        quarter = q
                    break

        if year and description and amount and len(description) > 1 and description.lower() not in ("nan", "none"):
            items.append({
                "planned_year": year,
                "planned_quarter": quarter,
                "description": description,
                "planned_amount": amount,
                "category": None,
            })

    return items


# ---------------------------------------------------------------------------
# PDF-parser via Claude API
# ---------------------------------------------------------------------------

_CLAUDE_PROMPT = """Dit is een MJOP (Meerjarenonderhoudsplan) van een VvE (Vereniging van Eigenaren).

Extraheer alle geplande onderhoudswerkzaamheden als een JSON array. Gebruik exact dit formaat:
[
  {
    "planned_year": 2026,
    "planned_quarter": null,
    "description": "Dakbedekking vervangen pand A",
    "planned_amount": 15000.00,
    "category": "dak"
  }
]

Regels:
- planned_year: integer, het geplande uitvoeringsjaar
- planned_quarter: integer 1-4 of null als geen kwartaal vermeld
- description: beknopte omschrijving van de werkzaamheid (max 200 tekens)
- planned_amount: bedrag in euro als float, exclusief BTW indien beide beschikbaar, altijd positief
- category: kies het meest passende uit: dak, gevel, kozijnen, installaties, lift, schilderwerk, overig

Geef ALLEEN de JSON array terug — geen uitleg, geen markdown, geen andere tekst.
Sla rijen over die geen concreet bedrag of jaar hebben (headers, totaalregels, lege rijen).
"""


def _validate_items(raw: list[dict]) -> tuple[list[dict], list[dict]]:
    """Splits items in valide en twijfelachtig. Retourneert (valide, geflagd)."""
    valid, flagged = [], []
    valid_categories = {"dak", "gevel", "kozijnen", "installaties", "lift", "schilderwerk", "overig"}

    for item in raw:
        issues = []
        try:
            year = int(item.get("planned_year", 0))
            amount = float(item.get("planned_amount", 0))
            desc = str(item.get("description", "")).strip()
            quarter = item.get("planned_quarter")
            category = item.get("category", "overig")

            if not (2020 <= year <= 2060):
                issues.append(f"jaar {year} buiten bereik")
            if amount <= 0:
                issues.append("bedrag <= 0")
            if amount > 500_000:
                issues.append(f"bedrag €{amount:,.0f} ongebruikelijk hoog")
            if len(desc) < 3:
                issues.append("omschrijving te kort")
            if quarter is not None and quarter not in (1, 2, 3, 4):
                issues.append(f"kwartaal {quarter} ongeldig")
                quarter = None
            if category not in valid_categories:
                category = "overig"

            normalized = {
                "planned_year": year,
                "planned_quarter": quarter,
                "description": desc[:200],
                "planned_amount": Decimal(str(round(amount, 2))),
                "category": category,
            }

            if issues:
                normalized["_validation_warnings"] = issues
                flagged.append(normalized)
            else:
                valid.append(normalized)

        except (TypeError, ValueError) as e:
            log.warning("Item overgeslagen na validatiefout: %s — %s", item, e)

    return valid, flagged


def parse_pdf_with_claude(file_path: str) -> list[dict]:
    """Stap 1: Claude API leest PDF. Stap 2: Python valideert output."""
    from app.core.config import settings
    import anthropic

    pdf_bytes = Path(file_path).read_bytes()
    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode()

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {"type": "text", "text": _CLAUDE_PROMPT},
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()

    # Strip eventuele markdown code-fences
    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
    raw_text = re.sub(r"\s*```$", "", raw_text)

    try:
        raw_items = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude retourneerde ongeldige JSON: {e}\n\nOutput:\n{raw_text[:500]}") from e

    valid, flagged = _validate_items(raw_items)

    if flagged:
        log.warning(
            "MJOP Claude-parser: %d valide posten, %d geflagd voor review: %s",
            len(valid),
            len(flagged),
            [f["_validation_warnings"] for f in flagged],
        )
        # Voeg geflagde items toch toe zodat de beheerder ze kan beoordelen
        for item in flagged:
            item.pop("_validation_warnings", None)
        valid.extend(flagged)

    return valid


# ---------------------------------------------------------------------------
# Heuristische PDF-parser (fallback)
# ---------------------------------------------------------------------------

def parse_pdf_heuristic(file_path: str) -> list[dict]:
    import pdfplumber

    items = []
    seen: set[tuple] = set()

    ACTIVITY_RE = re.compile(
        r"^(.+?)"
        r"\s+[\d]+[,.][\d]+\s*\w{0,4}"
        r"\s+(20\d{2})"
        r"(?:\s+\d{1,2})?"
        r"((?:\s+[€€]\s*[\d.,]+)+)",
    )
    SIMPLE_RE = re.compile(
        r"(20\d{2})(?:\s+\d{1,2})?"
        r"((?:\s+[€€]\s*[\d.,]+)+)",
    )

    SKIP_PREFIXES = ("totaal", "btw", "code/", "code ", "hvhehd", "conditie",
                     "14-11", "20211", "kinderdijk", "amsterdam")

    def _extract_first_amount(amounts_str: str) -> Decimal | None:
        found = re.findall(r"[€€]\s*([\d.,]+)", amounts_str)
        return _normalize_amount(found[0]) if found else None

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""

            if "Code/Element" in text or "Handeling" in text:
                lines = text.split("\n")
                fallback_desc = ""

                for line in lines:
                    stripped = line.strip()
                    if not stripped:
                        continue
                    low = stripped.lower()
                    if any(low.startswith(p) for p in SKIP_PREFIXES):
                        continue

                    m = ACTIVITY_RE.match(stripped)
                    if m:
                        desc = re.sub(r"\s+[A-Z][a-z]+$", "", m.group(1).strip()).strip()
                        year = int(m.group(2))
                        amount = _extract_first_amount(m.group(3))
                        if amount and amount > 0 and 2020 <= year <= 2060:
                            key = (year, desc[:50])
                            if key not in seen:
                                seen.add(key)
                                items.append({
                                    "planned_year": year,
                                    "planned_quarter": None,
                                    "description": desc or fallback_desc or "MJOP post",
                                    "planned_amount": amount,
                                    "category": None,
                                })
                    else:
                        clean = re.sub(r"^\d{2,4}\s+", "", stripped)
                        if len(clean) > 5 and not re.search(r"[€€]", clean):
                            fallback_desc = clean

                if not items:
                    for line in lines:
                        stripped = line.strip()
                        if not stripped or any(stripped.lower().startswith(p) for p in SKIP_PREFIXES):
                            continue
                        sm = SIMPLE_RE.search(stripped)
                        if sm:
                            year = int(sm.group(1))
                            amount = _extract_first_amount(sm.group(2))
                            desc_part = re.sub(r"\s*[\d,]+\s*\w{0,4}\s*$", "", stripped[:sm.start()].strip()).strip()
                            if amount and amount > 0 and 2020 <= year <= 2060 and len(desc_part) > 2:
                                key = (year, desc_part[:50])
                                if key not in seen:
                                    seen.add(key)
                                    items.append({
                                        "planned_year": year,
                                        "planned_quarter": None,
                                        "description": desc_part,
                                        "planned_amount": amount,
                                        "category": None,
                                    })

            elif "Hoofdgroepen" in text or "hoofdgroep" in text.lower():
                lines = text.split("\n")
                header_years: list[int] = []

                for line in lines:
                    years_found = re.findall(r"\b(20\d{2})\b", line)
                    if len(years_found) >= 3:
                        header_years = [int(y) for y in years_found]
                        continue
                    if not header_years:
                        continue
                    row_match = re.match(r"^(\d{2,4})\s+(.+?)\s+([€€].*)", line.strip())
                    if not row_match:
                        continue
                    desc = row_match.group(2).strip()
                    amounts_str = row_match.group(3)
                    amounts = [_normalize_amount(v) for v in re.findall(r"[€€]\s*([\d.,]+)", amounts_str)]
                    year_amounts = amounts[:-1] if len(amounts) > 1 else amounts
                    for i, amt in enumerate(year_amounts):
                        if amt and amt > 0 and i < len(header_years):
                            year = header_years[i]
                            key = (year, desc[:50])
                            if key not in seen:
                                seen.add(key)
                                items.append({
                                    "planned_year": year,
                                    "planned_quarter": None,
                                    "description": desc,
                                    "planned_amount": amt,
                                    "category": None,
                                })

    return items


def parse_pdf(file_path: str) -> list[dict]:
    """Kies Claude API als ANTHROPIC_API_KEY beschikbaar is, anders heuristisch."""
    from app.core.config import settings
    if settings.ANTHROPIC_API_KEY:
        try:
            return parse_pdf_with_claude(file_path)
        except Exception as e:
            log.error("Claude PDF-parser mislukt, val terug op heuristiek: %s", e)
    return parse_pdf_heuristic(file_path)


def parse_mjop_file(file_path: str) -> list[dict]:
    ext = Path(file_path).suffix.lower()
    if ext in (".xlsx", ".xls", ".xlsm"):
        return parse_excel(file_path)
    elif ext == ".pdf":
        return parse_pdf(file_path)
    raise ValueError(f"Niet-ondersteund bestandstype: {ext}")
