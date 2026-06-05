import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  ShieldAlert,
  ScanLine,
  FileDown,
  FilePlus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

// ── Types ─────────────────────────────────────────────────────────────────────

interface AmlAlert {
  id: string
  userId: string
  alertType: string
  riskLevel: "high" | "medium" | "low"
  description: string
  totalAmount: number | null
  transactionCount: number | null
  isResolved: boolean
  resolution: string | null
  createdAt: string
  user?: { dkCid?: string; phoneNumber?: string }
}

interface AmlReport {
  id: string
  reportType: "periodic" | "sar"
  periodFrom: string
  periodTo: string
  totalAlerts: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  affectedUsers: number
  generatedByName: string | null
  notes: string | null
  createdAt: string
}

interface Summary {
  totalAlerts: number
  byRisk: { high: number; medium: number; low: number }
  unresolved: number
  totalReports: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<string, string> = {
  rapid_deposit_withdrawal: "Rapid Dep/Wd",
  low_gambling_ratio: "Low Bet Ratio",
  high_transaction_frequency: "High Frequency",
  near_limit_deposits: "Near-Limit Deps",
}

const PAGE_SIZE = 20

const inputStyle: React.CSSProperties = {
  background: "hsl(var(--background))",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "7px 12px",
  color: "hsl(var(--foreground))",
  fontSize: "0.82rem",
  outline: "none",
  fontFamily: "inherit",
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
}

function RiskBadge({ level }: { level: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    high: {
      bg: "rgba(198,40,40,0.15)",
      color: "#ef9a9a",
      border: "rgba(198,40,40,0.4)",
    },
    medium: {
      bg: "rgba(230,81,0,0.15)",
      color: "#ffcc80",
      border: "rgba(230,81,0,0.4)",
    },
    low: {
      bg: "rgba(21,101,192,0.15)",
      color: "#90caf9",
      border: "rgba(21,101,192,0.4)",
    },
  }
  const s = cfg[level] ?? cfg.low
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 9999,
        fontSize: "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {level}
    </span>
  )
}

