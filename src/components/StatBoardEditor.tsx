import { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

type Board = "goals" | "assists"

interface Override {
  id: string
  board: Board
  player: string
  club: string
  face: string
  value: number
  /**
   * The number the live feed is reporting for this player, when it reports one
   * at all. Non-null means this row is being overruled — the feed is
   * authoritative and the admin's value is not what the board shows.
   */
  shadowedByFeed: number | null
}

const BOARDS: { key: Board; label: string; word: string }[] = [
  { key: "goals", label: "Top Scorer", word: "goals" },
  { key: "assists", label: "Most Assists", word: "assists" },
]

const inputStyle: React.CSSProperties = {
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  fontSize: "0.85rem",
}

/**
 * Add and edit the players on a league's goals/assists leaderboards.
 *
 * These boards come live from football-data.org, and on the free tier they are
 * thin — /scorers is goal-ranked, so a player with assists but few goals never
 * appears. Since the app's Stats tab renders rows from the board and attaches
 * betting only where a market outcome matches one, a missing player is both
 * invisible and unbettable. This is how an admin fills that gap.
 *
 * Two things this deliberately does NOT do:
 *
 *  • Override a player the feed already reports. The provider stays
 *    authoritative, so those rows are kept but marked as overruled rather than
 *    silently having no effect.
 *  • Make a player bettable on save. Writing an outcome into a market people
 *    already hold positions in is a second, explicit click.
 */
export default function StatBoardEditor({
  league,
  leagueLabel,
}: {
  league: "epl" | "ucl"
  leagueLabel: string
}) {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [rows, setRows] = useState<Override[]>([])
  const [season, setSeason] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})

  const [board, setBoard] = useState<Board>("goals")
  const [player, setPlayer] = useState("")
  const [club, setClub] = useState("")
  const [face, setFace] = useState("")
  const [value, setValue] = useState("")

  const load = async () => {
    setErr(null)
    try {
      const res = (await api.getStatOverrides(league)) as {
        season?: string
        overrides?: Override[]
      }
      setRows(Array.isArray(res?.overrides) ? res.overrides : [])
      setSeason(res?.season ?? "")
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league])

  const save = async (
    body: {
      board: Board
      player: string
      club?: string
      face?: string
      value: number
    },
    key: string
  ) => {
    setBusy(key)
    setNote((n) => ({ ...n, [key]: "" }))
    try {
      await api.saveStatOverride(league, body)
      await load()
      setNote((n) => ({ ...n, [key]: "✓ Saved" }))
    } catch (e: unknown) {
      setNote((n) => ({
        ...n,
        [key]: e instanceof Error ? e.message : "Failed to save",
      }))
    } finally {
      setBusy(null)
    }
  }

  const addPlayer = async () => {
    const v = Number(value)
    if (player.trim().length < 2) {
      setNote((n) => ({ ...n, new: "Enter the player's name" }))
      return
    }
    if (!Number.isFinite(v) || v < 0) {
      setNote((n) => ({ ...n, new: "Enter a number" }))
      return
    }
    await save({ board, player: player.trim(), club, face, value: v }, "new")
    setPlayer("")
    setClub("")
    setFace("")
    setValue("")
  }

  const remove = async (row: Override) => {
    setBusy(row.id)
    try {
      await api.deleteStatOverride(league, row.id)
      await load()
    } catch (e: unknown) {
      setNote((n) => ({
        ...n,
        [row.id]: e instanceof Error ? e.message : "Failed to remove",
      }))
    } finally {
      setBusy(null)
    }
  }

  const openBetting = async (row: Override) => {
    setBusy(row.id)
    setNote((n) => ({ ...n, [row.id]: "" }))
    try {
      await api.openBettingOnStatOverride(league, row.id)
      setNote((n) => ({
        ...n,
        [row.id]: "✓ Added to the market — bettable on the Stats tab now.",
      }))
    } catch (e: unknown) {
      setNote((n) => ({
        ...n,
        [row.id]: e instanceof Error ? e.message : "Failed",
      }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "0.25rem" }}>
        Board editor — add a player
      </h2>
      <p
        style={{
          color: "hsl(var(--muted-foreground))",
          marginBottom: "1rem",
          fontSize: "0.9rem",
          maxWidth: 760,
        }}
      >
        The {leagueLabel} goals and assists boards come from the live provider,
        and its free tier is goal-ranked — a player with assists but few goals
        never shows up at all. Players added here fill those gaps and appear on
        the app's Stats tab immediately.{" "}
        <strong>The provider stays authoritative:</strong> if it already reports
        a player, its number is the one on the board and a manual entry for them
        is kept but not applied. Adding a player here does not open betting on
        them — that is the separate button on each row.
        {season && (
          <>
            {" "}
            Entries are scoped to the{" "}
            <strong>
              {season}/{String(Number(season) + 1).slice(2)}
            </strong>{" "}
            season.
          </>
        )}
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

      {/* Add form */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
          padding: "1rem",
          border: "1px solid hsl(var(--border))",
          borderRadius: 10,
          marginBottom: "1.25rem",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Board
          </span>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value as Board)}
            style={inputStyle}
          >
            {BOARDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: "1 1 200px",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Player
          </span>
          <input
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            placeholder="e.g. Bukayo Saka"
            style={inputStyle}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: "0 1 160px",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Club
          </span>
          <input
            value={club}
            onChange={(e) => setClub(e.target.value)}
            placeholder="optional"
            style={inputStyle}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: "1 1 200px",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Photo URL
          </span>
          <input
            value={face}
            onChange={(e) => setFace(e.target.value)}
            placeholder="optional"
            style={inputStyle}
          />
        </label>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: "0 1 90px",
          }}
        >
          <span
            style={{
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {BOARDS.find((b) => b.key === board)?.word ?? "value"}
          </span>
          <input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={inputStyle}
          />
        </label>
        <button
          onClick={() => void addPlayer()}
          disabled={busy === "new"}
          style={{
            padding: "0.55rem 1.1rem",
            borderRadius: 8,
            border: "none",
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontWeight: 600,
            cursor: busy === "new" ? "not-allowed" : "pointer",
            opacity: busy === "new" ? 0.6 : 1,
          }}
        >
          {busy === "new" ? "Saving…" : "Add / update"}
        </button>
        {note.new && (
          <span style={{ fontSize: "0.82rem", alignSelf: "center" }}>
            {note.new}
          </span>
        )}
      </div>

      {/* Existing */}
      {loading ? (
        <div style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div
          style={{
            color: "hsl(var(--muted-foreground))",
            padding: "1rem",
            border: "1px dashed hsl(var(--border))",
            borderRadius: 10,
            fontSize: "0.9rem",
          }}
        >
          No manually added players. The boards are showing exactly what the
          provider reports.
        </div>
      ) : (
        BOARDS.map((b) => {
          const forBoard = rows.filter((r) => r.board === b.key)
          if (forBoard.length === 0) return null
          return (
            <div key={b.key} style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                {b.label}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {forBoard.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0.6rem 0.9rem",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600, minWidth: 160 }}>
                      {r.player}
                    </span>
                    {r.club && (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {r.club}
                      </span>
                    )}
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.value}
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (!Number.isFinite(v) || v === r.value) return
                        void save(
                          {
                            board: r.board,
                            player: r.player,
                            club: r.club,
                            face: r.face,
                            value: v,
                          },
                          r.id
                        )
                      }}
                      style={{ ...inputStyle, width: 80 }}
                    />
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {b.word}
                    </span>

                    {r.shadowedByFeed !== null && (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          padding: "0.25rem 0.55rem",
                          borderRadius: 999,
                          background: "#d977061a",
                          color: "#d97706",
                          border: "1px solid #d9770655",
                        }}
                        title="The live provider reports this player, and the provider wins. Your value is stored but is not what the board shows."
                      >
                        Provider reports {r.shadowedByFeed} — not applied
                      </span>
                    )}

                    <div
                      style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                    >
                      <button
                        onClick={() => void openBetting(r)}
                        disabled={busy === r.id}
                        style={{
                          padding: "0.4rem 0.8rem",
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          background: "transparent",
                          color: "hsl(var(--foreground))",
                          cursor: busy === r.id ? "not-allowed" : "pointer",
                          fontSize: "0.82rem",
                        }}
                        title="Adds this player to the open stat market as a bettable outcome"
                      >
                        Open betting
                      </button>
                      <button
                        onClick={() => void remove(r)}
                        disabled={busy === r.id}
                        style={{
                          padding: "0.4rem 0.8rem",
                          borderRadius: 8,
                          border: "1px solid hsl(var(--destructive) / 0.4)",
                          background: "transparent",
                          color: "hsl(var(--destructive))",
                          cursor: busy === r.id ? "not-allowed" : "pointer",
                          fontSize: "0.82rem",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    {note[r.id] && (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          flexBasis: "100%",
                          color: note[r.id].startsWith("✓")
                            ? "#16a34a"
                            : "hsl(var(--destructive))",
                        }}
                      >
                        {note[r.id]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
