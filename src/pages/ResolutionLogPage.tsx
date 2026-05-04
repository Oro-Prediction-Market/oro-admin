import React, { useEffect, useState } from "react"
import {
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Bot,
  Shield,
  UserX,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface ResolutionEntry {
  id: string
  title: string
  description?: string
  category?: string
  status: string
  totalPool: number
  participantCount: number
  opensAt?: string
  closesAt?: string
  resolvedAt?: string
  windowHours?: number
  proposedOutcome?: { id: string; label: string } | null
  winner?: { id: string; label: string } | null
  outcomeChanged: boolean
  objectionCount: number
  uppheldObjectionCount: number
  resolutionCriteria?: string | null
  evidence: {
    url: string | null
    note: string | null
    submittedAt: string | null
  }
  resolvedBySystem: boolean
}

const CATEGORY_COLORS: Record<string, string> = {
  sports: "hsl(210 80% 60%)",
  gaming: "hsl(280 70% 65%)",
  weather: "hsl(190 80% 55%)",
  entertainment: "hsl(330 70% 65%)",
  economy: "hsl(45 80% 55%)",
  other: "hsl(var(--muted-foreground))",
}

interface AdminAccuracyEntry {
  name: string
  totalResolutions: number
  correctResolutions: number
  wrongResolutions: number
  accuracyPct: number | null
  overturnPct: number | null
  flagged: boolean
}

const PAGE_SIZE = 10

const ResolutionLogPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [entries, setEntries] = useState<ResolutionEntry[]>([])
  const [adminAccuracy, setAdminAccuracy] = useState<AdminAccuracyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
    Promise.all([
      api.getResolutionLog(),
      fetch(`${BASE}/markets/admin-accuracy`).then((r) => r.json()),
    ])
      .then(([log, accuracy]) => {
        setEntries((log as ResolutionEntry[]) ?? [])
        setAdminAccuracy((accuracy as AdminAccuracyEntry[]) ?? [])
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error ? e.message : "Failed to load resolution log"
        )
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = [
    "all",
    ...Array.from(new Set(entries.map((e) => e.category ?? "other"))),
  ]
  const filtered =
    filterCategory === "all"
      ? entries
      : entries.filter((e) => (e.category ?? "other") === filterCategory)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stats
  const totalMarkets = entries.length
  const autoSettled = entries.filter((e) => e.resolvedBySystem).length
  const withObjections = entries.filter((e) => e.objectionCount > 0).length
  const outcomeChanged = entries.filter((e) => e.outcomeChanged).length
  const withEvidence = entries.filter((e) => !!e.evidence.url).length

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "0.25rem" }}>Resolution Log</h2>
        <p
          style={{
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
          }}
        >
          Every market decision made on this platform — with public evidence,
          objection counts, and whether the outcome was changed after review.
          Full transparency.
        </p>

        {/* Trust stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            {
              label: "Total Resolved",
              value: totalMarkets,
              color: "hsl(var(--primary))",
            },
            {
              label: "Auto-Settled",
              value: autoSettled,
              color: "hsl(160 60% 50%)",
              sub: "no objections",
            },
            {
              label: "Had Objections",
              value: withObjections,
              color: "hsl(35 90% 55%)",
            },
            {
              label: "Outcome Changed",
              value: outcomeChanged,
              color: "hsl(280 70% 65%)",
              sub: "after review",
            },
            {
              label: "Evidence Published",
              value: withEvidence,
              icon: "",
              color: "hsl(210 80% 60%)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass-card"
              style={{ padding: "1rem", textAlign: "center" }}
            >
              <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>
                {stat.icon}
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: stat.color,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "hsl(var(--muted-foreground))",
                  lineHeight: 1.3,
                }}
              >
                {stat.label}
                {stat.sub && (
                  <>
                    <br />
                    <span style={{ opacity: 0.7 }}>{stat.sub}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Admin Accountability Scoreboard */}
        {adminAccuracy.length > 0 && (
          <div
            className="glass-card"
            style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <UserX
                size={16}
                style={{ color: "hsl(var(--muted-foreground))" }}
              />
              <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>
                Admin Accountability
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                — how often each admin's resolution was overturned by objectors
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {adminAccuracy.map((a) => (
                <div
                  key={a.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius)",
                    background: a.flagged
                      ? "hsl(0 80% 50% / 0.08)"
                      : "hsl(var(--muted) / 0.15)",
                    border: a.flagged
                      ? "1px solid hsl(0 80% 50% / 0.3)"
                      : "1px solid transparent",
                  }}
                >
                  {a.flagged ? (
                    <AlertTriangle
                      size={14}
                      style={{ color: "hsl(0 80% 55%)", flexShrink: 0 }}
                    />
                  ) : (
                    <CheckCircle
                      size={14}
                      style={{ color: "hsl(160 60% 50%)", flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{ fontWeight: 600, fontSize: "0.82rem", flex: 1 }}
                  >
                    {a.name}
                  </span>
                  {/* Accuracy bar */}
                  <div
                    style={{
                      flex: 2,
                      height: 6,
                      borderRadius: 9999,
                      background: "hsl(var(--muted) / 0.3)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${a.accuracyPct ?? 0}%`,
                        borderRadius: 9999,
                        background: a.flagged
                          ? "hsl(0 80% 50%)"
                          : "hsl(160 60% 50%)",
                        transition: "width 0.4s",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: a.flagged ? "hsl(0 80% 55%)" : "hsl(160 60% 50%)",
                      minWidth: 40,
                      textAlign: "right",
                    }}
                  >
                    {a.accuracyPct ?? "—"}%
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      color: "hsl(var(--muted-foreground))",
                      minWidth: 80,
                      textAlign: "right",
                    }}
                  >
                    {a.correctResolutions}/{a.totalResolutions} correct
                  </span>
                  {a.flagged && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "hsl(0 80% 55%)",
                        background: "hsl(0 80% 50% / 0.12)",
                        padding: "0.15rem 0.4rem",
                        borderRadius: 4,
                      }}
                    >
                      ⚠ {a.overturnPct}% overturned
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category filter */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setFilterCategory(cat)
                setPage(1)
              }}
              className={filterCategory === cat ? "" : "secondary"}
              style={{
                fontSize: "0.72rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "9999px",
                textTransform: "capitalize",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Loading resolution log…
        </div>
      )}
      {error && (
        <div
          style={{
            padding: "1rem",
            background: "hsl(var(--destructive) / 0.1)",
            borderRadius: "var(--radius)",
            color: "hsl(var(--destructive))",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          No resolved markets yet.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {paginated.map((entry) => {
          const isExpanded = expanded === entry.id
          const catColor =
            CATEGORY_COLORS[entry.category ?? "other"] ?? CATEGORY_COLORS.other
          const hasEvidence = !!entry.evidence.url

          return (
            <div
              key={entry.id}
              className="glass-card"
              style={{
                padding: "1.25rem",
                cursor: "pointer",
                border: entry.outcomeChanged
                  ? "1px solid hsl(280 70% 65% / 0.4)"
                  : undefined,
              }}
              onClick={() => setExpanded(isExpanded ? null : entry.id)}
            >
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Category + title */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.4rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: catColor,
                        background: `${catColor}22`,
                        padding: "0.15rem 0.45rem",
                        borderRadius: 99,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {entry.category ?? "other"}
                    </span>
                    {entry.resolvedBySystem && (
                      <span
                        title="Auto-settled by system — zero objections, no admin needed"
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          color: "hsl(160 60% 50%)",
                          background: "hsl(160 60% 50% / 0.12)",
                          padding: "0.15rem 0.45rem",
                          borderRadius: 99,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <Bot size={10} /> Auto-settled
                      </span>
                    )}
                    {entry.outcomeChanged && (
                      <span
                        title="Admin changed outcome after reviewing objections"
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          color: "hsl(280 70% 65%)",
                          background: "hsl(280 70% 65% / 0.12)",
                          padding: "0.15rem 0.45rem",
                          borderRadius: 99,
                        }}
                      >
                        🔄 Outcome revised
                      </span>
                    )}
                    {!hasEvidence && !entry.resolvedBySystem && (
                      <span
                        title="No evidence provided"
                        style={{
                          fontSize: "0.68rem",
                          color: "hsl(var(--destructive))",
                          background: "hsl(var(--destructive) / 0.1)",
                          padding: "0.15rem 0.45rem",
                          borderRadius: 99,
                        }}
                      >
                        ⚠️ No evidence
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: "hsl(var(--foreground))",
                      marginBottom: "0.4rem",
                    }}
                  >
                    {entry.title}
                  </div>

                  {/* Winner */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {entry.winner && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontSize: "0.82rem",
                        }}
                      >
                        <CheckCircle
                          size={13}
                          style={{ color: "hsl(var(--primary))" }}
                        />
                        <span
                          style={{
                            fontWeight: 600,
                            color: "hsl(var(--primary))",
                          }}
                        >
                          {entry.winner.label}
                        </span>
                        {entry.proposedOutcome && entry.outcomeChanged && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            (was proposed: {entry.proposedOutcome.label})
                          </span>
                        )}
                      </div>
                    )}
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      Nu {Number(entry.totalPool).toLocaleString()} pool ·{" "}
                      {entry.participantCount} players
                    </span>
                    {entry.objectionCount > 0 && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.72rem",
                          color: "hsl(35 90% 55%)",
                        }}
                      >
                        <AlertTriangle size={11} /> {entry.objectionCount}{" "}
                        objection{entry.objectionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right column: date + evidence badge */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {entry.resolvedAt && (
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "hsl(var(--muted-foreground))",
                        marginBottom: "0.4rem",
                      }}
                    >
                      {new Date(entry.resolvedAt).toLocaleDateString(
                        undefined,
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </div>
                  )}
                  {hasEvidence ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.72rem",
                        color: "hsl(210 80% 60%)",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Shield size={11} /> Evidence attached
                    </div>
                  ) : null}
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "hsl(var(--muted-foreground))",
                      marginTop: "0.4rem",
                      opacity: 0.6,
                    }}
                  >
                    {isExpanded ? "▲ collapse" : "▼ details"}
                  </div>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "1.25rem",
                    borderTop: "1px solid hsl(var(--border))",
                    paddingTop: "1.25rem",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1.25rem",
                    }}
                  >
                    {/* Left: resolution details */}
                    <div>
                      {entry.resolutionCriteria && (
                        <div style={{ marginBottom: "1rem" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: "hsl(var(--foreground))",
                              marginBottom: "0.3rem",
                            }}
                          >
                            Resolution Criteria
                          </div>
                          <p
                            style={{
                              fontSize: "0.8rem",
                              color: "hsl(var(--muted-foreground))",
                              lineHeight: 1.5,
                            }}
                          >
                            {entry.resolutionCriteria}
                          </p>
                        </div>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.5rem",
                          fontSize: "0.78rem",
                        }}
                      >
                        {[
                          {
                            label: "Opened",
                            value: entry.opensAt
                              ? new Date(entry.opensAt).toLocaleString()
                              : "—",
                          },
                          {
                            label: "Closed",
                            value: entry.closesAt
                              ? new Date(entry.closesAt).toLocaleString()
                              : "—",
                          },
                          {
                            label: "Resolved",
                            value: entry.resolvedAt
                              ? new Date(entry.resolvedAt).toLocaleString()
                              : "—",
                          },
                          {
                            label: "Window",
                            value: `${entry.windowHours ?? 1}h objection window`,
                          },
                          {
                            label: "Objections",
                            value:
                              entry.objectionCount === 0
                                ? "None — auto-settled"
                                : `${entry.objectionCount} filed${entry.uppheldObjectionCount > 0 ? `, ${entry.uppheldObjectionCount} upheld` : ""}`,
                          },
                          {
                            label: "Settled by",
                            value: entry.resolvedBySystem
                              ? "System (auto)"
                              : "Admin",
                          },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div
                              style={{
                                color: "hsl(var(--muted-foreground))",
                                fontSize: "0.7rem",
                                marginBottom: "0.1rem",
                              }}
                            >
                              {label}
                            </div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "hsl(var(--foreground))",
                              }}
                            >
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: evidence */}
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "hsl(var(--foreground))",
                          marginBottom: "0.75rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                        }}
                      >
                        <ExternalLink size={12} /> Public Evidence
                      </div>

                      {hasEvidence ? (
                        <div
                          style={{
                            background: "hsl(210 80% 60% / 0.06)",
                            border: "1px solid hsl(210 80% 60% / 0.2)",
                            borderRadius: "var(--radius)",
                            padding: "0.875rem",
                          }}
                        >
                          <a
                            href={entry.evidence.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              color: "hsl(210 80% 65%)",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              marginBottom: "0.6rem",
                              textDecoration: "none",
                              wordBreak: "break-all",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={11} />
                            {entry.evidence.url}
                          </a>
                          {entry.evidence.note && (
                            <p
                              style={{
                                fontSize: "0.8rem",
                                color: "hsl(var(--muted-foreground))",
                                lineHeight: 1.55,
                                margin: 0,
                              }}
                            >
                              {entry.evidence.note}
                            </p>
                          )}
                          {entry.evidence.submittedAt && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "hsl(var(--muted-foreground))",
                                marginTop: "0.5rem",
                                opacity: 0.7,
                              }}
                            >
                              Published{" "}
                              {new Date(
                                entry.evidence.submittedAt
                              ).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : entry.resolvedBySystem ? (
                        <div
                          style={{
                            background: "hsl(160 60% 50% / 0.06)",
                            border: "1px solid hsl(160 60% 50% / 0.2)",
                            borderRadius: "var(--radius)",
                            padding: "0.875rem",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "0.8rem",
                              color: "hsl(var(--muted-foreground))",
                              margin: 0,
                              lineHeight: 1.5,
                            }}
                          >
                            This market was{" "}
                            <strong>auto-settled by the system</strong> after
                            the objection window expired with zero objections
                            filed. No manual admin action was required.
                          </p>
                        </div>
                      ) : (
                        <div
                          style={{
                            background: "hsl(var(--destructive) / 0.05)",
                            border: "1px solid hsl(var(--destructive) / 0.2)",
                            borderRadius: "var(--radius)",
                            padding: "0.875rem",
                          }}
                        >
                          <p
                            style={{
                              fontSize: "0.8rem",
                              color: "hsl(var(--muted-foreground))",
                              margin: 0,
                            }}
                          >
                            ⚠️ No evidence was provided for this resolution.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1.5rem",
            padding: "0.75rem 0",
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.875rem",
          }}
        >
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
            resolutions
          </span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              className="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ opacity: page <= 1 ? 0.5 : 1 }}
            >
              Previous
            </button>
            <span style={{ padding: "0.5rem 0.75rem" }}>
              {page} / {totalPages}
            </span>
            <button
              className="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ opacity: page >= totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResolutionLogPage
