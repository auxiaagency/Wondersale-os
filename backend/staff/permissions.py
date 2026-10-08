"""
Standardized Role-Based Access Control (RBAC) & Scoping Permissions for Wondersale.
"""
from rest_framework import permissions
from staff.services.auth import get_current_staff


class IsStaffAuthenticated(permissions.BasePermission):
    """
    Allows access only to authenticated staff members (via session, bearer token, or validated header).
    """
    message = "Authentication required. Please log in with your Staff ID."

    def has_permission(self, request, view):
        staff = get_current_staff(request)
        if staff and staff.is_active:
            request.staff_member = staff
            return True
        return False


class IsOwner(permissions.BasePermission):
    """
    Allows access strictly to Store Owners.
    """
    message = "Access restricted: Only the Store Owner has access to this action."

    def has_permission(self, request, view):
        staff = get_current_staff(request)
        if staff and staff.is_active and staff.is_owner:
            request.staff_member = staff
            return True
        return False


class IsManagerOrOwner(permissions.BasePermission):
    """
    Allows access to Store Owners, Store Managers, or staff authorized for the module.
    """
    message = "Access restricted: Requires Manager or Owner privileges."

    def has_permission(self, request, view):
        staff = get_current_staff(request)
        if not staff or not staff.is_active:
            return False
        request.staff_member = staff
        if staff.is_owner:
            return True
        role = staff.role
        if getattr(role, 'can_access_staff', False) or getattr(role, 'is_admin', False):
            return True
        return False


class HasModulePermission(permissions.BasePermission):
    """
    Factory-style permission checking if the staff member's role includes the required module.
    """
    required_module = None

    def __init__(self, required_module=None):
        if required_module:
            self.required_module = required_module

    def has_permission(self, request, view):
        staff = get_current_staff(request)
        if not staff or not staff.is_active:
            return False
        request.staff_member = staff
        if staff.is_owner:
            return True
        allowed = staff.role.allowed_modules or []
        mod = getattr(view, 'required_module', self.required_module)
        if not mod:
            return True
        return mod in allowed
