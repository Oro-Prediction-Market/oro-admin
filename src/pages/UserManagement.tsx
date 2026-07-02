import React, { useEffect, useState, useRef, useCallback } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { useToast } from "../components/Toast"
import {
  User,
  Shield,
  ShieldOff,
  // Phone,
  Flame,
  Search,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react"

interface AdminUser {
  id: string
  telegramId: string | null
  telegramChatId: string | null
  telegramStreak: number | null
  telegramLinkedAt: string | null
  firstName: string | null
  lastName: string | null
  username: string | null
  photoUrl: string | null
  isAdmin: boolean
  dkCid: string | null
  dkAccountNumber: string | null
  dkAccountName: string | null
  // phoneNumber: string | null
  reputationTier: string
  totalPredictions: number
  referredByUserId: string | null
  referredByName: string | null
  referredByUsername: string | null
  referredByTelegramId: string | null
  createdAt: string
  // computed by backend — never raw hashes
  // balance?: string | number
}

const PAGE_SIZE = 20

const UserManagement: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const { notify, ToastContainer } = useToast()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [initialLoad, setInitialLoad] = useState(true)
  const [fetching, setFetching] = useState(false)

  // ── Query params ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("") // raw input (debounced)
  const [search, setSearch] = useState("") // committed after 400 ms
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all")
  const [dkFilter, setDkFilter] = useState<"all" | "linked" | "unlinked">("all")
  const [sortField, setSortField] = useState<
    "name" | "balance" | "streak" | "joined"
  >("joined")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)

  // ── Server totals ─────────────────────────────────────────────────────────
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)

  // Keep a stable ref to `api.getUsers` so the fetch effect doesn't need it
  // in its dependency array (avoids re-firing when the hook object re-creates).
  const getUsersRef = useRef(api.getUsers)
  useEffect(() => {
    getUsersRef.current = api.getUsers
  })

  // ── Single fetch effect — depends only on the real query params ───────────
  useEffect(() => {
    let cancelled = false
    setFetching(true)

    getUsersRef
      .current({
        search,
        role: roleFilter,
        dkStatus: dkFilter,
        sortField,
        sortDir,
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return
        const r = res as {
          data: AdminUser[]
          total: number
          page: number
          pages: number
        }
        setUsers(r.data)
        setTotal(r.total)
        setPages(r.pages)
      })
      .catch((e: unknown) => {
        if (!cancelled) console.error("Failed to fetch users", e)
      })
      .finally(() => {
        if (!cancelled) {
          setFetching(false)
          setInitialLoad(false)
        }
      })

    return () => {
      cancelled = true
    } // cancel stale requests on fast changes
  }, [search, roleFilter, dkFilter, sortField, sortDir, page])

  // ── Debounce search input → commit after 400 ms, reset to page 1 ──────────
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Manual refresh (e.g. after promote/demote) ────────────────────────────
  const [refreshTick, setRefreshTick] = useState(0)
  const forceRefresh = useCallback(() => setRefreshTick((n) => n + 1), [])

  // tie refreshTick into the fetch effect by making page "re-set" trigger it
  // simpler: just re-add refreshTick as a dep on the fetch effect
  useEffect(() => {
    if (refreshTick === 0) return // skip initial mount (already fetched above)
    let cancelled = false
    setFetching(true)

    getUsersRef
      .current({
        search,
        role: roleFilter,
        dkStatus: dkFilter,
        sortField,
        sortDir,
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return
        const r = res as {
          data: AdminUser[]
          total: number
          page: number
          pages: number
        }
        setUsers(r.data)
        setTotal(r.total)
        setPages(r.pages)
      })
      .catch((e: unknown) => {
        if (!cancelled) console.error("Failed to fetch users", e)
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      await api.toggleAdmin(userId, !currentStatus)
      forceRefresh()
    } catch (e) {
      notify(
        "error",
        `Error toggling admin status: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const hasFilters =
    !!search.trim() || roleFilter !== "all" || dkFilter !== "all"

  const inputStyle: React.CSSProperties = {
    background: "hsl(var(--background))",
    border: "none",
    borderRadius: 8,
    padding: "7px 12px",
    color: "hsl(var(--foreground))",
    fontSize: "0.85rem",
    boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
    outline: "none",
    fontFamily: "inherit",
  }

  return (
    <div>
      {ToastContainer}
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>User Management</h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "0.875rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            {total} users total · page {page} of {pages}
          </p>
        </div>
        <button
          onClick={forceRefresh}
          className="secondary"
          style={{ fontSize: "0.85rem", padding: "8px 16px" }}
          disabled={fetching}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Search & Filters ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "hsl(var(--muted-foreground))",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search name, @username, Telegram ID, DK CID, phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 30 }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as typeof roleFilter)
            setPage(1)
          }}
          style={inputStyle}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins only</option>
          <option value="user">Users only</option>
        </select>
        <select
          value={dkFilter}
          onChange={(e) => {
            setDkFilter(e.target.value as typeof dkFilter)
            setPage(1)
          }}
          style={inputStyle}
        >
          <option value="all">All DK Status</option>
          <option value="linked">DK Linked</option>
          <option value="unlinked">Not Linked</option>
        </select>
        {/* Sort */}
        <select
          value={sortField}
          onChange={(e) => {
            setSortField(e.target.value as typeof sortField)
            setPage(1)
          }}
          style={inputStyle}
        >
          <option value="joined">Sort: Joined</option>
          <option value="name">Sort: Name</option>
          <option value="streak">Sort: Streak</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="secondary"
          style={{
            padding: "7px 12px",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {sortDir === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
        {hasFilters && (
          <button
            onClick={() => {
              setSearchInput("")
              setSearch("")
              setRoleFilter("all")
              setDkFilter("all")
              setPage(1)
            }}
            className="secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.8rem",
              padding: "7px 12px",
            }}
          >
            <X size={13} /> Clear
          </button>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.8rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {users.length} shown · {total} total
        </span>
      </div>

      {/* ── Loading bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          height: 3,
          borderRadius: 2,
          marginBottom: "1rem",
          background: "hsl(var(--background))",
          boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
          overflow: "hidden",
        }}
      >
        {fetching && (
          <div
            style={{
              height: "100%",
              width: "40%",
              background: "hsl(var(--primary))",
              borderRadius: 2,
              animation: "slideBar 1s ease-in-out infinite alternate",
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes slideBar {
          from { margin-left: 0%; }
          to   { margin-left: 60%; }
        }
      `}</style>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      {initialLoad ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Retrieving user records...
        </div>
      ) : users.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {hasFilters ? "No users match your filters." : "No users found."}
        </div>
      ) : (
        <div
          className="glass-card"
          style={{
            position: "relative",
            pointerEvents: fetching ? "none" : "auto",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1000px",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid hsla(var(--foreground), 0.1)",
                    backgroundColor: "hsla(var(--background), 0.5)",
                  }}
                >
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    User
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Role & Rep
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Telegram
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Predictions
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    DK Bank
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Referred By
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Joined
                  </th>
                  <th
                    style={{
                      padding: "1rem",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "hsl(var(--muted-foreground))",
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: AdminUser) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: "1px solid hsla(var(--foreground), 0.05)",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        "hsla(var(--primary), 0.05)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    {/* User */}
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.875rem",
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: "hsla(var(--primary), 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "hsl(var(--primary))",
                          }}
                        >
                          <User size={18} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 150,
                            }}
                          >
                            {user.firstName || "Anonymous"}
                            {user.lastName ? ` ${user.lastName}` : ""}
                          </div>
                          {user.username && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "hsl(var(--primary))",
                                fontWeight: 600,
                              }}
                            >
                              @{user.username}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "0.68rem",
                              color: "hsl(var(--muted-foreground))",
                              fontFamily: "monospace",
                            }}
                          >
                            {user.id.slice(0, 12)}…
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Rep */}
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          className={`badge ${user.isAdmin ? "badge-resolved" : "badge-upcoming"}`}
                        >
                          {user.isAdmin ? "ADMIN" : "USER"}
                        </span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            textTransform: "capitalize",
                            color:
                              user.reputationTier === "expert"
                                ? "hsl(var(--primary))"
                                : user.reputationTier === "reliable"
                                  ? "#16a34a"
                                  : user.reputationTier === "regular"
                                    ? "#d97706"
                                    : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {user.reputationTier ?? "newcomer"}
                        </span>
                      </div>
                    </td>

                    {/* Telegram */}
                    <td style={{ padding: "1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            color: user.telegramId
                              ? "hsl(var(--foreground))"
                              : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {user.telegramId ?? "—"}
                        </span>
                        {user.telegramStreak ? (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              color: "hsl(var(--primary))",
                            }}
                          >
                            <Flame size={13} /> {user.telegramStreak}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "hsl(var(--muted-foreground))",
                            }}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Predictions */}
                    <td
                      style={{
                        padding: "1rem",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {user.totalPredictions ?? 0}
                    </td>

                    {/* DK Bank */}
                    <td style={{ padding: "1rem" }}>
                      {user.dkCid ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            fontSize: "0.75rem",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "hsl(var(--foreground))",
                              fontWeight: 600,
                            }}
                          >
                            {user.dkCid}
                          </span>
                          {user.dkAccountName && (
                            <span
                              style={{ color: "hsl(var(--muted-foreground))" }}
                            >
                              {user.dkAccountName}
                            </span>
                          )}
                          {user.dkAccountNumber && (
                            <span
                              style={{
                                fontFamily: "monospace",
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              Acc: {user.dkAccountNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            color: "hsl(var(--muted-foreground))",
                            fontSize: "0.75rem",
                          }}
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* Referred By */}
                    <td style={{ padding: "1rem" }}>
                      {user.referredByUserId ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            fontSize: "0.75rem",
                          }}
                        >
                          <span
                            style={{
                              color: "hsl(var(--foreground))",
                              fontWeight: 600,
                            }}
                          >
                            {user.referredByName ||
                              (user.referredByUsername
                                ? `@${user.referredByUsername}`
                                : "Unknown")}
                          </span>
                          {user.referredByUsername && user.referredByName && (
                            <span
                              style={{
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              @{user.referredByUsername}
                            </span>
                          )}
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.7rem",
                              color: "hsl(var(--muted-foreground))",
                            }}
                            title={user.referredByUserId}
                          >
                            {user.referredByUserId.slice(0, 8)}…
                          </span>
                        </div>
                      ) : (
                        <span
                          style={{
                            color: "hsl(var(--muted-foreground))",
                            fontSize: "0.75rem",
                          }}
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* Joined */}
                    <td
                      style={{
                        padding: "1rem",
                        color: "hsl(var(--muted-foreground))",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span>
                          Joined:{" "}
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                        {user.telegramLinkedAt && (
                          <span>
                            Linked:{" "}
                            {new Date(
                              user.telegramLinkedAt
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        className="secondary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: "0.75rem",
                          padding: "6px 12px",
                        }}
                        disabled={api.loading}
                      >
                        {user.isAdmin ? (
                          <>
                            <ShieldOff size={13} /> Demote
                          </>
                        ) : (
                          <>
                            <Shield size={13} /> Promote
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: "2rem",
            flexWrap: "wrap",
          }}
        >
          {/* First */}
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setPage(1)}
            disabled={page === 1 || fetching}
          >
            «
          </button>
          {/* Prev */}
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || fetching}
          >
            ‹ Prev
          </button>

          {/* Page number pills — sliding window of 7 */}
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            let start = Math.max(1, page - 3)
            const end = Math.min(pages, start + 6)
            start = Math.max(1, end - 6)
            return start + i
          }).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              disabled={fetching}
              style={{
                padding: "6px 12px",
                fontSize: "0.8rem",
                borderRadius: 8,
                border: "none",
                cursor: fetching ? "default" : "pointer",
                background:
                  p === page ? "hsl(var(--primary))" : "hsl(var(--background))",
                color:
                  p === page
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))",
                boxShadow:
                  p === page
                    ? "0 0 15px hsla(var(--primary), 0.1)"
                    : "var(--glass-shadow)",
                fontWeight: p === page ? 700 : 400,
                fontFamily: "inherit",
                opacity: fetching ? 0.6 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {p}
            </button>
          ))}

          {/* Next */}
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages || fetching}
          >
            Next ›
          </button>
          {/* Last */}
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setPage(pages)}
            disabled={page === pages || fetching}
          >
            »
          </button>

          <span
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
              marginLeft: 4,
            }}
          >
            {`Page ${page} / ${pages} · ${total} users`}
          </span>
        </div>
      )}
    </div>
  )
}

export default UserManagement
