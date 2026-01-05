import { useEffect, useState } from "react";

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // ------- USERS LADEN -------
  const loadUsers = async () => {
    setLoading(true);

    const res = await fetch("http://localhost:5000/admin/users");
    const data = await res.json();

    // Backend liefert ein ARRAY → korrekt einlesen!
    setUsers(Array.isArray(data) ? data : []);

    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // ------- USER APPROVEN -------
  const approveUser = async (userId: string) => {
    const res = await fetch("http://localhost:5000/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    const data = await res.json();

    if (data.mintAddress) {
      setMessage(`User approved! Mint: ${data.mintAddress}`);
      await loadUsers();
    } else {
      setMessage("Fehler beim Freigeben.");
    }
  };

  if (loading) return <h2 style={{ color: "white" }}>Lade Benutzer...</h2>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Admin Panel</h1>

      {message && <div style={styles.message}>{message}</div>}

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Wallet</th>
            <th>Dokument</th>
            <th>Aktion</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.email}</td>

              <td>
                {u.isApproved ? (
                  <span style={{ color: "#00d18b" }}>Freigegeben</span>
                ) : (
                  <span style={{ color: "yellow" }}>Wartet</span>
                )}
              </td>

              <td>{u.phantomWallet || "-"}</td>

              <td>
                {u.idDocumentPath ? (
                  <a
                    href={`http://localhost:5000/${u.idDocumentPath}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF öffnen
                  </a>
                ) : (
                  "Kein Dokument"
                )}
              </td>

              <td>
                {!u.isApproved && (
                  <button
                    style={styles.approveBtn}
                    onClick={() => approveUser(u._id)}
                  >
                    Freigeben
                  </button>
                )}

                {u.isApproved && <span>✓</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles: any = {
  container: {
    background: "#0f0f0f",
    color: "white",
    minHeight: "100vh",
    padding: 40,
  },
  title: {
    fontSize: 32,
    marginBottom: 20,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  approveBtn: {
    background: "#00d18b",
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    color: "black",
  },
  message: {
    margin: "10px 0",
    color: "#00d18b",
  },
};
