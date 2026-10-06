import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, RefreshCw, Trophy, XCircle } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface PodiumPlace {
  rank: number
  userId: string
  name: string | null
  winRate: number
  volume: number
  prize: number
  paid: boolean
  paidAmount: number | null
  paidAt: string | null
}

interface SeasonRow {
  id: string
  label: string
  status: "active" | "closed"
  startsAt: string
  endsAt: string
  qualifiers: number
  paysOut: boolean
  podium: PodiumPlace[]
}

interface SeasonsResponse {
  minQualifiers: number
  seasons: SeasonRow[]
}

const nu = (n: number) =>
  `Nu ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`

/**
 * Monthly seasons and whether each prize actually landed.
 *
 * Prizes are credited fire-and-forget after the season closes, one winner at a
 * time, so a month can be partly paid and the only trace is a log line. This
 * page is the answer to "were last month's winners paid?" without a database
 * client.
 */
export default function SeasonsPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [data, setData] = useState<SeasonsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData((await api.getSeasonInsights(12)) as SeasonsResponse)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

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
        <h2 style={{ margin: 0 }}>Seasons &amp; Prizes</h2>
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
          style={{ padding: "1rem", color: "#f87171" }}
        >
          {err}
        </div>
      )}

      {loading && !data ? (
        <div
          className="glass-card"
          style={{ padding: "2rem", textAlign: "center" }}
        >
          Loading…
        </div>
      ) : data && data.seasons.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: "2rem", textAlign: "center" }}
        >
          No seasons yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {data?.seasons.map((s) => (
            <SeasonCard
              key={s.id}
              season={s}
              minQualifiers={data.minQualifiers}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SeasonCard({
  season: s,
  minQualifiers,
}: {
  season: SeasonRow
  minQualifiers: number
}) {
  const unpaid = s.paysOut ? s.podium.filter((p) => !p.paid).length : 0

  let verdict: { text: string; color: string }
  if (s.status === "active") {
    verdict = { text: "In progress", color: "hsl(var(--muted-foreground))" }
  } else if (!s.paysOut) {
    // By design, not a failure — say so, or it reads as a missed payout.
    verdict = {
      text: `No prizes — ${s.qualifiers} qualified, ${minQualifiers} needed`,
      color: "hsl(var(--muted-foreground))",
    }
  } else if (unpaid > 0) {
    verdict = { text: `${unpaid} prize(s) NOT credited`, color: "#f87171" }
  } else {
    verdict = { text: "All prizes credited", color: "#34d399" }
  }

  return (
    <div className="glass-card" style={{ padding: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: s.podium.length ? "0.75rem" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Trophy size={16} />
          <strong>{s.label}</strong>
          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {s.status}
          </span>
        </div>
        <span
          style={{ fontSize: "0.8rem", fontWeight: 600, color: verdict.color }}
        >
          {verdict.text}
        </span>
      </div>

      {s.podium.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Winner</th>
                <th>Win rate</th>
                <th>Volume</th>
                <th>Prize</th>
                <th>Credited</th>
              </tr>
            </thead>
            <tbody>
              {s.podium.map((p) => (
                <tr key={p.rank}>
                  <td>#{p.rank}</td>
                  <td title={p.userId}>{p.name ?? p.userId.slice(0, 8)}</td>
                  <td>{p.winRate}%</td>
                  <td>{nu(p.volume)}</td>
                  <td>{s.paysOut ? nu(p.prize) : "—"}</td>
                  <td>
                    {!s.paysOut ? (
                      "—"
                    ) : p.paid ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#34d399",
                        }}
                      >
                        <CheckCircle2 size={14} />
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString()
                          : "yes"}
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#f87171",
                        }}
                      >
                        <XCircle size={14} /> Not credited
                      </span>
                    )}
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
