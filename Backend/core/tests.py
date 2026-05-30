import io
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from openpyxl import Workbook

from core.models import BankStatement, BehavioralData, Guarantor, LoanApplication, PsychometricResponse, SystemSetting, TrustScoreHistory, User


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

    @patch("core.services.bank_statement_processor.create_signed_url", return_value="https://signed.example/test.xlsx")
    @patch("core.services.bank_statement_processor.download_private_file")
    @patch("core.services.bank_statement_processor.upload_private_file")
    def test_bank_statement_upload_uses_supabase_bucket_copy(self, upload_file, download_file, create_signed_url):
        self.authenticate(self.merchant)

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(["Date", "Description", "Credit", "Debit", "Balance"])
        worksheet.append(["2026-05-01", "Sale", 1000, 0, 1000])
        buffer = io.BytesIO()
        workbook.save(buffer)
        file_bytes = buffer.getvalue()

        file_obj = SimpleUploadedFile(
            "statement.xlsx",
            file_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        download_file.return_value = file_bytes
        response = self.client.post(
            "/api/bank-statements/upload/",
            {"file": file_obj},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["statement"]["file_url"], "https://signed.example/test.xlsx")
        upload_file.assert_called_once()
        download_file.assert_called_once()
        create_signed_url.assert_called_once()
        self.assertTrue(BankStatement.objects.filter(merchant=self.merchant).exists())

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

    def test_adding_guarantor_updates_merchant_trust_score(self):
        guarantor = get_user_model().objects.create_user(
            phone="+9779800000999",
            password="DemoPass123!",
            role=User.Roles.MERCHANT,
        )
        self.authenticate(self.merchant)

        response = self.client.post(
            "/api/guarantors/",
            {"guarantor": guarantor.id, "vouch_strength": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Guarantor.objects.count(), 1)
        self.merchant.profile.refresh_from_db()
        self.assertGreater(self.merchant.profile.trust_score, 0)
        self.assertTrue(TrustScoreHistory.objects.filter(merchant=self.merchant).exists())

    def test_adding_standalone_guarantor_updates_merchant_trust_score(self):
        self.authenticate(self.merchant)

        response = self.client.post(
            "/api/guarantors/",
            {
                "guarantor_name": "Local Guarantor",
                "guarantor_phone": "9811111111",
                "guarantor_address": "Kathmandu",
                "relation": "Relative",
                "vouch_strength": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Guarantor.objects.count(), 1)
        created = Guarantor.objects.get()
        self.assertIsNone(created.guarantor)
        self.assertEqual(created.guarantor_name, "Local Guarantor")
        self.merchant.profile.refresh_from_db()
        self.assertGreater(self.merchant.profile.trust_score, 0)
        self.assertTrue(TrustScoreHistory.objects.filter(merchant=self.merchant).exists())

    def test_admin_delete_user_removes_related_secondary_data(self):
        self.authenticate(self.admin)

        other = get_user_model().objects.create_user(
            phone="+9779800000888",
            password="DemoPass123!",
            role=User.Roles.MERCHANT,
            is_active=True,
        )
        other.profile.name = "Delete Me"
        other.profile.region = "Kathmandu"
        other.profile.trade_type = "Retail"
        other.profile.address = "Some address"
        other.profile.save()

        Guarantor.objects.create(
            merchant=other,
            guarantor=self.merchant,
            guarantor_name="Linked Guarantor",
            guarantor_phone=self.merchant.phone,
            guarantor_address="Kathmandu",
            relation="Friend",
            vouch_strength=5,
        )
        PsychometricResponse.objects.create(
            merchant=other,
            trait="planning",
            score=70,
            responses_json={"answers": [4, 4, 4, 4, 4]},
        )
        BehavioralData.objects.create(
            merchant=other,
            data_type=BehavioralData.DataTypes.UTILITY,
            metrics_json={"score": 55},
            period_start="2026-05-01",
            period_end="2026-05-30",
        )
        BankStatement.objects.create(
            merchant=other,
            file_path="statement.pdf",
        )
        LoanApplication.objects.create(
            merchant=other,
            amount_requested="1000",
            purpose="Stock",
            trust_score_at_application=50,
        )
        TrustScoreHistory.objects.create(
            merchant=other,
            score=60,
            social_component=50,
            psychometric_component=70,
            behavioral_component=55,
            bank_impact=0,
            explanation="test",
        )

        response = self.client.delete(f"/api/admin/users/{other.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(get_user_model().objects.filter(id=other.id).exists())
        self.assertFalse(other.profile.__class__.objects.filter(user_id=other.id).exists())
        self.assertFalse(Guarantor.objects.filter(merchant_id=other.id).exists())
        self.assertFalse(PsychometricResponse.objects.filter(merchant_id=other.id).exists())
        self.assertFalse(BehavioralData.objects.filter(merchant_id=other.id).exists())
        self.assertFalse(BankStatement.objects.filter(merchant_id=other.id).exists())
        self.assertFalse(LoanApplication.objects.filter(merchant_id=other.id).exists())
        self.assertFalse(TrustScoreHistory.objects.filter(merchant_id=other.id).exists())
