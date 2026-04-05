import React, { useState } from "react"
import { useAdminMarkets, useAdminApi } from "../lib/useAdminApi"
import { useRealTimeUpdates } from "../hooks/useRealTimeUpdates"
import MarketForm, { type MarketFormData } from "../components/MarketForm"
import ResolveMarketModal from "../components/ResolveMarketModal"
import ProposeMarketModal from "../components/ProposeMarketModal"
import CancelMarketModal from "../components/CancelMarketModal"
import { OddsDisplay } from "../components/OddsDisplay"
import { LateMoneyMonitor } from "../components/LateMoneyMonitor"
import {
  Plus,
  Play,
  Square,
  CheckSquare,
  Edit,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react"

interface Outcome {
  id: string
  label: string
  isWinner?: boolean
  totalBetAmount?: string | number
}

interface Market {
  id: string
  title: string
  status: string
  closesAt?: string
  poolVolume?: string | number
  totalPool?: string | number
  houseEdgePct?: number
  outcomes: Outcome[]
}

interface Dispute {
  id: string
  [key: string]: unknown
}

const MarketManagement: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const { markets, loading, refresh } = useAdminMarkets(token)
  const api = useAdminApi(token)

  const [view, setView] = useState<"list" | "create" | "edit">("list")
  const [editingMarket, setEditingMarket] = useState<Market | null>(null)
  const [proposingMarket, setProposingMarket] = useState<Market | null>(null)
  const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null)
  const [resolvingDisputes, setResolvingDisputes] = useState<Dispute[]>([])
  const [cancellingMarket, setCancellingMarket] = useState<Market | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null)

  // Real-time updates
  const {
    markets: realtimeMarkets,
    lastUpdate,
    connectionStatus,
  } = useRealTimeUpdates(markets)
  const displayMarkets = realtimeMarkets.length > 0 ? realtimeMarkets : markets

  const statuses = [
    "All",
    "Upcoming",
    "Open",
    "Closed",
    "Resolving",
    "Resolved",
    "Settled",
    "Cancelled",
  ]

  const filteredMarkets = displayMarkets.filter(
    (m: Market) =>
      filterStatus === "All" || m.status === filterStatus.toLowerCase()
  )

  const handleCreate = async (data: MarketFormData) => {
    try {
      await api.createMarket(data as unknown as Record<string, unknown>)
      refresh()
      setView("list")
    } catch (e: unknown) {
      alert(
        `Error creating market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleUpdate = async (data: MarketFormData) => {
    if (!editingMarket) return
    try {
      await api.updateMarket(
        editingMarket.id,
        data as unknown as Record<string, unknown>
      )
      refresh()
      setView("list")
      setEditingMarket(null)
    } catch (e: unknown) {
      alert(
        `Error updating market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this market?")) return
    try {
      await api.deleteMarket(id)
      refresh()
    } catch (e: unknown) {
      alert(
        `Error deleting market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleTransition = async (id: string, status: string) => {
    try {
      await api.transitionMarket(id, status)
      refresh()
    } catch (e: unknown) {
      alert(
        `Error transitioning market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handlePropose = async (proposedOutcomeId: string) => {
    if (!proposingMarket) return
    try {
      await api.proposeMarket(proposingMarket.id, proposedOutcomeId)
      refresh()
      setProposingMarket(null)
      alert(
        `Dispute window opened for "${proposingMarket.title}". Bettors have 24 hours to dispute.`
      )
    } catch (e: unknown) {
      alert(
        `Error proposing outcome: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleOpenResolve = async (market: Market) => {
    setResolvingMarket(market)
    try {
      const disputes = await api.getMarketDisputes(market.id)
      setResolvingDisputes((disputes as Dispute[]) ?? [])
    } catch {
      setResolvingDisputes([])
    }
  }

  const handleResolve = async (winningOutcomeId: string) => {
    if (!resolvingMarket) return
    try {
      await api.resolveMarket(resolvingMarket.id, winningOutcomeId)
      refresh()
      setResolvingMarket(null)
      setResolvingDisputes([])
      alert(
        `Market "${resolvingMarket.title}" has been resolved successfully! Check the Settlements page for details.`
      )
    } catch (e: unknown) {
      alert(
        `Error resolving market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleCancel = async () => {
    if (!cancellingMarket) return
    try {
      await api.cancelMarket(cancellingMarket.id)
      refresh()
      setCancellingMarket(null)
      alert(
        `Market "${cancellingMarket.title}" has been cancelled. All pending bets have been refunded.`
      )
    } catch (e: unknown) {
      alert(
        `Error cancelling market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  if (view === "create") {
    return (
      <MarketForm
        onSubmit={handleCreate}
        onCancel={() => setView("list")}
        loading={api.loading}
      />
    )
  }

  if (view === "edit") {
    return (
      <MarketForm
        initialData={editingMarket ?? undefined}
        onSubmit={handleUpdate}
        onCancel={() => setView("list")}
        loading={api.loading}
      />
    )
  }

  return (
    <div className="market-management">
      <div
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2>Market Management</h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.875rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {filteredMarkets.length} markets
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                background:
                  connectionStatus === "connected"
                    ? "hsl(var(--success) / 0.1)"
                    : "hsl(var(--destructive) / 0.1)",
                color:
                  connectionStatus === "connected"
                    ? "hsl(var(--success))"
                    : "hsl(var(--destructive))",
                fontSize: "0.75rem",
              }}
            >
              {connectionStatus === "connected" ? (
                <Wifi size={12} />
              ) : (
                <WifiOff size={12} />
              )}
              {connectionStatus === "connected" ? "Live" : "Offline"}
            </div>
            {lastUpdate && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                Last update:{" "}
                {new Date(lastUpdate.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={refresh} className="secondary" title="Refresh">
            ↻ Refresh
          </button>
          <button
            onClick={() => setView("create")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Plus size={18} /> New Market
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "0" }}>
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            gap: "1rem",
            overflowX: "auto",
          }}
        >
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={filterStatus === status ? "" : "secondary"}
              style={{
                fontSize: "0.75rem",
                padding: "0.5rem 1rem",
                borderRadius: "9999px",
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Analyzing market data...
          </div>
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
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      color: "hsl(var(--muted-foreground))",
                      padding: "3rem",
                    }}
                  >
                    No markets found.
                  </td>
                </tr>
              ) : (
                filteredMarkets.map((m: Market) => (
                  <React.Fragment key={m.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.title}</div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "hsl(var(--muted-foreground))",
                          }}
                        >
                          {m.outcomes.map((o: Outcome) => (
                            <span
                              key={o.id}
                              style={{
                                marginRight: "0.5rem",
                                padding: "0.125rem 0.375rem",
                                borderRadius: "0.25rem",
                                background: o.isWinner
                                  ? "hsl(var(--primary) / 0.2)"
                                  : "hsl(var(--muted) / 0.3)",
                                color: o.isWinner
                                  ? "hsl(var(--primary))"
                                  : "hsl(var(--muted-foreground))",
                              }}
                            >
                              {o.label}
                              {o.isWinner && " ✓"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-${m.status.toLowerCase()}`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace" }}>
                        NU.{" "}
                        {parseFloat(String(m.totalPool ?? 0)).toLocaleString()}
                      </td>
                      <td style={{ fontSize: "0.75rem" }}>
                        {m.closesAt
                          ? new Date(m.closesAt).toLocaleString()
                          : "Not set"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {m.status === "upcoming" && (
                            <button
                              onClick={() => handleTransition(m.id, "open")}
                              className="secondary"
                              title="Start Market"
                            >
                              <Play size={14} />
                            </button>
                          )}
                          {m.status === "open" && (
                            <button
                              onClick={() => handleTransition(m.id, "closed")}
                              className="secondary"
                              title="Close Market"
                            >
                              <Square size={14} />
                            </button>
                          )}
                          {m.status === "closed" && (
                            <button
                              onClick={() => setProposingMarket(m)}
                              className="secondary"
                              title="Propose Outcome & Open Dispute Window"
                              style={{ color: "hsl(45, 80%, 60%)" }}
                            >
                              ⚖️
                            </button>
                          )}
                          {m.status === "resolving" && (
                            <button
                              onClick={() => handleOpenResolve(m)}
                              className="secondary"
                              title="Final Resolution"
                            >
                              <CheckSquare size={14} />
                            </button>
                          )}
                          {(m.status === "upcoming" || m.status === "open") && (
                            <button
                              onClick={() => {
                                setEditingMarket(m)
                                setView("edit")
                              }}
                              className="secondary"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {m.status === "upcoming" && (
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="secondary"
                              title="Delete"
                              style={{ color: "hsl(var(--destructive))" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {(m.status === "upcoming" ||
                            m.status === "open" ||
                            m.status === "closed" ||
                            m.status === "resolving") && (
                            <button
                              onClick={() => setCancellingMarket(m)}
                              className="secondary"
                              title="Cancel & Refund all bets"
                              style={{ color: "hsl(var(--destructive))" }}
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setExpandedMarket(
                                expandedMarket === m.id ? null : m.id
                              )
                            }
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
                        <td
                          colSpan={5}
                          style={{
                            padding: "0",
                            background: "hsl(var(--muted) / 0.1)",
                          }}
                        >
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
                                  console.log("Late money detected:", data)
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

      {proposingMarket && (
        <ProposeMarketModal
          market={proposingMarket}
          onPropose={handlePropose}
          onCancel={() => setProposingMarket(null)}
          loading={api.loading}
        />
      )}
      {resolvingMarket && (
        <ResolveMarketModal
          market={resolvingMarket}
          disputes={resolvingDisputes}
          onResolve={handleResolve}
          onCancel={() => {
            setResolvingMarket(null)
            setResolvingDisputes([])
          }}
          loading={api.loading}
        />
      )}
      {cancellingMarket && (
        <CancelMarketModal
          market={{
            ...cancellingMarket,
            totalPool: cancellingMarket.totalPool ?? 0,
            outcomes: cancellingMarket.outcomes.map((o) => ({
              id: o.id,
              label: o.label,
              totalBetAmount: o.totalBetAmount ?? 0,
            })),
          }}
          pendingBetCount={cancellingMarket.outcomes.reduce(
            (sum: number, o: Outcome) =>
              sum + (Number(o.totalBetAmount) > 0 ? 1 : 0),
            0
          )}
          onConfirm={handleCancel}
          onClose={() => setCancellingMarket(null)}
          loading={api.loading}
        />
      )}
    </div>
  )
}

export default MarketManagement
