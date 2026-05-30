from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import BankStatement, LoanApplication, SystemSetting, User


class ApiWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user_model = get_user_model()
        self.merchant = user_model.objects.create_user(
            phone="+9779800000101",
            password="DemoPass123!",
            role=User.Roles.MERCHANT,
        )
        self.staff = user_model.objects.create_user(
            phone="+9779800000002",
            password="DemoPass123!",
            role=User.Roles.LOAN_DEPARTMENT,
        )
        self.admin = user_model.objects.create_user(
            phone="+9779800000001",
            password="DemoPass123!",
            role=User.Roles.ADMIN,
            is_staff=True,
            is_superuser=True,
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_merchant_can_submit_positive_loan_application(self):
        self.authenticate(self.merchant)

        response = self.client.post(
            "/api/loans/",
            {"amount_requested": "75000", "purpose": "Inventory expansion"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        application = LoanApplication.objects.get()
        self.assertEqual(application.merchant, self.merchant)
        self.assertGreaterEqual(application.trust_score_at_application, 0)

    def test_staff_cannot_submit_loan_application_for_themselves(self):
        self.authenticate(self.staff)

        response = self.client.post(
            "/api/loans/",
            {"amount_requested": "75000", "purpose": "Inventory expansion"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(LoanApplication.objects.exists())

    def test_staff_can_review_pending_loan_once(self):
        application = LoanApplication.objects.create(
            merchant=self.merchant,
            amount_requested="75000",
            purpose="Inventory expansion",
            trust_score_at_application=50,
        )
        self.authenticate(self.staff)

        response = self.client.post(
            f"/api/loans/{application.id}/review/",
            {"status": LoanApplication.Status.APPROVED, "notes": "Looks good."},
            format="json",
        )
        second_response = self.client.post(
            f"/api/loans/{application.id}/review/",
            {"status": LoanApplication.Status.REJECTED, "notes": "Changed mind."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        application.refresh_from_db()
        self.assertEqual(application.status, LoanApplication.Status.APPROVED)

    @patch("core.views.TrustScoreService.calculate_for_merchant")
    @patch("core.views.BankStatementProcessor.process_upload")
    def test_staff_statement_upload_requires_target_merchant(self, process_upload, calculate_score):
        self.authenticate(self.staff)
        process_upload.return_value = BankStatement.objects.create(
            merchant=self.merchant,
            file_path="test.pdf",
        )
        calculate_score.return_value = {"score": 50}
        file_obj = SimpleUploadedFile("statement.pdf", b"%PDF-1.4", content_type="application/pdf")

        missing_merchant = self.client.post(
            "/api/bank-statements/upload/",
            {"file": file_obj},
            format="multipart",
        )
        with_merchant = self.client.post(
            "/api/bank-statements/upload/",
            {
                "file": SimpleUploadedFile("statement.pdf", b"%PDF-1.4", content_type="application/pdf"),
                "merchant": self.merchant.id,
            },
            format="multipart",
        )

        self.assertEqual(missing_merchant.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(with_merchant.status_code, status.HTTP_201_CREATED)
        process_upload.assert_called_once()
        self.assertEqual(process_upload.call_args.args[0], self.merchant)

    def test_admin_can_manage_users_settings_and_analytics(self):
        self.authenticate(self.admin)

        user_response = self.client.post(
            "/api/admin/users/",
            {
                "phone": "+9779800000301",
                "password": "DemoPass123!",
                "role": User.Roles.MERCHANT,
                "is_active": True,
                "name": "New Merchant",
            },
            format="json",
        )
        setting_response = self.client.post(
            "/api/admin/settings/",
            {"key": "minimum_approval_score", "value": "65", "description": "Approval guide."},
            format="json",
        )
        analytics_response = self.client.get("/api/admin/analytics/")

        self.assertEqual(user_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(setting_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(analytics_response.status_code, status.HTTP_200_OK)
        self.assertEqual(SystemSetting.objects.get(key="minimum_approval_score").value, "65")

    def test_loan_department_cannot_manage_admin_settings(self):
        self.authenticate(self.staff)

        response = self.client.post(
            "/api/admin/settings/",
            {"key": "minimum_approval_score", "value": "65"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_merchant_can_view_merchant_directory_for_guarantor_selection(self):
        self.authenticate(self.merchant)

        response = self.client.get("/api/merchants/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get("results", response.data)
        self.assertGreaterEqual(len(payload), 1)
