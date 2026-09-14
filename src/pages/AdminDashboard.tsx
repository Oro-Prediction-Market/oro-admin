import React, { useState, useEffect } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { TrendingUp, Activity, AlertCircle, Users } from "lucide-react"
import HealthCheck from "../components/HealthCheck"
import { UserGrowth } from "../components/UserGrowth"
import { BehavioralAnalytics } from "../components/BehavioralAnalytics"
import { TierDistribution } from "../components/TierDistribution"

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
    totalBettors: 0,
    activeBettors30d: 0,
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
            totalBettors: number
            activeBettors30d: number
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

        {/* Registered users is a vanity number; this is people who actually
            put money on something. The 30-day line sits underneath because the
            all-time figure only ever goes up — on its own it can't tell a
            growing platform from a dead one. */}
        <div className="glass-card stat-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <h3>People Who Bet</h3>
            <Users size={20} color="hsl(var(--primary))" />
          </div>
          <p>{stats.totalBettors.toLocaleString()}</p>
          <div
            style={{
              marginTop: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {stats.activeBettors30d.toLocaleString()} in the last 30 days
          </div>
        </div>
      </div>

      <TierDistribution token={token} />

      <HealthCheck />

      <UserGrowth token={token} />

      <BehavioralAnalytics token={token} />
    </div>
  )
}

export default AdminDashboard
