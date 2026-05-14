import React, { useState, useEffect, useCallback } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { useToast } from "../components/Toast"
import CancelMarketModal from "../components/CancelMarketModal"
import {
  RefreshCw,
  Zap,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface Outcome {
  id: string
  label: string
  totalBetAmount?: string | number // field name returned by admin API
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
    referencePrice?: number
    referenceSource?: string
    openedAt?: string
    settlementPrice?: number
    settlementSource?: string
    settledAt?: string
  }
  [key: string]: unknown
}

interface LivePrice {
  price: number
  source: string
  fetchedAt: string
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

function fmtNum(n: number, decimals = 2): string {
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

// ── Component ────────────────────────────────────────────────────────────────

const AutoMarketManagement: React.FC<{ source: "ter" | "btc" }> = ({
  source,
}) => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()
  const cfg = SOURCE_CONFIG[source]

  const [markets, setMarkets] = useState<AutoMarket[]>([])
  const [livePrice, setLivePrice] = useState<LivePrice | null>(null)
  const [fetching, setFetching] = useState(false)
  const [spawning, setSpawning] = useState(false)
  const [cancellingMarket, setCancellingMarket] = useState<AutoMarket | null>(
    null
  )
  const [countdown, setCountdown] = useState("")

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchMarkets = useCallback(async () => {
    setFetching(true)
    try {
      const res = (await api.getMarkets({ limit: 60 })) as {
        data: AutoMarket[]
      } | null
      const filtered = (res?.data ?? []).filter(
        (m) => m.externalSource === source
      )
      filtered.sort((a, b) => {
        if (a.status === "open" && b.status !== "open") return -1
        if (b.status === "open" && a.status !== "open") return 1
        return (
          new Date(b.closesAt ?? 0).getTime() -
          new Date(a.closesAt ?? 0).getTime()
        )
      })
      setMarkets(filtered)
    } catch {
      setMarkets([])
    } finally {
      setFetching(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const fetchPrice = useCallback(async () => {
    try {
      const res = await api.getAutoPrice(source)
      if (res) setLivePrice(res as LivePrice)
    } catch {
      // price fetch fails silently — stale value remains displayed
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    fetchMarkets()
    fetchPrice()
  }, [fetchMarkets, fetchPrice])

  // Price refresh every 30 s
  useEffect(() => {
    const id = setInterval(fetchPrice, 30_000)
    return () => clearInterval(id)
  }, [fetchPrice])

  // ── Derived state ──────────────────────────────────────────────────────────

  const openMarket = markets.find((m) => m.status === "open")
  const recentMarkets = markets.filter((m) => m.status !== "open")

  // Countdown — updates every second while a market is open
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

  const upOutcome = openMarket?.outcomes.find((o) => o.label === "UP")
  const downOutcome = openMarket?.outcomes.find((o) => o.label === "DOWN")
  const upPool = Number(upOutcome?.totalBetAmount ?? 0)
  const downPool = Number(downOutcome?.totalBetAmount ?? 0)
  const totalPool = Number(openMarket?.totalPool ?? 0)
  const upPct = totalPool > 0 ? Math.round((upPool / totalPool) * 100) : 50
  const downPct = 100 - upPct

  const refPrice = openMarket?.metadata?.referencePrice
  const priceDiff =
    livePrice && refPrice != null ? livePrice.price - refPrice : null
  const priceDiffPct =
    refPrice && priceDiff != null ? (priceDiff / refPrice) * 100 : null

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSpawn = async () => {
    setSpawning(true)
    try {
      await api.spawnAutoMarket(source)
      await fetchMarkets()
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

  const handleCancel = async () => {
    if (!cancellingMarket) return
    try {
      await api.cancelMarket(cancellingMarket.id)
      setCancellingMarket(null)
      await fetchMarkets()
      notify("success", "Market cancelled. All bets refunded.")
    } catch (e: unknown) {
      notify(
        "error",
        `Cancel failed: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const refresh = () => {
    fetchMarkets()
    fetchPrice()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {ToastContainer}

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
            {cfg.subtitle} · {markets.length} markets total
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={refresh} className="secondary" disabled={fetching}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />
            Refresh
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
                {cfg.pricePrefix} {fmtNum(livePrice.price, cfg.priceDecimals)}
              </div>
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

        {/* Current open market */}
        <div
          className="glass-card"
          style={{
            padding: "1.5rem",
            borderColor: openMarket ? `${cfg.accent}55` : undefined,
          }}
        >
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
            <Clock size={12} />
            Current Market
          </div>

          {openMarket ? (
            <>
              {/* Status + countdown */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span className="badge badge-open">OPEN</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: cfg.accent,
                  }}
                >
                  {countdown || "—"}
                </span>
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

      {/* Recent markets table */}
      <div className="glass-card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>
            Recent Markets
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {recentMarkets.length} past markets
          </span>
        </div>

        {fetching ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Loading markets…
          </div>
        ) : recentMarkets.length === 0 ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            No past markets yet.
          </div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Reference Price</th>
                <th>Settlement Price</th>
                <th>Winner</th>
                <th>Pool (Nu)</th>
                <th>Opened At</th>
                <th>Closed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentMarkets.slice(0, 30).map((m) => {
                const ref = m.metadata?.referencePrice
                const settlement = m.metadata?.settlementPrice
                const winner = m.outcomes.find((o) => o.isWinner)
                const pool = Number(m.totalPool ?? 0)
                const isUp = winner?.label === "UP"

                return (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge badge-${m.status.toLowerCase()}`}>
                        {m.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {ref != null
                        ? `${cfg.pricePrefix} ${fmtNum(ref, cfg.priceDecimals)}`
                        : "—"}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
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
                    <td>
                      {winner ? (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 700,
                            color: isUp ? "#22c55e" : "#ef4444",
                          }}
                        >
                          {isUp ? (
                            <TrendingUp size={13} />
                          ) : (
                            <TrendingDown size={13} />
                          )}
                          {winner.label}
                        </span>
                      ) : (
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {pool > 0 ? pool.toLocaleString() : "—"}
                    </td>
                    <td style={{ fontSize: "0.75rem" }}>
                      {m.opensAt
                        ? new Date(m.opensAt).toLocaleString()
                        : m.metadata?.openedAt
                          ? new Date(m.metadata.openedAt).toLocaleString()
                          : "—"}
                    </td>
                    <td style={{ fontSize: "0.75rem" }}>
                      {m.closesAt ? new Date(m.closesAt).toLocaleString() : "—"}
                    </td>
                    <td>
                      {(m.status === "open" ||
                        m.status === "closed" ||
                        m.status === "resolving") && (
                        <button
                          onClick={() => setCancellingMarket(m)}
                          className="secondary"
                          title="Cancel & Refund"
                          style={{ color: "hsl(var(--destructive))" }}
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

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
          onConfirm={handleCancel}
          onClose={() => setCancellingMarket(null)}
          loading={api.loading}
        />
      )}
    </div>
  )
}

export default AutoMarketManagement
