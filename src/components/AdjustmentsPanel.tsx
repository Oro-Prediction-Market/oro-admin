import { useCallback, useEffect, useState } from "react"
import { Search } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { UserDossier } from "./UserDossier"

const REASONS: Record<string, string> = {
  goodwill: "Goodwill credit",
  payout_correction: "Payout correction",
  withdrawal_return: "Withdrawal returned",
  recover_overpayment: "Recover an overpayment",
  other: "Other",
}

interface PickedUser {
  id: string
  username: string | null
  firstName: string | null
  currency: string
}

interface Preview {
  balance: number
  after: number
  defaultUserNote: string
}

interface Adjustment {
  id: string
  userId: string
  username?: string | null
  firstName?: string | null
  currency: string
  amount: number
  reasonLabel: string
  note: string
  userNote: string
  reference: string | null
  admin?: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
}

const MUTED = "hsl(var(--muted-foreground))"
const RED = "#f87171"
const GREEN = "#34d399"

const money = (n: number, c: string) =>
  `${c === "USDT" ? "USDT" : "Nu."} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: c === "USDT" ? 6 : 2,
  })}`
const name = (u: {
  username?: string | null
  firstName?: string | null
  id?: string
  userId?: string
}) =>
  u.username
    ? `@${u.username}`
    : (u.firstName ?? (u.id ?? u.userId ?? "").slice(0, 8))
const newRequestId = () => crypto.randomUUID()

/**
 * Credit or debit a wallet, with the reason on record.
 *
 * Replaces SQL typed against production. The internal reason is kept for the
 * audit trail; the customer only ever sees a history line with neutral
 * wording, and no message is sent.
 */
