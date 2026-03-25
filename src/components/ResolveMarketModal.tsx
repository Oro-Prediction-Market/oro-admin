import React, { useState } from "react"

interface ResolveMarketModalProps {
  market: any
  onResolve: (winningOutcomeId: string) => void
  onCancel: () => void
  loading?: boolean
}

const ResolveMarketModal: React.FC<ResolveMarketModalProps> = ({
  market,
  onResolve,
  onCancel,
  loading,
}) => {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>("")

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div className="glass-card" style={{ width: "400px" }}>
        <h3>Resolve Market</h3>
        <p style={{ color: "hsl(var(--muted-foreground))", marginBottom: "1.5rem" }}>
          Select the winning outcome for: <br/>
          <strong style={{ color: "white" }}>{market.title}</strong>
        </p>

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
                name="outcome"
                value={outcome.id}
                checked={selectedOutcomeId === outcome.id}
                onChange={() => setSelectedOutcomeId(outcome.id)}
                style={{ accentColor: "hsl(var(--primary))" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {outcome.label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                  ID: {outcome.id.substring(0, 8)}...
                </div>
              </div>
              {selectedOutcomeId === outcome.id && (
                <div style={{ color: "hsl(var(--primary))", fontSize: "0.875rem" }}>
                  ✓ Selected
                </div>
              )}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            onClick={() => onResolve(selectedOutcomeId)}
            disabled={!selectedOutcomeId || loading}
          >
            {loading ? "Resolving..." : "Confirm Winner"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResolveMarketModal
