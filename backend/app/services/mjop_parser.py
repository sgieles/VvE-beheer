"""
Parser voor MJOP bestanden (Excel en PDF).

PDF-pipeline (vijf stappen, geen externe API nodig):
  1. Classifier   — detecteert per pagina: breed formaat (jaar-kolommen),
                    lang formaat (jaar als rij-veld) of tekst-gebaseerd
  2. Extractor    — haalt tabelcellen op via pdfplumber.extract_tables()
  3. Normalizer   — zet bedragen om (€-tekens, punt/komma-notatie)
  4. Validator    — controleert plausibiliteit en flaggt twijfelaars
  5. Aggregator   — dedupliceert en produceert eindresultaat

Fallback: als tabellen ontbreken, wordt de heuristische tekst-aanpak gebruikt.
"""
import re
import logging
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gedeelde helpers
# ---------------------------------------------------------------------------

YEAR_RE = re.compile(r"\b(20\d{2})\b")
QUARTER_RE = re.compile(r"\bQ([1-4])\b|\bkwartaal\s*([1-4])\b", re.IGNORECASE)

DESC_KEYS = ("omschrijving", "beschrijving", "activiteit", "onderhoud", "element", "werkzaamheden", "description")
AMOUNT_KEYS = ("bedrag", "kosten", "prijs", "budget", "geraamd", "amount", "cost")
YEAR_KEYS = ("jaar", "year", "periode")
SKIP_WORDS = ("totaal", "subtotaal", "btw", "indexering", "contingentie", "reserve")


def _normalize_amount(value) -> Decimal | None:
    if value is None:
        return None
    try:
        s = str(value).strip()
        s = re.sub(r"[€$\s]", "", s)
        # Europese notatie: punt als duizendtalscheider, komma als decimaal
        if "," in s and "." in s:
            if s.rindex(".") < s.rindex(","):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif "," in s:
            s = s.replace(",", ".")
        s = s.replace(".", "", s.count(".") - 1) if s.count(".") > 1 else s
        v = Decimal(s)
        return v if v > 0 else None
    except (InvalidOperation, ValueError):
        return None


def _find_col(header: list[str], keywords: tuple) -> int | None:
    for i, h in enumerate(header):
        if any(k in h for k in keywords):
            return i
    return None


def _is_skip_row(cells: list) -> bool:
    text = " ".join(str(c or "") for c in cells).lower()
    return any(w in text for w in SKIP_WORDS)


# ---------------------------------------------------------------------------
# Stap 1 — Classifier
# ---------------------------------------------------------------------------

def _classify_table(table: list[list]) -> str:
    """
    Geeft terug:
      'wide'  — jaar-kolommen in de header (MJOP-overzicht per jaar)
      'long'  — jaar als rij-veld (activiteiten-lijst)
      'skip'  — geen bruikbare MJOP-tabel
    """
    if not table or not table[0]:
        return "skip"

    header = [str(c or "").strip().lower() for c in table[0]]
    header_text = " ".join(header)

    year_cols = [h for h in header if YEAR_RE.search(h)]
    if len(year_cols) >= 2:
        return "wide"

    has_year_field = any(k in header_text for k in YEAR_KEYS)
    has_desc = any(k in header_text for k in DESC_KEYS)
    has_amount = any(k in header_text for k in AMOUNT_KEYS)

    if has_year_field and (has_desc or has_amount):
        return "long"

    return "skip"


# ---------------------------------------------------------------------------
# Stap 2 — Extractor
# ---------------------------------------------------------------------------

def _extract_wide(table: list[list]) -> list[dict]:
    """Breed formaat: rijen = activiteiten, kolommen = jaren."""
    header = [str(c or "").strip() for c in table[0]]

    year_cols: dict[int, int] = {}
    desc_col = _find_col([h.lower() for h in header], DESC_KEYS)
    amount_col = _find_col([h.lower() for h in header], AMOUNT_KEYS)

    for i, h in enumerate(header):
        m = YEAR_RE.search(h)
        if m:
            year_cols[i] = int(m.group(1))

    if not year_cols:
        return []

    items = []
    for row in table[1:]:
        if _is_skip_row(row):
            continue
        desc = str(row[desc_col] or "").strip() if desc_col is not None and desc_col < len(row) else ""
        if len(desc) < 3:
            continue

        for col_i, year in year_cols.items():
            if col_i >= len(row):
                continue
            amount = _normalize_amount(row[col_i])
            if amount:
                items.append({
                    "planned_year": year,
                    "planned_quarter": None,
                    "description": desc[:200],
                    "planned_amount": amount,
                    "category": None,
                })

    # Fallback: als geen desc_col gevonden, gebruik de eerste tekst-kolom
    if not items and not desc_col:
        for row in table[1:]:
            if _is_skip_row(row):
                continue
            desc = next((str(c).strip() for c in row if c and len(str(c).strip()) > 3 and not YEAR_RE.search(str(c))), "")
            for col_i, year in year_cols.items():
                if col_i >= len(row):
                    continue
                amount = _normalize_amount(row[col_i])
                if amount and desc:
                    items.append({
                        "planned_year": year,
                        "planned_quarter": None,
                        "description": desc[:200],
                        "planned_amount": amount,
                        "category": None,
                    })

    return items


