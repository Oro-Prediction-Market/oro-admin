import { useState } from "react"
import { Wrench } from "lucide-react"
import AdjustmentsPanel from "../components/AdjustmentsPanel"
import ResettlePanel, {
  RESETTLE_PREFILL_KEY,
} from "../components/ResettlePanel"

type Tab = "wallet" | "resettle"

/**
 * Money corrections, done through the app instead of SQL against production.
 * Every change here is recorded with who made it and why.
 */
export default function CorrectionsPage() {
  // Arriving from the settlement audit's "Correct…" opens the re-settle tab.
  const [tab, setTab] = useState<Tab>(() => {
    try {
      return sessionStorage.getItem(RESETTLE_PREFILL_KEY)
        ? "resettle"
        : "wallet"
    } catch {
      return "wallet"
    }
  })
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}
        >
          <Wrench size={22} /> Corrections
        </h2>
        <p
          style={{
            margin: "6px 0 0",
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.875rem",
          }}
        >
          Credits and corrections, recorded with who made them and why. Users
          are not messaged.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={tab === "wallet" ? "" : "secondary"}
          onClick={() => setTab("wallet")}
        >
          Wallet credits &amp; debits
        </button>
        <button
          className={tab === "resettle" ? "" : "secondary"}
          onClick={() => setTab("resettle")}
        >
          Re-settle a market
        </button>
      </div>
      {tab === "wallet" && <AdjustmentsPanel />}
      {tab === "resettle" && <ResettlePanel />}
    </div>
  )
}
