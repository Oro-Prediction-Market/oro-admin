import React, { useState } from "react"
import { useAdminMarkets, useAdminApi } from "../lib/useAdminApi"
import { useRealTimeUpdates } from "../hooks/useRealTimeUpdates"
import MarketForm from "../components/MarketForm"
import ResolveMarketModal from "../components/ResolveMarketModal"
import { OddsDisplay } from "../components/OddsDisplay"
import { LateMoneyMonitor } from "../components/LateMoneyMonitor"
import { Plus, Play, Square, CheckSquare, Edit, Trash2, Wifi, WifiOff } from "lucide-react"

const MarketManagement: React.FC = () => {
  const token = localStorage.getItem("admin_token")
  const { markets, loading, refresh } = useAdminMarkets(token)
  const api = useAdminApi(token)

  const [view, setView] = useState<"list" | "create" | "edit">("list")
  const [editingMarket, setEditingMarket] = useState<any>(null)
  const [resolvingMarket, setResolvingMarket] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null)

  // Real-time updates
  const { markets: realtimeMarkets, lastUpdate, connectionStatus } = useRealTimeUpdates(markets)
  const displayMarkets = realtimeMarkets.length > 0 ? realtimeMarkets : markets

  const statuses = ["All", "Upcoming", "Open", "Closed", "Resolved", "Cancelled"]

  const filteredMarkets = displayMarkets.filter(
    (m: any) => filterStatus === "All" || m.status === filterStatus.toLowerCase()
  )

  const handleCreate = async (data: any) => {
    try {
      await api.createMarket(data)
      refresh()
      setView("list")
    } catch (e: any) {
      alert(`Error creating market: ${e.message}`)
    }
  }

  const handleUpdate = async (data: any) => {
    try {
      await api.updateMarket(editingMarket.id, data)
      refresh()
      setView("list")
      setEditingMarket(null)
    } catch (e: any) {
      alert(`Error updating market: ${e.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this market?")) return
    try {
      await api.deleteMarket(id)
      refresh()
    } catch (e: any) {
      alert(`Error deleting market: ${e.message}`)
    }
  }

  const handleTransition = async (id: string, status: string) => {
    try {
       await api.transitionMarket(id, status)
       refresh()
    } catch (e: any) {
       alert(`Error transitioning market: ${e.message}`)
    }
  }

  const handleResolve = async (winningOutcomeId: string) => {
    try {
      await api.resolveMarket(resolvingMarket.id, winningOutcomeId)
      refresh()
      setResolvingMarket(null)
      // Show success message
      alert(`Market "${resolvingMarket.title}" has been resolved successfully! Check the Settlements page for details.`)
    } catch (e: any) {
      alert(`Error resolving market: ${e.message}`)
    }
  }

  if (view === "create") {
    return <MarketForm onSubmit={handleCreate} onCancel={() => setView("list")} loading={api.loading} />
  }

  if (view === "edit") {
    return <MarketForm initialData={editingMarket} onSubmit={handleUpdate} onCancel={() => setView("list")} loading={api.loading} />
  }

  return (
    <div className="market-management">
      <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Market Management</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
            <span style={{ fontSize: "0.875rem", color: "hsl(var(--muted-foreground))" }}>
              {filteredMarkets.length} markets
            </span>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "0.25rem",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              background: connectionStatus === 'connected' ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--destructive) / 0.1)',
              color: connectionStatus === 'connected' ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
              fontSize: "0.75rem"
            }}>
              {connectionStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connectionStatus === 'connected' ? 'Live' : 'Offline'}
            </div>
            {lastUpdate && (
              <span style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                Last update: {new Date(lastUpdate.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={refresh} className="secondary" title="Refresh">
            ↻ Refresh
          </button>
          <button onClick={() => setView("create")} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={18} /> New Market
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "0" }}>
        <div style={{ padding: "1.5rem", borderBottom: "1px solid hsl(var(--border))", display: "flex", gap: "1rem", overflowX: "auto" }}>
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={filterStatus === status ? "" : "secondary"}
              style={{ fontSize: "0.75rem", padding: "0.5rem 1rem", borderRadius: "9999px" }}
            >
              {status}
            </button>
          ))}
        </div>

        {loading ? (
             <div style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>Analyzing market data...</div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Pool Vol.</th>
                <th>Closes At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarkets.length === 0 ? (
                <tr>
                   <td colSpan={5} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", padding: "3rem" }}>No markets found.</td>
                </tr>
              ) : (
                filteredMarkets.map((m: any) => (
                  <React.Fragment key={m.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                          {m.outcomes.map((o: any) => (
                            <span key={o.id} style={{ 
                              marginRight: "0.5rem", 
                              padding: "0.125rem 0.375rem", 
                              borderRadius: "0.25rem",
                              background: o.isWinner ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted) / 0.3)",
                              color: o.isWinner ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"
                            }}>
                              {o.label}
                              {o.isWinner && " ✓"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${m.status.toLowerCase()}`}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace" }}>${parseFloat(m.totalPool || 0).toLocaleString()}</td>
                      <td style={{ fontSize: "0.75rem" }}>{m.closesAt ? new Date(m.closesAt).toLocaleString() : "Not set"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {m.status === "upcoming" && (
                            <button onClick={() => handleTransition(m.id, "open")} className="secondary" title="Start Market"><Play size={14} /></button>
                          )}
                          {m.status === "open" && (
                            <button onClick={() => handleTransition(m.id, "closed")} className="secondary" title="Close Market"><Square size={14} /></button>
                          )}
                          {m.status === "closed" && (
                            <button onClick={() => setResolvingMarket(m)} className="secondary" title="Resolve Market"><CheckSquare size={14} /></button>
                          )}
                          {(m.status === "upcoming" || m.status === "open") && (
                            <button onClick={() => { setEditingMarket(m); setView("edit"); }} className="secondary" title="Edit"><Edit size={14} /></button>
                          )}
                          {m.status === "upcoming" && (
                            <button onClick={() => handleDelete(m.id)} className="secondary" title="Delete" style={{ color: "hsl(var(--destructive))" }}><Trash2 size={14} /></button>
                          )}
                          <button 
                            onClick={() => setExpandedMarket(expandedMarket === m.id ? null : m.id)}
                            className="secondary" 
                            title="View Details"
                            style={{ fontSize: "0.75rem" }}
                          >
                            {expandedMarket === m.id ? "▼" : "▶"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedMarket === m.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: "0", background: "hsl(var(--muted) / 0.1)" }}>
                          <div style={{ padding: "1.5rem" }}>
                            <OddsDisplay 
                              outcomes={m.outcomes}
                              totalPool={Number(m.totalPool || 0)}
                              houseEdgePct={Number(m.houseEdgePct || 5)}
                              isEstimated={m.status === "open"}
                              showWarnings={true}
                            />
                            {m.status === "open" && (
                              <LateMoneyMonitor 
                                market={m}
                                onLateMoneyDetected={(data) => {
                                  console.log('Late money detected:', data)
                                  // Could trigger notifications or automatic actions
                                }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {resolvingMarket && (
        <ResolveMarketModal
          market={resolvingMarket}
          onResolve={handleResolve}
          onCancel={() => setResolvingMarket(null)}
          loading={api.loading}
        />
      )}
    </div>
  )
}

export default MarketManagement
