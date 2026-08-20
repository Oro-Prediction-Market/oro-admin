import { useCallback, useEffect, useState } from "react"
import {
  BadgeCheck,
  Clock,
  FileWarning,
  RefreshCw,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: string
  userId: string
  documentType: "passport" | "national_id" | "drivers_licence"
  documentCountry: string
  submittedAt: string
}

interface OpenedDocument {
  id: string
  userId: string
  documentType: string
  documentCountry: string
  /** Masked on the server — the full number never leaves it. */
  documentNumberMasked: string
  /** Short-lived and signed; expires in minutes. */
  imageUrl: string
  /** Other accounts holding this same document. A signal, never a verdict. */
  alsoUsedBy: { userId: string; documentId: string; status: string }[]
}

const DOC_LABEL: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_licence: "Driver's licence",
}

/**
 * The KYC review queue.
 *
 * Deposits are gated on an approved document, so until someone works this
 * queue an international user cannot fund their account at all.
 */
export default function KycReviewPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [health, setHealth] = useState<{
    depth: number
    oldestPendingAt: string | null
  } | null>(null)
  const [opened, setOpened] = useState<OpenedDocument | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [q, h] = await Promise.all([
        api.getKycQueue(50),
        api.getKycQueueHealth(),
      ])
      setQueue(q ?? [])
      setHealth(h ?? null)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function open(id: string) {
    setNotice(null)
    setRejectReason("")
    try {
      // Opening is logged as a PII access on the server, so this only ever
      // happens on a deliberate click — never to prefetch a list.
      setOpened(await api.openKycDocument(id))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    }
  }

  async function decide(kind: "approve" | "reject") {
    if (!opened) return
    if (kind === "reject" && !rejectReason.trim()) {
      setNotice("A rejection reason is required — the applicant sees it.")
      return
    }
    setBusy(true)
    try {
      if (kind === "approve") await api.approveKycDocument(opened.id)
      else await api.rejectKycDocument(opened.id, rejectReason.trim())
      setNotice(
        kind === "approve"
          ? "Approved — deposits are now open for this account."
          : "Rejected. The applicant can submit another document."
      )
      setOpened(null)
      await refresh()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const oldestAgeHours = health?.oldestPendingAt
    ? Math.floor(
        (Date.now() - new Date(health.oldestPendingAt).getTime()) / 3_600_000
      )
    : null

  return (
    <div
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BadgeCheck size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Identity verification
        </h1>
        <button onClick={() => void refresh()} style={ghostButton}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {/* A reviewer needs the reviewer role; being an admin is not enough. */}
      {loadError && (
        <div style={errorBox}>
          <ShieldAlert size={16} />
          <div>
            {loadError}
            {/reviewer role/i.test(loadError) && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                Reading identity documents is a separate permission from admin.
                Set <code>isKycReviewer</code> on your account to work this
                queue.
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Stat
          icon={<Users size={15} />}
          label="Waiting"
          value={String(health?.depth ?? queue.length)}
        />
        <Stat
          icon={<Clock size={15} />}
          label="Oldest"
          value={oldestAgeHours === null ? "—" : `${oldestAgeHours}h`}
          warn={oldestAgeHours !== null && oldestAgeHours > 24}
        />
      </div>

      {notice && <div style={noticeBox}>{notice}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) 2fr",
          gap: 20,
        }}
      >
        {/* ── Queue ── */}
        <div style={panel}>
          <h2 style={panelTitle}>Pending ({queue.length})</h2>
          {queue.length === 0 && !loadError && (
            <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
              Nothing waiting. Submissions appear here oldest first.
            </p>
          )}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {queue.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => void open(d.id)}
                  style={{
                    ...queueRow,
                    borderColor:
                      opened?.id === d.id
                        ? "#2563eb"
                        : "var(--border, #2a2a2a)",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {DOC_LABEL[d.documentType] ?? d.documentType}
                    <span style={{ opacity: 0.6 }}> · {d.documentCountry}</span>
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.65 }}>
                    {new Date(d.submittedAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Opened document ── */}
        <div style={panel}>
          {!opened ? (
            <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
              Select a submission to review it. Opening one is recorded in the
              audit log.
            </p>
          ) : (
            <>
              <h2 style={panelTitle}>
                {DOC_LABEL[opened.documentType] ?? opened.documentType} ·{" "}
                {opened.documentCountry}
              </h2>
              <p style={{ fontSize: 13, margin: 0 }}>
                Number: <strong>{opened.documentNumberMasked}</strong>
                <span style={{ opacity: 0.6 }}>
                  {" "}
                  — masked; the full number stays on the server
                </span>
              </p>

              {opened.alsoUsedBy.length > 0 && (
                <div style={warnBox}>
                  <FileWarning size={16} />
                  <div>
                    <strong>
                      This document is on {opened.alsoUsedBy.length} other
                      account{opened.alsoUsedBy.length > 1 ? "s" : ""}.
                    </strong>
                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                      A signal to look at, not a reason to reject on its own —
                      people re-register legitimately after a rejection. What it
                      does mean is that these accounts are one person.
                    </div>
                    <ul
                      style={{
                        margin: "6px 0 0",
                        paddingLeft: 18,
                        fontSize: 12,
                      }}
                    >
                      {opened.alsoUsedBy.map((o) => (
                        <li key={o.documentId}>
                          {o.userId} — {o.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <img
                src={api.kycImageUrl(opened.imageUrl)}
                alt="Identity document"
                style={{
                  width: "100%",
                  maxHeight: 460,
                  objectFit: "contain",
                  borderRadius: 10,
                  border: "1px solid var(--border, #2a2a2a)",
                  background: "#000",
                }}
              />
              <p style={{ fontSize: 11, opacity: 0.6, margin: 0 }}>
                This link expires in a few minutes. Reopen the document if the
                image stops loading.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  disabled={busy}
                  onClick={() => void decide("approve")}
                  style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}
                >
                  <BadgeCheck size={15} /> Approve
                </button>
                <button
                  disabled={busy}
                  onClick={() => void decide("reject")}
                  style={{ ...dangerButton, opacity: busy ? 0.6 : 1 }}
                >
                  <XCircle size={15} /> Reject
                </button>
              </div>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 12,
                }}
              >
                Rejection reason — the applicant reads this, so make it
                actionable
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. The photograph is too blurred to read the number"
                  maxLength={255}
                  style={input}
                />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  warn,
}: {
  icon: React.ReactNode
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div style={{ ...panel, padding: "10px 14px", minWidth: 130, gap: 2 }}>
      <span
        style={{
          fontSize: 11,
          opacity: 0.65,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon} {label}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: warn ? "#f59e0b" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  border: "1px solid var(--border, #2a2a2a)",
  borderRadius: 12,
  padding: 16,
  background: "var(--card, rgba(255,255,255,0.02))",
}

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
}

const queueRow: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border, #2a2a2a)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
}

const input: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--border, #2a2a2a)",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
}

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  borderRadius: 9,
  border: "none",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  color: "#fff",
}

const primaryButton: React.CSSProperties = {
  ...buttonBase,
  background: "#16a34a",
}
const dangerButton: React.CSSProperties = {
  ...buttonBase,
  background: "#dc2626",
}

const ghostButton: React.CSSProperties = {
  ...buttonBase,
  background: "transparent",
  border: "1px solid var(--border, #2a2a2a)",
  color: "inherit",
  marginLeft: "auto",
}

const boxBase: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1.5,
}

const errorBox: React.CSSProperties = {
  ...boxBase,
  background: "rgba(220,38,38,0.08)",
  border: "1px solid rgba(220,38,38,0.3)",
}

const warnBox: React.CSSProperties = {
  ...boxBase,
  background: "rgba(245,158,11,0.08)",
  border: "1px solid rgba(245,158,11,0.3)",
}

const noticeBox: React.CSSProperties = {
  ...boxBase,
  background: "rgba(37,99,235,0.08)",
  border: "1px solid rgba(37,99,235,0.3)",
}
