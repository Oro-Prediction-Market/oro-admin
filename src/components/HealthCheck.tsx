import React, { useEffect, useState } from "react"
import {
  Activity,
  Database,
  Zap,
  Cpu,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { pollWhileVisible } from "../lib/poll"

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  uptime: number
  database: {
    status: "connected" | "disconnected"
    responseTime?: number
  }
  redis: {
    status: "connected" | "disconnected"
    responseTime?: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  apiResponseTime: number
}

const HealthCheck: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setError(null)
        const data = await api.getHealthCheck()
        setHealth(data as HealthStatus)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
    return pollWhileVisible(fetchHealth, 30000) // Refresh every 30 seconds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount and set up interval

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
        return <CheckCircle size={18} color="#4CAF50" />
      case "degraded":
        return <AlertCircle size={18} color="#FF9800" />
      case "unhealthy":
      case "disconnected":
        return <XCircle size={18} color="#f44336" />
      default:
        return <Activity size={18} color="hsl(var(--muted-foreground))" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "connected":
        return "#4CAF50"
      case "degraded":
        return "#FF9800"
      case "unhealthy":
      case "disconnected":
        return "#f44336"
      default:
        return "hsl(var(--muted-foreground))"
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (loading) {
    return (
      <div className="glass-card" style={{ marginTop: "2rem" }}>
        <h3
          style={{
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Activity size={20} />
          System Health
        </h3>
        <p
          style={{
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.875rem",
          }}
        >
          Loading health status...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card" style={{ marginTop: "2rem" }}>
        <h3
          style={{
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Activity size={20} />
          System Health
        </h3>
        <p style={{ color: "hsl(var(--destructive))", fontSize: "0.875rem" }}>
          Failed to fetch health status: {error}
        </p>
      </div>
    )
  }

  if (!health) return null

  return (
    <div className="glass-card" style={{ marginTop: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Activity size={20} />
          System Health
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {getStatusIcon(health.status)}
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: getStatusColor(health.status),
              textTransform: "uppercase",
            }}
          >
            {health.status}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Database Status */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <Database
              size={16}
              color={getStatusColor(health.database.status)}
            />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Database
            </span>
          </div>
          <div
            style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}
          >
            <span
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: getStatusColor(health.database.status),
              }}
            >
              {health.database.status}
            </span>
            {health.database.responseTime && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {health.database.responseTime}ms
              </span>
            )}
          </div>
        </div>

        {/* Redis Status */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <Zap size={16} color={getStatusColor(health.redis.status)} />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Redis
            </span>
          </div>
          <div
            style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}
          >
            <span
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: getStatusColor(health.redis.status),
              }}
            >
              {health.redis.status}
            </span>
            {health.redis.responseTime && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {health.redis.responseTime}ms
              </span>
            )}
          </div>
        </div>

        {/* Memory Usage */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <Cpu
              size={16}
              color={
                health.memory.percentage > 95
                  ? "#f44336"
                  : health.memory.percentage > 85
                    ? "#FF9800"
                    : "#4CAF50"
              }
            />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Memory (Heap)
            </span>
          </div>
          <div
            style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}
          >
            <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {health.memory.percentage}%
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {health.memory.used}MB RSS
            </span>
          </div>
          {health.memory.percentage > 90 && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "#FF9800",
                marginTop: "0.25rem",
              }}
            >
              High heap usage (normal for V8)
            </div>
          )}
        </div>

        {/* Uptime */}
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <Activity size={16} color="#4CAF50" />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Uptime
            </span>
          </div>
          <div
            style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}
          >
            <span style={{ fontSize: "1.25rem", fontWeight: 700 }}>
              {formatUptime(health.uptime)}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {health.apiResponseTime}ms API
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
          textAlign: "right",
        }}
      >
        Last updated: {new Date(health.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}

export default HealthCheck
