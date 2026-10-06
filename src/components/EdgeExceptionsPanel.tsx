import { useEffect, useState } from "react"
import { AlertTriangle, Filter, X } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { DEFAULT_HOUSE_EDGE_PCT } from "../lib/fee"

interface EdgeBook {
  currency: string
  edge: number
  pool: number
}

interface EdgeException {
  id: string
  title: string
  status: string
  subcategory: string | null
  marketEdge: number
  createdAt: string
  books: EdgeBook[]
  mismatch: boolean
}

/**
 * Markets not on the standard house edge.
 *
 * Any admin can set a per-market edge from 0 to 50%, and nothing showed where
 * that had happened — a market settled at 15% in production and was found by
 * hand-written SQL. Renders nothing at all when every market is standard, so
 * it costs no space on a normal day.
 *
 * Clicking it filters the market list to those markets; each row there shows
 * its edge, and what its books actually charge.
 *
 * Settlement charges the BOOK's edge. A mismatch — the market row showing one
 * edge while a book charges another — is called out separately, because it is
 * the case where what an admin sees is not what bettors pay.
 */
export default function EdgeExceptionsPanel({
  active,
  onToggle,
}: {
  /** Whether the market list below is filtered to these markets. */
  active: boolean
  onToggle: () => void
}) {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<{
    standard: number
    markets: EdgeException[]
  } | null>(null)

  useEffect(() => {
    api
      .getEdgeExceptions()
      .then((d) => setData(d as { standard: number; markets: EdgeException[] }))
      // A failed side-panel must not take the market list down with it.
      .catch(() => setData(null))
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Stays visible while the filter is on, so it can always be switched off.
  if (!active && (!data || data.markets.length === 0)) return null

  const count = data?.markets.length ?? 0
  const mismatches = data?.markets.filter((m) => m.mismatch).length ?? 0

  return (
    <div
      className="glass-card"
      style={{
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        border: `1px solid ${active ? "rgba(251,191,36,0.9)" : "rgba(251,191,36,0.4)"}`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <AlertTriangle size={16} color="#fbbf24" />
        <span style={{ fontWeight: 600 }}>
          {count} market(s) not on the standard{" "}
          {data?.standard ?? DEFAULT_HOUSE_EDGE_PCT}% house edge
        </span>
        {mismatches > 0 && (
          <span style={{ color: "#f87171", fontWeight: 600 }}>
            · {mismatches} charging a different edge than they show
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: active ? "#fbbf24" : "hsl(var(--muted-foreground))",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {active ? (
            <>
              Showing only these · Show all <X size={14} />
            </>
          ) : (
            <>
              Show only these <Filter size={14} />
            </>
          )}
        </span>
      </button>
    </div>
  )
}
