import { useEffect, useMemo, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"

type Period = "all" | "week" | "month"
type Currency = "BTN" | "USDT"

interface Bucket {
  start: string
  label: string
  partial: boolean
  total: number
}

interface IncomeResponse {
  period: Period
  bucket: "week" | "month"
  currency: Currency
  buckets: Bucket[]
  totals: { total: number }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
]

const LINE = "hsl(var(--primary))"
const W = 720
const H = 200
const PAD = { top: 12, right: 12, bottom: 24, left: 46 }

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

/** A round top so the y-axis reads 0, 30k, 60k rather than 0, 27.4k, 54.8k. */
function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 0.5 }
  const raw = max / 3
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
 * The house's profit over time: house edge, forfeited dispute bonds and duel
 * fees combined, as one line. Rewards and credits paid out are not
 * subtracted. One currency at a time; BTN and USDT are never added.
 */
export default function HouseIncomeChart() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [period, setPeriod] = useState<Period>("all")
  const [currency, setCurrency] = useState<Currency>("BTN")
  const [data, setData] = useState<IncomeResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)

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
  const total = data?.totals.total ?? 0
  const { top, step } = niceMax(Math.max(0, ...buckets.map((b) => b.total)))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left +
    (buckets.length <= 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (Math.max(v, 0) / top) * plotH

  // The newest bucket is still filling, so its segment is dashed.
  const pts = buckets.map((b, i) => `${x(i)},${y(b.total)}`)
  const partial = buckets.length > 1 && buckets[buckets.length - 1].partial
  const solidPts = partial ? pts.slice(0, -1) : pts
  const solid = solidPts.length > 1 ? `M${solidPts.join("L")}` : ""
  const dashed = partial ? `M${pts[pts.length - 2]}L${pts[pts.length - 1]}` : ""

  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)

  const xTickIdx = (() => {
    const n = buckets.length
    if (n <= 8) return [...Array(n).keys()]
    const want = 5
    const idx = new Set<number>()
    for (let k = 0; k < want; k++)
      idx.add(Math.round((k * (n - 1)) / (want - 1)))
    return [...idx]
  })()

  const hovered = hover !== null ? buckets[hover] : null
  const unitWord = period === "week" ? "week" : "month"
  const rangeText =
    period === "all"
      ? "all time"
      : buckets.length <= 1
        ? `this ${unitWord}`
        : `last ${buckets.length} ${unitWord}s`

  const toggle = (active: boolean) => ({
    className: active ? "" : "secondary",
    style: { padding: "0.2rem 0.55rem", fontSize: "0.7rem" },
  })

  return (
    <div
      className="glass-card"
      style={{ padding: "0.9rem 1rem", marginBottom: "1.75rem" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Profit</h3>
          {data && (
            <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              {money(total, currency)}
            </span>
          )}
          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {rangeText}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                onClick={() => setPeriod(p.key)}
                {...toggle(period === p.key)}
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
                onClick={() => setCurrency(c)}
                {...toggle(currency === c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && (
        <div style={{ color: "#f87171", fontSize: "0.8rem", marginTop: 6 }}>
          {err}
        </div>
      )}

      {data && total === 0 && (
        <p
          style={{
            margin: "0.5rem 0 0",
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.8rem",
          }}
        >
          No {currency} profit in this range.
        </p>
      )}

      {data && buckets.length > 0 && total !== 0 && (
        <div style={{ position: "relative", marginTop: "0.5rem" }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`Profit by ${unit}, ${rangeText}`}
            style={{ display: "block", maxHeight: 230 }}
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
                  x={PAD.left - 6}
                  y={y(v) + 3}
                  textAnchor="end"
                  fontSize={10}
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
                y={H - 6}
                textAnchor="middle"
                fontSize={10}
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
                strokeWidth={0.75}
                strokeDasharray="3 3"
              />
            )}

            <path
              d={solid}
              fill="none"
              stroke={LINE}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {dashed && (
              <path
                d={dashed}
                fill="none"
                stroke={LINE}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                strokeLinecap="round"
              />
            )}

            {/* A single bucket has no line to draw, so it shows as a dot. */}
            {(buckets.length === 1 || hovered) && (
              <circle
                cx={x(hover ?? 0)}
                cy={y(buckets[hover ?? 0].total)}
                r={3}
                fill={LINE}
                stroke="hsl(var(--card))"
                strokeWidth={1.5}
              />
            )}

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
                transform: `translateX(${x(hover!) > W / 2 ? "calc(-100% - 10px)" : "10px"})`,
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                padding: "0.35rem 0.6rem",
                fontSize: "0.75rem",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ color: "hsl(var(--muted-foreground))" }}>
                {hovered.label}
                {hovered.partial ? " · so far" : ""}
              </div>
              <div style={{ fontWeight: 700 }}>
                {money(hovered.total, currency)}
              </div>
            </div>
          )}
        </div>
      )}

      <p
        style={{
          margin: "0.4rem 0 0",
          fontSize: "0.68rem",
          color: "hsl(var(--muted-foreground))",
        }}
      >
        House edge + dispute bonds + duel fees. Rewards paid out are not
        subtracted.
      </p>
    </div>
  )
}
