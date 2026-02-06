# 🏗️ Frontend-Architektur Neuorganisation

## Neue Seitenstruktur (Global Navigation)

```
/                    → Home (Landing Page)
/login               → Login (existing user)
/register            → Register (new user, 3-step flow)
/profile             → Profile (user's token + Claim)
/dashboard           → Dashboard (Portfolio view)
/explore             → Explore (Token Discovery + Watchlist)
/token/:mint         → Token Detail (Trade + Info)
```

---

## Seiten-Details

### 1. **Home** (`/`)
- **Zweck:** Landing Page / Einstiegspunkt
- **Inhalte:**
  - Hero Section mit CTA
  - Features (Linear Pricing, Secure Swaps, Transparent Fees)
  - Ready-to-Start CTA Section
- **Navigation:**
  - Nicht verbunden: "Get Started" → `/register` + "Login" → `/login`
  - Verbunden: "My Profile" → `/profile` + "Explore Tokens" → `/explore`
- **Keine Logik:** Rein informativ

### 2. **Login** (`/login`)
- **Zweck:** Für bestehende Benutzer zum Einloggen
- **Anforderungen:**
  - Email-Input
  - Wallet-Verbindung (Voraussetzung)
  - Speichert `registerUserId` in localStorage
  - Redirect → `/profile` nach erfolgreicher Anmeldung
- **Unterschied zu Register:** Einfacherer Flow, keine multi-step

### 3. **Register** (`/register`)
- **Zweck:** Multi-step Registrierung (bestehend)
- **Schritte:**
  - Step 1: Email
  - Step 2: Wallet-Adresse (multipart form)
  - Step 3: Phantom Wallet (Phantom.signMessage())
- **Nach Erfolg:**
  - userId in localStorage speichern
  - Redirect → `/profile`
- **Unverändert:** Funktioniert bereits

### 4. **Profile** (`/profile`)
- **Zweck:** Zentrale Seite des Benutzers für seinen Token + Claim
- **Inhalte:**
  - **A) Eigener Token Section:**
    - Name, Symbol, Mint Address
    - Aktueller Preis (Mock-Chart)
    - Kursverlauf (24h Chart)
  - **B) Claim-Status & Button:**
    - Wenn `approved === false`: "⏳ Waiting for approval" (Button disabled)
    - Wenn `approved === true && claimed === false`: "Claim Tokens" Button (aktiv)
    - Wenn `claimed === true`: "✅ Tokens Claimed" (Button weg)
  - **C) Token-Profil-Editor:**
    - Token Name, Symbol
    - Beschreibung (Textarea)
    - Website, Twitter Links
    - Nur für eigenen Token editierbar
- **Logik:**
  - Polling `/user/status/:userId` (5s Intervall)
  - Popup bei Approval (bereits existierend)
  - Claim nur einmalig möglich
- **Wichtig:** Claim-Button ist einmalig + verschwindet nach erfolgreicher Nutzung

### 5. **Dashboard** (`/dashboard`)
- **Zweck:** Portfolio-Übersicht (NICHT für Trading)
- **Inhalte:**
  - **Portfolio Summary:**
    - Total Portfolio Value
    - 24h Change (%)
    - Number of Holdings
  - **Holdings List:**
    - Token Name, Symbol
    - Amount, Price, Value
    - 24h Change (%)
    - Link zu `/token/:mint` View
- **Keine Trading-UI:** Kauf/Verkauf passiert in `/token/:mint`
- **Rein Portfolio-View**

### 6. **Explore** (`/explore`)
- **Zweck:** Token-Discovery + Watchlist Management
- **Tabs:**
  - **All Tokens:** Suchbar, Sortierbar
  - **Watchlist:** User's markierte Tokens
- **Features:**
  - Search (Name, Symbol)
  - Add/Remove from Watchlist (⭐ Button)
  - Link zu `/token/:mint` View
- **Keine Trading hier:** Links zu Token Detail
- **Watchlist:** In localStorage (für diese Session)

