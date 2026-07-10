import React, { useState } from "react"

interface MarketOutcome {
  id: string
  label: string
  totalBetAmount?: string | number
}

interface ProposeMarketModalProps {
  market: { id: string; title: string; outcomes: MarketOutcome[] }
  onPropose: (proposedOutcomeId: string, windowMinutes: number) => void
  onCancel: () => void
  loading?: boolean
}

const WINDOW_OPTIONS = [
  { minutes: 10, label: "10 min", sub: "urgent" },
  { minutes: 20, label: "20 min", sub: "" },
  { minutes: 30, label: "30 min", sub: "recommended" },
  { minutes: 60, label: "1 hour", sub: "" },
  { minutes: 120, label: "2 hours", sub: "complex markets" },
]

const ProposeMarketModal: React.FC<ProposeMarketModalProps> = ({
  market,
  onPropose,
  onCancel,
  loading,
}) => {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("")
  const [windowMinutes, setWindowMinutes] = useState<number>(30)

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
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
          maxWidth: 420,
          maxHeight: "85vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <h3>Propose Outcome</h3>
        <p
          style={{
            color: "hsl(var(--muted-foreground))",
            marginBottom: "0.75rem",
          }}
        >
          <strong style={{ color: "hsl(var(--foreground))" }}>
            {market.title}
          </strong>
        </p>
        <div
          style={{
            background: "hsl(var(--primary) / 0.05)",
            border: "1px solid hsl(var(--primary) / 0.2)",
            borderRadius: "var(--radius)",
            padding: "0.75rem 1rem",
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
            marginBottom: "1.5rem",
          }}
        >
          This opens a short objection window. Users with active positions can
          object for <strong>free</strong> (no bond required). You must supply
          evidence when you submit the final resolution — it will be published
          publicly.
        </div>

        {/* Window selector */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
              color: "hsl(var(--foreground))",
            }}
          >
            Objection Window
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {WINDOW_OPTIONS.map((opt) => (
              <label
                key={opt.minutes}
                style={{
                  flex: "1 1 60px",
                  padding: "0.55rem 0.5rem",
                  borderRadius: "var(--radius)",
                  background:
                    windowMinutes === opt.minutes
                      ? "hsl(var(--primary) / 0.12)"
                      : "hsl(var(--muted) / 0.2)",
                  border: `1px solid ${windowMinutes === opt.minutes ? "hsl(var(--primary))" : "transparent"}`,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.15rem",
                  textAlign: "center",
                }}
              >
                <input
                  type="radio"
                  name="window"
                  value={opt.minutes}
                  checked={windowMinutes === opt.minutes}
                  onChange={() => setWindowMinutes(opt.minutes)}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: windowMinutes === opt.minutes ? 700 : 500,
                    color:
                      windowMinutes === opt.minutes
                        ? "hsl(var(--primary))"
                        : "hsl(var(--foreground))",
                  }}
                >
                  {opt.label}
                </span>
                {opt.sub && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "hsl(var(--muted-foreground))",
                      opacity: 0.8,
                    }}
                  >
                    {opt.sub}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          {market.outcomes.map((outcome: MarketOutcome) => (
            <label
              key={outcome.id}
              style={{
                padding: "1rem",
                borderRadius: "var(--radius)",
                background:
                  selectedOutcomeId === outcome.id
                    ? "hsl(var(--primary) / 0.1)"
                    : "hsl(var(--muted) / 0.2)",
                border: `1px solid ${selectedOutcomeId === outcome.id ? "hsl(var(--primary))" : "transparent"}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <input
                type="radio"
                name="proposed-outcome"
                value={outcome.id}
                checked={selectedOutcomeId === outcome.id}
                onChange={() => setSelectedOutcomeId(outcome.id)}
                style={{ accentColor: "hsl(var(--primary))" }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}
                >
                  {outcome.label}
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
              {selectedOutcomeId === outcome.id && (
                <div
                  style={{
                    color: "hsl(var(--primary))",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                  }}
                >
                  ✓ Proposed
                </div>
              )}
            </label>
          ))}
        </div>

        <div
          style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}
        >
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            onClick={() => onPropose(selectedOutcomeId, windowMinutes)}
            disabled={!selectedOutcomeId || loading}
          >
            {loading
              ? "Opening window…"
              : `Propose & Open ${WINDOW_OPTIONS.find((o) => o.minutes === windowMinutes)?.label ?? windowMinutes + "min"} Window`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProposeMarketModal
