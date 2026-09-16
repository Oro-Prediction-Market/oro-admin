import { useCallback, useEffect, useRef, useState } from "react"
import { Megaphone, Send, Undo2 } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { useToast } from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"

/**
 * Compose a notice and send it to every user — a bell notification each, plus a
 * Telegram DM to everyone reachable.
 *
 * This is the only screen in the dashboard whose button cannot be undone. The
 * DMs land within about ninety seconds and nothing can recall them; only the
 * in-app half can be retracted afterwards. The UI is built around that: a
 * preview of the real message, a confirmation naming the actual recipient
 * count, and progress you can watch rather than a spinner that ends in silence.
 */

const TITLE_MAX = 120
const BODY_MAX = 3_500
const PAGE_SIZE = 20
/** Delivery drains at ~25/s, so this is fast enough to feel live and cheap enough to leave running. */
const PROGRESS_POLL_MS = 2_000

type Announcement = {
  id: string
  title: string
  body: string
  mode: "live" | "test"
  status: string
  audienceCount: number
  telegramRecipients: number
  enqueuedCount: number
  sentCount: number
  blockedCount: number
  failedCount: number
  etaSeconds?: number
  error: string | null
  createdAt: string
  finishedAt: string | null
}

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  queued: { text: "Queued", color: "hsl(var(--muted-foreground))" },
  sending: { text: "Sending", color: "hsl(var(--primary))" },
  completed: { text: "Delivered", color: "#22c55e" },
  completed_with_failures: { text: "Delivered, some failed", color: "#f59e0b" },
  failed: { text: "Failed", color: "hsl(var(--destructive))" },
  blocked: { text: "Blocked by guard", color: "hsl(var(--destructive))" },
}

export default function AnnouncementsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()

  const [view, setView] = useState<"compose" | "history">("compose")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [active, setActive] = useState<Announcement | null>(null)

  /**
   * Minted when the form opens, NOT when Send is pressed. One opened form is one
   * announcement however many times the button is clicked or a timed-out request
   * is retried — the backend rejects a repeat of this id.
   */
  const requestIdRef = useRef(newRequestId())

  const [rows, setRows] = useState<Announcement[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [fetching, setFetching] = useState(false)

  const loadHistory = useCallback(() => {
    setFetching(true)
    api
      .listAnnouncements({ page, limit: PAGE_SIZE })
      .then((res) => {
        const r = res as { data: Announcement[]; total: number; pages: number }
        setRows(r.data ?? [])
        setTotal(r.total ?? 0)
        setPages(r.pages ?? 1)
      })
      .catch((e) => notify("error", `Could not load history: ${e.message}`))
      .finally(() => setFetching(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    if (view === "history") loadHistory()
  }, [view, loadHistory])

  // Watch a send in flight. Stops as soon as it is no longer sending, so a
  // finished broadcast does not keep polling in a forgotten tab.
  useEffect(() => {
    if (!active || active.status !== "sending") return
    const t = window.setInterval(() => {
      api
        .getAnnouncement(active.id)
        .then((res) => setActive(res as Announcement))
        .catch(() => {})
    }, PROGRESS_POLL_MS)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.status])

  const doSend = async (force = false) => {
    setSending(true)
    setConfirmOpen(false)
    try {
      const res = (await api.sendAnnouncement({
        title: title.trim(),
        body: body.trim(),
        clientRequestId: requestIdRef.current,
        force,
      })) as { id: string; duplicate?: boolean }

      if (res.duplicate) {
        notify("success", "Already sent — showing the original.")
      } else {
        notify(
          "success",
          "Sending. Delivery runs at about 25 messages a second."
        )
      }
      const full = (await api.getAnnouncement(res.id)) as Announcement
      setActive(full)
      setTitle("")
      setBody("")
      // A fresh form is a fresh intent.
      requestIdRef.current = newRequestId()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // The backend refuses an identical notice sent minutes ago. That is worth
      // offering past rather than burying, because the usual cause is an admin
      // who thought the first attempt had not worked.
      if (/last 10 minutes/i.test(msg)) {
        if (window.confirm(`${msg}\n\nSend it again anyway?`)) {
          await doSend(true)
          return
        }
      } else {
        notify("error", msg)
      }
    } finally {
      setSending(false)
    }
  }

  const retract = async (id: string) => {
    try {
      const res = (await api.retractAnnouncement(id)) as { removed: number }
      notify(
        "success",
        `Removed ${res.removed} in-app notifications. The Telegram DMs cannot be recalled.`
      )
      loadHistory()
    } catch (e: unknown) {
      notify("error", e instanceof Error ? e.message : String(e))
    }
  }

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending

  return (
    <div>
      <div className="page-header">
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Megaphone size={22} /> Announcements
        </h2>
        <div className="page-header-actions">
          <button
            className={view === "compose" ? "" : "secondary"}
            onClick={() => setView("compose")}
          >
            Compose
          </button>
          <button
            className={view === "history" ? "" : "secondary"}
            onClick={() => setView("history")}
          >
            History
          </button>
        </div>
      </div>

      {view === "compose" && (
        <>
          <div
            className="glass-card"
            style={{ maxWidth: 680, margin: "0 auto" }}
          >
            <h3>New announcement</h3>
            <p
              style={{
                fontSize: "0.8rem",
                color: "hsl(var(--muted-foreground))",
                marginBottom: "1.25rem",
              }}
            >
              Goes to every user as a notification, and as a Telegram DM to
              everyone we can reach. It cannot be unsent.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                TITLE
              </label>
              <input
                className="input-field"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's new in this update"
              />
              <Counter n={title.length} max={TITLE_MAX} />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                MESSAGE
              </label>
              <textarea
                className="input-field"
                value={body}
                maxLength={BODY_MAX}
                onChange={(e) => setBody(e.target.value)}
                style={{ minHeight: 180, resize: "vertical" }}
                placeholder={
                  "Plain text. Line breaks are kept.\n\nHTML tags are not formatting here — they are shown as typed."
                }
              />
              <Counter n={body.length} max={BODY_MAX} />
            </div>

            {(title || body) && (
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "0.75rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  PREVIEW
                </label>
                {/* Plain text nodes, never dangerouslySetInnerHTML — matching
                    the rule the comments page states explicitly. The backend
                    escapes the body before sending, so what shows here is what
                    arrives. */}
                <div
                  style={{
                    border: "1px solid hsla(var(--foreground), 0.12)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    background: "hsla(var(--background), 0.5)",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {title || "Untitled"}
                  </div>
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: "0.9rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {body}
                  </div>
                </div>
              </div>
            )}

            <button
              disabled={!canSend}
              onClick={() => setConfirmOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Send size={16} />
              {sending ? "Sending…" : "Send to everyone"}
            </button>
          </div>

          {active && <Progress a={active} />}
        </>
      )}

      {view === "history" && (
        <HistoryTable
          rows={rows}
          fetching={fetching}
          page={page}
          pages={pages}
          total={total}
          onPage={setPage}
          onRetract={retract}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          title="Send to every user?"
          message={
            `"${title.trim()}"\n\n` +
            "Every user gets a notification, and everyone reachable gets a Telegram DM.\n\n" +
            "This cannot be undone. The in-app notifications can be removed afterwards; the DMs cannot."
          }
          confirmLabel="Send it"
          variant="danger"
          loading={sending}
          onConfirm={() => doSend(false)}
          onClose={() => setConfirmOpen(false)}
        />
      )}

      {ToastContainer}
    </div>
  )
}

function Counter({ n, max }: { n: number; max: number }) {
  const near = n > max * 0.9
  return (
    <div
      style={{
        textAlign: "right",
        fontSize: "0.7rem",
        marginTop: 4,
        color: near
          ? "hsl(var(--destructive))"
          : "hsl(var(--muted-foreground))",
      }}
    >
      {n} / {max}
    </div>
  )
}

/**
 * Live delivery.
 *
 * Blocked is shown apart from failed on purpose: five to twenty percent of
 * recipients have blocked the bot or never pressed Start, and that is the
 * feature working rather than breaking. Lumping them together would make every
 * healthy broadcast look broken.
 */
function Progress({ a }: { a: Announcement }) {
  const done = a.sentCount + a.blockedCount + a.failedCount
  const pct = a.enqueuedCount ? Math.round((done / a.enqueuedCount) * 100) : 100
  const label = STATUS_LABEL[a.status] ?? { text: a.status, color: "inherit" }

  return (
    <div
      className="glass-card"
      style={{ maxWidth: 680, margin: "1.25rem auto 0" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0 }}>{a.title}</h3>
        <span
          style={{ color: label.color, fontWeight: 600, fontSize: "0.85rem" }}
        >
          {label.text}
          {a.mode === "test" && " (test)"}
        </span>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "hsla(var(--foreground), 0.1)",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "hsl(var(--primary))",
            transition: "width 400ms ease",
          }}
        />
      </div>

      <div className="stat-grid">
        <Stat label="In-app" value={a.audienceCount} />
        <Stat label="DMs queued" value={a.enqueuedCount} />
        <Stat label="Delivered" value={a.sentCount} />
        <Stat
          label="Unreachable"
          value={a.blockedCount}
          hint="Blocked the bot or never started it"
        />
        {a.failedCount > 0 && (
          <Stat label="Failed" value={a.failedCount} danger />
        )}
      </div>

      {a.status === "sending" && a.etaSeconds != null && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
            marginTop: 12,
          }}
        >
          About {a.etaSeconds}s remaining. You can leave this page — delivery
          continues, and a summary is sent to your Telegram when it finishes.
        </p>
      )}
      {a.error && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "hsl(var(--destructive))",
            marginTop: 12,
          }}
        >
          {a.error}
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  danger,
}: {
  label: string
  value: number
  hint?: string
  danger?: boolean
}) {
  return (
    <div className="stat-card" title={hint}>
      <div
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          color: danger ? "hsl(var(--destructive))" : undefined,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground))" }}
      >
        {label}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: "0.7rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "hsl(var(--muted-foreground))",
  whiteSpace: "nowrap",
}
const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderTop: "1px solid hsla(var(--foreground), 0.06)",
  verticalAlign: "top",
}

