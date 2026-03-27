import React, { useState } from "react"
import { LayoutDashboard, BarChart3, Users, Search, Bot, CheckCircle, ChevronDown, ChevronRight, Briefcase, CreditCard, ScrollText } from "lucide-react"

interface SidebarProps {
  current: string
  onNavigate: (page: string) => void
}

const AdminSidebar: React.FC<SidebarProps> = ({ current, onNavigate }) => {
  const [isMarketOpen, setIsMarketOpen] = useState(
    ["markets", "discovery", "settlements"].includes(current)
  );
  const [isLogsOpen, setIsLogsOpen] = useState(
    ["payments"].includes(current)
  );

  return (
    <aside className="admin-sidebar">
      <div className="brand" style={{ padding: "0 1rem", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>TARA <span style={{ color: "white" }}>ADMIN</span></h1>
      </div>
      <nav>
        <ul>
          <li
            className={current === "dashboard" ? "active" : ""}
            onClick={() => onNavigate("dashboard")}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </li>

          <li
            onClick={() => setIsMarketOpen(!isMarketOpen)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            className={["markets", "discovery", "settlements"].includes(current) ? "active-parent" : ""}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Briefcase size={20} />
              <span>Market Management</span>
            </div>
            {isMarketOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </li>

          {isMarketOpen && (
            <div className="submenu" style={{ marginLeft: '1.5rem', marginTop: '0.25rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li
                className={current === "discovery" ? "active" : ""}
                onClick={() => onNavigate("discovery")}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                <Search size={18} />
                Market Discovery
              </li>
              <li
                className={current === "markets" ? "active" : ""}
                onClick={() => onNavigate("markets")}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                <BarChart3 size={18} />
                Markets
              </li>
              <li
                className={current === "settlements" ? "active" : ""}
                onClick={() => onNavigate("settlements")}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                <CheckCircle size={18} />
                Settlements
              </li>
            </div>
          )}

          <li
            className={current === "users" ? "active" : ""}
            onClick={() => onNavigate("users")}
          >
            <Users size={20} />
            Users
          </li>
          <li
            className={current === "keeper" ? "active" : ""}
            onClick={() => onNavigate("keeper")}
          >
            <Bot size={20} />
            Keeperbot
          </li>

          <li
            onClick={() => setIsLogsOpen(!isLogsOpen)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            className={["payments"].includes(current) ? "active-parent" : ""}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ScrollText size={20} />
              <span>Logs</span>
            </div>
            {isLogsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </li>

          {isLogsOpen && (
            <div className="submenu" style={{ marginLeft: '1.5rem', marginTop: '0.25rem', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li
                className={current === "payments" ? "active" : ""}
                onClick={() => onNavigate("payments")}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
              >
                <CreditCard size={18} />
                Payment Log
              </li>
            </div>
          )}
        </ul>
      </nav>
      <div style={{ marginTop: "auto", padding: "1rem" }}>
         <div style={{ fontSize: "0.75rem", color: "hsla(0, 0%, 100%, 0.4)" }}>
            v1.0.0-alpha
         </div>
      </div>
    </aside>
  )
}

export default AdminSidebar
