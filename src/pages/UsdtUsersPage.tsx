import { useCallback, useEffect, useState } from "react"
import { Globe2, RefreshCw, ShieldAlert } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface UsdtUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  /** "USDT" for an international account; "BTN" for a Bhutanese one holding a USDT wallet. */
  nativeCurrency: string
  kycStatus: "none" | "pending" | "approved" | "rejected"
  createdAt: string
  usdtBalance: string
  deposited: string
  staked: string
  withdrawn: string
  /** Approved and sent to 21 Pay, not yet confirmed on chain. */
  inFlight: string
  pendingWithdrawal: string
  pendingWithdrawalCount: string
}

interface Totals {
  accounts: number
  held: number
  deposited: number
  withdrawn: number
  inFlight: number
  pendingWithdrawal: number
}

const money = (v: string | number) =>
  `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

/**
 * International accounts — the USDT side of the book.
 *
 * Deliberately separate from User Management, which is built around the DK
 * Bank rail: CID, account name, reputation. None of that exists for someone
 * who funds over a chain, and none of what matters here — in, held, out —
 * appears there.
 */
export default function UsdtUsersPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [users, setUsers] = useState<UsdtUser[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await api.getUsdtUsers(200)
      setUsers(res?.users ?? [])
      setTotals(res?.totals ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Globe2 size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          International accounts
        </h1>
        <button onClick={() => void refresh()} style={ghost}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {error && (
        <div style={errorBox}>
          <ShieldAlert size={16} /> <span>{error}</span>
        </div>
      )}

      {totals && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Stat label="Accounts" value={String(totals.accounts)} />
          {/* What we owe: every dollar sitting in a user balance. */}
          <Stat
            label="Held for users"
            value={money(totals.held)}
            accent="#2563eb"
          />
          <Stat label="Deposited" value={money(totals.deposited)} />
          <Stat label="Withdrawn" value={money(totals.withdrawn)} />
          {/* Approved and handed to 21 Pay, not yet confirmed on chain — the
              window where a payout can still fail. */}
          <Stat
            label="In flight"
            value={money(totals.inFlight)}
            accent="#f59e0b"
          />
          <Stat
            label="Awaiting approval"
            value={money(totals.pendingWithdrawal)}
            accent={totals.pendingWithdrawal > 0 ? "#dc2626" : undefined}
          />
        </div>
      )}

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr>
              {[
                "Account",
                "Type",
                "KYC",
                "Balance",
                "In",
                "Staked",
                "Out",
                "Pending",
                "Joined",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const name =
                [u.firstName, u.lastName].filter(Boolean).join(" ") || "—"
              const pending = Number(u.pendingWithdrawal || 0)
              return (
                <tr
                  key={u.id}
                  style={{ borderTop: "1px solid var(--border, #2a2a2a)" }}
                >
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>
                      {u.email ?? u.id.slice(0, 8)}
                    </div>
                  </td>
                  <td style={td}>
                    {/* A Bhutanese account with a USDT wallet is a different
                        thing from an international one, and the distinction
                        matters when money has to be traced back to a rail. */}
                    <span style={pill}>
                      {u.nativeCurrency === "USDT"
                        ? "International"
                        : "BTN + USDT"}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={kycStyle(u.kycStatus)}>{u.kycStatus}</span>
                  </td>
                  <td style={{ ...td, fontWeight: 800 }}>
                    {money(u.usdtBalance)}
                  </td>
                  <td style={td}>{money(u.deposited)}</td>
                  <td style={td}>{money(u.staked)}</td>
                  <td style={td}>
                    {money(u.withdrawn)}
                    {Number(u.inFlight) > 0 && (
                      <span style={{ color: "#f59e0b", fontSize: 11 }}>
                        {" "}
                        +{money(u.inFlight)} in flight
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      ...td,
                      color: pending > 0 ? "#dc2626" : undefined,
                    }}
                  >
                    {pending > 0
                      ? `${money(pending)} (${u.pendingWithdrawalCount})`
                      : "—"}
                  </td>
                  <td style={{ ...td, opacity: 0.7 }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {users.length === 0 && !error && (
          <p style={{ padding: 16, fontSize: 13, opacity: 0.7 }}>
            No account holds or has moved USDT yet.
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div style={{ ...card, padding: "10px 14px", minWidth: 130, gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.65 }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color: accent }}>
        {value}
      </span>
    </div>
  )
}

function kycStyle(status: string): React.CSSProperties {
  const colour =
    status === "approved"
      ? "#16a34a"
      : status === "pending"
        ? "#f59e0b"
        : status === "rejected"
          ? "#dc2626"
          : "inherit"
  return {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: colour,
  }
}

const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  border: "1px solid var(--border, #2a2a2a)",
  borderRadius: 12,
  padding: 16,
  background: "var(--card, rgba(255,255,255,0.02))",
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  opacity: 0.6,
  whiteSpace: "nowrap",
}

const td: React.CSSProperties = { padding: "10px 12px", whiteSpace: "nowrap" }

const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid var(--border, #2a2a2a)",
}

const ghost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  borderRadius: 9,
  border: "1px solid var(--border, #2a2a2a)",
  background: "transparent",
  color: "inherit",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  marginLeft: "auto",
}

const errorBox: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  background: "rgba(220,38,38,0.08)",
  border: "1px solid rgba(220,38,38,0.3)",
}
