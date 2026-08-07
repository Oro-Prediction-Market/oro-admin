import { useEffect, useRef, useState } from "react"

interface WebSocketMessage {
  type: "bet_placed" | "market_updated" | "pool_updated"
  data: Record<string, unknown>
}

export function useWebSocket(url: string) {
  const [connected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // No URL configured → real-time is disabled. Don't attempt a connection
    // (and don't start the 3s reconnect loop), so nothing spams the console.
    if (!url) {
      return
    }

    let destroyed = false

    const clearReconnect = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    const disconnect = () => {
      clearReconnect()
      if (ws.current) {
        // Remove listeners before closing to prevent reconnect loop
        ws.current.onclose = null
        ws.current.onerror = null
        ws.current.onopen = null
        ws.current.onmessage = null
        ws.current.close()
        ws.current = null
      }
      setIsConnected(false)
    }

    const connect = () => {
      if (destroyed) return
      try {
        ws.current = new WebSocket(url)

        ws.current.onopen = () => {
          if (!destroyed) setIsConnected(true)
        }

        ws.current.onmessage = (event) => {
          if (!destroyed) {
            const message: WebSocketMessage = JSON.parse(event.data)
            setLastMessage(message)
          }
        }

        ws.current.onclose = () => {
          if (!destroyed) {
            setIsConnected(false)
            // Reconnect after 3 seconds
            reconnectTimer.current = setTimeout(connect, 3000)
          }
        }

        ws.current.onerror = () => {
          if (!destroyed) {
            reconnectTimer.current = setTimeout(connect, 3000)
          }
        }
      } catch {
        if (!destroyed) {
          reconnectTimer.current = setTimeout(connect, 3000)
        }
      }
    }

    // Pause WebSocket when page enters bfcache (pagehide with persisted=true)
    // and resume when restored (pageshow with persisted=true).
    // This avoids blocking the back/forward cache.
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) {
        disconnect()
      }
    }
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !destroyed) {
        connect()
      }
    }

    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("pageshow", handlePageShow)

    connect()

    return () => {
      destroyed = true
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("pageshow", handlePageShow)
      disconnect()
    }
  }, [url])

  const sendMessage = (message: Record<string, unknown>) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    }
  }

  return { isConnected: Boolean(url) && connected, lastMessage, sendMessage }
}
