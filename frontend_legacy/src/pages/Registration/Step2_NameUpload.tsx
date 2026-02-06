import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerStep2 } from "../../api/auth";

export default function Step2_NameUpload() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const userId = localStorage.getItem("userId");
    if (!userId) {
      setError("Kein UserId gefunden – bitte Step 1 erneut durchführen.");
      return;
    }

    if (!file) {
      setError("Bitte ein PDF auswählen.");
      return;
    }

    setLoading(true);

    try {
      // FullName speichern wir (noch) lokal im Browser;
      // Backend-Validierung können wir später ergänzen.
      localStorage.setItem("fullName", fullName);

      await registerStep2(userId, file);
      navigate("/register/step3");
    } catch (err: any) {
      setError(err.message || "Step 2 fehlgeschlagen.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Step 2 – Name & Ausweisdokument</h2>

        <form onSubmit={handleSubmit} style={styles.form as any}>
          <label style={styles.label}>
            Vollständiger Name (wie im Ausweis)
            <input
              style={styles.input as any}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            PDF-Ausweisdokument
            <input
              style={styles.input as any}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              required
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.button as any} disabled={loading}>
            {loading ? "Upload läuft..." : "Weiter zu Step 3"}
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
