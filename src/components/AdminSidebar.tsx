import React, { useState } from "react"
import { clsx } from "clsx"
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Search,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Briefcase,
  CreditCard,
  ScrollText,
  ShieldCheck,
  Scale,
  Wallet,
  Coins,
  Bitcoin,
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react"

interface SidebarProps {
  current: string
  onNavigate: (page: string) => void
  onLogout: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const AdminSidebar: React.FC<SidebarProps> = ({
  current,
  onNavigate,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [isMarketOpen, setIsMarketOpen] = useState(
    [
      "markets",
      "discovery",
      "settlements",
      "ter-markets",
      "btc-markets",
    ].includes(current)
  )
  const [isLogsOpen, setIsLogsOpen] = useState(
    ["payments", "audit", "resolution-log", "reconciliation"].includes(current)
  )

  const isMarketParent = [
    "markets",
    "discovery",
    "settlements",
    "ter-markets",
    "btc-markets",
  ].includes(current)
  const isLogsParent = [
    "payments",
    "audit",
    "resolution-log",
    "reconciliation",
  ].includes(current)

  // Only apply space-between when expanded — collapsed needs CSS justify-content:center to work
  const groupStyle = collapsed
    ? undefined
    : { display: "flex", justifyContent: "space-between", alignItems: "center" }

  const iconGroupStyle = {
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : "0.75rem",
  }

  return (
    <aside className={clsx("admin-sidebar", collapsed && "collapsed")}>
      {/* Brand + collapse toggle */}
      <div className="sidebar-brand">
        {!collapsed && (
          <h1
            style={{
              fontSize: "1.4rem",
              margin: 0,
              color: "hsl(var(--primary))",
              whiteSpace: "nowrap",
            }}
          >
            ORO <span style={{ color: "hsl(var(--foreground))" }}>ADMIN</span>
          </h1>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>

      <div className="sidebar-divider" />

      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <ul>
          <li
            className={current === "dashboard" ? "active" : ""}
            onClick={() => onNavigate("dashboard")}
            title="Dashboard"
          >
            <LayoutDashboard size={18} />
            {!collapsed && <span className="nav-label">Dashboard</span>}
          </li>

          {/* Market Management group */}
          <li
            className={isMarketParent ? "active-parent" : ""}
            onClick={() => !collapsed && setIsMarketOpen(!isMarketOpen)}
            style={groupStyle}
            title="Market Management"
          >
            <div style={iconGroupStyle}>
              <Briefcase size={18} />
              {!collapsed && (
                <span className="nav-label">Market Management</span>
              )}
            </div>
            {!collapsed &&
              (isMarketOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              ))}
          </li>

          {!collapsed && isMarketOpen && (
            <div className="submenu">
              <li
                className={current === "discovery" ? "active" : ""}
                onClick={() => onNavigate("discovery")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <Search size={16} />
                <span className="nav-label">Market Discovery</span>
              </li>
              <li
                className={current === "markets" ? "active" : ""}
                onClick={() => onNavigate("markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <BarChart3 size={16} />
                <span className="nav-label">Markets</span>
              </li>
              <li
                className={current === "ter-markets" ? "active" : ""}
                onClick={() => onNavigate("ter-markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <Coins
                  size={16}
                  color={current === "ter-markets" ? undefined : "#f59e0b"}
                />
                <span className="nav-label">TER Markets</span>
              </li>
              <li
                className={current === "btc-markets" ? "active" : ""}
                onClick={() => onNavigate("btc-markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <Bitcoin
                  size={16}
                  color={current === "btc-markets" ? undefined : "#f7931a"}
                />
                <span className="nav-label">BTC Markets</span>
              </li>
              <li
                className={current === "settlements" ? "active" : ""}
                onClick={() => onNavigate("settlements")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <CheckCircle size={16} />
                <span className="nav-label">Settlements</span>
              </li>
            </div>
          )}

          <li
            className={current === "users" ? "active" : ""}
            onClick={() => onNavigate("users")}
            title="Users"
          >
            <Users size={18} />
            {!collapsed && <span className="nav-label">Users</span>}
          </li>
          <li
            className={current === "keeper" ? "active" : ""}
            onClick={() => onNavigate("keeper")}
            title="Keeperbot"
          >
            <Bot size={18} />
            {!collapsed && <span className="nav-label">Keeperbot</span>}
          </li>
          <li
            className={current === "finance" ? "active" : ""}
            onClick={() => onNavigate("finance")}
            title="Financials"
          >
            <Wallet size={18} />
            {!collapsed && <span className="nav-label">Financials</span>}
          </li>
          <li
            className={current === "reporting" ? "active" : ""}
            onClick={() => onNavigate("reporting")}
            title="Reporting"
          >
            <TrendingUp size={18} />
            {!collapsed && <span className="nav-label">Reporting</span>}
          </li>
          <li
            className={current === "revenue" ? "active" : ""}
            onClick={() => onNavigate("revenue")}
            title="Revenue"
          >
            <Coins size={18} />
            {!collapsed && <span className="nav-label">Revenue</span>}
          </li>

          {/* Logs group */}
          <li
            className={isLogsParent ? "active-parent" : ""}
            onClick={() => !collapsed && setIsLogsOpen(!isLogsOpen)}
            style={groupStyle}
            title="Logs"
          >
            <div style={iconGroupStyle}>
              <ScrollText size={18} />
              {!collapsed && <span className="nav-label">Logs</span>}
            </div>
            {!collapsed &&
              (isLogsOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              ))}
          </li>

          {!collapsed && isLogsOpen && (
            <div className="submenu">
              <li
                className={current === "payments" ? "active" : ""}
                onClick={() => onNavigate("payments")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <CreditCard size={16} />
                <span className="nav-label">Payment Log</span>
              </li>
              <li
                className={current === "audit" ? "active" : ""}
                onClick={() => onNavigate("audit")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <ScrollText size={16} />
                <span className="nav-label">Audit Log</span>
              </li>
              <li
                className={current === "resolution-log" ? "active" : ""}
                onClick={() => onNavigate("resolution-log")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <ShieldCheck size={16} />
                <span className="nav-label">Resolution Log</span>
              </li>
              <li
                className={current === "reconciliation" ? "active" : ""}
                onClick={() => onNavigate("reconciliation")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                <Scale size={16} />
                <span className="nav-label">Reconciliation</span>
              </li>
            </div>
          )}

          <div
            className="sidebar-divider"
            style={{ margin: "0.75rem 0.5rem", opacity: 0.5 }}
          />

          <li
            onClick={onLogout}
            style={{ color: "hsl(var(--destructive))" }}
            title="Logout"
          >
            <LogOut size={18} />
            {!collapsed && <span className="nav-label">Logout</span>}
          </li>
        </ul>
      </nav>

      {!collapsed && (
        <div style={{ padding: "0.5rem 1rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              color: "hsl(var(--muted-foreground))",
              opacity: 0.6,
            }}
          >
            v1.0.0-alpha
          </span>
        </div>
      )}
    </aside>
  )
}

export default AdminSidebar
