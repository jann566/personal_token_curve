import React, { useEffect, useState } from "react";

interface IUser {
  id: string;
  name: string;
  filePath: string;
  token: string | null;
}

const Admin = () => {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await fetch("http://localhost:5000/admin/users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (id: string) => {
    await fetch("http://localhost:5000/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    loadUsers();
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (loading) return <p>Lade Benutzer…</p>;

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2>Admin Panel</h2>

      {users.length === 0 ? (
        <p>Keine Nutzer gefunden.</p>
      ) : (
        <ul>
          {users.map((u) => (
            <li
              key={u.id}
              style={{
                padding: "15px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                marginBottom: "10px",
              }}
            >
              <strong>{u.name}</strong>
              <br />

              <a
                href={`http://localhost:5000/${u.filePath}`}
                target="_blank"
                rel="noreferrer"
              >
                Datei öffnen
              </a>
              <br />

              Status:{" "}
              {u.token ? (
                <span style={{ color: "green" }}>Freigeschaltet ✔</span>
              ) : (
                <span style={{ color: "red" }}>Nicht freigeschaltet</span>
              )}

              {!u.token && (
                <button
                  style={{ marginTop: "10px" }}
                  onClick={() => approveUser(u.id)}
                >
                  Freischalten
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Admin;
