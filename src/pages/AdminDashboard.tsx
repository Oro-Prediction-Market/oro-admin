import React, { useState, useEffect } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { TrendingUp, Activity, AlertCircle } from "lucide-react"
import HealthCheck from "../components/HealthCheck"
import { BehavioralAnalytics } from "../components/BehavioralAnalytics"

const AdminDashboard: React.FC = () => {
  const token =
    sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token")
  const api = useAdminApi(token)

  // KPIs come from a server-side aggregate over ALL markets. The old approach
  // counted a single 500-row page in the browser, so with thousands of markets
  // it silently under-reported every tile (open pool read 0, unsettled read ~5).
  const [stats, setStats] = useState({
    activeMarkets: 0,
    totalPoolVolume: 0,
    unsettledMarkets: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getMarketStats()
      .then((r) =>
        setStats(
          r as {
            activeMarkets: number
            totalPoolVolume: number
            unsettledMarkets: number
          }
        )
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      <HealthCheck />

      <BehavioralAnalytics token={token} />
    </div>
  )
}

export default AdminDashboard
