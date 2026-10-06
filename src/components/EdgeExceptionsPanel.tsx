import { useEffect, useState } from "react"
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
 * Filter button for markets not on the standard house edge, sitting with the
 * status tabs.
 *
 * Any admin can set a per-market edge from 0 to 50%, and nothing showed where
 * that had happened — a market settled at 15% in production and was found by
 * hand-written SQL. The count comes from the edge-exceptions view (BTC and TER
 * rounds excluded); each listed market shows its own edge, and what its books
 * charge when that differs, on its row.
 */
export default function EdgeExceptionsPanel({
  active,
  onToggle,
}: {
  /** Whether the market list is filtered to these markets. */
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
      // A failed count must not take the market list down with it.
      .catch(() => setData(null))
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const count = data?.markets.length
  const mismatches = data?.markets.filter((m) => m.mismatch).length ?? 0
  const standard = data?.standard ?? DEFAULT_HOUSE_EDGE_PCT

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={active ? "" : "secondary"}
      title={
        mismatches > 0
          ? `${mismatches} of these charge bettors a different edge than the market shows`
          : `Markets whose house edge is not the standard ${standard}%`
      }
      style={{
        fontSize: "0.75rem",
        padding: "0.5rem 1rem",
        borderRadius: "9999px",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      Not {standard}% edge
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            padding: "0 6px",
            borderRadius: 9999,
            background: mismatches > 0 ? "#f87171" : "#fbbf24",
            color: "#111",
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}
