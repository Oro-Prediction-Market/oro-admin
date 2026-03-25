import React, { useEffect, useState, useCallback } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { User, Shield, ShieldOff } from "lucide-react"

const UserManagement: React.FC = () => {
  const token = localStorage.getItem("admin_token")
  const api = useAdminApi(token)
  const [users, setUsers] = useState<any[]>([])
  const [fetching, setFetching] = useState(false)

  const fetchUsers = useCallback(async () => {
    setFetching(true)
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (e: any) {
      console.error("Failed to fetch users", e)
    } finally {
      setFetching(false)
    }
  }, [api])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      await api.toggleAdmin(userId, !currentStatus)
      fetchUsers()
    } catch (e: any) {
      alert(`Error toggling admin status: ${e.message}`)
    }
  }

  return (
    <div className="user-management">
      <h2 style={{ marginBottom: "2rem" }}>User Management</h2>

      <div className="glass-card" style={{ padding: 0 }}>
        {fetching && users.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>
            Retrieving user records...
          </div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Telegram ID</th>
                <th>Balance</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                   <td colSpan={5} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", padding: "3rem" }}>No users found.</td>
                </tr>
              ) : (
                users.map((user: any) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                         <div style={{
                           width: "32px",
                           height: "32px",
                           borderRadius: "50%",
                           background: "hsla(180, 100%, 50%, 0.1)",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           color: "hsl(var(--primary))"
                         }}>
                           <User size={16} />
                         </div>
                         <div>
                            <div style={{ fontWeight: 600 }}>{user.firstName || "Anonymous"} {user.lastName || ""}</div>
                            <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>ID: {user.id.slice(0, 8)}...</div>
                         </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{user.telegramId}</td>
                    <td style={{ fontWeight: 600 }}>${parseFloat(user.balance || 0).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${user.isAdmin ? "badge-resolved" : "badge-upcoming"}`}>
                         {user.isAdmin ? "ADMIN" : "USER"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                        className="secondary"
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem" }}
                        disabled={api.loading}
                      >
                        {user.isAdmin ? (
                          <>
                            <ShieldOff size={14} /> Demote
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> Promote
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default UserManagement
