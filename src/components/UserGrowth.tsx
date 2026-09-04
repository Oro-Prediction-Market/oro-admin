import React, { useEffect, useState } from "react"
import { Users, UserPlus, Share2, Zap, LineChart } from "lucide-react"
import { handleAdminAuth } from "../lib/useAdminApi"

// Backend uses a global /api prefix — strip the trailing /admin from the env
// var then re-add /api. Same derivation as useAdminApi and BehavioralAnalytics.
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + "/api"

interface Growth {
  days: number
  totals: { allTime: number; today: number; last7: number; last30: number }
  newUsers: number
  signupsPerDay: { date: string; count: number }[]
  byProvider: { provider: string; count: number }[]
  referral: {
    viaReferral: number
    organic: number
    topReferrers: { userId: string; name: string; count: number }[]
  }
  activation: { acquired: number; placedBet: number }
}

// The five AuthProvider values. Anything unrecognised falls back to the raw key
// so a newly added provider still shows up rather than rendering blank.
const PROVIDER_LABELS: Record<string, string> = {
  telegram: "Telegram",
  bhutanapp: "BhutanApp",
  dkbank: "DK Bank",
  email: "Email",
  google: "Google",
}

const RANGES: { days: number; label: string }[] = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 0, label: "All" },
]

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%"
  return `${Math.round((part / whole) * 100)}%`
}

function StatCard({
  label,
  value,
  sub,
  Icon,
}: {
  label: string
  value: string | number
  sub?: string
  Icon: React.ElementType
}) {
  return (
    <div className="glass-card stat-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
        }}
      >
        <h3>{label}</h3>
        <Icon size={20} color="hsl(var(--primary))" />
      </div>
      <p>{value}</p>
      {sub && (
        <span
          style={{
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

export const UserGrowth: React.FC<{ token: string | null }> = ({ token }) => {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Growth | null>(null)
  const [loading, setLoading] = useState(() => !!token)
  const [error, setError] = useState<string | null>(() =>
    token ? null : "Not authenticated"
  )

  // Switching range sets the spinner here rather than in the effect body:
  // calling setState synchronously inside an effect triggers a cascading
  // render (react-hooks/set-state-in-effect). The effect below only ever sets
  // state from async callbacks, which is fine.
  const changeRange = (next: number) => {
    if (next === days) return
    setDays(next)
    setLoading(true)
  }

  // Deps are [token, days] and nothing else. Deliberately a raw fetch rather
  // than useAdminApi: that hook returns a fresh object every render, so an
  // effect depending on it re-fires forever (the 429 loop AMLPage hit).
  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/admin/user-growth?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(handleAdminAuth) // expired session → login screen, not a fetch error
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) =>
        setError(`Failed to load growth data (${e.message})`)
      )
      .finally(() => setLoading(false))
  }, [token, days])

  const rangeButtons = (
    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
      {RANGES.map((r) => (
        <button
          key={r.days}
          className="secondary"
          onClick={() => changeRange(r.days)}
          style={{
            padding: "4px 12px",
            fontSize: "0.75rem",
            borderRadius: 6,
            ...(days === r.days
              ? {
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--background))",
                  borderColor: "hsl(var(--primary))",
                }
              : {}),
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  )

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LineChart size={18} color="hsl(var(--primary))" />
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>User Growth</h2>
      {rangeButtons}
    </div>
  )

  if (loading && !data)
    return (
      <div
        className="glass-card"
        style={{
          marginTop: "2rem",
          color: "hsl(var(--muted-foreground))",
          fontSize: "0.875rem",
        }}
      >
        Loading growth data…
      </div>
    )

  if (error || !data)
    return (
      <div
        className="glass-card"
        style={{
          marginTop: "2rem",
          color: "hsl(var(--destructive))",
          fontSize: "0.875rem",
        }}
      >
        {error ?? "No data"}
      </div>
    )

  const series = data.signupsPerDay ?? []
  const maxSignups = Math.max(...series.map((d) => d.count), 1)
  const providers = data.byProvider ?? []
  const providerTotal = providers.reduce((s, p) => s + p.count, 0)
  const referrers = data.referral?.topReferrers ?? []
  const rangeLabel =
    RANGES.find((r) => r.days === data.days)?.label === "All"
      ? "all time"
      : `last ${data.days} days`

  return (
    <div
      style={{
        marginTop: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      {header}

      <div className="stat-grid" style={{ marginBottom: 0 }}>
        <StatCard
          label="Total Users"
          value={data.totals.allTime.toLocaleString()}
          sub={`+${data.totals.today} today · +${data.totals.last7} this week`}
          Icon={Users}
        />
        <StatCard
          label={`New (${rangeLabel})`}
          value={data.newUsers.toLocaleString()}
          sub={`+${data.totals.last30} in the last 30 days`}
          Icon={UserPlus}
        />
        <StatCard
          label="Via Referral"
          value={data.referral.viaReferral.toLocaleString()}
          sub={`${pct(data.referral.viaReferral, data.newUsers)} of new · ${data.referral.organic.toLocaleString()} organic`}
          Icon={Share2}
        />
        <StatCard
          label="Activated"
          value={data.activation.placedBet.toLocaleString()}
          sub={`${pct(data.activation.placedBet, data.activation.acquired)} placed a bet`}
          Icon={Zap}
        />
      </div>

      {/* Signups per day */}
      <div className="glass-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <UserPlus size={16} color="hsl(var(--primary))" />
          <h3 style={{ margin: 0, fontSize: "0.9rem" }}>
            Signups per Day ({rangeLabel})
          </h3>
        </div>
        {series.length === 0 ? (
          <p
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.8rem",
            }}
          >
            No signups in this range
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
              height: 60,
            }}
          >
            {series.map(({ date, count }) => (
              <div
                key={date}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(4, (count / maxSignups) * 52)}px`,
                    borderRadius: 3,
                    background: "hsl(var(--primary))",
                    opacity: 0.8,
                  }}
                  title={`${new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}: ${count} signup${count === 1 ? "" : "s"}`}
                />
                {series.length <= 45 && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {new Date(date).getDate()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="stack-sm"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* Signup source */}
        <div className="glass-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Users size={16} color="hsl(var(--primary))" />
            <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Signup Source</h3>
          </div>
          {providers.map(({ provider, count }) => (
            <div key={provider} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ color: "hsl(var(--muted-foreground))" }}>
                  {PROVIDER_LABELS[provider] ?? provider}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {count.toLocaleString()}{" "}
                  <span
                    style={{
                      color: "hsl(var(--muted-foreground))",
                      fontWeight: 400,
                    }}
                  >
                    ({pct(count, providerTotal)})
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 4,
                  background: "hsl(var(--muted))",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: pct(count, providerTotal),
                    borderRadius: 4,
                    background: "hsl(var(--primary))",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          ))}
          {providers.length === 0 && (
            <p
              style={{
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.8rem",
              }}
            >
              No signups in this range
            </p>
          )}
        </div>

        {/* Top referrers — all-time, not windowed */}
        <div className="glass-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Share2 size={16} color="hsl(var(--primary))" />
            <h3 style={{ margin: 0, fontSize: "0.9rem" }}>
              Top Referrers (all time)
            </h3>
          </div>
          {referrers.map(({ userId, name, count }, i) => (
            <div
              key={userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontSize: "0.82rem",
                borderBottom:
                  i < referrers.length - 1
                    ? "1px solid hsl(var(--border))"
                    : "none",
              }}
            >
              <span style={{ color: "hsl(var(--muted-foreground))" }}>
                {i + 1}. {name}
              </span>
              <span style={{ fontWeight: 600 }}>
                {count.toLocaleString()} referred
              </span>
            </div>
          ))}
          {referrers.length === 0 && (
            <p
              style={{
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.8rem",
              }}
            >
              No referrals yet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
