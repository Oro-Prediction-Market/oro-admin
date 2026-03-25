import { useEffect, useState, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

interface RealTimeUpdate {
  type: 'bet_placed' | 'pool_updated' | 'market_closed' | 'market_resolved'
  marketId: string
  data: any
  timestamp: number
}

export function useRealTimeUpdates(markets: any[]) {
  const [updatedMarkets, setUpdatedMarkets] = useState<any[]>(markets)
  const [lastUpdate, setLastUpdate] = useState<RealTimeUpdate | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  // WebSocket URL - should be configurable via environment
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
  const { isConnected, lastMessage } = useWebSocket(wsUrl)

  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected')
  }, [isConnected])

  const processUpdate = useCallback((update: RealTimeUpdate) => {
    setLastUpdate(update)
    
    setUpdatedMarkets(prevMarkets => 
      prevMarkets.map(market => {
        if (market.id === update.marketId) {
          switch (update.type) {
            case 'bet_placed':
              return {
                ...market,
                totalPool: update.data.newTotalPool,
                outcomes: update.data.updatedOutcomes || market.outcomes
              }
            
            case 'pool_updated':
              return {
                ...market,
                totalPool: update.data.totalPool,
                outcomes: update.data.outcomes || market.outcomes
              }
            
            case 'market_closed':
              return {
                ...market,
                status: 'closed',
                closesAt: new Date().toISOString()
              }
            
            case 'market_resolved':
              return {
                ...market,
                status: 'resolved',
                resolvedAt: update.data.resolvedAt,
                resolvedOutcomeId: update.data.winningOutcomeId,
                outcomes: market.outcomes.map((outcome: any) => ({
                  ...outcome,
                  isWinner: outcome.id === update.data.winningOutcomeId
                }))
              }
            
            default:
              return market
          }
        }
        return market
      })
    )
  }, [])

  useEffect(() => {
    if (lastMessage) {
      try {
        const update: RealTimeUpdate = {
          ...lastMessage.data,
          timestamp: Date.now()
        }
        processUpdate(update)
      } catch (error) {
        console.error('Error processing WebSocket message:', error)
      }
    }
  }, [lastMessage, processUpdate])

  // Initialize with provided markets
  useEffect(() => {
    setUpdatedMarkets(markets)
  }, [markets])

  const simulateUpdate = useCallback((type: RealTimeUpdate['type'], marketId: string, data: any) => {
    const update: RealTimeUpdate = {
      type,
      marketId,
      data,
      timestamp: Date.now()
    }
    processUpdate(update)
  }, [processUpdate])

  return {
    markets: updatedMarkets,
    lastUpdate,
    connectionStatus,
    simulateUpdate // For testing/demo purposes
  }
}
