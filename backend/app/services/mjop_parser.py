"""
Parser voor MJOP bestanden (Excel en PDF).
Omdat MJOP formats sterk variëren, gebruiken we een heuristische aanpak:
1. Zoek naar kolommen met jaar/kwartaal, omschrijving en bedrag
2. Bied fallback naar handmatige kolomtoewijzing als auto-detect mislukt
"""
import re
from decimal import Decimal
from pathlib import Path
import pandas as pd


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
    except Exception:
        return None


def _detect_columns(df: pd.DataFrame) -> dict:
    """Probeer kolommen te identificeren op basis van kolomnamen."""
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
    """Haal jaar en kwartaal uit een cel (bijv. '2026', '2026 Q2', 'Q3 2027')."""
    s = str(cell_value)
    year_match = YEAR_PATTERNS.search(s)
    quarter_match = QUARTER_PATTERNS.search(s)
    year = int(year_match.group(1)) if year_match else None
    quarter = None
    if quarter_match:
        quarter = int(quarter_match.group(1) or quarter_match.group(2))
    return year, quarter


def parse_excel(file_path: str) -> list[dict]:
    """Parse een Excel MJOP bestand naar een lijst van kostenposten."""
    path = Path(file_path)
    xl = pd.ExcelFile(path)

    # Gebruik het eerste sheet, of zoek naar een sheet met 'MJOP' of 'onderhoud' in de naam
    sheet_name = xl.sheet_names[0]
    for name in xl.sheet_names:
        if any(k in name.lower() for k in ("mjop", "onderhoud", "plan", "meerjaren")):
            sheet_name = name
            break

    df = pd.read_excel(path, sheet_name=sheet_name, header=None)

    # Zoek de headerrij (eerste rij met meer dan 2 niet-lege cellen die tekst bevatten)
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

        # Fallback: scan alle cellen voor jaar als kolom niet gevonden
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


def parse_pdf(file_path: str) -> list[dict]:
    """Parse een PDF MJOP bestand.

    Ondersteunt twee formaten:
    1. Gedetailleerde activiteitsregels: '[omschrijving] [hoeveelheid] [jaar] [bedragen]'
    2. Samenvattingspagina (Hoofdgroepen) met jaar-kolommen in de header.
    """
    import pdfplumber

    items = []
    seen: set[tuple] = set()  # deduplicatie

    # Regex: activiteitsregel met een jaar (Stj) gevolgd door € bedragen
    ACTIVITY_RE = re.compile(
        r"^(.+?)"                               # beschrijving (non-greedy)
        r"\s+[\d]+[,.][\d]+\s*\w{0,4}"         # hoeveelheid + eenheid (bijv. 1,00pst)
        r"\s+(20\d{2})"                         # startjaar
        r"(?:\s+\d{1,2})?"                      # optioneel cyclus
        r"((?:\s+[€€]\s*[\d.,]+)+)",       # één of meer bedragen
    )
    # Fallback: elke regel met jaar + bedrag
    SIMPLE_RE = re.compile(
        r"(20\d{2})(?:\s+\d{1,2})?"            # jaar (+ optionele cyclus)
        r"((?:\s+[€€]\s*[\d.,]+)+)",       # één of meer bedragen
    )

    SKIP_PREFIXES = ("totaal", "btw", "code/", "code ", "hvhehd", "conditie",
                     "14-11", "20211", "kinderdijk", "amsterdam")

    def _extract_first_amount(amounts_str: str) -> Decimal | None:
        found = re.findall(r"[€€]\s*([\d.,]+)", amounts_str)
        return _normalize_amount(found[0]) if found else None

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""

            # --- Methode 1: gedetailleerde activiteitenpagina's ---
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
                        desc = m.group(1).strip()
                        # Verwijder eventuele gebrekscode achteraan (bijv. "Scheurvorming")
                        desc = re.sub(r"\s+[A-Z][a-z]+$", "", desc).strip()
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
                        # Sla elementnaam op als context voor volgende regels
                        clean = re.sub(r"^\d{2,4}\s+", "", stripped)
                        if len(clean) > 5 and not re.search(r"[€€]", clean):
                            fallback_desc = clean

                # Als methode 1 niets vond: val terug op SIMPLE_RE
                if not items:
                    for line in lines:
                        stripped = line.strip()
                        if not stripped or any(stripped.lower().startswith(p) for p in SKIP_PREFIXES):
                            continue
                        sm = SIMPLE_RE.search(stripped)
                        if sm:
                            year = int(sm.group(1))
                            amount = _extract_first_amount(sm.group(2))
                            desc_part = stripped[:sm.start()].strip()
                            desc_part = re.sub(r"\s*[\d,]+\s*\w{0,4}\s*$", "", desc_part).strip()
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

            # --- Methode 2: samenvattingspagina (Hoofdgroepen) ---
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

                    # Dataregel: begint met code + omschrijving, gevolgd door bedragen
                    row_match = re.match(r"^(\d{2,4})\s+(.+?)\s+([€€].*)", line.strip())
                    if not row_match:
                        continue

                    desc = row_match.group(2).strip()
                    amounts_str = row_match.group(3)
                    amounts = [_normalize_amount(v) for v in re.findall(r"[€€]\s*([\d.,]+)", amounts_str)]
                    # Laatste bedrag is het totaal; de rest zijn per-jaar bedragen
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


def parse_mjop_file(file_path: str) -> list[dict]:
    """Kies parser op basis van bestandsextensie."""
    ext = Path(file_path).suffix.lower()
    if ext in (".xlsx", ".xls", ".xlsm"):
        return parse_excel(file_path)
    elif ext == ".pdf":
        return parse_pdf(file_path)
    raise ValueError(f"Niet-ondersteund bestandstype: {ext}")
