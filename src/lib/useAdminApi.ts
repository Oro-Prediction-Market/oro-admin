import { useEffect, useState, useCallback, useMemo } from "react"

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace("/admin", "")

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
          throw new Error(errorData.message || `API Request Failed: ${response.status}`)
        }
        return response.json()
      } catch (e: any) {
        setError(e.message)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const api = useMemo(
    () => ({
      getMarkets: () => apiFetch("/admin/markets"),
      createMarket: (data: any) =>
        apiFetch("/admin/markets", { method: "POST", body: JSON.stringify(data) }),
      updateMarket: (id: string, data: any) =>
        apiFetch(`/markets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      deleteMarket: (id: string) =>
        apiFetch(`/admin/markets/${id}`, { method: "DELETE" }),
      transitionMarket: (id: string, status: string) =>
        apiFetch(`/admin/markets/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      resolveMarket: (id: string, winningOutcomeId: string) =>
        apiFetch(`/admin/markets/${id}/resolve`, {
          method: "POST",
          body: JSON.stringify({ winningOutcomeId }),
        }),
      getPool: (id: string) => apiFetch(`/admin/markets/${id}/pool`),
      getSettlements: () => apiFetch("/admin/settlements"),
      getPayments: () => apiFetch("/admin/payments"),
      getUsers: () => apiFetch("/admin/users"),
      toggleAdmin: (userId: string, isAdmin: boolean) =>
        apiFetch(`/admin/users/${userId}/admin`, {
          method: "PATCH",
          body: JSON.stringify({ isAdmin }),
        }),
      loginWithDevSecret: async (secret: string) => {
        const response = await fetch(`${API_BASE}/auth/dev/admin-token?secret=${secret}`)
        if (!response.ok) throw new Error("Invalid Secret")
        return response.json()
      },
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
  const [markets, setMarkets] = useState<any[]>([])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const data = await getMarkets()
      setMarkets(data)
    } catch (e: any) {
      // Error handled by useAdminApi state
    }
  }, [getMarkets, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { markets, loading, error, refresh }
}
