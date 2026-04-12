import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Play,
  Pause,
  RefreshCw,
  Activity,
  Terminal,
  CheckCircle,
  AlertCircle,
  Zap,
  Clock,
  BarChart2,
} from "lucide-react"

// ── API base (mirrors useAdminApi.ts logic) ────────────────────────────────
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + "/api"

interface KeeperLog {
  id: number
  time: string
  type: "info" | "success" | "error" | "warn"
  msg: string
}

interface KeeperStats {
  marketsClosedToday: number
  disputeWindowsOpened: number
  marketsAutoSettled: number
}

interface KeeperStatusResponse {
  isActive: boolean
  lastRunAt: string | null
  logs: KeeperLog[]
  stats: KeeperStats
}

const LOG_COLOR: Record<string, string> = {
  success: "#4CAF50",
  error: "#f44336",
  warn: "#FF9800",
  info: "#90caf9",
}

const KeeperDashboard: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")

  const [status, setStatus] = useState<KeeperStatusResponse | null>(null)
  const [loadingToggle, setLoadingToggle] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const logsRef = useRef<HTMLDivElement>(null)

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers ?? {}),
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(`${res.status}: ${text}`)
      }
      const ct = res.headers.get("content-type") ?? ""
      if (res.status === 204 || !ct.includes("application/json")) return null
      return res.json()
    },
    [token]
  )

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch("/admin/keeper/status")
      setStatus(data as KeeperStatusResponse)
      setFetchError(null)
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e))
    }
  }, [apiFetch])

  // Poll every 8 seconds
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 8000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Auto-scroll logs to top (newest first)
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = 0
  }, [status?.logs])

  const toggleKeeper = async () => {
    if (!status) return
    setLoadingToggle(true)
    try {
      await apiFetch("/admin/keeper/active", {
        method: "POST",
        body: JSON.stringify({ active: !status.isActive }),
      })
      await fetchStatus()
    } finally {
      setLoadingToggle(false)
    }
  }

  const triggerJob = async (job: string) => {
    setTriggering(job)
    try {
      await apiFetch(`/admin/keeper/trigger/${job}`, { method: "POST" })
      // Short delay then refresh to see the new log entries
      setTimeout(fetchStatus, 1200)
    } catch (e: unknown) {
      alert(`Trigger failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setTriggering(null)
    }
  }

  const isActive = status?.isActive ?? false
  const logs = status?.logs ?? []
  const stats = status?.stats ?? {
    marketsClosedToday: 0,
    disputeWindowsOpened: 0,
    marketsAutoSettled: 0,
  }
  const lastRunAt = status?.lastRunAt
    ? new Date(status.lastRunAt).toLocaleTimeString()
    : "—"

  return (
    <div className="keeper-dashboard">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, marginBottom: "0.4rem" }}>
            Keeperbot Management
          </h1>
          <p
            style={{
              color: "hsl(var(--muted-foreground))",
              margin: 0,
              fontSize: "0.875rem",
            }}
          >
            Automated market lifecycle — closes expired markets, opens dispute
            windows, auto-settles after 24h.
            <br />
            Sends Telegram DMs to the admin at each step.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={fetchStatus}
            title="Refresh"
            style={{
              padding: "0.4rem 0.6rem",
              background: "transparent",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              cursor: "pointer",
              color: "hsl(var(--foreground))",
            }}
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={toggleKeeper}
            disabled={loadingToggle}
            className={isActive ? "" : "secondary"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1.5rem",
            }}
          >
            {isActive ? (
              <>
                <Pause size={16} /> Stop Keeper
              </>
            ) : (
              <>
                <Play size={16} /> Start Keeper
              </>
            )}
          </button>
        </div>
      </div>

      {fetchError && (
        <div
          style={{
            background: "hsl(var(--destructive) / 0.15)",
            border: "1px solid hsl(var(--destructive) / 0.4)",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            color: "hsl(var(--destructive))",
            fontSize: "0.85rem",
          }}
        >
          ⚠️ Could not reach keeper API: {fetchError}
        </div>
      )}

      {/* ── Stat pills ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          {
            icon: <Activity size={18} color={isActive ? "#4CAF50" : "#888"} />,
            label: "Status",
            value: isActive ? "Operational" : "Paused",
            color: isActive ? "#4CAF50" : "#888",
          },
          {
            icon: <Clock size={18} color="#90caf9" />,
            label: "Last Run",
            value: lastRunAt,
            color: "hsl(var(--foreground))",
          },
          {
            icon: <BarChart2 size={18} color="#FF9800" />,
            label: "Closed Today",
            value: stats.marketsClosedToday,
            color: "#FF9800",
          },
          {
            icon: <Zap size={18} color="#9c27b0" />,
            label: "Auto-Settled",
            value: stats.marketsAutoSettled,
            color: "#9c27b0",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-card"
            style={{
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            {s.icon}
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "hsl(var(--muted-foreground))",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {s.label}
              </div>
              <div
                style={{ fontWeight: 700, fontSize: "1rem", color: s.color }}
              >
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main two-column ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.4fr",
          gap: "1.5rem",
        }}
      >
        {/* Jobs */}
        <div className="glass-card">
          <h3 style={{ margin: 0, marginBottom: "1.25rem", fontSize: "1rem" }}>
            Keeper Jobs
          </h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            {/* Expiry Watcher */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem",
                borderRadius: "10px",
                background: "hsl(var(--secondary) / 0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <Activity size={20} color="#4CAF50" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    Expiry Watcher
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Opens UPCOMING markets at <code>opensAt</code>, closes OPEN
                    markets at <code>closesAt</code> · every minute
                  </div>
                </div>
              </div>
              <button
                className="secondary"
                style={{
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.72rem",
                  minWidth: 72,
                  whiteSpace: "nowrap",
                }}
                onClick={() => triggerJob("expiry")}
                disabled={triggering === "expiry"}
              >
                {triggering === "expiry" ? "…" : "Run Now"}
              </button>
            </div>

            {/* Dispute Guard */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem",
                borderRadius: "10px",
                background: "hsl(var(--secondary) / 0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <AlertCircle size={20} color="#FF9800" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    Dispute Guard
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Auto-settles RESOLVING markets after 24h dispute window ·
                    runs every minute
                  </div>
                </div>
              </div>
              <button
                className="secondary"
                style={{
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.72rem",
                  minWidth: 72,
                  whiteSpace: "nowrap",
                }}
                onClick={() => triggerJob("dispute")}
                disabled={triggering === "dispute"}
              >
                {triggering === "dispute" ? "…" : "Run Now"}
              </button>
            </div>

            {/* Liquidity Bot */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem",
                borderRadius: "10px",
                background: "hsl(var(--secondary) / 0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <Zap size={20} color="#9c27b0" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    Liquidity Bot
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Simulation tick (no-op in production) · runs every 10 min
                  </div>
                </div>
              </div>
              <button
                className="secondary"
                style={{
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.72rem",
                  minWidth: 72,
                  whiteSpace: "nowrap",
                }}
                onClick={() => triggerJob("liquidity")}
                disabled={triggering === "liquidity"}
              >
                {triggering === "liquidity" ? "…" : "Run Now"}
              </button>
            </div>
          </div>

          {/* Flow description */}
          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.85rem",
              borderRadius: "8px",
              background: "hsl(var(--secondary) / 0.3)",
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "hsl(var(--foreground))" }}>
              Auto-flow:
            </strong>
            <br />
            1. Market <code>opensAt</code> passes (or no <code>opensAt</code>) →{" "}
            <b>UPCOMING → OPEN</b> + admin DM 🤖
            <br />
            2. Market <code>closesAt</code> passes → <b>OPEN → CLOSED</b> +
            admin DM 🤖
            <br />
            3. Admin proposes outcome in Market Management →{" "}
            <b>CLOSED → RESOLVING</b> (24h dispute window)
            <br />
            4. Dispute window expires → <b>RESOLVING → SETTLED</b> + admin DM ✅
          </div>
        </div>

        {/* Logs */}
        <div
          className="glass-card"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Live Execution Logs</h3>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                auto-refresh 8s
              </span>
              <Terminal size={16} color="hsl(var(--muted-foreground))" />
            </div>
          </div>
          <div
            ref={logsRef}
            style={{
              flex: 1,
              background: "hsl(0 0% 5% / 0.8)",
              borderRadius: "8px",
              padding: "0.85rem",
              fontFamily: "monospace",
              fontSize: "0.72rem",
              overflowY: "auto",
              maxHeight: "420px",
              border: "1px solid hsl(var(--border))",
              lineHeight: 1.7,
            }}
          >
            {logs.length === 0 && (
              <span style={{ color: "#666" }}>
                No logs yet. Keeper runs every minute.
              </span>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  marginBottom: "0.3rem",
                  display: "flex",
                  gap: "0.5rem",
                }}
              >
                <span style={{ color: "#555", flexShrink: 0 }}>
                  [{log.time}]
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.35rem",
                    color: LOG_COLOR[log.type] ?? "#ccc",
                  }}
                >
                  {log.type === "success" && (
                    <CheckCircle
                      size={12}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                  )}
                  {log.type === "error" && (
                    <AlertCircle
                      size={12}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                  )}
                  {log.type === "warn" && (
                    <AlertCircle
                      size={12}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                  )}
                  {log.type === "info" && (
                    <Activity
                      size={12}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                  )}
                  <span style={{ wordBreak: "break-word" }}>{log.msg}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default KeeperDashboard
