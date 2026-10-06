import { useEffect, useMemo, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

type Period = "all" | "week" | "month"
type Currency = "BTN" | "USDT"
type StreamKey = "edge" | "bonds" | "duels"

interface Bucket {
  start: string
  label: string
  partial: boolean
  edge: number
  bonds: number
  duels: number
  total: number
}

interface IncomeResponse {
  period: Period
  bucket: "week" | "month"
  currency: Currency
  buckets: Bucket[]
  totals: Record<StreamKey | "total", number>
}

// Categorical slots 1–3 (dark steps), validated all-pairs against the card
// surface. Total is not a category: it wears the foreground ink, heavier.
const STREAMS: { key: StreamKey; label: string; color: string }[] = [
  { key: "edge", label: "House edge", color: "#3987e5" },
  { key: "bonds", label: "Dispute bonds", color: "#d95926" },
  { key: "duels", label: "Duel fees", color: "#199e70" },
]
const TOTAL_COLOR = "hsl(var(--foreground))"

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
]

const W = 720
const H = 260
const PAD = { top: 16, right: 92, bottom: 30, left: 56 }

function money(n: number, currency: Currency) {
  const v = n.toLocaleString("en-US", {
    maximumFractionDigits: currency === "BTN" ? 2 : 6,
  })
  return currency === "BTN" ? `Nu ${v}` : `${v} USDT`
}

function compact(n: number) {
  return n.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
}

/** A round step so the y-axis reads 0, 20k, 40k… rather than 0, 18.3k… */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.25 }
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  return { top: step * Math.ceil(max / step), step }
}

