from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

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


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("id", "phone", "role", "is_active", "is_staff", "date_joined")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("phone", "profile__name")
    ordering = ("-date_joined",)
    fieldsets = UserAdmin.fieldsets + (("Trust Layer", {"fields": ("phone", "role")}),)
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone", "password1", "password2", "role", "is_staff", "is_superuser"),
            },
        ),
    )


admin.site.register(Profile)
admin.site.register(Guarantor)
admin.site.register(PsychometricResponse)
admin.site.register(BehavioralData)
admin.site.register(BankStatement)
admin.site.register(LoanApplication)
admin.site.register(TrustScoreHistory)
admin.site.register(SystemSetting)
