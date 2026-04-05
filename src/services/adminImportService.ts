import type { FifaMarket } from "./fifaService"

export interface ImportRequest {
  title: string
  description?: string
  outcomes: string[]
  opensAt?: string
  closesAt: string
  houseEdgePct?: number
  mechanism?: "parimutuel" | "scpm"
  liquidityParam?: number
  imageUrl?: string
  externalData?: {
    source: string
    matchId: number
    venue: string
    competition: string
  }
}

interface ImportResult {
  success: boolean
  message: string
  market?: unknown
  error?: string
}

class AdminImportService {
  private readonly API_BASE =
    (
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin"
    ).replace(/\/admin$/, "") + "/api"

  async importFifaMarket(fifaMarket: FifaMarket): Promise<ImportResult> {
    const token = sessionStorage.getItem("admin_token")
    if (!token) {
      throw new Error("Admin authentication required")
    }

    const importData: ImportRequest = {
      title: fifaMarket.title,
      description: `Auto-imported from ${fifaMarket.source}. Match: ${fifaMarket.matchData.homeTeam} vs ${fifaMarket.matchData.awayTeam} at ${fifaMarket.matchData.venue}`,
      outcomes: fifaMarket.outcomes,
      opensAt: new Date().toISOString(), // Open immediately
      closesAt: fifaMarket.closesAt,
      houseEdgePct: 5, // Default 5% house edge
      mechanism: "parimutuel", // Default mechanism
      liquidityParam: 1000, // Default liquidity parameter
      externalData: {
        source: fifaMarket.source,
        matchId: fifaMarket.matchData.id,
        venue: fifaMarket.matchData.venue,
        competition: fifaMarket.matchData.competition,
      },
    }

    try {
      const response = await fetch(`${this.API_BASE}/admin/markets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(importData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `Import failed: ${response.status}`
        )
      }

      const result = await response.json()
      return {
        success: true,
        market: result,
        message: `Successfully imported "${fifaMarket.title}"`,
      }
    } catch (error: unknown) {
      console.error("Import error:", error)
      const msg = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        error: msg,
        message: `Failed to import "${fifaMarket.title}": ${msg}`,
      }
    }
  }

  async batchImportFifaMarkets(
    fifaMarkets: FifaMarket[]
  ): Promise<ImportResult[]> {
    const results: ImportResult[] = []

    for (const market of fifaMarkets) {
      try {
        const result = await this.importFifaMarket(market)
        results.push(result)

        // Add small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        results.push({
          success: false,
          market: market.title,
          error: msg,
          message: `Failed to import "${market.title}": ${msg}`,
        })
      }
    }

    return results
  }

  validateFifaMarket(fifaMarket: FifaMarket): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!fifaMarket.title || fifaMarket.title.trim().length === 0) {
      errors.push("Market title is required")
    }

    if (!fifaMarket.outcomes || fifaMarket.outcomes.length < 2) {
      errors.push("At least 2 outcomes are required")
    }

    if (!fifaMarket.closesAt || new Date(fifaMarket.closesAt) <= new Date()) {
      errors.push("Close time must be in the future")
    }

    if (!fifaMarket.matchData.homeTeam || !fifaMarket.matchData.awayTeam) {
      errors.push("Both home and away teams are required")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  async checkForDuplicates(fifaMarket: FifaMarket): Promise<boolean> {
    const token = sessionStorage.getItem("admin_token")
    if (!token) return false

    try {
      const response = await fetch(`${this.API_BASE}/admin/markets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) return false

      const existingMarkets = (await response.json()) as { title: string }[]

      // Check for similar titles (same match)
      const similarMarket = existingMarkets.find(
        (market: { title: string }) =>
          market.title
            .toLowerCase()
            .includes(fifaMarket.matchData.homeTeam.toLowerCase()) &&
          market.title
            .toLowerCase()
            .includes(fifaMarket.matchData.awayTeam.toLowerCase())
      )

      return !!similarMarket
    } catch (error) {
      console.error("Error checking duplicates:", error)
      return false
    }
  }
}

export const adminImportService = new AdminImportService()