/** "29 Sep" for weeks, "Sep 26" for months, from a YYYY-MM-DD start. */
function shortLabel(start: string, unit: "week" | "month") {
  const [y, m, d] = start.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return unit === "month"
    ? date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" })
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

/**
 * What the house earned over time: house edge, forfeited dispute bonds and
 * duel fees, with their total. Income only — rewards and credits paid out are
 * not subtracted. One currency at a time; BTN and USDT are never added.
 */
export default function HouseIncomeChart() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [period, setPeriod] = useState<Period>("all")
  const [currency, setCurrency] = useState<Currency>("BTN")
  const [data, setData] = useState<IncomeResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    let live = true
    api
      .getHouseIncome(period, currency)
      .then((d) => live && (setData(d as IncomeResponse), setErr(null)))
      .catch((e: Error) => live && setErr(e.message))
    return () => {
      live = false
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, period, currency])

  const buckets = useMemo(() => data?.buckets ?? [], [data])
  const unit = data?.bucket ?? "week"
  const { top, step } = niceMax(Math.max(0, ...buckets.map((b) => b.total)))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left +
    (buckets.length <= 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (Math.max(v, 0) / top) * plotH

  // Streams with nothing in range stay in the legend but draw no line: a flat
  // line on the baseline would only hide the axis.
  const drawn = STREAMS.filter((s) => (data?.totals[s.key] ?? 0) !== 0)
  // Total goes underneath: when one stream is nearly all of it, that line
  // rides on top of the total instead of vanishing under it.
  const series = [
    { key: "total" as const, label: "Total", color: TOTAL_COLOR, width: 4 },
    ...drawn.map((s) => ({ ...s, width: 2 })),
  ]

  // The newest bucket is still filling, so its segment is dashed.
  const paths = (key: StreamKey | "total") => {
    const pts = buckets.map((b, i) => `${x(i)},${y(b[key])}`)
    if (pts.length < 2) return { solid: "", dashed: "" }
    const partial = buckets[buckets.length - 1].partial
    const solidPts = partial ? pts.slice(0, -1) : pts
    return {
      solid: solidPts.length > 1 ? `M${solidPts.join("L")}` : "",
      dashed: partial ? `M${pts[pts.length - 2]}L${pts[pts.length - 1]}` : "",
    }
  }

  // Direct labels at the right edge, nudged apart so they never overlap.
  const endLabels = (() => {
    if (!buckets.length) return []
    const last = buckets[buckets.length - 1]
    const placed = series
      .map((s) => ({ ...s, y: y(last[s.key]) }))
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].y - placed[i - 1].y < 13) placed[i].y = placed[i - 1].y + 13
    }
    // Lines ending on zero would push labels below the axis; lift them back.
    const over = placed.length
      ? placed[placed.length - 1].y - (PAD.top + plotH)
      : 0
    if (over > 0) placed.forEach((l) => (l.y -= over))
    return placed
  })()

  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)

  const xTickIdx = (() => {
    const n = buckets.length
    if (n <= 1) return n ? [0] : []
    const want = Math.min(n, 6)
    const idx = new Set<number>()
    for (let k = 0; k < want; k++)
      idx.add(Math.round((k * (n - 1)) / (want - 1)))
    return [...idx]
  })()

  const hovered = hover !== null ? buckets[hover] : null
  const totals = data?.totals
  const unitWord = period === "week" ? "week" : "month"
  const rangeText =
    period === "all"
      ? "all time"
      : buckets.length <= 1
        ? `this ${unitWord}`
        : `last ${buckets.length} ${unitWord}s`

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
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>House Income</h3>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div
            role="tablist"
            aria-label="Period"
            style={{ display: "flex", gap: 4 }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={period === p.key}
                className={period === p.key ? "" : "secondary"}
                onClick={() => setPeriod(p.key)}
                style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div
            role="tablist"
            aria-label="Currency"
            style={{ display: "flex", gap: 4 }}
          >
            {(["BTN", "USDT"] as const).map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={currency === c}
                className={currency === c ? "" : "secondary"}
                onClick={() => setCurrency(c)}
                style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && (
        <div style={{ color: "#f87171", fontSize: "0.85rem" }}>{err}</div>
      )}

      {totals && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
            {money(totals.total, currency)}
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 400,
                color: "hsl(var(--muted-foreground))",
                marginLeft: 8,
              }}
            >
              {rangeText}
            </span>
          </div>
          {/* Legend, with each stream's share of the total. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem 1.25rem",
              marginTop: 6,
              fontSize: "0.82rem",
            }}
          >
            {STREAMS.map((s) => (
              <span
                key={s.key}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 3,
                    borderRadius: 2,
                    background: s.color,
                  }}
                />
                <span style={{ color: "hsl(var(--muted-foreground))" }}>
                  {s.label}
                </span>
                <span style={{ fontWeight: 600 }}>
                  {money(totals[s.key], currency)}
                </span>
              </span>
            ))}
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 4,
                  borderRadius: 2,
                  background: TOTAL_COLOR,
                }}
              />
              <span style={{ color: "hsl(var(--muted-foreground))" }}>
                Total
              </span>
            </span>
          </div>
        </div>
      )}

      {data && totals && totals.total === 0 && (
        <p
          style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.85rem" }}
        >
          No {currency} income in this range.
        </p>
      )}

      {data && buckets.length > 0 && totals && totals.total !== 0 && (
        <div style={{ position: "relative" }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`House income by ${unit}, ${rangeText}`}
            style={{ display: "block", overflow: "visible" }}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(v) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="hsl(var(--muted-foreground))"
                >
                  {compact(v)}
                </text>
              </g>
            ))}

            {xTickIdx.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {shortLabel(buckets[i].start, unit)}
              </text>
            ))}

            {hovered && (
              <line
                x1={x(hover!)}
                x2={x(hover!)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {series.map((s) => {
              const p = paths(s.key)
              return (
                <g key={s.key}>
                  <path
                    d={p.solid}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {p.dashed && (
                    <path
                      d={p.dashed}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.width}
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              )
            })}

            {/* A single bucket has no line to draw, so it shows as dots. */}
            {(buckets.length === 1 || hovered) &&
              series.map((s) => {
                const i = hover ?? 0
                return (
                  <circle
                    key={s.key}
                    cx={x(i)}
                    cy={y(buckets[i][s.key])}
                    r={4}
                    fill={s.color}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  />
                )
              })}

            {endLabels.map((l) => (
              <text
                key={l.key}
                x={W - PAD.right + 8}
                y={l.y + 4}
                fontSize={11}
                fontWeight={l.key === "total" ? 700 : 400}
                fill="hsl(var(--foreground))"
              >
                {l.label}
              </text>
            ))}

            {/* Hit targets: one full-height column per bucket. */}
            {buckets.map((b, i) => {
              const half =
                buckets.length <= 1
                  ? plotW / 2
                  : plotW / (buckets.length - 1) / 2
              return (
                <rect
                  key={b.start}
                  x={x(i) - half}
                  y={PAD.top}
                  width={half * 2}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              )
            })}
          </svg>

          {hovered && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${(x(hover!) / W) * 100}%`,
                transform: `translateX(${x(hover!) > W / 2 ? "calc(-100% - 12px)" : "12px"})`,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                padding: "0.5rem 0.75rem",
                fontSize: "0.8rem",
                pointerEvents: "none",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {hovered.label}
                {hovered.partial && (
                  <span
                    style={{
                      color: "hsl(var(--muted-foreground))",
                      fontWeight: 400,
                    }}
                  >
                    {" "}
                    · so far
                  </span>
                )}
              </div>
              {STREAMS.map((s) => (
                <div
                  key={s.key}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 3,
                      borderRadius: 2,
                      background: s.color,
                    }}
                  />
                  <span
                    style={{ color: "hsl(var(--muted-foreground))", flex: 1 }}
                  >
                    {s.label}
                  </span>
                  <span style={{ marginLeft: 12 }}>
                    {money(hovered[s.key], currency)}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid hsl(var(--border))",
                  marginTop: 4,
                  paddingTop: 4,
                  fontWeight: 700,
                }}
              >
                <span>Total</span>
                <span style={{ marginLeft: 12 }}>
                  {money(hovered.total, currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {data && buckets.length > 0 && totals && totals.total !== 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          <button
            className="secondary"
            onClick={() => setShowTable((v) => !v)}
            style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
          >
            {showTable ? "Hide table" : "Show as table"}
          </button>
          {showTable && (
            <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
              <table style={{ width: "100%", fontSize: "0.8rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>
                      {unit === "week" ? "Week" : "Month"}
                    </th>
                    {STREAMS.map((s) => (
                      <th key={s.key} style={{ textAlign: "right" }}>
                        {s.label}
                      </th>
                    ))}
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...buckets].reverse().map((b) => (
                    <tr key={b.start}>
                      <td>
                        {b.label}
                        {b.partial ? " (so far)" : ""}
                      </td>
                      {STREAMS.map((s) => (
                        <td key={s.key} style={{ textAlign: "right" }}>
                          {money(b[s.key], currency)}
                        </td>
                      ))}
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {money(b.total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p
        style={{
          margin: "0.75rem 0 0",
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
        }}
      >
        Income only: rewards, prizes and wallet credits paid out are not
        subtracted. Markets settled before dispute bonds were tracked separately
        count any forfeited bond inside house edge. Duel fees are BTN only.
      </p>
    </div>
  )
}
