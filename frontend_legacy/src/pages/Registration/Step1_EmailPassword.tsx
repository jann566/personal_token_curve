import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerStep1 } from "../../api/auth";

export default function Step1_EmailPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await registerStep1(email, password);
      // userId vom Backend in localStorage speichern
      localStorage.setItem("userId", res.userId);
      navigate("/register/step2");
    } catch (err: any) {
      setError(err.message || "Etwas ist schiefgelaufen.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Step 1 – E-Mail & Passwort</h2>
        <form onSubmit={handleSubmit} style={styles.form as any}>
          <label style={styles.label}>
            E-Mail
            <input
              style={styles.input as any}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            Passwort
            <input
              style={styles.input as any}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button as any} disabled={loading}>
            {loading ? "Sende..." : "Weiter zu Step 2"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "#050505",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
  },
  card: {
    background: "#111",
    padding: "32px",
    borderRadius: "16px",
    boxShadow: "0 0 40px rgba(0,0,0,0.6)",
    width: "100%",
    maxWidth: "420px",
  },
  title: {
    fontSize: "24px",
    marginBottom: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontSize: "14px",
    gap: "4px",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #333",
    background: "#050505",
    color: "white",
  },
  button: {
    marginTop: "8px",
    padding: "12px 16px",
    borderRadius: "10px",
    border: "none",
    background: "#8247e5",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
  },
  error: {
    color: "#ff4d4d",
    fontSize: "14px",
  },
};
