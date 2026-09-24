import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Flag,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  AlertTriangle,
  BarChart3,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { useToast } from "../components/Toast"
import ConfirmDialog from "../components/ConfirmDialog"
import StatBoardEditor from "../components/StatBoardEditor"

/**
 * Nations League admin.
 *
 * This competition is not on our football-data.org plan, so there is no feed
 * behind it and this page IS the feed. Everything the app shows — the group
 * tables, the match markets, the leaderboards — comes from what is typed here.
 *
 * The order the page is built in is the order the work happens in:
 *
 *   Teams    → the 54 nations, grouped A–N.
 *   Fixtures → the matches. Group tables become correct at this point, with
 *              no markets in play at all.
 *   Then, per fixture: create its market, and after the match enter the score.
 *
 * **Saving a score does nothing to the market.** That is the single most
 * important thing about this page, and the reason Propose is a separate
 * button: a mistyped score is free to fix right up until someone proposes on
 * it. Nothing between the two is automatic — Nations League markets are
 * excluded from both auto-settlers, so even an expired objection window
 * settles nothing without an admin.
 */

// ── Types (the API returns untyped JSON) ─────────────────────────────────────

interface Team {
  id: string
  season: string
  groupKey: string
  name: string
  flagUrl: string | null
  sortOrder: number
}

interface FixtureMarket {
  id: string
  title: string
  status: string
  totalPool: number
  proposedOutcomeId: string | null
  resolvedOutcomeId: string | null
  disputeDeadlineAt: string | null
}

interface Fixture {
  id: string
  season: string
  groupKey: string
  homeTeamId: string
  awayTeamId: string
  kickoffAt: string
  homeScore: number | null
  awayScore: number | null
  status: string
  matchday: number | null
  marketId: string | null
  market: FixtureMarket | null
  proposedLabel: string | null
  canPropose: boolean
}

interface SeasonInfo {
  started: boolean
  seasonStart: string | null
  maxPlayed: number
  season: string | null
  groupCount: number
  teamCount: number
}

type Tab = "teams" | "fixtures" | "stats"

/** A → N: the fourteen groups, across the four leagues. */
const GROUP_KEYS = "ABCDEFGHIJKLMN".split("")

const FIXTURE_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "finished", label: "Finished" },
  { value: "awarded", label: "Awarded (walkover)" },
  { value: "postponed", label: "Postponed" },
]

/** The edition covering `now`, as UEFA writes it. Group stage runs Sep–Nov. */
function defaultSeason(now = new Date()): string {
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`
}

const fmtKickoff = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/** `datetime-local` wants a local-time string with no zone suffix. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_COLOUR: Record<string, string> = {
  upcoming: "hsl(220 10% 60%)",
  open: "hsl(160 60% 45%)",
  closed: "hsl(38 90% 55%)",
  resolving: "hsl(38 90% 55%)",
  resolved: "hsl(210 80% 60%)",
  settled: "hsl(210 80% 60%)",
  cancelled: "hsl(0 60% 55%)",
}

function Badge({ text, colour }: { text: string; colour: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.5rem",
        borderRadius: 6,
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: colour,
        background: `color-mix(in srgb, ${colour} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${colour} 40%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  )
}

