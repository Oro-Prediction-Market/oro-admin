import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, HeartPulse, RefreshCw, XCircle } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { UserDossier } from "./UserDossier"

interface Wallet {
  userId: string
  username: string | null
  firstName: string | null
  currency: string
  balance: number
  shownBalance: number
  difference: number
  rows: number
  lastAt: string
  overdrawn: boolean
  staleHistory: boolean
}

interface Health {
  checkedAt: string
  overdrawn: number
  staleHistory: number
  wallets: Wallet[]
  truncated: boolean
}

interface Invariant {
  key: string
  assertion: string
  violations: number
}

const MUTED = "hsl(var(--muted-foreground))"
const RED = "#f87171"
const GREEN = "#34d399"
const AMBER = "#fbbf24"

const money = (n: number, currency: string) =>
  `${currency === "USDT" ? "USDT" : "Nu."} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === "USDT" ? 6 : 2,
  })}`

/**
 * Is every wallet's money where the app says it is?
 *
 * Overdrawn wallets are a money problem. "History out of step" is display
 * only: the spendable balance is right, but the running balance printed beside
 * each line of the user's history is not — the trace a database correction
 * leaves behind. Rebuilding recomputes those running figures and never
 * changes an amount.
 */
export default function LedgerHealthPanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [health, setHealth] = useState<Health | null>(null)
  const [invariants, setInvariants] = useState<Invariant[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dossier, setDossier] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [h, inv] = await Promise.all([
        api.getLedgerHealth() as Promise<Health>,
        (
          api.getSegregationInvariants() as Promise<{ results: Invariant[] }>
        ).catch(() => null),
      ])
      setHealth(h)
      setInvariants(inv?.results ?? null)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const rebuild = async (w: Wallet) => {
    const who = w.username ? `@${w.username}` : (w.firstName ?? w.userId)
    if (
      !window.confirm(
        `Rebuild the running balances in ${who}'s ${w.currency} history?\n\n` +
          `This only rewrites the balance shown beside each line. No amount ` +
          `changes and the spendable balance stays ${money(w.balance, w.currency)}.`
      )
    )
      return
    setBusy(`${w.userId}|${w.currency}`)
    try {
      await api.rebuildLedger(w.userId, w.currency)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const failing = invariants?.filter((i) => i.violations > 0) ?? []
  const allClear =
    !!health &&
    health.overdrawn === 0 &&
    health.staleHistory === 0 &&
    failing.length === 0

  return (
    <div className="glass-card" style={{ padding: "1rem", marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: "0.75rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <HeartPulse size={16} /> Ledger health
          {health && (
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: allClear
                  ? GREEN
                  : health.overdrawn || failing.length
                    ? RED
                    : AMBER,
              }}
            >
              {allClear
                ? "every wallet adds up"
                : [
                    health.overdrawn && `${health.overdrawn} overdrawn`,
                    health.staleHistory &&
                      `${health.staleHistory} history out of step`,
                    failing.length &&
                      `${failing.length} check${failing.length > 1 ? "s" : ""} failing`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
          )}
        </h3>
        <button
          className="secondary"
          onClick={() => void load()}
          disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> {loading ? "Checking…" : "Re-check"}
        </button>
      </div>

      {err && (
        <div style={{ color: RED, fontSize: "0.85rem", marginBottom: 8 }}>
          {err}
        </div>
      )}

      {invariants && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 16px",
            fontSize: "0.8rem",
            marginBottom: "0.75rem",
          }}
        >
          {invariants.map((i) => (
            <span
              key={i.key}
              title={i.assertion}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: i.violations ? RED : MUTED,
              }}
            >
              {i.violations ? (
                <XCircle size={13} />
              ) : (
                <CheckCircle2 size={13} color={GREEN} />
              )}
              {i.assertion}
              {i.violations > 0 &&
                ` (${i.violations > 10 ? "10+" : i.violations})`}
            </span>
          ))}
        </div>
      )}

      {health && health.wallets.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>User</th>
                <th style={{ textAlign: "left" }}>Problem</th>
                <th style={{ textAlign: "right" }}>Real balance</th>
                <th style={{ textAlign: "right" }}>Shown in history</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {health.wallets.map((w) => (
                <tr key={`${w.userId}|${w.currency}`}>
                  <td>
                    <button
                      className="link"
                      onClick={() => setDossier(w.userId)}
                      style={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        color: "inherit",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      {w.username
                        ? `@${w.username}`
                        : (w.firstName ?? w.userId.slice(0, 8))}
                    </button>{" "}
                    <span style={{ color: MUTED }}>{w.currency}</span>
                  </td>
                  <td style={{ color: w.overdrawn ? RED : AMBER }}>
                    {w.overdrawn ? "Overdrawn" : "History out of step"}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      color: w.balance < 0 ? RED : undefined,
                    }}
                  >
                    {money(w.balance, w.currency)}
                  </td>
                  <td style={{ textAlign: "right", color: MUTED }}>
                    {money(w.shownBalance, w.currency)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {w.staleHistory && (
                      <button
                        className="secondary"
                        disabled={busy === `${w.userId}|${w.currency}`}
                        onClick={() => void rebuild(w)}
                      >
                        {busy === `${w.userId}|${w.currency}`
                          ? "Rebuilding…"
                          : "Rebuild history"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {health.truncated && (
            <div style={{ color: MUTED, fontSize: "0.8rem", marginTop: 6 }}>
              Showing the first {health.wallets.length}; overdrawn wallets
              first.
            </div>
          )}
          {health.overdrawn > 0 && (
            <div style={{ color: MUTED, fontSize: "0.8rem", marginTop: 6 }}>
              An overdrawn wallet is not fixed by rebuilding — money left it
              that it did not hold. Open the user to see how.
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
