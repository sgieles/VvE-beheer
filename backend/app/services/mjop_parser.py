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
    """Parse een PDF MJOP bestand. Extracteert tabellen met pdfplumber."""
    import pdfplumber

    items = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                # Eerste rij als header
                headers = [str(h).strip().lower() if h else "" for h in table[0]]
                year_col = next((i for i, h in enumerate(headers) if any(k in h for k in YEAR_KEYWORDS)), None)
                desc_col = next((i for i, h in enumerate(headers) if any(k in h for k in DESC_KEYWORDS)), None)
                amount_col = next((i for i, h in enumerate(headers) if any(k in h for k in AMOUNT_KEYWORDS)), None)

                for row in table[1:]:
                    if not row or all(c is None for c in row):
                        continue
                    year, quarter = None, None
                    description, amount = None, None

                    if year_col is not None and year_col < len(row):
                        year, quarter = _parse_year_quarter_from_cell(row[year_col] or "")
                    if desc_col is not None and desc_col < len(row):
                        description = str(row[desc_col] or "").strip()
                    if amount_col is not None and amount_col < len(row):
                        amount = _normalize_amount(row[amount_col])

                    # Fallback: scan alle cellen
                    if year is None:
                        for cell in row:
                            y, q = _parse_year_quarter_from_cell(cell or "")
                            if y:
                                year = y
                                if q:
                                    quarter = q
                                break

                    if year and description and amount and len(description) > 1:
                        items.append({
                            "planned_year": year,
                            "planned_quarter": quarter,
                            "description": description,
                            "planned_amount": amount,
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
