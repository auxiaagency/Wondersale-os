from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StaffAuthViewSet, StaffRoleViewSet, StaffMemberViewSet,
    KioskTapView, EmployeeViewSet, ShiftViewSet, KioskDeviceViewSet,
    DailyAttendanceViewSet, AttendanceReportViewSet,
    LeaveViewSet, HolidayViewSet, HRSettingsViewSet,
    SalaryStructureViewSet, PayrollViewSet, EmployeeLedgerViewSet,
    StaffSyncViewSet,
    # Phase 1 & 2: Employee Portal & Tasks
    EmployeePortalView, OwnerStaffDirectoryView, EmployeeTaskViewSet,
)

router = DefaultRouter()
router.register(r'auth', StaffAuthViewSet, basename='staff-auth')
router.register(r'roles', StaffRoleViewSet, basename='staff-role')
router.register(r'members', StaffMemberViewSet, basename='staff-member')

# Stage 1: Employee Management & Attendance viewsets
router.register(r'employees', EmployeeViewSet, basename='staff-employee')
router.register(r'shifts', ShiftViewSet, basename='staff-shift')
router.register(r'kiosk-devices', KioskDeviceViewSet, basename='staff-kiosk-device')
router.register(r'attendance/daily', DailyAttendanceViewSet, basename='staff-daily-attendance')
router.register(r'attendance/reports', AttendanceReportViewSet, basename='staff-attendance-reports')
router.register(r'leave', LeaveViewSet, basename='staff-leave')
router.register(r'holidays', HolidayViewSet, basename='staff-holiday')
router.register(r'hr-settings', HRSettingsViewSet, basename='staff-hr-settings')

# Stage 2: Salary, Payroll, Ledger & Sync viewsets
router.register(r'salary-structures', SalaryStructureViewSet, basename='staff-salary-structure')
router.register(r'payroll', PayrollViewSet, basename='staff-payroll')
router.register(r'ledger', EmployeeLedgerViewSet, basename='staff-ledger')
router.register(r'sync', StaffSyncViewSet, basename='staff-sync')

# Phase 2: Tasks Engine
router.register(r'tasks', EmployeeTaskViewSet, basename='staff-task')

urlpatterns = [
    path('tap/', KioskTapView.as_view(), name='kiosk-tap'),
    # Phase 1: Employee Portal endpoints
    path('portal/me/', EmployeePortalView.as_view(), name='employee-portal-me'),
    path('portal/directory/', OwnerStaffDirectoryView.as_view(), name='owner-staff-directory'),
    path('', include(router.urls)),
]