export default function AdjustmentsPanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [query, setQuery] = useState("")
  const [matches, setMatches] = useState<PickedUser[]>([])
  const [user, setUser] = useState<PickedUser | null>(null)
  const [currency, setCurrency] = useState("BTN")
  const [direction, setDirection] = useState<"credit" | "debit">("credit")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("goodwill")
  const [note, setNote] = useState("")
  const [userNote, setUserNote] = useState("")
  const [reference, setReference] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // One per filled-in form: a second click, a retry after a timeout, or a
  // double submit all carry the same id, and the server writes once.
  const [requestId, setRequestId] = useState(newRequestId)
  const [list, setList] = useState<{
    adjustments: Adjustment[]
    totals: {
      currency: string
      credited: number
      debited: number
      count: number
    }[]
  } | null>(null)
  const [dossier, setDossier] = useState<string | null>(null)

  const signed = () => {
    const n = Number(amount)
    return direction === "credit" ? n : -n
  }

  const loadList = useCallback(async () => {
    try {
      setList((await api.getAdjustments(user?.id)) as typeof list)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id])

  useEffect(() => {
    void loadList()
  }, [loadList])

  // Anything that changes what would be written invalidates the preview.
  useEffect(() => {
    setPreview(null)
  }, [user?.id, currency, direction, amount])

  const search = async () => {
    if (!query.trim()) return
    try {
      const r = (await api.getUsers({ search: query.trim(), limit: 8 })) as {
        data: PickedUser[]
      }
      setMatches(r.data ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const doPreview = async () => {
    if (!user) return
    setErr(null)
    setDone(null)
    try {
      setPreview(
        (await api.previewAdjustment({
          userId: user.id,
          currency,
          amount: signed(),
        })) as Preview
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const submit = async () => {
    if (!user || !preview) return
    const n = signed()
    const ok = window.confirm(
      `${n > 0 ? "Credit" : "Debit"} ${money(Math.abs(n), currency)} ${n > 0 ? "to" : "from"} ${name(user)}?\n\n` +
        `Balance ${money(preview.balance, currency)} → ${money(preview.after, currency)}\n` +
        `They will see: “${userNote.trim() || preview.defaultUserNote}”`
    )
    if (!ok) return
    setBusy(true)
    setErr(null)
    try {
      const r = (await api.createAdjustment({
        requestId,
        userId: user.id,
        currency,
        amount: n,
        reason,
        note: note.trim(),
        userNote: userNote.trim() || undefined,
        reference: reference.trim() || undefined,
      })) as Adjustment & { duplicate: boolean }
      setDone(
        r.duplicate
          ? "Already done — this form was submitted before. Nothing was added twice."
          : `Done. ${name(user)} now has ${money(r.balanceAfter, currency)}.`
      )
      setRequestId(newRequestId())
      setAmount("")
      setNote("")
      setUserNote("")
      setReference("")
      setPreview(null)
      await loadList()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const amountOk = Number(amount) > 0 && Number.isFinite(Number(amount))
  const canPreview = !!user && amountOk
  const canSubmit = !!preview && note.trim().length >= 5 && !busy

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        className="glass-card"
        style={{ padding: "1rem", display: "grid", gap: 12 }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>
          Credit or debit a wallet
        </h3>

        {!user ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Search by username, name, email or Telegram ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void search()}
                style={{ flex: 1 }}
              />
              <button
                className="secondary"
                onClick={() => void search()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Search size={14} /> Find
              </button>
            </div>
            {matches.map((m) => (
              <button
                key={m.id}
                className="secondary"
                style={{ textAlign: "left" }}
                onClick={() => {
                  setUser(m)
                  setCurrency(m.currency === "USDT" ? "USDT" : "BTN")
                  setMatches([])
                }}
              >
                {name(m)} {m.firstName && m.username ? `· ${m.firstName}` : ""}{" "}
                <span style={{ color: MUTED }}>{m.currency}</span>
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <b>{name(user)}</b>
            <button className="secondary" onClick={() => setDossier(user.id)}>
              Open user
            </button>
            <button className="secondary" onClick={() => setUser(null)}>
              Change
            </button>
          </div>
        )}

        {user && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "credit" | "debit")
                }
              >
                <option value="credit">Credit (add)</option>
                <option value="debit">Debit (take back)</option>
              </select>
              <input
                type="number"
                min="0"
                step={currency === "USDT" ? "0.000001" : "0.01"}
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: 140 }}
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="BTN">Nu (BTN)</option>
                <option value="USDT">USDT</option>
              </select>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {Object.entries(REASONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Why — what happened and what you checked. Internal: the user never sees this."
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder={`What the user sees in their history (default: “${direction === "credit" ? "Wallet credit" : "Wallet adjustment"}”)`}
                maxLength={120}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                style={{ flex: 2, minWidth: 220 }}
              />
              <input
                placeholder="Reference (payment / market id, optional)"
                maxLength={128}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
            </div>

            {preview && (
              <div style={{ fontSize: "0.9rem" }}>
                Balance <b>{money(preview.balance, currency)}</b> →{" "}
                <b style={{ color: signed() > 0 ? GREEN : RED }}>
                  {money(preview.after, currency)}
                </b>
                <span style={{ color: MUTED }}>
                  {" "}
                  · no message is sent to the user
                </span>
              </div>
            )}
            {err && (
              <div style={{ color: RED, fontSize: "0.85rem" }}>{err}</div>
            )}
            {done && (
              <div style={{ color: GREEN, fontSize: "0.85rem" }}>{done}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="secondary"
                disabled={!canPreview}
                onClick={() => void doPreview()}
              >
                Check
              </button>
              <button disabled={!canSubmit} onClick={() => void submit()}>
                {busy
                  ? "Saving…"
                  : direction === "credit"
                    ? "Credit wallet"
                    : "Debit wallet"}
              </button>
              {!preview && canPreview && (
                <span
                  style={{
                    color: MUTED,
                    fontSize: "0.8rem",
                    alignSelf: "center",
                  }}
                >
                  Check first to see the new balance.
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
          {user ? `Adjustments for ${name(user)}` : "Recent adjustments"}
        </h3>
        {list && list.totals.length > 0 && (
          <div style={{ color: MUTED, fontSize: "0.85rem", marginBottom: 8 }}>
            {list.totals.map((t) => (
              <span key={t.currency} style={{ marginRight: 16 }}>
                {t.currency}: {money(t.credited, t.currency)} credited ·{" "}
                {money(t.debited, t.currency)} taken back ({t.count})
              </span>
            ))}
          </div>
        )}
        {list && list.adjustments.length === 0 && (
          <div style={{ color: MUTED, fontSize: "0.85rem" }}>None yet.</div>
        )}
        {list && list.adjustments.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>When</th>
                  <th style={{ textAlign: "left" }}>User</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "left" }}>Why</th>
                  <th style={{ textAlign: "left" }}>User sees</th>
                  <th style={{ textAlign: "left" }}>By</th>
                </tr>
              </thead>
              <tbody>
                {list.adjustments.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>{name(a)}</td>
                    <td
                      style={{
                        textAlign: "right",
                        color: a.amount > 0 ? GREEN : RED,
                      }}
                    >
                      {a.amount > 0 ? "+" : "−"}
                      {money(Math.abs(a.amount), a.currency)}
                    </td>
                    <td>
                      <b>{a.reasonLabel}</b> — {a.note}
                      {a.reference && (
                        <div style={{ color: MUTED, fontSize: "0.75rem" }}>
                          ref {a.reference}
                        </div>
                      )}
                    </td>
                    <td style={{ color: MUTED }}>{a.userNote}</td>
                    <td style={{ color: MUTED }}>{a.admin ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
