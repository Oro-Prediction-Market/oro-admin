import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { RESETTLE_PREFILL_KEY } from "./ResettlePanel"

interface Mismatch {
  source: "football" | "ucl"
  marketId: string
  title: string
  settledAs: { id: string; label: string }
  shouldBe: { id: string; label: string }
  detail: string
  corrected: boolean
}

interface RunSummary {
  ranAt: string
  trigger: "schedule" | "manual"
  lookbackDays: number
  checked: number
  mismatchCount: number
  unavailable: string[]
}

interface AuditResponse {
  last: (Omit<RunSummary, "mismatchCount"> & { mismatches: Mismatch[] }) | null
  runs: RunSummary[]
}

const MUTED = "hsl(var(--muted-foreground))"
const RED = "#f87171"
const GREEN = "#34d399"
const AMBER = "#fbbf24"

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

/**
 * The daily 09:30 re-check of the last seven days of settled results.
 *
 * Its only output used to be a Telegram DM, so a quiet morning could mean
 * "all correct" or "never ran". This shows the last run, any market whose
 * settled result the provider now contradicts, and whether each has since
 * been corrected.
 */
export default function SettlementAuditPanel() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<AuditResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData((await api.getSettlementAudit()) as AuditResponse)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const runNow = async () => {
    setRunning(true)
    setNote(null)
    try {
      const res = (await api.runSettlementAudit()) as { busy?: boolean }
      if (res?.busy)
        setNote("A run is already in progress — refresh in a minute.")
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const last = data?.last
  const open = last?.mismatches.filter((m) => !m.corrected) ?? []
  // A daily job: anything older than ~26h means this morning's did not run.
  const overdue = !!last && Date.now() - Date.parse(last.ranAt) > 26 * 3600_000

  let headline: { text: string; color: string }
  if (!last) headline = { text: "no run recorded yet", color: MUTED }
  else if (open.length)
    headline = {
      text: `${open.length} wrong result${open.length > 1 ? "s" : ""}`,
      color: RED,
    }
  else if (overdue) headline = { text: "did not run today", color: AMBER }
  else if (last.unavailable.length)
    headline = { text: "partly checked", color: AMBER }
  else headline = { text: "all correct", color: GREEN }

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
          gap: 8,
          flexWrap: "wrap",
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
          {open.length ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}{" "}
          Settlement audit
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: headline.color,
            }}
          >
            {headline.text}
          </span>
        </h3>
        <button
          className="secondary"
          onClick={() => void runNow()}
          disabled={running}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} />
          {running ? "Checking…" : "Run now"}
        </button>
      </div>

      {err && <div style={{ color: RED, fontSize: "0.85rem" }}>{err}</div>}
      {note && <div style={{ color: MUTED, fontSize: "0.85rem" }}>{note}</div>}

      {last && (
        <div
          style={{ fontSize: "0.85rem", color: MUTED, marginBottom: "0.75rem" }}
        >
          Last run {when(last.ranAt)} (
          {last.trigger === "manual" ? "manual" : "scheduled"}) — {last.checked}{" "}
          settled market{last.checked === 1 ? "" : "s"} from the last{" "}
          {last.lookbackDays} days re-checked against the results provider.
          {last.unavailable.map((u) => (
            <div key={u} style={{ color: AMBER }}>
              Not checked: {u}
            </div>
          ))}
        </div>
      )}

      {last && last.mismatches.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Market</th>
                <th style={{ textAlign: "left" }}>Settled as</th>
                <th style={{ textAlign: "left" }}>Provider says</th>
                <th style={{ textAlign: "left" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {last.mismatches.map((m) => (
                <tr key={m.marketId}>
                  <td>
                    {m.title}
                    <div style={{ color: MUTED, fontSize: "0.75rem" }}>
                      <code>{m.marketId}</code>
                    </div>
                  </td>
                  <td>{m.settledAs.label}</td>
                  <td>
                    <b>{m.shouldBe.label}</b>{" "}
                    <span style={{ color: MUTED }}>
                      {m.source === "ucl" ? "advancing" : `(${m.detail})`}
                    </span>
                  </td>
                  <td>
                    {m.corrected ? (
                      <span
                        style={{
                          color: GREEN,
                          display: "inline-flex",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        <CheckCircle2 size={14} /> Corrected
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: RED, fontWeight: 600 }}>
                          Needs correcting
                        </span>
                        <button
                          className="secondary"
                          onClick={() => {
                            try {
                              sessionStorage.setItem(
                                RESETTLE_PREFILL_KEY,
                                JSON.stringify({
                                  marketId: m.marketId,
                                  title: m.title,
                                  outcomeId: m.shouldBe.id,
                                })
                              )
                            } catch {
                              /* the page still opens; the market is searched by hand */
                            }
                            window.dispatchEvent(
                              new CustomEvent("admin:navigate", {
                                detail: "corrections",
                              })
                            )
                          }}
                        >
                          Correct…
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.runs.length > 1 && (
        <details style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
          <summary style={{ cursor: "pointer", color: MUTED }}>
            Previous runs ({data.runs.length})
          </summary>
          <table style={{ width: "100%", marginTop: "0.5rem" }}>
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.ranAt}>
                  <td>{when(r.ranAt)}</td>
                  <td style={{ color: MUTED }}>{r.trigger}</td>
                  <td>{r.checked} checked</td>
                  <td style={{ color: r.mismatchCount ? RED : MUTED }}>
                    {r.mismatchCount
                      ? `${r.mismatchCount} wrong`
                      : "all correct"}
                  </td>
                  <td style={{ color: AMBER }}>
                    {r.unavailable.length ? "partly checked" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