function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  if (pages <= 1) return null
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, start + 4)
  const nums = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  return (
    <div
      style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 16 }}
    >
      <button
        className="secondary"
        style={{ padding: "4px 10px", fontSize: "0.8rem" }}
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        <ChevronLeft size={14} />
      </button>
      {nums.map((n) => (
        <button
          key={n}
          className={n === page ? "" : "secondary"}
          style={{ padding: "4px 10px", fontSize: "0.8rem", minWidth: 32 }}
          onClick={() => onPage(n)}
        >
          {n}
        </button>
      ))}
      <button
        className="secondary"
        style={{ padding: "4px 10px", fontSize: "0.8rem" }}
        onClick={() => onPage(page + 1)}
        disabled={page === pages}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const AMLPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [tab, setTab] = useState<"alerts" | "reports">("alerts")
  const [summary, setSummary] = useState<Summary | null>(null)

  // ── Scan state
  const [scanFrom, setScanFrom] = useState("")
  const [scanTo, setScanTo] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{
    newAlerts: number
    candidates: number
  } | null>(null)

  // ── Alerts state
  const [alerts, setAlerts] = useState<AmlAlert[]>([])
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [alertsPages, setAlertsPages] = useState(1)
  const [alertsPage, setAlertsPage] = useState(1)
  const [filterRisk, setFilterRisk] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterResolved, setFilterResolved] = useState("")
  const [alertsLoading, setAlertsLoading] = useState(false)

  // ── Resolve modal state
  const [resolveTarget, setResolveTarget] = useState<AmlAlert | null>(null)
  const [resolveText, setResolveText] = useState("")
  const [resolving, setResolving] = useState(false)

  // ── Reports state
  const [reports, setReports] = useState<AmlReport[]>([])
  const [reportsTotal, setReportsTotal] = useState(0)
  const [reportsPages, setReportsPages] = useState(1)
  const [reportsPage, setReportsPage] = useState(1)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  // ── Generate report modal state
  const [showGenModal, setShowGenModal] = useState(false)
  const [genType, setGenType] = useState<"periodic" | "sar">("periodic")
  const [genFrom, setGenFrom] = useState("")
  const [genTo, setGenTo] = useState("")
  const [genNotes, setGenNotes] = useState("")
  const [generating, setGenerating] = useState(false)

  // ── Fetch summary ─────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.getAmlSummary()
      setSummary(res)
    } catch {
      // non-fatal
    }
  }, [api])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  // ── Fetch alerts ──────────────────────────────────────────────────────────

  const getAlertsRef = useRef(api.getAmlAlerts)
  useEffect(() => {
    getAlertsRef.current = api.getAmlAlerts
  })

  useEffect(() => {
    if (tab !== "alerts") return
    let cancelled = false
    setAlertsLoading(true)
    getAlertsRef
      .current({
        riskLevel: filterRisk || undefined,
        alertType: filterType || undefined,
        isResolved:
          filterResolved === "" ? undefined : filterResolved === "true",
        page: alertsPage,
        limit: PAGE_SIZE,
      })
      .then((res: { data: AmlAlert[]; total: number; pages: number }) => {
        if (cancelled) return
        setAlerts(res.data ?? [])
        setAlertsTotal(res.total ?? 0)
        setAlertsPages(res.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAlertsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, filterRisk, filterType, filterResolved, alertsPage])

  // ── Fetch reports ─────────────────────────────────────────────────────────

  const getReportsRef = useRef(api.getAmlReports)
  useEffect(() => {
    getReportsRef.current = api.getAmlReports
  })

  const fetchReports = useCallback((page: number) => {
    setReportsLoading(true)
    getReportsRef
      .current({ page, limit: PAGE_SIZE })
      .then((res: { data: AmlReport[]; total: number; pages: number }) => {
        setReports(res.data ?? [])
        setReportsTotal(res.total ?? 0)
        setReportsPages(res.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => setReportsLoading(false))
  }, [])

  useEffect(() => {
    if (tab === "reports") fetchReports(reportsPage)
  }, [tab, reportsPage, fetchReports])

  // ── Scan ──────────────────────────────────────────────────────────────────

  const handleScan = async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const res = await api.runAmlScan({
        from: scanFrom || undefined,
        to: scanTo || undefined,
      })
      setScanResult(res)
      void fetchSummary()
      if (tab === "alerts") setAlertsPage(1)
    } catch {
      // error handled by api hook
    } finally {
      setScanning(false)
    }
  }

  // ── Resolve alert ─────────────────────────────────────────────────────────

  const handleResolve = async () => {
    if (!resolveTarget || !resolveText.trim()) return
    setResolving(true)
    try {
      await api.resolveAmlAlert(resolveTarget.id, resolveText.trim())
      setResolveTarget(null)
      setResolveText("")
      setAlertsPage(1)
      void fetchSummary()
    } catch {
      // error handled by api hook
    } finally {
      setResolving(false)
    }
  }

  // ── Generate report ───────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!genFrom || !genTo) return
    setGenerating(true)
    try {
      await api.generateAmlReport({
        reportType: genType,
        from: genFrom,
        to: genTo,
        notes: genNotes || undefined,
      })
      setShowGenModal(false)
      setGenFrom("")
      setGenTo("")
      setGenNotes("")
      setReportsPage(1)
      fetchReports(1)
    } catch {
      // error handled by api hook
    } finally {
      setGenerating(false)
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = async (reportId: string, format: "pdf" | "csv") => {
    setDownloading(`${reportId}-${format}`)
    try {
      await api.downloadAmlReport(reportId, format)
    } catch {
      // error handled by api hook
    } finally {
      setDownloading(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <ShieldAlert size={24} color="hsl(var(--primary))" />
        <div>
          <h2 style={{ margin: 0, fontSize: "1.3rem" }}>AML Compliance</h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Anti-Money Laundering monitoring, alerts, and downloadable reports
          </p>
        </div>
      </div>

      {/* Summary stat cards */}
      {summary && (
        <div
          className="stat-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            {
              label: "Total Alerts",
              value: summary.totalAlerts,
              color: "hsl(var(--foreground))",
            },
            {
              label: "High Risk",
              value: summary.byRisk.high,
              color: "#ef9a9a",
            },
            {
              label: "Medium Risk",
              value: summary.byRisk.medium,
              color: "#ffcc80",
            },
            { label: "Low Risk", value: summary.byRisk.low, color: "#90caf9" },
            {
              label: "Unresolved",
              value: summary.unresolved,
              color:
                summary.unresolved > 0 ? "#ef9a9a" : "hsl(var(--foreground))",
            },
            {
              label: "Reports",
              value: summary.totalReports,
              color: "hsl(var(--foreground))",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="glass-card stat-card"
              style={{ padding: "1rem" }}
            >
              <h3
                style={{
                  margin: "0 0 0.5rem",
                  fontSize: "0.7rem",
                  color: "hsl(var(--muted-foreground))",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {s.label}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: s.color,
                  fontFamily: "Orbitron, sans-serif",
                }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Scan section */}
      <div
        className="glass-card"
        style={{ marginBottom: "1.5rem", padding: "1.25rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <ScanLine size={16} color="hsl(var(--primary))" />
          <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
            Run Detection Scan
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            — leave blank to scan the last 30 days
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              From
            </label>
            <input
              type="date"
              value={scanFrom}
              onChange={(e) => setScanFrom(e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              To
            </label>
            <input
              type="date"
              value={scanTo}
              onChange={(e) => setScanTo(e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            />
          </div>
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <ScanLine size={14} />
            {scanning ? "Scanning…" : "Run Scan"}
          </button>
          {scanResult && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              ✓ {scanResult.newAlerts} new alert(s) saved from{" "}
              {scanResult.candidates} candidate(s)
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["alerts", "reports"] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? "" : "secondary"}
            style={{
              padding: "6px 20px",
              fontSize: "0.82rem",
              textTransform: "capitalize",
            }}
            onClick={() => setTab(t)}
          >
            {t === "alerts"
              ? `Alerts${alertsTotal ? ` (${alertsTotal})` : ""}`
              : `Reports${reportsTotal ? ` (${reportsTotal})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── ALERTS TAB ─────────────────────────────────────────────────────── */}
      {tab === "alerts" && (
        <div className="glass-card">
          {/* Filters */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
              alignItems: "center",
            }}
          >
            <select
              value={filterRisk}
              onChange={(e) => {
                setFilterRisk(e.target.value)
                setAlertsPage(1)
              }}
              style={{ ...selectStyle, width: 130 }}
            >
              <option value="">All Risks</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value)
                setAlertsPage(1)
              }}
              style={{ ...selectStyle, width: 160 }}
            >
              <option value="">All Types</option>
              <option value="rapid_deposit_withdrawal">Rapid Dep/Wd</option>
              <option value="low_gambling_ratio">Low Bet Ratio</option>
              <option value="high_transaction_frequency">High Frequency</option>
              <option value="near_limit_deposits">Near-Limit Deps</option>
            </select>
            <select
              value={filterResolved}
              onChange={(e) => {
                setFilterResolved(e.target.value)
                setAlertsPage(1)
              }}
              style={{ ...selectStyle, width: 140 }}
            >
              <option value="">All Statuses</option>
              <option value="false">Open only</option>
              <option value="true">Resolved only</option>
            </select>
            {(filterRisk || filterType || filterResolved) && (
              <button
                className="secondary"
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                onClick={() => {
                  setFilterRisk("")
                  setFilterType("")
                  setFilterResolved("")
                  setAlertsPage(1)
                }}
              >
                Clear
              </button>
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {alertsTotal} alert(s)
            </span>
          </div>

          {/* Loading bar */}
          {alertsLoading && (
            <div
              style={{
                height: 2,
                background: "hsla(var(--primary),0.3)",
                borderRadius: 2,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "40%",
                  background: "hsl(var(--primary))",
                  animation: "slideBar 1s ease infinite",
                }}
              />
            </div>
          )}

          {/* Table */}
          {alerts.length === 0 && !alertsLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.9rem",
              }}
            >
              No alerts found. Run a scan to detect suspicious activity.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {[
                      "CID",
                      "Type",
                      "Risk",
                      "Amount (Nu)",
                      "Description",
                      "Date",
                      "Status",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          fontSize: "0.7rem",
                          color: "hsl(var(--muted-foreground))",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr
                      key={alert.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "")
                      }
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                        }}
                      >
                        {alert.user?.dkCid ?? "N/A"}
                      </td>
                      <td
                        style={{ padding: "10px 12px", whiteSpace: "nowrap" }}
                      >
                        {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <RiskBadge level={alert.riskLevel} />
                      </td>
                      <td
                        style={{ padding: "10px 12px", whiteSpace: "nowrap" }}
                      >
                        {alert.totalAmount
                          ? `Nu ${Number(alert.totalAmount).toLocaleString()}`
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          maxWidth: 280,
                          color: "hsl(var(--muted-foreground))",
                          fontSize: "0.78rem",
                        }}
                      >
                        {alert.description}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          whiteSpace: "nowrap",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {new Date(alert.createdAt).toLocaleDateString("en-BT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {alert.isResolved ? (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#a5d6a7",
                              fontSize: "0.78rem",
                            }}
                          >
                            <CheckCircle2 size={12} /> Resolved
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#ef9a9a",
                              fontSize: "0.78rem",
                            }}
                          >
                            <XCircle size={12} /> Open
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {!alert.isResolved && (
                          <button
                            className="secondary"
                            style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                            onClick={() => {
                              setResolveTarget(alert)
                              setResolveText("")
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={alertsPage}
            pages={alertsPages}
            onPage={setAlertsPage}
          />
        </div>
      )}

      {/* ── REPORTS TAB ────────────────────────────────────────────────────── */}
      {tab === "reports" && (
        <div className="glass-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {reportsTotal} report(s) generated
            </span>
            <button
              onClick={() => setShowGenModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 16px",
                fontSize: "0.82rem",
              }}
            >
              <FilePlus size={14} />
              Generate Report
            </button>
          </div>

          {reportsLoading && (
            <div
              style={{
                height: 2,
                background: "hsla(var(--primary),0.3)",
                borderRadius: 2,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "40%",
                  background: "hsl(var(--primary))",
                  animation: "slideBar 1s ease infinite",
                }}
              />
            </div>
          )}

          {reports.length === 0 && !reportsLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.9rem",
              }}
            >
              No reports yet. Generate one to create a downloadable AML report.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {[
                      "Type",
                      "Period",
                      "Alerts",
                      "High",
                      "Med",
                      "Low",
                      "Users",
                      "Generated By",
                      "Date",
                      "Download",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          fontSize: "0.7rem",
                          color: "hsl(var(--muted-foreground))",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(255,255,255,0.03)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "")
                      }
                    >
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 9999,
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            background:
                              r.reportType === "sar"
                                ? "rgba(198,40,40,0.15)"
                                : "rgba(21,101,192,0.15)",
                            color:
                              r.reportType === "sar" ? "#ef9a9a" : "#90caf9",
                            border:
                              r.reportType === "sar"
                                ? "1px solid rgba(198,40,40,0.4)"
                                : "1px solid rgba(21,101,192,0.4)",
                          }}
                        >
                          {r.reportType.toUpperCase()}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          whiteSpace: "nowrap",
                          fontSize: "0.78rem",
                        }}
                      >
                        {new Date(r.periodFrom).toLocaleDateString("en-BT", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {" – "}
                        {new Date(r.periodTo).toLocaleDateString("en-BT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        {r.totalAlerts}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#ef9a9a" }}>
                        {r.highRiskCount}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#ffcc80" }}>
                        {r.mediumRiskCount}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#90caf9" }}>
                        {r.lowRiskCount}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {r.affectedUsers}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "hsl(var(--muted-foreground))",
                          fontSize: "0.78rem",
                        }}
                      >
                        {r.generatedByName ?? "Admin"}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          whiteSpace: "nowrap",
                          color: "hsl(var(--muted-foreground))",
                          fontSize: "0.78rem",
                        }}
                      >
                        {new Date(r.createdAt).toLocaleDateString("en-BT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="secondary"
                            style={{
                              padding: "4px 10px",
                              fontSize: "0.72rem",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            disabled={downloading === `${r.id}-pdf`}
                            onClick={() => handleDownload(r.id, "pdf")}
                          >
                            <FileDown size={12} />
                            {downloading === `${r.id}-pdf` ? "…" : "PDF"}
                          </button>
                          <button
                            className="secondary"
                            style={{
                              padding: "4px 10px",
                              fontSize: "0.72rem",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                            disabled={downloading === `${r.id}-csv`}
                            onClick={() => handleDownload(r.id, "csv")}
                          >
                            <FileDown size={12} />
                            {downloading === `${r.id}-csv` ? "…" : "CSV"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={reportsPage}
            pages={reportsPages}
            onPage={setReportsPage}
          />
        </div>
      )}

      {/* ── Resolve modal ─────────────────────────────────────────────────── */}
      {resolveTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="glass-card"
            style={{ width: "100%", maxWidth: 480, padding: "1.5rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <AlertTriangle size={18} color="#ffcc80" />
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Resolve Alert</h3>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "hsl(var(--muted-foreground))",
                marginBottom: "0.5rem",
              }}
            >
              <strong style={{ color: "hsl(var(--foreground))" }}>
                {ALERT_TYPE_LABELS[resolveTarget.alertType] ??
                  resolveTarget.alertType}
              </strong>
              {" — "}
              <RiskBadge level={resolveTarget.riskLevel} />
            </p>
            <p
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
                marginBottom: "1rem",
              }}
            >
              {resolveTarget.description}
            </p>
            <label
              style={{ fontSize: "0.8rem", display: "block", marginBottom: 6 }}
            >
              Resolution notes <span style={{ color: "#ef9a9a" }}>*</span>
            </label>
            <textarea
              value={resolveText}
              onChange={(e) => setResolveText(e.target.value)}
              placeholder="Describe the outcome of the review…"
              rows={3}
              style={{
                ...inputStyle,
                width: "100%",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                marginTop: "1rem",
              }}
            >
              <button
                className="secondary"
                onClick={() => setResolveTarget(null)}
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || !resolveText.trim()}
              >
                {resolving ? "Saving…" : "Mark Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate report modal ─────────────────────────────────────────── */}
      {showGenModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="glass-card"
            style={{ width: "100%", maxWidth: 440, padding: "1.5rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.25rem",
              }}
            >
              <Info size={18} color="hsl(var(--primary))" />
              <h3 style={{ margin: 0, fontSize: "1rem" }}>
                Generate AML Report
              </h3>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Report Type
                </label>
                <select
                  value={genType}
                  onChange={(e) =>
                    setGenType(e.target.value as "periodic" | "sar")
                  }
                  style={{ ...selectStyle, width: "100%" }}
                >
                  <option value="periodic">Periodic</option>
                  <option value="sar">SAR (Suspicious Activity Report)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    From <span style={{ color: "#ef9a9a" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={genFrom}
                    onChange={(e) => setGenFrom(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      display: "block",
                      marginBottom: 5,
                    }}
                  >
                    To <span style={{ color: "#ef9a9a" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={genTo}
                    onChange={(e) => setGenTo(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Notes (optional)
                </label>
                <textarea
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  placeholder="Add compliance notes…"
                  rows={2}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                marginTop: "1.25rem",
              }}
            >
              <button
                className="secondary"
                onClick={() => setShowGenModal(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !genFrom || !genTo}
              >
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AMLPage