export default function NationsLeaguePage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()

  const [tab, setTab] = useState<Tab>("teams")
  const [season, setSeason] = useState(defaultSeason())
  const [info, setInfo] = useState<SeasonInfo | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel?: string
    variant?: "danger" | "default"
    onConfirm: () => void
  } | null>(null)

  /**
   * A score that contradicts an already-settled market.
   *
   * Kept on the page rather than shown as a toast, because a toast disappears
   * and this one needs acting on: a settled market cannot be re-resolved
   * through the app. In September a wrong settlement went unnoticed for
   * fifteen days; this is the thing that would have said so on day one.
   */
  const [warnings, setWarnings] = useState<Record<string, string>>({})

  const load = useCallback(
    async (target: string) => {
      setLoading(true)
      setErr(null)
      try {
        const [i, t, f] = await Promise.all([
          api.getUnlSeason(),
          api.getUnlTeams(target),
          api.getUnlFixtures(target),
        ])
        setInfo(i as SeasonInfo)
        setTeams((t as Team[]) ?? [])
        setFixtures((f as Fixture[]) ?? [])
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  useEffect(() => {
    load(season)
  }, [season, load])

  // Adopt the edition already in the database, so a fresh page does not sit on
  // a computed guess while real data exists under a different key.
  useEffect(() => {
    if (info?.season && info.season !== season) setSeason(info.season)
    // Only when the server reports one; the admin's own typing wins after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.season])

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const teamsByGroup = useMemo(() => {
    const m = new Map<string, Team[]>()
    for (const t of teams) {
      if (!m.has(t.groupKey)) m.set(t.groupKey, [])
      m.get(t.groupKey)!.push(t)
    }
    return m
  }, [teams])

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key)
    try {
      await fn()
      notify("success", ok)
      await load(season)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // ── Teams tab ────────────────────────────────────────────────────────────

  const [newTeam, setNewTeam] = useState({
    groupKey: "A",
    name: "",
    flagUrl: "",
  })

  const addTeam = async () => {
    if (!newTeam.name.trim()) {
      notify("error", "Enter the nation's name.")
      return
    }
    await run(
      "add-team",
      async () => {
        await api.createUnlTeam({
          season,
          groupKey: newTeam.groupKey,
          name: newTeam.name.trim(),
          flagUrl: newTeam.flagUrl.trim() || null,
          sortOrder: teamsByGroup.get(newTeam.groupKey)?.length ?? 0,
        })
        setNewTeam((s) => ({ ...s, name: "", flagUrl: "" }))
      },
      `${newTeam.name.trim()} added to Group ${newTeam.groupKey}.`
    )
  }

  const TeamsTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
          Add a nation
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1fr 1.4fr auto",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <select
            className="input-field"
            value={newTeam.groupKey}
            onChange={(e) =>
              setNewTeam((s) => ({ ...s, groupKey: e.target.value }))
            }
          >
            {GROUP_KEYS.map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="Nation, e.g. Republic of Ireland"
            value={newTeam.name}
            onChange={(e) =>
              setNewTeam((s) => ({ ...s, name: e.target.value }))
            }
            onKeyDown={(e) => e.key === "Enter" && addTeam()}
          />
          <input
            className="input-field"
            placeholder="Flag URL (optional)"
            value={newTeam.flagUrl}
            onChange={(e) =>
              setNewTeam((s) => ({ ...s, flagUrl: e.target.value }))
            }
          />
          <button
            className="btn btn-primary"
            onClick={addTeam}
            disabled={busy === "add-team"}
          >
            <Plus size={15} /> Add
          </button>
        </div>
        <p
          style={{
            margin: "0.6rem 0 0",
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          The exact name matters: it becomes the market's outcome label, and it
          cannot be renamed once markets exist. Republic of Ireland and Northern
          Ireland are different nations.
        </p>
      </div>

      {GROUP_KEYS.filter((g) => teamsByGroup.has(g)).map((g) => (
        <div key={g} className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
            Group {g}{" "}
            <span
              style={{
                fontWeight: 400,
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.8rem",
              }}
            >
              · {teamsByGroup.get(g)!.length} teams
            </span>
          </h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            {teamsByGroup.get(g)!.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: 8,
                  background: "hsl(var(--muted) / 0.25)",
                }}
              >
                {t.flagUrl ? (
                  <img
                    src={t.flagUrl}
                    alt=""
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Flag size={20} style={{ opacity: 0.5 }} />
                )}
                <span style={{ flex: 1, fontWeight: 600 }}>{t.name}</span>
                <button
                  className="btn btn-ghost"
                  title="Remove"
                  disabled={busy === `del-team-${t.id}`}
                  onClick={() =>
                    setConfirm({
                      title: `Remove ${t.name}?`,
                      message:
                        `${t.name} will be removed from Group ${t.groupKey}.\n\n` +
                        `This is refused if the nation appears in any fixture.`,
                      confirmLabel: "Remove",
                      variant: "danger",
                      onConfirm: () => {
                        setConfirm(null)
                        run(
                          `del-team-${t.id}`,
                          () => api.deleteUnlTeam(t.id),
                          `${t.name} removed.`
                        )
                      },
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {teams.length === 0 && !loading && (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No nations entered for {season} yet. Add them above — the group tables
          in the app appear as soon as they exist, all on zero.
        </div>
      )}
    </div>
  )

  // ── Fixtures tab ─────────────────────────────────────────────────────────

  const [newFixture, setNewFixture] = useState({
    groupKey: "A",
    homeTeamId: "",
    awayTeamId: "",
    kickoffAt: "",
    matchday: "1",
  })
  const [windowDays, setWindowDays] = useState("7")
  const [editingTime, setEditingTime] = useState<string | null>(null)
  const [timeDraft, setTimeDraft] = useState("")
  const [scoreDraft, setScoreDraft] = useState<
    Record<string, { home: string; away: string; status: string }>
  >({})

  const groupTeams = teamsByGroup.get(newFixture.groupKey) ?? []

  const addFixture = async () => {
    if (!newFixture.homeTeamId || !newFixture.awayTeamId) {
      notify("error", "Pick both teams.")
      return
    }
    if (!newFixture.kickoffAt) {
      notify("error", "Pick a kickoff time.")
      return
    }
    await run(
      "add-fixture",
      async () => {
        await api.createUnlFixture({
          season,
          homeTeamId: newFixture.homeTeamId,
          awayTeamId: newFixture.awayTeamId,
          kickoffAt: new Date(newFixture.kickoffAt).toISOString(),
          matchday: newFixture.matchday ? Number(newFixture.matchday) : null,
        })
        setNewFixture((s) => ({ ...s, homeTeamId: "", awayTeamId: "" }))
      },
      "Fixture added."
    )
  }

  const draftFor = (f: Fixture) =>
    scoreDraft[f.id] ?? {
      home: f.homeScore == null ? "" : String(f.homeScore),
      away: f.awayScore == null ? "" : String(f.awayScore),
      status: f.status,
    }

  const saveScore = async (f: Fixture) => {
    const d = draftFor(f)
    const bothBlank = d.home === "" && d.away === ""
    const bothFilled = d.home !== "" && d.away !== ""
    if (!bothBlank && !bothFilled) {
      notify("error", "Enter both scores or neither.")
      return
    }
    setBusy(`score-${f.id}`)
    try {
      const res = (await api.setUnlScore(f.id, {
        // Empty stays null. Never coerced to 0 — an absent score and a real
        // nil-nil are different things, and confusing them is what settled
        // Forest v Coventry as a draw in September.
        homeScore: bothFilled ? Number(d.home) : null,
        awayScore: bothFilled ? Number(d.away) : null,
        status: d.status,
      })) as { warning: string | null }
      setWarnings((w) => {
        const next = { ...w }
        if (res?.warning) next[f.id] = res.warning
        else delete next[f.id]
        return next
      })
      notify(
        "success",
        res?.warning
          ? "Score saved — but it disagrees with a settled market. See the notice."
          : "Score saved. Nothing has been proposed."
      )
      await load(season)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const byMatchday = useMemo(() => {
    const m = new Map<string, Fixture[]>()
    for (const f of fixtures) {
      const key = f.matchday == null ? "—" : String(f.matchday)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(f)
    }
    return [...m.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [fixtures])

  const FixturesTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Bulk market creation */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Create match markets
        </h3>
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.78rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Creates one market per fixture kicking off in the window, skipping any
          that already has one. Fixtures that have already kicked off are
          skipped — a market created after kickoff would take bets on a known
          result.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            className="input-field"
            type="number"
            min={1}
            max={60}
            style={{ width: 90 }}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
          />
          <span style={{ fontSize: "0.85rem" }}>days ahead</span>
          <button
            className="btn btn-primary"
            disabled={busy === "window"}
            onClick={() =>
              run(
                "window",
                async () => {
                  const r = (await api.createUnlMarketWindow(
                    Number(windowDays) || 7
                  )) as { created: string[]; skipped: unknown[] }
                  notify(
                    "success",
                    `${r.created.length} market(s) created, ${r.skipped.length} skipped.`
                  )
                },
                "Done."
              )
            }
          >
            <Trophy size={15} /> Create markets
          </button>
        </div>
      </div>

      {/* Add a fixture */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
          Add a fixture
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1fr 1fr 1fr 80px auto",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <select
            className="input-field"
            value={newFixture.groupKey}
            onChange={(e) =>
              setNewFixture((s) => ({
                ...s,
                groupKey: e.target.value,
                homeTeamId: "",
                awayTeamId: "",
              }))
            }
          >
            {GROUP_KEYS.map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
          {/* Both selects are scoped to the chosen group: the group stage has
              no cross-group fixtures, so offering one would only allow a
              mistake the backend then rejects. */}
          <select
            className="input-field"
            value={newFixture.homeTeamId}
            onChange={(e) =>
              setNewFixture((s) => ({ ...s, homeTeamId: e.target.value }))
            }
          >
            <option value="">Home…</option>
            {groupTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="input-field"
            value={newFixture.awayTeamId}
            onChange={(e) =>
              setNewFixture((s) => ({ ...s, awayTeamId: e.target.value }))
            }
          >
            <option value="">Away…</option>
            {groupTeams
              .filter((t) => t.id !== newFixture.homeTeamId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <input
            className="input-field"
            type="datetime-local"
            value={newFixture.kickoffAt}
            onChange={(e) =>
              setNewFixture((s) => ({ ...s, kickoffAt: e.target.value }))
            }
          />
          <input
            className="input-field"
            type="number"
            min={1}
            max={6}
            placeholder="MD"
            value={newFixture.matchday}
            onChange={(e) =>
              setNewFixture((s) => ({ ...s, matchday: e.target.value }))
            }
          />
          <button
            className="btn btn-primary"
            onClick={addFixture}
            disabled={busy === "add-fixture" || groupTeams.length < 2}
          >
            <Plus size={15} /> Add
          </button>
        </div>
        {groupTeams.length < 2 && (
          <p
            style={{
              margin: "0.6rem 0 0",
              fontSize: "0.75rem",
              color: "hsl(38 90% 60%)",
            }}
          >
            Group {newFixture.groupKey} needs at least two nations before it can
            have a fixture.
          </p>
        )}
      </div>

      {byMatchday.map(([md, list]) => (
        <div key={md} className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
            {md === "—" ? "No matchday" : `Matchday ${md}`}{" "}
            <span
              style={{
                fontWeight: 400,
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.8rem",
              }}
            >
              · {list.length} fixtures
            </span>
          </h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {list.map((f) => {
              const home = teamById.get(f.homeTeamId)
              const away = teamById.get(f.awayTeamId)
              const d = draftFor(f)
              const status = f.market?.status ?? null
              return (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.6rem",
                    borderRadius: 8,
                    background: "hsl(var(--muted) / 0.25)",
                  }}
                >
                  <div style={{ minWidth: 230, flex: "1 1 230px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      {home?.name ?? "?"} vs {away?.name ?? "?"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "hsl(var(--muted-foreground))",
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <span>Group {f.groupKey} ·</span>
                      {/* Kickoff is editable because fixtures genuinely move,
                          and once a market exists the fixture cannot be
                          deleted and re-added. Betting closes at kickoff, so
                          saving here moves the market's deadline too — the
                          backend refuses once the market is past CLOSED,
                          where there is no way back. */}
                      {editingTime === f.id ? (
                        <>
                          <input
                            className="input-field"
                            type="datetime-local"
                            style={{
                              padding: "0.2rem 0.35rem",
                              fontSize: "0.72rem",
                            }}
                            value={timeDraft}
                            onChange={(e) => setTimeDraft(e.target.value)}
                          />
                          <button
                            className="btn btn-ghost"
                            style={{
                              padding: "0.2rem 0.5rem",
                              fontSize: "0.7rem",
                            }}
                            disabled={busy === `time-${f.id}`}
                            onClick={() =>
                              run(
                                `time-${f.id}`,
                                async () => {
                                  await api.updateUnlFixture(f.id, {
                                    kickoffAt: new Date(
                                      timeDraft
                                    ).toISOString(),
                                  })
                                  setEditingTime(null)
                                },
                                "Kickoff moved."
                              )
                            }
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{
                              padding: "0.2rem 0.5rem",
                              fontSize: "0.7rem",
                            }}
                            onClick={() => setEditingTime(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-ghost"
                          style={{
                            padding: "0.1rem 0.3rem",
                            fontSize: "0.72rem",
                            color: "inherit",
                          }}
                          title="Move kickoff"
                          onClick={() => {
                            setEditingTime(f.id)
                            setTimeDraft(toLocalInput(f.kickoffAt))
                          }}
                        >
                          {fmtKickoff(f.kickoffAt)}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Score entry — no market side effects. */}
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    style={{ width: 56, textAlign: "center" }}
                    value={d.home}
                    onChange={(e) =>
                      setScoreDraft((s) => ({
                        ...s,
                        [f.id]: { ...d, home: e.target.value },
                      }))
                    }
                  />
                  <span style={{ opacity: 0.5 }}>–</span>
                  <input
                    className="input-field"
                    type="number"
                    min={0}
                    style={{ width: 56, textAlign: "center" }}
                    value={d.away}
                    onChange={(e) =>
                      setScoreDraft((s) => ({
                        ...s,
                        [f.id]: { ...d, away: e.target.value },
                      }))
                    }
                  />
                  <select
                    className="input-field"
                    style={{ width: 150 }}
                    value={d.status}
                    onChange={(e) =>
                      setScoreDraft((s) => ({
                        ...s,
                        [f.id]: { ...d, status: e.target.value },
                      }))
                    }
                  >
                    {FIXTURE_STATUSES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-ghost"
                    disabled={busy === `score-${f.id}`}
                    onClick={() => saveScore(f)}
                  >
                    Save score
                  </button>

                  {/* Market state and the actions it permits. */}
                  {status ? (
                    <Badge
                      text={status}
                      colour={STATUS_COLOUR[status] ?? "hsl(220 10% 60%)"}
                    />
                  ) : (
                    <button
                      className="btn btn-ghost"
                      disabled={busy === `mkt-${f.id}`}
                      onClick={() =>
                        run(
                          `mkt-${f.id}`,
                          () => api.createUnlMarket(f.id),
                          "Market created."
                        )
                      }
                    >
                      <Trophy size={14} /> Create market
                    </button>
                  )}

                  {f.market?.proposedOutcomeId && status === "resolving" && (
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "hsl(38 90% 60%)",
                      }}
                    >
                      Proposed · awaiting your resolve
                    </span>
                  )}

                  {f.canPropose && (
                    <button
                      className="btn btn-primary"
                      disabled={busy === `prop-${f.id}`}
                      onClick={() =>
                        setConfirm({
                          title: "Propose this result?",
                          message:
                            `${home?.name} ${f.homeScore}–${f.awayScore} ${away?.name}\n\n` +
                            `This proposes "${f.proposedLabel}" as the winner and opens a ` +
                            `60-minute objection window.\n\n` +
                            `Nothing settles on its own when the window closes — you ` +
                            `resolve it yourself afterwards, with evidence.`,
                          confirmLabel: "Propose",
                          onConfirm: () => {
                            setConfirm(null)
                            run(
                              `prop-${f.id}`,
                              () => api.proposeUnlResult(f.id, 60),
                              `Proposed ${f.proposedLabel}.`
                            )
                          },
                        })
                      }
                    >
                      Propose {f.proposedLabel}
                    </button>
                  )}

                  {!f.marketId && (
                    <button
                      className="btn btn-ghost"
                      title="Delete fixture"
                      disabled={busy === `del-fx-${f.id}`}
                      onClick={() =>
                        setConfirm({
                          title: "Delete this fixture?",
                          message: `${home?.name} vs ${away?.name} will be removed, along with its contribution to the group table.`,
                          confirmLabel: "Delete",
                          variant: "danger",
                          onConfirm: () => {
                            setConfirm(null)
                            run(
                              `del-fx-${f.id}`,
                              () => api.deleteUnlFixture(f.id),
                              "Fixture deleted."
                            )
                          },
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  {warnings[f.id] && (
                    <div
                      style={{
                        flexBasis: "100%",
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "flex-start",
                        padding: "0.6rem",
                        borderRadius: 8,
                        background: "hsl(0 60% 20% / 0.5)",
                        border: "1px solid hsl(0 60% 40%)",
                        fontSize: "0.78rem",
                        lineHeight: 1.45,
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        style={{ flexShrink: 0, marginTop: 1 }}
                      />
                      <span>{warnings[f.id]}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {fixtures.length === 0 && !loading && (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No fixtures for {season} yet.
        </div>
      )}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "teams", label: "Teams", icon: <Flag size={15} /> },
    { id: "fixtures", label: "Fixtures", icon: <CalendarDays size={15} /> },
    { id: "stats", label: "Stats", icon: <BarChart3 size={15} /> },
  ]

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Nations League</h1>
        <input
          className="input-field"
          style={{ width: 120 }}
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          title="Edition, e.g. 2026-27"
        />
        <button
          className="btn btn-ghost"
          onClick={() => load(season)}
          disabled={loading}
        >
          <RefreshCw size={15} /> Refresh
        </button>
        {info && (
          <span
            style={{
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {info.teamCount} nations · {info.groupCount} groups ·{" "}
            {info.started ? `matchday ${info.maxPlayed} played` : "not started"}
          </span>
        )}
      </div>

      <p
        style={{
          margin: "0 0 1rem",
          fontSize: "0.8rem",
          color: "hsl(var(--muted-foreground))",
          maxWidth: 820,
          lineHeight: 1.5,
        }}
      >
        This competition has no data feed — everything the app shows comes from
        this page. Saving a score does <strong>not</strong> touch the market, so
        a mistyped score is free to fix; proposing is a separate step, and
        nothing settles by itself when the objection window closes.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "btn btn-primary" : "btn btn-ghost"}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div
          className="glass-card"
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            border: "1px solid hsl(0 60% 40%)",
            color: "hsl(0 70% 70%)",
          }}
        >
          {err}
        </div>
      )}

      {loading && tab !== "stats" ? (
        <div
          className="glass-card"
          style={{ padding: "2rem", textAlign: "center" }}
        >
          Loading…
        </div>
      ) : tab === "teams" ? (
        TeamsTab
      ) : tab === "fixtures" ? (
        FixturesTab
      ) : (
        <StatBoardEditor league="unl" leagueLabel="Nations League" />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.variant}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
      {ToastContainer}
    </div>
  )
}
