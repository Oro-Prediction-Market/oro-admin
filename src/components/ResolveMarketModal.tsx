import React, { useState } from "react"
import { ExternalLink } from "lucide-react"

interface MarketOutcome {
  id: string
  label: string
  totalBetAmount?: string | number
}

interface Dispute {
  id: string
  reason?: string
  bondAmount?: number | string
  upheld?: boolean | null
}

interface ResolveMarketModalProps {
  market: {
    id: string
    title: string
    proposedOutcomeId?: string
    outcomes: MarketOutcome[]
  }
  disputes?: Dispute[]
  onResolve: (
    winningOutcomeIds: string[],
    evidenceUrl: string,
    evidenceNote: string
  ) => void
  onCancel: () => void
  loading?: boolean
}

const ResolveMarketModal: React.FC<ResolveMarketModalProps> = ({
  market,
  disputes = [],
  onResolve,
  onCancel,
  loading,
}) => {
  const [selectedOutcomeIds, setSelectedOutcomeIds] = useState<string[]>(
    market.proposedOutcomeId ? [market.proposedOutcomeId] : []
  )
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [evidenceNote, setEvidenceNote] = useState("")
  const [urlError, setUrlError] = useState<string | null>(null)

  const toggleOutcome = (id: string) => {
    setSelectedOutcomeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const validateUrl = (v: string) => {
    try {
      new URL(v)
      setUrlError(null)
    } catch {
      setUrlError("Must be a valid URL (include https://)")
    }
  }

  const proposalChanged =
    market.proposedOutcomeId != null &&
    !selectedOutcomeIds.includes(market.proposedOutcomeId)

  const canSubmit =
    selectedOutcomeIds.length > 0 &&
    evidenceUrl &&
    !urlError &&
    evidenceNote.trim().length > 0 &&
    !loading

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <h3>Final Resolution</h3>
        <p
          style={{
            color: "hsl(var(--muted-foreground))",
            marginBottom: "0.25rem",
          }}
        >
          <strong style={{ color: "hsl(var(--foreground))" }}>
            {market.title}
          </strong>
        </p>
        <p
          style={{
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
            marginBottom: "1rem",
          }}
        >
          Select all winning outcomes — check multiple for group/qualifier
          markets.
        </p>

        {/* Objections panel */}
        {disputes.length > 0 && (
          <div
            style={{
              background: "hsl(35 100% 50% / 0.08)",
              border: "1px solid hsl(35 100% 50% / 0.3)",
              borderRadius: "var(--radius)",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
            }}
          >
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "hsl(35 100% 50%)",
                marginBottom: "0.5rem",
              }}
            >
              ⚠️ {disputes.length} Objection{disputes.length !== 1 ? "s" : ""}{" "}
              with locked bonds — Review before resolving
            </div>
            {/* Bond settlement outcome explanation */}
            <div
              style={{
                fontSize: "0.72rem",
                color: "hsl(var(--muted-foreground))",
                marginBottom: "0.75rem",
                padding: "0.5rem 0.75rem",
                background: "hsl(var(--muted) / 0.3)",
                borderRadius: "calc(var(--radius) - 2px)",
              }}
            >
              <strong>Bond settlement:</strong>{" "}
              {proposalChanged
                ? "✅ You are changing the outcome — objectors' bonds will be RETURNED + rewarded."
                : "❌ If you keep the proposed outcome — objectors' bonds will be FORFEITED."}
            </div>
            {disputes.map((d: Dispute) => (
              <div
                key={d.id}
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: "0.5rem",
                  paddingLeft: "0.5rem",
                  borderLeft: "2px solid hsl(35 100% 50% / 0.4)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                }}
              >
                <span>{d.reason ?? "No reason provided"}</span>
                {d.bondAmount !== undefined && Number(d.bondAmount) > 0 && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontWeight: 700,
                      color: "hsl(35 100% 50%)",
                    }}
                  >
                    Nu {Number(d.bondAmount).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Outcome selector */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {market.outcomes.map((outcome: MarketOutcome) => {
            const isSelected = selectedOutcomeIds.includes(outcome.id)
            return (
              <label
                key={outcome.id}
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius)",
                  background: isSelected
                    ? "hsl(var(--primary) / 0.1)"
                    : "hsl(var(--muted) / 0.2)",
                  border: `1px solid ${isSelected ? "hsl(var(--primary))" : "transparent"}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <input
                  type="checkbox"
                  value={outcome.id}
                  checked={isSelected}
                  onChange={() => toggleOutcome(outcome.id)}
                  style={{
                    accentColor: "hsl(var(--primary))",
                    width: 16,
                    height: 16,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "hsl(var(--foreground))",
                    }}
                  >
                    {outcome.label}
                    {outcome.id === market.proposedOutcomeId && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "hsl(var(--primary))",
                          background: "hsl(var(--primary) / 0.1)",
                          padding: "0.1rem 0.4rem",
                          borderRadius: 4,
                        }}
                      >
                        Proposed
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Pool:{" "}
                    {parseFloat(
                      String(outcome.totalBetAmount ?? 0)
                    ).toLocaleString()}{" "}
                    credits
                  </div>
                </div>
                {isSelected && (
                  <div
                    style={{
                      color: "hsl(var(--primary))",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </div>
                )}
              </label>
            )
          })}
        </div>

        {/* Evidence — mandatory */}
        <div
          style={{
            background: "hsl(var(--primary) / 0.04)",
            border: "1px solid hsl(var(--primary) / 0.15)",
            borderRadius: "var(--radius)",
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "hsl(var(--primary))",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <ExternalLink size={13} /> Public Evidence — Required
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.78rem",
                fontWeight: 600,
                marginBottom: "0.4rem",
                color: "hsl(var(--foreground))",
              }}
            >
              Evidence URL{" "}
              <span style={{ color: "hsl(var(--destructive))" }}>*</span>
            </label>
            <input
              type="url"
              value={evidenceUrl}
              placeholder="https://www.fifa.com/matches/12345"
              onChange={(e) => {
                setEvidenceUrl(e.target.value)
                validateUrl(e.target.value)
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: urlError
                  ? "1px solid hsl(var(--destructive))"
                  : "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
                fontSize: "0.82rem",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {urlError && (
              <p
                style={{
                  color: "hsl(var(--destructive))",
                  fontSize: "0.72rem",
                  marginTop: "0.25rem",
                }}
              >
                {urlError}
              </p>
            )}
            <p
              style={{
                fontSize: "0.72rem",
                color: "hsl(var(--muted-foreground))",
                marginTop: "0.25rem",
              }}
            >
              Link to screenshot, official results page, or live API — shown
              publicly on the result page.
            </p>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.78rem",
                fontWeight: 600,
                marginBottom: "0.4rem",
                color: "hsl(var(--foreground))",
              }}
            >
              Explanation{" "}
              <span style={{ color: "hsl(var(--destructive))" }}>*</span>
            </label>
            <textarea
              value={evidenceNote}
              placeholder="e.g. Official FIFA match report confirms Argentina 2–1 France at full time. Score verified via FIFA live feed."
              onChange={(e) => setEvidenceNote(e.target.value)}
              rows={3}
              maxLength={2000}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
                fontSize: "0.82rem",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <p
              style={{
                fontSize: "0.72rem",
                color: "hsl(var(--muted-foreground))",
                marginTop: "0.25rem",
              }}
            >
              {evidenceNote.length}/2000 — Explain how the evidence determines
              the winner. Shown on the public Resolution Log.
            </p>
          </div>
        </div>

        <div
          style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}
        >
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            onClick={() =>
              onResolve(selectedOutcomeIds, evidenceUrl, evidenceNote)
            }
            disabled={!canSubmit}
          >
            {loading ? "Resolving…" : "Confirm Winner & Publish Evidence"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResolveMarketModal
