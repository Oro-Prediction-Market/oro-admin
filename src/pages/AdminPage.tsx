import React, { useState, lazy, Suspense } from "react"
import AdminSidebar from "../components/AdminSidebar"

const AdminDashboard = lazy(() => import("./AdminDashboard"))
const MarketManagement = lazy(() => import("./MarketManagement"))
const UserManagement = lazy(() => import("./UserManagement"))
const MarketDiscovery = lazy(() => import("./MarketDiscovery"))
const KeeperDashboard = lazy(() => import("./KeeperDashboard"))
const SettlementPage = lazy(() => import("./SettlementPage"))
const PaymentLogPage = lazy(() => import("./PaymentLogPage"))
import { useAdminApi } from "../lib/useAdminApi"


const AdminPage: React.FC = () => {
  const [page, setPage] = useState("dashboard")
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"))
  const [secret, setSecret] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)
  const { loginWithDevSecret } = useAdminApi(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { token } = await loginWithDevSecret(secret)
      localStorage.setItem("admin_token", token)
      setToken(token)
      setLoginError(null)
    } catch (err: any) {
      setLoginError(err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_token")
    setToken(null)
  }

  if (!token) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        background: "hsl(var(--background))"
      }}>
        <div className="glass-card" style={{ width: 400, padding: 32 }}>
          <h2 style={{ marginBottom: 24, textAlign: "center" }}>Admin Uplink</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.875rem" }}>Dev Secret</label>
              <input 
                type="password" 
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--secondary))",
                  color: "inherit"
                }}
                placeholder="Enter ADMIN_DEV_SECRET"
              />
            </div>
            {loginError && <p style={{ color: "hsl(var(--destructive))", fontSize: "0.875rem", marginBottom: 16 }}>{loginError}</p>}
            <button 
              type="submit"
              className="glass-card"
              style={{
                width: "100%",
                padding: "10px",
                cursor: "pointer",
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                border: "none",
                fontWeight: "bold"
              }}
            >
              Initialize Connection
            </button>
          </form>
          <p style={{ marginTop: 24, fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", textAlign: "center" }}>
            Refer to <code>docs/admin_auth_integration.md</code> for setup instructions.
          </p>
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

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <AdminSidebar current={page} onNavigate={setPage} />
      <main style={{ flex: 1, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button 
            onClick={handleLogout}
            style={{ 
              background: "none", 
              border: "none", 
              color: "hsl(var(--muted-foreground))", 
              cursor: "pointer",
              fontSize: "0.875rem"
            }}
          >
            Logout
          </button>
        </div>
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "hsl(var(--muted-foreground))" }}>Loading…</div>}>
          {content}
        </Suspense>
      </main>
    </div>
  )
}

export default AdminPage
