import React, { useMemo, useEffect, useState } from "react"
import { useAdminMarkets } from "../lib/useAdminApi"
import {
  TrendingUp,
  Activity,
  AlertCircle,
  DollarSign,
  PiggyBank,
  BarChart3,
} from "lucide-react"
import HealthCheck from "../components/HealthCheck"
import { BehavioralAnalytics } from "../components/BehavioralAnalytics"

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + "/api"

interface FinanceStats {
  houseIncome: number
  settledPool: number
  settledCount: number
  activePool: number
  activeCount: number
  allTimeVolume: number
  totalMarkets: number
}

const AdminDashboard: React.FC = () => {
  const token =
    sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token")
  const { markets, loading, error } = useAdminMarkets(token)
  const [finance, setFinance] = useState<FinanceStats | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/admin/finance-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setFinance)
      .catch(() => {})
  }, [token])

  const stats = useMemo(() => {
    const activeMarkets = markets.filter(
      (m: Record<string, unknown>) => m.status === "open"
    ).length
    const totalPoolVolume = markets
      .filter((m: Record<string, unknown>) => m.status === "open")
      .reduce(
        (sum: number, m: Record<string, unknown>) =>
          sum + (parseFloat(String(m.totalPool)) || 0),
        0
      )
    const unsettledMarkets = markets.filter((m: Record<string, unknown>) =>
      ["closed", "resolving", "resolved"].includes(String(m.status))
    ).length
    return { activeMarkets, totalPoolVolume, unsettledMarkets }
  }, [markets])

  const formatVolume = (val: number) => {
    return `NU. ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(val)}`
  }

  if (loading)
    return (
      <div style={{ padding: "2rem", color: "hsl(var(--muted-foreground))" }}>
        Initializing uplink...
      </div>
    )
  if (error)
    return (
      <div style={{ padding: "2rem", color: "hsl(var(--destructive))" }}>
        ERROR: {error}
      </div>
    )

  return (
    <div className="dashboard-view">
      <h2 style={{ marginBottom: "2rem" }}>System Overview</h2>

      <div className="stat-grid">
        <div className="glass-card stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <h3>Active Markets</h3>
            <Activity size={20} color="hsl(var(--primary))" />
          </div>
          <p>{stats.activeMarkets}</p>
        </div>

        <div className="glass-card stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <h3>Total Pool Volume</h3>
            <TrendingUp size={20} color="hsl(var(--primary))" />
          </div>
          <p>{formatVolume(stats.totalPoolVolume)}</p>
        </div>

        <div className="glass-card stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <h3>Unsettled</h3>
            <AlertCircle size={20} color="hsl(var(--primary))" />
          </div>
          <p>{stats.unsettledMarkets}</p>
        </div>
      </div>

      {finance && (
        <>
          <h2 style={{ margin: "2rem 0 1rem" }}>Platform Financials</h2>
          <div className="stat-grid">
            <div className="glass-card stat-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <h3>House Income</h3>
                <DollarSign size={20} color="hsl(var(--primary))" />
              </div>
              <p>{formatVolume(finance.houseIncome)}</p>
              <small style={{ color: "hsl(var(--muted-foreground))" }}>
                From {finance.settledCount} settled markets
              </small>
            </div>

            <div className="glass-card stat-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <h3>Settled Pool Total</h3>
                <PiggyBank size={20} color="hsl(var(--primary))" />
              </div>
              <p>{formatVolume(finance.settledPool)}</p>
            </div>

            <div className="glass-card stat-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <h3>Active Pool</h3>
                <BarChart3 size={20} color="hsl(var(--primary))" />
              </div>
              <p>{formatVolume(finance.activePool)}</p>
              <small style={{ color: "hsl(var(--muted-foreground))" }}>
                {finance.activeCount} unsettled markets
              </small>
            </div>

            <div className="glass-card stat-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                }}
              >
                <h3>All-Time Volume</h3>
                <TrendingUp size={20} color="hsl(var(--primary))" />
              </div>
              <p>{formatVolume(finance.allTimeVolume)}</p>
              <small style={{ color: "hsl(var(--muted-foreground))" }}>
                {finance.totalMarkets} total markets
              </small>
            </div>
          </div>
        </>
      )}

      <HealthCheck />

      <BehavioralAnalytics token={token} />
    </div>
  )
}

export default AdminDashboard
