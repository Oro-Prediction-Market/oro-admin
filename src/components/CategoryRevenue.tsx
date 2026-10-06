import { Fragment, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Layers } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface Figures {
  settled: number
  refunded: number
  pool: number
  refundedPool: number
  edge: number
  bonds: number
  paidOut: number
  liveMarkets: number
  livePool: number
  edgePct: number | null
}

interface Category extends Figures {
  category: string
  subcategories: (Figures & { subcategory: string })[]
}

interface Response {
  currency: "BTN" | "USDT"
  totals: Figures
  categories: Category[]
}

type Preset = "this-month" | "last-month" | "30d" | "all" | "custom"

/** YYYY-MM-DD for a date in Bhutan, the calendar the backend filters on. */
const bhutanDay = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Thimphu" })

function presetRange(p: Preset): { from?: string; to?: string } {
  const today = bhutanDay(new Date())
  const [y, m] = today.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  if (p === "this-month") return { from: `${y}-${pad(m)}-01`, to: today }
  if (p === "last-month") {
    const ly = m === 1 ? y - 1 : y
    const lm = m === 1 ? 12 : m - 1
    const last = new Date(Date.UTC(ly, lm, 0)).getUTCDate()
    return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(last)}` }
  }
  if (p === "30d")
    return {
      from: bhutanDay(new Date(Date.now() - 29 * 86_400_000)),
      to: today,
    }
  return {}
}

const label = (s: string) => (s === "(none)" ? "No subcategory" : s)

/**
 * Pool money and house edge per category and subcategory.
 *
 * Settled figures are dated by settlement, the same basis as the Revenue page
 * and the weekly report. "House edge" is pool money only; forfeited dispute
 * bonds sit in their own column so the edge % reads as the edge actually
 * applied. "Live pool" is what is staked right now on unsettled markets and
 * ignores the date range.
 */
export default function CategoryRevenue() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [preset, setPreset] = useState<Preset>("this-month")
  const [custom, setCustom] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  })
  const [currency, setCurrency] = useState<"BTN" | "USDT">("BTN")
  const [data, setData] = useState<Response | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const range = useMemo(
    () =>
      preset === "custom"
        ? { from: custom.from || undefined, to: custom.to || undefined }
        : presetRange(preset),
    [preset, custom]
  )

  useEffect(() => {
    let live = true
    api
      .getCategoryRevenue({ ...range, currency })
      .then((d) => live && (setData(d as Response), setErr(null)))
      .catch((e: Error) => live && setErr(e.message))
    return () => {
      live = false
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, range.from, range.to, currency])

  const money = (n: number) =>
    `${currency === "BTN" ? "Nu " : ""}${n.toLocaleString("en-US", { maximumFractionDigits: currency === "BTN" ? 2 : 6 })}${currency === "USDT" ? " USDT" : ""}`
  const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}%`)

  const toggle = (c: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  const cells = (f: Figures) => (
    <>
      <td style={num}>{f.settled.toLocaleString()}</td>
      <td style={num}>{money(f.pool)}</td>
      <td style={{ ...num, fontWeight: 700 }}>{money(f.edge)}</td>
      <td style={num}>{pct(f.edgePct)}</td>
      <td
        style={{
          ...num,
          color: f.bonds ? undefined : "hsl(var(--muted-foreground))",
        }}
      >
        {f.bonds ? money(f.bonds) : "—"}
      </td>
      <td style={num}>{money(f.paidOut)}</td>
      <td style={num} title={`${f.refunded} refunded market(s)`}>
        {f.refundedPool ? money(f.refundedPool) : "—"}
      </td>
      <td style={num} title={`${f.liveMarkets} unsettled market(s)`}>
        {f.livePool ? money(f.livePool) : "—"}
      </td>
    </>
  )

  return (
    <div className="glass-card" style={{ padding: "1rem", marginTop: "2rem" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <h3
          style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <Layers size={18} /> Pool &amp; house edge by category
        </h3>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          <select
            className="input-field"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            style={{ width: "auto" }}
          >
            <option value="this-month">This month</option>
            <option value="last-month">Last month</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom…</option>
          </select>
          {preset === "custom" && (
            <>
              <input
                type="date"
                className="input-field"
                value={custom.from}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, from: e.target.value }))
                }
                style={{ width: "auto" }}
              />
              <input
                type="date"
                className="input-field"
                value={custom.to}
                onChange={(e) =>
                  setCustom((c) => ({ ...c, to: e.target.value }))
                }
                style={{ width: "auto" }}
              />
            </>
          )}
          <select
            className="input-field"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "BTN" | "USDT")}
            style={{ width: "auto" }}
          >
            <option value="BTN">BTN</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
      </div>

      {err && (
        <div style={{ color: "#f87171", fontSize: "0.85rem" }}>{err}</div>
      )}

      {data && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style={num}>Settled</th>
                <th style={num}>Pool</th>
                <th style={num}>House edge</th>
                <th style={num}>Edge %</th>
                <th
                  style={num}
                  title="Forfeited dispute bonds — not pool money"
                >
                  Bonds
                </th>
                <th style={num}>Paid out</th>
                <th
                  style={num}
                  title="Pools refunded because the market was cancelled"
                >
                  Refunded
                </th>
                <th
                  style={num}
                  title="Staked right now on unsettled markets (ignores the date range)"
                >
                  Live pool
                </th>
              </tr>
            </thead>
            <tbody>
              {data.categories.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Nothing settled in this period.
                  </td>
                </tr>
              )}
              {data.categories.map((c) => {
                const isOpen = open.has(c.category)
                const Chevron = isOpen ? ChevronDown : ChevronRight
                return (
                  <Fragment key={c.category}>
                    <tr
                      onClick={() => toggle(c.category)}
                      style={{ cursor: "pointer" }}
                    >
                      <td
                        style={{
                          fontWeight: 700,
                          textTransform: "capitalize",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Chevron
                          size={14}
                          style={{ verticalAlign: "middle", marginRight: 4 }}
                        />
                        {c.category}
                      </td>
                      {cells(c)}
                    </tr>
                    {isOpen &&
                      c.subcategories.map((s) => (
                        <tr
                          key={`${c.category}/${s.subcategory}`}
                          style={{ fontSize: "0.85rem" }}
                        >
                          <td
                            style={{
                              paddingLeft: "2rem",
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            {label(s.subcategory)}
                          </td>
                          {cells(s)}
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
              {data.categories.length > 0 && (
                <tr
                  style={{
                    borderTop: "2px solid hsl(var(--border))",
                    fontWeight: 700,
                  }}
                >
                  <td>Total</td>
                  {cells(data.totals)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p
        style={{
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
          margin: "0.75rem 0 0",
        }}
      >
        Dated by settlement, on the Bhutan calendar. House edge is pool money
        only; forfeited dispute bonds are listed separately. Settlements booked
        before bonds were tracked separately count any bond inside house edge,
        so an older period can show an edge % slightly above the configured
        rate.
      </p>
    </div>
  )
}

const num: React.CSSProperties = {
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
}
