import React, { useState } from "react"

interface Outcome {
  id?: string
  label: string
  imageUrl?: string | null
}

const CATEGORIES = [
  { value: "sports", label: "Sports" },
  { value: "gaming", label: "Gaming" },
  { value: "weather", label: "Weather" },
  { value: "entertainment", label: "Entertainment" },
  { value: "economy", label: "Economy" },
  { value: "other", label: "Other" },
] as const

const SPORT_SUBCATEGORIES = [
  "",
  "International",
  "National",
  "UEFA Champions League",
  "UEFA Europa League",
  "bpl-match",
  "bpl-winner",
  "bpl-topscorer",
  "Premier League (BPL)",
  "World Cup",
  "wc-winner",
  "wc-group",
  "wc-match",
  "Bhutanese Archery",
  "Cricket",
  "Other",
]

// BoB Bhutan Premier League — 2026 season clubs (keep in sync with the PWA/TMA BplHubPage)
const BPL_CLUBS = [
  "Paro FC",
  "Thimphu City FC",
  "Transport United FC",
  "Drukpa FC",
  "RTC FC",
  "Tensung FC",
  "Thimphu FC",
  "Tsirang FC",
  "Ugyen Academy FC",
  "BFF Academy U20",
]

const BPL_SETTLEMENT_SOURCE = "https://bhutanfootball.org"

interface MarketInitialData {
  title?: string
  description?: string
  outcomes?: Outcome[]
  opensAt?: string
  closesAt?: string
  houseEdgePct?: number
  mechanism?: string
  liquidityParam?: number
  category?: string | null
  subcategory?: string | null
  settlementSource?: string | null
}

export interface MarketFormData {
  title: string
  description: string
  outcomes: { id?: string; label: string; imageUrl?: string | null }[]
  opensAt: string
  closesAt: string
  houseEdgePct: number
  mechanism: string
  liquidityParam: number
  category: string
  subcategory: string
  settlementSource: string
}

interface MarketFormProps {
  initialData?: MarketInitialData
  onSubmit: (data: MarketFormData) => void
  onCancel: () => void
  loading?: boolean
  /**
   * Edit-mode only: persist a brand-new outcome to an existing market.
   * Resolves with the created outcome so the form can show it in the
   * rename list immediately.
   */
  onAddOutcome?: (data: {
    label: string
    imageUrl?: string | null
  }) => Promise<{ id: string; label: string; imageUrl?: string | null } | void>
}

// ── Main form component ───────────────────────────────────────────────────────

/**
 * Converts a Date to "YYYY-MM-DDTHH:MM" in the browser's LOCAL timezone,
 * which is what <input type="datetime-local"> expects to display correctly.
 */
function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  )
}

