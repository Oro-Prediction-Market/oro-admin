import React, { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

interface RevenueDistribution {
  id: string
  marketId: string
  settlementId: string
  amount: number
  houseEdgePct: number
  totalPool: number
  publicAccountNo: string
  status: "pending" | "completed" | "failed"
  paymentReference: string | null
  createdAt: string
  paidAt: string | null
}

interface RevenueSummary {
  totalPending: number
  totalCompleted: number
  totalFailed: number
  pendingAmount: number
  completedAmount: number
}

const RevenuePage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [distributions, setDistributions] = useState<RevenueDistribution[]>([])
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all")
  const [processing, setProcessing] = useState(false)
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [summaryData, allData] = await Promise.all([
        api.getRevenueSummary(),
        api.getRevenueAll(),
      ])
      setSummary(summaryData)
      setDistributions(allData || [])
    } catch (err) {
      console.error("Failed to fetch revenue data", err)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTransfer = async (id: string) => {
    setTransferringId(id)
    setMessage(null)
    try {
      const result = await api.executeRevenueTransfer(id)
      if (result.success) {
        setMessage(`✅ Transfer successful — Ref: ${result.paymentReference}`)
      } else {
        setMessage(`❌ Transfer failed: ${result.error}`)
      }
      await fetchData()
    } catch (err: unknown) {
      setMessage(`❌ Error: ${(err as Error).message}`)
    } finally {
      setTransferringId(null)
    }
  }

  const handleProcessAll = async () => {
    if (
      !confirm(
        "Transfer ALL pending house edge to public account? This will execute real DK Bank transfers."
      )
    )
      return
    setProcessing(true)
    setMessage(null)
    try {
      const result = await api.processAllRevenue()
      setMessage(
        `Batch complete: ${result.succeeded} succeeded, ${result.failed} failed — Total: Nu ${result.totalAmount.toFixed(2)}`
      )
      await fetchData()
    } catch (err: unknown) {
      setMessage(`❌ Batch error: ${(err as Error).message}`)
    } finally {
      setProcessing(false)
    }
  }

  const filtered = distributions.filter((d) => {
    if (filter === "pending") return d.status === "pending"
    if (filter === "completed") return d.status === "completed"
    return true
  })

  return (
    <div>
      <h2 style={{ marginBottom: "1.5rem" }}>Revenue Distribution</h2>
      <p
        style={{
          color: "hsl(var(--muted-foreground))",
          marginBottom: "2rem",
          fontSize: "0.875rem",
        }}
      >
        House edge from settled markets → DK Public Account. Admin triggers
        transfers.
      </p>

      {/* Summary Cards */}
      {summary && (
        <div className="stat-grid">
          <div className="glass-card stat-card">
            <h3>Pending</h3>
            <p style={{ color: "#f59e0b" }}>
              Nu {Number(summary.pendingAmount).toFixed(2)}
            </p>
            <span
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {summary.totalPending} distribution(s)
            </span>
          </div>
          <div className="glass-card stat-card">
            <h3>Completed</h3>
            <p style={{ color: "#22c55e" }}>
              Nu {Number(summary.completedAmount).toFixed(2)}
            </p>
            <span
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {summary.totalCompleted} transfer(s)
            </span>
          </div>
          <div className="glass-card stat-card">
            <h3>Failed</h3>
            <p style={{ color: "#ef4444" }}>{summary.totalFailed}</p>
            <span
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Requires manual review
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          onClick={handleProcessAll}
          disabled={processing || !summary?.totalPending}
          style={{
            background: "hsla(160, 100%, 40%, 0.15)",
            color: "#4ade80",
            borderColor: "hsla(160, 100%, 40%, 0.4)",
          }}
        >
          {processing ? "Processing…" : "Transfer All Pending to Public Acc"}
        </button>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["all", "pending", "completed"] as const).map((f) => (
            <button
              key={f}
              className={filter === f ? "" : "secondary"}
              onClick={() => setFilter(f)}
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.8rem" }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div
          className="glass-card"
          style={{ marginBottom: "1rem", padding: "0.75rem 1rem" }}
        >
          {message}
        </div>
      )}

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Market</th>
              <th>Pool</th>
              <th>Edge %</th>
              <th>Amount</th>
              <th>Dest</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    color: "hsl(var(--muted-foreground))",
                    padding: "2rem",
                  }}
                >
                  No distributions found
                </td>
              </tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
                <td
                  style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                  title={d.marketId}
                >
                  {d.marketId.slice(0, 8)}…
                </td>
                <td>Nu {Number(d.totalPool).toFixed(0)}</td>
                <td>{Number(d.houseEdgePct)}%</td>
                <td style={{ fontWeight: 600 }}>
                  Nu {Number(d.amount).toFixed(2)}
                </td>
                <td
                  style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                  title={d.publicAccountNo}
                >
                  {d.publicAccountNo}
                </td>
                <td>
                  <span
                    className={`badge badge-${d.status === "completed" ? "open" : d.status === "pending" ? "upcoming" : "cancelled"}`}
                  >
                    {d.status}
                  </span>
                </td>
                <td>
                  {d.status === "pending" ? (
                    <button
                      onClick={() => handleTransfer(d.id)}
                      disabled={transferringId === d.id}
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.3rem 0.6rem",
                      }}
                    >
                      {transferringId === d.id ? "…" : "Transfer"}
                    </button>
                  ) : d.paymentReference ? (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "hsl(var(--muted-foreground))",
                      }}
                      title={d.paymentReference}
                    >
                      Ref: {d.paymentReference.slice(0, 12)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default RevenuePage
