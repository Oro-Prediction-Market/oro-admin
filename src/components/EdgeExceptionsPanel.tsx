import { useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

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
 * Settlement charges the BOOK's edge. A mismatch — the market row showing one
 * edge while a book charges another — is called out separately, because it is
 * the case where what an admin sees is not what bettors pay.
 */
export default function EdgeExceptionsPanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<{
    standard: number
    markets: EdgeException[]
  } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api
      .getEdgeExceptions()
      .then((d) => setData(d as { standard: number; markets: EdgeException[] }))
      // A failed side-panel must not take the market list down with it.
      .catch(() => setData(null))
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (!data || data.markets.length === 0) return null

  const mismatches = data.markets.filter((m) => m.mismatch).length
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div
      className="glass-card"
      style={{
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        border: "1px solid rgba(251,191,36,0.4)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
          {data.markets.length} market(s) not on the standard {data.standard}%
          house edge
        </span>
        {mismatches > 0 && (
          <span style={{ color: "#f87171", fontWeight: 600 }}>
            · {mismatches} charging a different edge than they show
          </span>
        )}
        <Chevron size={16} style={{ marginLeft: "auto" }} />
      </button>

      {open && (
        <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Status</th>
                <th>Market edge</th>
                <th>Charged (book)</th>
                <th>Pool</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.markets.map((m) => (
                <tr key={m.id}>
                  <td title={m.id}>
                    {m.title}
                    {m.mismatch && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: "#f87171",
                          fontSize: "0.75rem",
                        }}
                      >
                        MISMATCH
                      </span>
                    )}
                  </td>
                  <td>{m.status}</td>
                  <td>{m.marketEdge}%</td>
                  <td>
                    {m.books.length === 0
                      ? "—"
                      : m.books
                          .map((b) => `${b.edge}% ${b.currency}`)
                          .join(", ")}
                  </td>
                  <td>
                    {m.books.length === 0
                      ? "—"
                      : m.books
                          .map(
                            (b) =>
                              `${b.pool.toLocaleString("en-US")} ${b.currency}`
                          )
                          .join(", ")}
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
