import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"

interface SeasonTeam {
  groupKey: string
  name: string
  flagUrl: string | null
}

interface SeasonMarketPreview {
  season: string | null
  teams: SeasonTeam[]
  missingFlags: string[]
  existing: { id: string; title: string; status: string } | null
}

interface Props {
  getPreview: () => Promise<unknown>
  create: (closesAt: string) => Promise<unknown>
  notify: (type: "success" | "error", message: string) => void
  /** Changes when the draw does, so the list re-reads after a paste. */
  reloadKey: number
}

const muted = "hsl(var(--muted-foreground))"

/**
 * "Who wins the Nations League?" in one click.
 *
 * The outcomes are League A of the draw already entered on this page, with
 * their flags — only League A can reach the Finals, so nobody else is listed.
 */
export default function UnlSeasonMarketCard({
  getPreview,
  create,
  notify,
  reloadKey,
}: Props) {
  const [preview, setPreview] = useState<SeasonMarketPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closesAt, setClosesAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    getPreview()
      .then((p) => {
        if (!cancelled) {
          setPreview(p as SeasonMarketPreview)
          setError(null)
        }
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

  const submit = async () => {
    setBusy(true)
    try {
      // datetime-local is local time; the backend wants an instant.
      await create(new Date(closesAt).toISOString())
      notify("success", "Season market created.")
      setClosesAt("")
      setRefresh((n) => n + 1)
    } catch (e) {
      notify("error", (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

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
        Creates “Who wins the Nations League?” with every League A nation
        (groups A–D) and its flag. Only League A can reach the Finals, so the
        other leagues are left out. It shows on the app hub’s Season tab.
      </p>

      {error ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>
          Couldn't load the nations: {error}
        </div>
      ) : !preview ? (
        <div style={{ fontSize: "0.8rem", color: muted }}>Loading…</div>
      ) : (
        <>
          {preview.teams.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: muted }}>
              No League A nations yet — paste the draw below first.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.4rem",
                marginBottom: "0.75rem",
              }}
            >
              {preview.teams.map((t) => (
                <span
                  key={`${t.groupKey}:${t.name}`}
                  title={`Group ${t.groupKey}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: 6,
                    fontSize: "0.78rem",
                    background: "hsl(var(--muted) / 0.4)",
                  }}
                >
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
                </span>
              ))}
            </div>
          )}

          {preview.missingFlags.length > 0 && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "hsl(38 90% 55%)",
                marginBottom: "0.75rem",
              }}
            >
              No flag for: {preview.missingFlags.join(", ")}. They will show
              without one.
            </div>
          )}

          {preview.existing ? (
            <div style={{ fontSize: "0.8rem", color: muted }}>
              Already created: <strong>{preview.existing.title}</strong> (
              {preview.existing.status}). Resolve or cancel it before creating
              another.
            </div>
          ) : (
            preview.teams.length >= 2 && (
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: muted,
                      marginBottom: "0.25rem",
                    }}
                  >
                    Betting closes
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                  />
                </div>
                <button onClick={submit} disabled={!closesAt || busy}>
                  <Trophy size={15} />{" "}
                  {busy
                    ? "Creating…"
                    : `Create with ${preview.teams.length} nations`}
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
