import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface AttentionItem {
  key: string
  label: string
  count: number
  amountBtn?: number
  page: string
  urgent: boolean
}

interface AttentionResponse {
  items: AttentionItem[]
  today: {
    deposits: { count: number; sumBtn: number }
    withdrawals: { count: number; sumBtn: number }
  }
}

const nu = (n: number) =>
  `Nu ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`

/** Same channel as `admin:unauthorized` — AdminPage listens and switches page. */
const goTo = (page: string) =>
  window.dispatchEvent(new CustomEvent("admin:navigate", { detail: page }))

/**
 * What is waiting on a human right now.
 *
 * The dashboard used to show four totals and nothing to act on; every queue
 * below already had its own page, but you had to know to go and look. Only
 * non-empty items are listed, urgent ones first, each linking to the page that
 * handles it. When nothing needs attention it says so in one line.
 */
export default function AttentionPanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<AttentionResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData((await api.getAttention()) as AttentionResponse)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  if (err)
    return (
      <div
        className="glass-card"
        style={{ padding: "1rem", marginBottom: "2rem", color: "#f87171" }}
      >
        Could not load what needs attention: {err}
      </div>
    )
  if (!data) return null

  const open = data.items
    .filter((i) => i.count > 0)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent))

  return (
    <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {open.length === 0 ? (
            <>
              <CheckCircle2 size={16} color="#34d399" /> Nothing needs attention
            </>
          ) : (
            <>
              <AlertTriangle
                size={16}
                color={open.some((i) => i.urgent) ? "#f87171" : "#fbbf24"}
              />{" "}
              Needs attention
            </>
          )}
        </h3>
        {open.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => goTo(i.page)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "0.55rem 0.25rem",
              background: "transparent",
              border: "none",
              borderTop: "1px solid hsl(var(--border))",
              color: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              style={{
                minWidth: 32,
                textAlign: "center",
                fontWeight: 800,
                color: i.urgent ? "#f87171" : "#fbbf24",
              }}
            >
              {i.count}
            </span>
            <span style={{ flex: 1 }}>
              {i.label}
              {i.amountBtn ? (
                <span style={{ color: "hsl(var(--muted-foreground))" }}>
                  {" "}
                  · {nu(i.amountBtn)}
                </span>
              ) : null}
            </span>
            <ChevronRight
              size={16}
              style={{ color: "hsl(var(--muted-foreground))" }}
            />
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="glass-card stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.85rem",
            }}
          >
            <ArrowDownLeft size={14} /> Deposits today
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>
            {nu(data.today.deposits.sumBtn)}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {data.today.deposits.count} transactions
          </div>
        </div>
        <div className="glass-card stat-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.85rem",
            }}
          >
            <ArrowUpRight size={14} /> Withdrawals today
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: 4 }}>
            {nu(data.today.withdrawals.sumBtn)}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {data.today.withdrawals.count} transactions
          </div>
        </div>
      </div>
    </div>
  )
}
