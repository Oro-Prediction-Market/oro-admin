export interface FifaMatch {
  id: number
  competition: string
  date: string
  homeTeam: string
  awayTeam: string
  venue: string
  status: 'scheduled' | 'live' | 'completed'
  score?: {
    home: number
    away: number
  }
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
  private readonly BASE_URL = 'https://api.fifa.com/api/v1'

  async fetchWorldCupMatches(): Promise<FifaMatch[]> {
    try {
      // FIFA's public API endpoint for matches
      const response = await fetch(`${this.BASE_URL}/matches?competitionId=17`) // World Cup competition ID
      if (!response.ok) {
        throw new Error(`FIFA API error: ${response.status}`)
      }
      
      const data = await response.json()
      return this.transformFifaData(data.Results || [])
    } catch (error) {
      console.error('Error fetching FIFA data:', error)
      // Fallback to mock data if API fails
      return this.getMockWorldCupData()
    }
  }

  async generateMarketsFromMatches(matches: FifaMatch[]): Promise<FifaMarket[]> {
    const markets: FifaMarket[] = []

    matches.forEach(match => {
      // Generate different types of markets for each match
      const baseMarkets = [
        {
          id: `match-winner-${match.id}`,
          title: `${match.homeTeam} vs ${match.awayTeam} - Match Winner`,
          category: 'World Cup',
          source: 'FIFA Portal',
          volume: this.estimateVolume(match),
          outcomes: [match.homeTeam, 'Draw', match.awayTeam],
          matchData: match,
          closesAt: match.date
        },
        {
          id: `total-goals-${match.id}`,
          title: `${match.homeTeam} vs ${match.awayTeam} - Total Goals (Over/Under 2.5)`,
          category: 'World Cup',
          source: 'FIFA Portal',
          volume: this.estimateVolume(match, 0.7),
          outcomes: ['Over 2.5 Goals', 'Under 2.5 Goals'],
          matchData: match,
          closesAt: match.date
        },
        {
          id: `first-goal-scorer-${match.id}`,
          title: `${match.homeTeam} vs ${match.awayTeam} - First Goal Scorer`,
          category: 'World Cup',
          source: 'FIFA Portal',
          volume: this.estimateVolume(match, 0.5),
          outcomes: this.generatePlayerOutcomes(),
          matchData: match,
          closesAt: match.date
        }
      ]

      markets.push(...baseMarkets)
    })

    return markets.sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime())
  }

  private transformFifaData(apiData: any[]): FifaMatch[] {
    return apiData.map(match => ({
      id: match.Id,
      competition: match.CompetitionName || 'FIFA World Cup',
      date: match.Date || new Date().toISOString(),
      homeTeam: match.HomeTeam?.Name || 'Team A',
      awayTeam: match.AwayTeam?.Name || 'Team B',
      venue: match.Stadium?.Name || 'Stadium',
      status: this.mapStatus(match.MatchStatus),
      score: match.Score ? {
        home: match.Score.HomeTeam,
        away: match.Score.AwayTeam
      } : undefined
    }))
  }

  private mapStatus(apiStatus: number): 'scheduled' | 'live' | 'completed' {
    switch (apiStatus) {
      case 0: return 'scheduled'
      case 1:
      case 2:
      case 3: return 'live'
      case 4: return 'completed'
      default: return 'scheduled'
    }
  }

  private estimateVolume(match: FifaMatch, multiplier: number = 1): string {
    // Estimate volume based on match importance and timing
    const baseVolume = 1000000 // $1M base volume
    const timeMultiplier = this.getTimeMultiplier(match.date)
    const importanceMultiplier = this.getImportanceMultiplier()
    
    const estimatedVolume = baseVolume * timeMultiplier * importanceMultiplier * multiplier
    return `$${(estimatedVolume / 1000000).toFixed(1)}M`
  }

  private getTimeMultiplier(matchDate: string): number {
    const now = new Date().getTime()
    const matchTime = new Date(matchDate).getTime()
    const hoursUntilMatch = (matchTime - now) / (1000 * 60 * 60)
    
    if (hoursUntilMatch < 24) return 2.0 // Match within 24 hours
    if (hoursUntilMatch < 72) return 1.5 // Match within 3 days
    if (hoursUntilMatch < 168) return 1.2 // Match within 1 week
    return 1.0 // Standard multiplier
  }

  private getImportanceMultiplier(): number {
    return 1.5 // World Cup default multiplier
  }

  private generatePlayerOutcomes(): string[] {
    // Generate realistic player outcomes (would need real player data)
    const commonPlayers = [
      'No Goal',
      'First 10 Minutes',
      '11-30 Minutes', 
      '31-60 Minutes',
      '61+ Minutes'
    ]
    return commonPlayers
  }

  private getMockWorldCupData(): FifaMatch[] {
    // Fallback mock data for World Cup matches
    return [
      {
        id: 1,
        competition: 'FIFA World Cup',
        date: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
        homeTeam: 'Brazil',
        awayTeam: 'Argentina',
        venue: 'Lusail Stadium',
        status: 'scheduled'
      },
      {
        id: 2,
        competition: 'FIFA World Cup',
        date: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
        homeTeam: 'France',
        awayTeam: 'Germany',
        venue: 'Al Bayt Stadium',
        status: 'scheduled'
      },
      {
        id: 3,
        competition: 'FIFA World Cup',
        date: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
        homeTeam: 'England',
        awayTeam: 'Spain',
        venue: 'Education City Stadium',
        status: 'scheduled'
      }
    ]
  }

  async searchMarkets(query: string): Promise<FifaMarket[]> {
    const matches = await this.fetchWorldCupMatches()
    const allMarkets = await this.generateMarketsFromMatches(matches)
    
    if (!query) return allMarkets
    
    const lowercaseQuery = query.toLowerCase()
    return allMarkets.filter(market => 
      market.title.toLowerCase().includes(lowercaseQuery) ||
      market.category.toLowerCase().includes(lowercaseQuery) ||
      market.matchData.homeTeam.toLowerCase().includes(lowercaseQuery) ||
      market.matchData.awayTeam.toLowerCase().includes(lowercaseQuery)
    )
  }
}

export const fifaService = new FifaService()
