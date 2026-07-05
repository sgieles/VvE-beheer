"""
Eenvoudige bankbalans-parser voor PDF en Excel.

Probeert twee dingen te extraheren:
- De balansdatum (waarop het saldo geldt)
- Het eindsaldo (positief bedrag)

Geeft terug: {'amount': float|None, 'entry_date': str|None, 'confidence': 'high'|'low'}
"""
import re
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

log = logging.getLogger(__name__)

_DATE_RE_DMY = re.compile(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b")
_DATE_RE_YMD = re.compile(r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b")
_AMOUNT_RE = re.compile(r"[€]?\s*([\d]{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)\b")

_BALANCE_KEYWORDS = (
    "saldo", "eindstand", "eindsaldo", "stand per", "huidig saldo",
    "rekeningsaldo", "totaal saldo", "closing balance", "end balance",
    "beginsaldo", "openingssaldo", "slotstand",
)


def _parse_date(text: str) -> date | None:
    for pat, ymd in ((_DATE_RE_DMY, False), (_DATE_RE_YMD, True)):
        m = pat.search(text)
        if not m:
            continue
        g = m.groups()
        try:
            if ymd:
                return date(int(g[0]), int(g[1]), int(g[2]))
            return date(int(g[2]), int(g[1]), int(g[0]))
        except ValueError:
            continue
    return None


def _parse_amount(text: str) -> Decimal | None:
    amounts: list[Decimal] = []
    for m in _AMOUNT_RE.finditer(text):
        raw = re.sub(r"\s", "", m.group(1))
        if "," in raw and "." in raw:
            if raw.rindex(".") < raw.rindex(","):
                raw = raw.replace(".", "").replace(",", ".")
            else:
                raw = raw.replace(",", "")
        elif "," in raw:
            parts = raw.split(",")
            if len(parts[-1]) == 2:
                raw = raw.replace(",", ".")
            else:
                raw = raw.replace(",", "")
        try:
            val = Decimal(raw)
            if Decimal("100") <= val <= Decimal("10000000"):
                amounts.append(val)
        except InvalidOperation:
            continue
    return max(amounts) if amounts else None


def _scan_text(text: str) -> tuple[Decimal | None, date | None]:
    lines = text.lower().split("\n")
    orig_lines = text.split("\n")

    best_amount: Decimal | None = None
    best_date: date | None = None
    found_keyword = False

    for i, line in enumerate(lines):
        if not any(kw in line for kw in _BALANCE_KEYWORDS):
            continue
        found_keyword = True
        ctx = "\n".join(orig_lines[max(0, i - 1) : i + 3])
        if best_date is None:
            best_date = _parse_date(ctx)
        if best_amount is None:
            best_amount = _parse_amount(ctx)

    if not found_keyword:
        best_date = _parse_date(text)
        best_amount = _parse_amount(text)

    return best_amount, best_date


def parse_pdf_balanssheet(file_path: str) -> dict:
    import pdfplumber

    parts: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    amount, entry_date = _scan_text("\n".join(parts))
    return {
        "amount": float(amount) if amount else None,
        "entry_date": entry_date.isoformat() if entry_date else None,
        "confidence": "high" if (amount and entry_date) else "low",
    }


def parse_excel_balanssheet(file_path: str) -> dict:
    import pandas as pd

    xl = pd.ExcelFile(file_path)
    parts: list[str] = []
    for sheet in xl.sheet_names[:3]:
        df = pd.read_excel(file_path, sheet_name=sheet, header=None)
        parts.append(df.to_string())
    amount, entry_date = _scan_text("\n".join(parts))
    return {
        "amount": float(amount) if amount else None,
        "entry_date": entry_date.isoformat() if entry_date else None,
        "confidence": "high" if (amount and entry_date) else "low",
    }


def parse_balanssheet(file_path: str) -> dict:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return parse_pdf_balanssheet(file_path)
    if ext in (".xlsx", ".xls", ".xlsm"):
        return parse_excel_balanssheet(file_path)
    raise ValueError(f"Niet-ondersteund bestandstype: {ext}")
