import { useEffect, useState, useCallback } from "react"
import { useWebSocket } from "./useWebSocket"

interface RealTimeUpdate {
  type: "bet_placed" | "pool_updated" | "market_closed" | "market_resolved"
  marketId: string
  data: Record<string, unknown>
  timestamp: number
}

interface MarketBase {
  id: string
  status: string
  totalPool?: unknown
  outcomes: { id: string; isWinner?: boolean; [key: string]: unknown }[]
  closesAt?: string
  resolvedAt?: string
  resolvedOutcomeId?: string
  [key: string]: unknown
}

export function useRealTimeUpdates<T extends MarketBase>(markets: T[]) {
  const [updatedMarkets, setUpdatedMarkets] = useState<T[]>(markets)
  const [lastUpdate, setLastUpdate] = useState<RealTimeUpdate | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected")

  // WebSocket URL — opt-in via env. There is no raw-WS server to talk to by
  // default (the backend's real-time layer is socket.io on the main port, which
  // a plain WebSocket can't speak), so we DON'T hardcode ws://localhost:3001 —
  // that just fails and reconnect-loops every 3s, spamming the console. Set
  // VITE_WS_URL to a real WS endpoint to enable live updates.
  const wsUrl = import.meta.env.VITE_WS_URL || ""
  const { isConnected, lastMessage } = useWebSocket(wsUrl)

  useEffect(() => {
    setConnectionStatus(isConnected ? "connected" : "disconnected")
  }, [isConnected])

  const processUpdate = useCallback((update: RealTimeUpdate) => {
    setLastUpdate(update)

    setUpdatedMarkets((prevMarkets) =>
      prevMarkets.map((market) => {
        if (market.id === update.marketId) {
          switch (update.type) {
            case "bet_placed":
              return {
                ...market,
                totalPool: update.data.newTotalPool,
                outcomes:
                  (update.data.updatedOutcomes as MarketBase["outcomes"]) ||
                  market.outcomes,
              } as T

            case "pool_updated":
              return {
                ...market,
                totalPool: update.data.totalPool,
                outcomes:
                  (update.data.outcomes as MarketBase["outcomes"]) ||
                  market.outcomes,
              } as T

            case "market_closed":
              return {
                ...market,
                status: "closed",
                closesAt: new Date().toISOString(),
              } as T

            case "market_resolved":
              return {
                ...market,
                status: "resolved",
                resolvedAt: update.data.resolvedAt as string,
                resolvedOutcomeId: update.data.winningOutcomeId as string,
                outcomes: market.outcomes.map((outcome) => ({
                  ...outcome,
                  isWinner: outcome.id === update.data.winningOutcomeId,
                })),
              } as T

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
          type: lastMessage.type as RealTimeUpdate["type"],
          marketId: lastMessage.data.marketId as string,
          data: lastMessage.data,
          timestamp: Date.now(),
        }
        processUpdate(update)
      } catch (error) {
        console.error("Error processing WebSocket message:", error)
      }
    }
  }, [lastMessage, processUpdate])

  // Initialize with provided markets
  useEffect(() => {
    setUpdatedMarkets(markets)
  }, [markets])

  const simulateUpdate = useCallback(
    (
      type: RealTimeUpdate["type"],
      marketId: string,
      data: Record<string, unknown>
    ) => {
      const update: RealTimeUpdate = {
        type,
        marketId,
        data,
        timestamp: Date.now(),
      }
      processUpdate(update)
    },
    [processUpdate]
  )

  return {
    markets: updatedMarkets,
    lastUpdate,
    connectionStatus,
    simulateUpdate, // For testing/demo purposes
  }
}
