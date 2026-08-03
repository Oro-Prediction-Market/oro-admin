import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, Clock } from "lucide-react"

interface Market {
  id: string
  closesAt?: string
  status: string
}

interface LateMoneyData {
  marketId: string
  lateMoneyPercentage: number
  betSizeLimit: number
  timeUntilClose: number
}

/** Mirrors the backend admin `/markets/:id/late-money` response. */
interface LateMoneyStats {
  marketId: string
  status: string
  windowMinutes: number
  closesAt: string | null
  timeUntilCloseMs: number | null
  totalBets: number
  totalAmount: number
  finalWindowBets: number
  finalWindowAmount: number
  percentageByCount: number
  percentageByAmount: number
  detected: boolean
  alertThresholdPct: number
}

interface LateMoneyMonitorProps {
  market: Market
  /**
   * Fetches REAL late-money aggregates from the backend. When omitted, the
   * monitor shows the countdown only and never fabricates activity.
   */
  fetchLateMoney?: (
    marketId: string,
    windowMinutes?: number
  ) => Promise<LateMoneyStats>
  onLateMoneyDetected?: (data: LateMoneyData) => void
}

export const LateMoneyMonitor: React.FC<LateMoneyMonitorProps> = ({
  market,
  fetchLateMoney,
  onLateMoneyDetected,
}) => {
  const [stats, setStats] = useState<LateMoneyStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [timeUntilClose, setTimeUntilClose] = useState<number>(0)
  const onDetectedRef = useRef(onLateMoneyDetected)
  onDetectedRef.current = onLateMoneyDetected

  // Bet-size limit shown to operators — a POLICY hint the graduated-close
  // mechanism targets. (Enforcement lives on the server, not this widget.)
  const betSizeLimit =
    timeUntilClose <= 0
      ? 0
      : timeUntilClose < 30000
        ? 50
        : timeUntilClose < 60000
          ? 100
          : 1000

  // Smooth 1s countdown from the market close time (display only).
  useEffect(() => {
    if (!market.closesAt || market.status !== "open") return
    const tick = () => {
      const diff = new Date(market.closesAt!).getTime() - Date.now()
      setTimeUntilClose(Math.max(0, diff))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [market.closesAt, market.status])

  // Poll REAL late-money aggregates. Faster as close approaches; stops once the
  // market is no longer open. Never invents numbers — on error it clears state.
  useEffect(() => {
    if (!fetchLateMoney || market.status !== "open") {
      setStats(null)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const data = await fetchLateMoney(market.id, 1)
        if (cancelled) return
        setStats(data)
        setStatsError(null)
        if (data.detected) {
          onDetectedRef.current?.({
            marketId: market.id,
            lateMoneyPercentage: data.percentageByAmount,
            betSizeLimit,
            timeUntilClose: data.timeUntilCloseMs ?? 0,
          })
        }
      } catch (e) {
        if (cancelled) return
        setStats(null)
        setStatsError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        // Schedule the next poll unless the effect was torn down. (No `return`
        // here — a return inside `finally` is unsafe/flagged by eslint.)
        if (!cancelled) {
          // Within 2 min of close the window matters most → poll every 5s,
          // otherwise every 20s to keep load light.
          const soon =
            !!market.closesAt &&
            new Date(market.closesAt).getTime() - Date.now() < 120000
          timer = setTimeout(poll, soon ? 5000 : 20000)
        }
      }
    }
    poll()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fetchLateMoney, market.id, market.closesAt, market.status, betSizeLimit])

  const formatTime = (ms: number) => {
    if (ms <= 0) return "Closed"
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`
  }

  const getCloseMechanismLevel = () => {
    if (timeUntilClose < 30000) return "critical"
    if (timeUntilClose < 60000) return "high"
    if (timeUntilClose < 300000) return "medium"
    return "normal"
  }

  const closeLevel = getCloseMechanismLevel()
  const warning = stats?.detected ? stats : null

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: "0.5rem",
        background:
          closeLevel === "critical"
            ? "hsl(var(--destructive) / 0.1)"
            : closeLevel === "high"
              ? "hsl(var(--warning) / 0.1)"
              : "hsl(var(--muted) / 0.2)",
        border: `1px solid ${
          closeLevel === "critical"
            ? "hsl(var(--destructive))"
            : closeLevel === "high"
              ? "hsl(var(--warning))"
              : "hsl(var(--border))"
        }`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <Clock size={16} />
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          Late Money Monitor & Graduated Close
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Time Until Close
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color:
                closeLevel === "critical"
                  ? "hsl(var(--destructive))"
                  : "inherit",
            }}
          >
            {formatTime(timeUntilClose)}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Bet Size Limit (policy)
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>
            NU. {betSizeLimit.toLocaleString()}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Late Money (final {stats?.windowMinutes ?? 1}m)
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: warning ? "hsl(var(--destructive))" : "inherit",
            }}
          >
            {stats
              ? `${stats.percentageByAmount.toFixed(1)}%`
              : statsError
                ? "—"
                : "…"}
          </div>
        </div>
      </div>

      {warning && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "0.375rem",
            background: "hsl(var(--warning) / 0.2)",
            border: "1px solid hsl(var(--warning))",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={14} style={{ marginTop: "0.125rem" }} />
          <div>
            <strong>Late Money Alert:</strong>{" "}
            {warning.percentageByAmount.toFixed(1)}% of staked money (
            {warning.percentageByCount.toFixed(1)}% of bets) arrived in the
            final {warning.windowMinutes} minute(s).
            <div style={{ marginTop: "0.25rem" }}>
              {warning.finalWindowBets} of {warning.totalBets} bets — NU.{" "}
              {warning.finalWindowAmount.toLocaleString()} of NU.{" "}
              {warning.totalAmount.toLocaleString()} in the final window.
            </div>
          </div>
        </div>
      )}

      {statsError && (
        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Late-money data unavailable: {statsError}
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
          lineHeight: "1.4",
        }}
      >
        <strong>Graduated Close Mechanism:</strong>
        <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
          <li>&gt; 5 minutes: Normal betting limits</li>
          <li>1-5 minutes: Bet size limit NU. 100</li>
          <li>&lt; 30 seconds: Bet size limit NU. 50</li>
          <li>
            Late money detection: Alert if &gt;{stats?.alertThresholdPct ?? 40}%
            of staked money in final minute
          </li>
        </ul>
      </div>
    </div>
  )
}
