import { useState } from "react";

const Registration = () => {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) return setMessage("Bitte Name eingeben.");
    if (!file) return setMessage("Bitte eine Datei hochladen.");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setMessage(data.message || "Registrierung erfolgreich.");
    } catch (err) {
      console.error(err);
      setMessage("Fehler beim Hochladen.");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Registrierung</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Dein Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <input
          type="file"
          onChange={handleFileChange}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <button type="submit" style={{ width: "100%", padding: "10px" }}>
          Registrieren
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
};

export default Registration;
