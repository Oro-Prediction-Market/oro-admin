import React, { useState, useEffect, useRef } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { DEFAULT_HOUSE_EDGE_PCT } from "../lib/fee"
import { useRealTimeUpdates } from "../hooks/useRealTimeUpdates"
import MarketForm, { type MarketFormData } from "../components/MarketForm"
import GroupEditForm, {
  type GroupMarket,
  type GroupEditPayload,
} from "../components/GroupEditForm"
import {
  CATEGORIES,
  SPORT_SUBCATEGORIES,
  GAMING_SUBCATEGORIES,
} from "../lib/marketCategories"
import ResolveMarketModal from "../components/ResolveMarketModal"
import ProposeMarketModal from "../components/ProposeMarketModal"
import CancelMarketModal from "../components/CancelMarketModal"
import ConfirmDialog from "../components/ConfirmDialog"
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
  RotateCcw,
  Search,
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
  imageUrl?: string | null
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

// A timeout or network-level failure — the signature of hitting a backend that
// spun down and is cold-starting. (A 4xx/5xx from the app carries a real message
// and is NOT retried.)
function isColdStartError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase()
  return (
    m.includes("timed out") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed")
  )
}

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
  const [editingGroup, setEditingGroup] = useState<GroupMarket[] | null>(null)
  const [proposingMarket, setProposingMarket] = useState<Market | null>(null)
  const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null)
  const [resolvingDisputes, setResolvingDisputes] = useState<Dispute[]>([])
  const [cancellingMarket, setCancellingMarket] = useState<Market | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    variant: "danger" | "default"
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterSubcategory, setFilterSubcategory] = useState("All")
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null)

  const getMarketsRef = useRef(api.getMarkets)
  useEffect(() => {
    getMarketsRef.current = api.getMarkets
  })

  // Debounce the search box so we don't refetch on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Keep the (possibly spun-down) free-tier backend awake and the connection
  // warm while the create/edit form is open. Without this, a long form-fill
  // sends zero requests, the server sleeps, and the eventual submit lands on a
  // cold start and times out. Pings /admin/health every 60s; bypasses the shared
  // loading flag so it never flickers the form buttons.
  useEffect(() => {
    if (view !== "create" && view !== "edit") return
    const id = setInterval(() => {
      void api.keepAlive()
    }, 60_000)
    return () => clearInterval(id)
  }, [view, api])

  const fetchMarkets = useRef(
    (
      p: number,
      status: string,
      category: string,
      subcategory: string,
      searchQ: string
    ) => {
      let cancelled = false
      setFetching(true)
      getMarketsRef
        .current({
          page: p,
          limit: PAGE_SIZE,
          status,
          // Show manual + imported markets, but hide the thousands of
          // auto-generated btc/ter markets that would otherwise bury the tab.
          excludeSources: "btc,ter",
          category,
          subcategory,
          search: searchQ,
        })
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
    }
  )

  useEffect(() => {
    return fetchMarkets.current(
      page,
      filterStatus,
      filterCategory,
      filterSubcategory,
      debouncedSearch
    )
  }, [page, filterStatus, filterCategory, filterSubcategory, debouncedSearch])

  const refresh = () =>
    fetchMarkets.current(
      page,
      filterStatus,
      filterCategory,
      filterSubcategory,
      debouncedSearch
    )

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

  // Full category list = the canonical set used when creating markets.
  const categoryOptions = CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
  }))

  // Canonical subcategories per category (from the market-creation form), plus
  // any extra subcategory values that actually appear in the loaded markets.
  const gamingSubLabel = (v: string) =>
    GAMING_SUBCATEGORIES.find((g) => g.value === v)?.label ?? v
  const canonicalSubs = (cat: string): string[] => {
    if (cat === "sports") return SPORT_SUBCATEGORIES.filter(Boolean)
    if (cat === "gaming")
      return GAMING_SUBCATEGORIES.map((g) => g.value).filter(Boolean)
    if (cat === "All")
      return [
        ...SPORT_SUBCATEGORIES.filter(Boolean),
        ...GAMING_SUBCATEGORIES.map((g) => g.value).filter(Boolean),
      ]
    return []
  }
  const derivedSubs = displayMarkets
    .filter((m) => filterCategory === "All" || m.category === filterCategory)
    .map((m) => m.subcategory)
    .filter(Boolean) as string[]
  const subcategoryOptions = Array.from(
    new Set([...canonicalSubs(filterCategory), ...derivedSubs])
  ).sort()

  const filtersActive =
    !!search.trim() || filterCategory !== "All" || filterSubcategory !== "All"

  const handleCreate = async (data: MarketFormData) => {
    const submit = async () => {
      const marketImageUrl = data.imageUrl.trim()
      if (data.candidates?.length) {
        await api.createMarketGroup({
          title: data.title,
          ...(data.description ? { description: data.description } : {}),
          ...(marketImageUrl ? { imageUrl: marketImageUrl } : {}),
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
    }
    try {
      try {
        await submit()
      } catch (e: unknown) {
        // A spun-down free-tier backend fails the first request while it cold
        // starts. That first hit wakes it — retry once before giving up.
        if (!isColdStartError(e)) throw e
        await new Promise((r) => setTimeout(r, 1500))
        await submit()
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
      // Rethrow so MarketForm keeps the form filled and its autosaved draft —
      // nothing the admin typed is lost on a failed submit.
      throw e
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

  const handleEditGroup = async (m: Market) => {
    const groupId = m.groupId as string | undefined
    if (!groupId) return
    try {
      const siblings = (await api.getMarketGroup(groupId)) as GroupMarket[]
      setEditingGroup(siblings)
    } catch (e: unknown) {
      notify(
        "error",
        `Error loading group: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleUpdateGroup = async (payload: GroupEditPayload) => {
    const groupId = editingGroup?.[0]?.groupId
    if (!groupId) return
    try {
      await api.updateMarketGroup(groupId, {
        ...payload,
        opensAt: payload.opensAt,
        closesAt: payload.closesAt,
      })
      await refresh()
      setEditingGroup(null)
      notify("success", "Market group updated successfully.")
    } catch (e: unknown) {
      notify(
        "error",
        `Error updating group: ${e instanceof Error ? e.message : String(e)}`
      )
      throw e
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

  const handleAnnounce = (m: Market) => {
    setConfirmDialog({
      title: "Announce to Telegram",
      message: `Announce "${m.title}" to the Telegram channel?\n\nThis will notify all channel members.`,
      confirmLabel: "Announce",
      variant: "default",
      onConfirm: async () => {
        try {
          await api.announceMarket(m.id)
          notify("success", "Market announced to the Telegram channel.")
        } catch (e: unknown) {
          notify(
            "error",
            `Error announcing market: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      },
    })
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

  const doTransition = async (id: string, status: string) => {
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

  const handleTransition = (id: string, status: string, title?: string) => {
    // Closing a live market immediately stops all betting — confirm first
    // (the button is a small icon that's easy to hit by mistake).
    if (status === "closed") {
      setConfirmDialog({
        title: "Close market",
        message:
          `Close market${title ? ` "${title}"` : ""}?\n\n` +
          `This immediately stops all betting. You can reopen it afterward, but ` +
          `only do this deliberately — an accidental close interrupts a live market.`,
        confirmLabel: "Close market",
        variant: "danger",
        onConfirm: () => doTransition(id, status),
      })
      return
    }
    void doTransition(id, status)
  }

  // World Cup hub markets only — backend rejects any non-"wc-*" subcategory.
  // Asks for a duration in minutes so the admin never has to type a date;
  // the new closesAt is computed as now + minutes (always in the future).
  const handleReopen = async (m: Market) => {
    const input = window.prompt(
      `Reopen "${m.title}" for how many minutes?\nBetting closes again at now + minutes.`,
      "120"
    )
    if (input === null) return
    const minutes = Number(input.trim())
    if (!Number.isFinite(minutes) || minutes <= 0) {
      notify("error", "Enter a positive number of minutes.")
      return
    }
    try {
      const closesAt = new Date(Date.now() + minutes * 60_000).toISOString()
      await api.reopenMarket(m.id, closesAt)
      refresh()
      notify(
        "success",
        `Market reopened — betting closes at ${new Date(closesAt).toLocaleString()}.`
      )
    } catch (e: unknown) {
      notify(
        "error",
        `Error reopening market: ${e instanceof Error ? e.message : String(e)}`
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
    winningOutcomeId: string,
    evidenceUrl: string,
    evidenceNote: string
  ) => {
    if (!resolvingMarket) return
    try {
      await api.resolveMarket(
        resolvingMarket.id,
        winningOutcomeId,
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
      <div className="page-header">
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
        <div className="page-header-actions">
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
          className="status-tabs"
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

        {/* Search + category / subcategory filters */}
        <div
          className="filter-bar"
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div
            style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}
          >
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "hsl(var(--muted-foreground))",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search markets by title…"
              style={{
                width: "100%",
                padding: "8px 10px 8px 32px",
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
                fontSize: "0.82rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value)
              setFilterSubcategory("All")
              setPage(1)
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              fontSize: "0.82rem",
              flex: "0 1 180px",
            }}
          >
            <option value="All">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={filterSubcategory}
            onChange={(e) => {
              setFilterSubcategory(e.target.value)
              setPage(1)
            }}
            disabled={subcategoryOptions.length === 0}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              fontSize: "0.82rem",
              flex: "0 1 180px",
              opacity: subcategoryOptions.length === 0 ? 0.5 : 1,
            }}
          >
            <option value="All">All subcategories</option>
            {subcategoryOptions.map((s) => (
              <option key={s} value={s}>
                {filterCategory === "gaming" ? gamingSubLabel(s) : s}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button
              className="secondary"
              onClick={() => {
                setSearch("")
                setFilterCategory("All")
                setFilterSubcategory("All")
                setPage(1)
              }}
              style={{
                fontSize: "0.75rem",
                padding: "0.5rem 0.9rem",
                borderRadius: 8,
              }}
            >
              Clear
            </button>
          )}
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
                              onClick={() =>
                                handleTransition(m.id, "closed", m.title)
                              }
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
                          {m.status === "closed" &&
                            m.subcategory?.startsWith("wc-") && (
                              <button
                                onClick={() => handleReopen(m)}
                                className="secondary"
                                title="Reopen Market (World Cup only)"
                                style={{ color: "hsl(140, 60%, 55%)" }}
                              >
                                <RotateCcw size={14} />
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
                          {(m.status === "upcoming" || m.status === "open") &&
                            (m.groupId ? (
                              <button
                                onClick={() => handleEditGroup(m)}
                                className="secondary"
                                title="Edit whole group (title, timing, candidate names & images)"
                                style={{ color: "hsl(217 91% 65%)" }}
                              >
                                <Edit size={14} />
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    marginLeft: 4,
                                  }}
                                >
                                  Group
                                </span>
                              </button>
                            ) : (
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
                            ))}
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
                              houseEdgePct={Number(
                                m.houseEdgePct || DEFAULT_HOUSE_EDGE_PCT
                              )}
                              isEstimated={m.status === "open"}
                              showWarnings={true}
                            />
                            {m.status === "open" && (
                              <LateMoneyMonitor
                                market={m}
                                fetchLateMoney={api.getLateMoney}
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
      {editingGroup && (
        <GroupEditForm
          markets={editingGroup}
          onSubmit={handleUpdateGroup}
          onCancel={() => setEditingGroup(null)}
        />
      )}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          loading={confirmLoading}
          onClose={() => setConfirmDialog(null)}
          onConfirm={async () => {
            setConfirmLoading(true)
            try {
              await confirmDialog.onConfirm()
            } finally {
              setConfirmLoading(false)
              setConfirmDialog(null)
            }
          }}
        />
      )}
    </div>
  )
}

export default MarketManagement