### 7. **Token Detail** (`/token/:mint`)
- **Zweck:** Einzelnen Token anschauen + Trading Einstiegspunkt
- **Inhalte:**
  - **Token Info:**
    - Price (Live)
    - 24h Change
    - Supply, Holders, Volume
    - Description
  - **24h Price Chart**
  - **Trading UI:**
    - Buy/Sell Tabs
    - Amount Input
    - Estimated Output
    - Fee Display
    - Execute Button
  - **Watchlist Button**
- **Trading:** Hier findet Kauf/Verkauf statt (nicht in Dashboard)
- **Mock Data:** Für diese Session verwendet

---

## Komponenten & API

### Header Navigation (aktualisiert)
```
Home | Profile | Portfolio | Explore | [Wallet Button]
```

### Claim Button
- **Location:** 
  - Header (oben rechts, neben Wallet, nur auf small+ breakpoint)
  - Profile Page (prominent)
- **Sichtbarkeit:** `approved && !claimed`
- **Verhalten:** Klick → Claim-API Call → Status aktualisieren → Button verschwindet

### Status Modal
- **Trigger:** Wenn Admin genehmigt hat (bei Poll)
- **Content:** "Admin approved!" + "Claim Tokens Now" Button
- **Auto-close:** Nach 8 Sekunden (wenn approved)

---

## Datenfluss

### Registration → Claim
```
1. User registriert sich (/register, 3 Steps)
2. userId in localStorage gespeichert
3. User wartet auf Admin-Approval
4. Poll: /user/status/:userId zeigt approved=true
5. Modal poppt auf + Claim Button erscheint oben
6. User klickt "Claim Token"
7. POST /user/claim { userId }
8. Backend minted Token + sendet ATA Address
9. UI zeigt "✅ Tokens claimed" + Button verschwindet
```

### Admin Approval
- Admin öffnet `/admin.html` (separate UI, nicht Teil dieser App)
- Admin ruft GET /admin/users auf
- Admin ruft POST /admin/approve {userId} auf
- Benutzer sieht sofort Änderung (nächster Poll)

---

## Technische Notes

### Routes (App.tsx)
```tsx
<Route path="/" element={<HomePage />} />
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/profile" element={<ProfilePage />} />
<Route path="/dashboard" element={<DashboardPage />} />
<Route path="/explore" element={<ExplorePage />} />
<Route path="/token/:mint" element={<TokenDetailPage />} />
```

### localStorage Keys
- `registerUserId` — User ID (gesetzt nach Registration/Login)

### API Endpoints (verwendet)
- `POST /auth/register/step1` — Email
- `POST /auth/register/step2` — Wallet
- `POST /auth/register/step3` — Sign Message
- `GET /user/status/:userId` — Poll Status
- `POST /user/claim` — Claim Token
- `GET /admin/users` — Admin: alle User
- `POST /admin/approve` — Admin: User freigeben

### Vite Proxy (dev)
```
/auth → http://localhost:5000
/user → http://localhost:5000
/admin → http://localhost:5000
/registry → http://localhost:5000
```

---

## Definition of Done ✅

- ✅ Klare Trennung: Profile vs Dashboard vs Explore
- ✅ Claim-Flow ausschließlich im Profile
- ✅ Token-Metadaten editierbar (nur eigener Token)
- ✅ Login & Register koexistieren
- ✅ Saubere, skalierbare Seitenstruktur
- ✅ Routes in App.tsx aktualisiert
- ✅ Header Navigation aktualisiert
- ✅ Claim Button oben + Profile Page
- ✅ Admin UI ist NICHT Teil dieser App (separate `/admin.html`)
- ✅ No User sieht Admin Actions in Public App

---

## Nächste Schritte (optional)

1. **Backend-Integration:** Endpoint für Token-Profil Speichern (`PUT /token/profile`)
2. **Watchlist Persistenz:** Speichern in DB statt localStorage
3. **Echte Token-Daten:** Statt Mock-Data von Blockchain/API fetchen
4. **Live Charts:** Real-time Preisdaten integrieren
5. **Mobile Responsiveness:** Optimieren für alle Breakpoints
