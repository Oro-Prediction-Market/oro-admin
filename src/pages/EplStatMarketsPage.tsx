import React, { useEffect, useMemo, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

interface StatEntry {
  player: string
  club: string
  clubBadge: string
  face: string
  faceBackup: string
  value: number
}
interface EplStats {
  updatedAt: string
  goals: StatEntry[]
  assists: StatEntry[]
  yellow: StatEntry[]
  red: StatEntry[]
}
interface ExistingMarket {
  id: string
  title: string
  subcategory: string
  status: string
}
interface SeasonInfo {
  started: boolean
  seasonStart: string | null
  maxPlayed: number
}

// Mirrors the backend STAT_MARKET_META + the Stats-tab subcategory routing.
const STATS: {
  key: keyof Omit<EplStats, "updatedAt">
  subcategory: string
  label: string
  unit: string
}[] = [
  {
    key: "goals",
    subcategory: "epl-topscorer",
    label: "Top Scorer",
    unit: "goals",
  },
  {
    key: "assists",
    subcategory: "epl-assists",
    label: "Most Assists",
    unit: "assists",
  },
  {
    key: "yellow",
    subcategory: "epl-yellowcards",
    label: "Most Yellow Cards",
    unit: "YC",
  },
  {
    key: "red",
    subcategory: "epl-redcards",
    label: "Most Red Cards",
    unit: "RC",
  },
]

function Avatar({ srcs, label }: { srcs: string[]; label: string }) {
  const list = srcs.filter(Boolean)
  const [i, setI] = useState(0)
  const src = list[i]
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        onError={() => setI((n) => n + 1)}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          objectFit: "cover",
          objectPosition: "center top",
          background: "hsl(var(--muted))",
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(var(--muted))",
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {label.trim().charAt(0).toUpperCase()}
    </div>
  )
}

// Default close date: end of the PL season window (late May, next year if we're
// already past June).
function defaultCloseDate(): string {
  const now = new Date()
  const year = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  return `${year}-05-24`
}

