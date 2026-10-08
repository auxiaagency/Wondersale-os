import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  Grid,
  History,
  FileText,
  Sliders,
  Radio,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CreditCard,
  Building,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  HelpCircle,
  CalendarDays,
  ShieldAlert,
  ArrowRightLeft,
  CalendarCheck,
  Check,
  X,
  Coins,
  Wallet,
  Calculator,
  Database,
  Phone,
} from 'lucide-react';
import { formatPhoneNumber } from '../utils/phoneFormat';

import {
  syncStaffMembers,
  fetchEmployees,
  createEmployee,
  updateEmployee,
  assignEmployeeCard,
  deactivateEmployeeCard,
  transferEmployeeStore,
  assignEmployeeShift,
  fetchEmployeeMonthSummary,
  fetchShifts,
  createShift,
  updateShift,
  deleteShift,
  fetchKioskDevices,
  createKioskDevice,
  deleteKioskDevice,
  fetchDailyAttendance,
  overrideAttendanceDay,
  clearAttendanceOverride,
  addManualPunch,
  voidPunch,
  recalculateAttendance,
  fetchWhoIsIn,
  fetchMonthlyGrid,
  fetchPunchLog,
  fetchMonthlySummaryReport,
  fetchLateEarlyReport,
  lockAttendanceMonth,
  unlockAttendanceMonth,
  fetchLeaveTypes,
  createLeaveType,
  fetchLeaveRequests,
  submitLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  fetchLeaveBalances,
  fetchHolidays,
  createHoliday,
  deleteHoliday,
  fetchHRSettings,
  saveHRSettings,
  recordManualAttendanceDay,
  extractErrorMessage,
} from '../api';

import KioskView from './KioskView';
import PayrollStation from './PayrollStation';
import EmployeeLedger from './EmployeeLedger';
import SalaryStructureModal from './SalaryStructureModal';
import AssignCardModal from './AssignCardModal';
import CardLookupModal from './CardLookupModal';
import ProfileLightboxModal from './ProfileLightboxModal';
import { playVipAcceptedSound } from '../utils/vipCardSounds';
import {
  formatTime12h,
  formatTimeTo24h,
  formatTimeRange12h,
  formatDateTime12h,
  formatCurrencyINR,
} from '../utils/timeFormat';

