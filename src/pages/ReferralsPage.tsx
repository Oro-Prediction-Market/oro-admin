import React, { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { UserDossier } from "../components/UserDossier"

interface Person {
  userId: string
  username: string | null
  firstName: string | null
  lastName: string | null
}

interface PaidRow {
  currency: string
  total: number
  payouts: number
  firstPaidAt: string | null
  lastPaidAt: string | null
}

interface Referrer extends Person {
  referredCount: number
  convertedCount: number
  /** Nu, from the ledger. */
  earned: number
  lastReferredAt: string | null
}

interface ReferralsResponse {
  summary: {
    paid: PaidRow[]
    referredUsers: number
    converted: number
    referrers: number
  }
  referrers: Referrer[]
  limit: number
}

interface Friend extends Person {
  joinedAt: string | null
  converted: boolean
  firstBetAt: string | null
  firstBetAmount: number | null
  /** Recomputed from the first bet; the ledger does not record it per friend. */
  bonus: number | null
}

interface FriendsResponse {
  userId: string
  earned: number
  friends: Friend[]
}

const muted = "hsl(var(--muted-foreground))"

const money = (n: number, currency = "BTN") =>
  `${currency === "USDT" ? "$" : "Nu "}${n.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—"

/** "@alice", else the full name, else a shortened id. Never blank. */
function personName(p: Person): string {
  if (p.username) return `@${p.username}`
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ")
  return full || `${p.userId.slice(0, 8)}…`
}

/**
 * The referral programme: what it has paid out, who brought whom, and what
 * each referrer earned for it.
 *
 * A referrer is paid once per friend, on the friend's first bet. Totals and
 * each referrer's earnings are exact ledger sums; the bonus shown per friend
 * is recomputed from their first bet, because the payout does not record
 * which friend it was for.
 */
export default function ReferralsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<ReferralsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [friends, setFriends] = useState<Record<string, FriendsResponse>>({})
  const [friendsErr, setFriendsErr] = useState<string | null>(null)
  const [dossierUserId, setDossierUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData((await api.getReferralInsights(200)) as ReferralsResponse)
      setFriends({})
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

  const toggle = async (userId: string) => {
    if (open === userId) {
      setOpen(null)
      return
    }
    setOpen(userId)
    setFriendsErr(null)
    if (friends[userId]) return
    try {
      const res = (await api.getReferralsOf(userId)) as FriendsResponse
      setFriends((prev) => ({ ...prev, [userId]: res }))
    } catch (e) {
      setFriendsErr(e instanceof Error ? e.message : String(e))
    }
  }

  const nameButton = (p: Person) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setDossierUserId(p.userId)
      }}
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

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Referrals</h2>
        <button
          className="secondary"
          onClick={() => void load()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {data && <SummaryCards summary={data.summary} />}

      {err && (
        <div
          className="glass-card"
          style={{ padding: "1rem", color: "#f87171" }}
        >
          {err}
        </div>
      )}

      {loading && !data ? (
        <div className="glass-card" style={{ padding: "1rem" }}>
          Loading…
        </div>
      ) : (
        data && (
          <div className="glass-card" style={{ padding: "1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>
              Top referrers
            </h3>
            <p
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.8rem",
                color: muted,
              }}
            >
              Ranked by what they earned, then by how many they brought.
              {data.summary.referrers > data.referrers.length &&
                ` Showing ${data.referrers.length} of ${data.summary.referrers.toLocaleString()}.`}{" "}
              Click a row to see who they brought.
            </p>

            {data.referrers.length === 0 ? (
              <div style={{ fontSize: "0.85rem", color: muted }}>
                Nobody has signed up through a referral yet.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 28 }} />
                      <th>#</th>
                      <th>Referrer</th>
                      <th>Brought</th>
                      <th>Placed a bet</th>
                      <th>Earned</th>
                      <th>Last referral</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrers.map((r, i) => {
                      const isOpen = open === r.userId
                      return (
                        <React.Fragment key={r.userId}>
                          <tr
                            onClick={() => void toggle(r.userId)}
                            style={{ cursor: "pointer" }}
                          >
                            <td>
                              {isOpen ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </td>
                            <td>{i + 1}</td>
                            <td>{nameButton(r)}</td>
                            <td>{r.referredCount.toLocaleString()}</td>
                            <td>{r.convertedCount.toLocaleString()}</td>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontWeight: 600,
                              }}
                            >
                              {money(r.earned)}
                            </td>
                            <td>{date(r.lastReferredAt)}</td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={7} style={{ padding: 0 }}>
                                <FriendsList
                                  data={friends[r.userId]}
                                  error={friendsErr}
                                  nameButton={nameButton}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      <UserDossier
        key={dossierUserId}
        userId={dossierUserId}
        onClose={() => setDossierUserId(null)}
      />
    </div>
  )
}

/** Everyone one referrer brought, with what each friend's first bet paid. */
function FriendsList({
  data,
  error,
  nameButton,
}: {
  data: FriendsResponse | undefined
  error: string | null
  nameButton: (p: Person) => React.ReactNode
}) {
  const box: React.CSSProperties = {
    padding: "0.75rem 1rem",
    background: "hsl(var(--muted) / 0.3)",
    fontSize: "0.8rem",
  }
  if (!data) {
    return (
      <div style={{ ...box, color: muted }}>
        {error ? `Couldn't load: ${error}` : "Loading…"}
      </div>
    )
  }
  const recomputed = data.friends.reduce((s, f) => s + (f.bonus ?? 0), 0)
  return (
    <div style={box}>
      <table>
        <thead>
          <tr>
            <th>Friend</th>
            <th>Joined</th>
            <th>First bet</th>
            <th>Bonus paid for them</th>
          </tr>
        </thead>
        <tbody>
          {data.friends.map((f) => (
            <tr key={f.userId}>
              <td>{nameButton(f)}</td>
              <td>{date(f.joinedAt)}</td>
              <td>
                {f.firstBetAmount == null
                  ? "No bet yet"
                  : `${money(f.firstBetAmount)} · ${date(f.firstBetAt)}`}
              </td>
              <td style={{ fontFamily: "monospace" }}>
                {f.bonus == null ? "—" : money(f.bonus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "0.6rem 0 0", color: muted, lineHeight: 1.5 }}>
        Earned per the ledger: <strong>{money(data.earned)}</strong>. The
        per-friend bonus is recomputed from each friend's first bet (Nu 25 + 5%,
        capped at Nu 75), since the payout doesn't record which friend it was
        for — together they come to {money(recomputed)}.
      </p>
    </div>
  )
}

/** What referrals have cost, and how far the programme has reached. */
function SummaryCards({ summary }: { summary: ReferralsResponse["summary"] }) {
  // Paid in Nu; any other currency is shown alongside, never added.
  const main = summary.paid.find((p) => p.currency === "BTN") ??
    summary.paid[0] ?? {
      currency: "BTN",
      total: 0,
      payouts: 0,
      firstPaidAt: null,
      lastPaidAt: null,
    }
  const others = summary.paid.filter((p) => p !== main)
  const rate =
    summary.referredUsers > 0
      ? Math.round((summary.converted / summary.referredUsers) * 100)
      : 0
  const sub: React.CSSProperties = { color: muted, marginTop: 6 }

  return (
    <div className="kpi-grid" style={{ marginBottom: "1.5rem" }}>
      <div className="stat-grid">
        <div className="stat-card">
          <h3>Paid out to referrers</h3>
          <p>{money(main.total, main.currency)}</p>
          {others.map((o) => (
            <div key={o.currency} style={sub}>
              + {money(o.total, o.currency)}
            </div>
          ))}
          <div style={sub}>
            {main.payouts.toLocaleString()} payouts
            {main.lastPaidAt && ` · last ${date(main.lastPaidAt)}`}
          </div>
        </div>
        <div className="stat-card">
          <h3>Referred signups</h3>
          <p>{summary.referredUsers.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Placed a first bet</h3>
          <p>{summary.converted.toLocaleString()}</p>
          <div style={sub}>{rate}% of referred signups</div>
        </div>
        <div className="stat-card">
          <h3>Referrers</h3>
          <p>{summary.referrers.toLocaleString()}</p>
          <div style={sub}>brought at least one user</div>
        </div>
      </div>
    </div>
  )
}
