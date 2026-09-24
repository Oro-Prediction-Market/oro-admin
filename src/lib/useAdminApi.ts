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

// Session-expiry gate for the handful of pages that call fetch() directly
// instead of going through the useAdminApi hook. On a 401 it clears the dead
// token and fires the same `admin:unauthorized` event apiFetch uses, so
// AdminPage drops back to the login screen — instead of the page surfacing a
// raw "failed to fetch". Pass it the Response (works inline or as a .then()
// step: `fetch(...).then(handleAdminAuth).then(r => r.json())`).
export function handleAdminAuth(response: Response): Response {
  if (response.status === 401) {
    sessionStorage.removeItem("admin_token")
    localStorage.removeItem("admin_token")
    window.dispatchEvent(new CustomEvent("admin:unauthorized"))
    throw new Error("Your session expired. Please sign in again.")
  }
  return response
}

export function useAdminApi(token: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}, timeoutMs = 45_000) => {
      if (!token) throw new Error("No admin token provided")
      setLoading(true)
      setError(null)
      // Abort a stalled request instead of hanging forever. A dead keep-alive
      // connection (tab left open, laptop slept, backend cold-started) would
      // otherwise leave the promise unsettled — button stuck spinning, only a
      // full page refresh recovers. 45s is generous for market creation.
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          ...options,
          signal: controller.signal,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        if (!response.ok) {
          // Expired / invalid admin token: don't surface a bare "Unauthorized"
          // on every page. Clear the dead token and signal the app to drop back
          // to the login screen (AdminPage listens for this event).
          if (response.status === 401) {
            sessionStorage.removeItem("admin_token")
            window.dispatchEvent(new CustomEvent("admin:unauthorized"))
            throw new Error("Your session expired. Please sign in again.")
          }
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
        const msg =
          e instanceof DOMException && e.name === "AbortError"
            ? "Request timed out — the server didn't respond. Please try again."
            : e instanceof Error
              ? e.message
              : String(e)
        setError(msg)
        throw new Error(msg)
      } finally {
        clearTimeout(timeout)
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
        excludeSources?: string
        category?: string
        subcategory?: string
        search?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        if (params?.status && params.status !== "All")
          qs.set("status", params.status)
        if (params?.externalSource)
          qs.set("externalSource", params.externalSource)
        if (params?.excludeSources)
          qs.set("excludeSources", params.excludeSources)
        if (params?.category && params.category !== "All")
          qs.set("category", params.category)
        if (params?.subcategory && params.subcategory !== "All")
          qs.set("subcategory", params.subcategory)
        if (params?.search?.trim()) qs.set("search", params.search.trim())
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/markets${suffix}`)
      },
      createMarket: (data: Record<string, unknown>) =>
        // 90s (not the default 45s): a free-tier backend that spun down while
        // the admin filled the form can take 30-60s to cold-start on this first
        // request. handleCreate also retries once on a transport failure.
        apiFetch(
          "/admin/markets",
          { method: "POST", body: JSON.stringify(data) },
          90_000
        ),
      // ── EPL stat markets (one-click from the live leaderboard) ──
      getEplStatMarketPreview: () => apiFetch("/admin/epl/stat-market/preview"),
      createEplStatMarket: (body: {
        stat: string
        closesAt?: string
        topN?: number
      }) =>
        apiFetch("/admin/epl/stat-market", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      // ── UCL stat markets (one-click from the live leaderboard) ──
      getUclStatMarketPreview: () => apiFetch("/admin/ucl/stat-market/preview"),
      createUclStatMarket: (body: {
        stat: string
        closesAt?: string
        topN?: number
      }) =>
        apiFetch("/admin/ucl/stat-market", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      // ── Nations League stat markets ──
      // No live leaderboard behind these: both boards are admin-entered, so
      // the preview shows what has been published rather than a feed.
      getUnlStatMarketPreview: () => apiFetch("/admin/unl/stat-market/preview"),
      createUnlStatMarket: (body: {
        stat: string
        closesAt?: string
        topN?: number
      }) =>
        apiFetch("/admin/unl/stat-market", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      // ── Nations League teams, fixtures and match markets ──
      //
      // The competition has no provider, so these endpoints ARE the feed.
      // Note what is deliberately absent: nothing here settles a market.
      // Saving a score has no market side effects at all, and proposing is a
      // separate call — which is what makes a mistyped score free to fix.
      getUnlSeason: () => apiFetch("/admin/unl/season"),
      getUnlTeams: (season?: string) =>
        apiFetch(
          `/admin/unl/teams${season ? `?season=${encodeURIComponent(season)}` : ""}`
        ),
      createUnlTeam: (body: {
        season: string
        groupKey: string
        name: string
        flagUrl?: string | null
        sortOrder?: number
      }) =>
        apiFetch("/admin/unl/teams", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateUnlTeam: (
        id: string,
        body: {
          name?: string
          flagUrl?: string | null
          sortOrder?: number
          groupKey?: string
        }
      ) =>
        apiFetch(`/admin/unl/teams/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      deleteUnlTeam: (id: string) =>
        apiFetch(`/admin/unl/teams/${id}`, { method: "DELETE" }),
      // Pass dryRun to preview a paste without writing anything — the page
      // shows what would be created before committing fifty-odd rows.
      bulkCreateUnlTeams: (body: {
        season: string
        text: string
        dryRun?: boolean
      }) =>
        apiFetch("/admin/unl/teams/bulk", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      // The pairings follow from who is in the group, so the only input is
      // when each matchday kicks off. Refused if the group already has
      // fixtures — a second round-robin would double every pairing.
      generateUnlFixtures: (body: {
        season: string
        groupKey: string
        kickoffs: string[]
        rounds: 1 | 2
      }) =>
        apiFetch(
          "/admin/unl/fixtures/generate",
          { method: "POST", body: JSON.stringify(body) },
          90_000
        ),
      getUnlFixtures: (season?: string) =>
        apiFetch(
          `/admin/unl/fixtures${season ? `?season=${encodeURIComponent(season)}` : ""}`
        ),
      createUnlFixture: (body: {
        season: string
        homeTeamId: string
        awayTeamId: string
        kickoffAt: string
        matchday?: number | null
      }) =>
        apiFetch("/admin/unl/fixtures", {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateUnlFixture: (
        id: string,
        body: { kickoffAt?: string; matchday?: number | null }
      ) =>
        apiFetch(`/admin/unl/fixtures/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        }),
      deleteUnlFixture: (id: string) =>
        apiFetch(`/admin/unl/fixtures/${id}`, { method: "DELETE" }),
      // Saving a score does NOT propose anything. The response carries a
      // `warning` when the new score contradicts a market that has already
      // settled — the one case that needs a human.
      setUnlScore: (
        id: string,
        body: {
          homeScore: number | null
          awayScore: number | null
          status?: string
        }
      ) =>
        apiFetch(`/admin/unl/fixtures/${id}/score`, {
          method: "PUT",
          body: JSON.stringify(body),
        }),
      createUnlMarket: (fixtureId: string) =>
        apiFetch(
          `/admin/unl/fixtures/${fixtureId}/market`,
          { method: "POST" },
          90_000
        ),
      createUnlMarketWindow: (days: number) =>
        apiFetch(
          "/admin/unl/markets/window",
          { method: "POST", body: JSON.stringify({ days }) },
          90_000
        ),
      // Reads the winner from the outcome ids stored on the fixture row, so no
      // team name is ever compared. Opens the objection window; nothing
      // settles when it expires except an admin.
      proposeUnlResult: (fixtureId: string, windowMinutes = 60) =>
        apiFetch(`/admin/unl/fixtures/${fixtureId}/propose`, {
          method: "POST",
          body: JSON.stringify({ windowMinutes }),
        }),
      // ── Stat board overrides (players the live feed doesn't carry) ──
      getStatOverrides: (league: "epl" | "ucl" | "unl") =>
        apiFetch(`/admin/${league}/stat-overrides`),
      saveStatOverride: (
        league: "epl" | "ucl" | "unl",
        // Only the fields sent are written. `null` clears one, handing it
        // back to the provider; omitting one leaves it as it was.
        body: {
          board: "goals" | "assists"
          player: string
          club?: string | null
          face?: string | null
          value?: number | null
          isManual?: boolean
        }
      ) =>
        apiFetch(`/admin/${league}/stat-overrides`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      deleteStatOverride: (league: "epl" | "ucl" | "unl", id: string) =>
        apiFetch(`/admin/${league}/stat-overrides/${id}`, { method: "DELETE" }),
      openBettingOnStatOverride: (league: "epl" | "ucl" | "unl", id: string) =>
        apiFetch(`/admin/${league}/stat-overrides/${id}/open-betting`, {
          method: "POST",
        }),
      createMarketGroup: (data: Record<string, unknown>) =>
        // Longer timeout — cold start + creates several child markets at once.
        apiFetch(
          "/admin/markets/group",
          { method: "POST", body: JSON.stringify(data) },
          90_000
        ),
      // ── Market suggestions (Oracle Orbit) ──
      getSuggestions: (status?: string, sort?: string) => {
        const qs = new URLSearchParams()
        if (status) qs.set("status", status)
        if (sort) qs.set("sort", sort)
        const q = qs.toString()
        return apiFetch(`/admin/suggestions${q ? `?${q}` : ""}`)
      },
      reviewSuggestion: (id: string, approve: boolean) =>
        apiFetch(`/admin/suggestions/${id}/review`, {
          method: "PATCH",
          body: JSON.stringify({ approve }),
        }),
      publishSuggestion: (id: string, data: Record<string, unknown>) =>
        apiFetch(
          `/admin/suggestions/${id}/publish`,
          { method: "POST", body: JSON.stringify(data) },
          90_000
        ),
      getMarketGroup: (groupId: string) =>
        apiFetch(`/admin/markets/group/${groupId}`),
      updateMarketGroup: (groupId: string, data: Record<string, unknown>) =>
        // Longer timeout — cold start + edits several child markets at once.
        apiFetch(
          `/admin/markets/group/${groupId}`,
          { method: "PATCH", body: JSON.stringify(data) },
          90_000
        ),
      announceMarket: (id: string) =>
        apiFetch(`/admin/markets/${id}/announce`, { method: "POST" }),

      // ── Announcements: a notice sent to every user ──────────────────────
      // sendAnnouncement runs the whole fan-out inline (the insert plus
      // enqueuing ~2,200 DM jobs), so it gets a long timeout. Retrying it is
      // safe: clientRequestId is generated when the compose form opens, so a
      // timed-out request and its retry are one announcement, not two.
      listAnnouncements: (params?: { page?: number; limit?: number }) => {
        const q = new URLSearchParams()
        if (params?.page) q.set("page", String(params.page))
        if (params?.limit) q.set("limit", String(params.limit))
        const qs = q.toString()
        return apiFetch(`/admin/announcements${qs ? `?${qs}` : ""}`)
      },
      getAnnouncement: (id: string) => apiFetch(`/admin/announcements/${id}`),
      sendAnnouncement: (data: {
        title: string
        body: string
        clientRequestId: string
        force?: boolean
      }) =>
        apiFetch(
          "/admin/announcements",
          { method: "POST", body: JSON.stringify(data) },
          120_000
        ),
      retractAnnouncement: (id: string) =>
        apiFetch(`/admin/announcements/${id}/retract`, { method: "POST" }),
      updateMarket: (id: string, data: Record<string, unknown>) =>
        apiFetch(`/admin/markets/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      addOutcome: (
        id: string,
        data: { label: string; imageUrl?: string | null }
      ) =>
        apiFetch(`/admin/markets/${id}/outcomes`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      setOutcomeEliminated: (
        id: string,
        outcomeId: string,
        isEliminated: boolean
      ) =>
        apiFetch(`/admin/markets/${id}/outcomes/${outcomeId}/eliminated`, {
          method: "PATCH",
          body: JSON.stringify({ isEliminated }),
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
      // World Cup hub markets only (subcategory "wc-*") — reopens a closed
      // market for betting with a new future closesAt (ISO string).
      reopenMarket: (id: string, closesAt: string) =>
        apiFetch(`/admin/markets/${id}/reopen`, {
          method: "POST",
          body: JSON.stringify({ closesAt }),
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
          body: JSON.stringify({
            winningOutcomeId,
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
      getLateMoney: (id: string, windowMinutes = 1) =>
        apiFetch(
          `/admin/markets/${id}/late-money?windowMinutes=${windowMinutes}`
        ),
      getSettlements: (params?: { page?: number; limit?: number }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/settlements${suffix}`)
      },
      getPayments: () => apiFetch("/admin/payments"),
      getTransactions: (params?: {
        type?: string
        search?: string
        /** One book only. The two never mix and must never be summed. */
        currency?: "BTN" | "USDT"
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.type && params.type !== "all") qs.set("type", params.type)
        if (params?.search) qs.set("search", params.search)
        if (params?.currency) qs.set("currency", params.currency)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/transactions${suffix}`)
      },
      getUsers: (params?: {
        /** Native currency. The DK Bank columns are empty for a USDT account. */
        currency?: "all" | "BTN" | "USDT"
        search?: string
        role?: "all" | "admin" | "user"
        dkStatus?: "all" | "linked" | "unlinked"
        /** Reputation rung, e.g. "scout". "all" clears the filter. */
        tier?: string
        sortField?: "name" | "balance" | "streak" | "joined"
        sortDir?: "asc" | "desc"
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.currency && params.currency !== "all")
          qs.set("currency", params.currency)
        if (params?.search) qs.set("search", params.search)
        if (params?.role && params.role !== "all") qs.set("role", params.role)
        if (params?.dkStatus && params.dkStatus !== "all")
          qs.set("dkStatus", params.dkStatus)
        if (params?.tier && params.tier !== "all") qs.set("tier", params.tier)
        if (params?.sortField) qs.set("sortField", params.sortField)
        if (params?.sortDir) qs.set("sortDir", params.sortDir)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/users${suffix}`)
      },
      /**
       * Headcount per reputation rung. `count` is every account on that rung;
       * `ranked` is those with at least one resolved prediction. They differ
       * most at Rookie, which is the default for a brand-new account.
       */
      getUserTierDistribution: () =>
        apiFetch(`/admin/users/tier-distribution`) as Promise<{
          distribution: {
            tier: string
            label: string
            count: number
            ranked: number
          }[]
          total: number
          totalRanked: number
        }>,
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
      // Dashboard KPIs computed server-side over ALL markets (the old client-side
      // tally only saw the newest page of markets, so it under-reported badly).
      getMarketStats: () => apiFetch("/admin/markets/stats"),
      // Fire-and-forget warm-up ping. Deliberately bypasses apiFetch so it never
      // flips the shared `loading` flag (which would flicker form buttons) and
      // never throws — used to keep a spun-down free-tier backend awake while an
      // admin fills a long form so their submit doesn't land on a cold start.
      keepAlive: () =>
        fetch(`${API_BASE}/admin/health`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch(() => {}),
      toggleAdmin: (userId: string, isAdmin: boolean) =>
        apiFetch(`/admin/users/${userId}/admin`, {
          method: "PATCH",
          body: JSON.stringify({ isAdmin }),
        }),
      // reveal=true returns the unmasked CID/account number and writes an
      // audit log server-side. Only pass it on an explicit admin action.
      getUserDossier: (userId: string, reveal = false) =>
        apiFetch(
          `/admin/users/${userId}/dossier${reveal ? "?reveal=true" : ""}`
        ),
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
      getRevenueAll: (params?: {
        page?: number
        limit?: number
        status?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        if (params?.status && params.status !== "all")
          qs.set("status", params.status)
        const query = qs.toString()
        return apiFetch(`/admin/revenue/all${query ? `?${query}` : ""}`)
      },
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
      // ── Platform Accuracy ────────────────────────────────────────────────────
      getPlatformAccuracy: () => apiFetch("/admin/platform-accuracy"),
      // ── AML ─────────────────────────────────────────────────────────────────
      getAmlSummary: () => apiFetch("/aml/summary"),
      runAmlScan: (params?: { from?: string; to?: string }) =>
        apiFetch("/aml/scan", {
          method: "POST",
          body: JSON.stringify(params ?? {}),
        }),
      /**
       * Absolute URL for a signed KYC image link.
       *
       * The server returns a root-relative path (`/api/admin/kyc/image?...`),
       * which is correct for the PWA but not here: the admin app is served
       * from a different origin than the API, so a relative `<img src>` would
       * hit the admin's own host and 404. The signature travels in the query
       * string and is the authorisation, so no header is needed — which is
       * exactly why an `<img>` tag can load it at all.
       */
      kycImageUrl: (path: string) => `${API_BASE}${path.replace(/^\/api/, "")}`,

      /** Accounts holding or moving USDT, with per-account money figures. */
      getUsdtUsers: (limit = 100) =>
        apiFetch(`/admin/usdt/users?limit=${limit}`),

      // ── USDT withdrawals ──────────────────────────────────────────────
      //
      // A withdrawal debits the user the moment it is requested and is only
      // *sent* once approved here, so this queue is money already taken from
      // someone and not yet delivered.
      getPendingWithdrawals: (limit = 50) =>
        apiFetch(`/payments/usdt/admin/withdrawals/pending?limit=${limit}`),
      approveWithdrawal: (id: string) =>
        apiFetch(`/payments/usdt/admin/withdrawals/${id}/approve`, {
          method: "POST",
        }),
      rejectWithdrawal: (id: string, reason: string) =>
        apiFetch(`/payments/usdt/admin/withdrawals/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        }),

      // ── KYC review ────────────────────────────────────────────────────
      //
      // Behind `isKycReviewer`, which `isAdmin` deliberately does not imply:
      // admin means moving money and resolving markets, this is permission to
      // read strangers' passports.
      getKycQueue: (limit = 50) => apiFetch(`/admin/kyc/queue?limit=${limit}`),
      getKycQueueHealth: () => apiFetch("/admin/kyc/queue/health"),
      /** Logged as a PII access on the server — never called speculatively. */
      openKycDocument: (id: string) => apiFetch(`/admin/kyc/documents/${id}`),
      approveKycDocument: (id: string) =>
        apiFetch(`/admin/kyc/documents/${id}/approve`, { method: "POST" }),
      rejectKycDocument: (id: string, reason: string) =>
        apiFetch(`/admin/kyc/documents/${id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        }),

      // ── Duels (challenges) ──────────────────────────────────────────────
      /**
       * Read-only. `stuck` narrows to duels stranded on a cancelled market —
       * both wagers debited, nothing left to settle or refund them.
       */
      getDuels: (params?: {
        search?: string
        status?: string
        stuck?: boolean
        marketId?: string
        userId?: string
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.search?.trim()) qs.set("search", params.search.trim())
        // "all" is the server's default; sending it would just be noise.
        if (params?.status && params.status !== "all")
          qs.set("status", params.status)
        if (params?.stuck) qs.set("stuck", "true")
        if (params?.marketId) qs.set("marketId", params.marketId)
        if (params?.userId) qs.set("userId", params.userId)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs}` : ""
        return apiFetch(`/admin/challenges${suffix}`)
      },

      /**
       * Call a stuck duel off and hand both players their wager back.
       *
       * The server refuses anything it does not consider stuck, and refuses a
       * duel that was already settled — so this cannot kill a live contest or
       * pay a refund twice.
       */
      voidDuel: (id: string) =>
        apiFetch(`/admin/challenges/${id}/void`, { method: "POST" }),

      // ── Market comments moderation ──────────────────────────────────────
      getComments: (params?: {
        flagged?: boolean
        /** Free text across body, author name/username and market title. */
        q?: string
        marketId?: string
        userId?: string
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.flagged) qs.set("flagged", "true")
        if (params?.q?.trim()) qs.set("q", params.q.trim())
        if (params?.marketId) qs.set("marketId", params.marketId)
        if (params?.userId) qs.set("userId", params.userId)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs}` : ""
        return apiFetch(`/admin/comments${suffix}`)
      },
      deleteComment: (id: string, reason: string) =>
        apiFetch(`/admin/comments/${id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        }),
      muteCommenter: (userId: string, hours: number, reason?: string) =>
        apiFetch(`/admin/users/${userId}/comment-mute`, {
          method: "POST",
          body: JSON.stringify({ hours, ...(reason ? { reason } : {}) }),
        }),
      unmuteCommenter: (userId: string) =>
        apiFetch(`/admin/users/${userId}/comment-mute`, { method: "DELETE" }),

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
    [apiFetch, token]
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
