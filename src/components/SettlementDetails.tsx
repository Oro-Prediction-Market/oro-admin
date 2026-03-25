import React from 'react'
import { CheckCircle, AlertCircle, Clock, Users, DollarSign, Scale } from 'lucide-react'

interface SettlementDetailsProps {
  settlement: any
}

export const SettlementDetails: React.FC<SettlementDetailsProps> = ({ settlement }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const calculateBreakage = () => {
    const payoutPool = Number(settlement.payoutPool || 0)
    const totalPaidOut = Number(settlement.totalPaidOut || 0)
    
    // Breakage = payoutPool - totalPaidOut (rounded remainders)
    return payoutPool - totalPaidOut
  }

  const getSettlementType = () => {
    if (!settlement.outcome?.label) return 'Unknown'
    
    // Check for dead heat scenario (multiple winners)
    if (settlement.winningBets > 1 && settlement.totalBets > settlement.winningBets) {
      return 'Dead Heat'
    }
    
    // Check for void/refund scenario
    if (settlement.totalPaidOut === 0 && settlement.totalBets > 0) {
      return 'Void/Refund'
    }
    
    return 'Standard Settlement'
  }

  const settlementType = getSettlementType()
  const breakage = calculateBreakage()
  const minPayoutGuaranteed = settlementType === 'Standard Settlement' && 
    (settlement.winningBets / settlement.totalBets) > 0.85

  return (
    <div style={{ 
      padding: '1.5rem', 
      borderRadius: '0.5rem',
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))'
    }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <CheckCircle size={20} color="hsl(var(--primary))" />
        <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Settlement Details</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Market Information */}
        <div>
          <h4 style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
            Market Information
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontSize: '0.875rem' }}>
              <strong>{settlement.market?.title || 'Unknown Market'}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              Type: {settlementType}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              <Clock size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
              {settlement.settledAt ? new Date(settlement.settledAt).toLocaleString() : 'Unknown'}
            </div>
          </div>
        </div>

        {/* Outcome Information */}
        <div>
          <h4 style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
            Winning Outcome
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ 
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              background: 'hsl(var(--primary) / 0.1)',
              color: 'hsl(var(--primary))',
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              {settlement.outcome?.label || settlement.winningOutcomeId?.substring(0, 8) + '...' || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
              ID: {settlement.winningOutcomeId?.substring(0, 8)}...
            </div>
          </div>
        </div>

        {/* Betting Statistics */}
        <div>
          <h4 style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
            <Users size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
            Betting Statistics
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontSize: '0.875rem' }}>
              Total Bets: <strong>{settlement.totalBets}</strong>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Winning Bets: <strong>{settlement.winningBets}</strong>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Win Rate: <strong>{settlement.totalBets > 0 ? ((settlement.winningBets / settlement.totalBets) * 100).toFixed(1) : 0}%</strong>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div>
          <h4 style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
            <DollarSign size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
            Financial Breakdown
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontSize: '0.875rem' }}>
              Total Pool: <strong>{formatCurrency(settlement.totalPool)}</strong>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              House Amount: <strong>{formatCurrency(settlement.houseAmount)}</strong>
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              Total Paid: <strong>{formatCurrency(settlement.totalPaidOut)}</strong>
            </div>
            {breakage > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                Breakage: {formatCurrency(breakage)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Special Conditions */}
      {minPayoutGuaranteed && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          borderRadius: '0.375rem',
          background: 'hsl(var(--primary) / 0.1)',
          border: '1px solid hsl(var(--primary))',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <Scale size={14} style={{ marginTop: '0.125rem' }} />
          <div>
            <strong>Minimum Payout Guaranteed:</strong> One outcome held &gt;85% of pool. 
            Minimum payout of 1.05x was applied to winning bets.
          </div>
        </div>
      )}

      {settlementType === 'Dead Heat' && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          borderRadius: '0.375rem',
          background: 'hsl(var(--muted) / 0.3)',
          border: '1px solid hsl(var(--border))',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <AlertCircle size={14} style={{ marginTop: '0.125rem' }} />
          <div>
            <strong>Dead Heat Settlement:</strong> Multiple winning outcomes detected. 
            Pool was split equally among winners with guaranteed minimum payout of original stake.
          </div>
        </div>
      )}

      {settlementType === 'Void/Refund' && (
        <div style={{ 
          marginTop: '1rem', 
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
          <AlertCircle size={14} style={{ marginTop: '0.125rem' }} />
          <div>
            <strong>Void/Refund:</strong> All bets were refunded due to event cancellation, 
            ambiguous outcome, or pool below minimum threshold.
          </div>
        </div>
      )}

      {/* Oracle Information */}
      <div style={{ 
        marginTop: '1rem', 
        padding: '0.75rem', 
        borderRadius: '0.375rem',
        background: 'hsl(var(--muted) / 0.2)',
        fontSize: '0.75rem',
        border: '1px solid hsl(var(--border))'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>
            <strong>Oracle Model:</strong> Centralized authoritative source
          </span>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>
            <strong>Dispute Window:</strong> 24 hours
          </span>
        </div>
      </div>
    </div>
  )
}
