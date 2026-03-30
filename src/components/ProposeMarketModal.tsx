import React, { useState } from "react"

interface ProposeMarketModalProps {
  market: any
  onPropose: (proposedOutcomeId: string) => void
  onCancel: () => void
  loading?: boolean
}

const ProposeMarketModal: React.FC<ProposeMarketModalProps> = ({
  market,
  onPropose,
  onCancel,
  loading,
}) => {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("")

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div className="glass-card" style={{ width: "420px" }}>
        <h3>Propose Outcome</h3>
        <p style={{ color: "hsl(var(--muted-foreground))", marginBottom: "0.75rem" }}>
          <strong style={{ color: "white" }}>{market.title}</strong>
        </p>
        <div style={{
          background: "hsla(45, 100%, 50%, 0.08)",
          border: "1px solid hsla(45, 100%, 50%, 0.3)",
          borderRadius: "var(--radius)",
          padding: "0.75rem 1rem",
          fontSize: "0.8rem",
          color: "hsl(45, 80%, 70%)",
          marginBottom: "1.5rem"
        }}>
          This opens a 24-hour dispute window. Bettors can stake bonds to flag disagreement.
          You make the final resolution call after reviewing disputes.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
          {market.outcomes.map((outcome: any) => (
            <label
              key={outcome.id}
              style={{
                padding: "1rem",
                borderRadius: "var(--radius)",
                background: selectedOutcomeId === outcome.id ? "hsla(180, 100%, 50%, 0.1)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${selectedOutcomeId === outcome.id ? "hsl(var(--primary))" : "transparent"}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "1rem"
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
                <div style={{ fontWeight: 500 }}>{outcome.label}</div>
                <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                  Pool: {parseFloat(outcome.totalBetAmount || 0).toLocaleString()} credits
                </div>
              </div>
              {selectedOutcomeId === outcome.id && (
                <div style={{ color: "hsl(var(--primary))", fontSize: "0.875rem" }}>✓ Proposed</div>
              )}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button
            onClick={() => onPropose(selectedOutcomeId)}
            disabled={!selectedOutcomeId || loading}
          >
            {loading ? "Opening window…" : "Propose & Open Dispute Window"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProposeMarketModal
