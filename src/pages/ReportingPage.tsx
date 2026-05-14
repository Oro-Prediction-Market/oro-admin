import { useEffect, useState, useMemo } from "react"
import {
  TrendingUp,
  RefreshCw,
  Search,
  Activity,
  Clock,
  AlertTriangle,
  Scale,
  CheckCircle2,
  XCircle,
  Coins,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  type: string
  status: string
  amount: number
  note: string | null
  createdAt: string
  user?: { id: string; username?: string; telegramUsername?: string }
  marketId?: string
}

interface TransactionStats {
  totalCount: number
  byType: { type: string; count: string; totalAmount: string }[]
}

interface Dispute {
  id: string
  marketId: string
  status: string
  bond: number
  outcome?: string
  createdAt: string
  market?: { title?: string }
  user?: { username?: string; telegramUsername?: string }
}

interface DisputeStats {
  total: number
  pending: number
  resolved: number
  totalBond: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  background: "hsl(var(--background))",
  border: "none",
  borderRadius: 8,
  padding: "6px 10px",
  color: "hsl(var(--foreground))",
  fontSize: "0.82rem",
  boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
  outline: "none",
  fontFamily: "inherit",
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "hsl(142, 70%, 45%)"
      : status === "pending"
        ? "hsl(45, 90%, 55%)"
        : status === "failed" || status === "rejected"
          ? "hsl(var(--destructive))"
          : "hsl(var(--muted-foreground))"
  return (
    <span
      style={{
        fontSize: "0.68rem",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 5,
        background: "hsl(var(--background))",
        color,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  )
}

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string
  value: string | number
  Icon: React.ElementType
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: "0.875rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "hsl(var(--background))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <Icon size={15} color="hsl(var(--muted-foreground))" />
      </div>
      <div>
        <div
          style={{
            fontSize: "1.35rem",
            fontWeight: 800,
            color: "hsl(var(--foreground))",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: "0.7rem",
            color: "hsl(var(--muted-foreground))",
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Audits Tab ───────────────────────────────────────────────────

function TransactionAuditsTab() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [rows, setRows] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterMarket, setFilterMarket] = useState("")
  const [filterUser, setFilterUser] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const limit = 50

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.getReportingTransactionAudits({
        search: search || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
        marketId: filterMarket || undefined,
        userId: filterUser || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        limit,
      }),
      api.getReportingTransactionStats({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }),
    ])
      .then(([txRes, statsRes]) => {
        if (cancelled) return
        const r = txRes as
          | { data?: Transaction[]; total?: number }
          | Transaction[]
        setRows(Array.isArray(r) ? r : (r.data ?? []))
        setTotal(Array.isArray(r) ? r.length : (r.total ?? 0))
        setStats(statsRes as TransactionStats)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    filterType,
    filterStatus,
    filterMarket,
    filterUser,
    dateFrom,
    dateTo,
    page,
    tick,
  ])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const allTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.type))).sort(),
    [rows]
  )

  const hasFilters = !!(
    search ||
    filterType ||
    filterStatus ||
    filterMarket ||
    filterUser ||
    dateFrom ||
    dateTo
  )

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Total Transactions" value={total} Icon={Activity} />
        <StatCard
          label="Types"
          value={stats?.byType?.length ?? "—"}
          Icon={Coins}
        />
        <StatCard
          label="Volume (all types)"
          value={
            stats?.byType
              ? stats.byType
                  .reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0)
                  .toLocaleString(undefined, { maximumFractionDigits: 2 })
              : "—"
          }
          Icon={TrendingUp}
        />
        <StatCard label="Page" value={`${page} / ${totalPages}`} Icon={Clock} />
      </div>

      {/* Filter bar */}
      <div
        className="glass-card"
        style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem" }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div
            style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}
          >
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "hsl(var(--muted-foreground))",
                pointerEvents: "none",
              }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search note…"
              style={{ ...inp, width: "100%", paddingLeft: 28 }}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value)
              setPage(1)
            }}
            style={inp}
          >
            <option value="">All types</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
            style={inp}
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <input
            value={filterMarket}
            onChange={(e) => {
              setFilterMarket(e.target.value.trim())
              setPage(1)
            }}
            placeholder="Market ID"
            style={{ ...inp, width: 140 }}
          />
          <input
            value={filterUser}
            onChange={(e) => {
              setFilterUser(e.target.value.trim())
              setPage(1)
            }}
            placeholder="User ID"
            style={{ ...inp, width: 140 }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              style={{ ...inp, colorScheme: "dark" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              style={{ ...inp, colorScheme: "dark" }}
            />
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {total} transactions
          </span>
          {hasFilters && (
            <button
              className="secondary"
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              onClick={() => {
                setSearch("")
                setFilterType("")
                setFilterStatus("")
                setFilterMarket("")
                setFilterUser("")
                setDateFrom("")
                setDateTo("")
                setPage(1)
              }}
            >
              ✕ Clear
            </button>
          )}
          <button
            className="secondary"
            style={{
              fontSize: "0.78rem",
              padding: "5px 12px",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onClick={() => setTick((t) => t + 1)}
            disabled={loading}
          >
            <RefreshCw
              size={12}
              style={{
                animation: loading ? "spin 0.8s linear infinite" : "none",
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && rows.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading transactions…
        </div>
      ) : error ? (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "hsl(var(--destructive))",
          }}
        >
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No transactions found.
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
              }}
            >
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {[
                    "Time",
                    "User",
                    "Type",
                    "Status",
                    "Amount",
                    "Note",
                    "Market",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.7rem 1rem",
                        textAlign: "left",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "hsl(var(--muted-foreground))",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom:
                        i < rows.length - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                      background:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        color: "hsl(var(--muted-foreground))",
                        whiteSpace: "nowrap",
                        fontFamily: "monospace",
                        fontSize: "0.76rem",
                      }}
                    >
                      <span title={new Date(row.createdAt).toLocaleString()}>
                        {relativeTime(row.createdAt)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        maxWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.user?.telegramUsername ??
                        row.user?.username ??
                        row.user?.id?.slice(0, 8) ??
                        "—"}
                    </td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.78rem",
                          color: "hsl(var(--foreground))",
                        }}
                      >
                        {row.type}
                      </span>
                    </td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        fontFamily: "monospace",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {Number(row.amount).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        color: "hsl(var(--muted-foreground))",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.note ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        fontFamily: "monospace",
                        fontSize: "0.73rem",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {row.marketId ? row.marketId.slice(0, 8) + "…" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 6,
                marginTop: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                «
              </button>
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Prev
              </button>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8px",
                  fontSize: "0.78rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {page} / {totalPages}
              </span>
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next ›
              </button>
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Disputes Tab ─────────────────────────────────────────────────────────────

function DisputesTab() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [rows, setRows] = useState<Dispute[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<DisputeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const [filterMarket, setFilterMarket] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const limit = 50

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      api.getReportingDisputes({
        marketId: filterMarket || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
        limit,
      }),
      api.getReportingDisputeStats(),
    ])
      .then(([dispRes, statsRes]) => {
        if (cancelled) return
        const r = dispRes as { data?: Dispute[]; total?: number } | Dispute[]
        setRows(Array.isArray(r) ? r : (r.data ?? []))
        setTotal(Array.isArray(r) ? r.length : (r.total ?? 0))
        setStats(statsRes as DisputeStats)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMarket, dateFrom, dateTo, page, tick])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const hasFilters = !!(filterMarket || dateFrom || dateTo)

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        <StatCard
          label="Total Disputes"
          value={stats?.total ?? total}
          Icon={Activity}
        />
        <StatCard
          label="Pending"
          value={stats?.pending ?? "—"}
          Icon={AlertTriangle}
        />
        <StatCard
          label="Resolved"
          value={stats?.resolved ?? "—"}
          Icon={CheckCircle2}
        />
        <StatCard
          label="Total Bond"
          value={
            stats?.totalBond != null
              ? Number(stats.totalBond).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"
          }
          Icon={Scale}
        />
      </div>

      {/* Filter bar */}
      <div
        className="glass-card"
        style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem" }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            value={filterMarket}
            onChange={(e) => {
              setFilterMarket(e.target.value.trim())
              setPage(1)
            }}
            placeholder="Market ID"
            style={{ ...inp, width: 200 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              style={{ ...inp, colorScheme: "dark" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              style={{ ...inp, colorScheme: "dark" }}
            />
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {total} disputes
          </span>
          {hasFilters && (
            <button
              className="secondary"
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              onClick={() => {
                setFilterMarket("")
                setDateFrom("")
                setDateTo("")
                setPage(1)
              }}
            >
              ✕ Clear
            </button>
          )}
          <button
            className="secondary"
            style={{
              fontSize: "0.78rem",
              padding: "5px 12px",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onClick={() => setTick((t) => t + 1)}
            disabled={loading}
          >
            <RefreshCw
              size={12}
              style={{
                animation: loading ? "spin 0.8s linear infinite" : "none",
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && rows.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading disputes…
        </div>
      ) : error ? (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "hsl(var(--destructive))",
          }}
        >
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No disputes found.
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
              }}
            >
              <thead>
                <tr
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {["Time", "Market", "User", "Status", "Bond", "Outcome"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.7rem 1rem",
                          textAlign: "left",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: "hsl(var(--muted-foreground))",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom:
                        i < rows.length - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                      background:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        color: "hsl(var(--muted-foreground))",
                        whiteSpace: "nowrap",
                        fontFamily: "monospace",
                        fontSize: "0.76rem",
                      }}
                    >
                      <span title={new Date(row.createdAt).toLocaleString()}>
                        {relativeTime(row.createdAt)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.market?.title ??
                        (row.marketId ? row.marketId.slice(0, 8) + "…" : "—")}
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {row.user?.telegramUsername ?? row.user?.username ?? "—"}
                    </td>
                    <td style={{ padding: "0.65rem 1rem" }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        fontFamily: "monospace",
                        fontWeight: 600,
                      }}
                    >
                      {Number(row.bond).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </td>
                    <td
                      style={{
                        padding: "0.65rem 1rem",
                        color: "hsl(var(--muted-foreground))",
                        fontFamily: "monospace",
                        fontSize: "0.76rem",
                      }}
                    >
                      {row.outcome ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 6,
                marginTop: "1.25rem",
                flexWrap: "wrap",
              }}
            >
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === 1}
                onClick={() => setPage(1)}
              >
                «
              </button>
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Prev
              </button>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8px",
                  fontSize: "0.78rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {page} / {totalPages}
              </span>
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next ›
              </button>
              <button
                className="secondary"
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
              >
                »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "transactions" | "disputes"

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "transactions", label: "Transaction Audits", Icon: TrendingUp },
  { id: "disputes", label: "Disputes", Icon: XCircle },
]

export function ReportingPage() {
  const [tab, setTab] = useState<Tab>("transactions")

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "hsl(var(--background))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <TrendingUp size={18} color="hsl(var(--muted-foreground))" />
            </div>
            <h2 style={{ margin: 0 }}>Reporting</h2>
          </div>
          <p
            style={{
              margin: 0,
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.875rem",
            }}
          >
            Transaction audits, disputes, and financial activity
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: "1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: 0,
        }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={tab === id ? "" : "secondary"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: "0.84rem",
              padding: "7px 16px",
              borderRadius: "8px 8px 0 0",
              borderBottom: "none",
              fontWeight: tab === id ? 700 : 400,
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === "transactions" && <TransactionAuditsTab />}
      {tab === "disputes" && <DisputesTab />}
    </div>
  )
}

export default ReportingPage
