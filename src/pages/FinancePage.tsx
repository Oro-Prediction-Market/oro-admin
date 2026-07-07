import React, { useEffect, useState } from "react"
import {
  DollarSign,
  PiggyBank,
  BarChart3,
  TrendingUp,
  RefreshCw,
  Trash2,
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
  marketing?: {
    total: number
    referral: number
    streak: number
    season: number
    count: number
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

interface ZeroPoolMarket {
  id: string
  title: string
  createdAt: string
  status: string
}

const FinancePage: React.FC = () => {
  const token =
    sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token")
  const [finance, setFinance] = useState<FinanceStats | null>(null)
  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [zeroPoolMarkets, setZeroPoolMarkets] = useState<ZeroPoolMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
      fetch(`${API_BASE}/admin/markets/settled/zero-pool`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ])
      .then(([f, r, z]) => {
        if (cancelled) return
        if (f && typeof f.houseIncome === "number") setFinance(f)
        if (r && r.externalFlow && r.reconciliation) setRecon(r)
        if (Array.isArray(z)) setZeroPoolMarkets(z)
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

  const handleDeleteOne = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await fetch(`${API_BASE}/admin/markets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      setZeroPoolMarkets((prev) => prev.filter((m) => m.id !== id))
      fetchData()
    } catch {
      alert("Failed to delete market.")
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteAll = async () => {
    if (
      !confirm(
        `Delete all ${zeroPoolMarkets.length} settled zero-volume market(s)? This cannot be undone.`
      )
    )
      return
    try {
      const res = await fetch(
        `${API_BASE}/admin/markets/cleanup/zero-pool-settled`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      alert(`Deleted ${data.deleted} market(s).`)
      fetchData()
    } catch {
      alert("Failed to delete markets.")
    }
  }

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
              {/* Bonus Loss Exposure card hidden from admin — kept for reference.
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
                  <h3 style={{ color: "#f59e0b" }}>Bonus Loss Exposure</h3>
                  <DollarSign size={20} color="#f59e0b" />
                </div>
                <p style={{ color: "#f59e0b" }}>
                  {fmt(finance.bonus.realPayoutsFundedByBonus)}
                </p>
                <small style={{ color: "hsl(var(--muted-foreground))" }}>
                  Real Nu paid out when bonus bettors lost
                </small>
              </div>
              */}

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

          {/* Marketing Cost — promotional rewards paid to users as real money */}
          {finance.marketing && (
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
                <PiggyBank size={20} color="#f59e0b" />
              </div>
              <p style={{ color: "#f59e0b" }}>{fmt(finance.marketing.total)}</p>
              <small
                style={{
                  color: "hsl(var(--muted-foreground))",
                  display: "block",
                  lineHeight: 1.6,
                }}
              >
                Referral: {fmt(finance.marketing.referral)}
                <br />
                Streak: {fmt(finance.marketing.streak)}
                <br />
                Season prizes: {fmt(finance.marketing.season)}
              </small>
            </div>
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

      {/* Zero-volume settled markets */}
      <div style={{ marginTop: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Settled Markets — Zero Volume</h3>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.8rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Settled markets with no bets placed. Safe to delete — they carry
              no pool, no positions, and no payout obligations.
            </p>
          </div>
          {zeroPoolMarkets.length > 0 && (
            <button
              onClick={handleDeleteAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "hsl(var(--destructive))",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "0.45rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Trash2 size={14} />
              Delete All ({zeroPoolMarkets.length})
            </button>
          )}
        </div>

        {zeroPoolMarkets.length === 0 ? (
          <div
            className="glass-card"
            style={{
              padding: "1.5rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.85rem",
            }}
          >
            No zero-volume settled markets.
          </div>
        ) : (
          <div
            className="glass-card"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.65rem 1rem",
                      fontWeight: 700,
                      color: "hsl(var(--muted-foreground))",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Market
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "0.65rem 1rem",
                      fontWeight: 700,
                      color: "hsl(var(--muted-foreground))",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Created
                  </th>
                  <th style={{ padding: "0.65rem 1rem" }} />
                </tr>
              </thead>
              <tbody>
                {zeroPoolMarkets.map((m, i) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom:
                        i < zeroPoolMarkets.length - 1
                          ? "1px solid hsl(var(--border))"
                          : "none",
                    }}
                  >
                    <td style={{ padding: "0.65rem 1rem", fontWeight: 500 }}>
                      {m.title}
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        color: "hsl(var(--muted-foreground))",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(m.createdAt).toLocaleDateString("en-BT", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "0.65rem 1rem", textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteOne(m.id, m.title)}
                        disabled={deletingId === m.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          background: "none",
                          border: "1px solid hsl(var(--destructive))",
                          borderRadius: 5,
                          padding: "0.3rem 0.65rem",
                          color: "hsl(var(--destructive))",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          cursor:
                            deletingId === m.id ? "not-allowed" : "pointer",
                          opacity: deletingId === m.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={12} />
                        {deletingId === m.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default FinancePage
