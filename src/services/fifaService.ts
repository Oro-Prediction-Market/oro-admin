// VITE_API_BASE_URL is e.g. "http://localhost:3000/admin"
// Strip the /admin suffix, then add the NestJS global /api prefix.
// Final base: "http://localhost:3000/api"
const BACKEND_URL =
  (
    (import.meta.env.VITE_API_BASE_URL as string) ??
    "http://localhost:3000/admin"
  ).replace(/\/admin$/, "") + "/api"

export interface FifaMatch {
  id: number
  competition: string
  date: string
  homeTeam: string
  awayTeam: string
  venue: string
  status: "scheduled" | "live" | "completed"
  score?: { home: number; away: number }
}

export interface FifaMarket {
  id: string
  title: string
  category: string
  source: string
  volume: string
  outcomes: string[]
  matchData: FifaMatch
  closesAt: string
}

class FifaService {
  private getAuthHeader(): Record<string, string> {
    const token = sessionStorage.getItem("admin_token") ?? ""
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async searchMarkets(query: string): Promise<FifaMarket[]> {
    const params = query ? `?q=${encodeURIComponent(query)}` : ""
    const res = await fetch(`${BACKEND_URL}/admin/fixtures${params}`, {
      headers: this.getAuthHeader(),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Failed to fetch fixtures: ${res.status} ${body}`)
    }

    const data: Omit<FifaMarket, "volume">[] = await res.json()

    // Add estimated volume display (purely cosmetic)
    return data.map((m) => ({ ...m, volume: this.estimateVolume(m.closesAt) }))
  }

  private estimateVolume(closesAt: string): string {
    const hoursUntil = (new Date(closesAt).getTime() - Date.now()) / 3_600_000
    const multiplier = hoursUntil < 24 ? 2.0 : hoursUntil < 72 ? 1.5 : 1.0
    return `$${((1_000_000 * multiplier) / 1_000_000).toFixed(1)}M`
  }
}

export const fifaService = new FifaService()
