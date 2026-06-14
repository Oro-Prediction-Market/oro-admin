import React, { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

interface TrendPoint {
  week: string
  marketCount: number
  avgAccuracyPct: number
}

interface AccuracyData {
  overallAccuracyPct: number
  totalMarkets: number
  trend: TrendPoint[]
}

const W = 600
const H = 220
const PAD = { top: 16, right: 16, bottom: 40, left: 44 }

function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return null

  const xs = data.map((_, i) => i)
  const ys = data.map((d) => d.avgAccuracyPct)
  const minY = Math.max(0, Math.min(...ys) - 10)
  const maxY = Math.min(100, Math.max(...ys) + 10)

  const toX = (i: number) =>
    PAD.left + (i / Math.max(data.length - 1, 1)) * (W - PAD.left - PAD.right)

  const toY = (v: number) =>
    PAD.top + (1 - (v - minY) / (maxY - minY)) * (H - PAD.top - PAD.bottom)

  const points = xs.map((i) => `${toX(i)},${toY(ys[i])}`).join(" ")

  const gridLines = [0, 25, 50, 75, 100].filter((v) => v >= minY && v <= maxY)

  const labelEvery = Math.ceil(data.length / 6)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: W, display: "block" }}
    >
      {/* grid lines */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={toY(v)}
            y2={toY(v)}
            stroke="hsla(var(--border), 0.5)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={toY(v) + 4}
            textAnchor="end"
            fontSize={10}
            fill="hsl(var(--muted-foreground))"
          >
            {v}%
          </text>
        </g>
      ))}

      {/* area fill */}
      <polyline
        points={[
          `${toX(0)},${toY(minY)}`,
          points,
          `${toX(data.length - 1)},${toY(minY)}`,
        ].join(" ")}
        fill="hsla(160,100%,40%,0.08)"
        stroke="none"
      />

      {/* line */}
      <polyline
        points={points}
        fill="none"
        stroke="#4ade80"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* dots + tooltip via title */}
      {data.map((d, i) => (
        <g key={d.week}>
          <circle
            cx={toX(i)}
            cy={toY(d.avgAccuracyPct)}
            r={3.5}
            fill="#4ade80"
          />
          <title>
            {d.week} — {d.avgAccuracyPct}% ({d.marketCount} market
            {d.marketCount !== 1 ? "s" : ""})
          </title>
          <circle
            cx={toX(i)}
            cy={toY(d.avgAccuracyPct)}
            r={10}
            fill="transparent"
          />
          {i % labelEvery === 0 && (
            <text
              x={toX(i)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill="hsl(var(--muted-foreground))"
            >
              {d.week.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

const PlatformAccuracyPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [data, setData] = useState<AccuracyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getPlatformAccuracy()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accuracy = data?.overallAccuracyPct ?? 0
  const color =
    accuracy >= 60 ? "#4ade80" : accuracy >= 40 ? "#f59e0b" : "#ef4444"

  return (
    <div>
      <h2 style={{ marginBottom: "0.5rem" }}>Platform Accuracy</h2>
      <p
        style={{
          color: "hsl(var(--muted-foreground))",
          fontSize: "0.875rem",
          marginBottom: "2rem",
        }}
      >
        Percentage of total bet pool placed on the winning outcome, averaged
        across settled markets.
      </p>

      {loading && (
        <p style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</p>
      )}
      {error && <p style={{ color: "#ef4444" }}>Error: {error}</p>}

      {data && (
        <>
          <div className="stat-grid" style={{ marginBottom: "2rem" }}>
            <div className="glass-card stat-card">
              <h3>Overall Accuracy</h3>
              <p style={{ color }}>{accuracy.toFixed(1)}%</p>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                across {data.totalMarkets} settled market
                {data.totalMarkets !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="glass-card stat-card">
              <h3>Markets Analysed</h3>
              <p>{data.totalMarkets}</p>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                non-cancelled, non-thin-pool
              </span>
            </div>
            {data.trend.length > 0 && (
              <div className="glass-card stat-card">
                <h3>Latest Week</h3>
                <p style={{ color: "#60a5fa" }}>
                  {data.trend[data.trend.length - 1].avgAccuracyPct.toFixed(1)}%
                </p>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "hsl(var(--muted-foreground))",
                  }}
                >
                  {data.trend[data.trend.length - 1].week}
                </span>
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: "1.25rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
              Weekly Accuracy Trend
            </h3>
            {data.trend.length < 2 ? (
              <p
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontSize: "0.85rem",
                }}
              >
                Not enough data yet — need at least 2 weeks of settled markets.
              </p>
            ) : (
              <TrendChart data={data.trend} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default PlatformAccuracyPage
