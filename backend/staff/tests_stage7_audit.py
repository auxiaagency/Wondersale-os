import json
from decimal import Decimal
from django.test import TestCase, Client
from rest_framework import status

from staff.models import AttendanceAuditLog, StaffMember, StaffRole
from wondersale_core.middleware import RequestIDMiddleware


class AuditLoggingAndMonitoringTests(TestCase):
    """
    Stage 7 Tests:
    1. Verify X-Request-ID propagation across HTTP responses.
    2. Verify unprivileged health check endpoints.
    3. Verify AttendanceAuditLog append-only enforcement (forbids modification/deletion).
    """

    def setUp(self):
        self.client = Client()
        self.role = StaffRole.objects.create(name="Audit Admin", is_owner=True)
        self.staff = StaffMember.objects.create(
            name="Auditor",
            phone="9000011111",
            role=self.role,
            is_active=True
        )

    def test_request_id_header_injected_in_responses(self):
        """Verify that every response includes a non-empty X-Request-ID header."""
        res = self.client.get('/health/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('X-Request-ID', res.headers)
        self.assertTrue(len(res.headers['X-Request-ID']) > 10)

        # Pass custom request ID and verify it is preserved
        custom_id = "test-req-id-12345"
        res_custom = self.client.get('/health/', HTTP_X_REQUEST_ID=custom_id)
        self.assertEqual(res_custom.headers.get('X-Request-ID'), custom_id)

    def test_health_check_endpoint(self):
        """Verify health check returns status 200 with healthy indicators and no credentials."""
        for path in ['/health/', '/api/health/']:
            res = self.client.get(path)
            self.assertEqual(res.status_code, 200)
            data = json.loads(res.content.decode('utf-8'))
            self.assertEqual(data.get('status'), 'healthy')
            self.assertEqual(data.get('database'), 'connected')
            # Verify no secret or internal config is exposed
            self.assertNotIn('password', data)
            self.assertNotIn('secret', data)
            self.assertNotIn('host', data)

    def test_attendance_audit_log_immutability(self):
        """Verify AttendanceAuditLog is append-only and cannot be modified or deleted."""
        log = AttendanceAuditLog.objects.create(
            action="salary_advance_override",
            actor=self.staff,
            target_type="Employee",
            target_id="101",
            reason="Management verified hardship advance request",
            before_state={"advance": 0},
            after_state={"advance": 5000}
        )
        self.assertIsNotNone(log.pk)

        # Modification forbidden
        log.reason = "Tampered reason"
        with self.assertRaises(PermissionError):
            log.save()

        # Deletion forbidden
        with self.assertRaises(PermissionError):
            log.delete()
