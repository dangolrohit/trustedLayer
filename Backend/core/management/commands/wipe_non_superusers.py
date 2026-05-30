from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

from core.models import (
    Profile,
    Guarantor,
    PsychometricResponse,
    BehavioralData,
    BankStatement,
    LoanApplication,
    TrustScoreHistory,
    SystemSetting,
)


class Command(BaseCommand):
    help = "Delete all non-superuser users and related application data. Requires --yes to run."

    def add_arguments(self, parser):
        parser.add_argument("--yes", action="store_true", help="Confirm destructive wipe")

    @transaction.atomic
    def handle(self, *args, **options):
        if not options.get("yes"):
            self.stdout.write(self.style.ERROR("This is destructive. Re-run with --yes to confirm."))
            return

        User = get_user_model()

        # Count existing records
        counts = {
            "psychometric": PsychometricResponse.objects.count(),
            "behavioral": BehavioralData.objects.count(),
            "guarantors": Guarantor.objects.count(),
            "bank_statements": BankStatement.objects.count(),
            "loans": LoanApplication.objects.count(),
            "trust_history": TrustScoreHistory.objects.count(),
            "system_settings": SystemSetting.objects.count(),
            "profiles": Profile.objects.count(),
            "users_total": User.objects.count(),
            "superusers": User.objects.filter(is_superuser=True).count(),
        }

        self.stdout.write("Counts before wipe:")
        for k, v in counts.items():
            self.stdout.write(f" - {k}: {v}")

        # Delete model data first
        PsychometricResponse.objects.all().delete()
        BehavioralData.objects.all().delete()
        Guarantor.objects.all().delete()
        BankStatement.objects.all().delete()
        LoanApplication.objects.all().delete()
        TrustScoreHistory.objects.all().delete()
        SystemSetting.objects.all().delete()

        # Delete profiles NOT belonging to superusers (profiles cascade with users, but be explicit)
        Profile.objects.filter(user__is_superuser=False).delete()

        # Delete all non-superuser users
        non_super = User.objects.filter(is_superuser=False)
        deleted_users = non_super.count()
        non_super.delete()

        self.stdout.write(self.style.SUCCESS("Wipe complete."))
        self.stdout.write(f"Deleted {deleted_users} non-superuser users and related data.")