export default function EmployeeManagementView({ currentUser, stores = [], selectedStore: propSelectedStore, onBackToLauncher }) {
  // Store context
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    if (currentUser && !currentUser.is_owner && currentUser.store) {
      return String(currentUser.store);
    }
    return propSelectedStore || (stores[0]?.id ? String(stores[0].id) : '');
  });

  const activeStoreObj = useMemo(() => {
    return stores.find((s) => String(s.id) === String(selectedStoreId)) || stores[0] || null;
  }, [stores, selectedStoreId]);

  // Main Tab State
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'live', 'daily', 'monthly', 'punches', 'leaves', 'shifts', 'settings'
  const [showKiosk, setShowKiosk] = useState(false);
  const [showCardLookup, setShowCardLookup] = useState(false);
  const [toast, setToast] = useState(null);

  // Profile Lightbox state
  const [lightboxImage, setLightboxImage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // -------------------------------------------------------------
  // TAB 1: DIRECTORY STATE
  // -------------------------------------------------------------
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');

  // Modals for Employee
  const [isAddEmpModalOpen, setIsAddEmpModalOpen] = useState(false);
  const [activeCardModalEmp, setActiveCardModalEmp] = useState(null);
  const [activeShiftModalEmp, setActiveShiftModalEmp] = useState(null);
  const [activeTransferModalEmp, setActiveTransferModalEmp] = useState(null);
  const [activeSummaryModalEmp, setActiveSummaryModalEmp] = useState(null);
  const [activeSalaryModalEmp, setActiveSalaryModalEmp] = useState(null);

  const [syncLoading, setSyncLoading] = useState(false);

  const handleSyncStaff = async () => {
    setSyncLoading(true);
    try {
      const res = await syncStaffMembers(selectedStoreId);
      showToast(`Synced ${res.total} staff profiles (${res.created} new, ${res.updated} updated)`);
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setSyncLoading(false);
    }
  };

  // Form states
  const [newEmpData, setNewEmpData] = useState({
    name: '',
    employee_code: '',
    phone: '',
    department: 'Sales',
    designation: 'Floor Associate',
    join_date: new Date().toISOString().split('T')[0],
  });
  const [shiftAssignData, setShiftAssignData] = useState({
    shift_id: '',
    weekly_off_days: [6], // Sunday
    from_date: new Date().toISOString().split('T')[0],
  });
  const [transferData, setTransferData] = useState({
    store_id: '',
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [empMonthSummaryData, setEmpMonthSummaryData] = useState(null);

  const loadEmployees = async () => {
    setEmpLoading(true);
    try {
      const data = await fetchEmployees({
        store_id: selectedStoreId,
        search: empSearch,
        status: empStatusFilter !== 'all' ? empStatusFilter : undefined,
      });
      setEmployees(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setEmpLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [selectedStoreId]);

  useEffect(() => {
    if (activeTab === 'directory') {
      loadEmployees();
    }
  }, [activeTab, empSearch, empStatusFilter]);

  // -------------------------------------------------------------
  // TAB 2: LIVE BOARD ("WHO'S IN NOW")
  // -------------------------------------------------------------
  const [whoIsIn, setWhoIsIn] = useState([]);
  const [whoLoading, setWhoLoading] = useState(false);

  const loadWhoIsIn = async () => {
    setWhoLoading(true);
    try {
      const data = await fetchWhoIsIn(selectedStoreId);
      setWhoIsIn(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setWhoLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'live') {
      loadWhoIsIn();
      const interval = setInterval(loadWhoIsIn, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedStoreId, activeTab]);

  // -------------------------------------------------------------
  // TAB 3: DAILY ATTENDANCE SHEET
  // -------------------------------------------------------------
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyStatusFilter, setDailyStatusFilter] = useState('');
  const [dailyRecords, setDailyRecords] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Daily Correction Modals
  const [activeOverrideRecord, setActiveOverrideRecord] = useState(null);
  const [overrideStatusVal, setOverrideStatusVal] = useState('present');
  const [overrideReasonVal, setOverrideReasonVal] = useState('');
  const [isManualPunchOpen, setIsManualPunchOpen] = useState(false);
  const [manualPunchData, setManualPunchData] = useState({
    employee_id: '',
    punched_at: `${new Date().toISOString().split('T')[0]}T09:00`,
    note: '',
  });
  const [activeSessionsDay, setActiveSessionsDay] = useState(null);
  const [recalcPreviewData, setRecalcPreviewData] = useState(null);

  const loadDailyAttendance = async () => {
    setDailyLoading(true);
    try {
      const res = await fetchDailyAttendance({
        store_id: selectedStoreId,
        date: dailyDate,
        status: dailyStatusFilter || undefined,
      });
      setDailyRecords(res.records || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyAttendance();
    }
  }, [selectedStoreId, activeTab, dailyDate, dailyStatusFilter]);

  // Daily Stats Computed
  const dailyStats = useMemo(() => {
    const counts = { total: dailyRecords.length, present: 0, half_day: 0, absent: 0, leave: 0, review: 0 };
    dailyRecords.forEach((r) => {
      if (r.status === 'present') counts.present++;
      else if (r.status === 'half_day') counts.half_day++;
      else if (r.status === 'absent') counts.absent++;
      else if (r.status === 'paid_leave' || r.status === 'unpaid_leave') counts.leave++;
      else if (r.status === 'needs_review') counts.review++;
    });
    return counts;
  }, [dailyRecords]);

  // -------------------------------------------------------------
  // TAB 4: MONTHLY MATRIX HEATMAP
  // -------------------------------------------------------------
  const [matrixYear, setMatrixYear] = useState(() => new Date().getFullYear());
  const [matrixMonth, setMatrixMonth] = useState(() => new Date().getMonth() + 1);
  const [matrixData, setMatrixData] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);

  const loadMonthlyGrid = async () => {
    setMatrixLoading(true);
    try {
      const res = await fetchMonthlyGrid(selectedStoreId, matrixYear, matrixMonth);
      setMatrixData(res);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monthly') {
      loadMonthlyGrid();
    }
  }, [selectedStoreId, activeTab, matrixYear, matrixMonth]);

  const [matrixEditDayData, setMatrixEditDayData] = useState(null);
  const [matrixEditSubmitting, setMatrixEditSubmitting] = useState(false);

  const calculateHoursBetween = (inT, outT) => {
    if (!inT || !outT) return '';
    const [h1, m1] = inT.split(':').map(Number);
    const [h2, m2] = outT.split(':').map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return '';
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return (diff / 60).toFixed(1);
  };

  const handleClearMatrixDayOverride = async () => {
    if (!matrixEditDayData?.dayInfo?.id) return;
    if (!window.confirm(`Clear manual override for ${matrixEditDayData.employee.employee_name} on ${matrixEditDayData.dateStr}? This will restore raw calculated attendance.`)) return;
    setMatrixEditSubmitting(true);
    try {
      await clearAttendanceOverride(matrixEditDayData.dayInfo.id, 'Cleared override from attendance matrix');
      showToast(`Cleared override for ${matrixEditDayData.employee.employee_name}`);
      setMatrixEditDayData(null);
      loadMonthlyGrid();
      if (activeTab === 'daily') loadDailyAttendance();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to clear override'), 'danger');
    } finally {
      setMatrixEditSubmitting(false);
    }
  };

  const handleSaveMatrixEditDay = async (e) => {
    e.preventDefault();
    if (!matrixEditDayData) return;
    if (!matrixEditDayData.reason.trim()) {
      showToast('A mandatory reason is required for audit logs', 'warning');
      return;
    }
    setMatrixEditSubmitting(true);
    try {
      const isWorking = matrixEditDayData.status === 'present' || matrixEditDayData.status === 'half_day';
      await recordManualAttendanceDay({
        employee_id: matrixEditDayData.employee.employee_id,
        date: matrixEditDayData.dateStr,
        status: matrixEditDayData.status,
        in_time: isWorking ? (matrixEditDayData.inTime || undefined) : undefined,
        out_time: isWorking ? (matrixEditDayData.outTime || undefined) : undefined,
        worked_hours: isWorking && matrixEditDayData.workedHours ? parseFloat(matrixEditDayData.workedHours) : undefined,
        reason: matrixEditDayData.reason.trim(),
      });
      playVipAcceptedSound();
      showToast(`Updated attendance for ${matrixEditDayData.employee.employee_name} on ${matrixEditDayData.dateStr}`, 'success');
      setMatrixEditDayData(null);
      loadMonthlyGrid();
      if (activeTab === 'daily') loadDailyAttendance();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update day attendance'), 'danger');
    } finally {
      setMatrixEditSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 5: PUNCH LOG
  // -------------------------------------------------------------
  const [punches, setPunches] = useState([]);
  const [unknownTaps, setUnknownTaps] = useState([]);
  const [punchLogSubTab, setPunchLogSubTab] = useState('raw'); // 'raw', 'unknown'
  const [punchLoading, setPunchLoading] = useState(false);

  const loadPunchLog = async () => {
    setPunchLoading(true);
    try {
      const res = await fetchPunchLog(selectedStoreId);
      setPunches(res.punches || []);
      setUnknownTaps(res.unknown_taps || []);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setPunchLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'punches') {
      loadPunchLog();
    }
  }, [selectedStoreId, activeTab]);

  // -------------------------------------------------------------
  // TAB 6: LEAVES & HOLIDAYS
  // -------------------------------------------------------------
  const [leaveSubTab, setLeaveSubTab] = useState('requests'); // 'requests', 'balances', 'holidays', 'types'
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Leave modals
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({
    employee_id: '',
    leave_type_id: '',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    half_day: false,
    half_day_period: '',
    reason: '',
  });
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [holidayFormData, setHolidayFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    is_paid: true,
  });
  const [isAddLeaveTypeOpen, setIsAddLeaveTypeOpen] = useState(false);
  const [leaveTypeFormData, setLeaveTypeFormData] = useState({
    name: '',
    code: '',
    annual_quota_days: 12,
    is_paid: true,
    allows_half_day: true,
    carry_forward: false,
  });

  const loadLeavesAndHolidays = async () => {
    setLeaveLoading(true);
    try {
      const [reqs, types, hols] = await Promise.all([
        fetchLeaveRequests(selectedStoreId),
        fetchLeaveTypes(),
        fetchHolidays(selectedStoreId),
      ]);
      setLeaveRequests(reqs);
      setLeaveTypes(types);
      setHolidays(hols);
      if (types.length > 0) {
        setLeaveFormData((prev) => ({
          ...prev,
          leave_type_id: prev.leave_type_id || String(types[0].id),
        }));
      }
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleOpenApplyLeave = async () => {
    if (leaveTypes.length === 0) {
      try {
        const types = await fetchLeaveTypes();
        setLeaveTypes(types);
        if (types.length > 0) {
          setLeaveFormData((prev) => ({
            ...prev,
            leave_type_id: prev.leave_type_id || String(types[0].id),
          }));
        }
      } catch (err) {
        // ignore
      }
    } else if (!leaveFormData.leave_type_id && leaveTypes.length > 0) {
      setLeaveFormData((prev) => ({ ...prev, leave_type_id: String(leaveTypes[0].id) }));
    }
    setIsApplyLeaveOpen(true);
  };

  // Pre-load leave types on mount
  useEffect(() => {
    fetchLeaveTypes()
      .then((types) => {
        if (Array.isArray(types) && types.length > 0) {
          setLeaveTypes(types);
          setLeaveFormData((prev) => ({
            ...prev,
            leave_type_id: prev.leave_type_id || String(types[0].id),
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'leaves') {
      loadLeavesAndHolidays();
    }
  }, [selectedStoreId, activeTab]);

  // -------------------------------------------------------------
  // TAB 7: SHIFTS & KIOSK DEVICES
  // -------------------------------------------------------------
  const [shifts, setShifts] = useState([]);
  const [kiosks, setKiosks] = useState([]);
  const [shiftSubTab, setShiftSubTab] = useState('shifts'); // 'shifts', 'kiosks'
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [shiftFormData, setShiftFormData] = useState({
    name: '',
    start_time: '09:00',
    end_time: '18:00',
    is_overnight: false,
    grace_late_minutes: 15,
    grace_early_leave_minutes: 10,
    min_minutes_full_day: 480,
    min_minutes_half_day: 240,
    break_allowance_minutes: 60,
    is_default_for_store: false,
  });
  const [isAddKioskOpen, setIsAddKioskOpen] = useState(false);
  const [kioskNameInput, setKioskNameInput] = useState('Front Counter Kiosk');
  const [createdKioskToken, setCreatedKioskToken] = useState(null);

  const loadShiftsAndKiosks = async () => {
    try {
      const [sh, kd] = await Promise.all([
        fetchShifts(selectedStoreId),
        fetchKioskDevices(selectedStoreId),
      ]);
      setShifts(sh);
      setKiosks(kd);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  useEffect(() => {
    if (activeTab === 'shifts') {
      loadShiftsAndKiosks();
    }
  }, [selectedStoreId, activeTab]);

  // -------------------------------------------------------------
  // TAB 8: HR SETTINGS
  // -------------------------------------------------------------
  const [hrSettings, setHrSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const loadHRSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await fetchHRSettings(selectedStoreId);
      setHrSettings(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      loadHRSettings();
    }
  }, [selectedStoreId, activeTab]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await saveHRSettings(selectedStoreId, hrSettings);
      showToast('HR settings saved successfully');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      await createEmployee({
        store: selectedStoreId,
        ...newEmpData,
      });
      showToast(`Employee ${newEmpData.name} registered`);
      setIsAddEmpModalOpen(false);
      setNewEmpData({
        name: '',
        employee_code: '',
        phone: '',
        department: 'Sales',
        designation: 'Floor Associate',
        join_date: new Date().toISOString().split('T')[0],
      });
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAssignCard = async (e) => {
    e.preventDefault();
    if (!activeCardModalEmp) return;
    try {
      await assignEmployeeCard(activeCardModalEmp.id, cardUidInput, cardReasonInput);
      showToast(`Card ${cardUidInput} linked to ${activeCardModalEmp.name}`);
      setActiveCardModalEmp(null);
      setCardUidInput('');
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeactivateCard = async (employee) => {
    if (!window.confirm(`Deactivate active RFID card for ${employee.name}?`)) return;
    try {
      await deactivateEmployeeCard(employee.id, null, 'Manager manual deactivation');
      showToast(`Card deactivated for ${employee.name}`);
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAssignShiftSubmit = async (e) => {
    e.preventDefault();
    if (!activeShiftModalEmp) return;
    try {
      await assignEmployeeShift(activeShiftModalEmp.id, shiftAssignData);
      showToast(`Shift schedule updated for ${activeShiftModalEmp.name}`);
      setActiveShiftModalEmp(null);
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!activeTransferModalEmp) return;
    try {
      await transferEmployeeStore(
        activeTransferModalEmp.id,
        transferData.store_id,
        transferData.effective_date,
        transferData.notes
      );
      showToast(`Transferred ${activeTransferModalEmp.name} to target store`);
      setActiveTransferModalEmp(null);
      loadEmployees();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!activeOverrideRecord) return;
    try {
      await overrideAttendanceDay(activeOverrideRecord.id, overrideStatusVal, overrideReasonVal);
      showToast('Attendance status override applied');
      setActiveOverrideRecord(null);
      setOverrideReasonVal('');
      loadDailyAttendance();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleClearOverride = async (record) => {
    try {
      await clearAttendanceOverride(record.id, 'Cleared override by manager');
      showToast('Override cleared. Computed status restored.');
      loadDailyAttendance();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleManualPunchSubmit = async (e) => {
    e.preventDefault();
    try {
      await addManualPunch(manualPunchData.employee_id, manualPunchData.punched_at, manualPunchData.note);
      showToast('Manual punch recorded & day recalculated');
      setIsManualPunchOpen(false);
      setManualPunchData({
        employee_id: '',
        punched_at: `${new Date().toISOString().split('T')[0]}T09:00`,
        note: '',
      });
      loadDailyAttendance();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleVoidPunch = async (punch) => {
    const reason = window.prompt(`Reason for voiding punch of ${punch.employee_name}?`);
    if (!reason) return;
    try {
      await voidPunch(punch.id, reason);
      showToast('Punch voided & attendance day rebuilt');
      loadDailyAttendance();
      if (activeTab === 'punches') loadPunchLog();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleRecalculate = async (preview = false) => {
    try {
      const res = await recalculateAttendance(selectedStoreId, dailyDate, dailyDate, preview);
      if (preview) {
        setRecalcPreviewData(res);
      } else {
        showToast(`Recalculation complete. ${res.days_changed} day(s) updated.`);
        loadDailyAttendance();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleLockMonth = async () => {
    if (matrixData?.is_ongoing) {
      showToast(`Cannot lock ongoing month. Attendance locks on ${matrixData?.unlocks_at || 'concluded month'}.`, 'warning');
      return;
    }
    if (!window.confirm(`Lock attendance for ${matrixYear}-${String(matrixMonth).padStart(2, '0')}? This seals all records for payroll.`)) return;
    try {
      const res = await lockAttendanceMonth(selectedStoreId, matrixYear, matrixMonth);
      showToast(`Locked ${res.locked_count} attendance records for this month`);
      loadMonthlyGrid();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleUnlockMonth = async () => {
    if (!window.confirm(`Unlock attendance for ${matrixYear}-${String(matrixMonth).padStart(2, '0')}?`)) return;
    try {
      const res = await unlockAttendanceMonth(selectedStoreId, matrixYear, matrixMonth);
      showToast(`Unlocked ${res.unlocked_count} attendance records`);
      loadMonthlyGrid();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleApproveLeave = async (reqId) => {
    try {
      await approveLeaveRequest(reqId, `Approved by ${currentUser?.name || 'Manager'}`);
      showToast('Leave request approved');
      loadLeavesAndHolidays();
      loadDailyAttendance();
      if (activeTab === 'monthly') loadMonthlyGrid();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleRejectLeave = async (reqId) => {
    const notes = window.prompt('Reason for rejecting leave request:') || '';
    try {
      await rejectLeaveRequest(reqId, notes);
      showToast('Leave request rejected');
      loadLeavesAndHolidays();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleCancelLeave = async (req) => {
    if (!window.confirm(`Cancel leave for ${req.employee_name} (${req.from_date}${req.from_date !== req.to_date ? ` to ${req.to_date}` : ''})? This will refund their leave quota in the balance ledger and restore regular attendance.`)) return;
    try {
      await cancelLeaveRequest(req.id, `Cancelled by ${currentUser?.name || 'Manager'}`);
      showToast(`Leave cancelled and refunded for ${req.employee_name}`);
      loadLeavesAndHolidays();
      loadDailyAttendance();
      if (activeTab === 'monthly') loadMonthlyGrid();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!leaveFormData.employee_id) {
      showToast('Please select an employee', 'warning');
      return;
    }
    if (!leaveFormData.leave_type_id) {
      showToast('Please select a leave type', 'warning');
      return;
    }
    try {
      await submitLeaveRequest({
        ...leaveFormData,
        auto_approve: true,
      });
      showToast('Leave granted and recorded in ledger/attendance');
      setIsApplyLeaveOpen(false);
      setLeaveFormData({
        employee_id: '',
        leave_type_id: '',
        from_date: new Date().toISOString().split('T')[0],
        to_date: new Date().toISOString().split('T')[0],
        half_day: false,
        half_day_period: '',
        reason: '',
      });
      loadLeavesAndHolidays();
      loadDailyAttendance();
      if (activeTab === 'monthly') loadMonthlyGrid();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAddHolidaySubmit = async (e) => {
    e.preventDefault();
    if (!holidayFormData.name.trim()) {
      showToast('Please enter a holiday name', 'warning');
      return;
    }
    try {
      await createHoliday({
        store: selectedStoreId,
        name: holidayFormData.name.trim(),
        date: holidayFormData.date,
        is_paid: holidayFormData.is_paid,
      });
      showToast(`Store holiday '${holidayFormData.name}' added and attendance updated`);
      setIsAddHolidayOpen(false);
      setHolidayFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        is_paid: true,
      });
      loadLeavesAndHolidays();
      loadDailyAttendance();
      if (activeTab === 'monthly') loadMonthlyGrid();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleAddLeaveTypeSubmit = async (e) => {
    e.preventDefault();
    if (!leaveTypeFormData.name.trim() || !leaveTypeFormData.code.trim()) {
      showToast('Please enter both name and code for the leave category', 'warning');
      return;
    }
    try {
      await createLeaveType({
        name: leaveTypeFormData.name.trim(),
        code: leaveTypeFormData.code.trim().toUpperCase(),
        annual_quota_days: Number(leaveTypeFormData.annual_quota_days) || 0,
        is_paid: Boolean(leaveTypeFormData.is_paid),
        allows_half_day: Boolean(leaveTypeFormData.allows_half_day),
        carry_forward: Boolean(leaveTypeFormData.carry_forward),
      });
      showToast(`Leave category '${leaveTypeFormData.name}' added successfully`);
      setIsAddLeaveTypeOpen(false);
      setLeaveTypeFormData({
        name: '',
        code: '',
        annual_quota_days: 12,
        is_paid: true,
        allows_half_day: true,
        carry_forward: false,
      });
      loadLeavesAndHolidays();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleCreateShiftSubmit = async (e) => {
    e.preventDefault();
    try {
      await createShift({
        store: selectedStoreId,
        ...shiftFormData,
      });
      showToast(`Shift ${shiftFormData.name} created`);
      setIsAddShiftOpen(false);
      loadShiftsAndKiosks();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleCreateKioskSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await createKioskDevice({
        name: kioskNameInput,
      });
      setCreatedKioskToken(data.raw_token);
      showToast(`Kiosk device '${kioskNameInput}' registered`);
      loadShiftsAndKiosks();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Helper Badge Color
  const getStatusBadge = (status, fraction, isOverride) => {
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      fontSize: '0.76rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    };

    let color = 'var(--text-secondary)';
    let bg = 'var(--bg-surface-hover)';

    switch (status) {
      case 'present':
        color = 'var(--color-success)';
        bg = 'var(--color-success-bg)';
        break;
      case 'half_day':
        color = 'var(--color-info)';
        bg = 'var(--color-info-bg)';
        break;
      case 'absent':
        color = 'var(--color-danger)';
        bg = 'var(--color-danger-bg)';
        break;
      case 'paid_leave':
      case 'unpaid_leave':
        color = '#8B5CF6';
        bg = 'rgba(139, 92, 246, 0.12)';
        break;
      case 'weekly_off':
      case 'holiday':
        color = '#64748B';
        bg = 'rgba(100, 116, 139, 0.14)';
        break;
      case 'needs_review':
        color = 'var(--color-warning)';
        bg = 'var(--color-warning-bg)';
        break;
      default:
        break;
    }

    return (
      <span style={{ ...baseStyle, color, background: bg }}>
        {status?.replace('_', ' ')}
        {fraction && fraction !== '1.00' && fraction !== '0.00' && ` (${fraction}d)`}
        {isOverride && ' *'}
      </span>
    );
  };

  return (
    <div className="emp-mgmt-root" style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px' }}>
      {/* Fullscreen Kiosk Overlay */}
      {showKiosk && (
        <KioskView
          store={activeStoreObj}
          currentUser={currentUser}
          onClose={() => setShowKiosk(false)}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className="emp-toast"
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            zIndex: 10000,
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            background: toast.type === 'danger' ? 'var(--color-danger)' : '#10B981',
            color: '#FFFFFF',
            fontWeight: 700,
            boxShadow: 'var(--shadow-floating)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {toast.type === 'danger' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div
        className="emp-top-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="emp-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBackToLauncher}
            className="btn btn-secondary emp-back-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <ArrowLeft size={16} />
            <span>Menu</span>
          </button>

          <div className="emp-header-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="emp-header-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                Employee Management &amp; Attendance
              </h1>
              <span
                className="emp-header-stage-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#6366F1',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                Workforce &amp; Payroll
              </span>
            </div>
            <p className="emp-header-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              RFID attendance, smart punch audit, salary structures, payroll station &amp; employee ledgers.
            </p>
          </div>
        </div>

        {/* Store Location, Sync, Demo & Kiosk CTA */}
        <div className="emp-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {stores.length > 1 && currentUser?.is_owner && (
            <div className="emp-store-select-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="input-field emp-store-select"
                style={{ padding: '8px 14px', fontSize: '0.88rem', fontWeight: 700, borderRadius: 'var(--radius-pill)' }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleSyncStaff}
            disabled={syncLoading}
            className="btn btn-secondary emp-sync-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '8px 14px', borderRadius: 'var(--radius-pill)' }}
            title="Synchronize profiles from Staff & Roles"
          >
            <RefreshCw size={15} className={syncLoading ? 'animate-spin' : ''} />
            <span>{syncLoading ? 'Syncing...' : 'Sync Staff'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCardLookup(true)}
            className="btn btn-secondary emp-check-card-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '8px 14px', borderRadius: 'var(--radius-pill)' }}
            title="Scan or enter any card to inspect owner, details & status"
          >
            <CreditCard size={15} />
            <span>Check Card</span>
          </button>

          <button
            type="button"
            onClick={() => setShowKiosk(true)}
            className="btn btn-primary emp-kiosk-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 800,
              padding: '9px 18px',
              borderRadius: 'var(--radius-pill)',
              background: 'linear-gradient(135deg, var(--brand-primary), #E11D48)',
              boxShadow: 'var(--shadow-floating)',
            }}
          >
            <Radio size={16} />
            <span>Launch RFID Kiosk Station</span>
          </button>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div
        className="emp-tabs-bar"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {[
          { id: 'directory', label: 'Staff Directory', icon: Users },
          { id: 'payroll', label: 'Payroll Station', icon: Calculator },
          { id: 'ledger', label: 'Employee Ledger', icon: Wallet },
          { id: 'live', label: "Who's in Now", icon: Radio, count: whoIsIn.length },
          { id: 'daily', label: 'Daily Attendance', icon: CalendarCheck, alert: dailyStats.review > 0 },
          { id: 'monthly', label: 'Monthly Matrix', icon: Grid },
          { id: 'punches', label: 'Punch Log', icon: History },
          { id: 'leaves', label: 'Leaves & Holidays', icon: CalendarDays },
          { id: 'shifts', label: 'Shifts & Kiosks', icon: Clock },
          { id: 'settings', label: 'HR Rules & Policies', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`emp-tab-btn ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--brand-primary)' : '3px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={17} style={{ color: isActive ? 'var(--brand-primary)' : 'inherit' }} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: isActive ? 'var(--brand-primary)' : 'var(--bg-surface-hover)',
                    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  {tab.count}
                </span>
              )}
              {tab.alert && (
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-warning-bg)',
                    color: 'var(--color-warning)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  Action Req
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STAFF DIRECTORY */}
      {/* ========================================================= */}
      {activeTab === 'directory' && (
        <div>
          <div
            className="emp-dir-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div className="emp-dir-search-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '520px' }}>
              <div className="emp-dir-search-wrap" style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by employee name or code..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="input-field emp-dir-search-input"
                  style={{ paddingLeft: '38px', width: '100%' }}
                />
              </div>

              <select
                value={empStatusFilter}
                onChange={(e) => setEmpStatusFilter(e.target.value)}
                className="input-field emp-dir-status-select"
                style={{ width: '140px', fontWeight: 600 }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table emp-dir-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-hover)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="emp-th-employee" style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Employee</th>
                  <th className="emp-th-role" style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Role &amp; Dept</th>
                  <th className="emp-th-store" style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Store Branch</th>
                  <th className="emp-th-rfid" style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>RFID Card</th>
                  <th className="emp-th-shift" style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Shift</th>
                  <th className="emp-th-status" style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                  <th className="emp-th-actions" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {empLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <div>Loading staff directory...</div>
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No staff members found for this store. Add staff in the "Staff &amp; Roles" section or click "Sync Staff" above.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="emp-td-employee" style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            className="emp-avatar-box"
                            onClick={() => {
                              if (emp.photo) {
                                setLightboxImage({
                                  src: emp.photo,
                                  name: emp.name,
                                  code: emp.employee_code,
                                  role: emp.role_name,
                                  store: emp.store_name,
                                  phone: emp.phone,
                                  section: emp.section,
                                });
                              }
                            }}
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: 'var(--bg-surface-hover)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              color: 'var(--brand-primary)',
                              fontSize: '0.92rem',
                              cursor: emp.photo ? 'zoom-in' : 'default',
                              transition: 'all 0.15s ease',
                              overflow: 'hidden',
                            }}
                            onMouseEnter={(e) => {
                              if (emp.photo) {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.borderColor = 'var(--brand-primary)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (emp.photo) {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                              }
                            }}
                            title={emp.photo ? `Click to view full photo of ${emp.name}` : emp.name}
                          >
                            {emp.photo ? (
                              <img src={emp.photo} alt={emp.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              emp.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="emp-name-text" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{emp.name}</div>
                            <div className="emp-sub-text" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{emp.employee_code}</span>
                              {emp.phone && (
                                <>
                                  <span>•</span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <Phone size={10} style={{ opacity: 0.7 }} />
                                    {formatPhoneNumber(emp.phone)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="emp-td-role" style={{ padding: '14px 16px' }}>
                        <div className="emp-role-title" style={{ fontWeight: 600 }}>{emp.role_name || '—'}</div>
                        <div className="emp-dept-text" style={{ fontSize: '0.78rem', color: emp.section_details?.color || 'var(--text-muted)' }}>
                          {emp.section_details?.name || emp.section_name || (typeof emp.section === 'string' ? emp.section : '') || '—'}
                        </div>
                      </td>

                      <td className="emp-td-store" style={{ padding: '14px 16px' }}>
                        <span className="emp-store-text" style={{ fontWeight: 600 }}>{emp.store_name}</span>
                      </td>

                      <td className="emp-td-rfid" style={{ padding: '14px 16px' }}>
                        {emp.active_card_uid ? (
                          <div
                            onClick={() => setActiveCardModalEmp(emp)}
                            style={{ cursor: 'pointer' }}
                            title="Click to manage RFID card"
                          >
                            <span
                              className="emp-rfid-badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-xs)',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: 'var(--color-success)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              <CreditCard size={12} />
                              {emp.active_card_uid}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="emp-rfid-tap-btn"
                            onClick={() => setActiveCardModalEmp(emp)}
                            style={{
                              border: '1px dashed var(--border-subtle)',
                              background: 'transparent',
                              borderRadius: 'var(--radius-pill)',
                              padding: '2px 8px',
                              fontSize: '0.78rem',
                              color: 'var(--brand-primary)',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            title="Tap to assign RFID card"
                          >
                            + Tap Card
                          </button>
                        )}
                      </td>

                      <td className="emp-td-shift" style={{ padding: '14px 16px' }}>
                        {emp.active_shift ? (
                          <div>
                            <div className="emp-shift-name" style={{ fontWeight: 700, fontSize: '0.88rem' }}>{emp.active_shift.name}</div>
                            <div className="emp-shift-time" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {formatTimeRange12h(emp.active_shift.start_time, emp.active_shift.end_time)}
                            </div>
                          </div>
                        ) : (
                          <span className="emp-shift-default" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Store Default</span>
                        )}
                      </td>

                      <td className="emp-td-status" style={{ padding: '14px 16px' }}>
                        <span
                          className="emp-status-badge"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: emp.is_active ? 'var(--color-success-bg)' : 'var(--bg-surface-hover)',
                            color: emp.is_active ? 'var(--color-success)' : 'var(--text-muted)',
                          }}
                        >
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="emp-td-actions" style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div className="emp-actions-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setActiveCardModalEmp(emp)}
                            className="btn btn-secondary emp-action-btn"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                            title="Manage RFID Card"
                          >
                            <CreditCard size={14} />
                            <span>Card</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveSalaryModalEmp(emp)}
                            className="btn btn-secondary emp-action-btn"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-primary)' }}
                            title="Manage Salary Structure"
                          >
                            <Coins size={14} />
                            <span>Salary</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveShiftModalEmp(emp);
                              setShiftAssignData({
                                shift_id: emp.active_shift?.id ? String(emp.active_shift.id) : '',
                                weekly_off_days: Array.isArray(emp.weekly_off_days) ? emp.weekly_off_days : (emp.weekly_off_days === null ? null : [6]),
                                from_date: new Date().toISOString().split('T')[0],
                              });
                            }}
                            className="btn btn-secondary emp-action-btn"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                            title="Assign Shift"
                          >
                            <Clock size={14} />
                            <span>Shift</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveTransferModalEmp(emp);
                              setTransferData({
                                store_id: '',
                                effective_date: new Date().toISOString().split('T')[0],
                                notes: '',
                              });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                            title="Transfer Store Branch"
                          >
                            <ArrowRightLeft size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const today = new Date();
                              const res = await fetchEmployeeMonthSummary(emp.id, today.getFullYear(), today.getMonth() + 1);
                              setEmpMonthSummaryData(res);
                              setActiveSummaryModalEmp(emp);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                            title="View Month Attendance Dossier"
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: "WHO'S IN NOW" LIVE PRESENCE BOARD */}
      {/* ========================================================= */}
      {activeTab === 'live' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px' }}>
                Live Clocked-In Staff ({whoIsIn.length})
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                Employees currently on the floor with active unclosed work sessions.
              </p>
            </div>

            <button
              type="button"
              onClick={loadWhoIsIn}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <RefreshCw size={15} className={whoLoading ? 'animate-spin' : ''} />
              <span>Refresh Now</span>
            </button>
          </div>

          {whoLoading && whoIsIn.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <div>Polling active store sessions...</div>
            </div>
          ) : whoIsIn.length === 0 ? (
            <div
              className="card"
              style={{
                padding: '60px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Radio size={42} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                No Clocked-In Staff Right Now
              </h3>
              <p style={{ fontSize: '0.88rem', margin: '0 0 20px' }}>
                Staff members tap their RFID card at the kiosk station upon arrival.
              </p>
              <button
                type="button"
                onClick={() => setShowKiosk(true)}
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
              >
                Launch Kiosk Station
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {whoIsIn.map((item) => (
                <div
                  key={item.employee_id}
                  className="card"
                  style={{
                    padding: '20px',
                    border: '1px solid var(--border-subtle)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'var(--color-success)',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                    <div
                      onClick={() => {
                        if (item.photo_url) {
                          setLightboxImage({
                            src: item.photo_url,
                            name: item.employee_name,
                            code: item.employee_code,
                            role: item.role_name,
                            store: activeStoreObj?.name,
                            phone: item.phone,
                            section: item.section,
                          });
                        }
                      }}
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-success)',
                        overflow: 'hidden',
                        background: 'var(--bg-surface-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: 'var(--color-success)',
                        cursor: item.photo_url ? 'zoom-in' : 'default',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (item.photo_url) {
                          e.currentTarget.style.transform = 'scale(1.1)';
                          e.currentTarget.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (item.photo_url) {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                      title={item.photo_url ? `Click to view full photo of ${item.employee_name}` : item.employee_name}
                    >
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.employee_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        item.employee_name.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {item.employee_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.employee_code}{item.role_name ? ` · ${item.role_name}` : ''}{item.section ? ` (${item.section})` : ''}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                      }}
                    >
                      IN STORE
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-hover)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clock In</div>
                      <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.96rem' }}>
                        {formatTime12h(item.clock_in_time)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</div>
                      <div style={{ fontWeight: 800, color: 'var(--color-success)', fontSize: '0.96rem' }}>
                        {item.active_duration_formatted}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DAILY ATTENDANCE SHEET */}
      {/* ========================================================= */}
      {activeTab === 'daily' && (
        <div>
          {/* Daily Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* Date Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(dailyDate);
                  d.setDate(d.getDate() - 1);
                  setDailyDate(d.toISOString().split('T')[0]);
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 12px' }}
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>

              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="input-field"
                style={{ padding: '8px 14px', fontWeight: 700 }}
              />

              <button
                type="button"
                onClick={() => {
                  const d = new Date(dailyDate);
                  d.setDate(d.getDate() + 1);
                  setDailyDate(d.toISOString().split('T')[0]);
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 12px' }}
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => setDailyDate(new Date().toISOString().split('T')[0])}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem' }}
              >
                Today
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleRecalculate(true)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                title="Preview differences if rules change"
              >
                <RotateCcw size={15} />
                <span>Simulate Recalc</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManualPunchOpen(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Add Manual Punch</span>
              </button>
            </div>
          </div>

          {/* Daily Metric Stat Pills */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            {[
              { label: 'Total Tracked', val: dailyStats.total, color: 'var(--text-primary)' },
              { label: 'Present', val: dailyStats.present, color: 'var(--color-success)' },
              { label: 'Half Day', val: dailyStats.half_day, color: 'var(--color-info)' },
              { label: 'Absent', val: dailyStats.absent, color: 'var(--color-danger)' },
              { label: 'On Leave', val: dailyStats.leave, color: '#8B5CF6' },
              { label: 'Needs Review', val: dailyStats.review, color: 'var(--color-warning)', highlight: dailyStats.review > 0 },
            ].map((st, i) => (
              <div
                key={i}
                className="card"
                style={{
                  padding: '12px 16px',
                  background: st.highlight ? 'var(--color-warning-bg)' : 'var(--bg-surface)',
                  border: st.highlight ? '1px solid var(--color-warning)' : '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  {st.label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: st.color, marginTop: '2px' }}>
                  {st.val}
                </div>
              </div>
            ))}
          </div>

          {/* Daily Table */}
          <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="table emp-daily-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-hover)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Employee</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>First In / Last Out</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Worked Net</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Late / Early</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Credit</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <div>Computing daily attendance rules...</div>
                    </td>
                  </tr>
                ) : dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No attendance records for this date.
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((rec) => (
                    <tr key={rec.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 800 }}>{rec.employee_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {rec.employee_code}{rec.role_name ? ` · ${rec.role_name}` : ''}{rec.section ? ` (${rec.section})` : ''}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>
                          <span style={{ color: rec.first_in ? 'var(--color-success)' : 'var(--text-muted)' }}>
                            {formatTime12h(rec.first_in)}
                          </span>
                          {' → '}
                          <span style={{ color: rec.last_out ? 'var(--color-info)' : 'var(--text-muted)' }}>
                            {formatTime12h(rec.last_out)}
                          </span>
                        </div>
                        {rec.sessions && rec.sessions.length > 1 && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {rec.sessions.length} sessions (break: {rec.break_minutes}m)
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700 }}>
                          {Math.floor(rec.worked_minutes / 60)}h {rec.worked_minutes % 60}m
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {rec.worked_minutes} mins
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {rec.late_minutes > 0 ? (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '0.84rem' }}>
                            +{rec.late_minutes}m late
                          </span>
                        ) : rec.early_leave_minutes > 0 ? (
                          <span style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '0.84rem' }}>
                            -{rec.early_leave_minutes}m early
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>On Time</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {getStatusBadge(rec.status, rec.day_fraction_paid, rec.override_status)}
                        {rec.override_status && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            By {rec.override_by_name || 'Admin'}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                          {rec.day_fraction_paid}
                        </span>
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveOverrideRecord(rec);
                              setOverrideStatusVal(rec.status);
                              setOverrideReasonVal(rec.override_reason || '');
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 600 }}
                            title="Override attendance status"
                          >
                            <Edit2 size={13} />
                            <span>Override</span>
                          </button>

                          {rec.override_status && (
                            <button
                              type="button"
                              onClick={() => handleClearOverride(rec)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.8rem', color: 'var(--color-warning)' }}
                              title="Clear manual override"
                            >
                              <RotateCcw size={13} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setActiveSessionsDay(rec)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            title="Inspect paired sessions & punches"
                          >
                            <Clock size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: MONTHLY MATRIX HEATMAP */}
      {/* ========================================================= */}
      {activeTab === 'monthly' && (
        <div>
          {/* Month & Year Select */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={matrixMonth}
                onChange={(e) => setMatrixMonth(Number(e.target.value))}
                className="input-field"
                style={{ fontWeight: 700 }}
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December',
                ].map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={matrixYear}
                onChange={(e) => setMatrixYear(Number(e.target.value))}
                className="input-field"
                style={{ fontWeight: 700 }}
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadMonthlyGrid}
                className="btn btn-secondary"
                style={{ padding: '8px 12px' }}
                title="Reload Matrix"
              >
                <RefreshCw size={15} className={matrixLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Lock / Unlock Month CTA & Status Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {matrixData?.is_locked ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--color-success)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                  }}
                >
                  <Lock size={13} />
                  <span>Month Locked</span>
                </span>
              ) : matrixData?.is_ongoing ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: 'var(--color-info)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                  title={`Month is ongoing. Unlocks for locking on ${matrixData?.unlocks_at || 'next month'}`}
                >
                  <Clock size={13} />
                  <span>Live Progress (In Progress)</span>
                </span>
              ) : null}

              <button
                type="button"
                onClick={handleLockMonth}
                disabled={matrixData?.is_locked || matrixData?.is_ongoing || matrixLoading}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  color: (matrixData?.is_locked || matrixData?.is_ongoing) ? 'var(--text-muted)' : 'var(--color-warning)',
                  cursor: (matrixData?.is_locked || matrixData?.is_ongoing) ? 'not-allowed' : 'pointer',
                  opacity: (matrixData?.is_locked || matrixData?.is_ongoing) ? 0.6 : 1,
                }}
                title={
                  matrixData?.is_locked
                    ? 'This month is already locked'
                    : matrixData?.is_ongoing
                    ? `Attendance can only be locked once the month has concluded (unlocks ${matrixData?.unlocks_at || 'next month'})`
                    : 'Seal and lock all attendance records for payroll'
                }
              >
                <Lock size={15} />
                <span>
                  {matrixData?.is_locked
                    ? 'Month Locked'
                    : matrixData?.is_ongoing
                    ? `Lock Month (Unlocks ${matrixData?.unlocks_at ? matrixData.unlocks_at.split(',')[0] : 'Concluded'})`
                    : 'Lock Month (Finalize)'}
                </span>
              </button>

              {matrixData?.is_locked && (
                <button
                  type="button"
                  onClick={handleUnlockMonth}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  title="Unlock attendance for this month"
                >
                  <Unlock size={15} />
                  <span>Unlock</span>
                </button>
              )}
            </div>
          </div>

          {/* Heatmap Grid Table */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', position: 'sticky', left: 0, background: 'var(--bg-surface-hover)', zIndex: 2, minWidth: '180px', fontWeight: 800 }}>
                    Employee
                  </th>
                  {matrixData &&
                    Array.from({ length: matrixData.total_days }, (_, i) => i + 1).map((d) => (
                      <th
                        key={d}
                        style={{
                          padding: '8px 4px',
                          textAlign: 'center',
                          minWidth: '32px',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {d}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {matrixLoading || !matrixData ? (
                  <tr>
                    <td colSpan={35} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      <div>Compiling monthly attendance heatmap matrix...</div>
                    </td>
                  </tr>
                ) : (
                  matrixData.matrix.map((row) => (
                    <tr key={row.employee_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td
                        style={{
                          padding: '10px 16px',
                          fontWeight: 700,
                          position: 'sticky',
                          left: 0,
                          background: 'var(--bg-surface)',
                          zIndex: 1,
                          borderRight: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div>{row.employee_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span>{row.employee_code}</span>
                          {row.is_pre_joining && (
                            <span style={{ fontSize: '0.66rem', background: 'var(--bg-surface-hover)', color: 'var(--text-muted)', padding: '1px 5px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                              Joined {row.join_date}
                            </span>
                          )}
                          {row.is_post_exit && (
                            <span style={{ fontSize: '0.66rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', padding: '1px 5px', borderRadius: '4px' }}>
                              Left {row.exit_date}
                            </span>
                          )}
                        </div>
                      </td>

                      {Array.from({ length: matrixData.total_days }, (_, i) => i + 1).map((dayNum) => {
                        const dayInfo = row.days[dayNum] || { status: 'absent' };
                        let cellBg = 'rgba(239, 68, 68, 0.12)';
                        let cellColor = '#EF4444';
                        let cellChar = 'A';
                        let cellTitle = `Day ${dayNum}: ${dayInfo.status} (worked: ${dayInfo.worked_minutes}m)`;

                        if (dayInfo.status === 'not_joined') {
                          cellBg = 'transparent';
                          cellColor = 'var(--text-muted, #64748B)';
                          cellChar = '-';
                          cellTitle = `Day ${dayNum}: Not employed yet (Joined ${dayInfo.join_date || row.join_date || 'later'})`;
                        } else if (dayInfo.status === 'separated') {
                          cellBg = 'transparent';
                          cellColor = 'var(--text-muted, #64748B)';
                          cellChar = '-';
                          cellTitle = `Day ${dayNum}: Separated (Left ${dayInfo.exit_date || row.exit_date || 'earlier'})`;
                        } else if (dayInfo.status === 'future') {
                          cellBg = 'var(--bg-surface-hover, rgba(255, 255, 255, 0.03))';
                          cellColor = 'var(--text-muted, #64748B)';
                          cellChar = '-';
                          cellTitle = `Day ${dayNum}: Upcoming date`;
                        } else if (dayInfo.status === 'present') {
                          cellBg = 'rgba(16, 185, 129, 0.2)';
                          cellColor = '#10B981';
                          cellChar = 'P';
                        } else if (dayInfo.status === 'half_day') {
                          cellBg = 'rgba(59, 130, 246, 0.2)';
                          cellColor = '#3B82F6';
                          cellChar = 'H';
                        } else if (dayInfo.status === 'paid_leave' || dayInfo.status === 'unpaid_leave') {
                          cellBg = 'rgba(139, 92, 246, 0.2)';
                          cellColor = '#8B5CF6';
                          cellChar = 'L';
                        } else if (dayInfo.status === 'weekly_off') {
                          cellBg = 'rgba(100, 116, 139, 0.14)';
                          cellColor = '#64748B';
                          cellChar = 'W';
                        } else if (dayInfo.status === 'holiday') {
                          cellBg = 'rgba(245, 158, 11, 0.2)';
                          cellColor = '#F59E0B';
                          cellChar = 'HD';
                        } else if (dayInfo.status === 'needs_review') {
                          cellBg = 'rgba(245, 158, 11, 0.25)';
                          cellColor = '#D97706';
                          cellChar = '!';
                        }

                        const isClickable = dayInfo.status !== 'not_joined' && dayInfo.status !== 'separated' && dayInfo.status !== 'future';
                        if (isClickable) {
                          cellTitle = `Day ${dayNum}: ${dayInfo.status.toUpperCase()} (${dayInfo.worked_minutes || 0}m worked) — Click to edit actual hours & attendance`;
                        }

                        return (
                          <td
                            key={dayNum}
                            style={{
                              padding: '6px 2px',
                              textAlign: 'center',
                            }}
                            title={cellTitle}
                          >
                            <div
                              onClick={() => {
                                if (!isClickable) return;
                                if (matrixData?.is_locked) {
                                  showToast('This month is locked because payroll has been finalized.', 'warning');
                                  return;
                                }
                                const curStatus = dayInfo.status || 'absent';
                                const isWorking = curStatus === 'present' || curStatus === 'half_day';
                                const inT = formatTimeTo24h(dayInfo.first_in_time || dayInfo.first_in) || (isWorking ? (row.shift_start || '09:00') : '');
                                const outT = formatTimeTo24h(dayInfo.last_out_time || dayInfo.last_out) || (isWorking ? (row.shift_end || '18:00') : '');
                                const workedHrs = dayInfo.worked_minutes ? (dayInfo.worked_minutes / 60).toFixed(1) : (inT && outT ? calculateHoursBetween(inT, outT) : (isWorking ? '9.0' : ''));
                                setMatrixEditDayData({
                                  employee: row,
                                  dayNum,
                                  dateStr: dayInfo.business_date || `${matrixYear}-${String(matrixMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
                                  dayInfo,
                                  status: curStatus === 'needs_review' ? 'present' : curStatus,
                                  inTime: inT,
                                  outTime: outT,
                                  workedHours: workedHrs,
                                  reason: dayInfo.override_reason || '',
                                });

                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: cellBg,
                                color: cellColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.74rem',
                                margin: '0 auto',
                                cursor: isClickable ? 'pointer' : 'default',
                                transition: 'all 0.15s ease',
                                userSelect: 'none',
                                boxShadow: isClickable ? '0 1px 2px rgba(0, 0, 0, 0.08)' : 'none',
                              }}
                              onMouseEnter={(e) => {
                                if (isClickable) {
                                  e.currentTarget.style.transform = 'scale(1.15)';
                                  e.currentTarget.style.boxShadow = `0 0 10px ${cellColor}88`;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (isClickable) {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)';
                                }
                              }}
                            >
                              {cellChar}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: PUNCH LOG & UNKNOWN TAPS */}
      {/* ========================================================= */}
      {activeTab === 'punches' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setPunchLogSubTab('raw')}
              className={punchLogSubTab === 'raw' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontWeight: 700 }}
            >
              Raw Immutable Punches ({punches.length})
            </button>
            <button
              type="button"
              onClick={() => setPunchLogSubTab('unknown')}
              className={punchLogSubTab === 'unknown' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontWeight: 700 }}
            >
              Unknown &amp; Rejected Taps ({unknownTaps.length})
            </button>
          </div>

          {punchLogSubTab === 'raw' ? (
            <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table emp-punch-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Punch Time (UTC/Local)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Card UID</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Source</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {punches.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No raw punch logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    punches.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {formatDateTime12h(p.punched_at)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontWeight: 700 }}>{p.employee_name}</span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '6px' }}>({p.employee_code})</span>
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>
                          {p.card_uid_snapshot}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ textTransform: 'capitalize', fontSize: '0.84rem' }}>{p.source}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {p.is_void ? (
                            <span style={{ color: 'var(--color-danger)', fontWeight: 800, fontSize: '0.78rem' }}>
                              VOID ({p.void_reason})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-success)', fontWeight: 800, fontSize: '0.78rem' }}>
                              VALID
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!p.is_void && (
                            <button
                              type="button"
                              onClick={() => handleVoidPunch(p)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.76rem', color: 'var(--color-danger)' }}
                              title="Void punch record with mandatory audit reason"
                            >
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table emp-punch-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Timestamp</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Card UID</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Rejection Reason</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unknownTaps.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No unrecognized or rejected taps. All hardware card reads are recognized!
                      </td>
                    </tr>
                  ) : (
                    unknownTaps.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)' }}>
                          {new Date(u.at).toLocaleString()}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                          {u.card_uid}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'var(--color-danger-bg)',
                              color: 'var(--color-danger)',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                            }}
                          >
                            {u.reason}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('directory');
                              showToast(`Assign card UID ${u.card_uid} to a staff member in the Staff Directory below`);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700 }}
                          >
                            Assign to Staff
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: LEAVES & HOLIDAYS */}
      {/* ========================================================= */}
      {activeTab === 'leaves' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setLeaveSubTab('requests')}
                className={leaveSubTab === 'requests' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontWeight: 700 }}
              >
                Leave Requests ({leaveRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveSubTab('holidays')}
                className={leaveSubTab === 'holidays' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontWeight: 700 }}
              >
                Store Holidays ({holidays.length})
              </button>
              <button
                type="button"
                onClick={() => setLeaveSubTab('types')}
                className={leaveSubTab === 'types' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontWeight: 700 }}
              >
                Leave Types ({leaveTypes.length})
              </button>
            </div>

            {leaveSubTab === 'requests' ? (
              <button
                type="button"
                onClick={handleOpenApplyLeave}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Grant / Record Leave</span>
              </button>
            ) : leaveSubTab === 'holidays' ? (
              <button
                type="button"
                onClick={() => setIsAddHolidayOpen(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Add Store Holiday</span>
              </button>
            ) : leaveSubTab === 'types' ? (
              <button
                type="button"
                onClick={() => setIsAddLeaveTypeOpen(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Add Leave Category</span>
              </button>
            ) : null}
          </div>

          {leaveSubTab === 'requests' ? (
            <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table emp-leaves-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Dates</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Duration</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Reason / Notes</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Authorized By</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No leaves recorded or requested yet. Click &quot;Grant / Record Leave&quot; above to log an authorized employee leave.
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 700 }}>
                          <div>{req.employee_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {req.employee_code}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontWeight: 700 }}>{req.leave_type_name}</span>
                          {req.is_paid && <span style={{ color: 'var(--color-success)', fontSize: '0.74rem', marginLeft: '4px' }}>[Paid]</span>}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>
                          {req.from_date} {req.from_date !== req.to_date ? `to ${req.to_date}` : ''}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          {req.half_day ? '0.5 day' : `${req.days_count} day(s)`}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                          {req.reason || '--'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-pill)',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              background:
                                req.status === 'approved'
                                  ? 'var(--color-success-bg)'
                                  : req.status === 'rejected'
                                  ? 'var(--color-danger-bg)'
                                  : req.status === 'cancelled'
                                  ? 'var(--bg-surface-hover)'
                                  : 'var(--color-warning-bg)',
                              color:
                                req.status === 'approved'
                                  ? 'var(--color-success)'
                                  : req.status === 'rejected'
                                  ? 'var(--color-danger)'
                                  : req.status === 'cancelled'
                                  ? 'var(--text-muted)'
                                  : 'var(--color-warning)',
                            }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {req.decided_by_name ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                              <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
                              <span>{req.decided_by_name}</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>--</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleApproveLeave(req.id)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 700 }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectLeave(req.id)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 700 }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : req.status === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => handleCancelLeave(req)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.76rem', color: 'var(--color-danger)', fontWeight: 600 }}
                              title="Cancel leave and refund balance ledger"
                            >
                              Cancel Leave
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>--</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : leaveSubTab === 'holidays' ? (
            <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table emp-leaves-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Holiday Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No holidays scheduled.
                      </td>
                    </tr>
                  ) : (
                    holidays.map((h) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {h.date}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>{h.name}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ color: h.is_paid ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {h.is_paid ? 'Paid Holiday' : 'Unpaid'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete holiday '${h.name}'?`)) return;
                              await deleteHoliday(h.id);
                              showToast('Holiday deleted');
                              loadLeavesAndHolidays();
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.76rem', color: 'var(--color-danger)' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table emp-leaves-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Leave Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Code</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Annual Quota</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Paid Status</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Half-Day</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Carry Forward</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ marginBottom: '12px', fontWeight: 600 }}>No leave categories configured yet.</div>
                        <button
                          type="button"
                          onClick={() => setIsAddLeaveTypeOpen(true)}
                          className="btn btn-primary"
                          style={{ fontWeight: 700 }}
                        >
                          + Add First Leave Category
                        </button>
                      </td>
                    </tr>
                  ) : (
                    leaveTypes.map((lt) => (
                      <tr key={lt.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 700 }}>{lt.name}</td>
                        <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)' }}>{lt.code}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 800 }}>{lt.annual_quota_days} days / year</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              background: lt.is_paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                              color: lt.is_paid ? 'var(--color-success)' : 'var(--text-muted)',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                            }}
                          >
                            {lt.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {lt.allows_half_day ? 'Allowed' : 'Full Day Only'}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {lt.carry_forward ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: SHIFTS & KIOSK DEVICES */}
      {/* ========================================================= */}
      {activeTab === 'shifts' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShiftSubTab('shifts')}
                className={shiftSubTab === 'shifts' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontWeight: 700 }}
              >
                Store Shifts ({shifts.length})
              </button>
              <button
                type="button"
                onClick={() => setShiftSubTab('kiosks')}
                className={shiftSubTab === 'kiosks' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontWeight: 700 }}
              >
                Kiosk Devices ({kiosks.length})
              </button>
            </div>

            {shiftSubTab === 'shifts' ? (
              <button
                type="button"
                onClick={() => setIsAddShiftOpen(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Create Shift</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddKioskOpen(true)}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Plus size={16} />
                <span>Register Kiosk Device</span>
              </button>
            )}
          </div>

          {shiftSubTab === 'shifts' ? (
            <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table emp-shifts-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Shift Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Working Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Grace Late / Early</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Break Allowance</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Store Default</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 800 }}>
                        {s.name}
                        {s.is_overnight && (
                          <span
                            style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366F1',
                              fontSize: '0.72rem',
                            }}
                          >
                            Overnight
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {formatTimeRange12h(s.start_time, s.end_time)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {s.grace_late_minutes}m late / {s.grace_early_leave_minutes}m early
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {s.break_allowance_minutes} mins
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {s.is_default_for_store ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 800, fontSize: '0.8rem' }}>Default</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Optional</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Delete shift '${s.name}'?`)) return;
                            await deleteShift(s.id);
                            showToast('Shift deleted');
                            loadShiftsAndKiosks();
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--color-danger)' }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>
              {createdKioskToken && (
                <div
                  className="card"
                  style={{
                    padding: '20px',
                    marginBottom: '20px',
                    border: '2px solid var(--color-success)',
                    background: 'var(--color-success-bg)',
                  }}
                >
                  <div style={{ fontWeight: 800, color: 'var(--color-success)', marginBottom: '6px' }}>
                    New Kiosk API Token Generated (Copy Now - will not be displayed again):
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-surface)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                      wordBreak: 'break-all',
                    }}
                  >
                    {createdKioskToken}
                  </div>
                </div>
              )}

              <div className="card emp-table-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="table emp-shifts-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-hover)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '14px 20px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Device Name</th>
                      <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Store Branch</th>
                      <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '14px 16px', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Last Seen</th>
                      <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kiosks.map((k) => (
                      <tr key={k.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 700 }}>{k.name}</td>
                        <td style={{ padding: '14px 16px' }}>{k.store_name}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ color: k.is_active ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.78rem' }}>
                            {k.is_active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                          {k.last_seen_at ? new Date(k.last_seen_at).toLocaleString() : 'Never'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Delete kiosk device '${k.name}'?`)) return;
                              await deleteKioskDevice(k.id);
                              showToast('Kiosk deleted');
                              loadShiftsAndKiosks();
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--color-danger)' }}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 8: HR RULES & SETTINGS */}
      {/* ========================================================= */}
      {activeTab === 'settings' && hrSettings && (
        <form onSubmit={handleSaveSettings} style={{ maxWidth: '900px' }}>
          {/* Card 1: Late Arrivals, Cutoff Penalties & Early Departures */}
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#F59E0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Late Arrival, Cutoff Penalties &amp; Early Departure Rules
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Control grace buffers, cutoff thresholds, and automatic salary deductions.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Grace Late Buffer (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={hrSettings.grace_late_minutes ?? 15}
                  onChange={(e) => setHrSettings({ ...hrSettings, grace_late_minutes: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                  title="Allowed minutes late after shift start before late marks begin"
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Allowed late arrival delay with zero penalty (e.g. 15 mins)
                </span>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Grace Early Leave Buffer (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={hrSettings.grace_early_leave_minutes ?? 15}
                  onChange={(e) => setHrSettings({ ...hrSettings, grace_early_leave_minutes: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                  title="Allowed minutes before shift end without early departure penalty"
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Allowed departure before shift end without penalty (e.g. 15 mins)
                </span>
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ marginTop: '3px' }}
                  checked={Boolean(hrSettings.arrival_after_cutoff_half_day)}
                  onChange={(e) => setHrSettings({ ...hrSettings, arrival_after_cutoff_half_day: e.target.checked })}
                />
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Deduct Half Day Salary for Late Arrivals Past Cutoff Threshold
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    If an employee arrives later than the cutoff minutes below, their daily pay credit is capped at 50% (Half Day).
                  </p>
                </div>
              </label>

              {hrSettings.arrival_after_cutoff_half_day && (
                <div style={{ marginTop: '12px', paddingLeft: '24px' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Arrival Cutoff Threshold (Minutes Late)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={hrSettings.arrival_cutoff_minutes ?? 60}
                    onChange={(e) => setHrSettings({ ...hrSettings, arrival_cutoff_minutes: Number(e.target.value) })}
                    className="input-field"
                    style={{ width: '160px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}
                  />
                  <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    (e.g. 60 mins late = half-day penalty automatically triggered)
                  </span>
                </div>
              )}
            </div>

            {/* Late Tiers Table Configurator */}
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Progressive Late Penalty Tiers (Between Grace &amp; Cutoff)
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Define gradual salary deductions based on how many minutes late the employee arrives.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentTiers = hrSettings.late_tiers || [];
                    const lastTo = currentTiers.length > 0 ? (currentTiers[currentTiers.length - 1].to_min + 1) : 16;
                    const newTier = {
                      from_min: lastTo,
                      to_min: lastTo + 15,
                      penalty_kind: 'fraction_of_day',
                      penalty_value: 0.25,
                    };
                    setHrSettings({ ...hrSettings, late_tiers: [...currentTiers, newTier] });
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} />
                  <span>Add Tier</span>
                </button>
              </div>

              {(!hrSettings.late_tiers || hrSettings.late_tiers.length === 0) ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                  No intermediate late tiers configured. Only the hard cutoff penalty applies if enabled above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hrSettings.late_tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 100px 1fr 70px',
                        gap: '10px',
                        alignItems: 'center',
                        background: 'var(--bg-surface)',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>From (Mins)</label>
                        <input
                          type="number"
                          min="1"
                          value={tier.from_min}
                          onChange={(e) => {
                            const updated = [...hrSettings.late_tiers];
                            updated[idx] = { ...updated[idx], from_min: Number(e.target.value) };
                            setHrSettings({ ...hrSettings, late_tiers: updated });
                          }}
                          className="input-field"
                          style={{ width: '100%', padding: '4px 8px', fontSize: '0.84rem', fontWeight: 700 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>To (Mins)</label>
                        <input
                          type="number"
                          min="1"
                          value={tier.to_min}
                          onChange={(e) => {
                            const updated = [...hrSettings.late_tiers];
                            updated[idx] = { ...updated[idx], to_min: Number(e.target.value) };
                            setHrSettings({ ...hrSettings, late_tiers: updated });
                          }}
                          className="input-field"
                          style={{ width: '100%', padding: '4px 8px', fontSize: '0.84rem', fontWeight: 700 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>Daily Salary Deduction</label>
                        <select
                          value={String(tier.penalty_value)}
                          onChange={(e) => {
                            const updated = [...hrSettings.late_tiers];
                            updated[idx] = { ...updated[idx], penalty_value: Number(e.target.value) };
                            setHrSettings({ ...hrSettings, late_tiers: updated });
                          }}
                          className="input-field"
                          style={{ width: '100%', padding: '4px 8px', fontSize: '0.84rem', fontWeight: 700 }}
                        >
                          <option value="0.10">10% of Daily Wage (0.10 Day)</option>
                          <option value="0.25">25% of Daily Wage (0.25 Day)</option>
                          <option value="0.50">50% of Daily Wage (Half Day)</option>
                          <option value="0.75">75% of Daily Wage (0.75 Day)</option>
                          <option value="1.00">100% of Daily Wage (Full Day Lost)</option>
                        </select>
                      </div>

                      <div style={{ textAlign: 'right', paddingTop: '14px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = hrSettings.late_tiers.filter((_, i) => i !== idx);
                            setHrSettings({ ...hrSettings, late_tiers: updated });
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', color: 'var(--color-danger)', fontSize: '0.74rem' }}
                          title="Delete Tier"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* Card 2: Work Time Thresholds & Break Allowances */}
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Cumulative Work Duration &amp; Break Deductions
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Thresholds for 100% pay (Full Day), 50% pay (Half Day), and 0% pay (Absent).
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Full Day Min Worked (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={hrSettings.min_minutes_full_day || 480}
                  onChange={(e) => setHrSettings({ ...hrSettings, min_minutes_full_day: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Total worked time across all sessions for 100% pay (default: 480m = 8h)
                </span>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Half Day Min Worked (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  value={hrSettings.min_minutes_half_day || 240}
                  onChange={(e) => setHrSettings({ ...hrSettings, min_minutes_half_day: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Threshold for 50% pay (default: 240m = 4h). Worked time below this is marked Absent (0% pay).
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Daily Break Allowance (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={hrSettings.break_allowance_minutes ?? 60}
                  onChange={(e) => setHrSettings({ ...hrSettings, break_allowance_minutes: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Cumulative free break time across all punch-outs (default: 60 mins)
                </span>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Missed Punch / Unclosed Session Policy
                </label>
                <select
                  value={hrSettings.missed_punch_policy || 'require_manual_fix'}
                  onChange={(e) => setHrSettings({ ...hrSettings, missed_punch_policy: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value="require_manual_fix">Flag as Needs Review (Manual Fix)</option>
                  <option value="auto_close_at_shift_end">Auto Close at Shift End</option>
                  <option value="count_as_half_day">Auto Count as Half Day</option>
                </select>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Action when employee forgets to punch out
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(hrSettings.deduct_excess_break)}
                  onChange={(e) => setHrSettings({ ...hrSettings, deduct_excess_break: e.target.checked })}
                />
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                    Deduct Excess Breaks from Total Worked Hours
                  </span>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    If total break gaps between multiple sessions exceed the break allowance, the excess is deducted from worked time.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Card 3: Overtime, Multipliers & Hardware Settings */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#6366F1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sliders size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Overtime, Multipliers &amp; Hardware Rules
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Extra work compensation multipliers and RFID tap security buffers.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Store Timezone
                </label>
                <input
                  type="text"
                  value={hrSettings.timezone || 'Asia/Kolkata'}
                  onChange={(e) => setHrSettings({ ...hrSettings, timezone: e.target.value })}
                  className="input-field"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Tap Debounce Window (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  value={hrSettings.debounce_seconds || 60}
                  onChange={(e) => setHrSettings({ ...hrSettings, debounce_seconds: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Prevents accidental double-taps within this window (default: 60s)
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Work on Weekly Off Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  value={hrSettings.work_on_weekly_off_multiplier ?? 1.5}
                  onChange={(e) => setHrSettings({ ...hrSettings, work_on_weekly_off_multiplier: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Pay credit multiplier when working on off-days (e.g. 1.5x)
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem', margin: 0 }}>
                    Store Default Weekly Off Days
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Array.isArray(hrSettings.default_weekly_off_days) ? hrSettings.default_weekly_off_days : [6];
                      setHrSettings({
                        ...hrSettings,
                        default_weekly_off_days: cur.length === 0 ? [6] : []
                      });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-primary, #6366f1)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    {(hrSettings.default_weekly_off_days || []).length === 0 ? 'Set Sunday' : 'Clear All (7-Day Working)'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginTop: '6px', marginBottom: '4px' }}>
                  {[
                    { id: 0, label: 'Mon' },
                    { id: 1, label: 'Tue' },
                    { id: 2, label: 'Wed' },
                    { id: 3, label: 'Thu' },
                    { id: 4, label: 'Fri' },
                    { id: 5, label: 'Sat' },
                    { id: 6, label: 'Sun' },
                  ].map((day) => {
                    const currentOffs = Array.isArray(hrSettings.default_weekly_off_days) ? hrSettings.default_weekly_off_days : [6];
                    const isSelected = currentOffs.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          const nextOffs = isSelected
                            ? currentOffs.filter((d) => d !== day.id)
                            : [...currentOffs, day.id].sort((a, b) => a - b);
                          setHrSettings({
                            ...hrSettings,
                            default_weekly_off_days: nextOffs,
                          });
                        }}
                        style={{
                          padding: '6px 2px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--color-danger, #ef4444)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {(() => {
                    const cur = Array.isArray(hrSettings.default_weekly_off_days) ? hrSettings.default_weekly_off_days : [6];
                    if (cur.length === 0) return '⚡ Store Default: 7-day working (no weekly offs)';
                    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    return `Default Off: ${cur.map((d) => days[d]).join(', ')} (applied to employees without custom shifts)`;
                  })()}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Work on Holiday Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  value={hrSettings.work_on_holiday_multiplier ?? 2.0}
                  onChange={(e) => setHrSettings({ ...hrSettings, work_on_holiday_multiplier: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Pay credit multiplier when working on store holidays (e.g. 2.0x)
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Max Session Length (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={hrSettings.max_session_hours || 16}
                  onChange={(e) => setHrSettings({ ...hrSettings, max_session_hours: Number(e.target.value) })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Auto-close uncompleted sessions after this duration
                </span>
              </div>
            </div>
          </div>

          {/* CARD 4: OVERTIME (OT) RULES & POLICIES */}
          <div
            style={{
              padding: '22px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              border: hrSettings.overtime_enabled ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-color)',
              marginBottom: '24px',
              boxShadow: hrSettings.overtime_enabled ? '0 0 16px rgba(99, 102, 241, 0.08)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--primary)' }}>⚡</span> Card 4: Overtime (OT) Pay, Grace Thresholds & Calculation Policies
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Configure buffer grace before OT accrual, payout rate mode (multiplier vs fixed hourly rate), maximum caps, and manager verification.
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <input
                  type="checkbox"
                  checked={Boolean(hrSettings.overtime_enabled)}
                  onChange={(e) => setHrSettings({ ...hrSettings, overtime_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: hrSettings.overtime_enabled ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  {hrSettings.overtime_enabled ? 'OT Enabled' : 'OT Disabled'}
                </span>
              </label>
            </div>

            {hrSettings.overtime_enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                {/* Row 1: Overtime Trigger & Threshold Buffer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      Overtime Grace Buffer (Minutes after Shift)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={hrSettings.overtime_threshold_minutes ?? 30}
                      onChange={(e) => setHrSettings({ ...hrSettings, overtime_threshold_minutes: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Extra time required after shift ends before OT triggers (e.g. 30 mins)
                    </span>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      Accrual Calculation Point
                    </label>
                    <select
                      value={hrSettings.overtime_count_from || 'shift_end'}
                      onChange={(e) => setHrSettings({ ...hrSettings, overtime_count_from: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 700 }}
                    >
                      <option value="shift_end">From Shift End (includes buffer if triggered)</option>
                      <option value="after_threshold">After Buffer Only (excludes buffer)</option>
                    </select>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {hrSettings.overtime_count_from === 'after_threshold'
                        ? 'Staff working 45m past shift gets 15m paid OT (45m - 30m buffer)'
                        : 'Staff working 45m past shift gets full 45m paid OT once 30m buffer is crossed'}
                    </span>
                  </div>
                </div>

                {/* Row 2: Pay Rate Configuration */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      Overtime Rate Mode
                    </label>
                    <select
                      value={hrSettings.overtime_rate_mode || 'multiplier'}
                      onChange={(e) => setHrSettings({ ...hrSettings, overtime_rate_mode: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 700 }}
                    >
                      <option value="multiplier">Hourly Multiplier (e.g. 1.5x Base Hourly Rate)</option>
                      <option value="fixed">Fixed Rate (₹ Per Hour)</option>
                    </select>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Note: An employee's explicit overtime rate in their salary structure overrides this default.
                    </span>
                  </div>

                  <div>
                    {hrSettings.overtime_rate_mode === 'fixed' ? (
                      <>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                          Default Overtime Hourly Pay (₹ / Hour)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={hrSettings.overtime_default_hourly_rate ?? 0}
                          onChange={(e) => setHrSettings({ ...hrSettings, overtime_default_hourly_rate: Number(e.target.value) })}
                          className="input-field"
                          style={{ width: '100%', fontWeight: 700 }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Fixed hourly rate credited for overtime hours across staff without custom overrides
                        </span>
                      </>
                    ) : (
                      <>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                          Overtime Multiplier (x Normal Wage)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          value={hrSettings.overtime_hourly_rate_multiplier ?? 1.5}
                          onChange={(e) => setHrSettings({ ...hrSettings, overtime_hourly_rate_multiplier: Number(e.target.value) })}
                          className="input-field"
                          style={{ width: '100%', fontWeight: 700 }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Calculated from employee's hourly base pay rate (default: 1.5x)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Row 3: Caps & Approval Guards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      Max Daily OT Cap (Minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="15"
                      value={hrSettings.max_daily_overtime_minutes ?? 240}
                      onChange={(e) => setHrSettings({ ...hrSettings, max_daily_overtime_minutes: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Maximum OT payable per shift day (e.g. 240m = 4 hours)
                    </span>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      Min Qualifying OT (Minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={hrSettings.min_overtime_qualifying_minutes ?? 15}
                      onChange={(e) => setHrSettings({ ...hrSettings, min_overtime_qualifying_minutes: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Ignore accidental OT increments below this minimum
                    </span>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                      Manager Verification
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '6px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(hrSettings.overtime_requires_approval)}
                        onChange={(e) => setHrSettings({ ...hrSettings, overtime_requires_approval: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Require Manager Approval</span>
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      OT must be verified in the Overtime Verification Modal before inclusion in payroll
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '12px' }}>
            <button
              type="submit"
              disabled={settingsLoading}
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontWeight: 800, fontSize: '0.96rem' }}
            >
              {settingsLoading ? 'Saving Settings...' : 'Save All HR Rules & Policies'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================= */}
      {/* TAB 9: PAYROLL STATION */}
      {/* ========================================================= */}
      {activeTab === 'payroll' && (
        <PayrollStation

          store={activeStoreObj}
          currentUser={currentUser}
          employees={employees}
          onShowToast={showToast}
          onReloadLedger={() => {}}
        />
      )}

      {/* ========================================================= */}
      {/* TAB 10: EMPLOYEE LEDGER */}
      {/* ========================================================= */}
      {activeTab === 'ledger' && (
        <EmployeeLedger
          store={activeStoreObj}
          employees={employees}
          onShowToast={showToast}
        />
      )}



      {/* ========================================================= */}
      {/* MODAL: ASSIGN RFID CARD (AUTOMATIC CONTACTLESS SCANNER) */}
      {/* ========================================================= */}
      {activeCardModalEmp && (
        <AssignCardModal
          employee={activeCardModalEmp}
          storeId={selectedStoreId}
          onClose={() => setActiveCardModalEmp(null)}
          onAssigned={loadEmployees}
          onDeactivated={loadEmployees}
          onShowToast={showToast}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: UNIVERSAL CARD INSPECTOR (EMPLOYEE / CUSTOMER)     */}
      {/* ========================================================= */}
      <CardLookupModal
        isOpen={showCardLookup}
        onClose={() => setShowCardLookup(false)}
        sourceArea="employee"
      />

      {/* ========================================================= */}
      {/* MODAL: ASSIGN SHIFT */}
      {/* ========================================================= */}
      {activeShiftModalEmp && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveShiftModalEmp(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Assign Shift: {activeShiftModalEmp.name}
              </h3>
              <button
                type="button"
                onClick={() => setActiveShiftModalEmp(null)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignShiftSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Select Shift</label>
                  <select
                    value={shiftAssignData.shift_id}
                    onChange={(e) => setShiftAssignData({ ...shiftAssignData, shift_id: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    <option value="">Store Default Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name} ({formatTimeRange12h(s.start_time, s.end_time)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Effective From Date</label>
                  <input
                    type="date"
                    required
                    value={shiftAssignData.from_date}
                    onChange={(e) => setShiftAssignData({ ...shiftAssignData, from_date: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Weekly Off Days</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          // Toggle between Store Default and Custom
                          const isStoreDef = shiftAssignData.weekly_off_days === null;
                          setShiftAssignData({
                            ...shiftAssignData,
                            weekly_off_days: isStoreDef ? (hrSettings?.default_weekly_off_days || [6]) : null
                          });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--brand-primary, #6366f1)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        {shiftAssignData.weekly_off_days === null ? 'Customize Off Days' : 'Use Store Default'}
                      </button>
                    </div>
                  </div>

                  {shiftAssignData.weekly_off_days === null ? (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Following <strong>Store Default</strong>: {(() => {
                        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        const storeOffs = hrSettings?.default_weekly_off_days || [6];
                        return storeOffs.length === 0 ? 'No Weekly Off (7 Days Working)' : storeOffs.map((d) => days[d]).join(', ');
                      })()}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
                        {[
                          { id: 0, label: 'Mon' },
                          { id: 1, label: 'Tue' },
                          { id: 2, label: 'Wed' },
                          { id: 3, label: 'Thu' },
                          { id: 4, label: 'Fri' },
                          { id: 5, label: 'Sat' },
                          { id: 6, label: 'Sun' },
                        ].map((day) => {
                          const currentOffs = Array.isArray(shiftAssignData.weekly_off_days) ? shiftAssignData.weekly_off_days : [];
                          const isSelected = currentOffs.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => {
                                const nextOffs = isSelected
                                  ? currentOffs.filter((d) => d !== day.id)
                                  : [...currentOffs, day.id].sort((a, b) => a - b);
                                setShiftAssignData({
                                  ...shiftAssignData,
                                  weekly_off_days: nextOffs,
                                });
                              }}
                              style={{
                                padding: '8px 4px',
                                borderRadius: '8px',
                                border: isSelected ? '1px solid var(--color-danger, #ef4444)' : '1px solid var(--border-subtle)',
                                background: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
                                color: isSelected ? 'var(--color-danger, #ef4444)' : 'var(--text-secondary)',
                                fontWeight: isSelected ? 800 : 600,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {(() => {
                            const currentOffs = Array.isArray(shiftAssignData.weekly_off_days) ? shiftAssignData.weekly_off_days : [];
                            if (currentOffs.length === 0) return '⚡ 7-Day Working: No weekly off days set';
                            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                            return `Weekly Off: ${currentOffs.map((d) => days[d]).join(', ')} (${currentOffs.length} ${currentOffs.length === 1 ? 'day' : 'days'}/week)`;
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentOffs = Array.isArray(shiftAssignData.weekly_off_days) ? shiftAssignData.weekly_off_days : [];
                            setShiftAssignData({
                              ...shiftAssignData,
                              weekly_off_days: currentOffs.length === 0 ? [6] : [],
                            });
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                        >
                          {(shiftAssignData.weekly_off_days || []).length === 0 ? 'Set Sunday Off' : 'Clear All (No Weekly Off)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setActiveShiftModalEmp(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Assign Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: STORE TRANSFER */}
      {/* ========================================================= */}
      {activeTransferModalEmp && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveTransferModalEmp(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Transfer Employee Store
              </h3>
              <button
                type="button"
                onClick={() => setActiveTransferModalEmp(null)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">New Store Branch *</label>
                  <select
                    required
                    value={transferData.store_id}
                    onChange={(e) => setTransferData({ ...transferData, store_id: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    <option value="">Select Target Store...</option>
                    {stores
                      .filter((s) => String(s.id) !== String(activeTransferModalEmp.store))
                      .map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Effective Date *</label>
                  <input
                    type="date"
                    required
                    value={transferData.effective_date}
                    onChange={(e) => setTransferData({ ...transferData, effective_date: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label className="form-label">Transfer Notes / Reason</label>
                  <input
                    type="text"
                    value={transferData.notes}
                    onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="e.g. Branch expansion reassignment"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setActiveTransferModalEmp(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ATTENDANCE STATUS OVERRIDE */}
      {/* ========================================================= */}
      {activeOverrideRecord && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveOverrideRecord(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Override Status: {activeOverrideRecord.employee_name}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOverrideRecord(null)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOverrideSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Status Override *</label>
                  <select
                    value={overrideStatusVal}
                    onChange={(e) => setOverrideStatusVal(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    <option value="present">Present (Full Day)</option>
                    <option value="half_day">Half Day</option>
                    <option value="absent">Absent</option>
                    <option value="paid_leave">Paid Leave</option>
                    <option value="unpaid_leave">Unpaid Leave</option>
                    <option value="weekly_off">Weekly Off</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Mandatory Reason *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide mandatory reason for manual override audit log..."
                    value={overrideReasonVal}
                    onChange={(e) => setOverrideReasonVal(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setActiveOverrideRecord(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MANUAL PUNCH */}
      {/* ========================================================= */}
      {isManualPunchOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsManualPunchOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Record Manual Punch</h3>
              <button
                type="button"
                onClick={() => setIsManualPunchOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualPunchSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Employee *</label>
                  <select
                    required
                    value={manualPunchData.employee_id}
                    onChange={(e) => setManualPunchData({ ...manualPunchData, employee_id: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Punch Datetime *</label>
                  <input
                    type="datetime-local"
                    required
                    value={manualPunchData.punched_at}
                    onChange={(e) => setManualPunchData({ ...manualPunchData, punched_at: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label className="form-label">Mandatory Note / Explanation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Forgot card at home, verified by supervisor"
                    value={manualPunchData.note}
                    onChange={(e) => setManualPunchData({ ...manualPunchData, note: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsManualPunchOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Save &amp; Rebuild Day
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SESSIONS & TIMELINE INSPECTOR */}
      {/* ========================================================= */}
      {activeSessionsDay && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveSessionsDay(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {activeSessionsDay.employee_name}
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Business Date: {activeSessionsDay.business_date}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSessionsDay(null)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Paired Clock Sessions ({activeSessionsDay.sessions?.length || 0})
              </h4>
              {(!activeSessionsDay.sessions || activeSessionsDay.sessions.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface-hover)', borderRadius: 'var(--radius-md)' }}>
                  No active paired sessions for this business date.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeSessionsDay.sessions.map((sess, idx) => (
                    <div
                      key={sess.id || idx}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                          Session #{idx + 1}
                        </span>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          IN: {formatTime12h(sess.in_at)}
                          {' → '}
                          OUT: {sess.out_at ? formatTime12h(sess.out_at) : 'Still Open'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-success)' }}>
                          {sess.duration_minutes} mins
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActiveSessionsDay(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MONTH DOSSIER SUMMARY */}
      {/* ========================================================= */}
      {activeSummaryModalEmp && empMonthSummaryData && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveSummaryModalEmp(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '640px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
                  {activeSummaryModalEmp.name}
                </h3>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Stage 2 Payroll Ready Dossier • {empMonthSummaryData.year}-{String(empMonthSummaryData.month).padStart(2, '0')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSummaryModalEmp(null)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '12px', background: 'var(--bg-surface-hover)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Worked</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{empMonthSummaryData.total_worked_hours} hrs</div>
              </div>

              <div className="card" style={{ padding: '12px', background: 'var(--bg-surface-hover)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payable Days</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-success)' }}>
                  {empMonthSummaryData.total_day_fraction_paid} d
                </div>
              </div>

              <div className="card" style={{ padding: '12px', background: 'var(--bg-surface-hover)' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Late Arrivals</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: empMonthSummaryData.total_late_count > 0 ? 'var(--color-warning)' : 'inherit' }}>
                  {empMonthSummaryData.total_late_count}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.86rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Monthly Day Counts
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(empMonthSummaryData.counts || {}).map(([st, cnt]) => (
                  <span
                    key={st}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--bg-surface-hover)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {st}: {cnt}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActiveSummaryModalEmp(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT DAY ATTENDANCE FROM MATRIX */}
      {/* ========================================================= */}
      {matrixEditDayData && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !matrixEditSubmitting) {
              setMatrixEditDayData(null);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-floating), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative',
              maxHeight: '92vh',
              overflowY: 'auto',
              color: 'var(--text-primary)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(197, 34, 36, 0.12)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CalendarCheck size={20} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Edit Day Attendance
                  </h3>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{matrixEditDayData.employee.employee_name}</strong>
                  {' '}&bull;{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{matrixEditDayData.employee.employee_code}</span>
                  {' '}&bull;{' '}
                  <span style={{ fontWeight: 600 }}>{matrixEditDayData.dateStr}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMatrixEditDayData(null)}
                style={{
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition-smooth)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Manual Override Indicator Banner */}
            {(matrixEditDayData.dayInfo?.flags?.includes('manual_override') || matrixEditDayData.dayInfo?.override_status) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: '16px',
                  fontSize: '0.84rem',
                  color: 'var(--color-warning)',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Manual Override Active: <strong>{matrixEditDayData.dayInfo?.override_status?.toUpperCase()}</strong>
                    {matrixEditDayData.dayInfo?.override_reason ? ` (${matrixEditDayData.dayInfo.override_reason})` : ''}
                  </span>
                </div>
                {matrixEditDayData.dayInfo?.id && (
                  <button
                    type="button"
                    onClick={handleClearMatrixDayOverride}
                    disabled={matrixEditSubmitting}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '4px 10px', fontWeight: 700, flexShrink: 0 }}
                  >
                    <RotateCcw size={12} style={{ marginRight: '4px' }} />
                    Reset to Raw
                  </button>
                )}
              </div>
            )}

            {/* Shift banner if employee has assigned shift */}
            {matrixEditDayData.employee.shift_name && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '18px',
                  fontSize: '0.84rem',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned Shift: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{matrixEditDayData.employee.shift_name}</strong>{' '}
                  <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>
                    ({matrixEditDayData.employee.shift_time_range_12h || `${matrixEditDayData.employee.shift_start} - ${matrixEditDayData.employee.shift_end}`})
                  </span>
                </div>
                {matrixEditDayData.employee.shift_start && matrixEditDayData.employee.shift_end && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '4px 10px', fontWeight: 700 }}
                    onClick={() => {
                      const sStart = matrixEditDayData.employee.shift_start;
                      const sEnd = matrixEditDayData.employee.shift_end;
                      const hrs = calculateHoursBetween(sStart, sEnd);
                      setMatrixEditDayData((prev) => ({
                        ...prev,
                        status: 'present',
                        inTime: sStart,
                        outTime: sEnd,
                        workedHours: hrs || '9.0',
                      }));
                    }}
                  >
                    Auto-Fill Shift Hours
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSaveMatrixEditDay}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    Attendance Status
                  </label>
                  <select
                    className="input-field"
                    value={matrixEditDayData.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      const isWorking = newStatus === 'present' || newStatus === 'half_day';
                      const defIn = isWorking ? (matrixEditDayData.inTime || matrixEditDayData.employee.shift_start || '09:00') : '';
                      const defOut = isWorking ? (matrixEditDayData.outTime || matrixEditDayData.employee.shift_end || '18:00') : '';
                      const hrs = isWorking ? calculateHoursBetween(defIn, defOut) : '0.0';
                      setMatrixEditDayData((prev) => ({
                        ...prev,
                        status: newStatus,
                        inTime: defIn,
                        outTime: defOut,
                        workedHours: hrs,
                      }));
                    }}
                  >
                    <option value="present">Present (Full Day Credit - 1.0)</option>
                    <option value="half_day">Half Day (0.5 Day Credit)</option>
                    <option value="paid_leave">Paid Leave (1.0 Day Credit)</option>
                    <option value="unpaid_leave">Unpaid Leave (0.0 Day Credit)</option>
                    <option value="weekly_off">Weekly Off</option>
                    <option value="holiday">Holiday</option>
                    <option value="absent">Absent (0.0 Day Credit)</option>
                  </select>
                </div>

                {/* Conditional Check-In/Out or Non-Working Notice */}
                {(matrixEditDayData.status === 'present' || matrixEditDayData.status === 'half_day') ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                          Actual Check-In Time
                        </label>
                        <input
                          type="time"
                          className="input-field"
                          value={matrixEditDayData.inTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            const hrs = calculateHoursBetween(val, matrixEditDayData.outTime);
                            setMatrixEditDayData((prev) => ({ ...prev, inTime: val, workedHours: hrs }));
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                          Actual Check-Out Time
                        </label>
                        <input
                          type="time"
                          className="input-field"
                          value={matrixEditDayData.outTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            const hrs = calculateHoursBetween(matrixEditDayData.inTime, val);
                            setMatrixEditDayData((prev) => ({ ...prev, outTime: val, workedHours: hrs }));
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} style={{ color: 'var(--color-success)' }} />
                          <span>Paid Worked Hours</span>
                        </label>
                        {matrixEditDayData.inTime && matrixEditDayData.outTime && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: 600 }}
                            onClick={() => {
                              const hrs = calculateHoursBetween(matrixEditDayData.inTime, matrixEditDayData.outTime);
                              setMatrixEditDayData((prev) => ({ ...prev, workedHours: hrs }));
                            }}
                          >
                            Recalculate ({calculateHoursBetween(matrixEditDayData.inTime, matrixEditDayData.outTime)} hrs)
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="24"
                          className="input-field"
                          style={{ maxWidth: '120px', fontWeight: 700 }}
                          value={matrixEditDayData.workedHours || ''}
                          onChange={(e) => {
                            setMatrixEditDayData((prev) => ({ ...prev, workedHours: e.target.value }));
                          }}
                          placeholder="e.g. 9.0"
                        />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>hours (saved as actual worked duration)</span>
                      </div>
                    </div>
                  </div>

                ) : (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-hover)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Clock size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span>
                      Marking as <strong>{matrixEditDayData.status.replace('_', ' ').toUpperCase()}</strong>. Check-in/out timestamps and worked hours are omitted for non-present days.
                    </span>
                  </div>
                )}

                {/* Quick chip presets for reason */}
                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    <span>Audit Reason <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Required for audit trail</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {[
                      'Forgot RFID card',
                      'Kiosk reader offline',
                      'Power outage',
                      'Shift timing adjustment',
                      'Verified by store manager',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMatrixEditDayData((prev) => ({ ...prev, reason: preset }))}
                        style={{
                          background: matrixEditDayData.reason === preset ? 'rgba(197, 34, 36, 0.12)' : 'var(--bg-surface-hover)',
                          color: matrixEditDayData.reason === preset ? 'var(--brand-primary)' : 'var(--text-secondary)',
                          border: matrixEditDayData.reason === preset ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-pill)',
                          padding: '4px 12px',
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          transition: 'var(--transition-smooth)',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    className="input-field"
                    placeholder="Provide detailed explanation for this manual entry..."
                    value={matrixEditDayData.reason}
                    onChange={(e) => setMatrixEditDayData((prev) => ({ ...prev, reason: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={matrixEditSubmitting}
                  onClick={() => setMatrixEditDayData(null)}
                  style={{ padding: '8px 18px', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={matrixEditSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 22px', fontWeight: 800 }}
                >
                  {matrixEditSubmitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Save Attendance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SALARY STRUCTURE */}
      {/* ========================================================= */}
      {activeSalaryModalEmp && (
        <SalaryStructureModal
          employee={activeSalaryModalEmp}
          storeId={selectedStoreId}
          onClose={() => setActiveSalaryModalEmp(null)}
          onUpdated={loadEmployees}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: GRANT / RECORD LEAVE */}
      {/* ========================================================= */}
      {isApplyLeaveOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsApplyLeaveOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Grant / Record Employee Leave
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Authorized leave is recorded directly in the balance ledger and logged under your name.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyLeaveOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Select Employee *</label>
                  <select
                    required
                    value={leaveFormData.employee_id}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, employee_id: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 600 }}
                  >
                    <option value="">-- Choose Team Member --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employee_code}){emp.role_name ? ` - ${emp.role_name}` : ''}{emp.section ? ` (${emp.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Leave Type *</label>
                    <button
                      type="button"
                      onClick={() => setIsAddLeaveTypeOpen(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                    >
                      + New Category
                    </button>
                  </div>
                  <select
                    required
                    value={leaveFormData.leave_type_id}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, leave_type_id: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 600 }}
                  >
                    <option value="">-- Choose Leave Category --</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.code}) {lt.is_paid ? '• Paid' : '• Unpaid'} (Quota: {lt.annual_quota_days}d/yr)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">From Date *</label>
                    <input
                      type="date"
                      required
                      value={leaveFormData.from_date}
                      onChange={(e) => {
                        const newFrom = e.target.value;
                        setLeaveFormData({
                          ...leaveFormData,
                          from_date: newFrom,
                          to_date: leaveFormData.to_date < newFrom ? newFrom : leaveFormData.to_date,
                        });
                      }}
                      className="input-field"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <label className="form-label">To Date *</label>
                    <input
                      type="date"
                      required
                      min={leaveFormData.from_date}
                      value={leaveFormData.to_date}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, to_date: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={leaveFormData.half_day}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, half_day: e.target.checked })}
                    />
                    <span>Half Day Leave (0.5 day)</span>
                  </label>

                  {leaveFormData.half_day && (
                    <select
                      value={leaveFormData.half_day_period}
                      onChange={(e) => setLeaveFormData({ ...leaveFormData, half_day_period: e.target.value })}
                      className="input-field"
                      style={{ padding: '4px 10px', fontSize: '0.84rem' }}
                    >
                      <option value="first_half">First Half</option>
                      <option value="second_half">Second Half</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="form-label">Reason / Authorization Notes *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Approved medical leave, family emergency, or requested advance leave"
                    value={leaveFormData.reason}
                    onChange={(e) => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.82rem',
                    color: 'var(--color-success)',
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Instant Authority Approval:</strong> This leave will be immediately authorized, debited from the employee&apos;s quota ledger, and attributed to you in the audit log.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsApplyLeaveOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Grant Leave &amp; Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD STORE HOLIDAY */}
      {/* ========================================================= */}
      {isAddHolidayOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddHolidayOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Add Store Holiday
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Creates a store holiday and updates attendance records for this date.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddHolidayOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddHolidaySubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Holiday Date *</label>
                  <input
                    type="date"
                    required
                    value={holidayFormData.date}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, date: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label className="form-label">Holiday Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gandhi Jayanti, Diwali, Store Annual Day"
                    value={holidayFormData.name}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, name: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={holidayFormData.is_paid}
                      onChange={(e) => setHolidayFormData({ ...holidayFormData, is_paid: e.target.checked })}
                    />
                    <span><strong>Paid Holiday</strong> (Employees receive full day fraction pay)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddHolidayOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Save Store Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD LEAVE TYPE */}
      {isAddLeaveTypeOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddLeaveTypeOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Add Leave Category
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Configure a new company leave type with quota and pay rules.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddLeaveTypeOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLeaveTypeSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maternity Leave, Bereavement Leave"
                    value={leaveTypeFormData.name}
                    onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, name: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Code / Abbr *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ML, BL, PL"
                      maxLength={10}
                      value={leaveTypeFormData.code}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, code: e.target.value.toUpperCase() })}
                      className="input-field"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label className="form-label">Annual Quota (Days) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      required
                      value={leaveTypeFormData.annual_quota_days}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, annual_quota_days: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={leaveTypeFormData.is_paid}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, is_paid: e.target.checked })}
                    />
                    <span><strong>Paid Leave</strong> (Preserves day fraction pay)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={leaveTypeFormData.allows_half_day}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, allows_half_day: e.target.checked })}
                    />
                    <span>Allow Half-Day applications</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={leaveTypeFormData.carry_forward}
                      onChange={(e) => setLeaveTypeFormData({ ...leaveTypeFormData, carry_forward: e.target.checked })}
                    />
                    <span>Allow Carry Forward into next financial year</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddLeaveTypeOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Save Leave Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / CONFIGURE SHIFT */}
      {/* ========================================================= */}
      {isAddShiftOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddShiftOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Configure Store Shift</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Set scheduled hours, late grace buffer, minimum time thresholds, and break allowance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddShiftOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateShiftSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Shift Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. General Shift, Morning Shift, Night Shift"
                    value={shiftFormData.name}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, name: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={shiftFormData.start_time}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, start_time: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label className="form-label">End Time *</label>
                    <input
                      type="time"
                      required
                      value={shiftFormData.end_time}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, end_time: e.target.value })}
                      className="input-field"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Grace Late (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={shiftFormData.grace_late_minutes}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, grace_late_minutes: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 600 }}
                      title="Minutes after start time allowed without late penalty"
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Allowed late arrival buffer</span>
                  </div>
                  <div>
                    <label className="form-label">Grace Early Leave (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={shiftFormData.grace_early_leave_minutes}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, grace_early_leave_minutes: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 600 }}
                      title="Minutes before shift end allowed without penalty"
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Allowed early leave buffer</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Min Full Day (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={shiftFormData.min_minutes_full_day}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, min_minutes_full_day: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Required for 100% pay (e.g. 480m = 8h)</span>
                  </div>
                  <div>
                    <label className="form-label">Min Half Day (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      value={shiftFormData.min_minutes_half_day}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, min_minutes_half_day: Number(e.target.value) })}
                      className="input-field"
                      style={{ width: '100%', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Threshold for 50% pay (e.g. 240m = 4h)</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">Break Allowance (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={shiftFormData.break_allowance_minutes}
                    onChange={(e) => setShiftFormData({ ...shiftFormData, break_allowance_minutes: Number(e.target.value) })}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Allowed cumulative break time across multiple punch-outs</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={shiftFormData.is_overnight}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, is_overnight: e.target.checked })}
                    />
                    <span><strong>Overnight Shift</strong> (Spans midnight into the next day)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={shiftFormData.is_default_for_store}
                      onChange={(e) => setShiftFormData({ ...shiftFormData, is_default_for_store: e.target.checked })}
                    />
                    <span><strong>Default Shift for Store</strong> (Applies to all unassigned staff)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddShiftOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REGISTER KIOSK DEVICE */}
      {/* ========================================================= */}
      {isAddKioskOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddKioskOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(11, 14, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              backgroundColor: 'var(--bg-surface-solid, #FFFFFF)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Register Kiosk Terminal</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Authorizes a contactless RFID hardware kiosk or tablet for this store branch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddKioskOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateKioskSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Kiosk Terminal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Front Entrance Kiosk, Staff Room Terminal"
                    value={kioskNameInput}
                    onChange={(e) => setKioskNameInput(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsAddKioskOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  Generate Device Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Profile Photo Modal */}
      {lightboxImage && (
        <ProfileLightboxModal
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}

