import { useEffect, useState, useCallback, useMemo } from "react"

// Backend uses a global /api prefix — strip the trailing /admin from the env var
// then re-add /api so all requests go to /api/admin/...
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + // strip trailing /admin added by env
  "/api" // add the NestJS global prefix

// ── Standalone login — does NOT require a token ───────────────────────────────
export async function loginWithDevSecret(
  secret: string,
  totp?: string
): Promise<{ token: string }> {
  const params = new URLSearchParams({ secret })
  if (totp) params.set("totp", totp)
  const response = await fetch(
    `${API_BASE}/auth/dev/admin-token?${params.toString()}`
  )
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.message || "Invalid Secret")
  }
  return response.json()
}

export function useAdminApi(token: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!token) throw new Error("No admin token provided")
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.message || `API Request Failed: ${response.status}`
          )
        }
        // 204 No Content or empty body — return null instead of crashing
        const contentType = response.headers.get("content-type") ?? ""
        const contentLength = response.headers.get("content-length")
        if (
          response.status === 204 ||
          contentLength === "0" ||
          !contentType.includes("application/json")
        ) {
          return null
        }
        return response.json().catch(() => null)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const api = useMemo(
    () => ({
      getMarkets: (params?: {
        page?: number
        limit?: number
        status?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        if (params?.status && params.status !== "All")
          qs.set("status", params.status)
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/markets${suffix}`)
      },
      createMarket: (data: Record<string, unknown>) =>
        apiFetch("/admin/markets", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      updateMarket: (id: string, data: Record<string, unknown>) =>
        apiFetch(`/admin/markets/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      deleteMarket: (id: string) =>
        apiFetch(`/admin/markets/${id}`, { method: "DELETE" }),
      transitionMarket: (id: string, status: string) =>
        apiFetch(`/admin/markets/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      proposeMarket: (
        id: string,
        proposedOutcomeId: string,
        windowMinutes?: number
      ) =>
        apiFetch(`/admin/markets/${id}/propose`, {
          method: "POST",
          body: JSON.stringify({
            proposedOutcomeId,
            windowMinutes: windowMinutes ?? 60,
          }),
        }),
      resolveMarket: (
        id: string,
        winningOutcomeId: string,
        evidenceUrl: string,
        evidenceNote: string
      ) =>
        apiFetch(`/admin/markets/${id}/resolve`, {
          method: "POST",
          body: JSON.stringify({ winningOutcomeId, evidenceUrl, evidenceNote }),
        }),
      cancelMarket: (id: string) =>
        apiFetch(`/admin/markets/${id}/cancel`, { method: "POST" }),
      getMarketDisputes: (id: string) =>
        apiFetch(`/admin/markets/${id}/disputes`),
      getResolutionLog: () =>
        fetch(`${API_BASE}/markets/resolution-log`).then((r) => r.json()),
      getPool: (id: string) => apiFetch(`/admin/markets/${id}/pool`),
      getSettlements: (params?: { page?: number; limit?: number }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/settlements${suffix}`)
      },
      getPayments: () => apiFetch("/admin/payments"),
      getUsers: (params?: {
        search?: string
        role?: "all" | "admin" | "user"
        dkStatus?: "all" | "linked" | "unlinked"
        sortField?: "name" | "balance" | "streak" | "joined"
        sortDir?: "asc" | "desc"
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.search) qs.set("search", params.search)
        if (params?.role && params.role !== "all") qs.set("role", params.role)
        if (params?.dkStatus && params.dkStatus !== "all")
          qs.set("dkStatus", params.dkStatus)
        if (params?.sortField) qs.set("sortField", params.sortField)
        if (params?.sortDir) qs.set("sortDir", params.sortDir)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/users${suffix}`)
      },
      getAuditLogs: (params?: {
        page?: number
        limit?: number
        action?: string
        adminId?: string
        entityType?: string
        search?: string
        from?: string
        to?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        if (params?.action && params.action !== "all")
          qs.set("action", params.action)
        if (params?.adminId) qs.set("adminId", params.adminId)
        if (params?.entityType && params.entityType !== "all")
          qs.set("entityType", params.entityType)
        if (params?.search) qs.set("search", params.search)
        if (params?.from) qs.set("from", params.from)
        if (params?.to) qs.set("to", params.to)
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/audit-logs${suffix}`)
      },
      getAuditAdmins: () => apiFetch("/admin/audit-logs/admins"),
      getAuditLogsByAdmin: (adminId: string) =>
        apiFetch(`/admin/audit-logs/admin/${adminId}`),
      getAuditLogsByEntity: (entityId: string) =>
        apiFetch(`/admin/audit-logs/entity/${entityId}`),
      getHealthCheck: () => apiFetch("/admin/health"),
      toggleAdmin: (userId: string, isAdmin: boolean) =>
        apiFetch(`/admin/users/${userId}/admin`, {
          method: "PATCH",
          body: JSON.stringify({ isAdmin }),
        }),
      // ── Tournaments ──────────────────────────────────────────────────────
      getTournaments: () => apiFetch("/admin/tournaments"),
      createTournament: (data: Record<string, unknown>) =>
        apiFetch("/admin/tournaments", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      addNomination: (
        tournamentId: string,
        marketId: string,
        targetRound: number
      ) =>
        apiFetch(`/admin/tournaments/${tournamentId}/nominations`, {
          method: "POST",
          body: JSON.stringify({ marketId, targetRound }),
        }),
      removeNomination: (tournamentId: string, nominationId: string) =>
        apiFetch(
          `/admin/tournaments/${tournamentId}/nominations/${nominationId}`,
          { method: "DELETE" }
        ),
      closeNominations: (tournamentId: string) =>
        apiFetch(`/admin/tournaments/${tournamentId}/close-nominations`, {
          method: "POST",
        }),
      startTournament: (tournamentId: string) =>
        apiFetch(`/admin/tournaments/${tournamentId}/start`, {
          method: "POST",
        }),
      getReconciliation: () => apiFetch("/admin/reconciliation"),
    }),
    [apiFetch]
  )

  return {
    loading,
    error,
    ...api,
  }
}

// Convenience hook for fetching markets initially
export function useAdminMarkets(token: string | null) {
  const { getMarkets, loading, error } = useAdminApi(token)
  const [markets, setMarkets] = useState<Record<string, unknown>[]>([])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const res = await getMarkets()
      setMarkets(
        ((res as Record<string, unknown>)?.data ?? res) as Record<
          string,
          unknown
        >[]
      )
    } catch {
      // Error handled by useAdminApi state
    }
  }, [getMarkets, token])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { markets, loading, error, refresh }
}
