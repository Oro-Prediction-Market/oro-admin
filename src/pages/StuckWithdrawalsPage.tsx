import { Fragment, useCallback, useEffect, useState } from "react"
import { AlertTriangle, Hourglass, RefreshCw } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { UserDossier } from "../components/UserDossier"

interface Processing {
  id: string
  userId: string
  username: string | null
  firstName: string | null
  amount: number
  held: number
  refundRows: number
  createdAt: string
  ageHours: number
  reason: string | null
  dkStatus: string | null
  lastCheck: { at: string; status: string | null; error: string | null } | null
  noHandle: boolean
  accountLast4: string | null
}

interface Failed {
  id: string
  userId: string
  username: string | null
  firstName: string | null
  amount: number
  createdAt: string
  closedAt: string | null
  reason: string | null
  uncertain: boolean
  manual: { verdict: string; note: string; at: string } | null
}

interface Attention {
  processing: Processing[]
  failed: Failed[]
  totals: {
    processingCount: number
    processingHeld: number
    uncertainFailures: number
  }
}

const MUTED = "hsl(var(--muted-foreground))"
const RED = "#f87171"
const AMBER = "#fbbf24"
const GREEN = "#34d399"

const nu = (n: number) =>
  `Nu. ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
const age = (h: number) =>
  h < 24 ? `${Math.round(h)}h` : `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`
const who = (r: {
  username: string | null
  firstName: string | null
  userId: string
}) => (r.username ? `@${r.username}` : (r.firstName ?? r.userId.slice(0, 8)))

/**
 * DK withdrawals where the user's money has left their wallet and DK has not
 * said whether it arrived. The reconciler finishes most of these by itself;
 * what is left here needs someone to check DK's statement and close it.
 */
export default function StuckWithdrawalsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<Attention | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [dossier, setDossier] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData((await api.getWithdrawalAttention()) as Attention)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const userLink = (r: {
    username: string | null
    firstName: string | null
    userId: string
  }) => (
    <button
      onClick={() => setDossier(r.userId)}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        color: "inherit",
        cursor: "pointer",
        textDecoration: "underline",
      }}
    >
      {who(r)}
    </button>
  )

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Hourglass size={22} /> Stuck Withdrawals
          </h2>
          <p style={{ margin: "6px 0 0", color: MUTED, fontSize: "0.875rem" }}>
            DK withdrawals holding a user's money with no answer from DK. Check
            each against DK's statement, then close it.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => void load()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {err && <div style={{ color: RED, marginBottom: 12 }}>{err}</div>}

      {data && (
        <div
          className="glass-card"
          style={{ padding: "1rem", marginBottom: 20 }}
        >
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
            Waiting on DK{" "}
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: data.processing.length ? AMBER : GREEN,
              }}
            >
              {data.processing.length
                ? `${data.processing.length} withdrawal${data.processing.length > 1 ? "s" : ""} · ${nu(data.totals.processingHeld)} held`
                : "none — every withdrawal has an answer"}
            </span>
          </h3>

          {data.processing.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>User</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "left" }}>Waiting</th>
                    <th style={{ textAlign: "left" }}>What DK said</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.processing.map((p) => (
                    <Fragment key={p.id}>
                      <tr>
                        <td>
                          {userLink(p)}
                          {p.accountLast4 && (
                            <div style={{ color: MUTED, fontSize: "0.75rem" }}>
                              to account …{p.accountLast4}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {nu(p.amount)}
                          {Math.abs(p.held - p.amount) > 0.005 && (
                            <div style={{ color: RED, fontSize: "0.75rem" }}>
                              held {nu(p.held)}
                            </div>
                          )}
                        </td>
                        <td
                          style={{ color: p.ageHours > 24 ? RED : undefined }}
                        >
                          {age(p.ageHours)}
                          <div style={{ color: MUTED, fontSize: "0.75rem" }}>
                            since {when(p.createdAt)}
                          </div>
                        </td>
                        <td>
                          {p.noHandle ? (
                            <span style={{ color: AMBER }}>
                              DK gave no reference — cannot be checked
                              automatically
                            </span>
                          ) : (
                            <>
                              {p.reason ?? p.dkStatus ?? "—"}
                              {p.lastCheck && (
                                <div
                                  style={{ color: MUTED, fontSize: "0.75rem" }}
                                >
                                  last asked {when(p.lastCheck.at)}:{" "}
                                  {p.lastCheck.error ??
                                    p.lastCheck.status ??
                                    "no answer"}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="secondary"
                            onClick={() => setOpen(open === p.id ? null : p.id)}
                          >
                            {open === p.id ? "Cancel" : "Close…"}
                          </button>
                        </td>
                      </tr>
                      {open === p.id && (
                        <tr>
                          <td colSpan={5}>
                            <CloseForm
                              row={p}
                              onDone={async () => {
                                setOpen(null)
                                await load()
                              }}
                              resolve={api.resolveWithdrawal}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>
            Failed in the last 30 days{" "}
            {data.totals.uncertainFailures > 0 && (
              <span
                style={{ fontSize: "0.85rem", fontWeight: 600, color: AMBER }}
              >
                {data.totals.uncertainFailures} worth checking
              </span>
            )}
          </h3>
          <p
            style={{ margin: "0 0 0.75rem", color: MUTED, fontSize: "0.8rem" }}
          >
            Each was refunded to the user. Those marked “check statement” failed
            with a message that does not actually say the transfer failed — DK
            has paid some of these anyway. If it is on DK's statement, the user
            was paid twice; correct it from the user's wallet.
          </p>
          {data.failed.length === 0 ? (
            <div style={{ color: MUTED, fontSize: "0.85rem" }}>None.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>User</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th style={{ textAlign: "left" }}>When</th>
                    <th style={{ textAlign: "left" }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failed.map((f) => (
                    <tr key={f.id}>
                      <td>{userLink(f)}</td>
                      <td style={{ textAlign: "right" }}>{nu(f.amount)}</td>
                      <td>{when(f.createdAt)}</td>
                      <td>
                        {f.uncertain && (
                          <span
                            style={{
                              color: AMBER,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              marginRight: 6,
                            }}
                          >
                            <AlertTriangle size={13} /> check statement
                          </span>
                        )}
                        {f.reason ?? "—"}
                        {f.manual && (
                          <div style={{ color: MUTED, fontSize: "0.75rem" }}>
                            closed by hand {when(f.manual.at)}: {f.manual.note}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {dossier && (
        <UserDossier
          key={dossier}
          userId={dossier}
          onClose={() => setDossier(null)}
        />
      )}
    </div>
  )
}

function CloseForm({
  row,
  resolve,
  onDone,
}: {
  row: Processing
  resolve: (
    id: string,
    body: { verdict: "sent" | "not_sent"; note: string; notifyUser: boolean }
  ) => Promise<unknown>
  onDone: () => Promise<void>
}) {
  const [verdict, setVerdict] = useState<"sent" | "not_sent" | null>(null)
  const [note, setNote] = useState("")
  const [notifyUser, setNotifyUser] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ready = !!verdict && note.trim().length >= 5 && !busy

  const submit = async () => {
    if (!verdict) return
    const what =
      verdict === "sent"
        ? `Mark ${nu(row.amount)} to ${who(row)} as SENT?\n\nThe money stays out of their wallet.`
        : `Mark ${nu(row.amount)} to ${who(row)} as NOT SENT?\n\n${nu(row.amount)} goes back into their wallet now.`
    if (!window.confirm(what)) return
    setBusy(true)
    setErr(null)
    try {
      await resolve(row.id, { verdict, note: note.trim(), notifyUser })
      await onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        padding: "0.75rem",
        borderRadius: 8,
        background: "hsl(var(--muted) / 0.3)",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          fontSize: "0.9rem",
        }}
      >
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            checked={verdict === "sent"}
            onChange={() => setVerdict("sent")}
          />
          On DK's statement — it reached them
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            checked={verdict === "not_sent"}
            onChange={() => setVerdict("not_sent")}
          />
          Not on DK's statement — return {nu(row.amount)} to their wallet
        </label>
      </div>
      <textarea
        placeholder="What you checked, e.g. “Not on DK statement 20–24 Sep”. Kept in the audit log; the user never sees it."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        style={{ width: "100%" }}
      />
      <label
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          fontSize: "0.85rem",
          color: MUTED,
        }}
      >
        <input
          type="checkbox"
          checked={notifyUser}
          onChange={(e) => setNotifyUser(e.target.checked)}
        />
        Send the user the usual in-app withdrawal message
      </label>
      {row.refundRows > 0 && (
        <div style={{ color: RED, fontSize: "0.85rem" }}>
          This withdrawal already has a refund in the ledger. Check the user
          before returning money again.
        </div>
      )}
      {err && <div style={{ color: RED, fontSize: "0.85rem" }}>{err}</div>}
      <div>
        <button onClick={() => void submit()} disabled={!ready}>
          {busy ? "Saving…" : "Close withdrawal"}
        </button>
      </div>
    </div>
  )
}
