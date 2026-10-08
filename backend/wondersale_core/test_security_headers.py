from django.test import TestCase, Client

class ProductionSecurityDeploymentTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_security_headers_present(self):
        resp = self.client.get('/api/inventory/categories/')
        self.assertEqual(resp.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(resp.headers.get('Cross-Origin-Opener-Policy'), 'same-origin')
        self.assertEqual(resp.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
        self.assertIn('geolocation=()', resp.headers.get('Permissions-Policy', ''))
        self.assertTrue('Content-Security-Policy' in resp.headers)

    def test_custom_error_handlers_leak_no_debug_info(self):
        resp = self.client.get('/nonexistent-route-for-security-test-404/')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.headers.get('Content-Type'), 'application/json')
        self.assertIn(b'not_found', resp.content)
