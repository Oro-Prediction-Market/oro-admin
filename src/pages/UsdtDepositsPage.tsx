import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface Deposit {
  id: string
  userId: string
  username: string | null
  firstName: string | null
  network: string
  amountUsdt: number
  detectedAmountUsdt: number | null
  status: string
  txHash: string | null
  failureReason: string | null
  createdAt: string
  creditedAt: string | null
}

interface DepositsResponse {
  statuses: string[]
  last7DaysByStatus: { status: string; count: number }[]
  uncredited: { count: number; amountUsdt: number }
  deposits: Deposit[]
}

interface WebhookHealth {
  usdtEnabled: boolean
  secretConfigured: boolean
  lastReceivedAt: string | null
  received7d: number
  failed7d: number
  unprocessed: number
  rejectedToday: number
  rejected7d: number
  lastRejectedAt: string | null
}

interface WebhookEvent {
  id: string
  subject: string
  eventAction: string
  network: string | null
  txHash: string | null
  amount: string | null
  currency: string | null
  receivedAt: string
  processedAt: string | null
  processError: string | null
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "—"
const short = (s: string | null, n = 10) => (s ? `${s.slice(0, n)}…` : "—")

/**
 * USDT deposits and the 21Pay webhook feed that credits them.
 *
 * The webhook table only ever holds ACCEPTED deliveries — one that fails
 * verification is rejected before anything records it. So the health strip
 * at the top reports the guard's rejection count and whether the secret is
 * configured; without those, a misnamed secret makes this page look calm
 * while every delivery bounces.
 */
export default function UsdtDepositsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [status, setStatus] = useState("")
  const [deposits, setDeposits] = useState<DepositsResponse | null>(null)
  const [hooks, setHooks] = useState<{
    health: WebhookHealth
    events: WebhookEvent[]
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [d, w] = await Promise.all([
        api.getUsdtDeposits(50, status || undefined),
        api.getPay21Webhooks(50),
      ])
      setDeposits(d as DepositsResponse)
      setHooks(w as { health: WebhookHealth; events: WebhookEvent[] })
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status])

  useEffect(() => {
    void load()
  }, [load])

  const h = hooks?.health

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>USDT Deposits</h2>
        <button
          className="secondary"
          onClick={() => void load()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {err && (
        <div
          className="glass-card"
          style={{ padding: "1rem", color: "#f87171", marginBottom: "1rem" }}
        >
          {err}
        </div>
      )}

      {h && <HealthStrip h={h} uncredited={deposits?.uncredited} />}

      <div
        className="glass-card"
        style={{ padding: 0, overflowX: "auto", marginBottom: "1.5rem" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
          }}
        >
          <strong>Deposit intents</strong>
          <select
            className="input-field"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="">All statuses</option>
            {deposits?.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>User</th>
              <th>Network</th>
              <th>Requested</th>
              <th>Detected</th>
              <th>Status</th>
              <th>Credited</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {deposits?.deposits.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  No deposits.
                </td>
              </tr>
            )}
            {deposits?.deposits.map((d) => (
              <tr key={d.id}>
                <td style={{ whiteSpace: "nowrap" }}>{when(d.createdAt)}</td>
                <td title={d.userId}>
                  {d.username ?? d.firstName ?? short(d.userId, 8)}
                </td>
                <td>{d.network}</td>
                <td>{d.amountUsdt} USDT</td>
                <td>
                  {d.detectedAmountUsdt == null
                    ? "—"
                    : `${d.detectedAmountUsdt} USDT`}
                </td>
                <td title={d.failureReason ?? undefined}>{d.status}</td>
                <td>{d.creditedAt ? when(d.creditedAt) : "—"}</td>
                <td
                  style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                  title={d.txHash ?? undefined}
                >
                  {short(d.txHash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card" style={{ padding: 0, overflowX: "auto" }}>
        <div style={{ padding: "0.75rem 1rem" }}>
          <strong>21Pay webhook deliveries (accepted)</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Event</th>
              <th>Network</th>
              <th>Amount</th>
              <th>Processed</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {hooks?.events.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  No deliveries recorded.
                </td>
              </tr>
            )}
            {hooks?.events.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{when(e.receivedAt)}</td>
                <td title={e.subject}>{e.eventAction}</td>
                <td>{e.network ?? "—"}</td>
                <td>{e.amount ? `${e.amount} ${e.currency ?? ""}` : "—"}</td>
                <td>{e.processedAt ? when(e.processedAt) : "—"}</td>
                <td style={{ color: e.processError ? "#f87171" : undefined }}>
                  {e.processError ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HealthStrip({
  h,
  uncredited,
}: {
  h: WebhookHealth
  uncredited?: { count: number; amountUsdt: number }
}) {
  const problems: string[] = []
  if (h.usdtEnabled && !h.secretConfigured)
    problems.push(
      "USDT is enabled but the webhook secret (TWENTYONE_PAY_WEBHOOK_SECRET) is not set — every delivery is being rejected. Deposits only arrive via the fallback poller."
    )
  if (h.rejectedToday > 0)
    problems.push(
      `${h.rejectedToday} webhook deliveries rejected today (${h.rejected7d} in 7 days). Last: ${when(h.lastRejectedAt)}.`
    )
  if (uncredited && uncredited.count > 0)
    problems.push(
      `${uncredited.count} confirmed deposit(s) not credited — ${uncredited.amountUsdt} USDT a user sent that is not in their balance.`
    )
  if (h.unprocessed > 0)
    problems.push(`${h.unprocessed} accepted deliveries never processed.`)

  const ok = problems.length === 0
  return (
    <div
      className="glass-card"
      style={{
        padding: "0.75rem 1rem",
        marginBottom: "1.5rem",
        border: `1px solid ${ok ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.5)"}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {ok ? (
          <CheckCircle2 size={16} color="#34d399" />
        ) : (
          <AlertTriangle size={16} color="#f87171" />
        )}
        {ok ? "Webhook feed healthy" : "Needs attention"}
      </div>
      {problems.map((p) => (
        <div
          key={p}
          style={{ display: "flex", gap: 6, fontSize: "0.85rem", marginTop: 4 }}
        >
          <XCircle
            size={14}
            color="#f87171"
            style={{ flexShrink: 0, marginTop: 2 }}
          />{" "}
          {p}
        </div>
      ))}
      <div
        style={{
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
          marginTop: 8,
        }}
      >
        USDT {h.usdtEnabled ? "enabled" : "disabled"} · secret{" "}
        {h.secretConfigured ? "configured" : "missing"} · last delivery{" "}
        {when(h.lastReceivedAt)} · {h.received7d} accepted / {h.failed7d} failed
        processing in 7 days
      </div>
    </div>
  )
}
