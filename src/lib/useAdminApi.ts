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
  const response = await fetch(`${API_BASE}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, ...(totp ? { totp } : {}) }),
  })
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
        externalSource?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        if (params?.status && params.status !== "All")
          qs.set("status", params.status)
        if (params?.externalSource)
          qs.set("externalSource", params.externalSource)
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
      purgeEmptyMarkets: () =>
        apiFetch(`/admin/markets/cleanup/zero-pool`, { method: "DELETE" }),
      getZeroPoolSettled: () => apiFetch(`/admin/markets/settled/zero-pool`),
      purgeZeroPoolSettled: () =>
        apiFetch(`/admin/markets/cleanup/zero-pool-settled`, {
          method: "DELETE",
        }),
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
        winningOutcomeIds: string[],
        evidenceUrl: string,
        evidenceNote: string
      ) =>
        apiFetch(`/admin/markets/${id}/resolve`, {
          method: "POST",
          body: JSON.stringify({
            winningOutcomeIds,
            evidenceUrl,
            evidenceNote,
          }),
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
      getTransactions: (params?: { type?: string; limit?: number }) => {
        const qs = new URLSearchParams()
        if (params?.type && params.type !== "all") qs.set("type", params.type)
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/transactions${suffix}`)
      },
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
      // ── Auto markets (TER / BTC) ─────────────────────────────────────────
      spawnAutoMarket: (source: "ter" | "btc") =>
        apiFetch(`/${source}/spawn`, { method: "POST" }),
      getAutoPrice: (source: "ter" | "btc") => apiFetch(`/${source}/price`),
      // ── Reporting ────────────────────────────────────────────────────────
      getReportingTransactionAudits: (params?: {
        userId?: string
        type?: string
        status?: string
        marketId?: string
        from?: string
        to?: string
        search?: string
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.userId) qs.set("userId", params.userId)
        if (params?.type) qs.set("type", params.type)
        if (params?.status) qs.set("status", params.status)
        if (params?.marketId) qs.set("marketId", params.marketId)
        if (params?.from) qs.set("from", params.from)
        if (params?.to) qs.set("to", params.to)
        if (params?.search) qs.set("search", params.search)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/reporting/transaction-audits${suffix}`)
      },
      getReportingTransactionStats: (params?: {
        from?: string
        to?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.from) qs.set("from", params.from)
        if (params?.to) qs.set("to", params.to)
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/reporting/transaction-audits/stats${suffix}`)
      },
      getReportingDisputes: (params?: {
        marketId?: string
        from?: string
        to?: string
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.marketId) qs.set("marketId", params.marketId)
        if (params?.from) qs.set("from", params.from)
        if (params?.to) qs.set("to", params.to)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/reporting/disputes${suffix}`)
      },
      getReportingDisputeStats: () => apiFetch("/reporting/disputes/stats"),
      getReportingPendingDisputes: (params?: {
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/reporting/disputes/pending/gmc${suffix}`)
      },
      // ── Revenue Distribution ──────────────────────────────────────────────
      getRevenueSummary: () => apiFetch("/admin/revenue/summary"),
      getRevenuePending: () => apiFetch("/admin/revenue/pending"),
      getRevenueAll: () => apiFetch("/admin/revenue/all"),
      getRevenueByMarket: (marketId: string) =>
        apiFetch(`/admin/revenue/market/${marketId}`),
      executeRevenueTransfer: (id: string) =>
        apiFetch(`/admin/revenue/${id}/transfer`, { method: "POST" }),
      processAllRevenue: () =>
        apiFetch("/admin/revenue/process-all", { method: "POST" }),
      backfillRevenue: () =>
        apiFetch("/admin/revenue/backfill", { method: "POST" }),
      getRevenueAccount: () => apiFetch("/admin/revenue/account"),
      getRevenueAccountBalance: () =>
        apiFetch("/admin/revenue/account/balance"),
      setRevenueAccount: (accountNumber: string) =>
        apiFetch("/admin/revenue/account", {
          method: "PUT",
          body: JSON.stringify({ accountNumber }),
        }),
      // ── AML ─────────────────────────────────────────────────────────────────
      getAmlSummary: () => apiFetch("/aml/summary"),
      runAmlScan: (params?: { from?: string; to?: string }) =>
        apiFetch("/aml/scan", {
          method: "POST",
          body: JSON.stringify(params ?? {}),
        }),
      getAmlAlerts: (params?: {
        userId?: string
        alertType?: string
        riskLevel?: string
        isResolved?: boolean
        from?: string
        to?: string
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.userId) qs.set("userId", params.userId)
        if (params?.alertType) qs.set("alertType", params.alertType)
        if (params?.riskLevel) qs.set("riskLevel", params.riskLevel)
        if (params?.isResolved !== undefined)
          qs.set("isResolved", String(params.isResolved))
        if (params?.from) qs.set("from", params.from)
        if (params?.to) qs.set("to", params.to)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/aml/alerts${suffix}`)
      },
      resolveAmlAlert: (id: string, resolution: string) =>
        apiFetch(`/aml/alerts/${id}/resolve`, {
          method: "PATCH",
          body: JSON.stringify({ resolution }),
        }),
      getAmlReports: (params?: { page?: number; limit?: number }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/aml/reports${suffix}`)
      },
      generateAmlReport: (params: {
        reportType: "periodic" | "sar"
        from: string
        to: string
        notes?: string
      }) =>
        apiFetch("/aml/reports/generate", {
          method: "POST",
          body: JSON.stringify(params),
        }),
    }),
    [apiFetch]
  )

  // Download helper — returns a blob, not JSON, so cannot use apiFetch
  const downloadAmlReport = useCallback(
    async (reportId: string, format: "pdf" | "csv") => {
      if (!token) throw new Error("No admin token provided")
      const response = await fetch(
        `${API_BASE}/aml/reports/${reportId}/download?format=${format}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `aml-report-${reportId.slice(0, 8)}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [token]
  )

  // Download helper — returns a blob, not JSON, so cannot use apiFetch
  const downloadTransactionsCsv = useCallback(
    async (type?: string) => {
      if (!token) throw new Error("No admin token provided")
      const qs =
        type && type !== "all" ? `?type=${encodeURIComponent(type)}` : ""
      const response = await fetch(
        `${API_BASE}/admin/transactions/export${qs}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      const suffix = type && type !== "all" ? `-${type}` : ""
      a.download = `transactions${suffix}-${date}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    [token]
  )

  return {
    loading,
    error,
    downloadAmlReport,
    downloadTransactionsCsv,
    ...api,
  }
}

// Convenience hook for fetching markets initially
export function useAdminMarkets(
  token: string | null,
  params?: { page?: number; limit?: number; status?: string }
) {
  const { getMarkets, loading, error } = useAdminApi(token)
  const [markets, setMarkets] = useState<Record<string, unknown>[]>([])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const res = await getMarkets(params)
      setMarkets(
        ((res as Record<string, unknown>)?.data ?? res) as Record<
          string,
          unknown
        >[]
      )
    } catch {
      // Error handled by useAdminApi state
    }
  }, [getMarkets, token, params])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { markets, loading, error, refresh }
}
