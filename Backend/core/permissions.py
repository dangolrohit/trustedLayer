from rest_framework.permissions import BasePermission, SAFE_METHODS

from core.models import User


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Roles.ADMIN)


class IsLoanDepartmentOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}
        )


class IsMerchant(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.role == User.Roles.MERCHANT
        )


class IsSelfMerchantOrStaffRole(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role in {User.Roles.ADMIN, User.Roles.LOAN_DEPARTMENT}:
            return True
        merchant = getattr(obj, "merchant", None) or getattr(obj, "user", None) or obj
        return merchant == request.user


class ReadOnlyLoanDepartmentWriteAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == User.Roles.ADMIN:
            return True
        return request.method in SAFE_METHODS and request.user.role == User.Roles.LOAN_DEPARTMENT
