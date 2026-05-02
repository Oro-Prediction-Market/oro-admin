import { useState, useCallback } from "react"
import { CheckCircle, XCircle, X } from "lucide-react"

interface ToastMessage {
  id: number
  type: "success" | "error"
  message: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  let counter = 0

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (type: "success" | "error", message: string) => {
      const id = ++counter
      setToasts((prev) => [...prev, { id, type, message }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const ToastContainer = (
    <div
      style={{
        position: "fixed",
        top: "1.25rem",
        right: "1.25rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxWidth: "380px",
        width: "100%",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "0.875rem 1rem",
            borderRadius: "var(--radius, 8px)",
            background:
              t.type === "success" ? "hsl(160 60% 20%)" : "hsl(0 60% 20%)",
            border: `1px solid ${
              t.type === "success" ? "hsl(160 60% 35%)" : "hsl(0 60% 35%)"
            }`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            color: "hsl(var(--foreground))",
            fontSize: "0.875rem",
            lineHeight: 1.4,
            pointerEvents: "all",
            animation: "slideIn 0.2s ease",
          }}
        >
          {t.type === "success" ? (
            <CheckCircle
              size={16}
              style={{ color: "hsl(160 60% 55%)", flexShrink: 0, marginTop: 2 }}
            />
          ) : (
            <XCircle
              size={16}
              style={{ color: "hsl(0 70% 60%)", flexShrink: 0, marginTop: 2 }}
            />
          )}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              color: "hsl(var(--muted-foreground))",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )

  return { notify, ToastContainer }
}
