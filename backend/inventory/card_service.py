"""
Universal RFID / VIP Card Ownership and Inspection Service.
Enforces strict cross-domain uniqueness between Employee Attendance Cards and Customer VIP Cards.
"""

from typing import Any
from django.utils import timezone


def normalize_card_uid(raw_uid: str) -> str:
    """Normalizes card UID to trimmed uppercase string."""
    if not raw_uid:
        return ""
    clean = str(raw_uid).strip()
    for prefix in ('card uid:', 'card_uid:', 'uid:', 'card:', 'rfid:'):
        if clean.lower().startswith(prefix):
            clean = clean[len(prefix):].strip()
    return clean.upper()


def inspect_card_ownership(raw_uid: str) -> dict[str, Any]:
    """
    Inspects a card UID across both Employee RFID cards and Customer VIP cards.
    Returns comprehensive metadata, assignment status, and cross-domain ownership details.
    """
    from staff.models import RFIDCard
    from inventory.models import Customer

    norm_uid = normalize_card_uid(raw_uid)
    if not norm_uid:
        return {
            'success': False,
            'card_uid': '',
            'is_assigned': False,
            'assigned_type': 'none',
            'employee': None,
            'customer': None,
            'message': 'No card UID provided.'
        }

    # 1. Search active Employee cards
    emp_card = RFIDCard.objects.filter(
        card_uid__iexact=norm_uid,
        status=RFIDCard.STATUS_ACTIVE
    ).select_related('employee', 'employee__store').first()

    # 2. Search active Customer VIP cards
    customer = Customer.objects.filter(
        vip_card_uid__iexact=norm_uid,
        vip_card_status='active'
    ).select_related('store').first()

    emp_data = None
    if emp_card and emp_card.employee:
        emp = emp_card.employee
        emp_data = {
            'id': emp.id,
            'name': emp.name,
            'employee_code': emp.employee_code,
            'store_id': emp.store_id,
            'store_name': emp.store.name if emp.store else None,
            'department': emp.department,
            'designation': emp.designation,
            'phone': emp.phone,
            'photo_url': emp.photo.url if emp.photo else None,
            'is_active': emp.is_active,
            'card_status': emp_card.status,
            'assigned_at': emp_card.assigned_at.isoformat() if emp_card.assigned_at else None,
        }

    cust_data = None
    if customer:
        cust_data = {
            'id': customer.id,
            'name': customer.name,
            'phone': customer.phone,
            'display_name': customer.display_name,
            'store_id': customer.store_id,
            'store_name': customer.store.name if customer.store else None,
            'vip_tier': getattr(customer, 'vip_tier', 'VIP Member') or 'VIP Member',
            'vip_card_balance': str(customer.vip_card_balance or '0.00'),
            'total_vip_savings': str(customer.total_vip_savings or '0.00'),
            'vip_card_status': customer.vip_card_status,
            'vip_card_issued_at': customer.vip_card_issued_at.isoformat() if customer.vip_card_issued_at else None,
            'total_spent': str(customer.total_spent or '0.00'),
            'total_purchases_count': customer.total_purchases_count,
        }

    if emp_data and cust_data:
        assigned_type = 'both_conflict'
        msg = f"CONFLICT: Card '{norm_uid}' is actively assigned to BOTH Employee {emp_data['name']} AND Customer {cust_data['display_name']}."
    elif emp_data:
        assigned_type = 'employee'
        store_lbl = f" at {emp_data['store_name']}" if emp_data['store_name'] else ""
        msg = f"Assigned as Attendance Card to Employee {emp_data['name']} ({emp_data['employee_code']}){store_lbl}."
    elif cust_data:
        assigned_type = 'customer'
        store_lbl = f" at {cust_data['store_name']}" if cust_data['store_name'] else ""
        msg = f"Assigned as VIP Card to Customer {cust_data['display_name']} ({cust_data['phone']}){store_lbl}."
    else:
        assigned_type = 'none'
        msg = f"Card {norm_uid} is unassigned and available for use."

    return {
        'success': True,
        'card_uid': norm_uid,
        'is_assigned': bool(emp_data or cust_data),
        'assigned_type': assigned_type,
        'employee': emp_data,
        'customer': cust_data,
        'message': msg,
    }
