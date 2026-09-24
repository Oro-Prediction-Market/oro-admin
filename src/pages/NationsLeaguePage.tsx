import { useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Flag,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  AlertTriangle,
  BarChart3,
  ListChecks,
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

interface FixturePreview {
  resolved: {
    groupKey: string
    homeName: string
    awayName: string
    kickoffAt: string
    matchday: number | null
    /** Why this line will be skipped, or null when it will be created. */
    problem: string | null
  }[]
  errors: string[]
  created: number
}

interface BulkPreview {
  parsed: {
    groupKey: string
    name: string
    flagUrl: string | null
    unknownNation: boolean
  }[]
  errors: string[]
  created: number
  skipped: { name: string; groupKey: string; reason: string }[]
}

type Tab = "teams" | "fixtures" | "stats"

/** A → N: the fourteen groups, across the four leagues. */
const GROUP_KEYS = "ABCDEFGHIJKLMN".split("")

/**
 * What an admin actually has to decide.
 *
 * The stored status has four values, but two of them are not choices:
 * `scheduled` and `finished` follow from whether a score exists, and the
 * backend infers them when no status is sent. Offering all four made the
 * ordinary case — type the score, save — look like a decision with a wrong
 * answer available.
 *
 * Only two cases carry information the score cannot:
 *
 *  - **Awarded**: UEFA decided the result rather than the pitch, typically
 *    3-0 after a forfeit. The score is entered normally and counts in the
 *    table exactly like any other; this only records that it was
 *    administrative.
 *  - **Postponed**: rearranged rather than simply not played yet. Scores stay
 *    empty either way, so the table is identical — this is for the admin's
 *    benefit, not the arithmetic's.
 */
const RESULT_KINDS = [
  { value: "", label: "Normal" },
  { value: "awarded", label: "Awarded (walkover)" },
  { value: "postponed", label: "Postponed" },
]

/** Small caption over a form field, so a narrow control still says what it is. */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "hsl(var(--muted-foreground))",
        marginBottom: "0.25rem",
      }}
    >
      {children}
    </label>
  )
}

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
  /** What is in the box. `season` is what has actually been loaded. */
  const [seasonInput, setSeasonInput] = useState(defaultSeason())
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

  /**
   * Deliberately a plain function, not a useCallback keyed on `api`.
   *
   * `useAdminApi` returns a fresh object literal every render (it spreads a
   * memoised `api` alongside its own `loading`/`error` state), so `api` is
   * never referentially stable. A `useCallback(..., [api])` therefore produces
   * a new `load` on every render, and an effect depending on it re-fires on
   * every render — which loops: fetch → setState → render → fetch. It shows up
   * as "You're doing that too quickly" from the global 120 req/min throttler,
   * not as an obvious infinite loop.
   *
   * Every other admin page avoids this the same way: a plain function plus an
   * effect that lists only the values that should actually re-trigger it.
   */
  const load = async (target: string) => {
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
  }

  // Only when the edition actually changes.
  useEffect(() => {
    void load(season)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season])

  // Adopt the edition already in the database, so a fresh page does not sit on
  // a computed guess while real data exists under a different key.
  useEffect(() => {
    if (info?.season && info.season !== season) {
      setSeason(info.season)
      setSeasonInput(info.season)
    }
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

  // ── Bulk: paste a draw ───────────────────────────────────────────────────

  const [bulkText, setBulkText] = useState("")
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null)

  const previewBulk = async () => {
    if (!bulkText.trim()) {
      notify("error", "Paste the draw first.")
      return
    }
    setBusy("bulk-preview")
    try {
      const res = (await api.bulkCreateUnlTeams({
        season,
        text: bulkText,
        dryRun: true,
      })) as BulkPreview
      setBulkPreview(res)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const commitBulk = async () => {
    setBusy("bulk-commit")
    try {
      const res = (await api.bulkCreateUnlTeams({
        season,
        text: bulkText,
        dryRun: false,
      })) as BulkPreview
      notify(
        "success",
        `${res.created} nation(s) added` +
          (res.skipped.length ? `, ${res.skipped.length} already there.` : ".")
      )
      setBulkText("")
      setBulkPreview(null)
      await load(season)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const TeamsTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Paste the whole draw. Previewed before anything is written, because
          this is the one action that creates fifty-odd rows at once and the
          names become market outcome labels that cannot be renamed later. */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Paste the draw
        </h3>
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.78rem",
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1.5,
          }}
        >
          One line per group. Flags fill in automatically for every UEFA nation,
          so you only type names. Re-pasting later tops up what is missing
          rather than duplicating.
        </p>
        <textarea
          className="input-field"
          style={{
            width: "100%",
            minHeight: 130,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.82rem",
            lineHeight: 1.6,
            resize: "vertical",
          }}
          spellCheck={false}
          placeholder={`A: France, Italy, Belgium, Türkiye\nB: Spain, Netherlands, Denmark, Czechia\nC: Portugal, Croatia, Poland, Scotland`}
          value={bulkText}
          onChange={(e) => {
            setBulkText(e.target.value)
            setBulkPreview(null)
          }}
        />
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "0.6rem",
            alignItems: "center",
          }}
        >
          <button
            className="secondary"
            onClick={previewBulk}
            disabled={busy === "bulk-preview"}
          >
            <ListChecks size={15} /> Preview
          </button>
          {bulkPreview && bulkPreview.created > 0 && (
            <button onClick={commitBulk} disabled={busy === "bulk-commit"}>
              <Plus size={15} /> Add {bulkPreview.created} nation
              {bulkPreview.created === 1 ? "" : "s"}
            </button>
          )}
        </div>

        {bulkPreview && (
          <div style={{ marginTop: "0.85rem" }}>
            {bulkPreview.errors.length > 0 && (
              <div
                style={{
                  marginBottom: "0.6rem",
                  padding: "0.6rem 0.7rem",
                  borderRadius: 8,
                  background: "hsl(0 60% 20% / 0.45)",
                  border: "1px solid hsl(0 60% 40%)",
                  fontSize: "0.78rem",
                  lineHeight: 1.5,
                }}
              >
                {bulkPreview.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            {bulkPreview.parsed.length === 0 ? (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                Nothing recognised yet.
              </p>
            ) : (
              <>
                <p
                  style={{
                    margin: "0 0 0.5rem",
                    fontSize: "0.78rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {bulkPreview.created} to add
                  {bulkPreview.skipped.length > 0 &&
                    `, ${bulkPreview.skipped.length} already in the group`}
                  .
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                  }}
                >
                  {bulkPreview.parsed.map((t, i) => {
                    const dup = bulkPreview.skipped.some(
                      (sk) => sk.name === t.name && sk.groupKey === t.groupKey
                    )
                    return (
                      <span
                        key={`${t.groupKey}-${t.name}-${i}`}
                        title={
                          dup
                            ? "Already in that group — will be skipped"
                            : t.unknownNation
                              ? "Not a UEFA nation we recognise. It will still be added, but with no flag — check the spelling."
                              : undefined
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 7,
                          fontSize: "0.76rem",
                          background: dup
                            ? "hsl(var(--muted) / 0.3)"
                            : t.unknownNation
                              ? "hsl(38 90% 20% / 0.5)"
                              : "hsl(160 60% 20% / 0.4)",
                          border: `1px solid ${
                            dup
                              ? "transparent"
                              : t.unknownNation
                                ? "hsl(38 90% 45%)"
                                : "hsl(160 60% 35%)"
                          }`,
                          opacity: dup ? 0.5 : 1,
                          textDecoration: dup ? "line-through" : undefined,
                        }}
                      >
                        {t.flagUrl ? (
                          <img
                            src={t.flagUrl}
                            alt=""
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        <strong style={{ opacity: 0.6 }}>{t.groupKey}</strong>
                        {t.name}
                      </span>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
          Add one nation
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "130px 1fr 1.4fr auto",
            gap: "0.5rem",
            alignItems: "end",
          }}
        >
          <div>
            <FieldLabel>Group</FieldLabel>
            <select
              className="input-field"
              style={{ width: "100%" }}
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
          </div>
          <div>
            <FieldLabel>Nation</FieldLabel>
            <input
              className="input-field"
              style={{ width: "100%" }}
              placeholder="e.g. Republic of Ireland"
              value={newTeam.name}
              onChange={(e) =>
                setNewTeam((s) => ({ ...s, name: e.target.value }))
              }
              onKeyDown={(e) => e.key === "Enter" && addTeam()}
            />
          </div>
          <div>
            <FieldLabel>Flag URL (optional)</FieldLabel>
            <input
              className="input-field"
              style={{ width: "100%" }}
              placeholder="https://flagcdn.com/w320/ie.png"
              value={newTeam.flagUrl}
              onChange={(e) =>
                setNewTeam((s) => ({ ...s, flagUrl: e.target.value }))
              }
            />
          </div>
          <button onClick={addTeam} disabled={busy === "add-team"}>
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
                  className="secondary"
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

  // ── Bulk: paste a fixture list ───────────────────────────────────────────

  const [fxText, setFxText] = useState("")
  const [fxPreview, setFxPreview] = useState<FixturePreview | null>(null)

  const previewFixtures = async () => {
    if (!fxText.trim()) {
      notify("error", "Paste the fixture list first.")
      return
    }
    setBusy("fx-preview")
    try {
      const res = (await api.bulkCreateUnlFixtures({
        season,
        text: fxText,
        dryRun: true,
      })) as FixturePreview
      setFxPreview(res)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const commitFixtures = async () => {
    setBusy("fx-commit")
    try {
      const res = (await api.bulkCreateUnlFixtures({
        season,
        text: fxText,
        dryRun: false,
      })) as FixturePreview
      notify("success", `${res.created} fixture(s) added.`)
      setFxText("")
      setFxPreview(null)
      await load(season)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const draftFor = (f: Fixture) =>
    scoreDraft[f.id] ?? {
      home: f.homeScore == null ? "" : String(f.homeScore),
      away: f.awayScore == null ? "" : String(f.awayScore),
      // "" means Normal — scheduled and finished are inferred from the score
      // rather than chosen, so they never appear as a selection.
      status:
        f.status === "awarded" || f.status === "postponed" ? f.status : "",
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
        // Omitted for "Normal", so the backend derives scheduled/finished
        // from whether a score is present.
        status: d.status || undefined,
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
      {/* Paste the fixture list, the same way the draw is entered. Previewed
          first: a kickoff is also the market's betting deadline, so a
          mistyped date is a market that stops taking bets at the wrong
          moment. */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
          Paste the fixtures
        </h3>
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "0.78rem",
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1.6,
          }}
        >
          One line per match:{" "}
          <code style={{ fontSize: "0.76rem" }}>
            group | home | away | kickoff | matchday
          </code>
          . The matchday is optional, and “France vs Italy” in one field works
          too. Dates must be <strong>YYYY-MM-DD HH:MM</strong> and are read in
          your own timezone — kickoff is also when betting closes.
        </p>
        <textarea
          className="input-field"
          style={{
            width: "100%",
            minHeight: 140,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.82rem",
            lineHeight: 1.6,
            resize: "vertical",
          }}
          spellCheck={false}
          placeholder={`A | France | Italy | 2026-09-04 20:45 | 1\nA | Belgium | Türkiye | 2026-09-04 20:45 | 1\nA | France | Belgium | 2026-09-07 20:45 | 2`}
          value={fxText}
          onChange={(e) => {
            setFxText(e.target.value)
            setFxPreview(null)
          }}
        />
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginTop: "0.6rem",
            alignItems: "center",
          }}
        >
          <button
            className="secondary"
            onClick={previewFixtures}
            disabled={busy === "fx-preview"}
          >
            <ListChecks size={15} /> Preview
          </button>
          {fxPreview && fxPreview.created > 0 && (
            <button onClick={commitFixtures} disabled={busy === "fx-commit"}>
              <Plus size={15} /> Add {fxPreview.created} fixture
              {fxPreview.created === 1 ? "" : "s"}
            </button>
          )}
        </div>

        {fxPreview && (
          <div style={{ marginTop: "0.85rem" }}>
            {fxPreview.errors.length > 0 && (
              <div
                style={{
                  marginBottom: "0.6rem",
                  padding: "0.6rem 0.7rem",
                  borderRadius: 8,
                  background: "hsl(0 60% 20% / 0.45)",
                  border: "1px solid hsl(0 60% 40%)",
                  fontSize: "0.78rem",
                  lineHeight: 1.5,
                }}
              >
                {fxPreview.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            {fxPreview.resolved.length === 0 ? (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                Nothing recognised yet.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                }}
              >
                {fxPreview.resolved.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.4rem 0.6rem",
                      borderRadius: 7,
                      fontSize: "0.78rem",
                      background: r.problem
                        ? "hsl(38 90% 20% / 0.35)"
                        : "hsl(160 60% 20% / 0.35)",
                      border: `1px solid ${
                        r.problem ? "hsl(38 90% 45%)" : "hsl(160 60% 35%)"
                      }`,
                    }}
                  >
                    <strong style={{ opacity: 0.6, width: 18 }}>
                      {r.groupKey}
                    </strong>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {r.homeName} vs {r.awayName}
                    </span>
                    {/* The resolved instant, formatted — so a timezone or
                        date mistake is visible before anything is written. */}
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>
                      {fmtKickoff(r.kickoffAt)}
                    </span>
                    <span
                      style={{
                        width: 44,
                        textAlign: "right",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {r.matchday ? `MD${r.matchday}` : "—"}
                    </span>
                    {r.problem && (
                      <span
                        style={{
                          color: "hsl(38 90% 65%)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.problem}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Add one fixture */}
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
          Add one fixture
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "130px 1fr 1fr 210px 90px auto",
            gap: "0.5rem",
            alignItems: "end",
          }}
        >
          <div>
            <FieldLabel>Group</FieldLabel>
            <select
              className="input-field"
              style={{ width: "100%" }}
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
          </div>
          {/* Both selects are scoped to the chosen group: the group stage has
              no cross-group fixtures, so offering one would only allow a
              mistake the backend then rejects. */}
          <div>
            <FieldLabel>Home</FieldLabel>
            <select
              className="input-field"
              style={{ width: "100%" }}
              value={newFixture.homeTeamId}
              onChange={(e) =>
                setNewFixture((s) => ({ ...s, homeTeamId: e.target.value }))
              }
            >
              <option value="">Pick a nation…</option>
              {groupTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Away</FieldLabel>
            <select
              className="input-field"
              style={{ width: "100%" }}
              value={newFixture.awayTeamId}
              onChange={(e) =>
                setNewFixture((s) => ({ ...s, awayTeamId: e.target.value }))
              }
            >
              <option value="">Pick a nation…</option>
              {groupTeams
                .filter((t) => t.id !== newFixture.homeTeamId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <FieldLabel>Kickoff · betting closes</FieldLabel>
            <input
              className="input-field"
              style={{ width: "100%" }}
              type="datetime-local"
              value={newFixture.kickoffAt}
              onChange={(e) =>
                setNewFixture((s) => ({ ...s, kickoffAt: e.target.value }))
              }
            />
          </div>
          <div>
            <FieldLabel>Matchday</FieldLabel>
            <input
              className="input-field"
              style={{ width: "100%" }}
              type="number"
              min={1}
              max={6}
              value={newFixture.matchday}
              onChange={(e) =>
                setNewFixture((s) => ({ ...s, matchday: e.target.value }))
              }
            />
          </div>
          <button
            onClick={addFixture}
            disabled={busy === "add-fixture" || groupTeams.length < 2}
          >
            <Plus size={15} /> Add
          </button>
        </div>
        <p
          style={{
            margin: "0.7rem 0 0",
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
            lineHeight: 1.5,
          }}
        >
          Kickoff is also when betting closes. Leave the result kind on{" "}
          <strong>Normal</strong> for every ordinary match — a fixture counts as
          played once it has a score, and as not played while it has none. Use{" "}
          <strong>Awarded</strong> only when UEFA decided the result off the
          pitch (a 3-0 walkover), and <strong>Postponed</strong> only when a
          match has been rearranged.
        </p>
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
                            className="secondary"
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
                            className="secondary"
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
                          className="secondary"
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
                    {RESULT_KINDS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary"
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
                      className="secondary"
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
                      className="secondary"
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
    <div
      className="unl-page"
      style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}
    >
      <style>{`
        /* The app's global button rule is not a flex container, so a lucide
           icon followed by a text label wraps onto a second line. Every button
           on this page carries an icon, so scope the fix here rather than
           changing a rule the rest of the dashboard is already laid out around. */
        .unl-page button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          white-space: nowrap;
        }
        .unl-page button svg { flex-shrink: 0; }
      `}</style>
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
        {/* Committed on blur or Enter, not per keystroke. `season` drives the
            reload effect, so binding it straight to onChange would fire a
            three-endpoint refetch for every character typed. */}
        <input
          className="input-field"
          style={{ width: 120 }}
          value={seasonInput}
          onChange={(e) => setSeasonInput(e.target.value)}
          onBlur={() => {
            const v = seasonInput.trim()
            if (v && v !== season) setSeason(v)
            else setSeasonInput(season)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            if (e.key === "Escape") setSeasonInput(season)
          }}
          title="Edition, e.g. 2026-27 — press Enter to load it"
        />
        <button
          className="secondary"
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
            className={tab === t.id ? undefined : "secondary"}
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
