import { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

type Board = "goals" | "assists"

interface BoardRow {
  player: string
  club: string
  face: string
  /** What the board is showing — the edited value where one exists. */
  value: number
  /** What the provider reports. Null when it doesn't carry this player. */
  feedValue: number | null
  feedFace: string | null
  overrideId: string | null
  valueEdited: boolean
  faceEdited: boolean
  isManual: boolean
}

const BOARDS: { key: Board; label: string; word: string }[] = [
  { key: "goals", label: "Top Scorer", word: "goals" },
  { key: "assists", label: "Most Assists", word: "assists" },
]

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.55rem",
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  fontSize: "0.85rem",
}

const btn = (kind: "ghost" | "danger" = "ghost"): React.CSSProperties => ({
  padding: "0.35rem 0.7rem",
  borderRadius: 8,
  border:
    kind === "danger"
      ? "1px solid hsl(var(--destructive) / 0.4)"
      : "1px solid hsl(var(--border))",
  background: "transparent",
  color:
    kind === "danger" ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
  cursor: "pointer",
  fontSize: "0.78rem",
  whiteSpace: "nowrap",
})

/**
 * The league's goals/assists leaderboards, as an editable table.
 *
 * The provider fills these boards and stays the default for every row. An
 * admin edit pins that one field — the number, or the photo — until it is
 * reset, at which point the field follows the provider again. Editing is per
 * field on purpose: correcting a wrong player photo must not also freeze the
 * goal count, which would go stale the moment the player scored.
 *
 * Players the provider doesn't carry at all can be added by hand. The free
 * tier drops plenty — /scorers is goal-ranked, so a player with assists but
 * few goals never appears — and since the app's Stats tab renders rows from
 * the board and attaches betting only where a market outcome matches one,
 * those players are invisible AND unbettable.
 *
 * Adding or editing never touches a market. "Open betting" is a separate
 * button, because it writes an outcome into a parimutuel market people
 * already hold positions in.
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

  const [boards, setBoards] = useState<Record<Board, BoardRow[]>>({
    goals: [],
    assists: [],
  })
  const [season, setSeason] = useState("")
  const [tab, setTab] = useState<Board>("goals")
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})

  const [newPlayer, setNewPlayer] = useState("")
  const [newClub, setNewClub] = useState("")
  const [newFace, setNewFace] = useState("")
  const [newValue, setNewValue] = useState("")

  const load = async () => {
    setErr(null)
    try {
      const res = (await api.getStatOverrides(league)) as {
        season?: string
        boards?: Record<Board, BoardRow[]>
      }
      setBoards({
        goals: res?.boards?.goals ?? [],
        assists: res?.boards?.assists ?? [],
      })
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

  const patch = async (
    key: string,
    body: {
      board: Board
      player: string
      value?: number | null
      face?: string | null
      club?: string | null
      isManual?: boolean
    },
    okMsg = "✓ Saved"
  ) => {
    setBusy(key)
    setNote((n) => ({ ...n, [key]: "" }))
    try {
      await api.saveStatOverride(league, body)
      await load()
      setNote((n) => ({ ...n, [key]: okMsg }))
    } catch (e: unknown) {
      setNote((n) => ({
        ...n,
        [key]: e instanceof Error ? e.message : "Failed to save",
      }))
    } finally {
      setBusy(null)
    }
  }

  const reset = async (row: BoardRow) => {
    if (!row.overrideId) return
    setBusy(row.player)
    try {
      await api.deleteStatOverride(league, row.overrideId)
      await load()
    } catch (e: unknown) {
      setNote((n) => ({
        ...n,
        [row.player]: e instanceof Error ? e.message : "Failed to reset",
      }))
    } finally {
      setBusy(null)
    }
  }

  const openBetting = async (row: BoardRow) => {
    if (!row.overrideId) return
    setBusy(row.player)
    setNote((n) => ({ ...n, [row.player]: "" }))
    try {
      await api.openBettingOnStatOverride(league, row.overrideId)
      setNote((n) => ({
        ...n,
        [row.player]: "✓ Added to the market — bettable on the Stats tab now.",
      }))
    } catch (e: unknown) {
      setNote((n) => ({
        ...n,
        [row.player]: e instanceof Error ? e.message : "Failed",
      }))
    } finally {
      setBusy(null)
    }
  }

  const addPlayer = async () => {
    const v = Number(newValue)
    if (newPlayer.trim().length < 2) {
      setNote((n) => ({ ...n, new: "Enter the player's name" }))
      return
    }
    if (!Number.isFinite(v) || v <= 0) {
      setNote((n) => ({
        ...n,
        new: "Enter a number — a player the provider doesn't carry has nothing to rank them by otherwise",
      }))
      return
    }
    await patch("new", {
      board: tab,
      player: newPlayer.trim(),
      club: newClub || null,
      face: newFace || null,
      value: v,
      isManual: true,
    })
    setNewPlayer("")
    setNewClub("")
    setNewFace("")
    setNewValue("")
  }

  const rows = boards[tab]
  const word = BOARDS.find((b) => b.key === tab)?.word ?? "value"
  const editedCount = rows.filter((r) => r.valueEdited || r.faceEdited).length

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.15rem", marginBottom: "0.25rem" }}>
        Leaderboard editor
      </h2>
      <p
        style={{
          color: "hsl(var(--muted-foreground))",
          marginBottom: "1rem",
          fontSize: "0.9rem",
          maxWidth: 780,
        }}
      >
        These are the {leagueLabel} boards the app's Stats tab shows, fetched
        live from the provider.{" "}
        <strong>Edit any row and your value sticks</strong> — that field stops
        following the provider until you reset it. The number and the photo are
        pinned separately, so fixing a wrong photo won't freeze the goal count.
        Players the provider doesn't carry can be added at the bottom. Nothing
        here opens betting; that's the per-row button.
        {season && (
          <>
            {" "}
            Edits apply to the{" "}
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

      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        {BOARDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setTab(b.key)}
            style={{
              padding: "0.45rem 1rem",
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: tab === b.key ? "hsl(var(--primary))" : "transparent",
              color:
                tab === b.key
                  ? "hsl(var(--primary-foreground))"
                  : "hsl(var(--foreground))",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            {b.label}
          </button>
        ))}
        {editedCount > 0 && (
          <span
            style={{
              alignSelf: "center",
              fontSize: "0.8rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {editedCount} edited row{editedCount === 1 ? "" : "s"} on this board
          </span>
        )}
      </div>

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
          The provider is returning nothing for this board yet. You can still
          add players by hand below.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r) => (
            <div
              key={r.player}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.5rem 0.75rem",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                flexWrap: "wrap",
              }}
            >
              {r.face ? (
                <img
                  src={r.face}
                  alt=""
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "hsl(var(--muted))",
                    flexShrink: 0,
                  }}
                />
              )}

              <span style={{ fontWeight: 600, minWidth: 150 }}>{r.player}</span>
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "hsl(var(--muted-foreground))",
                  minWidth: 90,
                }}
              >
                {r.club}
              </span>

              <input
                type="number"
                min={0}
                defaultValue={r.value}
                key={`v-${r.player}-${r.value}`}
                onBlur={(e) => {
                  const v = Number(e.target.value)
                  if (!Number.isFinite(v) || v === r.value) return
                  void patch(r.player, {
                    board: tab,
                    player: r.player,
                    value: v,
                    isManual: r.isManual,
                  })
                }}
                style={{ ...inputStyle, width: 72 }}
                title={`${word} shown on the board`}
              />
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {word}
              </span>

              {r.valueEdited && r.feedValue !== null && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: 999,
                    background: "#2563eb1a",
                    color: "#2563eb",
                    border: "1px solid #2563eb55",
                  }}
                  title="Pinned by an admin. The provider still reports the number shown here; reset to follow it again."
                >
                  edited · provider says {r.feedValue}
                </span>
              )}
              {r.isManual && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: 999,
                    background: "#d977061a",
                    color: "#d97706",
                    border: "1px solid #d9770655",
                  }}
                  title="The provider does not carry this player — this row exists because an admin added it."
                >
                  added by hand
                </span>
              )}

              <input
                defaultValue={r.face}
                key={`f-${r.player}-${r.face}`}
                placeholder="photo URL"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v === (r.face ?? "")) return
                  void patch(r.player, {
                    board: tab,
                    player: r.player,
                    face: v || null,
                    isManual: r.isManual,
                  })
                }}
                style={{ ...inputStyle, flex: "1 1 200px", minWidth: 140 }}
                title="Fix a wrong player photo. Clearing it goes back to the provider's."
              />
              {r.faceEdited && (
                <span
                  style={{ fontSize: "0.72rem", color: "#2563eb" }}
                  title="Photo pinned by an admin"
                >
                  photo pinned
                </span>
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {r.isManual && (
                  <button
                    onClick={() => void openBetting(r)}
                    disabled={busy === r.player}
                    style={btn()}
                    title="Adds this player to the open stat market as a bettable outcome"
                  >
                    Open betting
                  </button>
                )}
                {r.overrideId && (
                  <button
                    onClick={() => void reset(r)}
                    disabled={busy === r.player}
                    style={btn("danger")}
                    title={
                      r.isManual
                        ? "Removes this hand-added player from the board"
                        : "Drops your edits — this row follows the provider again"
                    }
                  >
                    {r.isManual ? "Remove" : "Reset to provider"}
                  </button>
                )}
              </div>

              {note[r.player] && (
                <span
                  style={{
                    fontSize: "0.78rem",
                    flexBasis: "100%",
                    color: note[r.player].startsWith("✓")
                      ? "#16a34a"
                      : "hsl(var(--destructive))",
                  }}
                >
                  {note[r.player]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add a player the provider doesn't carry */}
      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          alignItems: "flex-end",
          flexWrap: "wrap",
          padding: "0.9rem",
          border: "1px dashed hsl(var(--border))",
          borderRadius: 10,
          marginTop: "1rem",
        }}
      >
        <div
          style={{
            flexBasis: "100%",
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Add a player the provider doesn't carry — they'll appear on the{" "}
          <strong>{BOARDS.find((b) => b.key === tab)?.label}</strong> board.
        </div>
        <input
          value={newPlayer}
          onChange={(e) => setNewPlayer(e.target.value)}
          placeholder="Player name"
          style={{ ...inputStyle, flex: "1 1 180px" }}
        />
        <input
          value={newClub}
          onChange={(e) => setNewClub(e.target.value)}
          placeholder="Club (optional)"
          style={{ ...inputStyle, flex: "0 1 150px" }}
        />
        <input
          value={newFace}
          onChange={(e) => setNewFace(e.target.value)}
          placeholder="Photo URL (optional)"
          style={{ ...inputStyle, flex: "1 1 180px" }}
        />
        <input
          type="number"
          min={1}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={word}
          style={{ ...inputStyle, flex: "0 1 90px" }}
        />
        <button
          onClick={() => void addPlayer()}
          disabled={busy === "new"}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: 8,
            border: "none",
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontWeight: 600,
            cursor: busy === "new" ? "not-allowed" : "pointer",
            opacity: busy === "new" ? 0.6 : 1,
          }}
        >
          {busy === "new" ? "Saving…" : "Add player"}
        </button>
        {note.new && (
          <span
            style={{
              fontSize: "0.8rem",
              flexBasis: "100%",
              color: note.new.startsWith("✓")
                ? "#16a34a"
                : "hsl(var(--destructive))",
            }}
          >
            {note.new}
          </span>
        )}
      </div>
    </div>
  )
}