const MarketForm: React.FC<MarketFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading,
  onAddOutcome,
}) => {
  const [newOutcomeLabel, setNewOutcomeLabel] = useState("")
  const [newOutcomeImage, setNewOutcomeImage] = useState("")
  const [addingOutcome, setAddingOutcome] = useState(false)
  const [addOutcomeError, setAddOutcomeError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    outcomes: (initialData?.outcomes?.map((o: Outcome) => ({
      id: o.id,
      label: o.label,
      imageUrl: o.imageUrl ?? null,
    })) ?? [
      { label: "Yes", imageUrl: null },
      { label: "No", imageUrl: null },
    ]) as {
      id?: string
      label: string
      imageUrl?: string | null
    }[],
    opensAt: initialData?.opensAt
      ? toLocalDatetimeInput(new Date(initialData.opensAt))
      : "",
    closesAt: initialData?.closesAt
      ? toLocalDatetimeInput(new Date(initialData.closesAt))
      : "",
    houseEdgePct: initialData?.houseEdgePct || 5,
    mechanism: initialData?.mechanism || "parimutuel",
    liquidityParam: initialData?.liquidityParam || 1000,
    category: initialData?.category || "other",
    subcategory: initialData?.subcategory || "",
    settlementSource: initialData?.settlementSource || "",
  })

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    // When switching to wc-winner, lock to one outcome
    if (name === "subcategory" && value === "wc-winner" && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        outcomes: [{ label: "", imageUrl: null }],
      }))
      return
    }
    // When switching to wc-group, seed with 4 blank team slots
    if (name === "subcategory" && value === "wc-group" && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        outcomes: [
          { label: "", imageUrl: null },
          { label: "", imageUrl: null },
          { label: "", imageUrl: null },
          { label: "", imageUrl: null },
        ],
      }))
      return
    }
    // BPL presets — seed outcomes/title/settlement source per market type
    if (name === "subcategory" && value.startsWith("bpl-") && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        settlementSource: prev.settlementSource || BPL_SETTLEMENT_SOURCE,
        title:
          prev.title ||
          (value === "bpl-winner"
            ? "Who will win the BoB Bhutan Premier League?"
            : value === "bpl-topscorer"
              ? "Who will be the BoB Bhutan Premier League top scorer?"
              : ""),
        outcomes:
          value === "bpl-winner"
            ? BPL_CLUBS.map((c) => ({ label: c, imageUrl: null }))
            : [
                { label: "", imageUrl: null },
                { label: "", imageUrl: null },
              ],
      }))
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = { ...newOutcomes[index], label: value }
    setFormData((prev) => ({ ...prev, outcomes: newOutcomes }))
  }

  const handleOutcomeImageChange = (index: number, url: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = { ...newOutcomes[index], imageUrl: url || null }
    setFormData((prev) => ({ ...prev, outcomes: newOutcomes }))
  }

  const addOutcome = () => {
    setFormData((prev) => ({
      ...prev,
      outcomes: [...prev.outcomes, { label: "", imageUrl: null }],
    }))
  }

  const removeOutcome = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      outcomes: prev.outcomes.filter((_, i) => i !== index),
    }))
  }

  // Edit-mode only: persist a brand-new outcome to the existing market, then
  // append it to the local rename list so it shows up immediately.
  const handleAddNewOutcome = async () => {
    if (!onAddOutcome) return
    const label = newOutcomeLabel.trim()
    if (!label) {
      setAddOutcomeError("Outcome label is required")
      return
    }
    setAddingOutcome(true)
    setAddOutcomeError(null)
    try {
      const created = await onAddOutcome({
        label,
        imageUrl: newOutcomeImage.trim() || null,
      })
      if (created) {
        setFormData((prev) => ({
          ...prev,
          outcomes: [
            ...prev.outcomes,
            {
              id: created.id,
              label: created.label,
              imageUrl: created.imageUrl ?? null,
            },
          ],
        }))
      }
      setNewOutcomeLabel("")
      setNewOutcomeImage("")
    } catch (e: unknown) {
      setAddOutcomeError(e instanceof Error ? e.message : String(e))
    } finally {
      setAddingOutcome(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // datetime-local inputs give "YYYY-MM-DDTHH:MM" with NO timezone — treat as
    // local browser time and convert to UTC ISO string so the backend stores the
    // correct instant regardless of server timezone.
    const toUTC = (local: string) =>
      local ? new Date(local).toISOString() : local
    onSubmit({
      ...formData,
      opensAt: toUTC(formData.opensAt),
      closesAt: toUTC(formData.closesAt),
      houseEdgePct: Number(formData.houseEdgePct),
      liquidityParam: Number(formData.liquidityParam),
    })
  }

  return (
    <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit}>
        <h3>{initialData ? "Edit Market" : "Create New Market"}</h3>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            TITLE
          </label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="input-field"
            required
            placeholder={
              formData.subcategory === "bpl-match"
                ? "e.g., Paro FC Vs Thimphu City FC : Who will win?"
                : "e.g., Argentina vs Portugal — Who wins?"
            }
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            DESCRIPTION
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input-field"
            style={{ minHeight: "80px", resize: "vertical" }}
            placeholder="Market details..."
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            SETTLEMENT SOURCE
          </label>
          <input
            name="settlementSource"
            value={formData.settlementSource}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g., Bhutan Cricket Board official results"
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            CATEGORY
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="input-field"
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Subcategory ───────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            SUBCATEGORY
            <span
              style={{
                marginLeft: 6,
                fontWeight: 400,
                opacity: 0.6,
                textTransform: "none",
                fontSize: "0.7rem",
              }}
            >
              (optional — used for filtering in the app)
            </span>
          </label>
          {formData.category === "sports" ? (
            <select
              name="subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              className="input-field"
            >
              {SPORT_SUBCATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {s || "— None —"}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., Premier League, World Cup, Season 2026..."
            />
          )}
        </div>

        {/* ── Outcomes ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            OUTCOMES
            {initialData && (
              <span
                style={{
                  marginLeft: 8,
                  fontWeight: 400,
                  opacity: 0.6,
                  textTransform: "none",
                  fontSize: "0.7rem",
                }}
              >
                (rename only — count is fixed to preserve existing bets)
              </span>
            )}
          </label>

          {/* ── wc-winner: multi-country outcomes ── */}
          {formData.subcategory === "wc-winner" ? (
            <div>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                  opacity: 0.7,
                }}
              >
                Add each competing country as an outcome (e.g. "Brazil",
                "France").
              </p>
              {formData.outcomes.map((outcome, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <input
                    value={outcome.label}
                    onChange={(e) => handleOutcomeChange(index, e.target.value)}
                    className="input-field"
                    style={{ marginBottom: 0 }}
                    required
                    placeholder={`Country ${index + 1} (e.g. Brazil)`}
                  />
                  {!initialData && formData.outcomes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className="secondary"
                      style={{ padding: "0 0.75rem" }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              {!initialData && (
                <button
                  type="button"
                  onClick={addOutcome}
                  className="secondary"
                  style={{ width: "100%", fontSize: "0.75rem" }}
                >
                  + Add Country
                </button>
              )}
            </div>
          ) : /* ── wc-group: table of teams ── */
          formData.subcategory === "wc-group" ? (
            <div>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                  opacity: 0.7,
                }}
              >
                Enter the teams competing in this group. Each row becomes a
                prediction outcome.
              </p>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: "0.5rem",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: "0.7rem",
                        color: "hsl(var(--muted-foreground))",
                        fontWeight: 700,
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: "0.7rem",
                        color: "hsl(var(--muted-foreground))",
                        fontWeight: 700,
                      }}
                    >
                      TEAM
                    </th>
                    {!initialData && <th style={{ width: 36 }} />}
                  </tr>
                </thead>
                <tbody>
                  {formData.outcomes.map((outcome, index) => (
                    <tr
                      key={index}
                      style={{ borderBottom: "1px solid hsl(var(--border))" }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          fontSize: "0.8rem",
                          color: "hsl(var(--muted-foreground))",
                          width: 32,
                        }}
                      >
                        {index + 1}
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <input
                          value={outcome.label}
                          onChange={(e) =>
                            handleOutcomeChange(index, e.target.value)
                          }
                          className="input-field"
                          style={{ marginBottom: 0 }}
                          required
                          placeholder={`Team ${index + 1}`}
                        />
                      </td>
                      {!initialData && (
                        <td style={{ padding: "4px 8px" }}>
                          {formData.outcomes.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOutcome(index)}
                              className="secondary"
                              style={{ padding: "0 0.5rem" }}
                            >
                              &times;
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!initialData && (
                <button
                  type="button"
                  onClick={addOutcome}
                  className="secondary"
                  style={{ width: "100%", fontSize: "0.75rem" }}
                >
                  + Add Team
                </button>
              )}
            </div>
          ) : (
            /* ── default: standard outcomes (also bpl-match / bpl-winner / bpl-topscorer) ── */
            <div>
              {formData.subcategory.startsWith("bpl-") && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  {formData.subcategory === "bpl-match"
                    ? "Pick the two clubs playing (add a third outcome for Draw if needed). Use the image URL fields for club crests — they show on the cards and the BPL banner."
                    : formData.subcategory === "bpl-winner"
                      ? "Each club is one outcome — remove any clubs not competing this season. Add crest image URLs for a nicer hub display."
                      : 'Add each player as an outcome (e.g. "Tshering Dorji — Paro FC").'}
                </p>
              )}
              {(formData.subcategory === "bpl-match" ||
                formData.subcategory === "bpl-winner") && (
                <datalist id="bpl-clubs">
                  {BPL_CLUBS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
              {formData.outcomes.map((outcome, index) => (
                <div key={index} style={{ marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <input
                      value={outcome.label}
                      onChange={(e) =>
                        handleOutcomeChange(index, e.target.value)
                      }
                      className="input-field"
                      style={{ marginBottom: 0 }}
                      required
                      list={
                        formData.subcategory === "bpl-match" ||
                        formData.subcategory === "bpl-winner"
                          ? "bpl-clubs"
                          : undefined
                      }
                      placeholder={
                        formData.subcategory === "bpl-match"
                          ? `Club ${index + 1} (e.g. ${BPL_CLUBS[index] ?? "Paro FC"})`
                          : formData.subcategory === "bpl-topscorer"
                            ? `Player ${index + 1}`
                            : `Outcome ${index + 1} label`
                      }
                    />
                    {!initialData && formData.outcomes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOutcome(index)}
                        className="secondary"
                        style={{ padding: "0 0.75rem" }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    {outcome.imageUrl && (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img
                          src={outcome.imageUrl}
                          alt=""
                          style={{
                            width: 36,
                            height: 36,
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid hsl(var(--border))",
                            display: "block",
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleOutcomeImageChange(index, "")}
                          style={{
                            position: "absolute",
                            top: -5,
                            right: -5,
                            background: "hsl(var(--destructive))",
                            color: "#fff",
                            border: "none",
                            borderRadius: "50%",
                            width: 16,
                            height: 16,
                            fontSize: 10,
                            cursor: "pointer",
                            lineHeight: "16px",
                            textAlign: "center",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <input
                      value={outcome.imageUrl || ""}
                      onChange={(e) =>
                        handleOutcomeImageChange(index, e.target.value)
                      }
                      className="input-field"
                      style={{ marginBottom: 0, fontSize: "0.75rem" }}
                      placeholder={`Outcome ${index + 1} image URL (optional)`}
                    />
                  </div>
                </div>
              ))}
              {!initialData && (
                <button
                  type="button"
                  onClick={addOutcome}
                  className="secondary"
                  style={{ width: "100%", fontSize: "0.75rem" }}
                >
                  + Add Outcome
                </button>
              )}
            </div>
          )}

          {/* ── Edit mode: add a brand-new outcome to the live market ── */}
          {initialData && onAddOutcome && (
            <div
              style={{
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px dashed hsl(var(--border))",
              }}
            >
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                  opacity: 0.8,
                }}
              >
                Add a new outcome (starts with an empty pool; existing bets are
                unaffected).
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "0.35rem",
                }}
              >
                <input
                  value={newOutcomeLabel}
                  onChange={(e) => setNewOutcomeLabel(e.target.value)}
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  placeholder="New outcome label (e.g. Draw)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleAddNewOutcome()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleAddNewOutcome()}
                  className="secondary"
                  disabled={addingOutcome || !newOutcomeLabel.trim()}
                  style={{ padding: "0 1rem", whiteSpace: "nowrap" }}
                >
                  {addingOutcome ? "Adding…" : "+ Add"}
                </button>
              </div>
              <input
                value={newOutcomeImage}
                onChange={(e) => setNewOutcomeImage(e.target.value)}
                className="input-field"
                style={{ marginBottom: 0, fontSize: "0.75rem" }}
                placeholder="New outcome image URL (optional)"
              />
              {addOutcomeError && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--destructive))",
                    marginTop: "0.4rem",
                  }}
                >
                  {addOutcomeError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Dates ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              OPENS AT
            </label>
            <input
              type="datetime-local"
              name="opensAt"
              value={formData.opensAt}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              CLOSES AT
            </label>
            <input
              type="datetime-local"
              name="closesAt"
              value={formData.closesAt}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
        </div>

        {/* ── Fee ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            PLATFORM FEE (%)
          </label>
          <input
            type="number"
            name="houseEdgePct"
            value={formData.houseEdgePct}
            onChange={handleChange}
            className="input-field"
            min="0"
            max="100"
            required
          />
        </div>

        <div
          style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}
        >
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : initialData
                ? "Update Market"
                : "Create Market"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default React.memo(MarketForm)
