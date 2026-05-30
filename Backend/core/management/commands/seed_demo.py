from datetime import date

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    BankStatement,
    BehavioralData,
    Guarantor,
    LoanApplication,
    Profile,
    PsychometricResponse,
    SystemSetting,
    User,
)
from core.services.trust_score_service import TrustScoreService


class Command(BaseCommand):
    help = "Seed demo users and trust-scoring data for development/testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="DemoPass123!",
            help="Password assigned to all seeded users.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        user_model = get_user_model()

        admin = self._user(
            user_model,
            phone="+9779800000001",
            role=User.Roles.ADMIN,
            password=password,
            is_staff=True,
            is_superuser=True,
            profile={
                "name": "System Admin",
                "region": "Kathmandu",
                "trade_type": "Administration",
                "address": "Kathmandu",
            },
        )
        loan_officer = self._user(
            user_model,
            phone="+9779800000002",
            role=User.Roles.LOAN_DEPARTMENT,
            password=password,
            is_staff=True,
            profile={
                "name": "Loan Officer",
                "region": "Kathmandu",
                "trade_type": "Loan Review",
                "address": "Kathmandu",
            },
        )
        merchant = self._user(
            user_model,
            phone="+9779800000101",
            role=User.Roles.MERCHANT,
            password=password,
            profile={
                "name": "Maya Kirana Store",
                "region": "Lalitpur",
                "trade_type": "Grocery",
                "address": "Patan, Lalitpur",
            },
        )
        guarantor = self._user(
            user_model,
            phone="+9779800000201",
            role=User.Roles.MERCHANT,
            password=password,
            profile={
                "name": "Suman Tea Stall",
                "region": "Lalitpur",
                "trade_type": "Food and Beverage",
                "address": "Mangal Bazaar, Lalitpur",
            },
        )

        Guarantor.objects.update_or_create(
            merchant=merchant,
            guarantor=guarantor,
            defaults={"vouch_strength": 4, "status": Guarantor.Status.ACTIVE},
        )

        psychometric = [
            ("resilience", 78, {"questions_answered": 8, "risk_response": "balanced"}),
            ("honesty", 84, {"questions_answered": 7, "consistency_flags": 0}),
            ("planning", 72, {"questions_answered": 8, "budgeting_habit": "weekly"}),
        ]
        for trait, score, responses in psychometric:
            PsychometricResponse.objects.update_or_create(
                merchant=merchant,
                trait=trait,
                defaults={"score": score, "responses_json": responses},
            )

        BehavioralData.objects.update_or_create(
            merchant=merchant,
            data_type=BehavioralData.DataTypes.QR_TRANSACTION,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 3, 31),
            defaults={
                "metrics_json": {
                    "score": 76,
                    "transaction_frequency": 82,
                    "revenue_growth": 68,
                    "payment_punctuality": 79,
                }
            },
        )
        BehavioralData.objects.update_or_create(
            merchant=merchant,
            data_type=BehavioralData.DataTypes.UTILITY,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 3, 31),
            defaults={
                "metrics_json": {
                    "score": 81,
                    "payment_punctuality": 88,
                    "late_payment_count": 0,
                }
            },
        )

        transactions = [
            {"date": "2026-01-05", "description": "QR settlement", "credit": 42000, "debit": 0, "balance": 55000},
            {"date": "2026-01-12", "description": "Inventory purchase", "credit": 0, "debit": 18000, "balance": 37000},
            {"date": "2026-02-05", "description": "QR settlement", "credit": 45500, "debit": 0, "balance": 71000},
            {"date": "2026-02-16", "description": "Supplier payment", "credit": 0, "debit": 20500, "balance": 50500},
            {"date": "2026-03-06", "description": "QR settlement", "credit": 47000, "debit": 0, "balance": 83500},
            {"date": "2026-03-18", "description": "Rent and inventory", "credit": 0, "debit": 28000, "balance": 55500},
        ]
        BankStatement.objects.update_or_create(
            merchant=merchant,
            file_path="seed/demo/maya-kirana-statement.pdf",
            defaults={
                "file_url": "",
                "extracted_text": "Seeded bank statement summary for demo merchant.",
                "parsed_transactions": transactions,
                "analysis_summary": {
                    "monthly_income": 44833.33,
                    "avg_balance": 58750,
                    "consistency_score": 94,
                    "volatility": 25.8,
                    "bounced_count": 0,
                    "income_expense_ratio": 2.04,
                    "transaction_count": len(transactions),
                    "months_observed": 3,
                    "total_credit": 134500,
                    "total_debit": 66500,
                    "bank_behavior_score": 87,
                },
            },
        )

        score_payload = TrustScoreService().calculate_for_merchant(merchant, persist=True)

        LoanApplication.objects.get_or_create(
            merchant=merchant,
            amount_requested=75000,
            purpose="Inventory expansion before festival season",
            defaults={
                "status": LoanApplication.Status.PENDING,
                "trust_score_at_application": score_payload["score"],
            },
        )

        SystemSetting.objects.update_or_create(
            key="minimum_approval_score",
            defaults={"value": "65", "description": "Suggested trust score threshold for loan approval."},
        )
        SystemSetting.objects.update_or_create(
            key="max_statement_upload_mb",
            defaults={"value": "5", "description": "Maximum bank statement PDF upload size."},
        )

        self.stdout.write(self.style.SUCCESS("Seed data created/updated successfully."))
        self.stdout.write(f"Admin phone: {admin.phone} | password: {password}")
        self.stdout.write(f"Loan officer phone: {loan_officer.phone} | password: {password}")
        self.stdout.write(f"Merchant phone: {merchant.phone} | password: {password}")
        self.stdout.write(f"Merchant trust score: {score_payload['score']}")

    def _user(self, user_model, phone, role, password, profile, is_staff=False, is_superuser=False):
        user, created = user_model.objects.get_or_create(
            phone=phone,
            defaults={
                "username": phone,
                "role": role,
                "is_staff": is_staff,
                "is_superuser": is_superuser,
                "is_active": True,
            },
        )
        if created or not user.has_usable_password():
            user.set_password(password)
        user.username = phone
        user.role = role
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.is_active = True
        user.save()

        # Ensure a Profile exists for the user (may be missing for pre-existing users).
        Profile.objects.get_or_create(user=user)
        for field, value in profile.items():
            setattr(user.profile, field, value)
        if user.profile.score_last_updated is None:
            user.profile.score_last_updated = timezone.now()
        user.profile.save()
        return user
