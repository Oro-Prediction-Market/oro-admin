import { useCallback, useEffect, useState } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

type JobStatus = "ok" | "failing" | "stale" | "disabled" | "never"

interface JobRow {
  key: string
  label: string
  schedule: string
  status: JobStatus
  lastOkAt: string | null
  lastFailAt: string | null
  lastError: string | null
  lastSkipAt: string | null
  lastSkipReason: string | null
}

interface JobsResponse {
  jobs: JobRow[]
  seasonRollover: {
    expected: string
    active: string | null
    status: "ok" | "pending" | "behind"
  }
}

const STATUS: Record<JobStatus, { text: string; color: string }> = {
  ok: { text: "OK", color: "#34d399" },
  failing: { text: "FAILING", color: "#f87171" },
  stale: { text: "STOPPED", color: "#f87171" },
  disabled: { text: "Off", color: "hsl(var(--muted-foreground))" },
  // Neutral, not red: a monthly job has nothing recorded for weeks after
  // monitoring is first deployed, and that is not a fault.
  never: { text: "No run yet", color: "hsl(var(--muted-foreground))" },
}

const ago = (iso: string | null) => {
  if (!iso) return "—"
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

/**
 * The scheduled jobs that move money, and whether each is still running.
 *
 * The keeper has its own cards below; this covers everything else that only
 * ever reported to the logs — season prizes, revenue booking, withdrawal
 * reconcilers, the USDT pollers, and the TER/BTC settlement loops.
 */
export default function JobHealthPanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<JobsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData((await api.getJobHealth()) as JobsResponse)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const problems =
    data?.jobs.filter((j) => j.status === "failing" || j.status === "stale")
      .length ?? 0
  const sr = data?.seasonRollover

  return (
    <div
      className="glass-card"
      style={{ padding: "1rem", marginBottom: "2rem" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Activity size={16} /> Scheduled jobs
          {data && (
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: problems ? "#f87171" : "#34d399",
              }}
            >
              {problems ? `${problems} need attention` : "all running"}
            </span>
          )}
        </h3>
        <button
          className="secondary"
          onClick={() => void load()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {err && (
        <div style={{ color: "#f87171", fontSize: "0.85rem" }}>{err}</div>
      )}

      {sr && (
        <div
          style={{
            fontSize: "0.85rem",
            marginBottom: "0.75rem",
            color:
              sr.status === "behind"
                ? "#f87171"
                : "hsl(var(--muted-foreground))",
          }}
        >
          Active season: <b>{sr.active ?? "none"}</b>
          {sr.status === "ok" && " — current ✓"}
          {sr.status === "pending" &&
            ` — rollover to ${sr.expected} due shortly`}
          {sr.status === "behind" &&
            ` — should be ${sr.expected}. The monthly rollover has not run; last month's prizes are probably unpaid.`}
        </div>
      )}

      {data && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Last success</th>
                <th>Last failure</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.key}>
                  <td>{j.label}</td>
                  <td style={{ color: "hsl(var(--muted-foreground))" }}>
                    {j.schedule}
                  </td>
                  <td
                    style={{ fontWeight: 600, color: STATUS[j.status].color }}
                    title={j.lastSkipReason ?? undefined}
                  >
                    {STATUS[j.status].text}
                  </td>
                  <td>{ago(j.lastOkAt)}</td>
                  <td
                    title={j.lastError ?? undefined}
                    style={{
                      color: j.status === "failing" ? "#f87171" : undefined,
                    }}
                  >
                    {j.lastFailAt
                      ? `${ago(j.lastFailAt)} — ${j.lastError ?? ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
