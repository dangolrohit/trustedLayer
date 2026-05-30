import logging

from django.db.models import Avg, Count
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

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
from core.permissions import IsAdminRole, IsLoanDepartmentOrAdmin
from core.serializers import (
    AdminUserSerializer,
    BankStatementSerializer,
    BankStatementUploadSerializer,
    BehavioralDataSerializer,
    GuarantorSerializer,
    LoanApplicationSerializer,
    LoanReviewSerializer,
    PhoneTokenObtainPairSerializer,
    ProfileSerializer,
    PsychometricResponseSerializer,
    RegisterSerializer,
    SystemSettingSerializer,
    TrustScoreHistorySerializer,
    TrustScoreSimulatorSerializer,
    UserSerializer,
)
from core.services.bank_statement_processor import BankStatementProcessor
from core.services.trust_score_service import TrustScoreService
from django.core.signing import dumps, loads, BadSignature, SignatureExpired
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class OnboardingAuthView(APIView):
    """Exchange phone+password for a short-lived onboarding token for inactive merchants.

    Merchants created as inactive can POST phone/password here to get an onboarding token
    which can be used to submit psychometric/behavioral/guarantor data before activation.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get("phone")
        password = request.data.get("password")
        if not phone or not password:
            return Response({"detail": "phone and password required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_active:
            return Response({"detail": "Account already active; please login normally."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(password):
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)
        # create a signed token with timestamp
        token = dumps({"user_id": user.id}, salt="onboarding")
        return Response({"onboarding_token": token})


def _resolve_onboarding_user(request):
    # Priority: authenticated active user
    if request.user and getattr(request.user, "is_authenticated", False) and request.user.role == User.Roles.MERCHANT:
        return request.user
    # Otherwise allow onboarding token in header or body
    token = request.META.get("HTTP_ONBOARDING_TOKEN") or request.data.get("onboarding_token")
    if not token:
        return None
    try:
        payload = loads(token, salt="onboarding")
        user_id = payload.get("user_id")
        user = User.objects.get(id=user_id)
        return user
    except (BadSignature, SignatureExpired, User.DoesNotExist):
        return None


class OnboardingCompleteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("onboarding_token") or request.META.get("HTTP_ONBOARDING_TOKEN")
        if not token:
            return Response({"detail": "onboarding_token required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = loads(token, salt="onboarding")
            user_id = payload.get("user_id")
            user = User.objects.get(id=user_id)
        except SignatureExpired:
            return Response({"detail": "Onboarding token expired"}, status=status.HTTP_400_BAD_REQUEST)
        except (BadSignature, User.DoesNotExist):
            return Response({"detail": "Invalid onboarding token"}, status=status.HTTP_400_BAD_REQUEST)

        # finalize onboarding: mark active and calculate trust score
        user.is_active = True
        user.save(update_fields=["is_active"]) 
        score = TrustScoreService().calculate_for_merchant(user, persist=True)
        return Response({"detail": "Onboarding complete", "trust_score": score})


class LoginView(TokenObtainPairView):
    serializer_class = PhoneTokenObtainPairSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return Profile.objects.select_related("user").all()
        return Profile.objects.select_related("user").filter(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        if request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return Response(self._staff_dashboard(request.user))
        profile = request.user.profile
        score = TrustScoreService().calculate_for_merchant(request.user, persist=False)
        loans = LoanApplication.objects.filter(merchant=request.user).order_by("-created_at")[:5]
        return Response(
            {
                "profile": ProfileSerializer(profile).data,
                "trust_score": score,
                "recent_loans": LoanApplicationSerializer(loans, many=True).data,
                "bank_statement_count": BankStatement.objects.filter(merchant=request.user).count(),
            }
        )

    def _staff_dashboard(self, user):
        merchants = User.objects.filter(role=User.Roles.MERCHANT)
        pending_loans = LoanApplication.objects.filter(status=LoanApplication.Status.PENDING)
        recent_loans = LoanApplication.objects.select_related("merchant", "reviewed_by").order_by("-created_at")[:5]
        return {
            "profile": ProfileSerializer(user.profile).data,
            "trust_score": TrustScoreService().calculate_for_merchant(user, persist=False),
            "recent_loans": LoanApplicationSerializer(recent_loans, many=True).data,
            "bank_statement_count": BankStatement.objects.count(),
            "analytics": {
                "merchant_count": merchants.count(),
                "pending_loan_count": pending_loans.count(),
                "approved_loan_count": LoanApplication.objects.filter(status=LoanApplication.Status.APPROVED).count(),
                "average_trust_score": round(merchants.aggregate(avg=Avg("profile__trust_score"))["avg"] or 0, 2),
            },
        }


class GuarantorViewSet(viewsets.ModelViewSet):
    serializer_class = GuarantorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return Guarantor.objects.select_related("merchant", "guarantor").all()
        return Guarantor.objects.select_related("merchant", "guarantor").filter(merchant=self.request.user)

    def perform_create(self, serializer):
        merchant = _resolve_onboarding_user(self.request)
        if merchant and merchant.role == User.Roles.MERCHANT:
            guarantor = serializer.save(merchant=merchant)
            TrustScoreService().calculate_for_merchant(merchant, persist=True)
            return
        # fallback to original behavior (staff users providing merchant)
        if self.request.user.role == User.Roles.MERCHANT:
            guarantor = serializer.save(merchant=self.request.user)
            TrustScoreService().calculate_for_merchant(self.request.user, persist=True)
            return
        if "merchant" not in serializer.validated_data:
            raise ValidationError({"merchant": "This field is required for staff users."})
        guarantor = serializer.save()
        TrustScoreService().calculate_for_merchant(guarantor.merchant, persist=True)


class PsychometricResponseViewSet(viewsets.ModelViewSet):
    serializer_class = PsychometricResponseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return PsychometricResponse.objects.select_related("merchant").all()
        return PsychometricResponse.objects.filter(merchant=self.request.user)

    def perform_create(self, serializer):
        merchant = _resolve_onboarding_user(self.request) or serializer.validated_data.get("merchant")
        if not merchant:
            raise ValidationError({"merchant": "This field is required for staff users."})
        serializer.save(merchant=merchant)
        TrustScoreService().calculate_for_merchant(merchant, persist=True)


class BehavioralDataViewSet(viewsets.ModelViewSet):
    serializer_class = BehavioralDataSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return BehavioralData.objects.select_related("merchant").all()
        return BehavioralData.objects.filter(merchant=self.request.user)

    def perform_create(self, serializer):
        merchant = _resolve_onboarding_user(self.request) or serializer.validated_data.get("merchant")
        if not merchant:
            raise ValidationError({"merchant": "This field is required for staff users."})
        serializer.save(merchant=merchant)
        TrustScoreService().calculate_for_merchant(merchant, persist=True)


class BankStatementViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = BankStatementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return BankStatement.objects.select_related("merchant").all()
        return BankStatement.objects.filter(merchant=self.request.user)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        serializer = BankStatementUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        merchant = self._upload_merchant(request, serializer)
        try:
            with transaction.atomic():
                statement = BankStatementProcessor.process_upload(merchant, serializer.validated_data["file"])
                score = TrustScoreService().calculate_for_merchant(merchant, persist=True)
        except Exception as exc:
            logger.exception("Bank statement upload failed for user_id=%s", request.user.id)
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"statement": BankStatementSerializer(statement).data, "trust_score": score},
            status=status.HTTP_201_CREATED,
        )

    def _upload_merchant(self, request, serializer):
        if request.user.role == User.Roles.MERCHANT:
            return request.user
        merchant = serializer.validated_data.get("merchant")
        if merchant:
            return merchant
        raise ValidationError({"merchant": "Choose a merchant before uploading a statement."})


class TrustScoreViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        merchant = self._target_merchant(request)
        result = TrustScoreService().calculate_for_merchant(merchant, persist=True)
        return Response(result)

    @action(detail=False, methods=["get"])
    def history(self, request):
        merchant = self._target_merchant(request)
        history = TrustScoreHistory.objects.filter(merchant=merchant)
        return Response(TrustScoreHistorySerializer(history, many=True).data)

    @action(detail=False, methods=["post"])
    def simulate(self, request):
        serializer = TrustScoreSimulatorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        merchant = self._target_merchant(request)
        return Response(TrustScoreService().simulate(merchant, serializer.validated_data))

    def _target_merchant(self, request):
        merchant_id = request.query_params.get("merchant_id") or request.data.get("merchant_id")
        if merchant_id and request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return get_object_or_404(User, id=merchant_id, role=User.Roles.MERCHANT)
        return request.user


class LoanApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = LoanApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return LoanApplication.objects.select_related("merchant", "reviewed_by").all()
        return LoanApplication.objects.select_related("merchant", "reviewed_by").filter(merchant=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.role != User.Roles.MERCHANT:
            raise ValidationError("Only merchants can submit loan applications.")
        score_payload = TrustScoreService().calculate_for_merchant(self.request.user, persist=True)
        serializer.save(
            merchant=self.request.user,
            trust_score_at_application=score_payload["score"],
        )

    @action(detail=True, methods=["post"], permission_classes=[IsLoanDepartmentOrAdmin])
    def review(self, request, pk=None):
        application = self.get_object()
        if application.status != LoanApplication.Status.PENDING:
            raise ValidationError("Only pending loan applications can be reviewed.")
        serializer = LoanReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application.mark_reviewed(
            reviewer=request.user,
            status=serializer.validated_data["status"],
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(LoanApplicationSerializer(application).data)


class AdminUsersViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile").all()
    serializer_class = UserSerializer
    permission_classes = [IsLoanDepartmentOrAdmin]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAdminRole()]
        return [permission() for permission in self.permission_classes]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return AdminUserSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data)


class MerchantDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.select_related("profile").filter(role=User.Roles.MERCHANT, is_active=True).order_by("phone")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAdminRole]


class AnalyticsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        merchants = User.objects.filter(role=User.Roles.MERCHANT)
        loans_by_status = dict(
            LoanApplication.objects.values("status").annotate(count=Count("id")).values_list("status", "count")
        )
        return Response(
            {
                "users": {
                    "total": User.objects.count(),
                    "merchants": merchants.count(),
                    "loan_department": User.objects.filter(role=User.Roles.LOAN_DEPARTMENT).count(),
                    "admins": User.objects.filter(role=User.Roles.ADMIN).count(),
                    "active": User.objects.filter(is_active=True).count(),
                },
                "loans": {
                    "total": LoanApplication.objects.count(),
                    "pending": loans_by_status.get(LoanApplication.Status.PENDING, 0),
                    "approved": loans_by_status.get(LoanApplication.Status.APPROVED, 0),
                    "rejected": loans_by_status.get(LoanApplication.Status.REJECTED, 0),
                },
                "trust": {
                    "average_score": round(merchants.aggregate(avg=Avg("profile__trust_score"))["avg"] or 0, 2),
                    "strong_merchants": merchants.filter(profile__trust_score__gte=75).count(),
                    "thin_merchants": merchants.filter(profile__trust_score__lt=55).count(),
                },
                "signals": {
                    "bank_statements": BankStatement.objects.count(),
                    "psychometric_responses": PsychometricResponse.objects.count(),
                    "guarantors": Guarantor.objects.count(),
                },
            }
        )
