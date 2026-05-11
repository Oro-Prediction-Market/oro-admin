import React, { useEffect, useState } from "react"
import {
  DollarSign,
  PiggyBank,
  BarChart3,
  TrendingUp,
  RefreshCw,
} from "lucide-react"

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + "/api"

interface FinanceStats {
  houseIncome: number
  settledPool: number
  settledCount: number
  activePool: number
  activeCount: number
  allTimeVolume: number
  totalMarkets: number
  bonus?: {
    totalIssued: number
    outstandingBalance: number
    realPayoutsFundedByBonus: number
  }
}

interface Reconciliation {
  snapshot: string
  externalFlow: {
    totalDeposits: number
    depositCount: number
    totalWithdrawals: number
    withdrawalCount: number
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
    bonusFundedRealPayouts: number
    totalBonusIssued: number
    expectedUserBalances: number
    actualUserBalances: number
    discrepancy: number
    isBalanced: boolean
  }
}

const FinancePage: React.FC = () => {
  const token =
    sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token")
  const [finance, setFinance] = useState<FinanceStats | null>(null)
  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.all([
      fetch(`${API_BASE}/admin/finance-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_BASE}/admin/reconciliation`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([f, r]) => {
        if (cancelled) return
        if (f && typeof f.houseIncome === "number") setFinance(f)
        if (r && r.externalFlow && r.reconciliation) setRecon(r)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, refreshKey])

  const fetchData = () => setRefreshKey((k) => k + 1)

  const fmt = (val: number) =>
    `Nu. ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(val || 0)}`

  if (loading && !finance)
    return (
      <div style={{ padding: "2rem", color: "hsl(var(--muted-foreground))" }}>
        Loading financials...
      </div>
    )

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2>Platform Financials</h2>
        <button
          onClick={fetchData}
          className="secondary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Top-level stats */}
      {finance && (
        <div className="stat-grid" style={{ marginBottom: "2rem" }}>
          <div className="glass-card stat-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
              }}
            >
              <h3>House Income</h3>
              <DollarSign size={20} color="hsl(142 71% 45%)" />
            </div>
            <p style={{ color: "hsl(142 71% 45%)" }}>
              {fmt(finance.houseIncome)}
            </p>
            <small style={{ color: "hsl(var(--muted-foreground))" }}>
              From {finance.settledCount} settled markets
            </small>
          </div>

          <div className="glass-card stat-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
              }}
            >
              <h3>Settled Pool Total</h3>
              <PiggyBank size={20} color="hsl(var(--primary))" />
            </div>
            <p>{fmt(finance.settledPool)}</p>
            <small style={{ color: "hsl(var(--muted-foreground))" }}>
              Total volume through settled markets
            </small>
          </div>

          <div className="glass-card stat-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
              }}
            >
              <h3>Active Pool</h3>
              <BarChart3 size={20} color="hsl(var(--primary))" />
            </div>
            <p>{fmt(finance.activePool)}</p>
            <small style={{ color: "hsl(var(--muted-foreground))" }}>
              {finance.activeCount} unsettled markets
            </small>
          </div>

          <div className="glass-card stat-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
              }}
            >
              <h3>All-Time Volume</h3>
              <TrendingUp size={20} color="hsl(var(--primary))" />
            </div>
            <p>{fmt(finance.allTimeVolume)}</p>
            <small style={{ color: "hsl(var(--muted-foreground))" }}>
              {finance.totalMarkets} total markets
            </small>
          </div>

          {/* Bonus / marketing cost cards */}
          {finance.bonus && (
            <>
              <div
                className="glass-card stat-card"
                style={{ borderLeft: "3px solid #f59e0b" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                  }}
                >
                  <h3 style={{ color: "#f59e0b" }}>Marketing Cost</h3>
                  <DollarSign size={20} color="#f59e0b" />
                </div>
                <p style={{ color: "#f59e0b" }}>
                  {fmt(finance.bonus.realPayoutsFundedByBonus)}
                </p>
                <small style={{ color: "hsl(var(--muted-foreground))" }}>
                  Real Nu paid out when bonus bettors lost
                </small>
              </div>

              <div
                className="glass-card stat-card"
                style={{ borderLeft: "3px solid #a78bfa" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                  }}
                >
                  <h3 style={{ color: "#a78bfa" }}>Total Bonus Issued</h3>
                  <PiggyBank size={20} color="#a78bfa" />
                </div>
                <p style={{ color: "#a78bfa" }}>
                  {fmt(finance.bonus.totalIssued)}
                </p>
                <small style={{ color: "hsl(var(--muted-foreground))" }}>
                  Outstanding: {fmt(finance.bonus.outstandingBalance)} unspent
                </small>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reconciliation details */}
      {recon && (
        <>
          <h3 style={{ marginBottom: "1rem" }}>Reconciliation</h3>
          <div className="stat-grid" style={{ marginBottom: "2rem" }}>
            <div className="glass-card" style={{ padding: "1.25rem" }}>
              <h4
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                }}
              >
                External Flow
              </h4>
              <div style={{ fontSize: "0.9rem" }}>
                <div>
                  Deposits:{" "}
                  <strong>{fmt(recon.externalFlow.totalDeposits)}</strong> (
                  {recon.externalFlow.depositCount})
                </div>
                <div>
                  Withdrawals:{" "}
                  <strong>{fmt(recon.externalFlow.totalWithdrawals)}</strong> (
                  {recon.externalFlow.withdrawalCount})
                </div>
                <div style={{ marginTop: "0.5rem", fontWeight: 700 }}>
                  Net: {fmt(recon.externalFlow.netExternalFlow)}
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "1.25rem" }}>
              <h4
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                }}
              >
                Settlements
              </h4>
              <div style={{ fontSize: "0.9rem" }}>
                <div>
                  Count: <strong>{recon.settlements.count}</strong>
                </div>
                <div>
                  House Earnings:{" "}
                  <strong style={{ color: "hsl(142 71% 45%)" }}>
                    {fmt(recon.settlements.houseEarnings)}
                  </strong>
                </div>
                <div>
                  Paid Out:{" "}
                  <strong>{fmt(recon.settlements.totalPaidOut)}</strong>
                </div>
                <div>Breakage: {fmt(recon.settlements.breakage)}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "1.25rem" }}>
              <h4
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                }}
              >
                User Wallets
              </h4>
              <div style={{ fontSize: "0.9rem" }}>
                <div>
                  Real Balance:{" "}
                  <strong>{fmt(recon.userWallets.totalRealBalance)}</strong>
                </div>
                <div>
                  Bonus Balance: {fmt(recon.userWallets.totalBonusBalance)}
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  Active Bets: {fmt(recon.activeBets.pendingAmount)} (
                  {recon.activeBets.pendingCount})
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "1.25rem" }}>
              <h4
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                }}
              >
                Balance Check
              </h4>
              <div style={{ fontSize: "0.9rem" }}>
                <div>
                  Expected: {fmt(recon.reconciliation.expectedUserBalances)}
                </div>
                <div>
                  Actual: {fmt(recon.reconciliation.actualUserBalances)}
                </div>
                <div
                  style={{
                    marginTop: "0.5rem",
                    fontWeight: 700,
                    color: recon.reconciliation.isBalanced
                      ? "hsl(142 71% 45%)"
                      : "hsl(var(--destructive))",
                  }}
                >
                  {recon.reconciliation.isBalanced
                    ? "✓ Balanced"
                    : `⚠ Discrepancy: ${fmt(recon.reconciliation.discrepancy)}`}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default FinancePage
