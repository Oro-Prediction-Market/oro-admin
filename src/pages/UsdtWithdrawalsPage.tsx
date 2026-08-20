import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface PendingWithdrawal {
  id: string
  userId: string
  network: string
  amountUsdt: string
  createdAt: string
  needsManualReview: boolean
  destinationAddress: string | null
  destinationLabel: string | null
  /** When 21Pay will accept a payout to this destination. */
  destinationUsableAt: string | null
}

/**
 * USDT withdrawal approvals.
 *
 * Every row here is money already debited from someone's balance and not yet
 * sent. Until this queue is worked, a user who withdrew sees their balance
 * drop and nothing arrive.
 */
export default function UsdtWithdrawalsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [rows, setRows] = useState<PendingWithdrawal[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRows((await api.getPendingWithdrawals(50)) ?? [])
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

  // Cooldowns expire while the page is open, and the button state is computed
  // from the clock. Without a tick, a reviewer waiting for a destination to
  // clear sits in front of a permanently disabled button.
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  async function decide(row: PendingWithdrawal, kind: "approve" | "reject") {
    const reason = (reasons[row.id] ?? "").trim()
    if (kind === "reject" && !reason) {
      setNotice(
        "A rejection reason is required — the user is refunded and told why."
      )
      return
    }
    setBusyId(row.id)
    setNotice(null)
    try {
      if (kind === "approve") {
        await api.approveWithdrawal(row.id)
        setNotice(`Approved — submitted to 21 Pay for ${row.amountUsdt} USDT.`)
      } else {
        await api.rejectWithdrawal(row.id, reason)
        setNotice(
          "Rejected — the amount has been returned to the user's balance."
        )
      }
      await refresh()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  const total = rows.reduce((s, r) => s + Number(r.amountUsdt || 0), 0)

  return (
    <div
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ArrowUpRight size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          USDT withdrawals
        </h1>
        <button onClick={() => void refresh()} style={ghostButton}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          opacity: 0.75,
          maxWidth: 760,
          lineHeight: 1.6,
        }}
      >
        Each of these was debited when the user requested it and has not been
        sent. Approving submits the payout to 21&nbsp;Pay; rejecting returns the
        amount to their balance.
      </p>

      {loadError && (
        <div style={errorBox}>
          <ShieldAlert size={16} />
          <span>{loadError}</span>
        </div>
      )}
      {notice && <div style={noticeBox}>{notice}</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Stat label="Awaiting approval" value={String(rows.length)} />
        <Stat
          label="Value held"
          value={`$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
        />
      </div>

      {rows.length === 0 && !loadError && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing awaiting approval.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((row) => {
          const cooldownUntil = row.destinationUsableAt
            ? new Date(row.destinationUsableAt)
            : null
          const inCooldown =
            !!cooldownUntil && cooldownUntil.getTime() > Date.now()
          return (
            <div key={row.id} style={card}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800 }}>
                  $
                  {Number(row.amountUsdt).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </span>
                {/* Spelled out, never a chain id — a wrong-chain send cannot
                    be undone. */}
                <span style={pill}>{row.network}</span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>
                  requested {new Date(row.createdAt).toLocaleString()}
                </span>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.7 }}>
                <div>
                  To: <code style={mono}>{row.destinationAddress ?? "—"}</code>
                  {row.destinationLabel ? ` · ${row.destinationLabel}` : ""}
                </div>
                <div>
                  User: <code style={mono}>{row.userId}</code>
                </div>
              </div>

              {row.needsManualReview && (
                <div style={warnBox}>
                  <AlertTriangle size={15} />
                  <span>Flagged for manual review before approval.</span>
                </div>
              )}

              {inCooldown && (
                <div style={warnBox}>
                  <Clock size={15} />
                  <span>
                    21&nbsp;Pay holds a newly whitelisted destination for 24
                    hours. This one clears at{" "}
                    <strong>{cooldownUntil!.toLocaleString()}</strong> — until
                    then they refuse the payout, so approval is disabled. The
                    user stays debited and the request stays in this queue.
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {/* Disabled during the cooldown rather than left clickable.
                    21 Pay refuses the payout outright, so the only thing a
                    click achieves is an error — and on a screen about releasing
                    someone's money, a button that always fails invites doubt
                    about whether it half-worked. Rejecting stays available:
                    that is a decision, not a payment. */}
                <button
                  disabled={busyId === row.id || inCooldown}
                  onClick={() => void decide(row, "approve")}
                  title={
                    inCooldown
                      ? `21 Pay holds this destination until ${cooldownUntil!.toLocaleString()}`
                      : undefined
                  }
                  style={{
                    ...primaryButton,
                    opacity: busyId === row.id || inCooldown ? 0.45 : 1,
                    cursor: inCooldown ? "not-allowed" : "pointer",
                  }}
                >
                  {inCooldown
                    ? `Approvable ${formatWait(cooldownUntil!)}`
                    : "Approve & send"}
                </button>
                <button
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, "reject")}
                  style={{
                    ...dangerButton,
                    opacity: busyId === row.id ? 0.6 : 1,
                  }}
                >
                  <XCircle size={15} /> Reject
                </button>
                <input
                  value={reasons[row.id] ?? ""}
                  onChange={(e) =>
                    setReasons((r) => ({ ...r, [row.id]: e.target.value }))
                  }
                  placeholder="Rejection reason — the user reads this"
                  style={{ ...input, flex: 1, minWidth: 220 }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** "in 5h", "in 12m", "shortly" — enough to know whether to wait or come back. */
function formatWait(until: Date): string {
  const ms = until.getTime() - Date.now()
  if (ms <= 0) return "now"
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 1) return `in ${hours}h`
  const minutes = Math.max(1, Math.round(ms / 60_000))
  return `in ${minutes}m`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, padding: "10px 14px", minWidth: 150, gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.65 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800 }}>{value}</span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  border: "1px solid var(--border, #2a2a2a)",
  borderRadius: 12,
  padding: 16,
  background: "var(--card, rgba(255,255,255,0.02))",
}

const mono: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 11,
  wordBreak: "break-all",
}

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid var(--border, #2a2a2a)",
}

const input: React.CSSProperties = {
  padding: "8px 12px",
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
  fontSize: 12.5,
  lineHeight: 1.55,
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
