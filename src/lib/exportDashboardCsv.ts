// One-click CSV export of the Admin dashboard.
//
// Gathers the same six endpoints the dashboard widgets render and writes them
// into a single timestamped .csv with labelled sections — no backend change and
// no zip dependency. Each section is fetched independently: if one endpoint
// fails, its section records the error and the rest of the file still exports.

import { handleAdminAuth } from "./useAdminApi"

// Same derivation as useAdminApi / UserGrowth / BehavioralAnalytics: strip the
// trailing /admin the env var carries, then add the NestJS global /api prefix.
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + "/api"

type Cell = string | number | boolean | null | undefined

/**
 * Render a grid of rows as RFC-4180 CSV text. A cell is quoted only when it
 * contains a comma, quote, or newline; embedded quotes are doubled. null and
 * undefined become empty cells.
 */
export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Build a path-memoised JSON fetcher. Several sections read the same endpoint
 * (user-growth feeds three, behavioral feeds six), so caching the in-flight
 * promise per path collapses those to one request each.
 */
function makeFetcher(token: string) {
  const cache = new Map<string, Promise<unknown>>()
  return function getJson<T>(path: string): Promise<T> {
    let hit = cache.get(path)
    if (!hit) {
      hit = (async () => {
        const res = await fetch(`${API_BASE}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        handleAdminAuth(res) // expired session → login screen, not a silent failure
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })()
      cache.set(path, hit)
    }
    return hit as Promise<T>
  }
}

// ── Response shapes (mirrors of what each widget already consumes) ────────────

interface MarketStats {
  activeMarkets: number
  totalPoolVolume: number
  unsettledMarkets: number
  totalBettors: number
  activeBettors30d: number
}

interface Growth {
  totals: { allTime: number; today: number; last7: number; last30: number }
  newUsers: number
  signupsPerDay: { date: string; count: number }[]
  byProvider: { provider: string; count: number }[]
  referral: {
    viaReferral: number
    organic: number
    topReferrers: { userId: string; name: string; count: number }[]
  }
  activation: { acquired: number; placedBet: number }
}

interface Behavioral {
  eventBreakdown: { eventType: string; count: number }[]
  dau: { date: string; dau: number }[]
  topPages: { page: string; views: number }[]
  platformSplit: { platform: string; users: number }[]
  conversionFunnel: {
    opened: number
    viewed_market: number
    opened_bet_modal: number
  }
  categoryStats: {
    category: string
    bets: number
    bettors: number
    volume: number
  }[]
}

interface TierDist {
  distribution: { tier: string; label: string; count: number; ranked: number }[]
  total: number
  totalRanked: number
}

interface SignupsByPeriod {
  period: string
  total: number
  buckets: {
    start: string
    label: string
    partial: boolean
    signups: number
    byProvider: Record<string, number>
  }[]
}

interface HouseIncome {
  period: string
  bucket: string
  currency: string
  totals: { total: number }
  buckets: { start: string; label: string; partial: boolean; total: number }[]
}

// A section is a heading plus its grid; sections are joined by a blank line so
// Excel reads each labelled block as its own little table.
type Section = { heading: string; rows: Cell[][] }

function render(sections: Section[]): string {
  const blocks = sections.map(
    ({ heading, rows }) => `# ${heading}\r\n${toCsv(rows)}`
  )
  // Leading BOM so Excel opens UTF-8 (referrer names may be non-ASCII).
  return "﻿" + blocks.join("\r\n\r\n") + "\r\n"
}

/**
 * Fetch one section's data and map it to rows. On failure, return a one-line
 * section recording the error rather than aborting the whole export.
 */
async function section(
  heading: string,
  build: () => Promise<Cell[][]>
): Promise<Section> {
  try {
    return { heading, rows: await build() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { heading, rows: [["error", `could not load (${msg})`]] }
  }
}

/**
 * Gather every dashboard widget and download one CSV. Sections are fetched in
 * parallel and each fails independently. Returns the filename written.
 */
export async function exportDashboardCsv(
  token: string | null
): Promise<string> {
  if (!token) throw new Error("No admin token — please sign in again.")
  const getJson = makeFetcher(token)

  const sections = await Promise.all([
    section("KPIs", async () => {
      const s = await getJson<MarketStats>("/admin/markets/stats")
      return [
        ["metric", "value"],
        ["activeMarkets", s.activeMarkets],
        ["totalPoolVolume", s.totalPoolVolume],
        ["unsettledMarkets", s.unsettledMarkets],
        ["totalBettors", s.totalBettors],
        ["activeBettors30d", s.activeBettors30d],
      ]
    }),

    section("Signups per day (all time)", async () => {
      const g = await getJson<Growth>("/admin/user-growth?days=0")
      return [
        ["date", "count"],
        ...g.signupsPerDay.map((d) => [d.date, d.count] as Cell[]),
      ]
    }),

    section("User growth — by provider", async () => {
      const g = await getJson<Growth>("/admin/user-growth?days=0")
      return [
        ["provider", "count"],
        ...g.byProvider.map((p) => [p.provider, p.count] as Cell[]),
      ]
    }),

    section("User growth — top referrers", async () => {
      const g = await getJson<Growth>("/admin/user-growth?days=0")
      return [
        ["userId", "name", "count"],
        ...g.referral.topReferrers.map(
          (r) => [r.userId, r.name, r.count] as Cell[]
        ),
      ]
    }),

    section("Signups by period (weekly)", async () => {
      const s = await getJson<SignupsByPeriod>(
        "/admin/insights/signups?period=week&count=12"
      )
      // Union of provider keys across buckets → stable column order.
      const providers = Array.from(
        new Set(s.buckets.flatMap((b) => Object.keys(b.byProvider ?? {})))
      ).sort()
      return [
        ["period_start", "label", "partial", "signups", ...providers],
        ...s.buckets.map(
          (b) =>
            [
              b.start,
              b.label,
              b.partial,
              b.signups,
              ...providers.map((p) => b.byProvider?.[p] ?? 0),
            ] as Cell[]
        ),
      ]
    }),

    section("House income (BTN, all time)", async () => {
      const h = await getJson<HouseIncome>(
        "/admin/insights/income?period=all&currency=BTN"
      )
      return [
        ["period_start", "label", "partial", "total"],
        ...h.buckets.map(
          (b) => [b.start, b.label, b.partial, b.total] as Cell[]
        ),
      ]
    }),

    section("Reputation tier distribution", async () => {
      const t = await getJson<TierDist>("/admin/users/tier-distribution")
      return [
        ["tier", "label", "count", "ranked"],
        ...t.distribution.map(
          (r) => [r.tier, r.label, r.count, r.ranked] as Cell[]
        ),
      ]
    }),

    section("Behavioral — event breakdown", async () => {
      const b = await getJson<Behavioral>("/admin/behavioral-analytics")
      return [
        ["eventType", "count"],
        ...b.eventBreakdown.map((e) => [e.eventType, e.count] as Cell[]),
      ]
    }),

    section("Behavioral — daily active users", async () => {
      const b = await getJson<Behavioral>("/admin/behavioral-analytics")
      return [["date", "dau"], ...b.dau.map((d) => [d.date, d.dau] as Cell[])]
    }),

    section("Behavioral — top pages", async () => {
      const b = await getJson<Behavioral>("/admin/behavioral-analytics")
      return [
        ["page", "views"],
        ...b.topPages.map((p) => [p.page, p.views] as Cell[]),
      ]
    }),

    section("Behavioral — platform split", async () => {
      const b = await getJson<Behavioral>("/admin/behavioral-analytics")
      return [
        ["platform", "users"],
        ...b.platformSplit.map((p) => [p.platform, p.users] as Cell[]),
      ]
    }),

    section("Behavioral — conversion funnel", async () => {
      const b = await getJson<Behavioral>("/admin/behavioral-analytics")
      const f = b.conversionFunnel
      return [
        ["step", "count"],
        ["opened", f.opened],
        ["viewed_market", f.viewed_market],
        ["opened_bet_modal", f.opened_bet_modal],
      ]
    }),

    section("Behavioral — category stats", async () => {
      const b = await getJson<Behavioral>("/admin/behavioral-analytics")
      return [
        ["category", "bets", "bettors", "volume"],
        ...b.categoryStats.map(
          (c) => [c.category, c.bets, c.bettors, c.volume] as Cell[]
        ),
      ]
    }),
  ])

  const csv = render(sections)
  const filename = `oro-dashboard-${localDateStamp()}.csv`
  downloadCsv(csv, filename)
  return filename
}

// Local calendar date (not UTC), so the filename matches the admin's own day.
function localDateStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
