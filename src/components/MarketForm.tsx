import React, { useState, useEffect } from "react"
import {
  CATEGORIES,
  SPORT_SUBCATEGORIES,
  GAMING_SUBCATEGORIES,
} from "../lib/marketCategories"
import { DEFAULT_HOUSE_EDGE_PCT } from "../lib/fee"

interface Outcome {
  id?: string
  label: string
  imageUrl?: string | null
}

// World Cup knockout bracket slots — keep ids in sync with shared/data/wcKnockout.ts
// in the PWA/TMA. A wc-match market tagged with one of these renders in that slot.
const WC_BRACKET_SLOTS: { id: string; label: string }[] = [
  { id: "", label: "— None —" },
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `r32-${i + 1}`,
    label: `Round of 32 — #${i + 1}`,
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `r16-${i + 1}`,
    label: `Round of 16 — #${i + 1}`,
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `qf-${i + 1}`,
    label: `Quarter-final — #${i + 1}`,
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `sf-${i + 1}`,
    label: `Semi-final — #${i + 1}`,
  })),
  { id: "final-1", label: "Final" },
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
const EPL_SETTLEMENT_SOURCE =
  "Premier League official results (premierleague.com)"
const UCL_SETTLEMENT_SOURCE =
  "UEFA Champions League official results (uefa.com)"

interface MarketInitialData {
  title?: string
  description?: string
  imageUrl?: string | null
  outcomes?: Outcome[]
  opensAt?: string
  closesAt?: string
  houseEdgePct?: number
  mechanism?: string
  liquidityParam?: number
  category?: string | null
  subcategory?: string | null
  settlementSource?: string | null
  metadata?: Record<string, unknown> | null
}

export interface MarketFormData {
  title: string
  description: string
  imageUrl: string
  outcomes: { id?: string; label: string; imageUrl?: string | null }[]
  /**
   * Political grouped event only: each candidate becomes its own Yes/No child
   * market on the backend (POST /admin/markets/group). When set, `outcomes`
   * should be ignored by the submit handler.
   */
  candidates?: { name: string; imageUrl?: string | null }[]
  opensAt: string
  closesAt: string
  houseEdgePct: number
  mechanism: string
  liquidityParam: number
  category: string
  subcategory: string
  settlementSource: string
  bracketSlot: string
  matchLabel: string
}

interface MarketFormProps {
  initialData?: MarketInitialData
  /**
   * Create mode only: prefill the fresh form (e.g. publishing a market
   * suggestion). Unlike `initialData` it does NOT switch the form to edit mode,
   * so all create features (add outcome, political candidates) stay available.
   */
  seed?: MarketInitialData
  onSubmit: (data: MarketFormData) => void | Promise<void>
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

// ── Draft autosave ────────────────────────────────────────────────────────────
// The create form holds a lot of hand-typed data — a label + image URL for every
// outcome, 30+ on a bracket market. It used to live only in React state, so a
// reload (often forced when a submit failed against a spun-down free-tier backend)
// wiped everything. We now mirror the form to localStorage on every change and
// restore it on mount, clearing only after a market is successfully created.
const DRAFT_KEY = "oro_admin_market_draft_v1"

type MarketDraft = {
  title: string
  description: string
  imageUrl: string
  outcomes: { id?: string; label: string; imageUrl?: string | null }[]
  opensAt: string
  closesAt: string
  houseEdgePct: number
  mechanism: string
  liquidityParam: number
  category: string
  subcategory: string
  settlementSource: string
  bracketSlot: string
  matchLabel: string
}

function buildDefaultDraft(initialData?: MarketInitialData): MarketDraft {
  return {
    title: initialData?.title || "",
    description: initialData?.description || "",
    imageUrl: initialData?.imageUrl || "",
    outcomes: initialData?.outcomes?.map((o: Outcome) => ({
      id: o.id,
      label: o.label,
      imageUrl: o.imageUrl ?? null,
    })) ?? [
      { label: "Yes", imageUrl: null },
      { label: "No", imageUrl: null },
    ],
    opensAt: initialData?.opensAt
      ? toLocalDatetimeInput(new Date(initialData.opensAt))
      : "",
    closesAt: initialData?.closesAt
      ? toLocalDatetimeInput(new Date(initialData.closesAt))
      : "",
    houseEdgePct: initialData?.houseEdgePct || DEFAULT_HOUSE_EDGE_PCT,
    mechanism: initialData?.mechanism || "parimutuel",
    liquidityParam: initialData?.liquidityParam || 1000,
    category: initialData?.category || "other",
    subcategory: initialData?.subcategory || "",
    settlementSource: initialData?.settlementSource || "",
    bracketSlot:
      (initialData?.metadata?.bracketSlot as string | undefined) || "",
    matchLabel: (initialData?.metadata?.matchLabel as string | undefined) || "",
  }
}

function loadDraft(): MarketDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.outcomes)
    ) {
      return {
        ...buildDefaultDraft(),
        ...(parsed as Partial<MarketDraft>),
        imageUrl:
          typeof (parsed as Partial<MarketDraft>).imageUrl === "string"
            ? (parsed as Partial<MarketDraft>).imageUrl!
            : "",
      }
    }
  } catch {
    /* corrupt or blocked storage — ignore and start fresh */
  }
  return null
}

