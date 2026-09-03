import { AlertTriangle, XCircle, RefreshCw } from "lucide-react"

interface Props {
  market: {
    id: string
    title: string
    status: string
    totalPool: string | number
    outcomes: { id: string; label: string; totalBetAmount: string | number }[]
  }
  pendingBetCount: number
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}

export default function CancelMarketModal({
  market,
  pendingBetCount,
  onConfirm,
  onClose,
  loading,
}: Props) {
  const totalRefund = parseFloat(String(market.totalPool || 0))

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
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--destructive) / 0.4)",
          borderRadius: "1rem",
          padding: "2rem",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              background: "hsl(var(--destructive) / 0.12)",
              borderRadius: "50%",
              padding: "0.6rem",
              display: "flex",
            }}
          >
            <XCircle size={22} color="hsl(var(--destructive))" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
              Cancel &amp; Void Market
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              This action cannot be undone
            </p>
          </div>
        </div>

        {/* Market info */}
        <div
          style={{
            background: "hsl(var(--muted) / 0.2)",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            padding: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <p
            style={{
              margin: "0 0 0.25rem",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            {market.title}
          </p>
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 4,
              background: "hsl(var(--muted) / 0.4)",
              color: "hsl(var(--muted-foreground))",
              textTransform: "uppercase",
            }}
          >
            {market.status}
          </span>
        </div>

        {/* Refund impact */}
        <div
          style={{
            background: "hsl(var(--destructive) / 0.06)",
            border: "1px solid hsl(var(--destructive) / 0.25)",
            borderRadius: "0.5rem",
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.75rem",
            }}
          >
            <AlertTriangle size={15} color="hsl(var(--destructive))" />
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "hsl(var(--destructive))",
              }}
            >
              Refund Impact
            </span>
          </div>
          <div
            className="stack-sm"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                Bets to refund
              </p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                {pendingBetCount}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                Total refund amount
              </p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>
                BTN {totalRefund.toLocaleString()}
              </p>
            </div>
          </div>
          <div
            style={{
              marginTop: "0.75rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid hsl(var(--destructive) / 0.15)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              All <strong>pending</strong> bets will be refunded to each user's
              balance immediately. Already-refunded or won/lost bets are not
              affected.
            </p>
          </div>
        </div>

        {/* Outcome breakdown */}
        {market.outcomes.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <p
              style={{
                margin: "0 0 0.5rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "hsl(var(--muted-foreground))",
              }}
            >
              OUTCOME POOLS (will be voided)
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {market.outcomes.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.82rem",
                    padding: "0.35rem 0.6rem",
                    background: "hsl(var(--muted) / 0.15)",
                    borderRadius: "0.35rem",
                  }}
                >
                  <span>{o.label}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                    BTN{" "}
                    {parseFloat(String(o.totalBetAmount || 0)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
          }}
        >
          <button className="secondary" onClick={onClose} disabled={loading}>
            Keep Market
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: "hsl(var(--destructive))",
              color: "#fff",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {loading ? (
              <RefreshCw
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : (
              <XCircle size={14} />
            )}
            {loading
              ? "Cancelling…"
              : `Cancel & Refund ${pendingBetCount} Bets`}
          </button>
        </div>
      </div>
    </div>
  )
}
