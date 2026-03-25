import React, { useMemo } from "react"
import { useAdminMarkets } from "../lib/useAdminApi"
import { TrendingUp, Activity, AlertCircle } from "lucide-react"

const AdminDashboard: React.FC = () => {
  const token = localStorage.getItem("admin_token")
  const { markets, loading, error } = useAdminMarkets(token)

  const stats = useMemo(() => {
    const activeMarkets = markets.filter((m: any) => m.status === "Open").length
    const totalPoolVolume = markets.reduce(
      (sum: number, m: any) => sum + (parseFloat(m.poolVolume) || 0),
      0
    )
    const unsettledMarkets = markets.filter(
      (m: any) => m.status === "Closed"
    ).length
    return { activeMarkets, totalPoolVolume, unsettledMarkets }
  }, [markets])

  const formatVolume = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val)
  }

  if (loading) return <div style={{ padding: "2rem", color: "hsl(var(--muted-foreground))" }}>Initializing uplink...</div>
  if (error) return <div style={{ padding: "2rem", color: "hsl(var(--destructive))" }}>ERROR: {error}</div>

  return (
    <div className="dashboard-view">
      <h2 style={{ marginBottom: "2rem" }}>System Overview</h2>
      
      <div className="stat-grid">
        <div className="glass-card stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <h3>Active Markets</h3>
            <Activity size={20} color="hsl(var(--primary))" />
          </div>
          <p>{stats.activeMarkets}</p>
        </div>

        <div className="glass-card stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <h3>Total Pool Volume</h3>
            <TrendingUp size={20} color="hsl(var(--primary))" />
          </div>
          <p>{formatVolume(stats.totalPoolVolume)}</p>
        </div>

        <div className="glass-card stat-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <h3>Unsettled</h3>
            <AlertCircle size={20} color="hsl(var(--primary))" />
          </div>
          <p>{stats.unsettledMarkets}</p>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: "2rem" }}>
        <h3>Recent Activity</h3>
        <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem" }}>
          Everything is running smoothly. Check the Markets tab for detailed management.
        </p>
      </div>
    </div>
  )
}

export default AdminDashboard
