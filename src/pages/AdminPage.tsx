import React, { useState, lazy, Suspense } from "react"
import { Menu } from "lucide-react"
import AdminSidebar from "../components/AdminSidebar"

const AdminDashboard = lazy(() => import("./AdminDashboard"))
const MarketManagement = lazy(() => import("./MarketManagement"))
const UserManagement = lazy(() => import("./UserManagement"))
const MarketDiscovery = lazy(() => import("./MarketDiscovery"))
const KeeperDashboard = lazy(() => import("./KeeperDashboard"))
const SettlementPage = lazy(() => import("./SettlementPage"))
const PaymentLogPage = lazy(() => import("./PaymentLogPage"))
const AuditLogPage = lazy(() => import("./AuditLogPage"))
const ResolutionLogPage = lazy(() => import("./ResolutionLogPage"))
const ReconciliationPage = lazy(() => import("./ReconciliationPage"))
const FinancePage = lazy(() => import("./FinancePage"))
const AutoMarketManagement = lazy(() => import("./AutoMarketManagement"))
const ReportingPage = lazy(() => import("./ReportingPage"))
const RevenuePage = lazy(() => import("./RevenuePage"))
const AMLPage = lazy(() => import("./AMLPage"))
import { loginWithDevSecret } from "../lib/useAdminApi"

const AdminPage: React.FC = () => {
  const [page, setPage] = useState("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.innerWidth <= 768
  )
  const [token, setToken] = useState<string | null>(
    sessionStorage.getItem("admin_token")
  )
  const [secret, setSecret] = useState("")
  const [totp, setTotp] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { token } = await loginWithDevSecret(secret, totp || undefined)
      sessionStorage.setItem("admin_token", token)
      setToken(token)
      setLoginError(null)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed")
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("admin_token")
    setToken(null)
  }

  if (!token) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "hsl(var(--background))",
          padding: "1rem",
        }}
      >
        <div
          className="glass-card"
          style={{ width: "100%", maxWidth: 400, padding: 32 }}
        >
          <h2 style={{ marginBottom: 24, textAlign: "center" }}>
            Admin Uplink
          </h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: "0.875rem",
                }}
              >
                Dev Secret
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
                  outline: "none",
                  fontSize: "0.875rem",
                  fontFamily: "inherit",
                  transition: "box-shadow 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow =
                    "var(--shadow-neu-inset), 0 0 0 2px hsla(180, 100%, 35%, 0.45)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 15px hsla(var(--primary), 0.1)"
                }}
                placeholder="Enter ADMIN_DEV_SECRET"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: "0.875rem",
                }}
              >
                Authenticator Code{" "}
                <span
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    fontWeight: 400,
                  }}
                >
                  (2FA enabled)
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
                  outline: "none",
                  fontSize: "1.1rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.3em",
                  transition: "box-shadow 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow =
                    "var(--shadow-neu-inset), 0 0 0 2px hsla(180, 100%, 35%, 0.45)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 15px hsla(var(--primary), 0.1)"
                }}
                placeholder="000000"
              />
            </div>
            {loginError && (
              <p
                style={{
                  color: "hsl(var(--destructive))",
                  fontSize: "0.875rem",
                  marginBottom: 16,
                }}
              >
                {loginError}
              </p>
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px",
                cursor: "pointer",
              }}
            >
              Initialize Connection
            </button>
          </form>
          {/* <p
            style={{
              marginTop: 24,
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
              textAlign: "center",
            }}
          >
            Refer to <code>docs/admin_auth_integration.md</code> for setup
            instructions.
          </p> */}
        </div>
      </div>
    )
  }

  let content
  if (page === "dashboard") content = <AdminDashboard />
  else if (page === "markets") content = <MarketManagement />
  else if (page === "users") content = <UserManagement />
  else if (page === "discovery") content = <MarketDiscovery />
  else if (page === "keeper") content = <KeeperDashboard />
  else if (page === "settlements") content = <SettlementPage />
  else if (page === "payments") content = <PaymentLogPage />
  else if (page === "audit") content = <AuditLogPage />
  else if (page === "resolution-log") content = <ResolutionLogPage />
  else if (page === "reconciliation") content = <ReconciliationPage />
  else if (page === "finance") content = <FinancePage />
  else if (page === "ter-markets")
    content = <AutoMarketManagement source="ter" />
  else if (page === "btc-markets")
    content = <AutoMarketManagement source="btc" />
  else if (page === "reporting") content = <ReportingPage />
  else if (page === "revenue") content = <RevenuePage />
  else if (page === "aml") content = <AMLPage />

  return (
    <div className="admin-layout">
      {/* Floating open button — only rendered on mobile via CSS */}
      {sidebarCollapsed && (
        <button
          className="mobile-open-btn"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}
      {/* Backdrop — CSS hides it on desktop */}
      {!sidebarCollapsed && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <AdminSidebar
        current={page}
        onNavigate={(p) => {
          setPage(p)
          if (window.innerWidth <= 768) setSidebarCollapsed(true)
        }}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <main className="admin-main">
        <Suspense
          fallback={
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              Loading…
            </div>
          }
        >
          {content}
        </Suspense>
      </main>
    </div>
  )
}

export default AdminPage
