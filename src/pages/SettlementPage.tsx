import React, { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { CheckCircle, AlertCircle, RefreshCw, Eye } from "lucide-react"
import { SettlementDetails } from "../components/SettlementDetails"

interface Settlement {
  id: string
  market?: { title?: string }
  outcome?: { label?: string }
  winningOutcomeId?: string
  totalBets?: number
  winningBets?: number
  totalPool?: string | number
  totalPaidOut?: string | number
  settledAt?: string
}

const SettlementPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const { getSettlements, loading, error } = useAdminApi(token)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedSettlement, setSelectedSettlement] =
    useState<Settlement | null>(null)

  const fetchSettlements = async () => {
    try {
      const data = await getSettlements()
      setSettlements((data as Settlement[]) || [])
      setFetchError(null)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void fetchSettlements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
          />
          Refresh
        </button>
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
                        {s.totalBets} total bets
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
                        {s.winningBets} winning bets
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
                    </td>
                  </tr>
                  {selectedSettlement === s && (
                    <tr>
                      <td
                        colSpan={6}
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
    </div>
  )
}

export default SettlementPage
