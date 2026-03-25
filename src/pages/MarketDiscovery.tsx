import React, { useState, useEffect } from "react"
import { Search, Globe, Plus, Zap, Calendar, MapPin, Clock, AlertCircle } from "lucide-react"
import { fifaService, type FifaMarket } from "../services/fifaService"
import { adminImportService } from "../services/adminImportService"

const MarketDiscovery: React.FC = () => {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [markets, setMarkets] = useState<FifaMarket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<Set<string>>(new Set())
  const [importResults, setImportResults] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    fetchFifaMarkets()
  }, [])

  const fetchFifaMarkets = async () => {
    setLoading(true)
    setError(null)
    try {
      const fifaMarkets = await fifaService.searchMarkets(query)
      setMarkets(fifaMarkets)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching FIFA markets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDiscover = async () => {
    await fetchFifaMarkets()
  }

  const handleImport = async (market: FifaMarket) => {
    // Check if already importing
    if (importing.has(market.id)) return
    
    // Validate market first
    const validation = adminImportService.validateFifaMarket(market)
    if (!validation.valid) {
      alert(`Validation failed:\n${validation.errors.join('\n')}`)
      return
    }

    // Check for duplicates
    const isDuplicate = await adminImportService.checkForDuplicates(market)
    if (isDuplicate) {
      alert('A similar market already exists in your system.')
      return
    }

    // Start import
    setImporting(prev => new Set(prev).add(market.id))
    
    try {
      const result = await adminImportService.importFifaMarket(market)
      setImportResults(prev => new Map(prev).set(market.id, result))
      
      if (result.success) {
        alert(`✅ ${result.message}`)
      } else {
        alert(`❌ ${result.message}`)
      }
    } catch (err: any) {
      const errorResult = {
        success: false,
        message: `Import failed: ${err.message}`
      }
      setImportResults(prev => new Map(prev).set(market.id, errorResult))
      alert(`❌ ${errorResult.message}`)
    } finally {
      setImporting(prev => {
        const newSet = new Set(prev)
        newSet.delete(market.id)
        return newSet
      })
    }
  }

  return (
    <div className="market-discovery">
      <div style={{ marginBottom: "2rem" }}>
        <h2>Market Discovery</h2>
        <p style={{ color: "hsl(var(--muted-foreground))" }}>
          Discover real FIFA World Cup betting opportunities from official FIFA data.
        </p>
      </div>

      <div className="glass-card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "hsl(var(--muted-foreground))" }} />
            <input 
              type="text" 
              placeholder="Search FIFA World Cup markets, teams, or matches..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleDiscover()}
              style={{
                width: "100%",
                padding: "12px 12px 12px 40px",
                borderRadius: "12px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--secondary))",
                color: "inherit"
              }}
            />
          </div>
          <button 
            onClick={handleDiscover}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 1.5rem" }}
          >
            {loading ? "Fetching..." : <><Zap size={18} /> Discover</>}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ 
          marginBottom: "2rem", 
          padding: "1rem", 
          borderRadius: "8px",
          background: "hsl(var(--destructive) / 0.1)",
          border: "1px solid hsl(var(--destructive))",
          color: "hsl(var(--destructive))"
        }}>
          Error: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "hsl(var(--muted-foreground))" }}>
          <div style={{ marginBottom: "1rem" }}>Fetching FIFA World Cup data...</div>
          <div style={{ fontSize: "0.875rem" }}>Connecting to official FIFA portal</div>
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "hsl(var(--muted-foreground))" }}>
          <Globe size={48} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
          <h3>No Markets Found</h3>
          <p>Try adjusting your search or check back later for new FIFA World Cup opportunities.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.5rem" }}>
          {markets.map((market: FifaMarket) => (
            <div key={market.id} className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="badge" style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))", fontSize: "0.7rem" }}>
                  {market.category}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
                  <Globe size={12} /> {market.source}
                </div>
              </div>
              
              <h3 style={{ margin: 0, fontSize: "1.1rem", lineHeight: "1.4" }}>{market.title}</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "hsl(var(--muted-foreground))" }}>
                  <Calendar size={14} />
                  Closes: {new Date(market.closesAt).toLocaleDateString()} {new Date(market.closesAt).toLocaleTimeString()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "hsl(var(--muted-foreground))" }}>
                  <MapPin size={14} />
                  {market.matchData.venue}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "hsl(var(--muted-foreground))" }}>
                  <Clock size={14} />
                  Status: {market.matchData.status}
                </div>
              </div>

              <div style={{ padding: "0.75rem", background: "hsl(var(--muted) / 0.3)", borderRadius: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Outcomes:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                  {market.outcomes.map((outcome, idx) => (
                    <span 
                      key={idx}
                      style={{ 
                        padding: "0.25rem 0.5rem", 
                        borderRadius: "0.25rem",
                        background: "hsl(var(--primary) / 0.1)",
                        color: "hsl(var(--primary))",
                        fontSize: "0.75rem"
                      }}
                    >
                      {outcome}
                    </span>
                  ))}
                </div>
              </div>
              
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.875rem" }}>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>Est. Volume:</span> {market.volume}
                </div>
                <button 
                  onClick={() => handleImport(market)}
                  className="secondary" 
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <Plus size={14} /> Import
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MarketDiscovery