def _extract_long(table: list[list]) -> list[dict]:
    """Lang formaat: elke rij = één activiteit met jaar + omschrijving + bedrag."""
    header = [str(c or "").strip().lower() for c in table[0]]

    year_col = _find_col(header, YEAR_KEYS)
    desc_col = _find_col(header, DESC_KEYS)
    amount_col = _find_col(header, AMOUNT_KEYS)

    if year_col is None or amount_col is None:
        return []

    items = []
    for row in table[1:]:
        if _is_skip_row(row):
            continue
        if year_col >= len(row) or amount_col >= len(row):
            continue

        year_val = str(row[year_col] or "")
        m = YEAR_RE.search(year_val)
        if not m:
            continue
        year = int(m.group(1))

        qm = QUARTER_RE.search(year_val)
        quarter = int(qm.group(1) or qm.group(2)) if qm else None

        desc = str(row[desc_col] or "").strip() if desc_col is not None and desc_col < len(row) else ""
        amount = _normalize_amount(row[amount_col])

        if amount and len(desc) > 2:
            items.append({
                "planned_year": year,
                "planned_quarter": quarter,
                "description": desc[:200],
                "planned_amount": amount,
                "category": None,
            })

    return items


# ---------------------------------------------------------------------------
# Stap 3 — Normalizer (category inferentie)
# ---------------------------------------------------------------------------

_CATEGORY_RULES = [
    (("dak", "dakbedekking", "dakisolatie", "dakgoot"), "dak"),
    (("gevel", "buitengevel", "metselwerk", "voeg"), "gevel"),
    (("kozijn", "raamkozijn", "deurkozijn", "beglazing", "glas"), "kozijnen"),
    (("schilder", "verfwerk", "buitenschilder", "binnenschilder"), "schilderwerk"),
    (("cv", "ketel", "verwarm", "installatie", "elektra", "leidingen", "installaties", "intercom", "ventilatie"), "installaties"),
    (("lift", "elevator"), "lift"),
]


def _infer_category(description: str) -> str:
    low = description.lower()
    for keywords, category in _CATEGORY_RULES:
        if any(k in low for k in keywords):
            return category
    return "overig"


def _normalize_items(items: list[dict]) -> list[dict]:
    for item in items:
        if not item.get("category"):
            item["category"] = _infer_category(item["description"])
    return items


# ---------------------------------------------------------------------------
# Stap 4 — Validator
# ---------------------------------------------------------------------------

def _validate_items(items: list[dict]) -> tuple[list[dict], list[dict]]:
    valid, flagged = [], []
    seen: set[tuple] = set()

    for item in items:
        year = item.get("planned_year", 0)
        amount = item.get("planned_amount", Decimal(0))
        desc = item.get("description", "")

        issues = []
        if not (2020 <= year <= 2060):
            issues.append(f"jaar {year} buiten bereik")
        if amount > 500_000:
            issues.append(f"bedrag €{amount:,.0f} ongebruikelijk hoog")
        if len(desc) < 3:
            issues.append("omschrijving te kort")

        key = (year, desc[:50])
        if key in seen:
            continue
        seen.add(key)

        if issues:
            log.warning("MJOP item geflagd %s: %s", issues, item)
            flagged.append(item)
        else:
            valid.append(item)

    return valid, flagged


# ---------------------------------------------------------------------------
# PDF-pipeline (hoofdfunctie)
# ---------------------------------------------------------------------------

def parse_pdf(file_path: str) -> list[dict]:
    import pdfplumber

    all_items: list[dict] = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables(
                table_settings={
                    "vertical_strategy": "lines_strict",
                    "horizontal_strategy": "lines_strict",
                    "snap_tolerance": 3,
                }
            ) or []

            # Tweede poging met soepelere instellingen
            if not tables:
                tables = page.extract_tables() or []

            page_items: list[dict] = []
            for table in tables:
                kind = _classify_table(table)
                if kind == "wide":
                    page_items.extend(_extract_wide(table))
                elif kind == "long":
                    page_items.extend(_extract_long(table))

            if page_items:
                all_items.extend(page_items)
            else:
                # Fallback: tekst-gebaseerde extractie voor deze pagina
                all_items.extend(_parse_page_text(page))

    all_items = _normalize_items(all_items)
    valid, flagged = _validate_items(all_items)

    if flagged:
        log.warning("PDF-parser: %d valide, %d geflagd", len(valid), len(flagged))
        valid.extend(flagged)  # toon ook twijfelaars zodat beheerder ze kan corrigeren

    return valid


