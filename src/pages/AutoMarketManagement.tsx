import React, { useState, useEffect, useCallback, useRef } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { useToast } from "../components/Toast"
import CancelMarketModal from "../components/CancelMarketModal"
import ProposeMarketModal from "../components/ProposeMarketModal"
import ResolveMarketModal from "../components/ResolveMarketModal"
import MarketForm, { type MarketFormData } from "../components/MarketForm"
import { OddsDisplay } from "../components/OddsDisplay"
import { LateMoneyMonitor } from "../components/LateMoneyMonitor"
import {
  RefreshCw,
  Zap,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Play,
  Square,
  CheckSquare,
  Edit,
  Trash2,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface Outcome {
  id: string
  label: string
  totalBetAmount?: string | number
  isWinner?: boolean
}

interface AutoMarket {
  id: string
  title: string
  status: string
  closesAt?: string
  bettingClosesAt?: string
  opensAt?: string
  totalPool?: string | number
  houseEdgePct?: number
  externalSource?: string | null
  outcomes: Outcome[]
  metadata?: {
    // BTC keys
    referencePrice?: number
    referenceSource?: string
    openedAt?: string
    settlementPrice?: number
    settlementSource?: string
    settledAt?: string
    // TER keys
    referenceTerPrice?: number
    referenceBuyPrice?: number
    referenceSellPrice?: number
    openXauUsd?: number
    settlementTerPrice?: number
    settlementBuyPrice?: number
    settlementSellPrice?: number
    closeXauUsd?: number
  }
  [key: string]: unknown
}

interface LivePrice {
  price: number
  buyPrice?: number
  sellPrice?: number
  source: string
  fetchedAt: string
}

interface TerPriceResponse {
  midPrice: number
  buyPrice: number
  sellPrice: number
  xauUsd: number
  usdInr: number
  fetchedAt: string
}

interface Dispute {
  id: string
  [key: string]: unknown
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return "Expired"
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtNum(n: number | undefined | null, decimals = 2): string {
  if (n == null || !isFinite(n)) return "—"
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ── Config ───────────────────────────────────────────────────────────────────

const SOURCE_CONFIG = {
  ter: {
    label: "TER Market Management",
    subtitle: "Gold-backed currency · 24-hour cycle",
    accent: "#f59e0b",
    currency: "TER/BTN",
    pricePrefix: "Nu",
    priceDecimals: 4,
  },
  btc: {
    label: "BTC Market Management",
    subtitle: "Bitcoin · 15-minute cycle",
    accent: "#f7931a",
    currency: "BTC/USD",
    pricePrefix: "$",
    priceDecimals: 2,
  },
}

const PAGE_SIZE = 20

const TABLE_STATUSES = [
  "All",
  "Upcoming",
  "Open",
  "Closed",
  "Resolving",
  "Resolved",
  "Settled",
  "Cancelled",
]

// ── Component ────────────────────────────────────────────────────────────────

const AutoMarketManagement: React.FC<{ source: "ter" | "btc" }> = ({
  source,
}) => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()
  const cfg = SOURCE_CONFIG[source]

  // ── Open market card state ─────────────────────────────────────────────────
  const [openMarket, setOpenMarket] = useState<AutoMarket | null>(null)
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null)
  const [spawning, setSpawning] = useState(false)
  const [countdown, setCountdown] = useState("")

  // ── Table state ───────────────────────────────────────────────────────────
  const [tableMarkets, setTableMarkets] = useState<AutoMarket[]>([])
  const [tablePage, setTablePage] = useState(1)
  const [tableTotal, setTableTotal] = useState(0)
  const [tablePages, setTablePages] = useState(1)
  const [tableStatus, setTableStatus] = useState("All")
  const [tableFetching, setTableFetching] = useState(false)

  // ── Modal / action state ──────────────────────────────────────────────────
  const [view, setView] = useState<"list" | "edit">("list")
  const [editingMarket, setEditingMarket] = useState<AutoMarket | null>(null)
  const [proposingMarket, setProposingMarket] = useState<AutoMarket | null>(
    null
  )
  const [resolvingMarket, setResolvingMarket] = useState<AutoMarket | null>(
    null
  )
  const [resolvingDisputes, setResolvingDisputes] = useState<Dispute[]>([])
  const [cancellingMarket, setCancellingMarket] = useState<AutoMarket | null>(
    null
  )
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchOpenMarket = useCallback(async () => {
    try {
      const res = (await api.getMarkets({
        externalSource: source,
        status: "Open",
        limit: 1,
      })) as { data: AutoMarket[] } | null
      setOpenMarket((res?.data ?? [])[0] ?? null)
    } catch {
      // silently ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const fetchHistoryRef = useRef((p: number, status: string, src: string) => {
    let cancelled = false
    setTableFetching(true)
    api
      .getMarkets({ page: p, limit: PAGE_SIZE, status, externalSource: src })
      .then((res) => {
        if (cancelled) return
        const r = res as {
          data: AutoMarket[]
          total: number
          pages: number
        }
        setTableMarkets(r.data ?? [])
        setTableTotal(r.total ?? 0)
        setTablePages(r.pages ?? 1)
      })
      .catch(() => {
        if (!cancelled) setTableMarkets([])
      })
      .finally(() => {
        if (!cancelled) setTableFetching(false)
      })
    return () => {
      cancelled = true
    }
  })

  const fetchPrice = useCallback(async () => {
    try {
      const res = await api.getAutoPrice(source)
      if (!res) return
      if (source === "ter") {
        const ter = res as unknown as TerPriceResponse
        setLivePrice({
          price: ter.midPrice,
          buyPrice: ter.buyPrice,
          sellPrice: ter.sellPrice,
          source: "ter.bt",
          fetchedAt: ter.fetchedAt,
        })
      } else {
        setLivePrice(res as unknown as LivePrice)
      }
    } catch {
      // price fetch fails silently
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    fetchOpenMarket()
    fetchPrice()
  }, [fetchOpenMarket, fetchPrice])

  useEffect(() => {
    return fetchHistoryRef.current(tablePage, tableStatus, source)
  }, [tablePage, tableStatus, source])

  // Price refresh every 30 s
  useEffect(() => {
    const id = setInterval(fetchPrice, 30_000)
    return () => clearInterval(id)
  }, [fetchPrice])

  // Countdown every second
  useEffect(() => {
    if (!openMarket?.closesAt) {
      setCountdown("")
      return
    }
    const update = () => setCountdown(fmtCountdown(openMarket.closesAt!))
    update()
    const id = setInterval(update, 1_000)
    return () => clearInterval(id)
  }, [openMarket?.closesAt])

  // ── Derived ────────────────────────────────────────────────────────────────

  const upOutcome = openMarket?.outcomes.find((o) => o.label === "UP")
  const downOutcome = openMarket?.outcomes.find((o) => o.label === "DOWN")
  const upPool = Number(upOutcome?.totalBetAmount ?? 0)
  const downPool = Number(downOutcome?.totalBetAmount ?? 0)
  const totalPool = Number(openMarket?.totalPool ?? 0)
  const upPct = totalPool > 0 ? Math.round((upPool / totalPool) * 100) : 50
  const downPct = 100 - upPct

  const refPrice =
    source === "ter"
      ? (openMarket?.metadata?.referenceBuyPrice ??
        openMarket?.metadata?.referenceTerPrice)
      : openMarket?.metadata?.referencePrice
  const priceDiff =
    livePrice && refPrice != null
      ? (livePrice.buyPrice ?? livePrice.price) - refPrice
      : null
  const priceDiffPct =
    refPrice && priceDiff != null ? (priceDiff / refPrice) * 100 : null

  // ── Actions ────────────────────────────────────────────────────────────────

  const refresh = () => {
    fetchOpenMarket()
    fetchHistoryRef.current(tablePage, tableStatus, source)
    fetchPrice()
  }

  const handleSpawn = async () => {
    setSpawning(true)
    try {
      await api.spawnAutoMarket(source)
      await fetchOpenMarket()
      fetchHistoryRef.current(1, tableStatus, source)
      setTablePage(1)
      notify("success", `${source.toUpperCase()} market spawned successfully.`)
    } catch (e: unknown) {
      notify(
        "error",
        `Spawn failed: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setSpawning(false)
    }
  }

  const handleTransition = async (id: string, status: string) => {
    try {
      await api.transitionMarket(id, status)
      fetchHistoryRef.current(tablePage, tableStatus, source)
      await fetchOpenMarket()
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
      fetchHistoryRef.current(tablePage, tableStatus, source)
      setProposingMarket(null)
      const windowLabel =
        windowMinutes >= 60
          ? `${windowMinutes / 60} hour${windowMinutes > 60 ? "s" : ""}`
          : `${windowMinutes} minutes`
      notify(
        "success",
        `Objection window opened for "${proposingMarket.title}". Predictors have ${windowLabel} to object.`
      )
    } catch (e: unknown) {
      notify(
        "error",
        `Error proposing outcome: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleOpenResolve = async (market: AutoMarket) => {
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
      fetchHistoryRef.current(tablePage, tableStatus, source)
      setResolvingMarket(null)
      setResolvingDisputes([])
      notify("success", `Market "${resolvingMarket.title}" resolved.`)
    } catch (e: unknown) {
      notify(
        "error",
        `Error resolving market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleCancelOpen = async () => {
    if (!cancellingMarket) return
    try {
      await api.cancelMarket(cancellingMarket.id)
      setCancellingMarket(null)
      await fetchOpenMarket()
      fetchHistoryRef.current(tablePage, tableStatus, source)
      notify("success", `Market cancelled. All bets refunded.`)
    } catch (e: unknown) {
      notify(
        "error",
        `Cancel failed: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this market permanently?")) return
    try {
      await api.deleteMarket(id)
      fetchHistoryRef.current(tablePage, tableStatus, source)
      notify("success", "Market deleted.")
    } catch (e: unknown) {
      notify(
        "error",
        `Error deleting market: ${e instanceof Error ? e.message : String(e)}`
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
      setView("list")
      setEditingMarket(null)
      fetchHistoryRef.current(tablePage, tableStatus, source)
      notify("success", "Market updated.")
    } catch (e: unknown) {
      notify(
        "error",
        `Error updating market: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  // ── Edit view ──────────────────────────────────────────────────────────────

  if (view === "edit") {
    return (
      <>
        {ToastContainer}
        <MarketForm
          initialData={editingMarket ?? undefined}
          onSubmit={handleUpdate}
          onCancel={() => {
            setView("list")
            setEditingMarket(null)
          }}
          loading={api.loading}
        />
      </>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {ToastContainer}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: cfg.accent }}>{cfg.label}</h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.875rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {cfg.subtitle} · {tableTotal} markets total
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={refresh}
            className="secondary"
            disabled={tableFetching}
          >
            <RefreshCw
              size={14}
              style={{
                marginRight: 6,
                animation: tableFetching ? "spin 0.8s linear infinite" : "none",
              }}
            />
            {tableFetching ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={handleSpawn}
            disabled={spawning || !!openMarket}
            title={
              openMarket
                ? "A market is already open"
                : "Force spawn a new market"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: openMarket ? 0.45 : 1,
            }}
          >
            <Zap size={14} />
            {spawning ? "Spawning…" : "Force Spawn"}
          </button>
        </div>
      </div>

      {/* Info cards row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Live price */}
        <div className="glass-card" style={{ padding: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "hsl(var(--muted-foreground))",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Activity size={12} />
            Live {cfg.currency}
          </div>

          {livePrice ? (
            <>
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 900,
                  color: cfg.accent,
                  letterSpacing: "-0.04em",
                  fontFamily: "monospace",
                  marginBottom: 6,
                }}
              >
                {cfg.pricePrefix}{" "}
                {fmtNum(
                  source === "ter"
                    ? (livePrice.buyPrice ?? livePrice.price)
                    : livePrice.price,
                  cfg.priceDecimals
                )}
              </div>
              {livePrice.buyPrice != null &&
                livePrice.sellPrice != null &&
                source === "ter" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      marginBottom: 4,
                    }}
                  >
                    <span>
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>
                        Buy{" "}
                      </span>
                      <span style={{ color: "hsl(var(--foreground))" }}>
                        {cfg.pricePrefix}{" "}
                        {fmtNum(livePrice.buyPrice, cfg.priceDecimals)}
                      </span>
                    </span>
                    <span>
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>
                        Sell{" "}
                      </span>
                      <span style={{ color: "hsl(var(--foreground))" }}>
                        {cfg.pricePrefix}{" "}
                        {fmtNum(livePrice.sellPrice, cfg.priceDecimals)}
                      </span>
                    </span>
                  </div>
                )}
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                via {livePrice.source} · auto-refreshes every 30s
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: "0.875rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Fetching price…
            </div>
          )}
        </div>

        {/* Open market card */}
        <div className="glass-card" style={{ padding: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "hsl(var(--muted-foreground))",
              marginBottom: 12,
            }}
          >
            Current Market
          </div>

          {openMarket ? (
            <>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  marginBottom: 6,
                }}
              >
                {openMarket.title}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    animation: "heartbeat 2.4s ease-in-out infinite",
                  }}
                />
                Closes in {countdown || "…"}
              </div>

              {/* Reference vs live */}
              {refPrice != null && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: 12,
                    fontFamily: "monospace",
                  }}
                >
                  Ref:{" "}
                  <strong>
                    {cfg.pricePrefix} {fmtNum(refPrice, cfg.priceDecimals)}
                  </strong>
                  {priceDiff != null && (
                    <span
                      style={{
                        marginLeft: 10,
                        fontWeight: 700,
                        color: priceDiff >= 0 ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {priceDiff >= 0 ? "+" : ""}
                      {fmtNum(priceDiff, cfg.priceDecimals)} (
                      {priceDiffPct != null
                        ? `${priceDiffPct >= 0 ? "+" : ""}${priceDiffPct.toFixed(2)}%`
                        : ""}
                      )
                    </span>
                  )}
                </div>
              )}

              {/* UP/DOWN pool bar */}
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "#22c55e" }}>▲ UP {upPct}%</span>
                  <span style={{ color: "#ef4444" }}>DOWN {downPct}% ▼</span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 99,
                    overflow: "hidden",
                    background: "#ef444433",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${upPct}%`,
                      background: "#22c55e",
                      borderRadius: 99,
                      transition: "width 0.4s",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.7rem",
                    color: "hsl(var(--muted-foreground))",
                    marginTop: 4,
                    fontFamily: "monospace",
                  }}
                >
                  <span>Nu {upPool.toLocaleString()}</span>
                  <span>Total Nu {totalPool.toLocaleString()}</span>
                  <span>Nu {downPool.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setCancellingMarket(openMarket)}
                className="secondary"
                style={{
                  color: "hsl(var(--destructive))",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <XCircle size={12} /> Cancel & Refund All
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "1.25rem 0" }}>
              <p
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontSize: "0.875rem",
                  marginBottom: 14,
                }}
              >
                No open market
              </p>
              <button
                onClick={handleSpawn}
                disabled={spawning}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  margin: "0 auto",
                }}
              >
                <Zap size={14} />
                {spawning ? "Spawning…" : "Spawn Now"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Full markets table ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: 0 }}>
        {/* Status filter pills */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            gap: "1rem",
            overflowX: "auto",
          }}
        >
          {TABLE_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setTableStatus(s)
                setTablePage(1)
              }}
              className={tableStatus === s ? "" : "secondary"}
              style={{
                fontSize: "0.75rem",
                padding: "0.5rem 1rem",
                borderRadius: "9999px",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {tableFetching ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Loading markets…
          </div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Ref Price</th>
                <th>Settlement</th>
                <th>Pool (Nu)</th>
                <th>Closes At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableMarkets.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
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
                tableMarkets.map((m) => {
                  const ref =
                    source === "ter"
                      ? (m.metadata?.referenceBuyPrice ??
                        m.metadata?.referenceTerPrice)
                      : m.metadata?.referencePrice
                  const settlement =
                    source === "ter"
                      ? (m.metadata?.settlementBuyPrice ??
                        m.metadata?.settlementTerPrice)
                      : m.metadata?.settlementPrice
                  const winner = m.outcomes.find((o) => o.isWinner)
                  const pool = Number(m.totalPool ?? 0)
                  const isUp = winner?.label === "UP"

                  return (
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
                            {m.outcomes.map((o) => (
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
                          {winner && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                marginTop: 2,
                                color: isUp ? "#22c55e" : "#ef4444",
                              }}
                            >
                              {isUp ? (
                                <TrendingUp size={12} />
                              ) : (
                                <TrendingDown size={12} />
                              )}
                              {winner.label}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${m.status.toLowerCase()}`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                          }}
                        >
                          {ref != null
                            ? `${cfg.pricePrefix} ${fmtNum(ref, cfg.priceDecimals)}`
                            : "—"}
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                          }}
                        >
                          {settlement != null ? (
                            <span
                              style={{
                                color:
                                  ref != null
                                    ? settlement > ref
                                      ? "#22c55e"
                                      : "#ef4444"
                                    : undefined,
                                fontWeight: 700,
                              }}
                            >
                              {cfg.pricePrefix}{" "}
                              {fmtNum(settlement, cfg.priceDecimals)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ fontFamily: "monospace" }}>
                          {pool > 0 ? `Nu ${pool.toLocaleString()}` : "—"}
                        </td>
                        <td style={{ fontSize: "0.75rem" }}>
                          {m.closesAt
                            ? new Date(m.closesAt).toLocaleString()
                            : "—"}
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
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
                            {(m.status === "upcoming" ||
                              m.status === "open") && (
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
                              pool === 0) && (
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
                            colSpan={7}
                            style={{
                              padding: 0,
                              background: "hsl(var(--muted) / 0.1)",
                            }}
                          >
                            <div style={{ padding: "1.5rem" }}>
                              <OddsDisplay
                                outcomes={m.outcomes}
                                totalPool={pool}
                                houseEdgePct={Number(m.houseEdgePct || 5)}
                                isEstimated={m.status === "open"}
                                showWarnings={true}
                              />
                              {m.status === "open" && (
                                <LateMoneyMonitor
                                  market={m}
                                  onLateMoneyDetected={(data) => {
                                    console.log("Late money detected:", data)
                                  }}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {tableTotal > PAGE_SIZE && (
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
            onClick={() => setTablePage(1)}
            disabled={tablePage === 1 || tableFetching}
          >
            «
          </button>
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setTablePage((p) => Math.max(1, p - 1))}
            disabled={tablePage === 1 || tableFetching}
          >
            ‹ Prev
          </button>
          {Array.from({ length: Math.min(tablePages, 7) }, (_, i) => {
            const start = Math.max(1, Math.min(tablePage - 3, tablePages - 6))
            return start + i
          }).map((p) => (
            <button
              key={p}
              onClick={() => setTablePage(p)}
              disabled={tableFetching}
              style={{
                padding: "6px 12px",
                fontSize: "0.8rem",
                borderRadius: 8,
                border: "none",
                background:
                  p === tablePage
                    ? "hsl(var(--primary))"
                    : "hsl(var(--background))",
                color:
                  p === tablePage
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))",
                fontWeight: p === tablePage ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {p}
            </button>
          ))}
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setTablePage((p) => Math.min(tablePages, p + 1))}
            disabled={tablePage === tablePages || tableFetching}
          >
            Next ›
          </button>
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setTablePage(tablePages)}
            disabled={tablePage === tablePages || tableFetching}
          >
            »
          </button>
          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Page {tablePage} / {tablePages} · {tableTotal} markets
          </span>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

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
          pendingBetCount={
            cancellingMarket.outcomes.filter(
              (o) => Number(o.totalBetAmount) > 0
            ).length
          }
          onConfirm={handleCancelOpen}
          onClose={() => setCancellingMarket(null)}
          loading={api.loading}
        />
      )}
    </div>
  )
}

export default AutoMarketManagement
