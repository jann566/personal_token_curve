export default function RegistrationPage() {
  return (
    <div
      style={{
        background: "#050505",
        color: "white",
        minHeight: "100vh",
        padding: "40px",
      }}
    >
      <h1>Personal Token Registration</h1>
      <p>
        Bitte benutze die direkten Schritte:
      </p>
      <ul>
        <li>/register/step1 – E-Mail & Passwort</li>
        <li>/register/step2 – Name & PDF Upload</li>
        <li>/register/step3 – Wallet verbinden</li>
      </ul>
    </div>
  );
}
