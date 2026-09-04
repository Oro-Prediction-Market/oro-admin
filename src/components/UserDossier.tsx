import React, { useEffect, useState, useRef } from "react"
import {
  X,
  Eye,
  EyeOff,
  Landmark,
  Wallet,
  TrendingUp,
  Receipt,
  ShieldAlert,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

// ── Types mirror GET /admin/users/:userId/dossier ────────────────────────────

interface Book {
  currency: string
  balance: number
  deposited: number
  withdrawn: number
  bet: number
  won: number
  bonusCredited: number
  net: number
}

interface Dossier {
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    username: string | null
    email: string | null
    phoneNumber: string | null
    telegramId: string | null
    currency: string
    kycStatus: string
    reputationTier: string
    totalPredictions: number
    isAdmin: boolean
    createdAt: string
  }
  bank: {
    accountName: string | null
    verified: boolean
    cid: string | null
    accountNumber: string | null
    masked: boolean
  }
  books: Book[]
  sources: {
    method: string
    type: string
    currency: string
    count: number
    total: number
  }[]
  usdtWithdrawals: {
    count: number
    completed: number
    inFlight: number
    pending: number
  }
  betting: {
    currency: string
    count: number
    staked: number
    avgStake: number
    largestBet: number
    won: number
    lost: number
    pending: number
    payout: number
    topCategory: string | null
  }[]
  recentTransactions: {
    id: string
    type: string
    amount: number
    currency: string
    balanceAfter: number
    note: string | null
    isBonus: boolean
    createdAt: string
  }[]
}

const METHOD_LABELS: Record<string, string> = {
  dkbank: "DK Bank",
  usdt: "USDT",
  credits: "Credits",
  ton: "TON (deprecated)",
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  bet_placed: "Bet placed",
  bet_payout: "Bet payout",
  refund: "Refund",
  free_credit: "Free credit",
  referral_bonus: "Referral bonus",
  streak_bonus: "Streak bonus",
  referral_prize: "Referral prize",
  season_prize: "Season prize",
  dispute_bond: "Dispute bond",
  duel_wager: "Duel wager",
  duel_payout: "Duel payout",
}

