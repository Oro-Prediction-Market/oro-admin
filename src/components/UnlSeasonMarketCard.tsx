import { useEffect, useState, type CSSProperties } from "react"
import { Trophy, X } from "lucide-react"

interface SeasonTeam {
  id: string
  groupKey: string
  league: string | null
  name: string
  flagUrl: string | null
}

interface RunningMarket {
  id: string
  title: string
  status: string
}

interface SeasonMarketPreview {
  season: string | null
  teams: SeasonTeam[]
  existing: RunningMarket[]
}

export interface SeasonMarketInput {
  title: string
  opensAt: string
  closesAt: string
  teamIds: string[]
}

interface Props {
  getPreview: () => Promise<unknown>
  create: (input: SeasonMarketInput) => Promise<unknown>
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

const linkButton: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "hsl(var(--primary))",
  fontSize: "0.72rem",
  fontWeight: 600,
}

/** `datetime-local` wants a local-time string with no zone suffix. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Season markets from nations ticked in the draw.
 *
 * Every nation already entered on this page is listed, grouped by league,
 * with its flag. Tick any of them, press Create market, then name it and set
 * its dates; the market gets exactly the nations ticked.
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
  const [formOpen, setFormOpen] = useState(false)
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

  const setMany = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

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
  const chosen = teams.filter((t) => picked.has(t.id))
  const noFlag = chosen.filter((t) => !t.flagUrl)

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
        Tick any nations, from any league, then press Create market to name it
        and set its dates. Each nation gets its flag from the draw. The market
        shows on the app hub’s Season tab.
      </p>

      {error ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          Couldn't load the nations: {error}
        </div>
      ) : !preview ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>Loading…</div>
      ) : teams.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          No nations yet — paste the draw below first.
        </div>
      ) : (
        <>
          {preview.existing.length > 0 && (
            <div
              style={{
                fontSize: "0.78rem",
                color: muted,
                marginBottom: "0.75rem",
              }}
            >
              Running now:{" "}
              {preview.existing.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && " · "}
                  <strong style={{ color: "hsl(var(--foreground))" }}>
                    {m.title}
                  </strong>{" "}
                  ({m.status})
                </span>
              ))}
            </div>
          )}

          {byLeague.map((g) => {
            const ids = g.teams.map((t) => t.id)
            const all = ids.every((id) => picked.has(id))
            return (
              <div key={g.key} style={{ marginBottom: "0.75rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "0.6rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span style={{ ...smallLabel, marginBottom: 0 }}>
                    {g.title}
                  </span>
                  <button
                    type="button"
                    style={linkButton}
                    onClick={() => setMany(ids, !all)}
                  >
                    {all ? "Untick all" : "Tick all"}
                  </button>
                </div>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}
                >
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
            )
          })}

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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setFormOpen(true)}
              disabled={picked.size < 2}
            >
              <Trophy size={15} />{" "}
              {picked.size < 2
                ? "Tick at least 2 nations"
                : `Create market (${picked.size} nations)`}
            </button>
            {picked.size > 0 && (
              <button
                className="secondary"
                onClick={() => setPicked(new Set())}
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {formOpen && (
        <CreateMarketForm
          nations={chosen}
          onClose={() => setFormOpen(false)}
          onSubmit={async (input) => {
            await create({ ...input, teamIds: chosen.map((t) => t.id) })
            notify("success", `“${input.title}” created.`)
            setFormOpen(false)
            setPicked(new Set())
            setRefresh((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

/** Name and dates, asked for only once the nations are chosen. */
function CreateMarketForm({
  nations,
  onClose,
  onSubmit,
}: {
  nations: SeasonTeam[]
  onClose: () => void
  onSubmit: (input: Omit<SeasonMarketInput, "teamIds">) => Promise<void>
}) {
  const [title, setTitle] = useState("")
  const [opensAt, setOpensAt] = useState(() => toLocalInput(new Date()))
  const [closesAt, setClosesAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const opensMs = opensAt ? new Date(opensAt).getTime() : NaN
  const closesMs = closesAt ? new Date(closesAt).getTime() : NaN
  const problem =
    title.trim().length < 3
      ? "Type a name for the market."
      : !closesAt
        ? "Pick when betting closes."
        : opensAt && opensMs >= closesMs
          ? "The opening date must be before the closing date."
          : null

  const submit = async () => {
    if (problem) return
    // Checked on click rather than while rendering, which must not read the
    // clock. The backend refuses it too.
    if (closesMs <= Date.now()) {
      setErr("The closing date must be in the future.")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      // datetime-local is local time; the backend wants an instant.
      await onSubmit({
        title: title.trim(),
        opensAt: opensAt ? new Date(opensAt).toISOString() : "",
        closesAt: new Date(closesAt).toISOString(),
      })
    } catch (e) {
      // Stays open so nothing typed is lost.
      setErr((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "1rem",
          padding: "1.5rem",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1rem" }}>New season market</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            style={{ ...linkButton, color: muted }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: "0.9rem" }}>
          <label style={smallLabel}>Market name</label>
          <input
            className="input-field"
            style={{ width: "100%" }}
            autoFocus
            maxLength={200}
            placeholder="e.g. Who wins the 2026/27 UEFA Nations League?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "0.9rem",
          }}
        >
          <div>
            <label style={smallLabel}>Opens</label>
            <input
              type="datetime-local"
              className="input-field"
              style={{ width: "100%" }}
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </div>
          <div>
            <label style={smallLabel}>Betting closes</label>
            <input
              type="datetime-local"
              className="input-field"
              style={{ width: "100%" }}
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <span style={smallLabel}>{nations.length} options</span>
          <div style={{ fontSize: "0.78rem", color: muted, lineHeight: 1.6 }}>
            {nations.map((t) => t.name).join(", ")}
          </div>
        </div>

        {(err || problem) && (
          <div
            style={{
              fontSize: "0.78rem",
              marginBottom: "0.75rem",
              color: err ? "hsl(var(--destructive))" : muted,
            }}
          >
            {err ?? problem}
          </div>
        )}

        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
        >
          <button className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={submit} disabled={!!problem || busy}>
            <Trophy size={15} /> {busy ? "Creating…" : "Create market"}
          </button>
        </div>
      </div>
    </div>
  )
}
