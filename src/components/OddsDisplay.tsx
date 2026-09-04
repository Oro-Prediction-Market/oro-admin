import React from "react"
import { TrendingUp, AlertTriangle } from "lucide-react"

interface Outcome {
  id: string
  label: string
  totalBetAmount?: number | string
  isWinner?: boolean
}

interface OddsDisplayProps {
  outcomes: Outcome[]
  totalPool: number
  houseEdgePct: number
  isEstimated?: boolean
  showWarnings?: boolean
  /** Currency the pool is denominated in. Served as `poolCurrency` on the
   *  admin market list; defaults to BTN, the platform default. */
  currency?: string
}

export const OddsDisplay: React.FC<OddsDisplayProps> = ({
  outcomes,
  totalPool,
  houseEdgePct,
  isEstimated = false,
  showWarnings = true,
  currency = "BTN",
}) => {
  // Currencies never mix within a pool, so one unit for the whole panel.
  const unit = currency === "USDT" ? "$" : "Nu "
  const money = (n: number) =>
    `${unit}${Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  const calculateOdds = (outcomePool: number) => {
    if (outcomePool === 0 || totalPool === 0) return 0
    const payoutPool = totalPool * (1 - houseEdgePct / 100)
    return payoutPool / outcomePool
  }

  const calculateImpliedProbability = (outcomePool: number) => {
    // Laplace smoothing: blend with uniform prior (1000 BTN virtual liquidity)
    // to avoid showing misleading 100%/0% at thin liquidity.
    const prior = 1000
    const n = outcomes.length || 1
    const smoothedAmount = outcomePool + prior / n
    const smoothedTotal = totalPool + prior
    return (smoothedAmount / smoothedTotal) * 100
  }

  const isThinLiquidity = totalPool > 0 && totalPool < 500

  const getMinusPoolWarning = () => {
    if (totalPool <= 0) return { warning: false, message: "", minPayout: 0 }
    const maxPoolShare = Math.max(
      ...outcomes.map((o) => Number(o.totalBetAmount || 0))
    )
    const maxPercentage = (maxPoolShare / totalPool) * 100

    // The 1.05x floor starts biting once the winning side's parimutuel return
    // falls below 1.05x — i.e. its share exceeds (1 - fee) / 1.05. This is
    // fee-aware: ~87.6% at an 8% edge, ~90.5% at 5%, ~85.7% at 10%.
    const floorThreshold = ((1 - houseEdgePct / 100) / 1.05) * 100
    // Above ~95.24% even a fully-waived edge can't fund the floor, so winner
    // payouts scale down pro-rata to keep the settlement funded.
    const scaleThreshold = (1 / 1.05) * 100

    if (maxPercentage > floorThreshold) {
      const scaled = maxPercentage > scaleThreshold
      return {
        warning: true,
        message: scaled
          ? `⚠️ One outcome holds ${maxPercentage.toFixed(1)}% of the pool. Above ${scaleThreshold.toFixed(1)}% the 1.05x floor can't be fully funded — winner payouts scale down pro-rata.`
          : `⚠️ One outcome holds ${maxPercentage.toFixed(1)}% of the pool (the 1.05x floor engages above ${floorThreshold.toFixed(1)}% at a ${houseEdgePct}% edge). The guaranteed payout will be funded by reducing the house edge.`,
        minPayout: 1.05,
      }
    }
    return { warning: false, message: "", minPayout: 0 }
  }

  const minusPoolWarning = getMinusPoolWarning()

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <TrendingUp size={16} />
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          {isEstimated ? "Estimated" : "Current"} Odds & Payouts
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Total pool{" "}
          <span
            style={{
              fontFamily: "monospace",
              fontWeight: 600,
              color: "hsl(var(--foreground))",
            }}
          >
            {money(totalPool)}
          </span>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {outcomes.map((outcome) => {
          const odds = calculateOdds(Number(outcome.totalBetAmount || 0))
          const probability = calculateImpliedProbability(
            Number(outcome.totalBetAmount || 0)
          )
          const finalOdds =
            minusPoolWarning.warning && outcome.isWinner
              ? Math.max(odds, minusPoolWarning.minPayout)
              : odds

          return (
            <div
              key={outcome.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem",
                borderRadius: "0.375rem",
                background: outcome.isWinner
                  ? "hsl(var(--primary) / 0.1)"
                  : "hsl(var(--muted) / 0.3)",
                border: outcome.isWinner
                  ? "1px solid hsl(var(--primary))"
                  : "1px solid transparent",
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                  {outcome.label}
                  {outcome.isWinner && " ✓"}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "hsl(var(--muted-foreground))",
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {/* The staked amount, not just the share — a 50% slice of a
                      Nu 350 pool and of a Nu 350,000 pool read identically
                      otherwise. */}
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 600,
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {money(Number(outcome.totalBetAmount || 0))}
                  </span>
                  <span>·</span>
                  <span>{probability.toFixed(2)}% of pool</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  {finalOdds.toFixed(2)}x
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {money(Number(outcome.totalBetAmount || 0) * finalOdds)}{" "}
                  payout
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showWarnings && isThinLiquidity && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: "0.375rem",
            background: "hsl(45 80% 60% / 0.1)",
            border: "1px solid hsl(45 80% 60%)",
            color: "hsl(45 80% 50%)",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle
            size={14}
            style={{ marginTop: "0.125rem", flexShrink: 0 }}
          />
          <span>
            ⚠️ Thin liquidity: odds are indicative only. Probabilities are
            smoothed with a virtual prior to avoid misleading 100%/0% display.
          </span>
        </div>
      )}
      {showWarnings && minusPoolWarning.warning && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: "0.375rem",
            background: "hsl(var(--destructive) / 0.1)",
            border: "1px solid hsl(var(--destructive))",
            color: "hsl(var(--destructive))",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={14} style={{ marginTop: "0.125rem" }} />
          <span>{minusPoolWarning.message}</span>
        </div>
      )}

      {isEstimated && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
            fontStyle: "italic",
          }}
        >
          * Odds update in real-time as pool grows. Final payouts determined at
          settlement.
        </div>
      )}
    </div>
  )
}
