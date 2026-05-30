from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class UserManager(DjangoUserManager):
    def _create_user(self, phone, password, **extra_fields):
        if not phone:
            raise ValueError("The phone field must be set.")
        user = self.model(phone=phone, username=extra_fields.pop("username", phone), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone, password, **extra_fields)

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Roles.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(phone, password, **extra_fields)


class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = "admin", "Admin"
        LOAN_DEPARTMENT = "loan_department", "Loan Department"
        MERCHANT = "merchant", "Merchant"

    username = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.MERCHANT)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["role", "is_active"]),
        ]

    def __str__(self):
        return f"{self.phone} ({self.role})"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    name = models.CharField(max_length=255, blank=True)
    region = models.CharField(max_length=120, blank=True)
    trade_type = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    trust_score = models.IntegerField(
        default=0, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    score_last_updated = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["region", "trade_type"]),
            models.Index(fields=["trust_score"]),
        ]

    def __str__(self):
        return self.name or self.user.phone


class Guarantor(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"

    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="merchant_guarantors"
    )
    guarantor = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="guarantees_given", null=True, blank=True
    )
    guarantor_name = models.CharField(max_length=255, blank=True)
    guarantor_phone = models.CharField(max_length=20, blank=True)
    guarantor_address = models.TextField(blank=True)
    relation = models.CharField(max_length=120, blank=True)
    vouch_strength = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["merchant", "guarantor"],
                condition=models.Q(guarantor__isnull=False),
                name="unique_merchant_guarantor",
            ),
            models.CheckConstraint(
                condition=models.Q(guarantor__isnull=True) | ~models.Q(merchant=models.F("guarantor")),
                name="merchant_cannot_guarantee_self",
            ),
        ]
        indexes = [
            models.Index(fields=["merchant", "status"]),
            models.Index(fields=["guarantor", "status"]),
        ]

    def __str__(self):
        return f"{self.guarantor_id} -> {self.merchant_id}"


class PsychometricResponse(models.Model):
    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="psychometric_responses"
    )
    trait = models.CharField(max_length=120)
    score = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    responses_json = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["merchant", "trait"]),
            models.Index(fields=["completed_at"]),
        ]

    def __str__(self):
        return f"{self.merchant_id} {self.trait}: {self.score}"


class BehavioralData(models.Model):
    class DataTypes(models.TextChoices):
        UTILITY = "utility", "Utility"
        AIRTIME = "airtime", "Airtime"
        QR_TRANSACTION = "qr_transaction", "QR Transaction"
        INVENTORY = "inventory", "Inventory"
        WALLET = "wallet", "Wallet"
        OTHER = "other", "Other"

    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="behavioral_data"
    )
    data_type = models.CharField(max_length=32, choices=DataTypes.choices)
    metrics_json = models.JSONField(default=dict, blank=True)
    period_start = models.DateField()
    period_end = models.DateField()

    class Meta:
        indexes = [
            models.Index(fields=["merchant", "data_type"]),
            models.Index(fields=["period_start", "period_end"]),
        ]

    def __str__(self):
        return f"{self.merchant_id} {self.data_type} {self.period_start}-{self.period_end}"


class BankStatement(models.Model):
    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="bank_statements"
    )
    file_path = models.CharField(max_length=512)
    file_url = models.URLField(max_length=1200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    extracted_text = models.TextField(blank=True)
    parsed_transactions = models.JSONField(default=list, blank=True)
    analysis_summary = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["merchant", "-uploaded_at"]),
        ]

    def __str__(self):
        return f"Bank statement {self.id} for {self.merchant_id}"


class LoanApplication(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="loan_applications"
    )
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2)
    purpose = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    trust_score_at_application = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loan_reviews",
    )
    decision_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["merchant", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def mark_reviewed(self, reviewer, status, notes=""):
        self.reviewed_by = reviewer
        self.status = status
        self.notes = notes
        self.decision_date = timezone.now()
        self.save(update_fields=["reviewed_by", "status", "notes", "decision_date", "updated_at"])


class TrustScoreHistory(models.Model):
    merchant = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="trust_score_history"
    )
    score = models.IntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
    social_component = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    psychometric_component = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    behavioral_component = models.IntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    bank_impact = models.IntegerField(
        default=0, validators=[MinValueValidator(-100), MaxValueValidator(100)]
    )
    explanation = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["merchant", "-created_at"]),
            models.Index(fields=["score"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.merchant_id}: {self.score}"


class SystemSetting(models.Model):
    key = models.CharField(max_length=120, unique=True)
    value = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["key"]

    def __str__(self):
        return self.key
