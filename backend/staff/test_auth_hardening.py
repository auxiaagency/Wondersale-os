from django.test import TestCase, RequestFactory
from django.core.cache import cache
from staff.models import StaffRole, StaffMember, AttendanceAuditLog
from staff.services.rate_limit import is_rate_limited, record_failed_attempt, clear_failed_attempts
from staff.services.totp import (
    generate_totp_secret, get_totp_uri, verify_totp_code,
    generate_recovery_codes, verify_and_consume_recovery_code
)
import pyotp


class AuthenticationHardeningTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()
        self.role = StaffRole.objects.create(name='TestRole', is_owner=False)
        self.member = StaffMember.objects.create(
            staff_id='TEST_USER_01',
            name='Test Employee',
            role=self.role,
            is_active=True
        )
        self.member.set_password('StrongPassword123!')
        self.member.save()

    def test_argon2_password_hashing(self):
        self.assertTrue(self.member.password_hash.startswith('argon2'))
        self.assertTrue(self.member.check_password('StrongPassword123!'))
        self.assertFalse(self.member.check_password('WrongPassword'))

    def test_progressive_lockout_rate_limiter(self):
        req = self.factory.post('/api/staff/auth/login/', REMOTE_ADDR='192.168.1.100')
        
        # Initial check should not be locked
        locked, _ = is_rate_limited(req, 'TEST_USER_01')
        self.assertFalse(locked)

        # Record 5 failed attempts on account
        for _ in range(5):
            record_failed_attempt(req, 'TEST_USER_01')

        # Account should now be locked with the first timeout tier of 60 seconds
        locked, retry_after = is_rate_limited(req, 'TEST_USER_01')
        self.assertTrue(locked)
        self.assertGreater(retry_after, 0)
        self.assertLessEqual(retry_after, 60)

        # Clear failed attempts resets lockout
        clear_failed_attempts(req, 'TEST_USER_01')
        cache.delete(f"auth_lock_acc:test_user_01")
        locked, _ = is_rate_limited(req, 'TEST_USER_01')
        self.assertFalse(locked)

    def test_totp_generation_and_verification(self):
        secret = generate_totp_secret()
        self.assertTrue(len(secret) >= 16)
        
        uri = get_totp_uri(secret, 'TEST_USER_01')
        self.assertIn('otpauth://totp/', uri)
        self.assertIn('TEST_USER_01', uri)

        # Generate live TOTP token and verify
        token = pyotp.TOTP(secret).now()
        self.assertTrue(verify_totp_code(secret, token))
        self.assertFalse(verify_totp_code(secret, '000000'))

    def test_hashed_recovery_codes_consumption(self):
        plain_codes, hashed_codes = generate_recovery_codes(count=4)
        self.assertEqual(len(plain_codes), 4)
        self.assertEqual(len(hashed_codes), 4)

        # First code matches and is consumed
        first_code = plain_codes[0]
        valid, remaining = verify_and_consume_recovery_code(first_code, hashed_codes)
        self.assertTrue(valid)
        self.assertEqual(len(remaining), 3)

        # Second attempt with consumed code fails
        valid, remaining_again = verify_and_consume_recovery_code(first_code, remaining)
        self.assertFalse(valid)
        self.assertEqual(len(remaining_again), 3)

    def test_immediate_session_revocation_on_password_change(self):
        old_token = self.member.session_token
        self.member.set_password('BrandNewPassword123!')
        self.member.save()
        new_token = self.member.session_token
        self.assertNotEqual(old_token, new_token)
