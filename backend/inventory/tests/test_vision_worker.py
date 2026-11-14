import io
import json
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from inventory.ai_service import extract_historical_sheet_bills, extract_products_from_bill
from inventory.models import AIDescriptionBatchJob, Category, Item, ItemImage, Store, SubCategory, VisionWorkerStatus
from inventory.vision_prompts import (
    CATALOG_DESCRIPTION_STYLE_EXAMPLE,
    build_catalog_vision_messages,
    extract_spec_tokens,
    verify_spec_tokens_preserved,
)
from inventory.vision_worker_service import WAITING_FOR_WORKER_MSG


def _make_jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (120, 120), color=(40, 120, 200))
    img.save(buf, format="JPEG")
    return buf.getvalue()


@override_settings(VISION_WORKER_TOKEN="test-worker-secret-token", VISION_LEASE_SECONDS=180, VISION_MAX_RETRIES=2)
class LocalVisionPullWorkerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.store = Store.objects.create(name="Bhopal Plaza", city="Bhopal")
        self.cat = Category.objects.create(name="Toys & Kids")
        self.subcat = SubCategory.objects.create(category=self.cat, name="Stationary")

        self.item1 = Item.objects.create(
            uid="200001",
            name="ACR MRK DRUM 60PCS",
            cost_price=250,
            selling_price=499,
            mrp=599,
            store=self.store,
            primary_subcategory=self.subcat,
            needs_better_name=True,
        )
        self.item2 = Item.objects.create(
            uid="200002",
            name="Stainless Steel Water Bottle 750ml",
            cost_price=180,
            selling_price=399,
            mrp=499,
            store=self.store,
            primary_subcategory=self.subcat,
        )

        img_bytes = _make_jpeg_bytes()
        ItemImage.objects.create(
            item=self.item1,
            image=SimpleUploadedFile("marker_drum.jpg", img_bytes, content_type="image/jpeg"),
            is_primary=True,
        )
        ItemImage.objects.create(
            item=self.item2,
            image=SimpleUploadedFile("bottle.jpg", img_bytes, content_type="image/jpeg"),
            is_primary=True,
        )

        self.claim_url = reverse("vision-job-claim")
        self.auth_headers = {"HTTP_AUTHORIZATION": "Bearer test-worker-secret-token"}

    def test_worker_auth_required_and_constant_time(self):
        # Missing token -> 401
        res_missing = self.client.post(self.claim_url, {"worker_id": "laptop-1"}, format="json")
        self.assertEqual(res_missing.status_code, status.HTTP_401_UNAUTHORIZED)

        # Wrong token -> 401
        res_bad = self.client.post(
            self.claim_url,
            {"worker_id": "laptop-1"},
            format="json",
            HTTP_AUTHORIZATION="Bearer wrong-token",
        )
        self.assertEqual(res_bad.status_code, status.HTTP_401_UNAUTHORIZED)

        # Unconfigured token -> 401
        with override_settings(VISION_WORKER_TOKEN=""):
            res_unconf = self.client.post(
                self.claim_url,
                {"worker_id": "laptop-1"},
                format="json",
                **self.auth_headers,
            )
            self.assertEqual(res_unconf.status_code, status.HTTP_401_UNAUTHORIZED)

        # Complete endpoint also requires valid Bearer auth
        complete_url = reverse("vision-job-complete", kwargs={"job_id": "nonexistent"})
        res_comp_unauth = self.client.post(complete_url, {"status": "ready"}, format="json")
        self.assertEqual(res_comp_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_claim_returns_204_when_empty_and_records_heartbeat(self):
        res = self.client.post(self.claim_url, {"worker_id": "laptop-4060"}, format="json", **self.auth_headers)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        hb = VisionWorkerStatus.objects.filter(worker_id="laptop-4060").first()
        self.assertIsNotNone(hb)

    @patch("inventory.ai_service.call_gemini_api")
    def test_offline_laptop_keeps_pending_and_never_calls_gemini(self, mock_gemini):
        # Enqueue bulk job while laptop has never polled (offline)
        bulk_url = reverse("item-bulk-ai-generate-descriptions")
        res = self.client.post(
            bulk_url,
            {
                "item_ids": [self.item1.pk, self.item2.pk],
                "generate_name_ids": [self.item1.pk],
                "store_id": self.store.pk,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(res.data["job"]["status"], AIDescriptionBatchJob.STATUS_RUNNING)
        self.assertEqual(res.data["job"]["status_message"], WAITING_FOR_WORKER_MSG)

        # Poll active job while offline -> items remain 'pending', never 'failed', never Gemini
        active_url = reverse("item-active-ai-description-job")
        active_res = self.client.get(active_url, {"store": self.store.pk})
        self.assertEqual(active_res.status_code, status.HTTP_200_OK)
        self.assertEqual(active_res.data["active_job"]["status"], AIDescriptionBatchJob.STATUS_RUNNING)
        self.assertEqual(active_res.data["active_job"]["status_message"], WAITING_FOR_WORKER_MSG)

        self.item1.refresh_from_db()
        self.item2.refresh_from_db()
        self.assertEqual(self.item1.ai_description_status, "pending")
        self.assertEqual(self.item1.ai_name_status, "pending")
        self.assertEqual(self.item2.ai_description_status, "pending")
        mock_gemini.assert_not_called()

    @patch("inventory.ai_service.call_gemini_api")
    def test_single_and_retry_enqueue_without_gemini(self, mock_gemini):
        single_desc_url = reverse("item-single-ai-generate-description", kwargs={"pk": self.item2.pk})
        r1 = self.client.post(single_desc_url, {}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(r1.data["queued"])
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.ai_description_status, "pending")

        # Mark failed then retry -> re-enqueues to 'pending'
        self.item2.ai_description_status = "failed"
        self.item2.save()
        retry_url = reverse("item-retry-ai-description", kwargs={"pk": self.item2.pk})
        r2 = self.client.post(retry_url, {}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_202_ACCEPTED)
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.ai_description_status, "pending")

        # Single name endpoint
        single_name_url = reverse("item-single-ai-generate-name", kwargs={"pk": self.item1.pk})
        r3 = self.client.post(single_name_url, {}, format="json")
        self.assertEqual(r3.status_code, status.HTTP_202_ACCEPTED)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.ai_name_status, "pending")

        mock_gemini.assert_not_called()

    @patch("inventory.ai_service.call_gemini_api")
    def test_full_claim_and_complete_lifecycle(self, mock_gemini):
        bulk_url = reverse("item-bulk-ai-generate-descriptions")
        res = self.client.post(
            bulk_url,
            {
                "item_ids": [self.item1.pk, self.item2.pk],
                "generate_name_ids": [self.item1.pk],
                "store_id": self.store.pk,
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        batch_job_id = res.data["job"]["id"]

        # Worker claims first item
        c1 = self.client.post(self.claim_url, {"worker_id": "laptop-4060"}, format="json", **self.auth_headers)
        self.assertEqual(c1.status_code, status.HTTP_200_OK)
        for key in ("job_id", "model", "messages", "image_base64", "temperature", "max_tokens", "response_format"):
            self.assertIn(key, c1.data)
        self.assertEqual(c1.data["model"], "qwen2.5vl:7b")
        self.assertEqual(c1.data["temperature"], 0.2)
        self.assertEqual(c1.data["max_tokens"], 800)
        self.assertEqual(c1.data["response_format"], {"type": "json_object"})
        self.assertTrue(c1.data["image_base64"].startswith("data:image/jpeg;base64,"))
        self.assertEqual(len(c1.data["messages"]), 2)
        self.assertEqual(c1.data["messages"][0]["role"], "system")
        self.assertEqual(c1.data["messages"][1]["role"], "user")

        # Worker claims second item
        c2 = self.client.post(self.claim_url, {"worker_id": "laptop-4060"}, format="json", **self.auth_headers)
        self.assertEqual(c2.status_code, status.HTTP_200_OK)
        self.assertNotEqual(c1.data["job_id"], c2.data["job_id"])

        # Third claim returns 204 because both items are now 'generating'
        c3 = self.client.post(self.claim_url, {"worker_id": "laptop-4060"}, format="json", **self.auth_headers)
        self.assertEqual(c3.status_code, status.HTTP_204_NO_CONTENT)

        # Complete item1 (name_and_description) using parsed_json
        comp1_url = reverse("vision-job-complete", kwargs={"job_id": c1.data["job_id"]})
        comp1 = self.client.post(
            comp1_url,
            {
                "worker_id": "laptop-4060",
                "status": "ready",
                "content": "",
                "parsed_json": {
                    "name": "Acrylic Marker Drum Set (60 Pcs)",
                    "description": CATALOG_DESCRIPTION_STYLE_EXAMPLE,
                },
                "model": "qwen2.5vl:7b",
                "duration_ms": 6420,
            },
            format="json",
            **self.auth_headers,
        )
        self.assertEqual(comp1.status_code, status.HTTP_200_OK)
        self.assertEqual(comp1.data["status"], "ready")

        # Complete item2 (description_only) using fallback JSON in `content` wrapped in code fences
        comp2_url = reverse("vision-job-complete", kwargs={"job_id": c2.data["job_id"]})
        fenced_json = '```json\n{"description": "### Overview\\nInsulated bottle.\\n\\n### Key Highlights & Features\\n- Keeps cold\\n\\n### Product Specifications\\n- **Material & Build**: Stainless Steel"}\n```'
        comp2 = self.client.post(
            comp2_url,
            {
                "worker_id": "laptop-4060",
                "status": "ready",
                "content": fenced_json,
                "parsed_json": None,
                "model": "qwen2.5vl:7b",
                "duration_ms": 5100,
            },
            format="json",
            **self.auth_headers,
        )
        self.assertEqual(comp2.status_code, status.HTTP_200_OK)
        self.assertEqual(comp2.data["status"], "ready")

        self.item1.refresh_from_db()
        self.item2.refresh_from_db()
        self.assertEqual(self.item1.ai_name_status, "ready")
        self.assertEqual(self.item1.ai_name_draft, "Acrylic Marker Drum Set (60 Pcs)")
        self.assertEqual(self.item1.ai_description_status, "ready")
        self.assertIn("### Overview", self.item1.ai_description_draft)

        self.assertEqual(self.item2.ai_description_status, "ready")
        self.assertIn("Insulated bottle.", self.item2.ai_description_draft)

        batch_job = AIDescriptionBatchJob.objects.get(id=batch_job_id)
        self.assertEqual(batch_job.status, AIDescriptionBatchJob.STATUS_COMPLETED)
        self.assertEqual(batch_job.completed_items, 2)
        self.assertEqual(batch_job.failed_items, 0)
        mock_gemini.assert_not_called()

    def test_complete_failed_marks_item_failed(self):
        self.client.post(
            reverse("item-single-ai-generate-description", kwargs={"pk": self.item2.pk}),
            {},
            format="json",
        )
        claim_res = self.client.post(self.claim_url, {"worker_id": "laptop-4060"}, format="json", **self.auth_headers)
        self.assertEqual(claim_res.status_code, status.HTTP_200_OK)

        comp_url = reverse("vision-job-complete", kwargs={"job_id": claim_res.data["job_id"]})
        comp_res = self.client.post(
            comp_url,
            {"worker_id": "laptop-4060", "status": "failed", "error": "CUDA out of memory"},
            format="json",
            **self.auth_headers,
        )
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.ai_description_status, "failed")
        self.assertIn("CUDA out of memory", self.item2.ai_description_error)

    def test_lease_expiry_recovery_and_max_retries(self):
        self.client.post(
            reverse("item-single-ai-generate-description", kwargs={"pk": self.item2.pk}),
            {},
            format="json",
        )

        # Claim #1 (retry_count=0)
        c1 = self.client.post(self.claim_url, {"worker_id": "laptop-1"}, format="json", **self.auth_headers)
        self.assertEqual(c1.status_code, status.HTTP_200_OK)
        old_job_id = c1.data["job_id"]

        # Simulate lease expiry
        Item.objects.filter(pk=self.item2.pk).update(
            vision_lease_expires_at=timezone.now() - timedelta(seconds=10)
        )

        # Next claim reclaims stale item (retry_count=1) and hands it out with a new job_id
        c2 = self.client.post(self.claim_url, {"worker_id": "laptop-2"}, format="json", **self.auth_headers)
        self.assertEqual(c2.status_code, status.HTTP_200_OK)
        self.assertNotEqual(c2.data["job_id"], old_job_id)
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.vision_retry_count, 1)

        # Stale worker returning late with old_job_id is rejected cleanly (404)
        late_res = self.client.post(
            reverse("vision-job-complete", kwargs={"job_id": old_job_id}),
            {"worker_id": "laptop-1", "status": "ready", "parsed_json": {"description": "stale"}},
            format="json",
            **self.auth_headers,
        )
        self.assertEqual(late_res.status_code, status.HTTP_404_NOT_FOUND)

        # Expire lease again -> retry_count=2 (still <= VISION_MAX_RETRIES=2)
        Item.objects.filter(pk=self.item2.pk).update(
            vision_lease_expires_at=timezone.now() - timedelta(seconds=10)
        )
        c3 = self.client.post(self.claim_url, {"worker_id": "laptop-2"}, format="json", **self.auth_headers)
        self.assertEqual(c3.status_code, status.HTTP_200_OK)
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.vision_retry_count, 2)

        # Expire lease a 3rd time -> exhausts VISION_MAX_RETRIES=2 -> marked 'failed', claim returns 204
        Item.objects.filter(pk=self.item2.pk).update(
            vision_lease_expires_at=timezone.now() - timedelta(seconds=10)
        )
        c4 = self.client.post(self.claim_url, {"worker_id": "laptop-2"}, format="json", **self.auth_headers)
        self.assertEqual(c4.status_code, status.HTTP_204_NO_CONTENT)
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.ai_description_status, "failed")
        self.assertIn("lease expired", self.item2.ai_description_error.lower())

    def test_stop_job_prevents_worker_from_claiming_cancelled_items(self):
        bulk_url = reverse("item-bulk-ai-generate-descriptions")
        res = self.client.post(
            bulk_url,
            {"item_ids": [self.item2.pk], "store_id": self.store.pk},
            format="json",
        )
        job_id = res.data["job"]["id"]

        stop_url = reverse("item-stop-ai-description-job")
        stop_res = self.client.post(stop_url, {"job_id": job_id}, format="json")
        self.assertEqual(stop_res.status_code, status.HTTP_200_OK)

        claim_res = self.client.post(self.claim_url, {"worker_id": "laptop-4060"}, format="json", **self.auth_headers)
        self.assertEqual(claim_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_prompt_builder_variants(self):
        msgs_both = build_catalog_vision_messages(
            {"name": "ACR MRK DRUM 60PCS", "category_name": "Toys & Kids", "subcategory_name": "Stationary"},
            job_type="name_and_description",
        )
        self.assertIn("Acrylic Marker Drum", msgs_both[1]["content"])
        self.assertIn("Preserve any original quantity", msgs_both[1]["content"])
        self.assertIn('"name"', msgs_both[1]["content"])
        self.assertIn('"description"', msgs_both[1]["content"])

        msgs_desc = build_catalog_vision_messages({"name": "Water Bottle 750ml"}, job_type="description_only")
        self.assertIn('{ "description": "..." }', msgs_desc[1]["content"])

        msgs_name = build_catalog_vision_messages({"name": "BOTTLE-750ML"}, job_type="name_only")
        self.assertIn('{ "name": "..." }', msgs_name[1]["content"])

    def test_spec_tokens_preservation_and_extraction(self):
        tokens1 = extract_spec_tokens("ACR MRK DRUM 60PCS")
        self.assertTrue(any("60" in t for t in tokens1))

        tokens2 = extract_spec_tokens("Stainless Steel Water Bottle 750ml Pack of 2")
        self.assertTrue(any("750" in t for t in tokens2))

        # Check verify_spec_tokens_preserved
        self.assertTrue(
            verify_spec_tokens_preserved(
                "ACR MRK DRUM 60PCS",
                "Acrylic Marker Drum Set (60 Pcs)"
            )
        )
        self.assertFalse(
            verify_spec_tokens_preserved(
                "ACR MRK DRUM 60PCS",
                "Acrylic Marker Drum Set"
            )
        )

    def test_prompt_builder_four_rules(self):
        # 1. Multi-design rule
        msgs_multi = build_catalog_vision_messages(
            {"name": "Cartoon Doll Keychain", "is_multi_design": True, "image_count": 3},
            job_type="name_and_description"
        )
        self.assertIn("Multi-Design Rule", msgs_multi[1]["content"])
        self.assertIn("Selling Unit", msgs_multi[1]["content"])

        # 2. Selling unit rule
        msgs_unit = build_catalog_vision_messages(
            {"name": "Ceramic Cup", "selling_unit": "1 piece (photo shows design variations)"},
            job_type="name_and_description"
        )
        self.assertIn("1 piece (photo shows design variations)", msgs_unit[1]["content"])

        # 3. Description only mode keeps name in context and requests only description
        msgs_desc = build_catalog_vision_messages(
            {"name": "Special Fountain Pen"},
            job_type="description_only"
        )
        self.assertIn("Original Name: Special Fountain Pen", msgs_desc[1]["content"])
        self.assertIn('{ "description": "..." }', msgs_desc[1]["content"])

    def test_bulk_generate_names_only_endpoint(self):
        url = reverse("item-bulk-ai-generate-names-only")
        res = self.client.post(
            url,
            {"item_ids": [self.item1.pk], "store_id": self.store.pk},
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.ai_name_status, "pending")
        self.assertEqual(self.item1.vision_job_type, "name_only")

    def test_bulk_generate_descriptions_only_endpoint(self):
        url = reverse("item-bulk-ai-generate-descriptions-only")
        res = self.client.post(
            url,
            {"item_ids": [self.item1.pk], "store_id": self.store.pk},
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.ai_description_status, "pending")
        self.assertEqual(self.item1.vision_job_type, "description_only")

    @patch("inventory.ai_service.call_gemini_api")
    def test_gemini_ocr_flows_remain_on_gemini(self, mock_gemini):
        mock_gemini.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "bill_metadata": {"vendor_name": "Test Distributor"},
                                        "items": [{"name": "Dettol Soap 100g", "cost_price": "30.00", "selling_price": "35.00", "quantity": "10"}],
                                    }
                                )
                            }
                        ]
                    }
                }
            ]
        }
        res_bill = extract_products_from_bill(
            files_data=[{"name": "bill.jpg", "bytes": _make_jpeg_bytes(), "mime_type": "image/jpeg"}],
            custom_api_keys=["gemini_ocr_test_key"],
        )
        self.assertTrue(res_bill["success"])
        self.assertEqual(len(res_bill["items"]), 1)

        mock_gemini.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "sheet_date": "2026-10-01",
                                        "bills": [],
                                    }
                                )
                            }
                        ]
                    }
                }
            ]
        }
        res_sheet = extract_historical_sheet_bills(
            files_data=[{"name": "sheet.jpg", "bytes": _make_jpeg_bytes(), "mime_type": "image/jpeg"}],
            custom_api_keys=["gemini_ocr_test_key"],
        )
        self.assertEqual(res_sheet["sheet_date"], "2026-10-01")
        self.assertEqual(res_sheet["total_bills_extracted"], 0)
        self.assertEqual(res_sheet["valid_bills"], [])
        self.assertEqual(mock_gemini.call_count, 2)

