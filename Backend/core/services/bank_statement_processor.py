import logging
import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from statistics import mean, pstdev
from tempfile import NamedTemporaryFile
from uuid import uuid4

import pdfplumber
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone

from core.models import BankStatement, BehavioralData
from core.utils.supabase_client import create_signed_url, upload_private_file

logger = logging.getLogger(__name__)

MONEY_PATTERN = r"[-+]?(?:Rs\.?|NPR)?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|[-+]?\d+(?:\.\d{1,2})?"
DATE_PATTERN = r"(?P<date>\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})"


def validate_pdf_upload(uploaded_file):
    if uploaded_file.size > settings.MAX_BANK_STATEMENT_BYTES:
        raise ValidationError("Bank statement must be 5MB or smaller.")
    if uploaded_file.content_type != "application/pdf" and not uploaded_file.name.lower().endswith(".pdf"):
        raise ValidationError("Only PDF bank statements are supported.")


def extract_pdf_text(uploaded_file) -> str:
    uploaded_file.seek(0)
    with NamedTemporaryFile(suffix=".pdf") as temp_file:
        for chunk in uploaded_file.chunks():
            temp_file.write(chunk)
        temp_file.flush()

        text_parts = []
        with pdfplumber.open(temp_file.name) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text:
                    text_parts.append(text)
        return "\n".join(text_parts).strip()


def _to_decimal(raw: str) -> Decimal:
    cleaned = re.sub(r"[^\d\-.]", "", raw or "")
    if not cleaned:
        return Decimal("0")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return Decimal("0")


def _normalize_date(raw: str):
    cleaned = (raw or "").strip().replace("/", "-")
    formats = (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%m-%d-%Y",
        "%d-%m-%y",
        "%m-%d-%y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_transactions(extracted_text: str) -> list[dict]:
    transactions = []
    for line in extracted_text.splitlines():
        compact = " ".join(line.split())
        if not compact:
            continue
        date_match = re.search(DATE_PATTERN, compact)
        if not date_match:
            continue

        amounts = re.findall(MONEY_PATTERN, compact)
        numeric_amounts = [_to_decimal(item) for item in amounts if re.search(r"\d", item)]
        if len(numeric_amounts) < 2:
            continue

        tx_date = _normalize_date(date_match.group("date"))
        if not tx_date:
            continue

        balance = numeric_amounts[-1]
        debit = Decimal("0")
        credit = Decimal("0")
        if len(numeric_amounts) >= 3:
            debit = abs(numeric_amounts[-3])
            credit = abs(numeric_amounts[-2])
        else:
            amount = numeric_amounts[-2]
            if any(token in compact.lower() for token in ["cr", "credit", "deposit", "received"]):
                credit = abs(amount)
            else:
                debit = abs(amount)

        description = compact[date_match.end() :]
        description = re.sub(MONEY_PATTERN, "", description).strip(" -|")
        transactions.append(
            {
                "date": tx_date,
                "description": description[:255],
                "credit": float(credit),
                "debit": float(debit),
                "balance": float(balance),
            }
        )
    return transactions


def analyze_transactions(transactions: list[dict]) -> dict:
    if not transactions:
        return {
            "monthly_income": 0,
            "avg_balance": 0,
            "consistency_score": 0,
            "volatility": 100,
            "bounced_count": 0,
            "income_expense_ratio": 0,
            "transaction_count": 0,
            "bank_behavior_score": 0,
        }

    monthly_income = defaultdict(float)
    balances = []
    total_credit = 0.0
    total_debit = 0.0
    bounced_count = 0

    for tx in transactions:
        month = tx["date"][:7]
        credit = float(tx.get("credit") or 0)
        debit = float(tx.get("debit") or 0)
        balance = float(tx.get("balance") or 0)
        total_credit += credit
        total_debit += debit
        monthly_income[month] += credit
        balances.append(balance)
        text = str(tx.get("description", "")).lower()
        if any(word in text for word in ["bounce", "returned", "insufficient", "dishonour"]):
            bounced_count += 1

    income_values = list(monthly_income.values()) or [0.0]
    avg_monthly_income = mean(income_values)
    income_volatility = (pstdev(income_values) / avg_monthly_income) if avg_monthly_income else 1
    consistency_score = max(0, min(100, round(100 - (income_volatility * 100))))
    avg_balance = mean(balances) if balances else 0
    balance_volatility = (pstdev(balances) / avg_balance) if avg_balance > 0 and len(balances) > 1 else 0
    income_expense_ratio = total_credit / total_debit if total_debit else total_credit

    base = 45
    base += min(25, avg_monthly_income / 4000)
    base += consistency_score * 0.25
    base += min(10, max(0, income_expense_ratio - 1) * 10)
    base -= min(25, balance_volatility * 25)
    base -= bounced_count * 8
    bank_behavior_score = round(max(0, min(100, base)))

    return {
        "monthly_income": round(avg_monthly_income, 2),
        "avg_balance": round(avg_balance, 2),
        "consistency_score": consistency_score,
        "volatility": round(balance_volatility * 100, 2),
        "bounced_count": bounced_count,
        "income_expense_ratio": round(income_expense_ratio, 2),
        "transaction_count": len(transactions),
        "months_observed": len(monthly_income),
        "total_credit": round(total_credit, 2),
        "total_debit": round(total_debit, 2),
        "bank_behavior_score": bank_behavior_score,
    }


class BankStatementProcessor:
    @staticmethod
    def process_upload(merchant, uploaded_file) -> BankStatement:
        validate_pdf_upload(uploaded_file)
        storage_path = (
            f"merchants/{merchant.id}/{timezone.now().date().isoformat()}/"
            f"{uuid4()}-{uploaded_file.name}"
        )
        extracted_text = extract_pdf_text(uploaded_file)
        parsed_transactions = parse_transactions(extracted_text)
        analysis_summary = analyze_transactions(parsed_transactions)

        uploaded_file.seek(0)
        upload_private_file(uploaded_file, storage_path, "application/pdf")
        signed_url = create_signed_url(storage_path)

        statement = BankStatement.objects.create(
            merchant=merchant,
            file_path=storage_path,
            file_url=signed_url,
            extracted_text=extracted_text,
            parsed_transactions=parsed_transactions,
            analysis_summary=analysis_summary,
        )

        if parsed_transactions:
            dates = [datetime.fromisoformat(tx["date"]).date() for tx in parsed_transactions]
            BehavioralData.objects.create(
                merchant=merchant,
                data_type=BehavioralData.DataTypes.WALLET,
                metrics_json={
                    "source": "bank_statement",
                    "bank_statement_id": statement.id,
                    **analysis_summary,
                },
                period_start=min(dates),
                period_end=max(dates),
            )
        return statement
