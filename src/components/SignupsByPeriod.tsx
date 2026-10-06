import { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

interface Bucket {
  start: string
  label: string
  partial: boolean
  signups: number
  byProvider: Record<string, number>
}

interface SignupsResponse {
  period: "week" | "month"
  buckets: Bucket[]
  total: number
}

const PROVIDER_LABEL: Record<string, string> = {
  telegram: "Telegram",
  bhutanapp: "BhutanApp",
  google: "Google",
  unknown: "Unknown",
}
const providerLabel = (p: string) =>
  PROVIDER_LABEL[p] ?? `${p.charAt(0).toUpperCase()}${p.slice(1)}`

/**
 * New users per week or per month, on the Bhutan calendar.
 *
 * The daily chart above answers "what happened lately"; this answers "how does
 * this month compare with the last six". One series, so one hue and no legend.
 * Every row also prints its number and provider split as text, so the bars are
 * never the only way to read it — the rows are the table view.
 */
export default function SignupsByPeriod() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [period, setPeriod] = useState<"week" | "month">("week")
  const [data, setData] = useState<SignupsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .getSignupsByPeriod(period, 12)
      .then((d) => live && (setData(d as SignupsResponse), setErr(null)))
      .catch((e: Error) => live && setErr(e.message))
    return () => {
      live = false
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period])

  // Newest first reads naturally as a list; the scale is shared across rows.
  const rows = data ? [...data.buckets].reverse() : []
  const max = Math.max(1, ...rows.map((b) => b.signups))

  return (
    <div className="glass-card" style={{ padding: "1rem", marginTop: "2rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          gap: "1rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>
          New users by {period}
          {data && (
            <span
              style={{
                fontWeight: 400,
                fontSize: "0.85rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {" "}
              · {data.total.toLocaleString()} in the last {data.buckets.length}{" "}
              {period}s
            </span>
          )}
        </h3>
        <div role="tablist" style={{ display: "flex", gap: 4 }}>
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              className={period === p ? "" : "secondary"}
              onClick={() => setPeriod(p)}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
            >
              {p === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div style={{ color: "#f87171", fontSize: "0.85rem" }}>{err}</div>
      )}

      <div role="table" aria-label={`New users by ${period}`}>
        {rows.map((b) => {
          const split = Object.entries(b.byProvider)
            .sort((a, z) => z[1] - a[1])
            .map(([p, n]) => `${providerLabel(p)} ${n}`)
            .join(" · ")
          return (
            <div
              key={b.start}
              role="row"
              title={`${b.label}${b.partial ? " (so far)" : ""}: ${b.signups} new users${split ? ` — ${split}` : ""}`}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(140px, 180px) 1fr minmax(48px, auto)",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.35rem 0",
              }}
            >
              <span role="cell" style={{ fontSize: "0.85rem" }}>
                {b.label}
                {b.partial && (
                  <span
                    style={{
                      color: "hsl(var(--muted-foreground))",
                      fontSize: "0.75rem",
                    }}
                  >
                    {" "}
                    · so far
                  </span>
                )}
              </span>
              <span
                role="cell"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    height: 10,
                    background: "hsl(var(--border))",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${(b.signups / max) * 100}%`,
                      background: "hsl(var(--primary))",
                      // In-progress period: lighter AND labelled "so far" above,
                      // so it is never distinguished by colour alone.
                      opacity: b.partial ? 0.45 : 1,
                      borderRadius: 4,
                    }}
                  />
                </span>
                {split && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "hsl(var(--muted-foreground))",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {split}
                  </span>
                )}
              </span>
              <span
                role="cell"
                style={{
                  textAlign: "right",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {b.signups.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