const MarketForm: React.FC<MarketFormProps> = ({
  initialData,
  seed,
  onSubmit,
  onCancel,
  loading,
  onAddOutcome,
}) => {
  const [newOutcomeLabel, setNewOutcomeLabel] = useState("")
  const [newOutcomeImage, setNewOutcomeImage] = useState("")
  const [addingOutcome, setAddingOutcome] = useState(false)
  const [addOutcomeError, setAddOutcomeError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // True when we rehydrated a previously-abandoned draft — drives the banner.
  const [restoredDraft, setRestoredDraft] = useState(
    () => !initialData && !seed && loadDraft() !== null
  )
  const [formData, setFormData] = useState<MarketDraft>(() => {
    // Publishing a suggestion: the seed wins over any leftover draft.
    if (!initialData && seed) return buildDefaultDraft(seed)
    // Creating a new market: restore an autosaved draft if one exists.
    if (!initialData) {
      const saved = loadDraft()
      if (saved) return saved
    }
    return buildDefaultDraft(initialData)
  })

  // Mirror the form to localStorage (create mode only) so a reload or a failed
  // submit never costs the admin their typing. Debounced 2s: localStorage writes
  // are synchronous and JSON.stringify of a 30+ outcome form on every keystroke
  // made typing janky. Saving only after the admin pauses for 2s keeps the draft
  // safe while keeping the input hot path completely clear.
  useEffect(() => {
    if (initialData || seed) return // editing, or publishing a seeded suggestion — don't autosave
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
      } catch {
        /* storage full/blocked — don't crash the form over a failed save */
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [formData, initialData, seed])

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }

  // Discard the restored draft and reset to a blank form.
  const startFresh = () => {
    clearDraft()
    setRestoredDraft(false)
    setFormData(buildDefaultDraft(initialData))
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target

    if (
      name === "category" &&
      !initialData &&
      formData.category === "sports" &&
      value !== "sports"
    ) {
      const src = formData.settlementSource.toLowerCase()
      const sportSource =
        src.includes("bhutanfootball") || src.includes("premierleague")
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        subcategory: "",
        bracketSlot: "",
        matchLabel: "",
        settlementSource: sportSource ? "" : prev.settlementSource,
      }))
      return
    }

    if (name === "category" && !initialData) {
      const wasPolitical = formData.category === "political"
      if (value === "political" && !wasPolitical) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          subcategory: "",
          bracketSlot: "",
          matchLabel: "",
          settlementSource: prev.settlementSource.includes("bhutanfootball")
            ? ""
            : prev.settlementSource,
          outcomes: [
            { label: "", imageUrl: null },
            { label: "", imageUrl: null },
          ],
        }))
        return
      }
      if (value !== "political" && wasPolitical) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          outcomes: [
            { label: "Yes", imageUrl: null },
            { label: "No", imageUrl: null },
          ],
        }))
        return
      }
    }
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
    // EPL match preset — seed Home / Draw / Away (team slots blank, "Draw"
    // prefilled so the EPL hub crest logic maps outcome[0]=home, outcome[2]=away
    // correctly). Stat markets (top scorer/assists/cards) are intentionally NOT
    // creatable here — they are auto-created each season and via the dedicated
    // "EPL Markets" admin page, both of which seed correct current-season data.
    if (name === "subcategory" && value === "epl-match" && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        settlementSource: prev.settlementSource || EPL_SETTLEMENT_SOURCE,
        outcomes: [
          { label: "", imageUrl: null },
          { label: "Draw", imageUrl: null },
          { label: "", imageUrl: null },
        ],
      }))
      return
    }
    // EPL season/outright preset — title winner, relegation, top 4, etc. Just
    // seed the settlement source; outcomes are left to the admin (clubs for an
    // outright, Yes/No for a relegation question, …). Lands in the Season tab as
    // long as the title has no "vs".
    if (name === "subcategory" && value === "epl-season" && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        settlementSource: prev.settlementSource || EPL_SETTLEMENT_SOURCE,
      }))
      return
    }
    // UCL match preset — Home / Draw / Away, mirrors epl-match so the Champions
    // League hub Matches tab maps outcome[0]=home, outcome[2]=away correctly.
    // Stat markets (top scorer/assists) are auto-created and via the "UCL
    // Markets" admin page, not here.
    if (name === "subcategory" && value === "ucl-match" && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        settlementSource: prev.settlementSource || UCL_SETTLEMENT_SOURCE,
        outcomes: [
          { label: "", imageUrl: null },
          { label: "Draw", imageUrl: null },
          { label: "", imageUrl: null },
        ],
      }))
      return
    }
    // UCL season/outright preset — winner, top scorer question, etc. Seed the
    // settlement source; outcomes left to the admin. Lands in the Season tab as
    // long as the title has no "vs".
    if (name === "subcategory" && value === "ucl-season" && !initialData) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        settlementSource: prev.settlementSource || UCL_SETTLEMENT_SOURCE,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // datetime-local inputs give "YYYY-MM-DDTHH:MM" with NO timezone — treat as
    // local browser time and convert to UTC ISO string so the backend stores the
    // correct instant regardless of server timezone.
    const toUTC = (local: string) =>
      local ? new Date(local).toISOString() : local
    const isPoliticalGroup = formData.category === "political" && !initialData
    setSubmitting(true)
    try {
      await onSubmit({
        ...formData,
        imageUrl: formData.imageUrl.trim(),
        opensAt: toUTC(formData.opensAt),
        closesAt: toUTC(formData.closesAt),
        houseEdgePct: Number(formData.houseEdgePct),
        liquidityParam: Number(formData.liquidityParam),
        candidates: isPoliticalGroup
          ? formData.outcomes.map((o) => ({
              name: o.label,
              imageUrl: o.imageUrl ?? null,
            }))
          : undefined,
      })
      // Success — safe to discard the saved draft.
      if (!initialData) {
        clearDraft()
        setRestoredDraft(false)
      }
    } catch {
      // Submit failed (e.g. the backend was still cold-starting). Keep the form
      // AND the saved draft intact so nothing the admin typed is lost.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit}>
        <h3>{initialData ? "Edit Market" : "Create New Market"}</h3>

        {!initialData && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              borderRadius: 8,
              fontSize: "0.75rem",
              background: restoredDraft
                ? "hsl(var(--primary) / 0.12)"
                : "hsl(var(--muted) / 0.4)",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            <span>
              {restoredDraft
                ? "↩︎ Restored your unsaved draft — your typing is autosaved on this device."
                : "✓ Autosave on — your typing is kept on this device even if the page reloads."}
            </span>
            {restoredDraft && (
              <button
                type="button"
                className="secondary"
                onClick={startFresh}
                style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem" }}
              >
                Start fresh
              </button>
            )}
          </div>
        )}

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
            MARKET IMAGE URL
            <span
              style={{
                marginLeft: 6,
                fontWeight: 400,
                opacity: 0.6,
                textTransform: "none",
                fontSize: "0.7rem",
              }}
            >
              {formData.category === "political" && !initialData
                ? "(fallback for candidates without their own image)"
                : "(optional)"}
            </span>
          </label>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            {formData.imageUrl && (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img
                  src={formData.imageUrl}
                  alt=""
                  style={{
                    width: 42,
                    height: 42,
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
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, imageUrl: "" }))
                  }
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
                  x
                </button>
              </div>
            )}
            <input
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              className="input-field"
              style={{ marginBottom: 0 }}
              placeholder="https://... (optional)"
            />
          </div>
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
          ) : formData.category === "gaming" ? (
            <select
              name="subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              className="input-field"
            >
              {/* Preserve a pre-existing custom slug when editing so it isn't dropped */}
              {formData.subcategory &&
                !GAMING_SUBCATEGORIES.some(
                  (g) => g.value === formData.subcategory
                ) && (
                  <option value={formData.subcategory}>
                    {formData.subcategory}
                  </option>
                )}
              {GAMING_SUBCATEGORIES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
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

        {/* ── Bracket slot (wc-match only) ──────────────────────────────────── */}
        {formData.subcategory === "wc-match" && (
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              KNOCKOUT BRACKET SLOT
              <span
                style={{
                  marginLeft: 6,
                  fontWeight: 400,
                  opacity: 0.6,
                  textTransform: "none",
                  fontSize: "0.7rem",
                }}
              >
                (which slot this fixture fills in the World Cup hub bracket)
              </span>
            </label>
            <select
              name="bracketSlot"
              value={formData.bracketSlot}
              onChange={handleChange}
              className="input-field"
            >
              {WC_BRACKET_SLOTS.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Match label (WC props only) ───────────────────────────────────── */}
        {(formData.subcategory === "wc-player" ||
          formData.subcategory === "wc-group") && (
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              MATCH
              <span
                style={{
                  marginLeft: 6,
                  fontWeight: 400,
                  opacity: 0.6,
                  textTransform: "none",
                  fontSize: "0.7rem",
                }}
              >
                (optional — props with the same match are grouped together in
                the hub, e.g. "France vs Spain")
              </span>
            </label>
            <input
              name="matchLabel"
              value={formData.matchLabel}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., France vs Spain"
            />
          </div>
        )}

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
            {formData.category === "political" && !initialData
              ? "CANDIDATES"
              : "OUTCOMES"}
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
                    style={{ marginBottom: 0, flex: "1 1 40%" }}
                    required
                    placeholder={`Country ${index + 1} (e.g. Brazil)`}
                  />
                  {outcome.imageUrl && (
                    <img
                      src={outcome.imageUrl}
                      alt=""
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 6,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <input
                    value={outcome.imageUrl ?? ""}
                    onChange={(e) =>
                      handleOutcomeImageChange(index, e.target.value)
                    }
                    className="input-field"
                    style={{ marginBottom: 0, flex: "1 1 40%" }}
                    placeholder="Image URL (optional)"
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
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 8px",
                        fontSize: "0.7rem",
                        color: "hsl(var(--muted-foreground))",
                        fontWeight: 700,
                      }}
                    >
                      IMAGE URL
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
                      <td style={{ padding: "4px 8px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {outcome.imageUrl && (
                            <img
                              src={outcome.imageUrl}
                              alt=""
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <input
                            value={outcome.imageUrl ?? ""}
                            onChange={(e) =>
                              handleOutcomeImageChange(index, e.target.value)
                            }
                            className="input-field"
                            style={{ marginBottom: 0 }}
                            placeholder="https://… (optional)"
                          />
                        </div>
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
              {formData.category === "political" && !initialData && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  Each candidate gets their own Yes/No market (e.g. "
                  {formData.title || "Who will win?"}. When it settles, resolve
                  the winner's market to Yes and every other candidate's market
                  to No.
                </p>
              )}
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
              {formData.subcategory === "epl-match" && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  Title must contain "vs" (e.g. "Arsenal vs Chelsea — Who
                  wins?") so it lands in the EPL hub Matches tab. Fill the two
                  club names in the Home/Away slots; keep "Draw" in the middle.
                  Use the image URL fields for club crests. (Stat markets — top
                  scorer, assists, cards — aren't created here; use the "EPL
                  Markets" page or let them auto-create each season.)
                </p>
              )}
              {formData.subcategory === "epl-season" && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  Season-long / outright market — lands in the EPL hub's Season
                  tab. Keep "vs" OUT of the title (that's for matches).
                  Examples: "Who will win the Premier League 2026/27?" (one
                  outcome per club) or "Will Leeds be relegated?" (Yes / No).
                </p>
              )}
              {formData.subcategory === "ucl-match" && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  Title must contain "vs" (e.g. "Real Madrid vs Man City — Who
                  wins?") so it lands in the Champions League hub Matches tab.
                  Fill the two club names in the Home/Away slots; keep "Draw" in
                  the middle. Use the image URL fields for club crests. (Stat
                  markets — top scorer, assists — aren't created here; use the
                  "UCL Markets" page or let them auto-create each season.)
                </p>
              )}
              {formData.subcategory === "ucl-season" && (
                <p
                  style={{
                    fontSize: "0.72rem",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  Season-long / outright market — lands in the Champions League
                  hub's Season tab. Keep "vs" OUT of the title (that's for
                  matches). Example: "Who will win the Champions League
                  2026/27?" (one outcome per club).
                </p>
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
                            : formData.category === "political" && !initialData
                              ? `Candidate ${index + 1} name (e.g. ${index === 0 ? "Sonam" : "Tenzin"})`
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
                  {formData.category === "political"
                    ? "+ Add Candidate"
                    : "+ Add Outcome"}
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
          className="stack-sm"
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
          <button type="submit" disabled={loading || submitting}>
            {loading || submitting
              ? initialData
                ? "Saving..."
                : "Creating — waking the server if asleep…"
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