# ---------------------------------------------------------------------------
# Tekst-fallback (originele heuristische aanpak, als back-stop)
# ---------------------------------------------------------------------------

def _parse_page_text(page) -> list[dict]:
    """Heuristische tekst-aanpak als geen tabellen gevonden worden."""
    text = page.extract_text() or ""
    if not text:
        return []

    ACTIVITY_RE = re.compile(
        r"^(.+?)\s+[\d]+[,.][\d]+\s*\w{0,4}\s+(20\d{2})(?:\s+\d{1,2})?((?:\s+[€€]\s*[\d.,]+)+)"
    )
    SIMPLE_RE = re.compile(r"(20\d{2})(?:\s+\d{1,2})?((?:\s+[€€]\s*[\d.,]+)+)")

    def _first_amount(s: str) -> Decimal | None:
        found = re.findall(r"[€€]\s*([\d.,]+)", s)
        return _normalize_amount(found[0]) if found else None

    SKIP = ("totaal", "btw", "code/", "hvhehd")
    items, seen = [], set()

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped or any(stripped.lower().startswith(p) for p in SKIP):
            continue
        m = ACTIVITY_RE.match(stripped)
        if m:
            desc = re.sub(r"\s+[A-Z][a-z]+$", "", m.group(1).strip()).strip()
            year = int(m.group(2))
            amount = _first_amount(m.group(3))
            if amount and 2020 <= year <= 2060:
                key = (year, desc[:50])
                if key not in seen:
                    seen.add(key)
                    items.append({"planned_year": year, "planned_quarter": None,
                                  "description": desc or "MJOP post", "planned_amount": amount, "category": None})
        else:
            sm = SIMPLE_RE.search(stripped)
            if sm:
                year = int(sm.group(1))
                amount = _first_amount(sm.group(2))
                desc = re.sub(r"\s*[\d,]+\s*\w{0,4}\s*$", "", stripped[:sm.start()].strip()).strip()
                if amount and 2020 <= year <= 2060 and len(desc) > 2:
                    key = (year, desc[:50])
                    if key not in seen:
                        seen.add(key)
                        items.append({"planned_year": year, "planned_quarter": None,
                                      "description": desc, "planned_amount": amount, "category": None})

    return items


# ---------------------------------------------------------------------------
# Excel-parser (ongewijzigd)
# ---------------------------------------------------------------------------

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

    header = [str(c).strip().lower() for c in df.columns]
    year_cols = {i: int(m.group(1)) for i, h in enumerate(header) if (m := YEAR_RE.search(h))}
    desc_col = _find_col(header, DESC_KEYS)
    amount_col = _find_col(header, AMOUNT_KEYS)

    items = []
    for _, row in df.iterrows():
        vals = list(row)
        if _is_skip_row(vals):
            continue

        if year_cols:
            # Breed formaat
            desc = str(vals[desc_col] or "").strip() if desc_col is not None else ""
            for col_i, year in year_cols.items():
                if col_i < len(vals):
                    amount = _normalize_amount(vals[col_i])
                    if amount and len(desc) > 2:
                        items.append({"planned_year": year, "planned_quarter": None,
                                      "description": desc[:200], "planned_amount": amount, "category": None})
        elif desc_col and amount_col:
            # Lang formaat
            year_val = str(vals[0] or "") if len(vals) > 0 else ""
            m = YEAR_RE.search(year_val)
            if not m:
                continue
            year = int(m.group(1))
            qm = QUARTER_RE.search(year_val)
            quarter = int(qm.group(1) or qm.group(2)) if qm else None
            desc = str(vals[desc_col] or "").strip()
            amount = _normalize_amount(vals[amount_col])
            if amount and len(desc) > 2:
                items.append({"planned_year": year, "planned_quarter": quarter,
                              "description": desc[:200], "planned_amount": amount, "category": None})

    return _normalize_items(items)


# ---------------------------------------------------------------------------
# Publieke interface
# ---------------------------------------------------------------------------

def parse_mjop_file(file_path: str) -> list[dict]:
    ext = Path(file_path).suffix.lower()
    if ext in (".xlsx", ".xls", ".xlsm"):
        return parse_excel(file_path)
    elif ext == ".pdf":
        return parse_pdf(file_path)
    raise ValueError(f"Niet-ondersteund bestandstype: {ext}")