// Currencies never mix — each book is formatted in its own unit.
function money(n: number | null | undefined, currency: string): string {
  const v = Number(n ?? 0)
  const unit = currency === "USDT" ? "$" : "Nu "
  return `${unit}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function displayName(u: Dossier["user"]): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ")
  return full || u.username || "Anonymous"
}

function Section({
  title,
  Icon,
  children,
  action,
  boxed,
}: {
  title: string
  Icon: React.ElementType
  children: React.ReactNode
  action?: React.ReactNode
  // `boxed` draws the section as its own bordered panel. Used for the
  // side-by-side Identity/Bank pair so the two columns read as separate
  // things — a vertical rule between them would disappear once they stack
  // into one column on phones.
  boxed?: boolean
}) {
  return (
    <div
      style={{
        marginBottom: "1.5rem",
        ...(boxed
          ? {
              marginBottom: 0,
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.65rem",
              padding: "0.9rem 1rem",
              background: "hsl(var(--muted) / 0.12)",
            }
          : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          ...(boxed
            ? {
                paddingBottom: 8,
                borderBottom: "1px solid hsl(var(--border))",
              }
            : {}),
        }}
      >
        <Icon size={15} color="hsl(var(--primary))" />
        <h3 style={{ margin: 0, fontSize: "0.85rem" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "5px 0",
        fontSize: "0.8rem",
      }}
    >
      <span style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          textAlign: "right",
          fontFamily: mono ? "monospace" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// Compact figure tile. `tone` colours the number for P&L-style values.
function Tile({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: React.ReactNode
  tone?: "good" | "bad" | "plain"
  hint?: string
}) {
  const color =
    tone === "good"
      ? "#4ade80"
      : tone === "bad"
        ? "hsl(var(--destructive))"
        : "hsl(var(--foreground))"
  return (
    <div
      title={hint}
      style={{
        background: "hsl(var(--muted) / 0.2)",
        border: "1px solid hsl(var(--border))",
        borderRadius: "0.5rem",
        padding: "0.6rem 0.7rem",
      }}
    >
      <div
        style={{
          fontSize: "0.62rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "hsl(var(--muted-foreground))",
          marginBottom: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.95rem", fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

// Auto-fitting tile grid. stack-sm-2 keeps it readable 2-up on phones.
function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="stack-sm-2"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 8,
      }}
    >
      {children}
    </div>
  )
}

export const UserDossier: React.FC<{
  userId: string | null
  onClose: () => void
}> = ({ userId, onClose }) => {
  const token =
    sessionStorage.getItem("admin_token") || localStorage.getItem("admin_token")
  const api = useAdminApi(token)
  // api is a fresh object every render, so read the fetcher through a ref and
  // keep it out of the effect deps — otherwise the effect re-fires forever.
  const getDossierRef = useRef(api.getUserDossier)
  useEffect(() => {
    getDossierRef.current = api.getUserDossier
  })

  // Callers mount this with key={userId}, so opening a different user remounts
  // rather than resetting state from inside the effect — which would trip
  // react-hooks/set-state-in-effect and cascade a render.
  const [data, setData] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState(() => !!userId)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getDossierRef
      .current(userId)
      .then((r: unknown) => {
        if (!cancelled) setData(r as Dossier)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load dossier")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Close on Escape, the expected affordance for a slide-over.
  useEffect(() => {
    if (!userId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [userId, onClose])

  // Refetch unmasked. The server writes an audit log for this specific call.
  const doReveal = () => {
    if (!userId || revealed) return
    getDossierRef
      .current(userId, true)
      .then((r: unknown) => {
        setData(r as Dossier)
        setRevealed(true)
      })
      .catch(() => setRevealed(false))
  }

  if (!userId) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="no-scrollbar"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: 760,
          // Cap to the viewport and scroll inside the card, so a long dossier
          // never pushes the close button off-screen.
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "1.5rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            marginBottom: "1.5rem",
            // Sticks to the top of the scrolling card so Close stays reachable.
            position: "sticky",
            top: "-1.5rem",
            margin: "-1.5rem -1.5rem 1.5rem",
            padding: "1.5rem",
            background: "hsl(var(--card))",
            borderBottom: "1px solid hsl(var(--border))",
            zIndex: 1,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>
              {data ? displayName(data.user) : "User Dossier"}
            </h2>
            {data && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                  fontFamily: "monospace",
                }}
              >
                {data.user.username ? `@${data.user.username} · ` : ""}
                {data.user.id.slice(0, 18)}…
              </p>
            )}
          </div>
          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: "4px 8px" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {loading && (
          <p
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.85rem",
            }}
          >
            Loading dossier…
          </p>
        )}
        {error && (
          <p style={{ color: "hsl(var(--destructive))", fontSize: "0.85rem" }}>
            {error}
          </p>
        )}

        {data && (
          <>
            {/* Identity + Bank sit side by side — both are short label/value
                lists, and stacking them wasted half the card's width. */}
            <div
              className="stack-sm"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              {/* Identity */}
              <Section title="Identity" Icon={ShieldAlert} boxed>
                <Row label="Currency" value={data.user.currency} />
                <Row label="KYC" value={data.user.kycStatus} />
                <Row label="Reputation" value={data.user.reputationTier} />
                <Row label="Email" value={data.user.email ?? "—"} />
                <Row label="Phone" value={data.user.phoneNumber ?? "—"} />
                <Row
                  label="Telegram ID"
                  value={data.user.telegramId ?? "—"}
                  mono
                />
                <Row
                  label="Joined"
                  value={new Date(data.user.createdAt).toLocaleDateString(
                    "en-BT",
                    { day: "2-digit", month: "short", year: "numeric" }
                  )}
                />
              </Section>

              {/* Bank */}
              <Section
                title="Bank Account"
                Icon={Landmark}
                boxed
                action={
                  <button
                    className="secondary"
                    onClick={revealed ? undefined : doReveal}
                    disabled={revealed}
                    style={{
                      marginLeft: "auto",
                      padding: "3px 10px",
                      fontSize: "0.7rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                    title={
                      revealed
                        ? "Revealed — this access was logged"
                        : "Reveal full CID and account number (logged)"
                    }
                  >
                    {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
                    {revealed ? "Revealed" : "Reveal"}
                  </button>
                }
              >
                <Row
                  label="Account name"
                  value={data.bank.accountName ?? "—"}
                />
                <Row label="CID" value={data.bank.cid ?? "—"} mono />
                <Row
                  label="Account number"
                  value={data.bank.accountNumber ?? "—"}
                  mono
                />
                <Row
                  label="Verified"
                  value={data.bank.verified ? "Yes" : "No (legacy field)"}
                />
                {data.bank.masked && (
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "0.7rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Masked. Revealing is recorded in the audit log.
                  </p>
                )}
              </Section>
            </div>

            {/* Money per book */}
            <Section title="Money" Icon={Wallet}>
              {data.books.length === 0 && (
                <p
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    fontSize: "0.8rem",
                  }}
                >
                  No ledger activity
                </p>
              )}
              {data.books.map((b) => {
                // Real profit/loss: what came back out plus what's still on
                // the books, against what went in. `net` (deposited-withdrawn)
                // is only how much the account has been FUNDED by, and reads
                // as a gain when the user is deep underwater — so both are
                // shown, labelled distinctly.
                const pnl = b.withdrawn + b.balance - b.deposited
                return (
                  <div key={b.currency} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "hsl(var(--muted-foreground))",
                        marginBottom: 8,
                      }}
                    >
                      {b.currency} book
                    </div>
                    <TileGrid>
                      <Tile
                        label="Profit / Loss"
                        value={`${pnl < 0 ? "−" : "+"}${money(Math.abs(pnl), b.currency)}`}
                        tone={pnl < 0 ? "bad" : "good"}
                        hint="Withdrawn + balance − deposited. What the user is actually up or down."
                      />
                      <Tile
                        label="Balance"
                        value={money(b.balance, b.currency)}
                      />
                      <Tile
                        label="Deposited"
                        value={money(b.deposited, b.currency)}
                      />
                      <Tile
                        label="Withdrawn"
                        value={money(b.withdrawn, b.currency)}
                      />
                      <Tile
                        label="Net funded"
                        value={money(b.net, b.currency)}
                        hint="Deposited − withdrawn. How much the account has been funded by, NOT profit."
                      />
                      <Tile
                        label="Total bet"
                        value={money(b.bet, b.currency)}
                      />
                      <Tile
                        label="Total won"
                        value={money(b.won, b.currency)}
                      />
                      {b.bonusCredited > 0 && (
                        <Tile
                          label="Bonus credited"
                          value={money(b.bonusCredited, b.currency)}
                        />
                      )}
                    </TileGrid>
                  </div>
                )
              })}
            </Section>

            {/* Rails */}
            <Section title="Deposit / Withdrawal Sources" Icon={Receipt}>
              {data.sources.length === 0 && (
                <p
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    fontSize: "0.8rem",
                  }}
                >
                  No completed payments
                </p>
              )}
              {data.sources.map((s, i) => (
                <Row
                  key={`${s.method}-${s.type}-${s.currency}-${i}`}
                  label={`${METHOD_LABELS[s.method] ?? s.method} · ${
                    TYPE_LABELS[s.type] ?? s.type
                  }`}
                  value={`${money(s.total, s.currency)} (${s.count})`}
                />
              ))}
              {data.usdtWithdrawals.count > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid hsl(var(--border))",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "hsl(var(--muted-foreground))",
                      marginBottom: 6,
                    }}
                  >
                    USDT withdrawals ({data.usdtWithdrawals.count})
                  </div>
                  <Row
                    label="Completed"
                    value={money(data.usdtWithdrawals.completed, "USDT")}
                  />
                  <Row
                    label="In flight"
                    value={money(data.usdtWithdrawals.inFlight, "USDT")}
                  />
                  <Row
                    label="Awaiting approval"
                    value={money(data.usdtWithdrawals.pending, "USDT")}
                  />
                </div>
              )}
            </Section>

            {/* Betting */}
            <Section title="Betting Behaviour" Icon={TrendingUp}>
              {data.betting.length === 0 && (
                <p
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    fontSize: "0.8rem",
                  }}
                >
                  Never placed a bet
                </p>
              )}
              {data.betting.map((b) => {
                const settled = b.won + b.lost
                return (
                  <div key={b.currency} style={{ marginBottom: 14 }}>
                    <TileGrid>
                      <Tile label="Bets placed" value={b.count} />
                      <Tile
                        label="Total staked"
                        value={money(b.staked, b.currency)}
                      />
                      <Tile
                        label="Average stake"
                        value={money(b.avgStake, b.currency)}
                      />
                      <Tile
                        label="Largest bet"
                        value={money(b.largestBet, b.currency)}
                      />
                      <Tile
                        label="Win rate"
                        value={
                          settled > 0
                            ? `${Math.round((b.won / settled) * 100)}%`
                            : "—"
                        }
                        hint={
                          settled > 0
                            ? `${b.won} won / ${b.lost} lost of ${settled} settled`
                            : undefined
                        }
                      />
                      <Tile
                        label="Pending"
                        value={b.pending}
                        hint="Unsettled bets — their stake is in Total bet but their outcome is not yet in Total won."
                      />
                      <Tile label="Top category" value={b.topCategory ?? "—"} />
                    </TileGrid>
                  </div>
                )
              })}
            </Section>

            {/* Ledger */}
            <Section title="Recent Transactions" Icon={Receipt}>
              {data.recentTransactions.length === 0 ? (
                <p
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    fontSize: "0.8rem",
                  }}
                >
                  No transactions
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ fontSize: "0.75rem" }}>
                    <thead>
                      <tr>
                        {["Date", "Type", "Amount", "Balance"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "6px 8px",
                              textAlign: "left",
                              fontSize: "0.65rem",
                              color: "hsl(var(--muted-foreground))",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentTransactions.map((t) => (
                        <tr
                          key={t.id}
                          style={{
                            borderTop: "1px solid hsl(var(--border))",
                          }}
                        >
                          <td
                            style={{ padding: "6px 8px", whiteSpace: "nowrap" }}
                          >
                            {new Date(t.createdAt).toLocaleDateString("en-BT", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </td>
                          <td
                            style={{ padding: "6px 8px", whiteSpace: "nowrap" }}
                          >
                            {TYPE_LABELS[t.type] ?? t.type}
                            {t.isBonus && (
                              <span
                                style={{
                                  marginLeft: 4,
                                  fontSize: "0.6rem",
                                  color: "hsl(var(--muted-foreground))",
                                }}
                              >
                                bonus
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              whiteSpace: "nowrap",
                              fontWeight: 600,
                              color:
                                t.amount < 0
                                  ? "hsl(var(--destructive))"
                                  : "#4ade80",
                            }}
                          >
                            {t.amount < 0 ? "−" : "+"}
                            {money(Math.abs(t.amount), t.currency)}
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              whiteSpace: "nowrap",
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            {money(t.balanceAfter, t.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
