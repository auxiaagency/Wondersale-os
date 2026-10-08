import json
from unittest.mock import patch, MagicMock
import urllib.error
from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from inventory.ai_service import (
    extract_products_from_bill,
    test_gemini_api_key,
)


class AIServiceUnitTests(TestCase):
    @patch('inventory.ai_service.call_gemini_api')
    def test_extract_products_from_bill_success(self, mock_gemini):
        mock_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "bill_metadata": {
                                        "vendor_name": "Sharma Wholesale",
                                        "total_amount": "1350.00"
                                    },
                                    "items": [
                                        {
                                            "name": "Tata Tea Gold 500g",
                                            "cost_price": "210.00",
                                            "selling_price": "250.00",
                                            "quantity": "5",
                                            "mrp": "260.00",
                                            "category_or_subcategory": "Beverages",
                                            "location_section": "Rack 1",
                                            "confidence": {
                                                "name": 0.95,
                                                "cost_price": 0.90,
                                                "selling_price": 0.85,
                                                "quantity": 0.60,
                                                "mrp": 0.90,
                                                "overall": 0.84
                                            },
                                            "warnings": [
                                                "Quantity 5 was slightly smudged; inferred from total"
                                            ]
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_gemini.return_value = mock_response

        files_data = [{
            "name": "bill.jpg",
            "bytes": b"fake_image_bytes",
            "mime_type": "image/jpeg"
        }]

        result = extract_products_from_bill(
            files_data=files_data,
            custom_api_keys=["custom_test_key_123"],
            available_subcategories=[{"id": 1, "name": "Beverages"}]
        )

        self.assertTrue(result['success'])
        self.assertEqual(result['items_count'], 1)
        item = result['items'][0]
        self.assertEqual(item['name'], "Tata Tea Gold 500g")
        self.assertEqual(item['cost_price'], "210.00")
        self.assertEqual(item['quantity'], "5")
        self.assertEqual(item['confidence']['quantity'], 0.60)
        self.assertEqual(len(item['warnings']), 1)
        self.assertEqual(item['matched_subcategories'], [1])

    @patch('inventory.ai_service.call_gemini_api')
    def test_extract_products_with_custom_request_override(self, mock_gemini):
        mock_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "bill_metadata": {},
                                    "items": [
                                        {
                                            "name": "Custom Item 1",
                                            "cost_price": "100.00",
                                            "selling_price": "115.00",
                                            "quantity": "2",
                                            "confidence": {"name": 0.9, "cost_price": 0.9, "selling_price": 0.9}
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            ]
        }
        mock_gemini.return_value = mock_response

        files_data = [{
            "name": "bill.jpg",
            "bytes": b"fake_image_bytes",
            "mime_type": "image/jpeg"
        }]

        custom_req = "Do not extract selling price directly from bill; calculate selling price as cost price + 15%."
        result = extract_products_from_bill(
            files_data=files_data,
            custom_api_keys=["custom_test_key_123"],
            custom_request=custom_req
        )

        self.assertTrue(result['success'])
        self.assertEqual(result['items_count'], 1)
        # Verify call_gemini_api was called with prompt parts containing the custom request and precedence rule
        call_args = mock_gemini.call_args
        parts = call_args[0][1]
        text_parts = [p.get('text', '') for p in parts if 'text' in p]
        combined_text = ' '.join(text_parts)
        self.assertIn("SPECIAL USER CUSTOM INSTRUCTIONS & OVERRIDES (HIGHEST PRIORITY)", combined_text)
        self.assertIn(custom_req, combined_text)
        self.assertIn("HIGHEST PRIORITY", combined_text)

    @patch('inventory.ai_service.call_gemini_api')
    def test_multi_key_rotation_on_quota_error(self, mock_gemini):
        # First key fails with 429 quota limit, second key succeeds
        http_error_429 = urllib.error.HTTPError(
            url="http://test",
            code=429,
            msg="Too Many Requests",
            hdrs={},
            fp=MagicMock(read=lambda: b'{"error": "RESOURCE_EXHAUSTED"}')
        )

        mock_success_response = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps({
                                    "items": [
                                        {
                                            "name": "Parle-G 100g",
                                            "cost_price": "10.00",
                                            "selling_price": "12.00",
                                            "quantity": "50",
                                            "confidence": {"name": 0.95, "quantity": 0.95}
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            ]
        }

        mock_gemini.side_effect = [http_error_429, mock_success_response]

        files_data = [{"name": "bill.jpg", "bytes": b"fake_bytes", "mime_type": "image/jpeg"}]
        result = extract_products_from_bill(
            files_data=files_data,
            custom_api_keys=["failing_key_1", "backup_key_2"]
        )

        self.assertTrue(result['success'])
        self.assertEqual(result['items_count'], 1)
        self.assertEqual(result['ai_stats']['key_index_used'], 2)

    @patch('inventory.ai_service.call_gemini_api')
    def test_all_keys_quota_exhausted(self, mock_gemini):
        http_error_429 = urllib.error.HTTPError(
            url="http://test",
            code=429,
            msg="Too Many Requests",
            hdrs={},
            fp=MagicMock(read=lambda: b'{"error": "Quota Exceeded"}')
        )
        mock_gemini.side_effect = http_error_429

        files_data = [{"name": "bill.jpg", "bytes": b"fake_bytes", "mime_type": "image/jpeg"}]
        with self.assertRaises(RuntimeError) as ctx:
            extract_products_from_bill(
                files_data=files_data,
                custom_api_keys=["exhausted_key_1"]
            )

        err_data = json.loads(str(ctx.exception))
        self.assertTrue(err_data['quota_exhausted'])

    def test_resolve_ditto_marks(self):
        from inventory.ai_service import resolve_ditto_marks
        raw_items = [
            {
                "name": "Amul Butter 100g",
                "cost_price": "55.00",
                "selling_price": "60.00",
                "quantity": "20",
                "mrp": "60.00",
                "category_or_subcategory": "Dairy",
                "location_section": "Fridge 1"
            },
            {
                "name": '" 500g',
                "cost_price": "240.00",
                "selling_price": "260.00",
                "quantity": "10",
                "mrp": "265.00",
                "category_or_subcategory": '"',
                "location_section": '"'
            },
            {
                "name": '"',
                "cost_price": '"',
                "selling_price": '"',
                "quantity": "5",
                "mrp": '"',
                "category_or_subcategory": '-do-',
                "location_section": 'ditto'
            },
            {
                "name": ',, 200g',
                "cost_price": '110.00',
                "selling_price": '125.00',
                "quantity": '15',
                "mrp": None,
                "category_or_subcategory": 'Dairy',
                "location_section": 'Fridge 1'
            }
        ]

        resolved = resolve_ditto_marks(raw_items)
        self.assertEqual(len(resolved), 4)
        # Item 1 unchanged
        self.assertEqual(resolved[0]['name'], "Amul Butter 100g")
        # Item 2 inherited brand + new size & ditto category/location
        self.assertEqual(resolved[1]['name'], "Amul Butter 500g")
        self.assertEqual(resolved[1]['category_or_subcategory'], "Dairy")
        self.assertEqual(resolved[1]['location_section'], "Fridge 1")
        # Item 3 copied full name, prices, mrp, category, location
        self.assertEqual(resolved[2]['name'], "Amul Butter 500g")
        self.assertEqual(resolved[2]['cost_price'], "240.00")
        self.assertEqual(resolved[2]['selling_price'], "260.00")
        self.assertEqual(resolved[2]['mrp'], "265.00")
        self.assertEqual(resolved[2]['category_or_subcategory'], "Dairy")
        self.assertEqual(resolved[2]['location_section'], "Fridge 1")
        # Item 4 inherited brand with ,,
        self.assertEqual(resolved[3]['name'], "Amul Butter 200g")

    @patch('inventory.ai_service.call_gemini_api')
    def test_test_gemini_api_key_valid(self, mock_gemini):
        mock_gemini.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": json.dumps({"status": "ok"})}]
                }
            }]
        }
        res = test_gemini_api_key("valid_api_key_test")
        self.assertTrue(res['valid'])
        self.assertEqual(res['status'], 'ok')


class AIApiEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch('inventory.views.extract_products_from_bill')
    def test_extract_from_bill_endpoint(self, mock_extract):
        mock_extract.return_value = {
            "success": True,
            "items_count": 1,
            "items": [{
                "name": "Amul Butter 500g",
                "cost_price": "240.00",
                "selling_price": "275.00",
                "quantity": "10",
                "confidence": {"name": 0.95, "quantity": 0.85},
                "warnings": []
            }],
            "bill_metadata": {},
            "ai_stats": {"model_used": "gemini-1.5-flash", "key_index_used": 1}
        }

        url = reverse('item-extract-from-bill')
        test_file = SimpleUploadedFile("bill.jpg", b"fake_bill_content", content_type="image/jpeg")

        response = self.client.post(
            url,
            {'files': [test_file], 'custom_request': 'Do not extract selling price'},
            format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['name'], "Amul Butter 500g")
        mock_extract.assert_called_once()
        self.assertEqual(mock_extract.call_args[1].get('custom_request'), 'Do not extract selling price')

    @patch('inventory.views.test_gemini_api_key')
    def test_test_gemini_key_endpoint(self, mock_test):
        mock_test.return_value = {
            "valid": True,
            "model": "gemini-1.5-flash",
            "message": "Connected successfully (gemini-1.5-flash)."
        }

        url = reverse('item-test-gemini-key')
        response = self.client.post(url, {'api_key': 'test_key_123'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])


