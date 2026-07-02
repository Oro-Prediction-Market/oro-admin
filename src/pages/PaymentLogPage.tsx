import React, { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

interface TxUser {
  username?: string
  telegramUsername?: string
  firstName?: string
}

interface Tx {
  id: string
  userId?: string
  user?: TxUser
  type: string
  amount: string | number
  balanceBefore: string | number
  balanceAfter: string | number
  note?: string
  isBonus: boolean
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
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
  referral_prize: "Referral Prize",
  free_credit: "Free Credit",
  streak_bonus: "Streak Bonus",
  duel_wager: "Duel Wager",
  duel_payout: "Duel Payout",
  season_prize: "Season Prize",
}

const SUMMARY_TYPES = [
  { key: "deposit", label: "Deposits", color: "#4caf50" },
  { key: "withdrawal", label: "Withdrawals", color: "#ef5350" },
  { key: "bet_placed", label: "Bets Placed", color: "#ffb74d" },
  { key: "bet_payout", label: "Payouts", color: "#42a5f5" },
] as const

const ALL = "all"

const PAGE_SIZE = 50

const PaymentLogPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const { getTransactions, downloadTransactionsCsv, loading, error } =
    useAdminApi(token)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filterType, setFilterType] = useState(ALL)
  const [search, setSearch] = useState("") // raw input
  const [committedSearch, setCommittedSearch] = useState("") // debounced
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadTransactionsCsv(filterType)
    } catch {
      // Swallow — button re-enables and the admin can retry
    } finally {
      setExporting(false)
    }
  }

  const load = () => {
    if (!token) return
    getTransactions({
      type: filterType,
      search: committedSearch || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        const r = (res ?? {}) as {
          data?: Tx[]
          total?: number
          pages?: number
          counts?: Record<string, number>
        }
        setTransactions(r.data ?? [])
        setTotal(r.total ?? 0)
        setPages(Math.max(1, r.pages ?? 1))
        if (r.counts) setCounts(r.counts)
      })
      .catch(() => {})
  }

  // Refetch whenever the page, type filter, or committed search changes.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, filterType, committedSearch])

  // Debounce the search box → commit after 400 ms and reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setCommittedSearch(search)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const totalPages = Math.max(1, pages)

  const handleFilterType = (val: string) => {
    setFilterType(val)
    setPage(1)
  }
  const handleSearch = (val: string) => {
    setSearch(val)
  }
  const handleClear = () => {
    setFilterType(ALL)
    setSearch("")
    setCommittedSearch("")
    setPage(1)
  }

  const selectStyle: React.CSSProperties = {
    background: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    padding: "6px 10px",
    color: "hsl(var(--foreground))",
    fontSize: "0.85rem",
    cursor: "pointer",
    boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Transaction Ledger</h1>
          <p
            style={{
              margin: "4px 0 0",
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.875rem",
            }}
          >
            All balance movements — bets, payouts, deposits, withdrawals,
            bonuses
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="glass-card"
            style={{
              padding: "8px 16px",
              cursor: exporting ? "default" : "pointer",
              fontSize: "0.85rem",
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? "Exporting..." : "⬇ Export CSV"}
          </button>
          <button
            onClick={load}
            className="glass-card"
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {SUMMARY_TYPES.map(({ key, label, color }) => {
          const count = counts[key] ?? 0
          return (
            <div
              key={key}
              className="glass-card"
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                border: filterType === key ? `1px solid ${color}` : undefined,
              }}
              onClick={() => handleFilterType(filterType === key ? ALL : key)}
            >
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "hsl(var(--muted-foreground))",
                  fontWeight: 700,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>
                {count}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search by user, note, ID..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ ...selectStyle, flex: "1 1 200px", minWidth: 180 }}
        />
        <select
          value={filterType}
          onChange={(e) => handleFilterType(e.target.value)}
          style={selectStyle}
        >
          <option value={ALL}>All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {(filterType !== ALL || search) && (
          <button
            onClick={handleClear}
            style={{ ...selectStyle, color: "hsl(var(--muted-foreground))" }}
          >
            Clear
          </button>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {total} record{total !== 1 ? "s" : ""}
        </span>
      </div>

      {error && (
        <div
          className="glass-card"
          style={{
            padding: 16,
            color: "hsl(var(--destructive))",
            marginBottom: 16,
          }}
        >
          Error: {error}
        </div>
      )}

      {loading && !transactions.length ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading transactions...
        </div>
      ) : transactions.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: 40,
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No transactions found
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  {[
                    "Date",
                    "User",
                    "Type",
                    "Amount",
                    "Balance After",
                    "Note",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        color: "hsl(var(--muted-foreground))",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => {
                  const amt = Number(t.amount)
                  const isCredit = amt >= 0
                  const username =
                    t.user?.username ||
                    t.user?.telegramUsername ||
                    t.user?.firstName ||
                    t.userId?.slice(0, 8)
                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom:
                          i < transactions.length - 1
                            ? "1px solid hsl(var(--border))"
                            : undefined,
                        background: i % 2 === 1 ? "var(--glass-bg)" : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 14px",
                          whiteSpace: "nowrap",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {new Date(t.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td
                        style={{ padding: "10px 14px", whiteSpace: "nowrap" }}
                      >
                        <span style={{ fontWeight: 600 }}>{username}</span>
                      </td>
                      <td
                        style={{ padding: "10px 14px", whiteSpace: "nowrap" }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {TYPE_LABELS[t.type] || t.type}
                          {t.isBonus && (
                            <span
                              style={{
                                fontSize: "0.65rem",
                                background: "#2e2a1a",
                                color: "#ffb74d",
                                padding: "1px 6px",
                                borderRadius: 100,
                                fontWeight: 700,
                              }}
                            >
                              BONUS
                            </span>
                          )}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          whiteSpace: "nowrap",
                          fontWeight: 700,
                          color: isCredit ? "#4caf50" : "#ef5350",
                        }}
                      >
                        {isCredit ? "+" : ""}
                        {amt.toFixed(2)} Nu
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          whiteSpace: "nowrap",
                          color: "hsl(var(--muted-foreground))",
                          fontSize: "0.8rem",
                        }}
                      >
                        {Number(t.balanceAfter).toFixed(2)} Nu
                      </td>
                      <td
                        style={{
                          padding: "10px 14px",
                          color: "hsl(var(--muted-foreground))",
                          fontSize: "0.8rem",
                          wordBreak: "break-word",
                        }}
                      >
                        {t.note || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            style={{ ...selectStyle, opacity: page === 1 ? 0.4 : 1 }}
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            style={{ ...selectStyle, opacity: page === 1 ? 0.4 : 1 }}
          >
            ‹
          </button>
          <span
            style={{
              fontSize: "0.85rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
            style={{ ...selectStyle, opacity: page === totalPages ? 0.4 : 1 }}
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            style={{ ...selectStyle, opacity: page === totalPages ? 0.4 : 1 }}
          >
            »
          </button>
        </div>
      )}
    </div>
  )
}

export default PaymentLogPage
