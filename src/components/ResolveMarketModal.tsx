import React, { useState } from "react"

interface ResolveMarketModalProps {
  market: any
  disputes?: any[]
  onResolve: (winningOutcomeId: string) => void
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
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(market.proposedOutcomeId ?? "")

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
        <h3>Final Resolution</h3>
        <p style={{ color: "hsl(var(--muted-foreground))", marginBottom: "1rem" }}>
          <strong style={{ color: "white" }}>{market.title}</strong>
        </p>

        {disputes.length > 0 && (
          <div style={{
            background: "hsla(45, 100%, 50%, 0.08)",
            border: "1px solid hsla(45, 100%, 50%, 0.3)",
            borderRadius: "var(--radius)",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem"
          }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "hsl(45, 80%, 70%)", marginBottom: "0.5rem" }}>
              {disputes.length} Dispute{disputes.length !== 1 ? "s" : ""} Submitted
            </div>
            {disputes.map((d: any) => (
              <div key={d.id} style={{ fontSize: "0.75rem", color: "hsl(45, 60%, 60%)", marginBottom: "0.25rem" }}>
                Bond: {Number(d.bondAmount).toLocaleString()} credits
                {d.reason && <span style={{ opacity: 0.8 }}> — "{d.reason}"</span>}
              </div>
            ))}
          </div>
        )}

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
                <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {outcome.label}
                  {outcome.id === market.proposedOutcomeId && (
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "hsl(var(--primary))", background: "hsla(180,100%,50%,0.1)", padding: "0.1rem 0.4rem", borderRadius: 4 }}>Proposed</span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                  Pool: {parseFloat(outcome.totalBetAmount || 0).toLocaleString()} credits
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