export default function EplStatMarketsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [stats, setStats] = useState<EplStats | null>(null)
  const [existing, setExisting] = useState<ExistingMarket[]>([])
  const [season, setSeason] = useState<SeasonInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [closeDate, setCloseDate] = useState(defaultCloseDate())
  const [topN, setTopN] = useState(15)

  const load = async () => {
    setErr(null)
    try {
      const res = await api.getEplStatMarketPreview()
      setStats(res?.stats ?? null)
      setExisting(Array.isArray(res?.existing) ? res.existing : [])
      setSeason(res?.season ?? null)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const existingBySub = useMemo(() => {
    const m = new Map<string, ExistingMarket>()
    for (const e of existing) m.set(e.subcategory, e)
    return m
  }, [existing])

  const create = async (stat: string) => {
    setBusy(stat)
    setErr(null)
    setMsg((m) => ({ ...m, [stat]: "" }))
    try {
      const closesAt = `${closeDate}T12:00:00.000Z`
      const market = await api.createEplStatMarket({ stat, closesAt, topN })
      setMsg((m) => ({
        ...m,
        [stat]: `✓ Created — betting is now live on the Stats tab (${market?.outcomes?.length ?? topN} players).`,
      }))
      await load()
    } catch (e: unknown) {
      setMsg((m) => ({
        ...m,
        [stat]: e instanceof Error ? e.message : "Failed to create",
      }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1000 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
        EPL Stat Markets
      </h1>
      <p
        style={{ color: "hsl(var(--muted-foreground))", marginBottom: "1rem" }}
      >
        One click creates a season-long stat market with outcomes pre-filled
        from the <strong>live leaderboard</strong> (correct names + player
        photos). Betting then appears automatically on the app's Stats tab. Stat
        markets are resolved <strong>manually</strong> at season's end.
      </p>

      {err && (
        <div
          style={{
            background: "hsl(var(--destructive) / 0.1)",
            color: "hsl(var(--destructive))",
            padding: "0.6rem 0.9rem",
            borderRadius: 8,
            marginBottom: "1rem",
          }}
        >
          {err}
        </div>
      )}

      {season && (
        <div
          style={{
            padding: "0.7rem 1rem",
            borderRadius: 10,
            marginBottom: "1.25rem",
            border: `1px solid ${season.started ? "#16a34a" : "#d97706"}`,
            background: season.started ? "#16a34a1a" : "#d977061a",
            fontSize: "0.9rem",
          }}
        >
          {season.started ? (
            <>
              🟢 <strong>Season is live</strong> — up to {season.maxPlayed}{" "}
              gameweek(s) played. Markets auto-create once ~3 gameweeks are in;
              you can also create them manually below now.
            </>
          ) : (
            <>
              🟡 <strong>Off-season</strong> — the boards below show{" "}
              <strong>last season's</strong> data. Manual creation is locked and
              the auto-creator is paused; both switch on automatically when the
              new season kicks off.
            </>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          alignItems: "flex-end",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Betting closes
          </span>
          <input
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            style={{
              padding: "0.5rem 0.7rem",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Players to include ({topN})
          </span>
          <input
            type="range"
            min={2}
            max={25}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            style={{ width: 180 }}
          />
        </label>
      </div>

      {loading ? (
        <p>Loading live leaderboard…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1rem",
          }}
        >
          {STATS.map((s) => {
            const board = (stats?.[s.key] ?? []) as StatEntry[]
            const ex = existingBySub.get(s.subcategory)
            const preview = board.slice(0, topN)
            return (
              <div
                key={s.key}
                style={{
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  padding: "1rem",
                  background: "hsl(var(--card))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <strong>{s.label}</strong>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    {board.length} players
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    marginBottom: "0.75rem",
                    maxHeight: 220,
                    overflowY: "auto",
                  }}
                >
                  {preview.length === 0 ? (
                    <span
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        fontSize: "0.85rem",
                      }}
                    >
                      No live data yet.
                    </span>
                  ) : (
                    preview.map((p, i) => (
                      <div
                        key={`${p.player}-${i}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            color: "hsl(var(--muted-foreground))",
                            fontSize: "0.8rem",
                          }}
                        >
                          {i + 1}
                        </span>
                        <Avatar
                          srcs={[p.face, p.faceBackup, p.clubBadge]}
                          label={p.player}
                        />
                        <span style={{ flex: 1, fontSize: "0.85rem" }}>
                          {p.player}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                          {p.value} {s.unit}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {ex ? (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "hsl(var(--muted-foreground))",
                      padding: "0.5rem 0",
                    }}
                  >
                    ✓ Market already exists ({ex.status}). Resolve or cancel it
                    in Markets before creating a new one.
                  </div>
                ) : (
                  <button
                    onClick={() => create(s.key)}
                    disabled={
                      busy === s.key || !season?.started || preview.length < 2
                    }
                    title={
                      !season?.started
                        ? "Locked until the new season starts"
                        : undefined
                    }
                    style={{
                      width: "100%",
                      padding: "0.55rem",
                      borderRadius: 8,
                      border: "none",
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      fontWeight: 600,
                      cursor:
                        !season?.started || preview.length < 2
                          ? "not-allowed"
                          : "pointer",
                      opacity: !season?.started || preview.length < 2 ? 0.5 : 1,
                    }}
                  >
                    {busy === s.key
                      ? "Creating…"
                      : !season?.started
                        ? "Locked (off-season)"
                        : `Create ${s.label} market`}
                  </button>
                )}

                {msg[s.key] && (
                  <div
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.8rem",
                      color: msg[s.key].startsWith("✓")
                        ? "hsl(var(--primary))"
                        : "hsl(var(--destructive))",
                    }}
                  >
                    {msg[s.key]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
