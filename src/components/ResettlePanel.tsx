import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Search, XCircle } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

/** Set by another panel (the settlement audit) to open this one pre-filled. */
export const RESETTLE_PREFILL_KEY = "oro:admin:resettle-prefill"

type Mode = "clawback" | "keep"

interface MarketHit {
  id: string
  title: string
  status: string
  resolvedOutcomeId?: string | null
  outcomes?: { id: string; label: string }[]
}

interface Plan {
  market: { id: string; title: string; status: string }
  from: { id: string; label: string } | null
  to: { id: string; label: string } | null
  outcomes: { id: string; label: string }[]
  blocks: string[]
  warnings: string[]
  books: {
    currency: string
    totalPool: number
    oldPaidOut: number
    oldHouse: number
    paidOut: Record<Mode, number>
    house: Record<Mode, number>
    wrongWinners: unknown[]
    newWinners: unknown[]
  }[]
  users: {
    userId: string
    username: string | null
    firstName: string | null
    currency: string
    wrongPayout: number
    newPayout: number
    balanceNow: number
    after: Record<Mode, number>
  }[]
  clawbackWouldOverdraw: string[]
  houseCost: { currency: string; clawback: number; keep: number }[]
  fingerprint: string
}

interface Correction {
  id: string
  title: string
  from: string
  to: string
  mode: Mode
  note: string
  admin: string | null
  createdAt: string
}

const MUTED = "hsl(var(--muted-foreground))"
const RED = "#f87171"
const GREEN = "#34d399"
const AMBER = "#fbbf24"

const money = (n: number, c: string) =>
  `${c === "USDT" ? "USDT" : "Nu."} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: c === "USDT" ? 6 : 2,
  })}`
const signed = (n: number, c: string) =>
  n === 0 ? "—" : `${n > 0 ? "+" : "−"}${money(Math.abs(n), c)}`
const name = (u: {
  username: string | null
  firstName: string | null
  userId: string
}) => (u.username ? `@${u.username}` : (u.firstName ?? u.userId.slice(0, 8)))

/**
 * Correct a settled market's result after it has paid out.
 *
 * Preview first: every wallet that moves, under both ways of treating the
 * people the wrong result paid. Nothing is written until Apply, and Apply
 * only writes what was previewed.
 */
