# Admin-Dokumentation

## Überblick

Das Admin-Interface wurde aus der öffentlichen User-Website entfernt und als separate, private HTML-Seite bereitgestellt.

### Admin Panel Zugänge

**Option 1: Lokale HTML-Datei (empfohlen für Entwicklung)**

Die Admin-Seite ist unter folgendem Pfad verfügbar:

```
frontend_v2/public/admin.html
```

**Direkt öffnen:**
- Starten Sie den Frontend Dev-Server: `npm run dev` in `frontend_v2/`
- Öffnen Sie im Browser: `http://localhost:5173/admin.html`

**Option 2: Terminal (curl)**

Siehe unten.

## Admin-Panel Funktionen

### 1. User-Liste abrufen

Zeigt alle registrierten User mit Status:

- **Email**: Registrierte E-Mail
- **Status**: Pending / Approved / Claimed
- **Phantom Wallet**: Gespeicherte Wallet-Adresse
- **Minted**: Ist das Token-Mint erstellt worden?
- **Claimed**: Hat der User Tokens geclaimt?
- **Action**: Approve-Button (nur bei Step 3 & nicht approved)

### 2. User approven

Admin klickt auf "Approve"-Button:

- Backend führt `approveUserFlow` aus:
  - Token-Mint wird erstellt
  - ATA (Associated Token Account) wird erstellt
  - `approved = true` wird gespeichert
- Frontend des Users erkennt die Änderung (Polling alle 5 Sekunden):
  - Modal-Popup: "Admin has approved your registration"
  - Claim-Button wird sichtbar

### 3. API Base URL konfigurieren

Falls Backend auf anderem Host/Port läuft:

1. Geben Sie in der Admin-Seite die korrekte URL ein (z.B. `http://localhost:5000`)
2. Die URL wird in localStorage gespeichert und bleibt erhalten

## Terminal / curl (Alternative)

Falls Sie lieber über Terminal arbeiten:

### Users abrufen

```bash
curl -s http://localhost:5000/admin/users | jq
```

### Einen User approven

```bash
curl -X POST http://localhost:5000/admin/approve \
  -H "Content-Type: application/json" \
  -d '{"userId":"<userId>"}'
```

Ersetzen Sie `<userId>` durch die 24-stellige MongoDB ObjectId aus der User-Liste.

## User-seitige Erfahrung

### Registrierung abgeschlossen

Nach erfolgreichem Step 3 sieht der User auf dem Dashboard:

```
⏳ Waiting for Admin Approval
Your registration is complete. Please wait for admin to approve your account.
```

### Nach Admin-Approval (automatisch erkannt)

Innerhalb von 5 Sekunden zeigt das Dashboard:

**Modal-Popup:**
```
✅ Admin Decision Received
Admin has approved your registration! You can now claim your tokens.
[Claim Tokens Now] [Close]
```

Danach sieht der User:

```
✅ You are approved! Claim your airdrop tokens now.
[Claim Tokens]
```

### Nach Token Claim

```
✅ Tokens Claimed
Your tokens are in your wallet on Solana Devnet.
```

Die Token sind dann im Phantom-Wallet sichtbar.

## Sicherheitshinweise

⚠️ Das Admin-Interface hat **keine Authentifizierung**.

Produktionsbereitstellung:
- Das Admin-Interface sollte nicht auf öffentlich erreichbaren Servern deployed werden
- Für Produktion:
  - Passwort-Schutz hinzufügen
  - IP-Whitelist
  - Oder nur über VPN/SSH-Tunnel zugänglich machen

Für Entwicklung reicht lokal ausführen.

## Workflow (Schritt-für-Schritt)

1. **User registriert sich im Frontend** (http://localhost:5173/register)
   - Step 1: E-Mail + Passwort
   - Step 2: PDF hochladen
   - Step 3: Phantom Wallet Adresse
   - ✅ "Registrierung abgeschlossen"

2. **User sieht auf Dashboard**
   - ⏳ "Waiting for Admin Approval"

3. **Admin öffnet Admin-Panel** (http://localhost:5173/admin.html)
   - Sieht User in der Liste mit Status "Pending"
   - Klickt "Approve"
   - ✅ Success-Message: "User approved! Mint created: ..."

4. **User Dashboard aktualisiert automatisch** (Polling alle 5s)
   - Modal-Popup: "Admin Decision Received"
   - Status ändert sich zu "You are approved! Claim your airdrop tokens now"

5. **User klickt "Claim Tokens"**
   - Backend transferiert Tokens ins Phantom-Wallet
   - ✅ Success: "Tokens claimed successfully!"
   - Dashboard zeigt: "✅ Tokens Claimed"

6. **User sieht Tokens im Phantom-Wallet** (Solana Devnet)

## Troubleshooting

### "Failed to load users" Fehler

**Ursache**: Backend läuft nicht oder API Base URL falsch.

**Lösung**:
```bash
# Terminal 1: Backend
cd backend
npm run dev
# Sollte zeigen: "Server läuft auf http://localhost:5000"
```

Dann Admin-Panel neuladen und sicherstellen, dass "API Base URL" = `http://localhost:5000`

### User wird nicht approved

**Überprüfen Sie**:
1. Ist der User im Admin-Panel sichtbar? (Status "Pending")
2. Ist der Button "Approve" aktiv? (nur bei registrationStep === 3)
3. Gibt es einen Fehler-Log im Admin-Panel?

### User sieht "Waiting for Admin Approval" nicht verschwindet

**Ursachen**:
- Polling ist zu langsam (5s Intervall)
- Manueller Refresh hilft: F5 im Browser drücken

**Schnelle Lösung**: Admin-Approval, dann User drückt F5 im Dashboard

---

## Architektur-Übersicht

```
Frontend (öffentlich unter http://localhost:5173/)
├── /register        ← User Registrierung
├── /dashboard       ← User Dashboard + Status Polling + Claim Button
├── /                ← Home
└── /admin.html      ← Admin-Panel (private HTML, nicht geroutet)
                        Zugriff: http://localhost:5173/admin.html

Backend (http://localhost:5000/)
├── POST /auth/register/step1
├── POST /auth/register/step2
├── POST /auth/register/step3
├── GET  /admin/users            ← Admin Panel liest von hier
├── POST /admin/approve          ← Admin Panel schreibt hier
├── GET  /user/status/:userId    ← User Dashboard pollt diese Endpoint
└── POST /user/claim             ← User klickt "Claim Tokens"
```

---

**Status**: ✅ Admin aus User-Website entfernt, Realtime Approval-Feedback eingebaut, volle UI-Integration.