function HistoryTable({
  rows,
  fetching,
  page,
  pages,
  total,
  onPage,
  onRetract,
}: {
  rows: Announcement[]
  fetching: boolean
  page: number
  pages: number
  total: number
  onPage: (p: number) => void
  onRetract: (id: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <>
      <div
        className="glass-card"
        style={{
          position: "relative",
          pointerEvents: fetching ? "none" : "auto",
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 900,
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid hsla(var(--foreground), 0.1)",
                  backgroundColor: "hsla(var(--background), 0.5)",
                }}
              >
                <th style={thStyle}>Sent</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>In-app</th>
                <th style={thStyle}>Delivered</th>
                <th style={thStyle}>Unreachable</th>
                <th style={thStyle}>Failed</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "center",
                      padding: "2.5rem",
                    }}
                    colSpan={8}
                  >
                    {fetching ? "Loading…" : "Nothing sent yet."}
                  </td>
                </tr>
              )}
              {rows.map((a) => {
                const label = STATUS_LABEL[a.status] ?? {
                  text: a.status,
                  color: "inherit",
                }
                return (
                  <tr key={a.id}>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, maxWidth: 320 }}>
                      <div style={{ fontWeight: 600 }}>{a.title}</div>
                      {a.mode === "test" && (
                        <span className="badge badge-upcoming">test</span>
                      )}
                      {a.error && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "hsl(var(--destructive))",
                            marginTop: 4,
                          }}
                        >
                          {a.error}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: label.color,
                        fontWeight: 600,
                      }}
                    >
                      {label.text}
                    </td>
                    <td style={tdStyle}>{a.audienceCount.toLocaleString()}</td>
                    <td style={tdStyle}>{a.sentCount.toLocaleString()}</td>
                    <td style={tdStyle}>{a.blockedCount.toLocaleString()}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: a.failedCount
                          ? "hsl(var(--destructive))"
                          : undefined,
                      }}
                    >
                      {a.failedCount.toLocaleString()}
                    </td>
                    <td style={tdStyle}>
                      {a.audienceCount > 0 && (
                        <button
                          className="secondary"
                          onClick={() => setConfirmId(a.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Undo2 size={14} /> Retract
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE_SIZE && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginTop: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <button
            className="secondary"
            onClick={() => onPage(1)}
            disabled={page === 1 || fetching}
          >
            «
          </button>
          <button
            className="secondary"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page === 1 || fetching}
          >
            ‹ Prev
          </button>
          <span
            style={{
              alignSelf: "center",
              fontSize: "0.85rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {page} of {pages}
          </span>
          <button
            className="secondary"
            onClick={() => onPage(Math.min(pages, page + 1))}
            disabled={page >= pages || fetching}
          >
            Next ›
          </button>
          <button
            className="secondary"
            onClick={() => onPage(pages)}
            disabled={page >= pages || fetching}
          >
            »
          </button>
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title="Retract the in-app notifications?"
          message={
            "This removes the notification from everyone's bell.\n\n" +
            "The Telegram DMs have already been delivered and cannot be recalled."
          }
          confirmLabel="Retract"
          variant="danger"
          onConfirm={() => {
            onRetract(confirmId)
            setConfirmId(null)
          }}
          onClose={() => setConfirmId(null)}
        />
      )}
    </>
  )
}
