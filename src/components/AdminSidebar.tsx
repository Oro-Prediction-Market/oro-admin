import React, { useState } from "react"
import { clsx } from "clsx"
import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bitcoin,
  Bot,
  Briefcase,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  Globe2,
  LayoutDashboard,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Scale,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react"

interface SidebarProps {
  current: string
  onNavigate: (page: string) => void
  onLogout: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const AdminSidebar: React.FC<SidebarProps> = ({
  current,
  onNavigate,
  onLogout,
  collapsed,
  onToggleCollapse,
}) => {
  const [isMarketOpen, setIsMarketOpen] = useState(
    [
      "markets",
      "suggestions",
      "discovery",
      "settlements",
      "ter-markets",
      "btc-markets",
      "epl-markets",
      "ucl-markets",
    ].includes(current)
  )
  const [isLogsOpen, setIsLogsOpen] = useState(
    ["payments", "audit", "resolution-log", "reconciliation"].includes(current)
  )

  const handleMarketToggle = () => {
    if (collapsed) {
      onToggleCollapse()
      setIsMarketOpen(true)
    } else {
      setIsMarketOpen(!isMarketOpen)
    }
  }

  const handleLogsToggle = () => {
    if (collapsed) {
      onToggleCollapse()
      setIsLogsOpen(true)
    } else {
      setIsLogsOpen(!isLogsOpen)
    }
  }

  return (
    <aside className={clsx("admin-sidebar", collapsed && "collapsed")}>
      <div className="sidebar-brand">
        {!collapsed && (
          <h1
            style={{
              fontSize: "1.5rem",
              margin: 0,
              color: "hsl(var(--primary))",
            }}
          >
            ORO <span style={{ color: "hsl(var(--foreground))" }}>ADMIN</span>
          </h1>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>

      <nav>
        <ul>
          <li
            className={current === "dashboard" ? "active" : ""}
            onClick={() => onNavigate("dashboard")}
            title={collapsed ? "Dashboard" : undefined}
          >
            <LayoutDashboard size={20} />
            {!collapsed && <span className="nav-label">Dashboard</span>}
          </li>

          <li
            onClick={handleMarketToggle}
            style={collapsed ? undefined : { justifyContent: "space-between" }}
            className={clsx(
              [
                "markets",
                "discovery",
                "settlements",
                "ter-markets",
                "btc-markets",
                "epl-markets",
                "ucl-markets",
              ].includes(current) && "active-parent"
            )}
            title={collapsed ? "Market Management" : undefined}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <Briefcase size={20} />
              {!collapsed && (
                <span className="nav-label">Market Management</span>
              )}
            </div>
            {!collapsed &&
              (isMarketOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              ))}
          </li>

          {!collapsed && isMarketOpen && (
            <div
              className="submenu"
              style={{
                marginLeft: "1.5rem",
                marginTop: "0.25rem",
                marginBottom: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <li
                className={current === "discovery" ? "active" : ""}
                onClick={() => onNavigate("discovery")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Search size={18} />
                Market Discovery
              </li>
              <li
                className={current === "markets" ? "active" : ""}
                onClick={() => onNavigate("markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <BarChart3 size={18} />
                Markets
              </li>
              <li
                className={current === "suggestions" ? "active" : ""}
                onClick={() => onNavigate("suggestions")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Lightbulb size={18} />
                Market Suggestions
              </li>
              <li
                className={current === "ter-markets" ? "active" : ""}
                onClick={() => onNavigate("ter-markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Coins
                  size={18}
                  color={current === "ter-markets" ? undefined : "#f59e0b"}
                />
                TER Markets
              </li>
              <li
                className={current === "btc-markets" ? "active" : ""}
                onClick={() => onNavigate("btc-markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Bitcoin
                  size={18}
                  color={current === "btc-markets" ? undefined : "#f7931a"}
                />
                BTC Markets
              </li>
              <li
                className={current === "epl-markets" ? "active" : ""}
                onClick={() => onNavigate("epl-markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Trophy size={18} />
                EPL Markets
              </li>
              <li
                className={current === "ucl-markets" ? "active" : ""}
                onClick={() => onNavigate("ucl-markets")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Trophy size={18} />
                UCL Markets
              </li>
              <li
                className={current === "settlements" ? "active" : ""}
                onClick={() => onNavigate("settlements")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <CheckCircle size={18} />
                Settlements
              </li>
            </div>
          )}

          <li
            className={current === "users" ? "active" : ""}
            onClick={() => onNavigate("users")}
            title={collapsed ? "Users" : undefined}
          >
            <Users size={20} />
            {!collapsed && <span className="nav-label">Users</span>}
          </li>
          <li
            className={current === "keeper" ? "active" : ""}
            onClick={() => onNavigate("keeper")}
            title={collapsed ? "Keeperbot" : undefined}
          >
            <Bot size={20} />
            {!collapsed && <span className="nav-label">Keeperbot</span>}
          </li>
          <li
            className={current === "finance" ? "active" : ""}
            onClick={() => onNavigate("finance")}
            title={collapsed ? "Financials" : undefined}
          >
            <Wallet size={20} />
            {!collapsed && <span className="nav-label">Financials</span>}
          </li>
          <li
            className={current === "reporting" ? "active" : ""}
            onClick={() => onNavigate("reporting")}
            title={collapsed ? "Reporting" : undefined}
          >
            <TrendingUp size={20} />
            {!collapsed && <span className="nav-label">Reporting</span>}
          </li>
          <li
            className={current === "revenue" ? "active" : ""}
            onClick={() => onNavigate("revenue")}
            title={collapsed ? "Revenue" : undefined}
          >
            <Coins size={20} />
            {!collapsed && <span className="nav-label">Revenue</span>}
          </li>
          <li
            className={current === "platform-accuracy" ? "active" : ""}
            onClick={() => onNavigate("platform-accuracy")}
            title={collapsed ? "Platform Accuracy" : undefined}
          >
            <Target size={20} />
            {!collapsed && <span className="nav-label">Platform Accuracy</span>}
          </li>
          <li
            className={current === "aml" ? "active" : ""}
            onClick={() => onNavigate("aml")}
            title={collapsed ? "AML Compliance" : undefined}
          >
            <ShieldAlert size={20} />
            {!collapsed && <span className="nav-label">AML Compliance</span>}
          </li>
          <li
            className={current === "usdt-users" ? "active" : ""}
            onClick={() => onNavigate("usdt-users")}
            title={collapsed ? "International Accounts" : undefined}
          >
            <Globe2 size={20} />
            {!collapsed && (
              <span className="nav-label">International Accounts</span>
            )}
          </li>
          <li
            className={current === "usdt-payments" ? "active" : ""}
            onClick={() => onNavigate("usdt-payments")}
            title={collapsed ? "USDT Ledger" : undefined}
          >
            <Receipt size={20} />
            {!collapsed && <span className="nav-label">USDT Ledger</span>}
          </li>
          <li
            className={current === "usdt-withdrawals" ? "active" : ""}
            onClick={() => onNavigate("usdt-withdrawals")}
            title={collapsed ? "USDT Withdrawals" : undefined}
          >
            <ArrowUpRight size={20} />
            {!collapsed && <span className="nav-label">USDT Withdrawals</span>}
          </li>
          <li
            className={current === "kyc" ? "active" : ""}
            onClick={() => onNavigate("kyc")}
            title={collapsed ? "Identity Verification" : undefined}
          >
            <BadgeCheck size={20} />
            {!collapsed && (
              <span className="nav-label">Identity Verification</span>
            )}
          </li>
          <li
            onClick={handleLogsToggle}
            style={collapsed ? undefined : { justifyContent: "space-between" }}
            className={clsx(
              [
                "payments",
                "audit",
                "resolution-log",
                "reconciliation",
              ].includes(current) && "active-parent"
            )}
            title={collapsed ? "Logs" : undefined}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <ScrollText size={20} />
              {!collapsed && <span className="nav-label">Logs</span>}
            </div>
            {!collapsed &&
              (isLogsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              ))}
          </li>

          {!collapsed && isLogsOpen && (
            <div
              className="submenu"
              style={{
                marginLeft: "1.5rem",
                marginTop: "0.25rem",
                marginBottom: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <li
                className={current === "payments" ? "active" : ""}
                onClick={() => onNavigate("payments")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <CreditCard size={18} />
                Payment Log
              </li>
              <li
                className={current === "audit" ? "active" : ""}
                onClick={() => onNavigate("audit")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <ScrollText size={18} />
                Audit Log
              </li>
              <li
                className={current === "resolution-log" ? "active" : ""}
                onClick={() => onNavigate("resolution-log")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <ShieldCheck size={18} />
                Resolution Log
              </li>
              <li
                className={current === "reconciliation" ? "active" : ""}
                onClick={() => onNavigate("reconciliation")}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                <Scale size={18} />
                Reconciliation
              </li>
            </div>
          )}

          <div className="sidebar-divider" />

          <li
            onClick={onLogout}
            style={{ color: "hsl(var(--destructive))" }}
            title={collapsed ? "Logout" : undefined}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <LayoutDashboard
                size={20}
                style={{ transform: "rotate(180deg)" }}
              />
              {!collapsed && <span className="nav-label">Logout</span>}
            </div>
          </li>
        </ul>
      </nav>

      {!collapsed && (
        <div style={{ marginTop: "auto", padding: "1rem" }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            v1.0.0-alpha
          </div>
        </div>
      )}
    </aside>
  )
}

export default AdminSidebar
