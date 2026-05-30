import logging

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
    TrustScoreHistory,
    User,
)
from core.permissions import IsLoanDepartmentOrAdmin
from core.serializers import (
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
    TrustScoreHistorySerializer,
    TrustScoreSimulatorSerializer,
    UserSerializer,
)
from core.services.bank_statement_processor import BankStatementProcessor
from core.services.trust_score_service import TrustScoreService

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


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


class GuarantorViewSet(viewsets.ModelViewSet):
    serializer_class = GuarantorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return Guarantor.objects.select_related("merchant", "guarantor").all()
        return Guarantor.objects.select_related("merchant", "guarantor").filter(merchant=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.role == User.Roles.MERCHANT:
            serializer.save(merchant=self.request.user)
        else:
            if "merchant" not in serializer.validated_data:
                raise ValidationError({"merchant": "This field is required for staff users."})
            serializer.save()


class PsychometricResponseViewSet(viewsets.ModelViewSet):
    serializer_class = PsychometricResponseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return PsychometricResponse.objects.select_related("merchant").all()
        return PsychometricResponse.objects.filter(merchant=self.request.user)

    def perform_create(self, serializer):
        merchant = self.request.user if self.request.user.role == User.Roles.MERCHANT else serializer.validated_data.get("merchant")
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
        merchant = self.request.user if self.request.user.role == User.Roles.MERCHANT else serializer.validated_data.get("merchant")
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


class AdminUsersViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.select_related("profile").all()
    serializer_class = UserSerializer
    permission_classes = [IsLoanDepartmentOrAdmin]
