from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.models import (
    BankStatement,
    BehavioralData,
    Guarantor,
    LoanApplication,
    Profile,
    PsychometricResponse,
    SystemSetting,
    TrustScoreHistory,
    User,
)

UserModel = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = UserModel
        fields = ("id", "phone", "password", "role", "name")
        read_only_fields = ("id",)

    def validate_role(self, value):
        request = self.context.get("request")
        if value in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            if not request or not request.user.is_authenticated or request.user.role != User.Roles.ADMIN:
                raise serializers.ValidationError("Only admins can create privileged users.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        name = validated_data.pop("name", "")
        password = validated_data.pop("password")
        user = UserModel(**validated_data)
        user.set_password(password)
        user.username = validated_data["phone"]
        user.save()
        if name:
            user.profile.name = name
            user.profile.save(update_fields=["name"])
        return user


class PhoneTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = UserModel.USERNAME_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class ProfileSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source="user.phone", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "phone",
            "role",
            "name",
            "region",
            "trade_type",
            "address",
            "trust_score",
            "score_last_updated",
        )
        read_only_fields = ("id", "trust_score", "score_last_updated", "phone", "role")


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = UserModel
        fields = ("id", "phone", "role", "is_active", "date_joined", "profile")
        read_only_fields = ("id", "is_active", "date_joined")


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    region = serializers.CharField(write_only=True, required=False, allow_blank=True)
    trade_type = serializers.CharField(write_only=True, required=False, allow_blank=True)
    address = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = UserModel
        fields = (
            "id",
            "phone",
            "password",
            "role",
            "is_active",
            "name",
            "region",
            "trade_type",
            "address",
        )
        read_only_fields = ("id",)

    @transaction.atomic
    def create(self, validated_data):
        profile_data = self._pop_profile_data(validated_data)
        password = validated_data.pop("password", "")
        user = UserModel(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.username = user.phone
        user.is_staff = user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}
        user.is_superuser = user.role == User.Roles.ADMIN
        user.save()
        self._update_profile(user, profile_data)
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        profile_data = self._pop_profile_data(validated_data)
        password = validated_data.pop("password", "")
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.username = instance.phone
        instance.is_staff = instance.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}
        instance.is_superuser = instance.role == User.Roles.ADMIN
        instance.save()
        self._update_profile(instance, profile_data)
        return instance

    def _pop_profile_data(self, validated_data):
        return {
            key: validated_data.pop(key)
            for key in ["name", "region", "trade_type", "address"]
            if key in validated_data
        }

    def _update_profile(self, user, profile_data):
        if not profile_data:
            return
        for field, value in profile_data.items():
            setattr(user.profile, field, value)
        user.profile.save(update_fields=[*profile_data.keys()])


class GuarantorSerializer(serializers.ModelSerializer):
    merchant_phone = serializers.CharField(source="merchant.phone", read_only=True)
    guarantor_phone = serializers.CharField(source="guarantor.phone", read_only=True)

    class Meta:
        model = Guarantor
        fields = (
            "id",
            "merchant",
            "merchant_phone",
            "guarantor",
            "guarantor_phone",
            "vouch_strength",
            "status",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "merchant_phone", "guarantor_phone")
        extra_kwargs = {"merchant": {"required": False}}

    def validate(self, attrs):
        if attrs.get("merchant") == attrs.get("guarantor"):
            raise serializers.ValidationError("A merchant cannot be their own guarantor.")
        return attrs


class PsychometricResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PsychometricResponse
        fields = ("id", "merchant", "trait", "score", "responses_json", "completed_at")
        read_only_fields = ("id", "completed_at")
        extra_kwargs = {"merchant": {"required": False}}


class BehavioralDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = BehavioralData
        fields = ("id", "merchant", "data_type", "metrics_json", "period_start", "period_end")
        read_only_fields = ("id",)
        extra_kwargs = {"merchant": {"required": False}}

    def validate(self, attrs):
        if attrs["period_end"] < attrs["period_start"]:
            raise serializers.ValidationError("period_end must be on or after period_start.")
        return attrs


class BankStatementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatement
        fields = (
            "id",
            "merchant",
            "file_path",
            "file_url",
            "uploaded_at",
            "extracted_text",
            "parsed_transactions",
            "analysis_summary",
        )
        read_only_fields = fields


class BankStatementUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    merchant = serializers.PrimaryKeyRelatedField(
        queryset=UserModel.objects.filter(role=User.Roles.MERCHANT),
        required=False,
    )


class LoanApplicationSerializer(serializers.ModelSerializer):
    merchant_phone = serializers.CharField(source="merchant.phone", read_only=True)
    reviewer_phone = serializers.CharField(source="reviewed_by.phone", read_only=True)

    class Meta:
        model = LoanApplication
        fields = (
            "id",
            "merchant",
            "merchant_phone",
            "amount_requested",
            "purpose",
            "status",
            "trust_score_at_application",
            "reviewed_by",
            "reviewer_phone",
            "decision_date",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "merchant",
            "merchant_phone",
            "status",
            "trust_score_at_application",
            "reviewed_by",
            "reviewer_phone",
            "decision_date",
            "notes",
            "created_at",
            "updated_at",
        )

    def validate_amount_requested(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount requested must be greater than zero.")
        return value


class LoanReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[LoanApplication.Status.APPROVED, LoanApplication.Status.REJECTED])
    notes = serializers.CharField(required=False, allow_blank=True)


class TrustScoreHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustScoreHistory
        fields = (
            "id",
            "merchant",
            "score",
            "social_component",
            "psychometric_component",
            "behavioral_component",
            "bank_impact",
            "explanation",
            "created_at",
        )
        read_only_fields = fields


class TrustScoreSimulatorSerializer(serializers.Serializer):
    social_component = serializers.IntegerField(min_value=0, max_value=100, required=False)
    psychometric_component = serializers.IntegerField(min_value=0, max_value=100, required=False)
    behavioral_component = serializers.IntegerField(min_value=0, max_value=100, required=False)


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ("id", "key", "value", "description", "updated_at")
        read_only_fields = ("id", "updated_at")