export default function ResettlePanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<MarketHit[]>([])
  const [market, setMarket] = useState<MarketHit | null>(null)
  const [toOutcome, setToOutcome] = useState<string>("")
  const [plan, setPlan] = useState<Plan | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [history, setHistory] = useState<Correction[]>([])

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await api.getSettlementCorrections()) as Correction[])
    } catch {
      /* the list is secondary; the form still works */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const doPreview = useCallback(
    async (marketId: string, outcomeId: string) => {
      setErr(null)
      setDone(null)
      setPlan(null)
      setMode(null)
      try {
        setPlan(
          (await api.previewSettlementCorrection(marketId, outcomeId)) as Plan
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  )

  useEffect(() => {
    void loadHistory()
    // Opened from the settlement audit: market and the provider's result.
    let prefill: { marketId: string; title: string; outcomeId: string } | null =
      null
    try {
      const raw = sessionStorage.getItem(RESETTLE_PREFILL_KEY)
      if (raw) prefill = JSON.parse(raw)
      sessionStorage.removeItem(RESETTLE_PREFILL_KEY)
    } catch {
      /* ignore */
    }
    if (prefill) {
      setMarket({
        id: prefill.marketId,
        title: prefill.title,
        status: "settled",
      })
      setToOutcome(prefill.outcomeId)
      void doPreview(prefill.marketId, prefill.outcomeId)
    }
  }, [loadHistory, doPreview])

  const search = async () => {
    try {
      const r = (await api.getMarkets({
        status: "settled",
        search: query,
        limit: 10,
      })) as {
        data?: MarketHit[]
      }
      setHits((r.data ?? (r as unknown as MarketHit[])) || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const outcomes = plan?.outcomes ?? market?.outcomes ?? []
  const currentWinner = plan?.from?.id ?? market?.resolvedOutcomeId ?? null

  const apply = async () => {
    if (!plan || !mode || !plan.to) return
    const moved = plan.users.filter(
      (u) => u.newPayout > 0 || (mode === "clawback" && u.wrongPayout > 0)
    ).length
    const cost = plan.houseCost
      .map((h) => money(h[mode], h.currency))
      .join(" + ")
    if (
      !window.confirm(
        `Re-settle “${plan.market.title}” as ${plan.to.label}?\n\n` +
          (mode === "clawback"
            ? "The wrong side's payouts are taken back."
            : "The wrong side keeps what they were paid.") +
          `\n${moved} wallet(s) change. Cost to the house: ${cost}.\nNo one is messaged.`
      )
    )
      return
    setBusy(true)
    setErr(null)
    try {
      await api.applySettlementCorrection({
        marketId: plan.market.id,
        toOutcomeId: plan.to.id,
        mode,
        note: note.trim(),
        fingerprint: plan.fingerprint,
      })
      setDone(`Done — “${plan.market.title}” now settles as ${plan.to.label}.`)
      setPlan(null)
      setMode(null)
      setNote("")
      setMarket(null)
      setToOutcome("")
      await loadHistory()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const canApply =
    !!plan &&
    plan.blocks.length === 0 &&
    !!mode &&
    note.trim().length >= 5 &&
    !busy

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        className="glass-card"
        style={{ padding: "1rem", display: "grid", gap: 12 }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>
          Re-settle a market on the right result
        </h3>

        {!market ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="Search settled markets by title"
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
            {hits.map((m) => (
              <button
                key={m.id}
                className="secondary"
                style={{ textAlign: "left" }}
                onClick={() => {
                  setMarket(m)
                  setHits([])
                  setToOutcome("")
                  setPlan(null)
                }}
              >
                {m.title}
              </button>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <b>{market.title}</b>
            <button
              className="secondary"
              onClick={() => {
                setMarket(null)
                setPlan(null)
                setToOutcome("")
              }}
            >
              Change
            </button>
          </div>
        )}

        {market && outcomes.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: "0.9rem",
            }}
          >
            <span style={{ color: MUTED }}>Correct result:</span>
            {outcomes.map((o) => (
              <label
                key={o.id}
                style={{ display: "flex", gap: 6, alignItems: "center" }}
              >
                <input
                  type="radio"
                  checked={toOutcome === o.id}
                  disabled={o.id === currentWinner}
                  onChange={() => {
                    setToOutcome(o.id)
                    void doPreview(market.id, o.id)
                  }}
                />
                {o.label}
                {o.id === currentWinner && (
                  <span style={{ color: MUTED }}>(settled as)</span>
                )}
              </label>
            ))}
          </div>
        )}

        {err && <div style={{ color: RED, fontSize: "0.85rem" }}>{err}</div>}
        {done && (
          <div style={{ color: GREEN, fontSize: "0.85rem" }}>{done}</div>
        )}

        {plan && (
          <div style={{ display: "grid", gap: 12 }}>
            {plan.blocks.length > 0 && (
              <div
                style={{
                  color: RED,
                  fontSize: "0.85rem",
                  display: "grid",
                  gap: 4,
                }}
              >
                <b style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <XCircle size={14} /> This one can't be corrected here:
                </b>
                {plan.blocks.map((b) => (
                  <div key={b}>• {b}</div>
                ))}
              </div>
            )}

            {plan.blocks.length === 0 && plan.from && plan.to && (
              <>
                <div style={{ fontSize: "0.9rem" }}>
                  Settled as <b>{plan.from.label}</b> → correct to{" "}
                  <b>{plan.to.label}</b>
                </div>

                <div style={{ display: "grid", gap: 6, fontSize: "0.9rem" }}>
                  <span style={{ color: MUTED }}>
                    The people the wrong result paid:
                  </span>
                  <label
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "flex-start",
                      opacity: plan.clawbackWouldOverdraw.length ? 0.5 : 1,
                    }}
                  >
                    <input
                      type="radio"
                      checked={mode === "clawback"}
                      disabled={plan.clawbackWouldOverdraw.length > 0}
                      onChange={() => setMode("clawback")}
                    />
                    <span>
                      <b>Take it back</b> — costs the house{" "}
                      {plan.houseCost
                        .map((h) => money(h.clawback, h.currency))
                        .join(" + ")}
                      {plan.clawbackWouldOverdraw.length > 0 && (
                        <span style={{ color: RED }}>
                          {" "}
                          — not possible: it would overdraw{" "}
                          {plan.clawbackWouldOverdraw.join(", ")}
                        </span>
                      )}
                    </span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "flex-start",
                    }}
                  >
                    <input
                      type="radio"
                      checked={mode === "keep"}
                      onChange={() => setMode("keep")}
                    />
                    <span>
                      <b>Let them keep it</b> — costs the house{" "}
                      {plan.houseCost
                        .map((h) => money(h.keep, h.currency))
                        .join(" + ")}
                    </span>
                  </label>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: "0.85rem" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>User</th>
                        <th style={{ textAlign: "left" }}>Side</th>
                        <th style={{ textAlign: "right" }}>Change</th>
                        <th style={{ textAlign: "right" }}>Balance now</th>
                        <th style={{ textAlign: "right" }}>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.users.map((u) => {
                        const m: Mode = mode ?? "keep"
                        const change =
                          u.newPayout - (m === "clawback" ? u.wrongPayout : 0)
                        return (
                          <tr key={`${u.userId}|${u.currency}`}>
                            <td>{name(u)}</td>
                            <td style={{ color: MUTED }}>
                              {u.newPayout > 0
                                ? `backed ${plan.to!.label}`
                                : `paid on ${plan.from!.label}`}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                color:
                                  change > 0 ? GREEN : change < 0 ? RED : MUTED,
                              }}
                            >
                              {signed(change, u.currency)}
                            </td>
                            <td style={{ textAlign: "right", color: MUTED }}>
                              {money(u.balanceNow, u.currency)}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                color: u.after[m] < 0 ? RED : undefined,
                              }}
                            >
                              {money(u.after[m], u.currency)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!mode && (
                    <div
                      style={{ color: MUTED, fontSize: "0.8rem", marginTop: 4 }}
                    >
                      Showing “let them keep it” until you choose.
                    </div>
                  )}
                </div>

                {plan.warnings.map((w) => (
                  <div
                    key={w}
                    style={{
                      color: AMBER,
                      fontSize: "0.8rem",
                      display: "flex",
                      gap: 6,
                      alignItems: "flex-start",
                    }}
                  >
                    <AlertTriangle
                      size={13}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />{" "}
                    {w}
                  </div>
                ))}

                <textarea
                  placeholder="Why — the real result and where you confirmed it. Kept with the correction; no user sees it."
                  rows={2}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div>
                  <button disabled={!canApply} onClick={() => void apply()}>
                    {busy ? "Applying…" : "Apply correction"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
          Past corrections
        </h3>
        {history.length === 0 ? (
          <div style={{ color: MUTED, fontSize: "0.85rem" }}>None yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>When</th>
                  <th style={{ textAlign: "left" }}>Market</th>
                  <th style={{ textAlign: "left" }}>Result</th>
                  <th style={{ textAlign: "left" }}>Wrong side</th>
                  <th style={{ textAlign: "left" }}>Why</th>
                  <th style={{ textAlign: "left" }}>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.createdAt).toLocaleString()}</td>
                    <td>{c.title}</td>
                    <td>
                      {c.from} → <b>{c.to}</b>
                    </td>
                    <td>{c.mode === "clawback" ? "taken back" : "kept"}</td>
                    <td style={{ color: MUTED }}>{c.note}</td>
                    <td style={{ color: MUTED }}>{c.admin ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
