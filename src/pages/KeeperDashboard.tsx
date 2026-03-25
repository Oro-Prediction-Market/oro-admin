import React, { useState } from "react"
import { Play, Pause, RefreshCw, Activity, Terminal, CheckCircle, AlertCircle } from "lucide-react"

const KeeperDashboard: React.FC = () => {
  const [isActive, setIsActive] = useState(true)
  const [logs, setLogs] = useState([
    { id: 1, time: "14:22:15", type: "info", icon: <CheckCircle size={14} color="#4CAF50" />, msg: "Expiry Watcher: Scanning 12 open markets..." },
    { id: 2, time: "14:22:16", type: "success", icon: <CheckCircle size={14} color="#4CAF50" />, msg: "Detected expiry: BTC-Price-MAR-24. Attempting closure..." },
    { id: 3, time: "14:22:18", type: "success", icon: <CheckCircle size={14} color="#4CAF50" />, msg: "✅ Market BTC-Price-MAR-24 successfully CLOSED." },
    { id: 4, time: "15:05:00", type: "info", icon: <Activity size={14} color="#2196F3" />, msg: "Liquidity Bot: Placing drift bet on 'ETH-Upgrade'..." },
  ])

  const toggleKeeper = () => setIsActive(!isActive)
  
  const runManual = (keeperName: string) => {
    const newLog = { 
      id: Date.now(), 
      time: new Date().toLocaleTimeString().split(" ")[0], 
      type: "info", 
      icon: <RefreshCw size={14} />, 
      msg: `Manual trigger: Running ${keeperName}...` 
    }
    setLogs([newLog, ...logs])
  }

  return (
    <div className="keeper-dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h2>Keeperbot Management</h2>
          <p style={{ color: "hsl(var(--muted-foreground))" }}>
            Automated lifecycle management and liquidity drift monitoring.
          </p>
        </div>
        <button 
          onClick={toggleKeeper}
          className={isActive ? "" : "secondary"}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.5rem" }}
        >
          {isActive ? <><Pause size={18} /> Stop All Service</> : <><Play size={18} /> Start All Service</>}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
        <div className="glass-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
             <h3 style={{ margin: 0, fontSize: "1rem" }}>System Status</h3>
             <span className={`badge badge-${isActive ? "open" : "closed"}`}>
                {isActive ? "Operational" : "Offline"}
             </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", borderRadius: "8px", background: "hsl(var(--secondary) / 0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Activity size={18} color="#4CAF50" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Expiry Watcher</div>
                  <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>Closes markets at deadline</div>
                </div>
              </div>
              <button className="secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }} onClick={() => runManual("ExpiryWatcher")}>Run Now</button>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", borderRadius: "8px", background: "hsl(var(--secondary) / 0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Activity size={18} color="#2196F3" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Liquidity Bot</div>
                  <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>Places random drift bets</div>
                </div>
              </div>
              <button className="secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }} onClick={() => runManual("LiquidityBot")}>Run Now</button>
            </div>

             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem", borderRadius: "8px", background: "hsl(var(--secondary) / 0.5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <AlertCircle size={18} color="#FF9800" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Resolution Guard</div>
                  <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>Awaits external result verify</div>
                </div>
              </div>
              <button className="secondary" style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }} onClick={() => runManual("ResolutionGuard")}>Run Now</button>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
             <h3 style={{ margin: 0, fontSize: "1rem" }}>Execution Logs</h3>
             <Terminal size={18} color="hsl(var(--muted-foreground))" />
          </div>
          <div style={{ 
            flex: 1, 
            background: "#0a0a0a", 
            borderRadius: "8px", 
            padding: "1rem", 
            fontFamily: "monospace", 
            fontSize: "0.75rem", 
            overflowY: "auto",
            maxHeight: "300px"
          }}>
            {logs.map(log => (
              <div key={log.id} style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem" }}>
                <span style={{ color: "#444" }}>[{log.time}]</span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  {log.icon} {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default KeeperDashboard
