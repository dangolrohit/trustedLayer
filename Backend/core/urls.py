from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from core.views import (
    AdminUsersViewSet,
    AnalyticsView,
    BankStatementViewSet,
    BehavioralDataViewSet,
    GuarantorViewSet,
    LoanApplicationViewSet,
    LoginView,
    MerchantDirectoryViewSet,
    MeView,
    ProfileViewSet,
    PsychometricResponseViewSet,
    RegisterView,
    SystemSettingViewSet,
    TrustScoreViewSet,
)

router = DefaultRouter()
router.register("profiles", ProfileViewSet, basename="profiles")
router.register("guarantors", GuarantorViewSet, basename="guarantors")
router.register("psychometric", PsychometricResponseViewSet, basename="psychometric")
router.register("behavioral-data", BehavioralDataViewSet, basename="behavioral-data")
router.register("bank-statements", BankStatementViewSet, basename="bank-statements")
router.register("trust-score", TrustScoreViewSet, basename="trust-score")
router.register("loans", LoanApplicationViewSet, basename="loans")
router.register("merchants", MerchantDirectoryViewSet, basename="merchants")
router.register("admin/users", AdminUsersViewSet, basename="admin-users")
router.register("admin/settings", SystemSettingViewSet, basename="admin-settings")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("admin/analytics/", AnalyticsView.as_view(), name="admin-analytics"),
    path("", include(router.urls)),
]
