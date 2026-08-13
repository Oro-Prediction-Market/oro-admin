import { useCallback, useEffect, useMemo, useState } from "react"
import { X, Plus, ThumbsUp, ArrowDownWideNarrow } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { useToast } from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import MarketForm, { type MarketFormData } from "../components/MarketForm"

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  variant: "danger" | "default"
  onConfirm: () => void | Promise<void>
}

// ── Market Suggestions (Oracle Orbit review) ────────────────────────────────
// Users suggest markets and upvote them in the app's "orbit". Here an admin can
// approve/reject them (also possible from Telegram) and, for popular ones, turn
// a suggestion into a real published market — which removes it from the orbit.

interface Suggestion {
  id: string
  title: string
  description: string | null
  category: string
  status: "pending" | "approved" | "rejected" | "created"
  votes: number
  proposer: string
  marketId: string | null
  createdAt: string
  reviewedAt: string | null
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "created", label: "Published" },
  { key: "rejected", label: "Rejected" },
] as const

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> =
  {
    pending: {
      bg: "hsl(45 90% 50% / 0.15)",
      fg: "hsl(45 90% 60%)",
      label: "Pending",
    },
    approved: {
      bg: "hsl(140 60% 45% / 0.15)",
      fg: "hsl(140 60% 60%)",
      label: "Approved",
    },
    created: {
      bg: "hsl(217 91% 60% / 0.15)",
      fg: "hsl(217 91% 70%)",
      label: "Published",
    },
    rejected: {
      bg: "hsl(0 70% 55% / 0.15)",
      fg: "hsl(0 70% 65%)",
      label: "Rejected",
    },
  }

const MarketSuggestions: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [sort, setSort] = useState<"votes" | "latest">("votes")
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState<Suggestion | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const runConfirm = async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      await confirm.onConfirm()
    } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = (await api.getSuggestions(
        filter === "all" ? undefined : filter,
        sort
      )) as Suggestion[]
      setSuggestions(rows)
    } catch (e: unknown) {
      notify(
        "error",
        `Failed to load suggestions: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleReview = async (s: Suggestion, approve: boolean) => {
    setBusyId(s.id)
    try {
      await api.reviewSuggestion(s.id, approve)
      notify("success", `Suggestion ${approve ? "approved" : "rejected"}.`)
      await refresh()
    } catch (e: unknown) {
      notify("error", `Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusyId(null)
    }
  }

  const handlePublish = async (data: MarketFormData) => {
    if (!publishing) return
    if (data.candidates?.length) {
      notify(
        "error",
        "Grouped/political markets can't be published from here — create those from Market Management."
      )
      throw new Error("grouped market not supported for publish")
    }
    try {
      await api.publishSuggestion(publishing.id, {
        ...(data as unknown as Record<string, unknown>),
        outcomes: data.outcomes.map((o) => ({
          label: o.label,
          imageUrl: o.imageUrl ?? null,
        })),
      })
      notify("success", `Published "${data.title}" — suggestion closed.`)
      setPublishing(null)
      await refresh()
    } catch (e: unknown) {
      notify(
        "error",
        `Error publishing: ${e instanceof Error ? e.message : String(e)}`
      )
      throw e
    }
  }

  const emptyLabel = useMemo(
    () =>
      filter === "all"
        ? "No market suggestions yet."
        : `No ${filter} suggestions.`,
    [filter]
  )

  // Publishing view — the full create form, seeded from the suggestion.
  if (publishing) {
    return (
      <>
        {ToastContainer}
        <div style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: 4 }}>Publish suggestion</h2>
          <p
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.85rem",
            }}
          >
            Seeded from <strong>{publishing.proposer}</strong>'s suggestion (
            {publishing.votes} vote{publishing.votes === 1 ? "" : "s"}). Adjust
            the outcomes and details, then publish.
          </p>
        </div>
        <MarketForm
          seed={{
            title: publishing.title,
            description: publishing.description ?? "",
            category: publishing.category,
          }}
          onSubmit={handlePublish}
          onCancel={() => setPublishing(null)}
          loading={api.loading}
        />
      </>
    )
  }

  return (
    <div className="market-management">
      {ToastContainer}
      <div className="page-header">
        <div>
          <h2>Market Suggestions</h2>
          <div
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.85rem",
            }}
          >
            Review the Oracle Orbit — approve, reject, or publish user-suggested
            markets.
          </div>
        </div>
      </div>

      {/* Status filter + sort */}
      <div
        style={{
          display: "flex",
          gap: 8,
          margin: "1rem 0",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "" : "secondary"}
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <ArrowDownWideNarrow size={16} />
          Sort:
          <select
            className="input-field"
            style={{ marginBottom: 0, width: "auto", padding: "6px 10px" }}
            value={sort}
            onChange={(e) => setSort(e.target.value as "votes" | "latest")}
          >
            <option value="votes">Most votes</option>
            <option value="latest">Latest</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {loading ? (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Loading suggestions…
          </div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Suggestion</th>
                <th style={{ width: 90 }}>Votes</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      color: "hsl(var(--muted-foreground))",
                      padding: "3rem",
                    }}
                  >
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                suggestions.map((s) => {
                  const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending
                  const busy = busyId === s.id
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.title}</div>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "hsl(var(--muted-foreground))",
                            marginTop: 3,
                          }}
                        >
                          {s.category} · by {s.proposer}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 700,
                          }}
                        >
                          <ThumbsUp size={13} /> {s.votes}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 999,
                            background: st.bg,
                            color: st.fg,
                          }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "nowrap",
                            alignItems: "center",
                          }}
                        >
                          {s.status === "pending" && (
                            <>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: "Approve suggestion",
                                    message: `Approve "${s.title}"?\n\nIt will join the Oracle Orbit for users to vote on.`,
                                    confirmLabel: "Approve",
                                    variant: "default",
                                    onConfirm: () => handleReview(s, true),
                                  })
                                }
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "0.78rem",
                                  color: "hsl(140 60% 60%)",
                                }}
                                className="secondary"
                                title="Approve"
                              >
                                Approve
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: "Reject suggestion",
                                    message: `Reject "${s.title}"?\n\nIt will be hidden and the proposer notified.`,
                                    confirmLabel: "Reject",
                                    variant: "danger",
                                    onConfirm: () => handleReview(s, false),
                                  })
                                }
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "0.78rem",
                                  color: "hsl(var(--destructive))",
                                }}
                                className="secondary"
                                title="Reject"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {s.status === "approved" && (
                            <>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: "Create market",
                                    message: `Create a real market from "${s.title}"?\n\nYou'll review the details and publish on the next screen.`,
                                    confirmLabel: "Continue",
                                    variant: "default",
                                    onConfirm: () => setPublishing(s),
                                  })
                                }
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.78rem",
                                  whiteSpace: "nowrap",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                title="Create & publish a real market from this suggestion"
                              >
                                <Plus size={14} /> Create Market
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: "Remove from orbit",
                                    message: `Remove "${s.title}" from the orbit?\n\nUsers will no longer see or vote on it.`,
                                    confirmLabel: "Remove",
                                    variant: "danger",
                                    onConfirm: () => handleReview(s, false),
                                  })
                                }
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.78rem",
                                  color: "hsl(var(--destructive))",
                                  whiteSpace: "nowrap",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                className="secondary"
                                title="Remove from the orbit"
                              >
                                <X size={14} /> Remove
                              </button>
                            </>
                          )}
                          {(s.status === "created" ||
                            s.status === "rejected") && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              {s.status === "created" ? "Published ✓" : "—"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
          loading={confirmBusy}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

export default MarketSuggestions
