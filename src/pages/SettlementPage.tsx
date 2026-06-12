import React, { useEffect, useState, useRef } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { CheckCircle, AlertCircle, RefreshCw, Eye, Trash2 } from "lucide-react"
import { SettlementDetails } from "../components/SettlementDetails"

interface Settlement {
  id: string
  marketId?: string
  market?: { title?: string; houseEdgePct?: number }
  outcome?: { label?: string }
  winningOutcomeId?: string
  totalBets?: number
  winningBets?: number
  totalPool?: string | number
  houseAmount?: string | number
  totalPaidOut?: string | number
  settledAt?: string
}

const PAGE_SIZE = 20

const SettlementPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const { getSettlements, deleteMarket, purgeZeroPoolSettled, loading, error } =
    useAdminApi(token)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedSettlement, setSelectedSettlement] =
    useState<Settlement | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  const totals = React.useMemo(() => {
    const totalPool = settlements.reduce(
      (s, x) => s + parseFloat(String(x.totalPool ?? 0)),
      0
    )
    const totalHouse = settlements.reduce(
      (s, x) => s + parseFloat(String(x.houseAmount ?? 0)),
      0
    )
    const totalPaidOut = settlements.reduce(
      (s, x) => s + parseFloat(String(x.totalPaidOut ?? 0)),
      0
    )
    return { totalPool, totalHouse, totalPaidOut }
  }, [settlements])

  const getSettlementsRef = useRef(getSettlements)
  useEffect(() => {
    getSettlementsRef.current = getSettlements
  })

  useEffect(() => {
    let cancelled = false
    getSettlementsRef
      .current({ page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        const r = res as { data: Settlement[]; total: number; pages: number }
        setSettlements(r.data ?? [])
        setTotal(r.total ?? 0)
        setPages(r.pages ?? 1)
        setFetchError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [page, token, refreshKey])

  const fetchSettlements = () => setRefreshKey((k) => k + 1)

  const zeroVolumeCount = settlements.filter(
    (s) => parseFloat(String(s.totalPool ?? 0)) === 0
  ).length

  const handleDeleteMarket = async (s: Settlement) => {
    if (!s.marketId) return
    if (
      !confirm(
        `Delete "${s.market?.title ?? s.marketId}"? This cannot be undone.`
      )
    )
      return
    setDeletingId(s.id)
    try {
      await deleteMarket(s.marketId)
      setSettlements((prev) => prev.filter((x) => x.id !== s.id))
      setTotal((t) => t - 1)
    } catch {
      alert("Failed to delete market.")
    } finally {
      setDeletingId(null)
    }
  }

  const handlePurgeZeroVolume = async () => {
    if (
      !confirm(
        "Delete all settled markets with zero volume? This removes the market and its settlement record. Cannot be undone."
      )
    )
      return
    setPurging(true)
    try {
      const result = (await purgeZeroPoolSettled()) as { deleted: number }
      fetchSettlements()
      alert(`Deleted ${result.deleted} zero-volume market(s).`)
    } catch {
      alert("Failed to purge zero-volume markets.")
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="settlement-page">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2>Settlements</h2>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            View and manage settled markets and their outcomes.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {zeroVolumeCount > 0 && (
            <button
              onClick={handlePurgeZeroVolume}
              disabled={purging}
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
                cursor: purging ? "not-allowed" : "pointer",
                opacity: purging ? 0.6 : 1,
              }}
            >
              <Trash2 size={14} />
              {purging
                ? "Deleting…"
                : `Delete Zero-Volume (${zeroVolumeCount})`}
            </button>
          )}
          <button
            onClick={fetchSettlements}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            className="secondary"
          >
            <RefreshCw
              size={16}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {(error || fetchError) && (
        <div
          style={{
            padding: "1rem",
            background: "hsl(var(--destructive) / 0.1)",
            border: "1px solid hsl(var(--destructive))",
            borderRadius: "8px",
            color: "hsl(var(--destructive))",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={18} />
          {error || fetchError}
        </div>
      )}

      {settlements.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="glass-card" style={{ padding: "1rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Total Pool (this page)
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              Nu. {totals.totalPool.toLocaleString()}
            </div>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Platform Fee Earned
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "hsl(142 71% 45%)",
              }}
            >
              Nu. {totals.totalHouse.toLocaleString()}
            </div>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Total Paid Out
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              Nu. {totals.totalPaidOut.toLocaleString()}
            </div>
          </div>
          <div className="glass-card" style={{ padding: "1rem" }}>
            <div
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Settled Markets
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{total}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading settlements...
        </div>
      ) : settlements.length === 0 ? (
        <div
          className="glass-card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <CheckCircle
            size={48}
            style={{ margin: "0 auto 1rem", opacity: 0.5 }}
          />
          <h3>No Settled Markets</h3>
          <p>There are currently no resolved transactions to display.</p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Settlement ID
                </th>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Market
                </th>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Winning Outcome
                </th>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Pool Details
                </th>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Platform Fee
                </th>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    padding: "1rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s: Settlement, idx) => (
                <React.Fragment key={s.id || idx}>
                  <tr
                    style={{
                      borderBottom: "1px solid hsl(var(--border) / 0.5)",
                    }}
                  >
                    <td
                      style={{
                        padding: "1rem",
                        fontFamily: "monospace",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div title={s.id}>
                        {s.id ? s.id.substring(0, 8) + "..." : "N/A"}
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ fontWeight: 600 }}>
                        {s.market?.title || "Unknown Market"}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {s.totalBets} total predictions
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span
                        className="badge"
                        style={{
                          background: "hsl(var(--primary) / 0.1)",
                          color: "hsl(var(--primary))",
                        }}
                      >
                        {s.outcome?.label ||
                          s.winningOutcomeId?.substring(0, 8) + "..." ||
                          "Unknown"}
                      </span>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "hsl(var(--muted-foreground))",
                          marginTop: "0.25rem",
                        }}
                      >
                        {s.winningBets} winning predictions
                      </div>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.85rem" }}>
                      <div>
                        Total: NU.{" "}
                        {parseFloat(String(s.totalPool ?? 0)).toLocaleString()}
                      </div>
                      <div style={{ color: "hsl(var(--muted-foreground))" }}>
                        Payout: NU.{" "}
                        {parseFloat(
                          String(s.totalPaidOut ?? 0)
                        ).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: "1rem", fontSize: "0.85rem" }}>
                      <div
                        style={{ fontWeight: 600, color: "hsl(142 71% 45%)" }}
                      >
                        Nu.{" "}
                        {parseFloat(
                          String(s.houseAmount ?? 0)
                        ).toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {s.market?.houseEdgePct ?? "—"}% fee
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "1rem",
                        color: "hsl(var(--muted-foreground))",
                        fontSize: "0.85rem",
                      }}
                    >
                      {s.settledAt
                        ? new Date(s.settledAt).toLocaleString()
                        : "Unknown"}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            setSelectedSettlement(
                              selectedSettlement === s ? null : s
                            )
                          }
                          className="secondary"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.75rem",
                          }}
                          title="View Details"
                        >
                          <Eye size={14} />
                          {selectedSettlement === s ? "Hide" : "Details"}
                        </button>
                        {parseFloat(String(s.totalPool ?? 0)) === 0 && (
                          <button
                            onClick={() => handleDeleteMarket(s)}
                            disabled={deletingId === s.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: "none",
                              border: "1px solid hsl(var(--destructive))",
                              borderRadius: 5,
                              padding: "0.3rem 0.6rem",
                              color: "hsl(var(--destructive))",
                              cursor:
                                deletingId === s.id ? "not-allowed" : "pointer",
                              opacity: deletingId === s.id ? 0.5 : 1,
                            }}
                            title="Delete this zero-volume market"
                          >
                            <Trash2 size={13} />
                            {deletingId === s.id ? "…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {selectedSettlement === s && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          padding: "0",
                          background: "hsl(var(--muted) / 0.05)",
                        }}
                      >
                        <div style={{ padding: "1rem" }}>
                          <SettlementDetails settlement={s} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {settlements.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1rem",
            padding: "0.75rem 0",
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.875rem",
          }}
        >
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total} settlements
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              style={{ opacity: page <= 1 || loading ? 0.5 : 1 }}
            >
              Previous
            </button>
            <span style={{ padding: "0.5rem 0.75rem", alignSelf: "center" }}>
              {page} / {pages}
            </span>
            <button
              className="secondary"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              style={{ opacity: page >= pages || loading ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettlementPage
