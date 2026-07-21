import React, { useState, useEffect, useRef } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { useRealTimeUpdates } from "../hooks/useRealTimeUpdates"
import MarketForm, { type MarketFormData } from "../components/MarketForm"
import ResolveMarketModal from "../components/ResolveMarketModal"
import ProposeMarketModal from "../components/ProposeMarketModal"
import CancelMarketModal from "../components/CancelMarketModal"
import { OddsDisplay } from "../components/OddsDisplay"
import { LateMoneyMonitor } from "../components/LateMoneyMonitor"
import { useToast } from "../components/Toast"
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
  Megaphone,
  Star,
} from "lucide-react"

interface Outcome {
  id: string
  label: string
  isWinner?: boolean
  isEliminated?: boolean
  totalBetAmount?: string | number
  [key: string]: unknown
}

interface Market {
  id: string
  title: string
  status: string
  closesAt?: string
  poolVolume?: string | number
  totalPool?: string | number
  houseEdgePct?: number
  category?: string | null
  subcategory?: string | null
  outcomes: Outcome[]
  [key: string]: unknown
}

interface Dispute {
  id: string
  [key: string]: unknown
}

const PAGE_SIZE = 20

const MarketManagement: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()

  const [markets, setMarkets] = useState<Market[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [fetching, setFetching] = useState(false)

  const [view, setView] = useState<"list" | "create" | "edit">("list")
  const [editingMarket, setEditingMarket] = useState<Market | null>(null)
  const [proposingMarket, setProposingMarket] = useState<Market | null>(null)
  const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null)
  const [resolvingDisputes, setResolvingDisputes] = useState<Dispute[]>([])
  const [cancellingMarket, setCancellingMarket] = useState<Market | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null)

  const getMarketsRef = useRef(api.getMarkets)
  useEffect(() => {
    getMarketsRef.current = api.getMarkets
  })

  const fetchMarkets = useRef((p: number, status: string) => {
    let cancelled = false
    setFetching(true)
    getMarketsRef
      .current({ page: p, limit: PAGE_SIZE, status, externalSource: "none" })
      .then((res) => {
        if (cancelled) return
        const r = res as {
          data: Market[]
          total: number
          page: number
          pages: number
        }
        setMarkets(r.data ?? [])
        setTotal(r.total ?? 0)
        setPages(r.pages ?? 1)
      })
      .catch(() => {
        if (!cancelled) setMarkets([])
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })
    return () => {
      cancelled = true
    }
  })

  useEffect(() => {
    return fetchMarkets.current(page, filterStatus)
  }, [page, filterStatus])

  const refresh = () => fetchMarkets.current(page, filterStatus)

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

  // Real-time updates overlay on current page
  const {
    markets: realtimeMarkets,
    lastUpdate,
    connectionStatus,
  } = useRealTimeUpdates(markets)
  const displayMarkets =
    realtimeMarkets.length > 0 && view === "list" ? realtimeMarkets : markets

  const handleCreate = async (data: MarketFormData) => {
    try {
      if (data.candidates?.length) {
        await api.createMarketGroup({
          title: data.title,
          ...(data.description ? { description: data.description } : {}),
          ...(data.opensAt ? { opensAt: data.opensAt } : {}),
          ...(data.closesAt ? { closesAt: data.closesAt } : {}),
          houseEdgePct: data.houseEdgePct,
          liquidityParam: data.liquidityParam,
          category: data.category,
          ...(data.subcategory ? { subcategory: data.subcategory } : {}),
          ...(data.settlementSource
            ? { settlementSource: data.settlementSource }
            : {}),
          candidates: data.candidates.map((c) => ({
            name: c.name,
            imageUrl: c.imageUrl ?? null,
          })),
        })
      } else {
        await api.createMarket({
          ...(data as unknown as Record<string, unknown>),
          outcomes: data.outcomes.map((o) => ({
            label: o.label,
            imageUrl: o.imageUrl ?? null,
          })),
        })
      }
      setPage(1)
      refresh()
      setView("list")
      notify(
        "success",
        data.candidates?.length
          ? `Market group created — ${data.candidates.length} Yes/No candidate markets.`
          : "Market created successfully."
      )
    } catch (e: unknown) {
      notify(
        "error",
        `Error creating market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleUpdate = async (data: MarketFormData) => {
    if (!editingMarket) return
    try {
      await api.updateMarket(editingMarket.id, {
        ...(data as unknown as Record<string, unknown>),
        outcomes: data.outcomes.map((o) => ({
          id: o.id,
          label: o.label,
          imageUrl: o.imageUrl ?? null,
        })),
      })
      await refresh()
      setView("list")
      setEditingMarket(null)
      notify("success", "Market updated successfully.")
    } catch (e: unknown) {
      notify(
        "error",
        `Error updating market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleAddOutcome = async (data: {
    label: string
    imageUrl?: string | null
  }) => {
    if (!editingMarket) return
    const updated = (await api.addOutcome(editingMarket.id, data)) as Market
    setEditingMarket(updated)
    await refresh()
    notify("success", `Outcome "${data.label}" added.`)
    const created = updated.outcomes?.find((o) => o.label === data.label)
    return created
      ? {
          id: created.id,
          label: created.label,
          imageUrl: created.imageUrl ?? null,
        }
      : undefined
  }

  const handleToggleEliminated = async (marketId: string, outcome: Outcome) => {
    const next = !outcome.isEliminated
    const verb = next ? "Eliminate" : "Restore"
    if (
      !confirm(
        `${verb} "${outcome.label}"? ${
          next
            ? "No new bets will be accepted on it; existing bets lose at resolution."
            : "It will accept bets again."
        }`
      )
    )
      return
    try {
      await api.setOutcomeEliminated(marketId, outcome.id, next)
      await refresh()
      notify(
        "success",
        `"${outcome.label}" ${next ? "eliminated" : "restored"}.`
      )
    } catch (e: unknown) {
      notify(
        "error",
        `Error updating outcome: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this market?")) return
    try {
      await api.deleteMarket(id)
      refresh()
      notify("success", "Market deleted.")
    } catch (e: unknown) {
      notify(
        "error",
        `Error deleting market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handlePurgeEmpty = async () => {
    if (
      !confirm(
        "This will permanently delete all markets with zero pool volume (no bets placed). Continue?"
      )
    )
      return
    try {
      const result = (await api.purgeEmptyMarkets()) as { deleted: number }
      refresh()
      notify("success", `Purged ${result.deleted} empty market(s).`)
    } catch (e: unknown) {
      notify(
        "error",
        `Error purging empty markets: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleAnnounce = async (m: Market) => {
    if (
      !window.confirm(
        `Announce "${m.title}" to the Telegram channel? This will notify all channel members.`
      )
    )
      return
    try {
      await api.announceMarket(m.id)
      notify("success", "Market announced to the Telegram channel.")
    } catch (e: unknown) {
      notify(
        "error",
        `Error announcing market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleToggleFeatured = async (m: Market) => {
    const next = !m.isFeatured
    try {
      await api.updateMarket(m.id, { isFeatured: next })
      refresh()
      notify(
        "success",
        next
          ? "Pinned as the featured match."
          : "Unpinned — featured match reverts to the biggest-pool pick."
      )
    } catch (e: unknown) {
      notify(
        "error",
        `Error updating featured flag: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleTransition = async (id: string, status: string) => {
    try {
      await api.transitionMarket(id, status)
      refresh()
      notify("success", `Market moved to ${status}.`)
    } catch (e: unknown) {
      notify(
        "error",
        `Error transitioning market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handlePropose = async (
    proposedOutcomeId: string,
    windowMinutes: number
  ) => {
    if (!proposingMarket) return
    try {
      await api.proposeMarket(
        proposingMarket.id,
        proposedOutcomeId,
        windowMinutes
      )
      refresh()
      setProposingMarket(null)
      const windowLabel =
        windowMinutes >= 60
          ? `${windowMinutes / 60} hour${windowMinutes > 60 ? "s" : ""}`
          : `${windowMinutes} minutes`
      notify(
        "success",
        `Objection window opened for "${proposingMarket.title}". Bettors have ${windowLabel} to object.`
      )
    } catch (e: unknown) {
      notify(
        "error",
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

  const handleResolve = async (
    winningOutcomeIds: string[],
    evidenceUrl: string,
    evidenceNote: string
  ) => {
    if (!resolvingMarket) return
    try {
      await api.resolveMarket(
        resolvingMarket.id,
        winningOutcomeIds,
        evidenceUrl,
        evidenceNote
      )
      refresh()
      setResolvingMarket(null)
      setResolvingDisputes([])
      notify(
        "success",
        `Market "${resolvingMarket.title}" has been settled. Evidence published on the Resolution Log.`
      )
    } catch (e: unknown) {
      notify(
        "error",
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
      notify(
        "success",
        `Market "${cancellingMarket.title}" has been cancelled. All pending bets have been refunded.`
      )
    } catch (e: unknown) {
      notify(
        "error",
        `Error cancelling market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  if (view === "create") {
    return (
      <>
        {ToastContainer}
        <MarketForm
          onSubmit={handleCreate}
          onCancel={() => setView("list")}
          loading={api.loading}
        />
      </>
    )
  }

  if (view === "edit") {
    return (
      <>
        {ToastContainer}
        <MarketForm
          initialData={editingMarket ?? undefined}
          onSubmit={handleUpdate}
          onCancel={() => setView("list")}
          loading={api.loading}
          onAddOutcome={handleAddOutcome}
        />
      </>
    )
  }

  return (
    <div className="market-management">
      {ToastContainer}
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
              {total} markets
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
            onClick={handlePurgeEmpty}
            className="secondary"
            title="Delete all markets with zero pool volume"
            style={{
              color: "hsl(var(--destructive))",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Trash2 size={14} /> Purge Empty
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
              onClick={() => {
                setFilterStatus(status)
                setPage(1)
              }}
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

        {fetching ? (
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
              {displayMarkets.length === 0 ? (
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
                displayMarkets.map((m: Market) => (
                  <React.Fragment key={m.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.title}</div>
                        {(m.category || m.subcategory) && (
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              marginTop: 3,
                              flexWrap: "wrap",
                            }}
                          >
                            {m.category && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "hsl(var(--primary) / 0.1)",
                                  color: "hsl(var(--primary))",
                                  textTransform: "capitalize",
                                }}
                              >
                                {m.category}
                              </span>
                            )}
                            {m.subcategory && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "hsl(var(--muted) / 0.4)",
                                  color: "hsl(var(--muted-foreground))",
                                }}
                              >
                                {m.subcategory}
                              </span>
                            )}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.3rem",
                            marginTop: "0.4rem",
                            fontSize: "0.72rem",
                          }}
                        >
                          {m.outcomes.map((o: Outcome) => {
                            // Eliminating an outcome only makes sense while the
                            // market is still taking bets and the outcome isn't
                            // already the declared winner.
                            const canToggle =
                              !o.isWinner &&
                              (m.status === "open" || m.status === "upcoming")
                            return (
                              <button
                                key={o.id}
                                type="button"
                                disabled={!canToggle}
                                onClick={
                                  canToggle
                                    ? () => handleToggleEliminated(m.id, o)
                                    : undefined
                                }
                                title={
                                  canToggle
                                    ? o.isEliminated
                                      ? "Click to restore (allow bets again)"
                                      : "Click to eliminate (stop new bets)"
                                    : o.isWinner
                                      ? "Declared winner"
                                      : "Only editable while the market is open or upcoming"
                                }
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  padding: "0.2rem 0.5rem",
                                  borderRadius: "999px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  lineHeight: 1.2,
                                  cursor: canToggle ? "pointer" : "default",
                                  textDecoration: o.isEliminated
                                    ? "line-through"
                                    : "none",
                                  border: o.isWinner
                                    ? "1px solid hsl(var(--primary) / 0.5)"
                                    : o.isEliminated
                                      ? "1px solid hsl(0 84% 60% / 0.6)"
                                      : canToggle
                                        ? "1px dashed hsl(var(--muted-foreground) / 0.5)"
                                        : "1px solid hsl(var(--muted) / 0.4)",
                                  background: o.isWinner
                                    ? "hsl(var(--primary) / 0.2)"
                                    : o.isEliminated
                                      ? "hsl(0 84% 60% / 0.18)"
                                      : "hsl(var(--muted) / 0.3)",
                                  color: o.isWinner
                                    ? "hsl(var(--primary))"
                                    : o.isEliminated
                                      ? "hsl(0 84% 60%)"
                                      : "hsl(var(--foreground))",
                                }}
                              >
                                {o.label}
                                {o.isWinner && " ✓"}
                                {o.isEliminated
                                  ? " ✕"
                                  : canToggle && (
                                      <span style={{ opacity: 0.6 }}>✕</span>
                                    )}
                              </button>
                            )
                          })}
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
                          {(m.status === "upcoming" || m.status === "open") && (
                            <button
                              onClick={() => handleAnnounce(m)}
                              className="secondary"
                              title="Announce to Telegram channel"
                            >
                              <Megaphone size={14} />
                            </button>
                          )}
                          {(m.status === "upcoming" || m.status === "open") &&
                            (m.subcategory || "")
                              .toLowerCase()
                              .includes("epl") &&
                            m.title.toLowerCase().includes(" vs ") && (
                              <button
                                onClick={() => handleToggleFeatured(m)}
                                className="secondary"
                                title={
                                  m.isFeatured
                                    ? "Featured match — click to unpin"
                                    : "Pin as the featured match in the EPL hub"
                                }
                                style={{
                                  color: m.isFeatured
                                    ? "hsl(45, 90%, 55%)"
                                    : undefined,
                                }}
                              >
                                <Star
                                  size={14}
                                  fill={m.isFeatured ? "currentColor" : "none"}
                                />
                              </button>
                            )}
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
                          {(m.status === "upcoming" ||
                            m.status === "cancelled" ||
                            parseFloat(String(m.totalPool ?? 0)) === 0) && (
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

      {total > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setPage(1)}
            disabled={page === 1 || fetching}
          >
            «
          </button>
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || fetching}
          >
            ‹ Prev
          </button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 3, pages - 6))
            return start + i
          }).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              disabled={fetching}
              style={{
                padding: "6px 12px",
                fontSize: "0.8rem",
                borderRadius: 8,
                border: "none",
                background:
                  p === page ? "hsl(var(--primary))" : "hsl(var(--background))",
                color:
                  p === page
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))",
                fontWeight: p === page ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages || fetching}
          >
            Next ›
          </button>
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setPage(pages)}
            disabled={page === pages || fetching}
          >
            »
          </button>
          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Page {page} / {pages} · {total} markets
          </span>
        </div>
      )}

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
