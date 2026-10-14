import React, { useEffect, useState } from "react"
import { Trophy, Undo2, Users } from "lucide-react"
import { UserDossier } from "./UserDossier"

interface Person {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
}

interface Backer extends Person {
  stake: string
  bets: number
  bonusFunded: boolean
}

interface OutcomeBackers {
  outcomeId: string
  label: string
  isWinner: boolean
  currency: string
  people: number
  totalStake: string
  backers: Backer[]
}

interface Winner extends Person {
  outcomeId: string
  outcomeLabel: string
  currency: string
  stake: string
  payout: string
  streakBonus: string
  totalPaid: string
}

interface Refund extends Person {
  outcomeId: string
  outcomeLabel: string
  currency: string
  refunded: string
}

export interface MarketParticipantsData {
  marketId: string
  status: string
  outcomes: OutcomeBackers[]
  winners: Winner[]
  refunds: Refund[]
  totals: Record<string, { paidOut: string; refunded: string }>
}

interface Props {
  marketId: string
  fetchParticipants: (id: string) => Promise<MarketParticipantsData>
}

/** Rows shown per list before "Show all". */
const PREVIEW_ROWS = 20

const money = (amount: string | number, currency: string) =>
  `${currency === "USDT" ? "$" : "Nu "}${Number(amount || 0).toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}`

/** "@alice", else the full name, else a shortened id. Never blank. */
function personName(p: Person): string {
  if (p.username) return `@${p.username}`
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ")
  return full || `${p.userId.slice(0, 8)}…`
}

const muted = "hsl(var(--muted-foreground))"
const mono: React.CSSProperties = {
  fontFamily: "monospace",
  fontWeight: 600,
  color: "hsl(var(--foreground))",
}
const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  margin: "1.25rem 0 0.75rem",
  fontSize: "0.875rem",
  fontWeight: 500,
}
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.75rem",
  padding: "0.35rem 0.5rem",
  fontSize: "0.8rem",
  borderTop: "1px solid hsl(var(--border) / 0.5)",
}

/**
 * Who bet on each option of one market and how much, and — once it is
 * settled — who won and what they were paid. Mounted inside the market's
 * expanded row, so it loads only when an admin opens it.
 */
