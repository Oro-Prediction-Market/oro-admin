import { useEffect, useState, type CSSProperties } from "react"
import { Trophy } from "lucide-react"

interface SeasonTeam {
  id: string
  groupKey: string
  league: string | null
  name: string
  flagUrl: string | null
}

interface SeasonMarketPreview {
  season: string | null
  teams: SeasonTeam[]
  existing: { id: string; title: string; status: string } | null
}

interface Props {
  getPreview: () => Promise<unknown>
  create: (closesAt: string, teamIds: string[]) => Promise<unknown>
  notify: (type: "success" | "error", message: string) => void
  /** Changes when the draw does, so the list re-reads after a paste. */
  reloadKey: number
}

const muted = "hsl(var(--muted-foreground))"
const LEAGUES = ["A", "B", "C", "D"]

const smallLabel: CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: muted,
  marginBottom: "0.25rem",
}

/**
 * "Who wins the Nations League?" from nations ticked in the draw.
 *
 * Every nation already entered on this page is listed, grouped by league,
 * with its flag; the market gets exactly the ones ticked. Only League A can
 * reach the Finals, hence the shortcut — but the choice is the admin's.
 */
export default function UnlSeasonMarketCard({
  getPreview,
  create,
  notify,
  reloadKey,
}: Props) {
  const [preview, setPreview] = useState<SeasonMarketPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [closesAt, setClosesAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    getPreview()
      .then((p) => {
        if (cancelled) return
        const next = p as SeasonMarketPreview
        setPreview(next)
        setError(null)
        // Drop ticks for nations no longer in the draw.
        const ids = new Set(next.teams.map((t) => t.id))
        setPicked((prev) => new Set([...prev].filter((id) => ids.has(id))))
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
    return () => {
      cancelled = true
    }
    // getPreview is a fresh function every render (see the page's `load`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, refresh])

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    setBusy(true)
    try {
      // datetime-local is local time; the backend wants an instant.
      await create(new Date(closesAt).toISOString(), [...picked])
      notify("success", "Season market created.")
      setClosesAt("")
      setPicked(new Set())
      setRefresh((n) => n + 1)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const teams = preview?.teams ?? []
  const byLeague = [
    ...LEAGUES.map((l) => ({
      key: l,
      title: `League ${l}`,
      teams: teams.filter((t) => t.league === l),
    })),
    {
      key: "other",
      title: "Other groups",
      teams: teams.filter((t) => !t.league),
    },
  ].filter((g) => g.teams.length > 0)
  const noFlag = teams.filter((t) => picked.has(t.id) && !t.flagUrl)

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <h3
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.95rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <Trophy size={16} /> Season market
      </h3>
      <p
        style={{
          margin: "0 0 0.75rem",
          fontSize: "0.78rem",
          color: muted,
          lineHeight: 1.6,
        }}
      >
        Tick the nations to list in “Who wins the Nations League?”. Each gets
        its flag from the draw. Only League A nations can reach the Finals. The
        market shows on the app hub’s Season tab.
      </p>

      {error ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          Couldn't load the nations: {error}
        </div>
      ) : !preview ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>Loading…</div>
      ) : preview.existing ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          Already created: <strong>{preview.existing.title}</strong> (
          {preview.existing.status}). Resolve or cancel it before creating
          another.
        </div>
      ) : teams.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          No nations yet — paste the draw below first.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <button
              className="secondary"
              onClick={() =>
                setPicked(
                  new Set(
                    teams.filter((t) => t.league === "A").map((t) => t.id)
                  )
                )
              }
            >
              Select League A
            </button>
            <button className="secondary" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>

          {byLeague.map((g) => (
            <div key={g.key} style={{ marginBottom: "0.75rem" }}>
              <span style={smallLabel}>{g.title}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {g.teams.map((t) => {
                  const on = picked.has(t.id)
                  return (
                    <label
                      key={t.id}
                      title={`Group ${t.groupKey}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.2rem 0.5rem",
                        borderRadius: 6,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        background: on
                          ? "hsl(var(--primary) / 0.15)"
                          : "hsl(var(--muted) / 0.4)",
                        border: on
                          ? "1px solid hsl(var(--primary))"
                          : "1px solid transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(t.id)}
                      />
                      {t.flagUrl && (
                        <img
                          src={t.flagUrl}
                          alt=""
                          width={16}
                          height={12}
                          style={{ objectFit: "cover", borderRadius: 2 }}
                        />
                      )}
                      {t.name}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {noFlag.length > 0 && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "hsl(38 90% 55%)",
                marginBottom: "0.75rem",
              }}
            >
              No flag for: {noFlag.map((t) => t.name).join(", ")}. They will
              show without one.
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <span style={smallLabel}>Betting closes</span>
              <input
                type="datetime-local"
                className="input-field"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
            <button
              onClick={submit}
              disabled={!closesAt || picked.size < 2 || busy}
            >
              <Trophy size={15} />{" "}
              {busy
                ? "Creating…"
                : picked.size < 2
                  ? "Pick at least 2 nations"
                  : `Create with ${picked.size} nations`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
