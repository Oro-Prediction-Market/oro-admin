import { useEffect, useState, useMemo, useRef } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import {
  Shield,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Plus,
  ArrowRight,
  Scale,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Banknote,
  UserCheck,
  Eye,
  HelpCircle,
  Activity,
  Clock,
  User,
  Globe,
  type LucideIcon,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditPayload {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  meta?: Record<string, unknown>
}

interface AuditLog {
  id: string
  adminId: string
  adminUsername: string | null
  action: string
  entityType: string | null
  entityId: string | null
  payload: AuditPayload | null
  ipAddress: string | null
  createdAt: string
}

// ─── Action config ────────────────────────────────────────────────────────────

// Priority: high = destructive/irreversible, medium = financial/role changes, low = reads/updates
type Priority = "high" | "medium" | "low"

interface ActionConfig {
  icon: LucideIcon
  priority: Priority
  label: string
  category: string
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  "market.create": {
    icon: Plus,
    priority: "low",
    label: "Market Created",
    category: "Market",
  },
  "market.transition": {
    icon: ArrowRight,
    priority: "low",
    label: "Status Changed",
    category: "Market",
  },
  "market.propose": {
    icon: Scale,
    priority: "medium",
    label: "Resolution Proposed",
    category: "Market",
  },
  "market.resolve": {
    icon: CheckCircle2,
    priority: "medium",
    label: "Market Resolved",
    category: "Market",
  },
  "market.cancel": {
    icon: XCircle,
    priority: "high",
    label: "Market Cancelled",
    category: "Market",
  },
  "market.delete": {
    icon: Trash2,
    priority: "high",
    label: "Market Deleted",
    category: "Market",
  },
  "market.update": {
    icon: Pencil,
    priority: "low",
    label: "Market Updated",
    category: "Market",
  },
  "balance.credit": {
    icon: Banknote,
    priority: "medium",
    label: "Balance Credited",
    category: "Finance",
  },
  "payment.view": {
    icon: Eye,
    priority: "low",
    label: "Payment Viewed",
    category: "Finance",
  },
  "user.admin_toggle": {
    icon: UserCheck,
    priority: "high",
    label: "Admin Toggled",
    category: "User",
  },
  "user.view": {
    icon: Eye,
    priority: "low",
    label: "User Viewed",
    category: "User",
  },
}

function getConfig(action: string): ActionConfig {
  return (
    ACTION_CONFIG[action] ?? {
      icon: HelpCircle,
      priority: "low" as Priority,
      label: action,
      category: "Other",
    }
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title="Copy"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "1px 4px",
        borderRadius: 4,
        color: "hsl(var(--muted-foreground))",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

// ─── JSON Diff ────────────────────────────────────────────────────────────────

function JsonDiff({
  before,
  after,
}: {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}) {
  if (!before && !after) return null
  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {keys.map((k) => {
        const bVal = before?.[k]
        const aVal = after?.[k]
        const changed = JSON.stringify(bVal) !== JSON.stringify(aVal)
        const added = bVal === undefined && aVal !== undefined
        return (
          <div
            key={k}
            style={{
              display: "grid",
              gridTemplateColumns: "130px 1fr",
              gap: 8,
              alignItems: "start",
              fontSize: "0.78rem",
            }}
          >
            <span
              style={{
                color: "hsl(var(--muted-foreground))",
                fontFamily: "monospace",
                paddingTop: 2,
                wordBreak: "break-all",
              }}
            >
              {k}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {!added && bVal !== undefined && (
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    color: changed
                      ? "hsl(var(--muted-foreground))"
                      : "hsl(var(--foreground))",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    textDecoration: changed ? "line-through" : "none",
                    opacity: changed ? 0.5 : 1,
                    wordBreak: "break-all",
                    boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
                  }}
                >
                  {JSON.stringify(bVal)}
                </span>
              )}
              {(changed || added) && aVal !== undefined && (
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "hsl(var(--foreground))",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    boxShadow: "var(--glass-shadow)",
                  }}
                >
                  {JSON.stringify(aVal)}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ log, isNew }: { log: AuditLog; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = getConfig(log.action)
  // Priority dot opacity: high → fully opaque, medium → mid, low → subtle
  const dotOpacity =
    cfg.priority === "high" ? 0.9 : cfg.priority === "medium" ? 0.55 : 0.3
  const hasDiff = !!(log.payload?.before || log.payload?.after)
  const hasMeta = !!(log.payload?.meta && Object.keys(log.payload.meta).length)
  const hasDetail = hasDiff || hasMeta || !!log.entityId
  const ActionIcon = cfg.icon

  const title =
    String(
      log.payload?.meta?.title ??
        log.payload?.after?.title ??
        log.payload?.before?.title ??
        (log.entityId
          ? `${log.entityType ?? "entity"} ${log.entityId.slice(0, 8)}…`
          : "")
    ) || cfg.label

  return (
    <div
      className="glass-card"
      style={{
        padding: 0,
        overflow: "hidden",
        animation: isNew ? "fadeSlideIn 0.35s ease" : "none",
        cursor: hasDetail ? "pointer" : "default",
      }}
      onClick={() => hasDetail && setExpanded((e) => !e)}
    >
      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0.8rem 1rem",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            flexShrink: 0,
            background: "hsl(var(--background))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <ActionIcon size={15} color="hsl(var(--muted-foreground))" />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Priority dot — opacity conveys severity without color */}
            <span
              title={cfg.priority}
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "hsl(var(--foreground))",
                opacity: dotOpacity,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.69rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 5,
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
                letterSpacing: "0.05em",
                textTransform: "uppercase" as const,
                whiteSpace: "nowrap" as const,
                boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
              }}
            >
              {cfg.label}
            </span>
            {title && title !== cfg.label && (
              <span
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap" as const,
                  maxWidth: 320,
                }}
              >
                {title}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 4,
              flexWrap: "wrap" as const,
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.73rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <User size={11} />{" "}
              {log.adminUsername ?? log.adminId.slice(0, 8) + "…"}
            </span>
            {log.ipAddress && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.73rem",
                  color: "hsl(var(--muted-foreground))",
                  fontFamily: "monospace",
                }}
              >
                <Globe size={11} /> {log.ipAddress}
              </span>
            )}
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.73rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              <Clock size={11} />
              <span title={new Date(log.createdAt).toLocaleString()}>
                {relativeTime(log.createdAt)}
              </span>
              <span style={{ opacity: 0.45 }}>
                ·{" "}
                {new Date(log.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          </div>
        </div>

        {/* Right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "0.67rem",
              color: "hsl(var(--muted-foreground))",
              padding: "2px 6px",
              borderRadius: 4,
              boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
              background: "hsl(var(--background))",
            }}
          >
            {cfg.category}
          </span>
          {hasDetail &&
            (expanded ? (
              <ChevronUp size={14} color="hsl(var(--muted-foreground))" />
            ) : (
              <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
            ))}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "1rem",
            display: "flex",
            gap: 28,
            flexWrap: "wrap" as const,
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          {hasDiff && (
            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.09em",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: 10,
                  opacity: 0.7,
                }}
              >
                Changes
              </div>
              <JsonDiff
                before={log.payload?.before}
                after={log.payload?.after}
              />
            </div>
          )}
          {hasMeta && (
            <div style={{ flex: "1 1 180px", minWidth: 160 }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.09em",
                  color: "hsl(var(--muted-foreground))",
                  marginBottom: 10,
                  opacity: 0.7,
                }}
              >
                Context
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {Object.entries(log.payload!.meta!).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr",
                      gap: 8,
                      fontSize: "0.78rem",
                    }}
                  >
                    <span
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        fontFamily: "monospace",
                      }}
                    >
                      {k}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: "hsl(var(--foreground))",
                        wordBreak: "break-all" as const,
                      }}
                    >
                      {JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ minWidth: 170 }}>
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.09em",
                color: "hsl(var(--muted-foreground))",
                marginBottom: 10,
                opacity: 0.7,
              }}
            >
              Identifiers
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: "0.74rem",
                fontFamily: "monospace",
              }}
            >
              {[
                { label: "log", value: log.id },
                { label: "admin", value: log.adminId },
                ...(log.entityId
                  ? [{ label: log.entityType ?? "entity", value: log.entityId }]
                  : []),
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <span
                    style={{
                      color: "hsl(var(--muted-foreground))",
                      minWidth: 48,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ opacity: 0.65 }}>{value.slice(0, 16)}…</span>
                  <CopyButton value={value} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Date group separator ─────────────────────────────────────────────────────

function DateSeparator({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0.75rem 0 0.4rem",
      }}
    >
      <div
        style={{ flex: 1, height: 1, background: "rgba(255, 255, 255, 0.15)" }}
      />
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: "hsl(var(--muted-foreground))",
          padding: "3px 10px",
          borderRadius: 6,
          boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
          background: "hsl(var(--background))",
          whiteSpace: "nowrap" as const,
        }}
      >
        {label} · {count}
      </span>
      <div
        style={{ flex: 1, height: 1, background: "rgba(255, 255, 255, 0.15)" }}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_BATCH = 50

export function AuditLogPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(200)
  const [serverTotal, setServerTotal] = useState(0)
  const [loadTick, setLoadTick] = useState(0)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const prevIdsRef = useRef<Set<string>>(new Set())

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState("all")
  const [filterAdmin, setFilterAdmin] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getAuditLogs({ limit })
      .then((res) => {
        if (cancelled) return
        // Backend returns { data: AuditLog[], total, pages } — unwrap it
        const raw = res as { data?: AuditLog[]; total?: number } | AuditLog[]
        const incoming: AuditLog[] = Array.isArray(raw) ? raw : (raw.data ?? [])
        const total = Array.isArray(raw)
          ? incoming.length
          : (raw.total ?? incoming.length)
        const fresh = new Set(
          incoming.filter((l) => !prevIdsRef.current.has(l.id)).map((l) => l.id)
        )
        prevIdsRef.current = new Set(incoming.map((l) => l.id))
        setLogs(incoming)
        setServerTotal(total)
        setNewIds(fresh)
        setTimeout(() => setNewIds(new Set()), 2000)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, loadTick])

  const allActions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs]
  )
  const allAdmins = useMemo(
    () =>
      Array.from(new Set(logs.map((l) => l.adminUsername ?? l.adminId))).sort(),
    [logs]
  )
  const allCategories = useMemo(
    () =>
      Array.from(new Set(logs.map((l) => getConfig(l.action).category))).sort(),
    [logs]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return logs.filter((l) => {
      if (filterAction !== "all" && l.action !== filterAction) return false
      if (
        filterAdmin !== "all" &&
        (l.adminUsername ?? l.adminId) !== filterAdmin
      )
        return false
      if (
        filterCategory !== "all" &&
        getConfig(l.action).category !== filterCategory
      )
        return false
      if (
        filterSeverity !== "all" &&
        getConfig(l.action).priority !== filterSeverity
      )
        return false
      if (dateFrom && new Date(l.createdAt) < new Date(dateFrom)) return false
      if (dateTo && new Date(l.createdAt) > new Date(dateTo + "T23:59:59"))
        return false
      if (q) {
        const hay = [
          l.action,
          l.adminUsername ?? "",
          l.adminId,
          l.entityId ?? "",
          l.ipAddress ?? "",
          JSON.stringify(l.payload ?? {}),
        ]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [
    logs,
    search,
    filterAction,
    filterAdmin,
    filterCategory,
    filterSeverity,
    dateFrom,
    dateTo,
  ])

  useEffect(() => {
    setVisibleCount(PAGE_BATCH)
  }, [
    search,
    filterAction,
    filterAdmin,
    filterCategory,
    filterSeverity,
    dateFrom,
    dateTo,
  ])

  const grouped = useMemo(() => {
    const visible = filtered.slice(0, visibleCount)
    const groups: { label: string; logs: AuditLog[] }[] = []
    let cur = ""
    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(now.getDate() - 1)
    for (const log of visible) {
      const d = new Date(log.createdAt)
      const label =
        d.toDateString() === now.toDateString()
          ? "Today"
          : d.toDateString() === yesterday.toDateString()
            ? "Yesterday"
            : d.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
      if (label !== cur) {
        groups.push({ label, logs: [] })
        cur = label
      }
      groups[groups.length - 1].logs.push(log)
    }
    return groups
  }, [filtered, visibleCount])

  const stats = useMemo(
    () => ({
      total: filtered.length,
      last24h: filtered.filter(
        (l) => new Date(l.createdAt).getTime() > Date.now() - 86_400_000
      ).length,
      high: filtered.filter((l) => getConfig(l.action).priority === "high")
        .length,
      medium: filtered.filter((l) => getConfig(l.action).priority === "medium")
        .length,
    }),
    [filtered]
  )

  const hasFilters = !!(
    search ||
    filterAction !== "all" ||
    filterAdmin !== "all" ||
    filterCategory !== "all" ||
    filterSeverity !== "all" ||
    dateFrom ||
    dateTo
  )

  const inp: React.CSSProperties = {
    background: "hsl(var(--background))",
    border: "none",
    borderRadius: 8,
    padding: "6px 10px",
    color: "hsl(var(--foreground))",
    fontSize: "0.82rem",
    boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
    outline: "none",
    fontFamily: "inherit",
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "hsl(var(--background))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <Shield size={18} color="hsl(var(--muted-foreground))" />
            </div>
            <h2 style={{ margin: 0 }}>Audit Log</h2>
          </div>
          <p
            style={{
              margin: 0,
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.875rem",
            }}
          >
            Tamper-evident trail · who did what, when, and from where
          </p>
        </div>
        <button
          onClick={() => setLoadTick((t) => t + 1)}
          disabled={loading}
          className="secondary"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: loading ? "spin 0.8s linear infinite" : "none",
            }}
          />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        {(
          [
            {
              label: "Filtered Events",
              value: stats.total,
              Icon: Activity,
            },
            {
              label: "Last 24 hours",
              value: stats.last24h,
              Icon: Clock,
            },
            {
              label: "High Priority",
              value: stats.high,
              Icon: XCircle,
            },
            {
              label: "Medium Priority",
              value: stats.medium,
              Icon: Scale,
            },
          ] as const
        ).map((s) => (
          <div
            key={s.label}
            className="glass-card"
            style={{
              padding: "0.875rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "hsl(var(--background))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <s.Icon size={15} color="hsl(var(--muted-foreground))" />
            </div>
            <div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: "hsl(var(--foreground))",
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 2,
                }}
              >
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div
        className="glass-card"
        style={{ padding: "0.875rem 1rem", marginBottom: "1.25rem" }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap" as const,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div
            style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}
          >
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "hsl(var(--muted-foreground))",
                pointerEvents: "none",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, admin, entity, IP, payload…"
              style={{ ...inp, width: "100%", paddingLeft: 28 }}
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={inp}
          >
            <option value="all">All actions</option>
            {allActions.map((a) => (
              <option key={a} value={a}>
                {getConfig(a).label}
              </option>
            ))}
          </select>
          <select
            value={filterAdmin}
            onChange={(e) => setFilterAdmin(e.target.value)}
            style={inp}
          >
            <option value="all">All admins</option>
            {allAdmins.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={inp}
          >
            <option value="all">All categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={inp}
          >
            <option value="all">All priorities</option>
            <option value="high">● High</option>
            <option value="medium">● Medium</option>
            <option value="low">● Low</option>
          </select>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap" as const,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inp, colorScheme: "dark" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: "0.78rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ ...inp, colorScheme: "dark" }}
            />
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {filtered.length} of {logs.length} events
          </span>
          {hasFilters && (
            <button
              className="secondary"
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              onClick={() => {
                setSearch("")
                setFilterAction("all")
                setFilterAdmin("all")
                setFilterCategory("all")
                setFilterSeverity("all")
                setDateFrom("")
                setDateTo("")
              }}
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Timeline feed */}
      {loading && logs.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading audit trail…
        </div>
      ) : error ? (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
            opacity: 0.8,
          }}
        >
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {hasFilters
            ? "No events match your filters."
            : "No audit entries found."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {grouped.map((group) => (
            <div key={group.label}>
              <DateSeparator label={group.label} count={group.logs.length} />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                  marginBottom: "0.25rem",
                }}
              >
                {group.logs.map((log) => (
                  <EventCard
                    key={log.id}
                    log={log}
                    isNew={newIds.has(log.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {(visibleCount < filtered.length || logs.length < serverTotal) && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginTop: "1.5rem",
                flexWrap: "wrap" as const,
              }}
            >
              {visibleCount < filtered.length && (
                <button
                  className="secondary"
                  style={{ fontSize: "0.82rem", padding: "8px 20px" }}
                  onClick={() => setVisibleCount((n) => n + PAGE_BATCH)}
                >
                  Show more ({filtered.length - visibleCount} remaining)
                </button>
              )}
              {logs.length < serverTotal && (
                <button
                  className="secondary"
                  style={{ fontSize: "0.82rem", padding: "8px 20px" }}
                  onClick={() => setLimit((l) => l + 200)}
                  disabled={loading}
                >
                  {loading
                    ? "Loading…"
                    : `Load more from server (${logs.length} of ${serverTotal})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default AuditLogPage
