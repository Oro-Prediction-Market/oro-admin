import React, { useEffect, useState } from "react"
import {
  Users,
  MousePointerClick,
  MonitorSmartphone,
  TrendingUp,
  BarChart2,
} from "lucide-react"

const CATEGORY_COLORS: Record<string, string> = {
  sports: "#3b82f6",
  gaming: "#8b5cf6",
  weather: "#06b6d4",
  entertainment: "#f59e0b",
  economy: "#10b981",
  other: "#6b7280",
}

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Sports",
  gaming: "Gaming",
  weather: "Weather",
  entertainment: "Entertainment",
  economy: "Economy",
  other: "Other",
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `Nu ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `Nu ${(n / 1_000).toFixed(1)}K`
  return `Nu ${Math.round(n)}`
}

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + "/api"

interface Analytics {
  eventBreakdown: { eventType: string; count: number }[]
  dau: { date: string; dau: number }[]
  topPages: { page: string; views: number }[]
  platformSplit: { platform: string; users: number }[]
  conversionFunnel: {
    opened: number
    viewed_market: number
    opened_bet_modal: number
  }
  categoryStats: {
    category: string
    bets: number
    bettors: number
    volume: number
  }[]
}

const EVENT_LABELS: Record<string, string> = {
  "app.open": "App Opens",
  "page.view": "Page Views",
  "market.view": "Market Views",
  "bet.modal.open": "Bet Modals Opened",
  "share.tap": "Share Taps",
  "referral.share": "Referral Shares",
  "onboarding.complete": "Onboarding Completed",
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: "0.8rem",
        }}
      >
        <span style={{ color: "hsl(var(--muted-foreground))" }}>{label}</span>
        <span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>
          {value.toLocaleString()}{" "}
          <span
            style={{ color: "hsl(var(--muted-foreground))", fontWeight: 400 }}
          >
            ({pct}%)
          </span>
        </span>
      </div>
      <div
        style={{ height: 6, borderRadius: 4, background: "hsl(var(--muted))" }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  )
}

export const BehavioralAnalytics: React.FC<{ token: string | null }> = ({
  token,
}) => {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(() => !!token)
  const [error, setError] = useState<string | null>(() =>
    token ? null : "Not authenticated"
  )

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/admin/behavioral-analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e: Error) => setError(`Failed to load analytics (${e.message})`))
      .finally(() => setLoading(false))
  }, [token])

  if (loading)
    return (
      <div
        className="glass-card"
        style={{
          marginTop: "2rem",
          color: "hsl(var(--muted-foreground))",
          fontSize: "0.875rem",
        }}
      >
        Loading behavioral data…
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

  const maxDau = Math.max(...(data.dau ?? []).map((d) => d.dau), 1)
  const {
    opened = 0,
    viewed_market = 0,
    opened_bet_modal = 0,
  } = data.conversionFunnel ?? {}
  const categoryStats: Analytics["categoryStats"] = data.categoryStats ?? []

  return (
    <div
      style={{
        marginTop: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TrendingUp size={18} color="hsl(var(--primary))" />
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Behavioral Analysis</h2>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Last 30 days
        </span>
      </div>

      {/* Event breakdown + Platform split */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* Event breakdown */}
        <div className="glass-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <MousePointerClick size={16} color="hsl(var(--primary))" />
            <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Event Breakdown</h3>
          </div>
          {data.eventBreakdown.length === 0 ? (
            <p
              style={{
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.8rem",
              }}
            >
              No events yet
            </p>
          ) : (
            data.eventBreakdown.map(({ eventType, count }) => (
              <div
                key={eventType}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid hsl(var(--border))",
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ color: "hsl(var(--muted-foreground))" }}>
                  {EVENT_LABELS[eventType] ?? eventType}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {count.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Platform split + Top pages */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <div className="glass-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <MonitorSmartphone size={16} color="hsl(var(--primary))" />
              <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Platform Split</h3>
            </div>
            {data.platformSplit.map(({ platform, users }) => (
              <div
                key={platform}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  fontSize: "0.82rem",
                }}
              >
                <span
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {platform}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {users.toLocaleString()} users
                </span>
              </div>
            ))}
            {data.platformSplit.length === 0 && (
              <p
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontSize: "0.8rem",
                }}
              >
                No data yet
              </p>
            )}
          </div>

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
              <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Top Pages</h3>
            </div>
            {data.topPages.map(({ page, views }) => (
              <div
                key={page}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  fontSize: "0.82rem",
                }}
              >
                <span
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    textTransform: "capitalize",
                  }}
                >
                  {page}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {views.toLocaleString()}
                </span>
              </div>
            ))}
            {data.topPages.length === 0 && (
              <p
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontSize: "0.8rem",
                }}
              >
                No data yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* DAU Sparkline */}
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
          <h3 style={{ margin: 0, fontSize: "0.9rem" }}>
            Daily Active Users (14 days)
          </h3>
        </div>
        {data.dau.length === 0 ? (
          <p
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.8rem",
            }}
          >
            No data yet
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
            {data.dau.map(({ date, dau: val }) => (
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
                    height: `${Math.max(4, (val / maxDau) * 52)}px`,
                    borderRadius: 3,
                    background: "hsl(var(--primary))",
                    opacity: 0.8,
                  }}
                  title={`${new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${val} DAU`}
                />
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {new Date(date).getDate()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversion Funnel */}
      <div className="glass-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <TrendingUp size={16} color="hsl(var(--primary))" />
          <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Engagement Funnel</h3>
        </div>
        <FunnelBar
          label="Opened App"
          value={opened}
          max={opened}
          color="hsl(var(--primary))"
        />
        <FunnelBar
          label="Viewed a Market"
          value={viewed_market}
          max={opened}
          color="#10b981"
        />
        <FunnelBar
          label="Opened Bet Modal"
          value={opened_bet_modal}
          max={opened}
          color="#f59e0b"
        />
      </div>

      {/* Category betting breakdown */}
      <div className="glass-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <BarChart2 size={16} color="hsl(var(--primary))" />
          <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Betting by Category</h3>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Last 30 days
          </span>
        </div>
        {categoryStats.length === 0 ? (
          <p
            style={{
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.8rem",
            }}
          >
            No bets placed yet
          </p>
        ) : (
          <>
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 60px 60px 80px",
                gap: 8,
                padding: "4px 0 8px",
                borderBottom: "1px solid hsl(var(--border))",
                fontSize: "0.72rem",
                color: "hsl(var(--muted-foreground))",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span>Category</span>
              <span style={{ textAlign: "right" }}>Bets</span>
              <span style={{ textAlign: "right" }}>Bettors</span>
              <span style={{ textAlign: "right" }}>Volume</span>
            </div>
            {categoryStats.map(({ category, bets, bettors, volume }) => {
              const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other
              const maxVol = Math.max(...categoryStats.map((c) => c.volume), 1)
              const barPct = Math.round((volume / maxVol) * 100)
              return (
                <div key={category}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 60px 60px 80px",
                      gap: 8,
                      padding: "8px 0",
                      fontSize: "0.82rem",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ textTransform: "capitalize" }}>
                        {CATEGORY_LABELS[category] ?? category}
                      </span>
                    </div>
                    <span
                      style={{
                        textAlign: "right",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {bets.toLocaleString()}
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {bettors.toLocaleString()}
                    </span>
                    <span style={{ textAlign: "right", fontWeight: 600 }}>
                      {fmtVolume(volume)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      background: "hsl(var(--muted))",
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${barPct}%`,
                        borderRadius: 2,
                        background: color,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
