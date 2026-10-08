"""
Security-hardened rate limiter for authentication endpoints.
Provides progressive lockout per IP and per username/staff_id using Django cache.
"""
import time
from django.core.cache import cache

# Progressive lockout durations:
# 1st lockout: 60 seconds (1 minute)
# 2nd lockout: 300 seconds (5 minutes)
# 3rd+ lockout: 600 seconds (10 minutes)
LOCKOUT_TIERS_SECONDS = [60, 300, 600]

MAX_ATTEMPTS_PER_IP = 10
LOCKOUT_TIME_IP_SECONDS = 60  # Initial 60 seconds for IP

MAX_ATTEMPTS_PER_ACCOUNT = 5
LOCKOUT_TIME_ACCOUNT_SECONDS = 60  # Initial 60 seconds for Account


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip


def is_rate_limited(request, identifier: str) -> tuple[bool, int]:
    """
    Checks if the IP or the given identifier (e.g. staff_id) is currently locked out.
    Returns (is_locked, retry_after_seconds).
    """
    ip = get_client_ip(request)
    now = time.time()

    # 1. Check IP lockout
    ip_lock_until = cache.get(f"auth_lock_ip:{ip}")
    if ip_lock_until and ip_lock_until > now:
        return True, int(ip_lock_until - now)

    # 2. Check Account lockout
    clean_id = (identifier or '').strip().lower()
    if clean_id:
        acc_lock_until = cache.get(f"auth_lock_acc:{clean_id}")
        if acc_lock_until and acc_lock_until > now:
            return True, int(acc_lock_until - now)

    return False, 0


def get_lockout_duration(tier_count: int) -> int:
    idx = min(tier_count, len(LOCKOUT_TIERS_SECONDS) - 1)
    return LOCKOUT_TIERS_SECONDS[idx]


def record_failed_attempt(request, identifier: str):
    """
    Increments failure counts for IP and account; triggers progressive lockout upon exceeding threshold.
    First lockout is 60 seconds only. Repeated lockouts escalate to 300s and 600s.
    """
    ip = get_client_ip(request)
    now = time.time()
    clean_id = (identifier or '').strip().lower()

    # Track IP failures
    ip_key = f"auth_fails_ip:{ip}"
    ip_fails = cache.get(ip_key, 0) + 1
    cache.set(ip_key, ip_fails, 600)
    if ip_fails >= MAX_ATTEMPTS_PER_IP:
        ip_tier_key = f"auth_tier_ip:{ip}"
        ip_tier = cache.get(ip_tier_key, 0)
        lock_duration = get_lockout_duration(ip_tier)
        cache.set(f"auth_lock_ip:{ip}", now + lock_duration, lock_duration)
        cache.set(ip_tier_key, ip_tier + 1, 3600)  # Remember escalation tier for 1 hour

    # Track Account failures
    if clean_id:
        acc_key = f"auth_fails_acc:{clean_id}"
        acc_fails = cache.get(acc_key, 0) + 1
        cache.set(acc_key, acc_fails, 900)
        if acc_fails >= MAX_ATTEMPTS_PER_ACCOUNT:
            acc_tier_key = f"auth_tier_acc:{clean_id}"
            acc_tier = cache.get(acc_tier_key, 0)
            lock_duration = get_lockout_duration(acc_tier)
            cache.set(f"auth_lock_acc:{clean_id}", now + lock_duration, lock_duration)
            cache.set(acc_tier_key, acc_tier + 1, 3600)  # Remember escalation tier for 1 hour


def clear_failed_attempts(request, identifier: str):
    """
    Clears failed counts and lockout tiers on successful authentication.
    """
    ip = get_client_ip(request)
    clean_id = (identifier or '').strip().lower()

    cache.delete(f"auth_fails_ip:{ip}")
    cache.delete(f"auth_tier_ip:{ip}")
    cache.delete(f"auth_lock_ip:{ip}")
    if clean_id:
        cache.delete(f"auth_fails_acc:{clean_id}")
        cache.delete(f"auth_tier_acc:{clean_id}")
        cache.delete(f"auth_lock_acc:{clean_id}")
