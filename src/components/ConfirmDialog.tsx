import { AlertTriangle, RefreshCw } from "lucide-react"

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Reusable in-app confirmation modal — replaces native window.confirm/alert so
 * confirmations match the dashboard's look and read clearly. `message` supports
 * line breaks (rendered with white-space: pre-line).
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const danger = variant === "danger"
  const accent = danger ? "hsl(var(--destructive))" : "hsl(var(--primary))"

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
      onClick={loading ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "hsl(var(--card))",
          border: `1px solid ${
            danger ? "hsl(var(--destructive) / 0.4)" : "hsl(var(--border))"
          }`,
          borderRadius: "1rem",
          padding: "2rem",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              background: danger
                ? "hsl(var(--destructive) / 0.12)"
                : "hsl(var(--primary) / 0.12)",
              borderRadius: "50%",
              padding: "0.6rem",
              display: "flex",
            }}
          >
            <AlertTriangle size={22} color={accent} />
          </div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
            {title}
          </h3>
        </div>

        {/* Message */}
        <p
          style={{
            margin: "0 0 1.5rem",
            fontSize: "0.9rem",
            lineHeight: 1.5,
            color: "hsl(var(--muted-foreground))",
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </p>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "flex-end",
          }}
        >
          <button className="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={
              danger
                ? {
                    // Destructive action: solid red so it clearly stands out.
                    background: accent,
                    color: "#fff",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }
                : {
                    // Default action: the house tinted-primary look (a solid
                    // full-saturation cyan fill is too bright). Only layout is
                    // overridden — colors come from the base button style.
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }
            }
          >
            {loading && (
              <RefreshCw
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
            )}
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
