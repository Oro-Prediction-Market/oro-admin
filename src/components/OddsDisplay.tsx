import React from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'

interface OddsDisplayProps {
  outcomes: any[]
  totalPool: number
  houseEdgePct: number
  isEstimated?: boolean
  showWarnings?: boolean
}

export const OddsDisplay: React.FC<OddsDisplayProps> = ({ 
  outcomes, 
  totalPool, 
  houseEdgePct, 
  isEstimated = false,
  showWarnings = true 
}) => {
  const calculateOdds = (outcomePool: number) => {
    if (outcomePool === 0 || totalPool === 0) return 0
    const payoutPool = totalPool * (1 - houseEdgePct / 100)
    return payoutPool / outcomePool
  }

  const calculateImpliedProbability = (outcomePool: number) => {
    if (totalPool === 0) return 0
    return (outcomePool / totalPool) * 100
  }

  const getMinusPoolWarning = () => {
    const maxPoolShare = Math.max(...outcomes.map(o => Number(o.totalBetAmount || 0)))
    const maxPercentage = (maxPoolShare / totalPool) * 100
    
    if (maxPercentage > 85) {
      return {
        warning: true,
        message: `⚠️ Minus pool detected: One outcome holds ${maxPercentage.toFixed(1)}% of pool. Guaranteed minimum payout of 1.05x will apply.`,
        minPayout: 1.05
      }
    }
    return { warning: false, message: '', minPayout: 0 }
  }

  const minusPoolWarning = getMinusPoolWarning()

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <TrendingUp size={16} />
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {isEstimated ? 'Estimated' : 'Current'} Odds & Payouts
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {outcomes.map((outcome) => {
          const odds = calculateOdds(Number(outcome.totalBetAmount || 0))
          const probability = calculateImpliedProbability(Number(outcome.totalBetAmount || 0))
          const finalOdds = minusPoolWarning.warning && outcome.isWinner ? 
            Math.max(odds, minusPoolWarning.minPayout) : odds
          
          return (
            <div 
              key={outcome.id} 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: outcome.isWinner ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--muted) / 0.3)',
                border: outcome.isWinner ? '1px solid hsl(var(--primary))' : '1px solid transparent'
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                  {outcome.label}
                  {outcome.isWinner && ' ✓'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  {probability.toFixed(2)}% of pool
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 500 }}>
                  {finalOdds.toFixed(2)}x
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  ${((outcome.totalBetAmount || 0) * finalOdds).toFixed(2)} payout
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showWarnings && minusPoolWarning.warning && (
        <div style={{ 
          marginTop: '0.75rem', 
          padding: '0.75rem', 
          borderRadius: '0.375rem',
          background: 'hsl(var(--destructive) / 0.1)',
          border: '1px solid hsl(var(--destructive))',
          color: 'hsl(var(--destructive))',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={14} style={{ marginTop: '0.125rem' }} />
          <span>{minusPoolWarning.message}</span>
        </div>
      )}

      {isEstimated && (
        <div style={{ 
          marginTop: '0.5rem', 
          fontSize: '0.75rem', 
          color: 'hsl(var(--muted-foreground))',
          fontStyle: 'italic'
        }}>
          * Odds update in real-time as pool grows. Final payouts determined at settlement.
        </div>
      )}
    </div>
  )
}