class AIDescriptionServiceAndEndpointTests(TestCase):
    def setUp(self):
        from inventory.models import Store, Category, SubCategory, Item, ItemImage, AIDescriptionBatchJob
        self.client = APIClient()
        self.store = Store.objects.create(name="Wonder Store", city="Indore")
        self.cat = Category.objects.create(name="Apparel")
        self.subcat = SubCategory.objects.create(category=self.cat, name="Shirts")
        self.item1 = Item.objects.create(
            uid="1000001",
            name="Classic Cotton Oxford Shirt",
            cost_price=400,
            selling_price=799,
            mrp=999,
            store=self.store,
            primary_subcategory=self.subcat
        )
        self.item2 = Item.objects.create(
            uid="1000002",
            name="Denim Jeans Regular Fit",
            cost_price=700,
            selling_price=1299,
            mrp=1499,
            store=self.store,
            primary_subcategory=self.subcat
        )

        # Upload a dummy image for item1
        img_file = SimpleUploadedFile("shirt.jpg", b"fake_jpeg_data", content_type="image/jpeg")
        self.img1 = ItemImage.objects.create(item=self.item1, image=img_file, is_primary=True)

    @patch('inventory.ai_service.call_gemini_api')
    def test_generate_product_description(self, mock_gemini):
        from inventory.ai_service import generate_product_description

        mock_markdown = "### Overview\nPremium 100% cotton oxford shirt.\n\n### Key Highlights\n- Breathable fabric\n- Classic fit"
        mock_gemini.return_value = {
            "candidates": [{
                "content": {
                    "parts": [{"text": f"```markdown\n{mock_markdown}\n```"}]
                }
            }]
        }

        res = generate_product_description(
            image_bytes=b"fake_image_bytes",
            mime_type="image/jpeg",
            item_data={"name": "Classic Cotton Oxford Shirt", "selling_price": "799"},
            custom_api_keys=["custom_desc_key"]
        )

        self.assertTrue(res['success'])
        self.assertIn("Premium 100% cotton oxford shirt", res['description'])
        self.assertFalse(res['description'].startswith("```"))

    @patch('inventory.views.generate_product_description')
    def test_single_ai_generate_description_endpoint(self, mock_gen):
        mock_gen.return_value = {
            "success": True,
            "description": "### Overview\nGreat quality shirt.\n\n### Key Highlights\n- Soft cotton",
            "model_used": "gemini-2.0-flash"
        }

        url = reverse('item-single-ai-generate-description', kwargs={'pk': self.item1.pk})
        response = self.client.post(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['description'], "### Overview\nGreat quality shirt.\n\n### Key Highlights\n- Soft cotton")

        self.item1.refresh_from_db()
        self.assertEqual(self.item1.ai_description_status, 'ready')
        self.assertIn("Great quality shirt", self.item1.ai_description_draft)

    def test_single_ai_generate_description_no_image(self):
        # item2 has no images uploaded
        url = reverse('item-single-ai-generate-description', kwargs={'pk': self.item2.pk})
        response = self.client.post(url, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.item2.refresh_from_db()
        self.assertEqual(self.item2.ai_description_status, 'skipped_no_image')

    def test_apply_ai_description_endpoint(self):
        self.item1.ai_description_draft = "### Overview\nReady to be applied draft."
        self.item1.ai_description_status = 'ready'
        self.item1.save()

        url = reverse('item-apply-ai-description', kwargs={'pk': self.item1.pk})
        response = self.client.post(url, {'description': "### Overview\nUser edited and applied."}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.description, "### Overview\nUser edited and applied.")
        self.assertEqual(self.item1.ai_description_status, 'applied')

    @patch('inventory.views.start_background_batch_description_job')
    def test_bulk_ai_generate_descriptions_endpoint(self, mock_start_job):
        url = reverse('item-bulk-ai-generate-descriptions')
        response = self.client.post(url, {
            'item_ids': [self.item1.pk, self.item2.pk],
            'store_id': self.store.pk
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['success'])
        job_data = response.data['job']
        self.assertEqual(job_data['total_items'], 2)
        mock_start_job.assert_called_once()

    def test_bulk_apply_ai_descriptions_endpoint(self):
        self.item1.ai_description_draft = "Description for item 1"
        self.item1.ai_description_status = 'ready'
        self.item1.save()

        self.item2.ai_description_draft = "Description for item 2"
        self.item2.ai_description_status = 'ready'
        self.item2.save()

        url = reverse('item-bulk-apply-ai-descriptions')
        response = self.client.post(url, {'item_ids': [self.item1.pk, self.item2.pk]}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['applied_count'], 2)

        self.item1.refresh_from_db()
        self.item2.refresh_from_db()
        self.assertEqual(self.item1.description, "Description for item 1")
        self.assertEqual(self.item1.ai_description_status, 'applied')
        self.assertEqual(self.item2.description, "Description for item 2")
        self.assertEqual(self.item2.ai_description_status, 'applied')

    @patch('time.sleep', return_value=None)
    @patch('inventory.ai_service.generate_product_description')
    def test_process_ai_description_batch_job_minute_pause_and_retry(self, mock_gen, mock_sleep):
        from inventory.models import AIDescriptionBatchJob
        from inventory.ai_service import process_ai_description_batch_job, GeminiRateLimitError

        job = AIDescriptionBatchJob.objects.create(
            store=self.store,
            total_items=1,
            item_ids=[self.item1.pk]
        )

        # First call raises minute rate limit error, second call succeeds
        mock_gen.side_effect = [
            GeminiRateLimitError("Minute rate limit reached", is_daily=False),
            {"success": True, "description": "### Overview\nGenerated after 1min pause.", "model_used": "gemini-flash-lite-latest"}
        ]

        process_ai_description_batch_job(str(job.id))

        mock_sleep.assert_any_call(60)
        self.item1.refresh_from_db()
        self.assertEqual(self.item1.ai_description_status, 'ready')
        self.assertIn("Generated after 1min pause", self.item1.ai_description_draft)

        job.refresh_from_db()
        self.assertEqual(job.completed_items, 1)
        self.assertEqual(job.status, AIDescriptionBatchJob.STATUS_COMPLETED)

    @patch('inventory.ai_service.generate_product_description')
    def test_process_ai_description_batch_job_daily_quota_exhaustion(self, mock_gen):
        from inventory.models import AIDescriptionBatchJob
        from inventory.ai_service import process_ai_description_batch_job, GeminiRateLimitError

        job = AIDescriptionBatchJob.objects.create(
            store=self.store,
            total_items=2,
            item_ids=[self.item1.pk, self.item2.pk]
        )

        # First item hits daily quota
        mock_gen.side_effect = GeminiRateLimitError("Daily AI quota exhausted", is_daily=True)

        process_ai_description_batch_job(str(job.id))

        self.item1.refresh_from_db()
        self.item2.refresh_from_db()
        self.assertEqual(self.item1.ai_description_status, 'failed')
        self.assertIn("Daily AI quota exhausted", self.item1.ai_description_error)
        self.assertEqual(self.item2.ai_description_status, 'failed')
        self.assertIn("Daily AI quota exhausted", self.item2.ai_description_error)

        job.refresh_from_db()
        self.assertEqual(job.status, AIDescriptionBatchJob.STATUS_COMPLETED)
        self.assertEqual(job.failed_items, 2)
        self.assertIn("Daily AI quota", job.status_message)

