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
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 20
  const [processing, setProcessing] = useState(false)
  const [transferringId, setTransferringId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [accountNumber, setAccountNumber] = useState("")
  const [accountSource, setAccountSource] = useState("")
  const [editingAccount, setEditingAccount] = useState(false)
  const [accountInput, setAccountInput] = useState("")
  const [accountBalance, setAccountBalance] = useState<string | null>(null)
  const [accountName, setAccountName] = useState("")

  const fetchData = async (currentPage = page, currentFilter = filter) => {
    try {
      const [summaryData, allData, acctData] = await Promise.all([
        api.getRevenueSummary(),
        api.getRevenueAll({
          page: currentPage,
          limit: PAGE_SIZE,
          status: currentFilter,
        }),
        api.getRevenueAccount(),
      ])
      setSummary(summaryData)
      setDistributions(allData?.data || [])
      setTotal(allData?.total ?? 0)
      setAccountNumber(acctData.accountNumber || "")
      setAccountSource(acctData.source || "")
      setAccountInput(acctData.accountNumber || "")

      // Fetch balance if account is configured
      if (acctData.accountNumber) {
        try {
          const balData = await api.getRevenueAccountBalance()
          setAccountBalance(balData.balance)
          setAccountName(balData.accountName || "")
        } catch {
          setAccountBalance(null)
        }
      }
    } catch (err) {
      console.error("Failed to fetch revenue data", err)
    }
  }

  useEffect(() => {
    fetchData(page, filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filter])

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

  const handleBackfill = async () => {
    setMessage(null)
    try {
      const result = await api.backfillRevenue()
      setMessage(
        `✅ Backfilled ${result.backfilled} revenue distributions from existing settlements`
      )
      await fetchData()
    } catch (err: unknown) {
      setMessage(`❌ Backfill error: ${(err as Error).message}`)
    }
  }

  const handleSaveAccount = async () => {
    if (!accountInput.trim()) return
    setMessage(null)
    try {
      const result = await api.setRevenueAccount(accountInput.trim())
      setAccountNumber(result.accountNumber)
      setAccountSource(result.source)
      setEditingAccount(false)
      setMessage(`✅ Destination account updated: ${result.accountNumber}`)
    } catch (err: unknown) {
      setMessage(`❌ Error: ${(err as Error).message}`)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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

      {/* Destination Account Config */}
      <div
        className="glass-card"
        style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            Destination Account:
          </span>
          {editingAccount ? (
            <>
              <input
                type="text"
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                placeholder="Enter DK Bank account number"
                style={{
                  padding: "0.4rem 0.6rem",
                  fontSize: "0.8rem",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.375rem",
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  width: "180px",
                }}
              />
              <button
                onClick={handleSaveAccount}
                style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}
              >
                Save
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setEditingAccount(false)
                  setAccountInput(accountNumber)
                }}
                style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <code style={{ fontSize: "0.8rem" }}>
                {accountNumber || "Not configured"}
              </code>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "hsl(var(--muted-foreground))",
                  background: "hsla(var(--muted), 0.3)",
                  padding: "0.15rem 0.4rem",
                  borderRadius: "0.25rem",
                }}
              >
                {accountSource === "admin"
                  ? "set by admin"
                  : accountSource === "env"
                    ? "from env"
                    : "—"}
              </span>
              <button
                className="secondary"
                onClick={() => setEditingAccount(true)}
                style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}
              >
                Edit
              </button>
            </>
          )}
        </div>
        {accountNumber && (accountName || accountBalance) && (
          <div
            style={{
              marginTop: "0.6rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
              display: "flex",
              gap: "1.5rem",
            }}
          >
            {accountName && <span>👤 {accountName}</span>}
            {accountBalance && (
              <span style={{ color: "#22c55e", fontWeight: 600 }}>
                💰 Balance: Nu {accountBalance}
              </span>
            )}
          </div>
        )}
      </div>

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

        {total === 0 && (
          <button
            onClick={handleBackfill}
            style={{
              background: "hsla(220, 100%, 50%, 0.15)",
              color: "#60a5fa",
              borderColor: "hsla(220, 100%, 50%, 0.4)",
            }}
          >
            Backfill from Settlements
          </button>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["all", "pending", "completed"] as const).map((f) => (
            <button
              key={f}
              className={filter === f ? "" : "secondary"}
              onClick={() => {
                setFilter(f)
                setPage(1)
              }}
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
            {distributions.length === 0 && (
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
            {distributions.map((d) => (
              <tr key={d.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
                <td
                  style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                  title={d.marketId}
                >
                  {d.marketId?.slice(0, 8) ?? "—"}…
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            marginTop: "1rem",
          }}
        >
          <button
            className="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.8rem" }}
          >
            ← Prev
          </button>
          <span
            style={{
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Page {page} of {totalPages} &nbsp;·&nbsp; {total} total
          </span>
          <button
            className="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.8rem" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

export default RevenuePage
