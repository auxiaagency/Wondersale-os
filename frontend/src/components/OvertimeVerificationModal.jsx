import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  RotateCcw,
  Filter,
  Zap,
} from "lucide-react";
import { fetchOvertimePendingVerification, bulkVerifyOvertime } from "../api";

function fmtTime(iso) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function fmtMin(min) {
  if (!min || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtINR(val) {
  const num = parseFloat(val || 0);
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export default function OvertimeVerificationModal({ store, year, month, onClose, onDone, onShowToast }) {
  const [loading, setLoading] = useState(true);
  const [otDays, setOtDays] = useState([]);
  const [overrides, setOverrides] = useState({}); // {day_id: { mode: "approve"|"zero"|"custom", customMin: "" }}
  const [saving, setSaving] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");
  const [expandedDayId, setExpandedDayId] = useState(null);

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const loadOTDays = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOvertimePendingVerification(store.id, year, month);
      setOtDays(data.ot_days || []);
      // Initialize overrides: default approve-as-is
      const init = {};
      (data.ot_days || []).forEach((d) => {
        init[d.attendance_day_id] = { mode: "approve", customMin: "" };
      });
      setOverrides(init);
    } catch (err) {
      if (onShowToast) onShowToast(err.message, "danger");
    } finally {
      setLoading(false);
    }
  }, [store.id, year, month]);

  useEffect(() => {
    loadOTDays();
  }, [loadOTDays]);

  const setAllMode = (mode) => {
    const next = {};
    otDays.forEach((d) => {
      next[d.attendance_day_id] = { mode, customMin: "" };
    });
    setOverrides(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const verifications = otDays.map((d) => {
        const ov = overrides[d.attendance_day_id] || { mode: "approve", customMin: "" };
        let approved_minutes = null;
        if (ov.mode === "zero") approved_minutes = 0;
        else if (ov.mode === "custom") {
          const parsed = parseInt(ov.customMin, 10);
          approved_minutes = isNaN(parsed) ? null : Math.max(0, parsed);
        }
        return { attendance_day_id: d.attendance_day_id, approved_minutes };
      });
      const result = await bulkVerifyOvertime(verifications);
      if (onShowToast) onShowToast(`Verified ${result.verified} OT entries (${result.zeroed} zeroed).`, "success");
      onDone && onDone();
      onClose();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const filteredDays = otDays.filter((d) => {
    if (!filterEmp) return true;
    const q = filterEmp.toLowerCase();
    return d.employee_name?.toLowerCase().includes(q) || d.employee_code?.toLowerCase().includes(q);
  });

  const totalOTMin = otDays.reduce((sum, d) => sum + (d.overtime_minutes || 0), 0);
  const totalOTAmount = otDays.reduce((sum, d) => sum + parseFloat(d.ot_amount || 0), 0);
  const approvedCount = Object.values(overrides).filter((v) => v.mode === "approve").length;
  const zeroedCount = Object.values(overrides).filter((v) => v.mode === "zero").length;
  const customCount = Object.values(overrides).filter((v) => v.mode === "custom").length;

  return (
    <div
      id="ot-verify-modal-overlay"
      className="modal-overlay"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "860px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45)", marginBottom: "24px" }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px", background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,88,12,0.10))", borderBottom: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={22} style={{ color: "#F59E0B" }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Overtime Verification</div>
              <div style={{ fontSize: "0.82rem", opacity: 0.7, marginTop: 2 }}>
                Manager approval for {monthNames[month - 1]} {year} · {store?.name}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
            <X size={20} />
          </button>
        </div>

        {/* Summary Bar */}
        {!loading && otDays.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderBottom: "1px solid var(--border-subtle)" }}>
            {[
              { label: "Total OT Days", value: otDays.length, color: "#F59E0B" },
              { label: "Total OT Time", value: fmtMin(totalOTMin), color: "#6366F1" },
              { label: "OT Amount", value: fmtINR(totalOTAmount), color: "#10B981" },
              { label: `Pending / Zero'd / Custom`, value: `${approvedCount} / ${zeroedCount} / ${customCount}`, color: "#F97316" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "14px 20px", borderRight: i < 3 ? "1px solid var(--border-subtle)" : "none", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Filter size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            <input
              type="text"
              placeholder="Filter by employee…"
              value={filterEmp}
              onChange={(e) => setFilterEmp(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 30, width: "100%", fontSize: "0.84rem" }}
            />
          </div>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Bulk:</span>
          <button onClick={() => setAllMode("approve")} className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: 4 }}>
            <Check size={13} /> Approve All
          </button>
          <button onClick={() => setAllMode("zero")} className="btn btn-secondary" style={{ fontSize: "0.78rem", padding: "6px 12px", display: "flex", alignItems: "center", gap: 4, color: "var(--color-danger)" }}>
            <X size={13} /> Zero All
          </button>
        </div>

        {/* Body */}
        <div style={{ maxHeight: "56vh", overflowY: "auto", padding: "0" }}>
          {loading ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
              <Clock size={32} style={{ opacity: 0.4, marginBottom: 12 }} />
              <div>Loading overtime data…</div>
            </div>
          ) : filteredDays.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <CheckCircle2 size={40} style={{ color: "#10B981", marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>No Pending OT Entries</div>
              <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginTop: 4 }}>
                All overtime for {monthNames[month - 1]} has been verified or there are no OT hours this month.
              </div>
            </div>
          ) : (
            filteredDays.map((day, idx) => {
              const ov = overrides[day.attendance_day_id] || { mode: "approve", customMin: "" };
              const isExpanded = expandedDayId === day.attendance_day_id;
              const extraOT = day.worked_minutes - (day.scheduled_minutes || 480);
              const autoCalcMin = Math.max(0, extraOT);

              const modeColor = ov.mode === "zero" ? "#EF4444" : ov.mode === "custom" ? "#6366F1" : "#10B981";
              const modeLabel = ov.mode === "zero" ? "Zero OT" : ov.mode === "custom" ? "Custom" : "Approve";
              const effectiveMin = ov.mode === "zero" ? 0 : ov.mode === "custom" ? (parseInt(ov.customMin, 10) || 0) : day.overtime_minutes;

              return (
                <div
                  key={day.attendance_day_id}
                  style={{ borderBottom: idx < filteredDays.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                >
                  {/* Row */}
                  <div
                    style={{ display: "grid", gridTemplateColumns: "1fr 140px 130px 150px 48px", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer" }}
                    onClick={() => setExpandedDayId(isExpanded ? null : day.attendance_day_id)}
                  >
                    {/* Employee + Date */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{day.employee_name}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                        {day.employee_code} · {fmtDate(day.business_date)}
                      </div>
                      <div style={{ fontSize: "0.76rem", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ background: "rgba(99,102,241,0.1)", color: "#6366F1", padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>
                          IN {fmtTime(day.first_in)}
                        </span>
                        <span style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>
                          OUT {fmtTime(day.last_out)}
                        </span>
                        <span style={{ background: "rgba(16,185,129,0.08)", color: "#10B981", padding: "2px 7px", borderRadius: 6, fontWeight: 700 }}>
                          Worked {fmtMin(day.worked_minutes)}
                        </span>
                      </div>
                    </div>

                    {/* OT Minutes */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recorded OT</div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: "#F59E0B", marginTop: 2 }}>{fmtMin(day.overtime_minutes)}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{fmtINR(day.ot_amount)}</div>
                    </div>

                    {/* Effective OT after decision */}
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Effective OT</div>
                      <div style={{ fontWeight: 800, fontSize: "1rem", color: modeColor, marginTop: 2 }}>{fmtMin(effectiveMin)}</div>
                    </div>

                    {/* Decision Pill */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span style={{ background: ov.mode === "zero" ? "rgba(239,68,68,0.12)" : ov.mode === "custom" ? "rgba(99,102,241,0.12)" : "rgba(16,185,129,0.12)", color: modeColor, padding: "4px 12px", borderRadius: 20, fontSize: "0.76rem", fontWeight: 800 }}>
                        {modeLabel}
                      </span>
                    </div>

                    {/* Expand */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {isExpanded ? <ChevronUp size={16} style={{ color: "var(--text-secondary)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} />}
                    </div>
                  </div>

                  {/* Expanded: Decision Controls */}
                  {isExpanded && (
                    <div style={{ padding: "0 20px 18px 20px", background: "rgba(99,102,241,0.03)", borderTop: "1px solid var(--border-subtle)" }}>
                      <div style={{ paddingTop: 14, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)" }}>Action:</span>

                        {/* Approve */}
                        <button
                          onClick={() => setOverrides((prev) => ({ ...prev, [day.attendance_day_id]: { mode: "approve", customMin: "" } }))}
                          className="btn btn-secondary"
                          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", fontWeight: 700, padding: "7px 14px", ...(ov.mode === "approve" ? { background: "rgba(16,185,129,0.15)", color: "#10B981", borderColor: "#10B981" } : {}) }}
                        >
                          <Check size={14} /> Approve as-is ({fmtMin(day.overtime_minutes)})
                        </button>

                        {/* Zero Out */}
                        <button
                          onClick={() => setOverrides((prev) => ({ ...prev, [day.attendance_day_id]: { mode: "zero", customMin: "" } }))}
                          className="btn btn-secondary"
                          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", fontWeight: 700, padding: "7px 14px", ...(ov.mode === "zero" ? { background: "rgba(239,68,68,0.15)", color: "#EF4444", borderColor: "#EF4444" } : {}) }}
                        >
                          <X size={14} /> Zero Out OT
                        </button>

                        {/* Custom */}
                        <button
                          onClick={() => setOverrides((prev) => ({ ...prev, [day.attendance_day_id]: { mode: "custom", customMin: String(day.overtime_minutes) } }))}
                          className="btn btn-secondary"
                          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", fontWeight: 700, padding: "7px 14px", ...(ov.mode === "custom" ? { background: "rgba(99,102,241,0.15)", color: "#6366F1", borderColor: "#6366F1" } : {}) }}
                        >
                          <Edit3 size={14} /> Custom Override
                        </button>

                        {ov.mode === "custom" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="number"
                              min="0"
                              value={ov.customMin}
                              onChange={(e) => setOverrides((prev) => ({ ...prev, [day.attendance_day_id]: { ...prev[day.attendance_day_id], customMin: e.target.value } }))}
                              placeholder="Minutes"
                              className="input-field"
                              style={{ width: 100, fontSize: "0.84rem", padding: "6px 10px" }}
                            />
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                              = {fmtMin(parseInt(ov.customMin, 10) || 0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Context */}
                      <div style={{ marginTop: 12, fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>📅 Scheduled: {fmtMin(day.scheduled_minutes || 480)}</span>
                        <span>⏱ Worked: {fmtMin(day.worked_minutes)}</span>
                        <span>💰 Rate: {fmtINR(day.ot_rate_per_hour)}/hr</span>
                        {day.ot_override_minutes != null && (
                          <span style={{ color: "#6366F1", fontWeight: 700 }}>⚠ Previously overridden to {fmtMin(day.ot_override_minutes)}</span>
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
        <div style={{ padding: "18px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            {otDays.length} day{otDays.length !== 1 ? "s" : ""} pending · {approvedCount} approved · {zeroedCount} zeroed · {customCount} custom
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="btn btn-secondary" style={{ fontWeight: 700 }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || otDays.length === 0}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, background: "linear-gradient(135deg, #F59E0B, #D97706)", border: "none" }}
            >
              <Zap size={15} />
              {saving ? "Saving…" : `Save ${otDays.length} OT Decision${otDays.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