export const MarketParticipants: React.FC<Props> = ({
  marketId,
  fetchParticipants,
}) => {
  const [data, setData] = useState<MarketParticipantsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dossierUserId, setDossierUserId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Mounted per expanded row, so state starts empty for each market.
    let cancelled = false
    fetchParticipants(marketId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load")
      })
    return () => {
      cancelled = true
    }
  }, [fetchParticipants, marketId])

  const showAll = (key: string) => setExpanded((prev) => new Set(prev).add(key))

  const nameButton = (p: Person) => (
    <button
      type="button"
      onClick={() => setDossierUserId(p.userId)}
      title="Open this user's dossier"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "hsl(var(--foreground))",
        font: "inherit",
        textAlign: "left",
      }}
    >
      {personName(p)}
    </button>
  )

  const more = (key: string, total: number) =>
    total > PREVIEW_ROWS &&
    !expanded.has(key) && (
      <button
        type="button"
        onClick={() => showAll(key)}
        style={{
          background: "none",
          border: "none",
          padding: "0.35rem 0.5rem",
          cursor: "pointer",
          color: "hsl(var(--primary))",
          fontSize: "0.75rem",
        }}
      >
        Show all {total.toLocaleString()}
      </button>
    )

  const visible = <T,>(key: string, list: T[]) =>
    expanded.has(key) ? list : list.slice(0, PREVIEW_ROWS)

  if (error) {
    return (
      <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: muted }}>
        Couldn't load who bet: {error}
      </div>
    )
  }
  if (!data) {
    return (
      <div style={{ marginTop: "1rem", fontSize: "0.8rem", color: muted }}>
        Loading who bet…
      </div>
    )
  }

  const anyBets = data.outcomes.some((o) => o.backers.length > 0)

  return (
    <div>
      <div style={sectionTitle}>
        <Users size={16} />
        <span>Who bet</span>
      </div>

      {!anyBets ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          No bets recorded on this market.
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {data.outcomes.map((o) => {
            const key = `o:${o.outcomeId}:${o.currency}`
            return (
              <div
                key={key}
                style={{
                  borderRadius: "0.375rem",
                  background: o.isWinner
                    ? "hsl(var(--primary) / 0.1)"
                    : "hsl(var(--muted) / 0.3)",
                  border: o.isWinner
                    ? "1px solid hsl(var(--primary))"
                    : "1px solid transparent",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                  }}
                >
                  <span>
                    {o.label}
                    {o.isWinner && " ✓"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: muted }}>
                    {o.people === 0
                      ? "nobody"
                      : `${o.people.toLocaleString()} ${o.people === 1 ? "person" : "people"} · `}
                    {o.people > 0 && (
                      <span style={mono}>
                        {money(o.totalStake, o.currency)}
                      </span>
                    )}
                  </span>
                </div>
                {visible(key, o.backers).map((b) => (
                  <div key={b.userId} style={row}>
                    <span>
                      {nameButton(b)}
                      {b.bonusFunded && (
                        <span
                          style={{ marginLeft: 6, color: muted }}
                          title="Placed with bonus credit"
                        >
                          · bonus
                        </span>
                      )}
                    </span>
                    <span style={{ color: muted, whiteSpace: "nowrap" }}>
                      <span style={mono}>{money(b.stake, o.currency)}</span>
                      {b.bets > 1 && ` (${b.bets} bets)`}
                    </span>
                  </div>
                ))}
                {more(key, o.backers.length)}
              </div>
            )
          })}
        </div>
      )}

      {data.winners.length > 0 && (
        <>
          <div style={sectionTitle}>
            <Trophy size={16} />
            <span>Winners</span>
            <span
              style={{ marginLeft: "auto", fontSize: "0.8rem", color: muted }}
            >
              {data.winners.length.toLocaleString()}{" "}
              {data.winners.length === 1 ? "person" : "people"} · paid{" "}
              {Object.entries(data.totals)
                .filter(([, t]) => Number(t.paidOut) > 0)
                .map(([c, t], i) => (
                  <React.Fragment key={c}>
                    {i > 0 && " + "}
                    <span style={mono}>{money(t.paidOut, c)}</span>
                  </React.Fragment>
                ))}
            </span>
          </div>
          <div
            style={{
              borderRadius: "0.375rem",
              background: "hsl(var(--muted) / 0.3)",
              overflow: "hidden",
            }}
          >
            {visible("winners", data.winners).map((w) => (
              <div key={`${w.userId}:${w.outcomeId}:${w.currency}`} style={row}>
                <span>
                  {nameButton(w)}
                  <span style={{ color: muted }}> · {w.outcomeLabel}</span>
                </span>
                <span style={{ color: muted, whiteSpace: "nowrap" }}>
                  staked {money(w.stake, w.currency)} → paid{" "}
                  <span style={mono}>{money(w.totalPaid, w.currency)}</span>
                  {Number(w.streakBonus) > 0 &&
                    ` (incl. ${money(w.streakBonus, w.currency)} streak bonus)`}
                </span>
              </div>
            ))}
            {more("winners", data.winners.length)}
          </div>
        </>
      )}

      {data.refunds.length > 0 && (
        <>
          <div style={sectionTitle}>
            <Undo2 size={16} />
            <span>Refunded</span>
            <span
              style={{ marginLeft: "auto", fontSize: "0.8rem", color: muted }}
            >
              {data.refunds.length.toLocaleString()}{" "}
              {data.refunds.length === 1 ? "refund" : "refunds"}
            </span>
          </div>
          <div
            style={{
              borderRadius: "0.375rem",
              background: "hsl(var(--muted) / 0.3)",
              overflow: "hidden",
            }}
          >
            {visible("refunds", data.refunds).map((r) => (
              <div key={`${r.userId}:${r.outcomeId}:${r.currency}`} style={row}>
                <span>
                  {nameButton(r)}
                  <span style={{ color: muted }}> · {r.outcomeLabel}</span>
                </span>
                <span style={mono}>{money(r.refunded, r.currency)}</span>
              </div>
            ))}
            {more("refunds", data.refunds.length)}
          </div>
        </>
      )}

      <UserDossier
        key={dossierUserId}
        userId={dossierUserId}
        onClose={() => setDossierUserId(null)}
      />
    </div>
  )
}
