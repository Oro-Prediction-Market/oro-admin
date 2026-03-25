import { useEffect, useRef, useState } from 'react'

interface WebSocketMessage {
  type: 'bet_placed' | 'market_updated' | 'pool_updated'
  data: any
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connect = () => {
      try {
        ws.current = new WebSocket(url)
        
        ws.current.onopen = () => {
          setIsConnected(true)
          console.log('WebSocket connected')
        }
        
        ws.current.onmessage = (event) => {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)
        }
        
        ws.current.onclose = () => {
          setIsConnected(false)
          console.log('WebSocket disconnected')
          // Reconnect after 3 seconds
          setTimeout(connect, 3000)
        }
        
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error)
        }
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error)
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [url])

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    }
  }

  return { isConnected, lastMessage, sendMessage }
}
