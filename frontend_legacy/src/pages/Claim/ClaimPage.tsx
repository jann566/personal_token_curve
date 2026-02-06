import { useState } from "react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";

export default function ClaimPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const connectPhantom = async () => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const adapter = new PhantomWalletAdapter();
      await adapter.connect();

      if (!adapter.publicKey) throw new Error("Keine Wallet gefunden.");

      const address = adapter.publicKey.toString();
      setWallet(address);

      localStorage.setItem("user_wallet", address);
      setMessage("Wallet erfolgreich verbunden.");
    } catch (err: any) {
      setError(err.message || "Wallet-Verbindung fehlgeschlagen.");
    }

    setLoading(false);
  };

  const claimToken = async () => {
    if (!wallet) {
      setError("Bitte zuerst Wallet verbinden.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      // ✔ FIX: LocalStorage Key korrigiert
      const userId = localStorage.getItem("userId");

      if (!userId) throw new Error("User ID fehlt. Bitte neu einloggen.");

      const res = await fetch("http://localhost:5000/user/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, walletAddress: wallet }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setMessage("Token erfolgreich geclaimed! 🎉");
      }
    } catch (err: any) {
      setError(err.message || "Claim fehlgeschlagen.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Claim Your Token</h1>

      <p style={styles.subtitle}>
        Verbinde deine Wallet und claim deinen persönlichen Token.
      </p>

      {!wallet && (
        <button style={styles.walletBtn} onClick={connectPhantom} disabled={loading}>
          {loading ? "Verbinde..." : "Mit Phantom verbinden"}
        </button>
      )}

      {wallet && (
        <div style={styles.walletBox}>
          <strong>Wallet:</strong> {wallet}
        </div>
      )}

      {wallet && (
        <button style={styles.claimBtn} onClick={claimToken} disabled={loading}>
          {loading ? "Claiming..." : "Token claimen"}
        </button>
      )}

      {message && <div style={styles.message}>{message}</div>}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles = {
  container: {
    background: "#0f0f0f",
    color: "white",
    height: "100vh",
    padding: 40,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#aaa",
    marginBottom: 30,
  },
  walletBtn: {
    background: "#8247e5",
    padding: "12px 26px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    color: "white",
    fontSize: 16,
  },
  claimBtn: {
    background: "#00d18b",
    padding: "12px 26px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    color: "black",
    fontSize: 16,
    marginTop: 20,
  },
  walletBox: {
    background: "#1b1b1b",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    border: "1px solid #333",
  },
  message: {
    marginTop: 20,
    color: "#00d18b",
  },
  error: {
    marginTop: 20,
    color: "red",
  },
};
