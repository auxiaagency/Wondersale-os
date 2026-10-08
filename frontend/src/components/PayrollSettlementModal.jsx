import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Wallet,
  Building2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Users,
  Minus,
  ShieldCheck,
} from "lucide-react";
import { fetchPayrollPreview, fetchRegisterShifts, settleInterimPayroll } from "../api";
import OvertimeVerificationModal from "./OvertimeVerificationModal";

function fmtINR(val) {
  const num = parseFloat(val || 0);
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtMin(min) {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash from Register", icon: Banknote },
  { value: "upi", label: "UPI / Online", icon: Wallet },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "other", label: "Other", icon: CreditCard },
];

export default function PayrollSettlementModal({
  store,
  year,
  month,
  proceedUnresolved: parentProceedUnresolved = false,
  onProceedUnresolvedChange,
  onClose,
  onDone,
  onShowToast,
}) {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState({}); // {emp_id: {included, action, paymentMethod, shiftId, note}}
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [includeClosedShifts, setIncludeClosedShifts] = useState(false);
  const [result, setResult] = useState(null); // settlement result
  const [proceedUnresolved, setProceedUnresolved] = useState(parentProceedUnresolved);
  const [isOTVerifyModalOpen, setIsOTVerifyModalOpen] = useState(false);

  useEffect(() => {
    setProceedUnresolved(parentProceedUnresolved);
  }, [parentProceedUnresolved]);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [previewData, shiftsData] = await Promise.all([
        fetchPayrollPreview(store.id, year, month),
        fetchRegisterShifts(store.id, false),
      ]);
      const emps = (previewData.employees || []).filter((e) => e.has_pending);
      setEmployees(emps);
      setShifts(shiftsData.shifts || []);

      // Initialize settings per employee
      const defaultShiftId = shiftsData.shifts?.[0]?.id || null;
      const init = {};
      emps.forEach((e) => {
        init[e.employee_id] = {
          included: true,
          action: "pay_now",
          paymentMethod: "cash",
          shiftId: defaultShiftId,
          note: "",
        };
      });
      setSettings(init);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, "danger");
    } finally {
      setLoading(false);
    }
  }, [store.id, year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadShifts = useCallback(async () => {
    try {
      const shiftsData = await fetchRegisterShifts(store.id, includeClosedShifts);
      setShifts(shiftsData.shifts || []);
    } catch (err) {
      // silently fail
    }
  }, [store.id, includeClosedShifts]);

  // Reload shifts when user toggles "show closed" — loadData already handles the initial fetch
  useEffect(() => {
    if (!includeClosedShifts) return; // loadData fetched open shifts already
    loadShifts();
  }, [loadShifts, includeClosedShifts]);

  const updateSetting = (empId, key, value) => {
    setSettings((prev) => ({ ...prev, [empId]: { ...prev[empId], [key]: value } }));
  };

  const toggleAll = (included) => {
    setSettings((prev) => {
      const next = { ...prev };
      employees.forEach((e) => { next[e.employee_id] = { ...next[e.employee_id], included }; });
      return next;
    });
  };

  const selectedEmps = employees.filter((e) => settings[e.employee_id]?.included);
  const totalAmount = selectedEmps.reduce((sum, e) => sum + parseFloat(e.pending_amount || 0), 0);

  const unverifiedEmps = selectedEmps.filter(
    (e) => (e.unverified_ot_days && e.unverified_ot_days > 0) || (e.unreviewed_days && e.unreviewed_days > 0)
  );
  const hasUnverifiedWarning = unverifiedEmps.length > 0;

  const cashPayNowEmps = selectedEmps.filter(
    (e) => settings[e.employee_id]?.action === "pay_now" && settings[e.employee_id]?.paymentMethod === "cash"
  );

  const hasShiftWarning = cashPayNowEmps.some((e) => {
    const sId = settings[e.employee_id]?.shiftId;
    const shift = shifts.find((s) => s.id === parseInt(sId));
    return !shift;
  });

  const postCloseWarnings = cashPayNowEmps.filter((e) => {
    const sId = settings[e.employee_id]?.shiftId;
    const shift = shifts.find((s) => s.id === parseInt(sId));
    return shift?.is_post_close;
  });

  const handleSettle = async () => {
    if (selectedEmps.length === 0) {
      if (onShowToast) onShowToast("No employees selected.", "danger");
      return;
    }

    // Safety guard: Stop user if unverified overtime / unreviewed attendance days exist and proceedUnresolved is not checked
    if (!proceedUnresolved && hasUnverifiedWarning) {
      const first = unverifiedEmps[0];
      const detail =
        first.unverified_ot_days > 0
          ? `${first.unverified_ot_days} overtime day${first.unverified_ot_days > 1 ? "s were" : " was"} not verified for ${first.employee_name}`
          : `${first.unreviewed_days} attendance day${first.unreviewed_days > 1 ? "s need" : " needs"} review for ${first.employee_name}`;
      const msg = `Cannot process interim settlement: ${detail}. Please verify overtime before paying the interim salary, or check "Proceed if unreviewed days".`;
      if (onShowToast) onShowToast(msg, "warning");
      return;
    }

    setSaving(true);
    try {
      const settlements = selectedEmps.map((e) => {
        const cfg = settings[e.employee_id];
        return {
          employee_id: e.employee_id,
          action: cfg.action,
          payment_method: cfg.paymentMethod,
          register_shift_id: cfg.action === "pay_now" && cfg.paymentMethod === "cash" ? cfg.shiftId : null,
          note: cfg.note,
        };
      });
      const res = await settleInterimPayroll(store.id, settlements, proceedUnresolved);
      setResult(res);
      if (onShowToast) onShowToast(`Settled wages for ${res.settled_count} employee${res.settled_count !== 1 ? "s" : ""} · ${fmtINR(res.total_amount)}`);
      onDone && onDone();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div className="card" style={{ width: "100%", maxWidth: "560px", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}>
          <div style={{ padding: "32px 28px", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={32} style={{ color: "#10B981" }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: 8 }}>Settlement Complete</div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginBottom: 24 }}>
              {result.settled_count} employee{result.settled_count !== 1 ? "s" : ""} settled · {fmtINR(result.total_amount)} total
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", textAlign: "left", marginBottom: 24 }}>
              {(result.settlements || []).map((r, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: r.status === "settled" ? "rgba(16,185,129,0.07)" : "rgba(239,68,68,0.07)", marginBottom: 6 }}>
                  {r.status === "settled" ? <CheckCircle2 size={16} style={{ color: "#10B981", flexShrink: 0 }} /> : <AlertTriangle size={16} style={{ color: "#EF4444", flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.86rem" }}>{r.employee_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      {r.status === "settled" ? `${fmtINR(r.amount)} · ${r.days_settled} days · ${r.settlement_ref}${r.counter_payout_number ? ` · ${r.counter_payout_number}` : ""}${r.is_post_close ? " ⚠ Post-Close" : ""}` : r.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn btn-primary" style={{ fontWeight: 800, width: "100%", padding: "12px" }}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: "100%", maxWidth: "920px", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45)", marginBottom: 24 }}>
        {/* Header */}
        <div style={{ padding: "24px 28px", background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.08))", borderBottom: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Banknote size={22} style={{ color: "#10B981" }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Interim Wage Settlement</div>
              <div style={{ fontSize: "0.82rem", opacity: 0.7, marginTop: 2 }}>
                {monthNames[month - 1]} {year} · {store?.name}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
            <X size={20} />
          </button>
        </div>

        {/* Summary Bar */}
        {!loading && employees.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--border-subtle)" }}>
            {[
              { label: "Employees with Pending Wages", value: employees.length, color: "#6366F1", sub: `${selectedEmps.length} selected` },
              { label: "Total Pending Amount", value: fmtINR(employees.reduce((s, e) => s + parseFloat(e.pending_amount || 0), 0)), color: "#10B981" },
              { label: "Amount to Settle", value: fmtINR(totalAmount), color: "#F59E0B", sub: `${selectedEmps.length} employees` },
            ].map((s, i) => (
              <div key={i} style={{ padding: "14px 20px", borderRight: i < 2 ? "1px solid var(--border-subtle)" : "none", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", marginTop: 2 }}>{s.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Unverified Overtime / Unreviewed Days Warning Banner */}
        {hasUnverifiedWarning && (
          <div
            style={{
              padding: "14px 20px",
              background: "rgba(245, 158, 11, 0.12)",
              borderBottom: "1px solid rgba(245, 158, 11, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: "280px" }}>
              <AlertTriangle size={18} style={{ color: "#D97706", flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: "0.84rem", color: "#B45309", fontWeight: 800 }}>
                  {unverifiedEmps.length} selected employee{unverifiedEmps.length > 1 ? "s have" : " has"} unverified overtime.
                </span>
                <span style={{ fontSize: "0.78rem", color: "#92400E", display: "block", marginTop: 2 }}>
                  Overtime must be verified to pay interim salary, or check &quot;Proceed if unreviewed days&quot; to bypass.
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => setIsOTVerifyModalOpen(true)}
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  color: "#B45309",
                  borderColor: "rgba(245, 158, 11, 0.5)",
                  background: "#FFFBEB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <ShieldCheck size={15} />
                <span>Verify Overtime Now</span>
              </button>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  background: "var(--bg-primary, #FFFFFF)",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <input
                  type="checkbox"
                  checked={proceedUnresolved}
                  onChange={(e) => {
                    setProceedUnresolved(e.target.checked);
                    if (onProceedUnresolvedChange) onProceedUnresolvedChange(e.target.checked);
                  }}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                <span>Proceed if unreviewed days</span>
              </label>
            </div>
          </div>
        )}

        {/* Warnings */}
        {postCloseWarnings.length > 0 && (
          <div style={{ padding: "12px 20px", background: "rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} style={{ color: "#F59E0B", flexShrink: 0 }} />
            <span style={{ fontSize: "0.82rem", color: "#F59E0B", fontWeight: 700 }}>
              {postCloseWarnings.length} employee{postCloseWarnings.length > 1 ? "s are" : " is"} being paid from a <strong>closed register</strong>. These payouts will appear as post-close deductions in the shift's net handover cash.
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Users size={14} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Select:</span>
          <button onClick={() => toggleAll(true)} className="btn btn-secondary" style={{ fontSize: "0.76rem", padding: "5px 10px" }}>All</button>
          <button onClick={() => toggleAll(false)} className="btn btn-secondary" style={{ fontSize: "0.76rem", padding: "5px 10px" }}>None</button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", cursor: "pointer" }}>
              <input type="checkbox" checked={includeClosedShifts} onChange={(e) => setIncludeClosedShifts(e.target.checked)} />
              <span style={{ color: "var(--text-secondary)" }}>Show closed shifts</span>
            </label>
          </div>
        </div>

        {/* Employee List */}
        <div style={{ maxHeight: "52vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
              <Clock size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
              <div>Loading settlement data…</div>
            </div>
          ) : employees.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <CheckCircle2 size={40} style={{ color: "#10B981", marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>All Wages Settled</div>
              <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginTop: 4 }}>
                No pending unsettled wages for {monthNames[month - 1]} {year}.
              </div>
            </div>
          ) : (
            employees.map((emp, idx) => {
              const cfg = settings[emp.employee_id] || {};
              const isExpanded = expandedId === emp.employee_id;
              const isCash = cfg.paymentMethod === "cash";
              const selectedShift = shifts.find((s) => s.id === parseInt(cfg.shiftId));

              return (
                <div
                  key={emp.employee_id}
                  style={{ borderBottom: idx < employees.length - 1 ? "1px solid var(--border-subtle)" : "none", opacity: cfg.included ? 1 : 0.5, transition: "opacity 0.2s" }}
                >
                  {/* Main Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 130px 140px 180px 40px", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer" }}
                    onClick={() => setExpandedId(isExpanded ? null : emp.employee_id)}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={cfg.included || false}
                      onChange={(e) => { e.stopPropagation(); updateSetting(emp.employee_id, "included", e.target.checked); }}
                      style={{ width: 18, height: 18, cursor: "pointer" }}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Name */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{emp.employee_name}</div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: 2 }}>
                        {emp.employee_code} · {emp.structure_mode === "daily" ? "Daily Wage" : "Monthly"}
                        {emp.unverified_ot_days > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOTVerifyModalOpen(true);
                            }}
                            style={{
                              marginLeft: 8,
                              background: "rgba(245,158,11,0.15)",
                              color: "#B45309",
                              border: "1px solid rgba(245,158,11,0.4)",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            title="Click to review and verify overtime for this employee"
                          >
                            ⚠ {emp.unverified_ot_days} unverified OT (Verify)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Days */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Unsettled Days</div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "#6366F1", marginTop: 2 }}>{emp.unsettled_days}</div>
                      {emp.pending_ot_minutes > 0 && (
                        <div style={{ fontSize: "0.72rem", color: "#F59E0B" }}>+{fmtMin(emp.pending_ot_minutes)} OT</div>
                      )}
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "#10B981", marginTop: 2 }}>{fmtINR(emp.pending_amount)}</div>
                    </div>

                    {/* Payment Method summary */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Method</div>
                      <div style={{ marginTop: 3 }}>
                        {cfg.included ? (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.74rem", fontWeight: 800, background: cfg.action === "pay_now" ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.1)", color: cfg.action === "pay_now" ? "#10B981" : "#6366F1" }}>
                            {cfg.action === "pay_now" ? PAYMENT_METHODS.find(m => m.value === cfg.paymentMethod)?.label : "Ledger Only"}
                          </span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.74rem", fontWeight: 800, background: "rgba(100,116,139,0.1)", color: "var(--text-secondary)" }}>Excluded</span>
                        )}
                      </div>
                    </div>

                    {/* Expand */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-secondary)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} />}
                    </div>
                  </div>

                  {/* Expanded Controls */}
                  {isExpanded && cfg.included && (
                    <div style={{ padding: "0 20px 20px 20px", background: "rgba(16,185,129,0.03)", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ paddingTop: 16, display: "flex", flexWrap: "wrap", gap: 20 }}>
                        {/* Action Toggle */}
                        <div style={{ minWidth: 200 }}>
                          <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Settlement Action</label>
                          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                            {[{ v: "pay_now", l: "Pay Now" }, { v: "ledger_only", l: "Ledger Only" }].map((opt) => (
                              <button
                                key={opt.v}
                                onClick={() => updateSetting(emp.employee_id, "action", opt.v)}
                                style={{ flex: 1, padding: "8px 12px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", background: cfg.action === opt.v ? (opt.v === "pay_now" ? "#10B981" : "#6366F1") : "var(--surface-2)", color: cfg.action === opt.v ? "#fff" : "var(--text-secondary)", transition: "all 0.15s" }}
                              >
                                {opt.l}
                              </button>
                            ))}
                          </div>
                          {cfg.action === "ledger_only" && (
                            <div style={{ marginTop: 6, fontSize: "0.74rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Info size={12} /> Records credit in ledger — no cash changes.
                            </div>
                          )}
                        </div>

                        {/* Payment Method */}
                        {cfg.action === "pay_now" && (
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>Payment Method</label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              {PAYMENT_METHODS.map((m) => {
                                const Icon = m.icon;
                                const isSelected = cfg.paymentMethod === m.value;
                                return (
                                  <button
                                    key={m.value}
                                    onClick={() => updateSetting(emp.employee_id, "paymentMethod", m.value)}
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: isSelected ? "2px solid #10B981" : "1px solid var(--border-subtle)", background: isSelected ? "rgba(16,185,129,0.08)" : "var(--surface-2)", color: isSelected ? "#10B981" : "var(--text-secondary)", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.15s" }}
                                  >
                                    <Icon size={13} />
                                    {m.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Register Shift (cash only) */}
                        {cfg.action === "pay_now" && cfg.paymentMethod === "cash" && (
                          <div style={{ minWidth: 260 }}>
                            <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                              Cash Register Shift
                            </label>
                            {shifts.length === 0 ? (
                              <div style={{ fontSize: "0.8rem", color: "#F59E0B", fontWeight: 700 }}>
                                ⚠ No open register shifts. Enable "Show closed shifts" above.
                              </div>
                            ) : (
                              <select
                                value={cfg.shiftId || ""}
                                onChange={(e) => updateSetting(emp.employee_id, "shiftId", parseInt(e.target.value))}
                                className="input-field"
                                style={{ width: "100%", fontSize: "0.84rem" }}
                              >
                                <option value="">— Select shift —</option>
                                {shifts.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.shift_number} · {s.cashier_name} · {s.status === "closed" ? "🔒 CLOSED (post-close)" : "🟢 OPEN"}
                                  </option>
                                ))}
                              </select>
                            )}
                            {selectedShift?.is_post_close && (
                              <div style={{ marginTop: 6, fontSize: "0.75rem", color: "#F59E0B", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                                <AlertTriangle size={12} /> Post-close payout — will deduct from shift net handover cash.
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Note */}
                      <div style={{ marginTop: 14 }}>
                        <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Note (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Weekly wages, EID bonus included…"
                          value={cfg.note || ""}
                          onChange={(e) => updateSetting(emp.employee_id, "note", e.target.value)}
                          className="input-field"
                          style={{ width: "100%", fontSize: "0.84rem" }}
                        />
                      </div>

                      {/* Mini breakdown */}
                      <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: "0.78rem", color: "var(--text-secondary)", flexWrap: "wrap" }}>
                        <span>📅 {emp.unsettled_days} unsettled days</span>
                        <span>💵 Base: {fmtINR(emp.pending_base)}</span>
                        {parseFloat(emp.pending_ot) > 0 && <span style={{ color: "#F59E0B" }}>⏱ OT: +{fmtINR(emp.pending_ot)}</span>}
                        {parseFloat(emp.settled_amount) > 0 && <span>✅ Already settled: {fmtINR(emp.settled_amount)}</span>}
                        {emp.unverified_ot_days > 0 && (
                          <span style={{ color: "#B45309", fontWeight: 700 }}>
                            ⚠ {emp.unverified_ot_days} OT days unverified —{" "}
                            <button
                              type="button"
                              onClick={() => setIsOTVerifyModalOpen(true)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#B45309",
                                fontWeight: 800,
                                textDecoration: "underline",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              verify now
                            </button>{" "}
                            for accurate OT payout
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "18px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: "var(--surface-2)" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
              Settling: <span style={{ color: "#10B981" }}>{fmtINR(totalAmount)}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
              {selectedEmps.length} of {employees.length} employees · {selectedEmps.filter(e => settings[e.employee_id]?.action === "pay_now").length} cash payout{selectedEmps.filter(e => settings[e.employee_id]?.action === "pay_now").length !== 1 ? "s" : ""} · {selectedEmps.filter(e => settings[e.employee_id]?.action === "ledger_only").length} ledger only
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ fontWeight: 700 }}>Cancel</button>
            <button
              onClick={handleSettle}
              disabled={saving || selectedEmps.length === 0}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, padding: "10px 22px", background: "linear-gradient(135deg, #10B981, #059669)", border: "none" }}
            >
              <Zap size={15} />
              {saving ? "Processing…" : `Settle ${selectedEmps.length} Employee${selectedEmps.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>

      {/* Overtime Verification Modal */}
      {isOTVerifyModalOpen && (
        <OvertimeVerificationModal
          store={store}
          year={year}
          month={month}
          onClose={() => setIsOTVerifyModalOpen(false)}
          onDone={() => {
            setIsOTVerifyModalOpen(false);
            loadData();
          }}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
