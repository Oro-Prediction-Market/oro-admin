import React, { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  success:   { bg: "#1a2e1a", color: "#4caf50" },
  pending:   { bg: "#2e2a1a", color: "#ffb74d" },
  failed:    { bg: "#2e1a1a", color: "#ef5350" },
  cancelled: { bg: "#1e222a", color: "#708499" },
}

const TYPE_LABELS: Record<string, string> = {
  deposit:     "Deposit",
  withdrawal:  "Withdrawal",
  bet_placed:  "Bet Placed",
  bet_payout:  "Bet Payout",
  refund:      "Refund",
}

const METHOD_LABELS: Record<string, string> = {
  dkbank:  "DK Bank",
  ton:     "TON",
  credits: "Credits",
}

const ALL = "all"

const PaymentLogPage: React.FC = () => {
  const token = localStorage.getItem("admin_token")
  const { getPayments, loading, error } = useAdminApi(token)
  const [payments, setPayments] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState(ALL)
  const [filterType, setFilterType] = useState(ALL)
  const [filterMethod, setFilterMethod] = useState(ALL)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!token) return
    getPayments().then(setPayments).catch(() => {})
  }, [token])

  const filtered = payments.filter((p) => {
    if (filterStatus !== ALL && p.status !== filterStatus) return false
    if (filterType !== ALL && p.type !== filterType) return false
    if (filterMethod !== ALL && p.method !== filterMethod) return false
    if (search) {
      const q = search.toLowerCase()
      const username = p.user?.username || p.user?.telegramUsername || ""
      if (
        !p.id.toLowerCase().includes(q) &&
        !username.toLowerCase().includes(q) &&
        !(p.externalPaymentId || "").toLowerCase().includes(q) &&
        !(p.referenceId || "").toLowerCase().includes(q) &&
        !(p.customerPhone || "").toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  const totalAmount = filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  const selectStyle: React.CSSProperties = {
    background: "hsl(var(--secondary))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    padding: "6px 10px",
    color: "inherit",
    fontSize: "0.85rem",
    cursor: "pointer",
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Payment Log</h1>
          <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: "0.875rem" }}>
            All payment transactions across the platform
          </p>
        </div>
        <button
          onClick={() => getPayments().then(setPayments).catch(() => {})}
          className="glass-card"
          style={{ padding: "8px 16px", cursor: "pointer", fontSize: "0.85rem" }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        {(["success", "pending", "failed", "cancelled"] as const).map((s) => {
          const count = payments.filter((p) => p.status === s).length
          const { bg, color } = STATUS_COLORS[s]
          return (
            <div
              key={s}
              className="glass-card"
              style={{ padding: "14px 16px", cursor: "pointer", border: filterStatus === s ? `1px solid ${color}` : undefined }}
              onClick={() => setFilterStatus(filterStatus === s ? ALL : s)}
            >
              <div style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground))", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {s}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by user, ID, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...selectStyle,
            flex: "1 1 200px",
            minWidth: 180,
          }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
          <option value={ALL}>All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} style={selectStyle}>
          <option value={ALL}>All Methods</option>
          {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(filterStatus !== ALL || filterType !== ALL || filterMethod !== ALL || search) && (
          <button
            onClick={() => { setFilterStatus(ALL); setFilterType(ALL); setFilterMethod(ALL); setSearch("") }}
            style={{ ...selectStyle, color: "hsl(var(--muted-foreground))" }}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""} · Total: {totalAmount.toFixed(2)}
        </span>
      </div>

      {error && (
        <div className="glass-card" style={{ padding: 16, color: "hsl(var(--destructive))", marginBottom: 16 }}>
          Error: {error}
        </div>
      )}

      {loading && !payments.length ? (
        <div style={{ textAlign: "center", padding: 60, color: "hsl(var(--muted-foreground))" }}>Loading payments...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
          No payments found
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  {["Date", "User", "Type", "Method", "Amount", "Status", "Reference", "Phone", "Ext. ID"].map((h) => (
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
                {filtered.map((p, i) => {
                  const { bg, color } = STATUS_COLORS[p.status] || STATUS_COLORS.cancelled
                  const username = p.user?.username || p.user?.telegramUsername || p.user?.firstName || p.userId?.slice(0, 8)
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: i < filtered.length - 1 ? "1px solid hsl(var(--border))" : undefined,
                        background: i % 2 === 1 ? "hsla(0,0%,100%,0.02)" : undefined,
                      }}
                    >
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "hsl(var(--muted-foreground))" }}>
                        {new Date(p.createdAt).toLocaleString(undefined, {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 600 }}>{username}</span>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {TYPE_LABELS[p.type] || p.type}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {METHOD_LABELS[p.method] || p.method}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", fontWeight: 700 }}>
                        {Number(p.amount).toFixed(2)} {p.currency}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          background: bg,
                          color,
                          padding: "3px 10px",
                          borderRadius: 100,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}>
                          {p.status}
                        </span>
                        {p.failureReason && (
                          <div style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                            {p.failureReason}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", color: "hsl(var(--muted-foreground))", fontSize: "0.8rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.referenceId || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "hsl(var(--muted-foreground))", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {p.customerPhone || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", fontFamily: "monospace", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.externalPaymentId || p.dkInquiryId || "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentLogPage
