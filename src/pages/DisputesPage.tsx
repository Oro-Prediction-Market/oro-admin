import { useEffect, useState } from "react"
import { RefreshCw, Scale } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface Entry {
  id: string
  userId: string
  name: string | null
  side: "object" | "support"
  reason: string
  bondAmount: number
  currency: string
  bondStatus: string
  upheld: boolean | null
  rewardAmount: number
  createdAt: string
}

interface DisputeCase {
  marketId: string
  title: string
  subcategory: string | null
  marketStatus: string
  open: boolean
  disputeDeadlineAt: string | null
  windowMinutes: number | null
  proposed: string | null
  final: string | null
  /** null until the market settles. */
  overturned: boolean | null
  objectors: number
  supporters: number
  latestAt: string
  entries: Entry[]
}

interface Response {
  stats: {
    totalCases: number
    openCases: number
    totalDisputes: number
    overturnedCases: number
    byCurrency: {
      currency: string
      locked: number
      forfeited: number
      rewards: number
    }[]
  }
  page: number
  pages: number
  total: number
  cases: DisputeCase[]
}

const amount = (n: number, ccy: string) =>
  ccy === "BTN"
    ? `Nu ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `${n} ${ccy}`
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—"

const BOND: Record<string, { text: string; color: string }> = {
  locked: { text: "Locked", color: "#fbbf24" },
  rewarded: { text: "Won · returned", color: "#34d399" },
  forfeited: { text: "Lost · forfeited", color: "#f87171" },
  not_applicable: { text: "—", color: "hsl(var(--muted-foreground))" },
}

/**
 * Every resolution contest, one card per market.
 *
 * Replaces the Reporting › Disputes tab, which listed bonds and statuses but
 * not the objector's reason, which side they took, the reward paid, or what
 * the market was proposed as against what it settled as.
 */
export default function DisputesPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [status, setStatus] = useState<"all" | "open" | "resolved">("all")
  const [verdict, setVerdict] = useState<"all" | "overturned" | "stood">("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [tick, setTick] = useState(0)
  const [data, setData] = useState<Response | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Commit search 400 ms after typing stops, back to page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    let live = true
    api
      .getDisputeCases({
        status,
        verdict,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
        page,
        limit: 20,
      })
      .then((d) => live && (setData(d as Response), setErr(null)))
      .catch((e: Error) => live && setErr(e.message))
    return () => {
      live = false
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, verdict, from, to, search, page, tick])

  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }
  const st = data?.stats

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h2
          style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <Scale size={20} /> Disputes
        </h2>
        <button
          className="secondary"
          onClick={() => setTick((t) => t + 1)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {st && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <Stat label="Open cases" value={st.openCases.toLocaleString()} />
          <Stat
            label="All cases"
            value={`${st.totalCases.toLocaleString()} (${st.totalDisputes} filings)`}
          />
          <Stat
            label="Proposals overturned"
            value={st.overturnedCases.toLocaleString()}
          />
          {st.byCurrency.map((c) => (
            <Stat
              key={c.currency}
              label={`Bonds ${c.currency}`}
              value={`${amount(c.locked, c.currency)} locked`}
              sub={`${amount(c.forfeited, c.currency)} forfeited · ${amount(c.rewards, c.currency)} rewards paid`}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        <input
          className="input-field"
          placeholder="Search market…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: 220 }}
        />
        <select
          className="input-field"
          value={status}
          onChange={(e) =>
            resetPage(setStatus)(e.target.value as typeof status)
          }
          style={{ width: "auto" }}
        >
          <option value="all">Open &amp; resolved</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          className="input-field"
          value={verdict}
          onChange={(e) =>
            resetPage(setVerdict)(e.target.value as typeof verdict)
          }
          style={{ width: "auto" }}
        >
          <option value="all">Any verdict</option>
          <option value="overturned">Proposal overturned</option>
          <option value="stood">Proposal stood</option>
        </select>
        <input
          type="date"
          className="input-field"
          value={from}
          onChange={(e) => resetPage(setFrom)(e.target.value)}
          style={{ width: "auto" }}
          title="Filed on or after"
        />
        <input
          type="date"
          className="input-field"
          value={to}
          onChange={(e) => resetPage(setTo)(e.target.value)}
          style={{ width: "auto" }}
          title="Filed on or before"
        />
      </div>

      {err && (
        <div
          className="glass-card"
          style={{ padding: "1rem", color: "#f87171", marginBottom: "1rem" }}
        >
          {err}
        </div>
      )}

      {data && data.cases.length === 0 && (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No disputes match.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {data?.cases.map((c) => (
          <CaseCard key={c.marketId} c={c} />
        ))}
      </div>

      {data && data.pages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: "1.5rem",
          }}
        >
          <button
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={{ fontSize: "0.85rem" }}>
            Page {data.page} of {data.pages} · {data.total} cases
          </span>
          <button
            className="secondary"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="glass-card stat-card">
      <div
        style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: 4 }}>
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}

function CaseCard({ c }: { c: DisputeCase }) {
  const badge = c.open
    ? { text: "OPEN", color: "#fbbf24" }
    : c.overturned === true
      ? { text: "OVERTURNED", color: "#f87171" }
      : c.overturned === false
        ? { text: "PROPOSAL STOOD", color: "#34d399" }
        : { text: "RESOLVED", color: "hsl(var(--muted-foreground))" }

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: "0.5rem 1rem",
          marginBottom: "0.5rem",
        }}
      >
        <strong title={c.marketId}>{c.title}</strong>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: badge.color,
            border: `1px solid ${badge.color}`,
            borderRadius: 6,
            padding: "1px 6px",
          }}
        >
          {badge.text}
        </span>
        <span
          style={{ fontSize: "0.8rem", color: "hsl(var(--muted-foreground))" }}
        >
          {c.subcategory ?? "—"} · market {c.marketStatus}
        </span>
      </div>

      <div
        style={{
          fontSize: "0.85rem",
          marginBottom: "0.75rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.25rem 1.5rem",
        }}
      >
        <span>
          Proposed: <b>{c.proposed ?? "—"}</b>
        </span>
        <span>
          Settled as:{" "}
          <b style={{ color: c.overturned ? "#f87171" : undefined }}>
            {c.final ?? "not settled yet"}
          </b>
        </span>
        <span style={{ color: "hsl(var(--muted-foreground))" }}>
          {c.objectors} objecting · {c.supporters} defending
        </span>
        {c.open && c.disputeDeadlineAt && (
          <span style={{ color: "hsl(var(--muted-foreground))" }}>
            Window closes {when(c.disputeDeadlineAt)}
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Filed</th>
              <th>User</th>
              <th>Side</th>
              <th style={{ minWidth: 260 }}>Reason</th>
              <th>Bond</th>
              <th>Bond outcome</th>
              <th>Reward</th>
            </tr>
          </thead>
          <tbody>
            {c.entries.map((e) => {
              const b = BOND[e.bondStatus] ?? {
                text: e.bondStatus,
                color: "inherit",
              }
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{when(e.createdAt)}</td>
                  <td title={e.userId}>{e.name ?? e.userId.slice(0, 8)}</td>
                  <td style={{ fontWeight: 600 }}>
                    {e.side === "object" ? "Objecting" : "Defending"}
                  </td>
                  {/* Shown in full — the reason is the whole point of the page. */}
                  <td
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {e.reason}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {amount(e.bondAmount, e.currency)}
                  </td>
                  <td style={{ color: b.color, whiteSpace: "nowrap" }}>
                    {b.text}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {e.rewardAmount ? amount(e.rewardAmount, e.currency) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
