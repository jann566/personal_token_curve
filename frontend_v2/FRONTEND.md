# Token Bonding Curve Frontend (v2)

Ein modernes, reaktives Frontend für die Token Bonding Curve Plattform, gebaut mit **Vite**, **React**, **TypeScript** und **Tailwind CSS**.

## Features

✨ **Moderne UI** mit Tailwind CSS
🔗 **Solana Wallet Integration** (Phantom, etc.)
📊 **Interaktive Charts** mit Recharts
💱 **Token Swap Interface** mit Live-Quotes
📱 **Responsive Design** für alle Geräte
🔐 **Multi-Step Registrierung** mit Verifizierung
⚡ **Vite für schnelle Entwicklung**

## Installation

```bash
# Dependencies installieren
npm install

# Environment konfigurieren
cp .env.example .env.local
# Öffne .env.local und konfiguriere VITE_API_URL
```

## Entwicklung

```bash
# Dev Server starten
npm run dev

# Öffne http://localhost:5173 im Browser
```

## Production Build

```bash
npm run build
npm run preview
```

## Projektstruktur

```
src/
├── api/              # API Service Layer
│   ├── auth.ts      # Authentifizierung
│   ├── user.ts      # User/Claim Endpoints
│   └── hub.ts       # Token Swap Endpoints
├── components/      # Wiederverwendbare Komponenten
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Header.tsx
│   └── Layout.tsx
├── pages/           # Seiten/Routes
│   ├── Home.tsx     # Landingpage
│   ├── Register.tsx # Registrierung (3 Steps)
│   └── Dashboard.tsx # Token Swap Dashboard
├── App.tsx          # Hauptkomponente + Router
└── main.tsx         # Entry Point
```

## Seiten

### 🏠 Home (`/`)
- Landingpage mit Feature-Übersicht
- "How it works" Anleitung
- Links zu Register und Dashboard

### 📝 Register (`/register`)
**Dreistufiger Registrierungsprozess:**

1. **Schritt 1**: Email & Username
   - Eingabe validieren
   - Backend-Validierung
   - UserId erhalten

2. **Schritt 2**: Dokument-Upload
   - PDF-Datei hochladen
   - Verifizierung

3. **Schritt 3**: Nutzungsbedingungen
   - AGBs akzeptieren
   - Registrierung abschließen

### 📊 Dashboard (`/dashboard`)
**Nur mit verbundenem Wallet erreichbar**

Features:
- **Token Selection**: Verfügbare Tokens anzeigen
- **24h Chart**: Preisentwicklung
- **Bonding Curve Graph**: Lineares Preismodell visualisieren
- **Swap Interface**: 
  - Betrag eingeben
  - Geschätzte Ausgabe berechnen
  - Gebühren anzeigen
  - Swap ausführen
- **Claim Airdrop**: Token-Anspruch

## Komponenten

### Button
```tsx
<Button 
  variant="primary" | "secondary" | "success" | "danger"
  size="sm" | "md" | "lg"
  loading={boolean}
  onClick={() => {}}
>
  Click me
</Button>
```

### Input
```tsx
<Input 
  label="Field Name"
  type="email"
  error="Optional error message"
  onChange={(e) => setValue(e.target.value)}
/>
```

### Card
```tsx
<Card title="Section Title">
  {/* content */}
</Card>
```

### Layout
```tsx
<Layout>
  {/* content - includes header and styling */}
</Layout>
```

## API Integration

### Auth API
- `POST /auth/register/step1` - Basis-Registrierung
- `POST /auth/register/step2` - Dokument-Upload
- `POST /auth/register/step3` - Abschließen

### User API
- `POST /user/claim` - Token-Anspruch

### Hub API
- `GET /hub/tokens` - Alle Tokens
- `GET /hub/tokens/:id` - Token-Details
- `GET /hub/swap/quote` - Swap-Quote
- `POST /hub/swap` - Swap ausführen

Siehe `src/api/` für implementierte Clients.

## Wallet Integration

Unterstützte Wallets:
- Phantom (Standard)
- Weitere können in `App.tsx` hinzugefügt werden

```tsx
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

const wallets = [
  new PhantomWalletAdapter(),
  // weitere...
];
```

## Styling

**Tailwind CSS** für alle Styles:
- Keine separaten CSS-Dateien für Komponenten
- Konsistente Design-Token
- Responsive Design mit Tailwind Breakpoints

```tsx
// Beispiel
<div className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
  Styled with Tailwind
</div>
```

## Environment Variablen

```env
# API Base URL (Standard: http://localhost:5000)
VITE_API_URL=http://localhost:5000
```

## Solana Network

Standardmäßig: **Devnet**

Ändern in `App.tsx`:
```tsx
import { clusterApiUrl } from '@solana/web3.js';
const network = clusterApiUrl('devnet'); // oder 'testnet', 'mainnet-beta'
```

## TypeScript

Das Projekt ist vollständig mit TypeScript typisiert.

Key Typen in `src/api/`:
- `RegisterStep1Data`, `RegisterStep2Data`, `RegisterStep3Data`
- `ClaimTokenData`
- `TokenInfo`, `SwapQuote`

## Performance Optimierungen

✅ Vite für schnelle Build-Zeiten
✅ Code Splitting durch React Router
✅ Lazy Loading von Seiten
✅ Tailwind CSS Purging in Production
✅ Optimierte Bundle-Größe

## Troubleshooting

### "Cannot connect to API"
→ Prüfe `VITE_API_URL` in `.env.local`
→ Backend läuft auf Port 5000?

### "Wallet not detected"
→ Phantom Browser Extension installiert?
→ Browser aktualisieren?

### TypeScript Fehler
```bash
npm run build  # Vor Deploy prüfen
```

## Build & Deploy

```bash
# Production Build
npm run build

# Verzeichnis: dist/
# Deployable zu: Vercel, Netlify, etc.
```

## Weitere Ressourcen

- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com/)
- [Recharts](https://recharts.org/)
- [Vite](https://vitejs.dev/)

---

**Made with ❤️ for the Token Bonding Curve Protocol**
