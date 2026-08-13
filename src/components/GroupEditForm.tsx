import { useMemo, useState, type FC } from "react"

// ── Group edit form for political / multi-binary "race" markets ─────────────
// A grouped event is stored as N separate Yes/No candidate markets sharing one
// groupId. This form edits the whole group at once: shared fields (umbrella
// title, timing, resolution criteria, house edge) are entered once and fan out
// to every candidate; each candidate's name + avatar image is edited in its own
// row. That avatar image is the candidate market's own imageUrl — the picture
// shown on the grouped card in the app (the Yes/No outcome images never render).

export interface GroupMarket {
  id: string
  title: string
  groupId?: string | null
  groupTitle?: string | null
  description?: string | null
  resolutionCriteria?: string | null
  imageUrl?: string | null
  opensAt?: string | null
  closesAt?: string | null
  houseEdgePct?: number
  metadata?: { candidate?: string } | null
}

export interface GroupEditPayload {
  title: string
  description: string
  resolutionCriteria: string
  opensAt?: string
  closesAt?: string
  houseEdgePct: number
  candidates: { id: string; name: string; imageUrl: string | null }[]
}

interface Props {
  markets: GroupMarket[]
  onSubmit: (payload: GroupEditPayload) => Promise<void>
  onCancel: () => void
}

/** Candidate display name: metadata.candidate, else the title suffix after "—". */
function candidateName(m: GroupMarket): string {
  const meta = m.metadata?.candidate
  if (typeof meta === "string" && meta.trim()) return meta.trim()
  const parts = m.title.split("—")
  return parts.length > 1 ? parts[parts.length - 1].trim() : m.title
}

function toLocalDatetimeInput(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

const GroupEditForm: FC<Props> = ({ markets, onSubmit, onCancel }) => {
  const first = markets[0]
  const [title, setTitle] = useState(first?.groupTitle || "")
  const [description, setDescription] = useState(first?.description || "")
  const [resolutionCriteria, setResolutionCriteria] = useState(
    first?.resolutionCriteria || ""
  )
  const [opensAt, setOpensAt] = useState(toLocalDatetimeInput(first?.opensAt))
  const [closesAt, setClosesAt] = useState(
    toLocalDatetimeInput(first?.closesAt)
  )
  const [houseEdgePct, setHouseEdgePct] = useState(first?.houseEdgePct ?? 5)
  const [candidates, setCandidates] = useState(
    markets.map((m) => ({
      id: m.id,
      name: candidateName(m),
      imageUrl: m.imageUrl ?? "",
    }))
  )
  const [submitting, setSubmitting] = useState(false)

  const previewTitle = useMemo(
    () => title.trim() || "(untitled event)",
    [title]
  )

  const setCandidate = (
    id: string,
    field: "name" | "imageUrl",
    value: string
  ) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        resolutionCriteria: resolutionCriteria.trim(),
        opensAt: opensAt ? new Date(opensAt).toISOString() : undefined,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
        houseEdgePct,
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name.trim(),
          imageUrl: c.imageUrl.trim() || null,
        })),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    marginBottom: "0.35rem",
    color: "hsl(var(--muted-foreground))",
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
      onClick={() => !submitting && onCancel()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "1rem",
          padding: "2rem",
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              padding: "2px 8px",
              borderRadius: 999,
              background: "hsl(217 91% 60% / 0.15)",
              color: "hsl(217 91% 70%)",
            }}
          >
            GROUP EDIT
          </span>
          <span
            style={{
              fontSize: "0.85rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {markets.length} candidate markets
          </span>
        </div>

        {/* ── Shared fields ── */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Umbrella event title</label>
          <input
            className="input-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Who will become Bhutan's next Prime Minister?"
            required
          />
          <p
            style={{
              fontSize: "0.72rem",
              color: "hsl(var(--muted-foreground))",
              marginTop: "0.3rem",
            }}
          >
            Renaming this rewrites every candidate's title to “{previewTitle} —{" "}
            {candidates[0]?.name.trim() || "Candidate"}”.
          </p>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Description</label>
          <textarea
            className="input-field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Resolution criteria</label>
          <textarea
            className="input-field"
            value={resolutionCriteria}
            onChange={(e) => setResolutionCriteria(e.target.value)}
            rows={2}
          />
        </div>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Opens at</label>
            <input
              type="datetime-local"
              className="input-field"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Closes at</label>
            <input
              type="datetime-local"
              className="input-field"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
          <div style={{ width: 120 }}>
            <label style={labelStyle}>House edge %</label>
            <input
              type="number"
              className="input-field"
              value={houseEdgePct}
              min={0}
              max={50}
              step={0.5}
              onChange={(e) => setHouseEdgePct(Number(e.target.value))}
            />
          </div>
        </div>

        {/* ── Per-candidate rows ── */}
        <div style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>
          <label style={labelStyle}>Candidates</label>
          <p
            style={{
              fontSize: "0.72rem",
              color: "hsl(var(--muted-foreground))",
              marginTop: "-0.15rem",
              marginBottom: "0.75rem",
            }}
          >
            The image is the candidate's avatar on the card. Leave it blank to
            show the initial letter instead.
          </p>
        </div>

        {candidates.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "0.6rem",
            }}
          >
            {c.imageUrl.trim() ? (
              <img
                src={c.imageUrl}
                alt=""
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1px solid hsl(var(--border))",
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden"
                }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "hsl(var(--muted))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: "hsl(var(--muted-foreground))",
                  flexShrink: 0,
                }}
              >
                {(c.name.trim()[0] || "?").toUpperCase()}
              </div>
            )}
            <input
              className="input-field"
              style={{ marginBottom: 0, flex: "0 0 30%" }}
              value={c.name}
              onChange={(e) => setCandidate(c.id, "name", e.target.value)}
              placeholder={`Candidate ${i + 1} name`}
              required
            />
            <input
              className="input-field"
              style={{ marginBottom: 0, flex: 1, fontSize: "0.8rem" }}
              value={c.imageUrl}
              onChange={(e) => setCandidate(c.id, "imageUrl", e.target.value)}
              placeholder="Candidate image URL (optional)"
            />
          </div>
        ))}

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "1.75rem",
          }}
        >
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save group"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default GroupEditForm
