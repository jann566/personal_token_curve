import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerStep3 } from "../../api/auth";

export default function Step3_Wallet() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const userId = localStorage.getItem("userId");
    if (!userId) {
      setError("Kein UserId gefunden – bitte Step 1 erneut durchführen.");
      return;
    }

    if (!wallet) {
      setError("Bitte Phantom-Wallet-Adresse eingeben.");
      return;
    }

    setLoading(true);

    try {
      await registerStep3(userId, wallet);
      navigate("/claim");
    } catch (err: any) {
      setError(err.message || "Step 3 fehlgeschlagen.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Step 3 – Wallet verbinden</h2>

        <form onSubmit={handleSubmit} style={styles.form as any}>
          <label style={styles.label}>
            Phantom Wallet Adresse (Solana)
            <input
              style={styles.input as any}
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              required
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button as any} disabled={loading}>
            {loading ? "Speichere..." : "Registrierung abschließen"}
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
    maxWidth: "480px",
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
    background: "#00d18b",
    color: "black",
    fontSize: "16px",
    cursor: "pointer",
  },
  error: {
    color: "#ff4d4d",
    fontSize: "14px",
  },
};
