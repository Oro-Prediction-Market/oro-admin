import React, { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  RefreshCw,
  Scale,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

const nu = (n: number) =>
  `NU. ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  bet_placed: "Bet Placed",
  bet_payout: "Bet Payout",
  refund: "Refund",
  dispute_bond: "Dispute Bond",
  dispute_refund: "Dispute Refund",
  dispute_bond_lock: "Bond Lock",
  dispute_bond_forfeit: "Bond Forfeit",
  dispute_bond_reward: "Bond Reward",
  referral_bonus: "Referral Bonus",
  free_credit: "Free Credit",
  streak_bonus: "Streak Bonus",
  referral_prize: "Referral Prize",
  duel_wager: "Duel Wager",
  duel_payout: "Duel Payout",
}

interface ReconciliationData {
  snapshot: string
  externalFlow: {
    totalDeposits: number
    depositCount: number
    totalWithdrawals: number
    withdrawalCount: number
    pendingDeposits: number
    pendingDepositCount: number
    netExternalFlow: number
  }
  settlements: {
    count: number
    totalPool: number
    houseEarnings: number
    payoutPool: number
    totalPaidOut: number
    breakage: number
  }
  userWallets: {
    totalRealBalance: number
    totalBonusBalance: number
  }
  activeBets: {
    pendingCount: number
    pendingAmount: number
  }
  reconciliation: {
    netExternalFlow: number
    houseEarnings: number
    breakage: number
    expectedUserBalances: number
    actualUserBalances: number
    discrepancy: number
    isBalanced: boolean
  }
  transactionBreakdown: { type: string; total: number; count: number }[]
}

const ReconciliationPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const { getReconciliation, loading, error } = useAdminApi(token)
  const [data, setData] = useState<ReconciliationData | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const fnRef = useRef(getReconciliation)
  useEffect(() => {
    fnRef.current = getReconciliation
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    fnRef
      .current()
      .then((res) => {
        if (!cancelled) {
          setFetchError(null)
          setData(res as ReconciliationData)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setFetchError(
            e instanceof Error
              ? e.message
              : "Failed to load reconciliation data"
          )
      })
    return () => {
      cancelled = true
    }
  }, [token, refreshKey])

  const refresh = () => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 600)
    setRefreshKey((k) => k + 1)
  }

  const {
    reconciliation: rec,
    externalFlow,
    settlements,
    userWallets,
    activeBets,
    transactionBreakdown,
    snapshot,
  } = data ?? {}

  const discrepancyColor = rec?.isBalanced
    ? "#4caf50"
    : Math.abs(rec?.discrepancy ?? 0) < 1
      ? "#ffb74d"
      : "#ef5350"

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Scale size={24} style={{ color: "hsl(var(--primary))" }} />
            Reconciliation
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.875rem",
            }}
          >
            Cross-checks external payments vs. internal ledger to detect
            discrepancies.
            {snapshot && (
              <span style={{ marginLeft: 10 }}>
                Snapshot: {new Date(snapshot).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <button
          className="secondary"
          onClick={refresh}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw
            size={16}
            style={{ animation: spinning ? "spin 0.6s linear" : "none" }}
          />
          Refresh
        </button>
      </div>

      {/* Error */}
      {(fetchError || error) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 8,
            background: "hsl(var(--destructive) / 0.15)",
            color: "hsl(var(--destructive))",
            marginBottom: 20,
          }}
        >
          <AlertCircle size={18} />
          {fetchError || error}
        </div>
      )}

      {loading && !data && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading reconciliation data…
        </div>
      )}

      {data && (
        <>
          {/* Balance check banner */}
          <div
            className="glass-card"
            style={{
              marginBottom: 24,
              padding: "20px 24px",
              borderLeft: `4px solid ${discrepancyColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {rec!.isBalanced ? (
                <TrendingUp size={28} style={{ color: "#4caf50" }} />
              ) : (
                <TrendingDown size={28} style={{ color: discrepancyColor }} />
              )}
              <div>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: discrepancyColor,
                  }}
                >
                  {rec!.isBalanced ? "Books balance" : "Discrepancy detected"}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "hsl(var(--muted-foreground))",
                    marginTop: 2,
                  }}
                >
                  Actual user wallets vs. expected (deposits − withdrawals −
                  house − breakage)
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: discrepancyColor,
                }}
              >
                {nu(rec!.discrepancy)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                discrepancy
              </div>
            </div>
          </div>

          {/* Main stat grid */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total Deposits (confirmed)</div>
              <div className="stat-value" style={{ color: "#4caf50" }}>
                {nu(externalFlow!.totalDeposits)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                {externalFlow!.depositCount} transactions
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Withdrawals (confirmed)</div>
              <div className="stat-value" style={{ color: "#ef5350" }}>
                {nu(externalFlow!.totalWithdrawals)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                {externalFlow!.withdrawalCount} transactions
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net External Flow</div>
              <div className="stat-value">
                {nu(externalFlow!.netExternalFlow)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                deposits − withdrawals
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Deposits</div>
              <div className="stat-value" style={{ color: "#ffb74d" }}>
                {nu(externalFlow!.pendingDeposits)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                {externalFlow!.pendingDepositCount} in-flight
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Actual User Wallets (real)</div>
              <div className="stat-value">
                {nu(userWallets!.totalRealBalance)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                bonus: {nu(userWallets!.totalBonusBalance)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Expected User Wallets</div>
              <div className="stat-value">{nu(rec!.expectedUserBalances)}</div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                net flow − house − breakage
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">House Earnings</div>
              <div
                className="stat-value"
                style={{ color: "hsl(var(--primary))" }}
              >
                {nu(settlements!.houseEarnings)}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                from {settlements!.count} settlements
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Breakage (rounding)</div>
              <div className="stat-value">{nu(settlements!.breakage)}</div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                payoutPool − totalPaidOut
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Bets (pending)</div>
              <div className="stat-value">{nu(activeBets!.pendingAmount)}</div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 4,
                }}
              >
                {activeBets!.pendingCount} open positions
              </div>
            </div>
          </div>

          {/* Settlement details */}
          <div className="glass-card" style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1rem" }}>
              Settlement Breakdown
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      "Total Pool",
                      "House Amount",
                      "Payout Pool",
                      "Total Paid Out",
                      "Breakage",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          color: "hsl(var(--muted-foreground))",
                          fontWeight: 500,
                          fontSize: "0.8rem",
                          borderBottom: "1px solid hsl(var(--border))",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      settlements!.totalPool,
                      settlements!.houseEarnings,
                      settlements!.payoutPool,
                      settlements!.totalPaidOut,
                      settlements!.breakage,
                    ].map((val, i) => (
                      <td
                        key={i}
                        style={{
                          padding: "12px 14px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          fontSize: "0.9rem",
                        }}
                      >
                        {nu(val)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Transaction type breakdown */}
          <div className="glass-card">
            <h3 style={{ margin: "0 0 16px", fontSize: "1rem" }}>
              Transaction Ledger by Type
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Type", "Count", "Net Amount"].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 14px",
                          textAlign: i === 0 ? "left" : "right",
                          color: "hsl(var(--muted-foreground))",
                          fontWeight: 500,
                          fontSize: "0.8rem",
                          borderBottom: "1px solid hsl(var(--border))",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactionBreakdown!.map((row, idx) => (
                    <tr
                      key={row.type}
                      style={{
                        background:
                          idx % 2 === 0
                            ? "transparent"
                            : "var(--glass-bg, rgba(255,255,255,0.02))",
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                        {TX_LABELS[row.type] ?? row.type}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {row.count.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          textAlign: "right",
                          fontFamily: "monospace",
                          color: row.total >= 0 ? "#4caf50" : "#ef5350",
                        }}
                      >
                        {nu(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ReconciliationPage
