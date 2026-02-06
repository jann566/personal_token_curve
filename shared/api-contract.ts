/**
 * 🔐 API Contract - Token Bonding Curve Plattform
 *
 * Dieses Datei definiert den kompletten REST-API Contract
 * - HTTP-Methode & URL
 * - Request-Body Schema
 * - Response-Body Schema
 * - Mögliche Error-Responses
 *
 * Wird sowohl im Frontend als auch Backend als Quelle der Wahrheit verwendet.
 */

// ============================================================================
// 1. AUTH ENDPOINTS - Registrierung
// ============================================================================

/**
 * POST /auth/register/step1
 * Initiiert die Registrierung mit Email und Passwort
 *
 * @method POST
 * @path /auth/register/step1
 */
export interface RegisterStep1Request {
  email: string; // Valide E-Mail-Adresse
  password: string; // Mindestens 8 Zeichen
}

export interface RegisterStep1Response {
  message: "Step 1 complete";
  userId: string; // MongoDB ObjectId als String
}

export interface RegisterStep1Error {
  // 400 Bad Request
  message:
    | "email and password required"
    | "Email already registered"
    | "Invalid email format"
    | "Password too short";

  // 500 Internal Server Error
  // message: "Internal server error"
}

// ---

/**
 * POST /auth/register/step2
 * Lädt Verifizierungsdokument (PDF) hoch
 *
 * @method POST
 * @path /auth/register/step2
 * @content-type multipart/form-data
 */
export interface RegisterStep2Request {
  userId: string; // Aus Step1
  pdf: File; // Multipart File Upload, nur .pdf erlaubt
}

export interface RegisterStep2Response {
  message: "Step 2 complete";
}

export interface RegisterStep2Error {
  // 400 Bad Request
  message: "userId missing" | "No PDF uploaded" | "Invalid file type";

  // 404 Not Found
  // message: "User not found"

  // 500 Internal Server Error
  // message: "Internal server error"
}

// ---

/**
 * POST /auth/register/step3
 * Abschluss der Registrierung mit Phantom Wallet
 *
 * @method POST
 * @path /auth/register/step3
 */
export interface RegisterStep3Request {
  userId: string; // Aus Step1
  phantomWallet: string; // Solana Public Key (Base58)
}

export interface RegisterStep3Response {
  message: "Registration complete";
}

export interface RegisterStep3Error {
  // 400 Bad Request
  message:
    | "userId missing"
    | "phantomWallet missing"
    | "Invalid wallet format";

  // 404 Not Found
  // message: "User not found"

  // 500 Internal Server Error
  // message: "Internal server error"
}

// ============================================================================
// 2. ADMIN ENDPOINTS - User Management
// ============================================================================

/**
 * GET /admin/users
 * Fetch alle registrierten Benutzer (Admin-only)
 *
 * @method GET
 * @path /admin/users
 */
export interface GetAllUsersResponse {
  _id: string;
  email: string;
  fullName?: string;
  username?: string;
  phantomWallet?: string;
  registrationStep: number; // 1, 2, oder 3
  isApproved: boolean;
  minted: boolean;
  claimed: boolean;
  mintAddress?: string;
  ataAddress?: string;
  userHash?: string;
  registryTx?: string;
  mintTx?: string;
  claimTx?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface GetAllUsersError {
  // 500 Internal Server Error
  message: "Error fetching users";
}

// ---

/**
 * GET /admin/users/:id
 * Fetch einzelnen User by ID
 *
 * @method GET
 * @path /admin/users/:id
 * @param id - User MongoDB ObjectId
 */
export interface GetUserByIdResponse {
  _id: string;
  email: string;
  fullName?: string;
  username?: string;
  phantomWallet?: string;
  registrationStep: number;
  isApproved: boolean;
  minted: boolean;
  claimed: boolean;
  mintAddress?: string;
  ataAddress?: string;
  userHash?: string;
  registryTx?: string;
  mintTx?: string;
  claimTx?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetUserByIdError {
  // 404 Not Found
  message: "User not found";

  // 500 Internal Server Error
  // message: "Error fetching user"
}

// ---

/**
 * POST /admin/approve
 * Approves einen User für Token-Mint
 * Erstellt per-user Mint + ATA + Registry Proof on-chain
 *
 * @method POST
 * @path /admin/approve
 */
export interface ApproveUserRequest {
  userId: string; // Muss fully registered sein (registrationStep === 3)
}

export interface ApproveUserResponse {
  message: "User approved (mint created). User must claim tokens.";
  mintAddress: string; // Solana Mint Public Key
  ataAddress: string; // Associated Token Account
  registryTx: string; // Solana TX Signature (Registry Proof)
  userHash: string; // SHA256(userId:wallet)
}

export interface ApproveUserError {
  // 400 Bad Request
  message:
    | "userId missing"
    | "User is not fully registered"
    | "User has no Phantom wallet stored"
    | "Invalid wallet address";

  // 404 Not Found
  // message: "User not found"

  // 500 Internal Server Error
  // message: "Internal server error" | Error message from Solana
}

// ============================================================================
// 3. USER ENDPOINTS - Token Claim
// ============================================================================

/**
 * POST /user/claim
 * Claims Token vom User (muss approved sein)
 * Mintet die Initial Supply an die User ATA
 *
 * @method POST
 * @path /user/claim
 */
export interface ClaimTokenRequest {
  userId: string; // Muss approved sein
}

export interface ClaimTokenResponse {
  message: "Claim successful";
  mintAddress: string;
  ataAddress: string;
  claimTx: string; // Solana TX Signature
}

export interface ClaimTokenError {
  // 400 Bad Request
  message:
    | "userId missing"
    | "User is not approved"
    | "User has no mintAddress"
    | "User has no ataAddress"
    | "User has already claimed";

  // 404 Not Found
  // message: "User not found"

  // 500 Internal Server Error
  // message: "Internal server error" | Error from Solana
}

// ============================================================================
// 4. REGISTRY ENDPOINTS - On-Chain Validation
// ============================================================================

/**
 * GET /registry/validate
 * Validiert eine Wallet gegen die On-Chain Registry
 * Kann gegen Cache ODER On-Chain abgefragt werden
 *
 * @method GET
 * @path /registry/validate
 * @query walletAddress - Solana Public Key (required)
 */
export interface ValidateWalletRequest {
  walletAddress: string; // Query Parameter
}

export interface ValidateWalletResponse {
  walletAddress: string;
  approved: boolean; // true wenn in Registry eingetragen
  data: RegistryEntryData | null; // null wenn nicht approved
  source: "on-chain" | "cache" | "none"; // Woher die Daten kamen
}

export interface RegistryEntryData {
  mintAddress: string;
  ataAddress: string;
  userHash: string;
  registryTx: string;
  approved: boolean;
  approvedAt: string; // ISO 8601
}

export interface ValidateWalletError {
  // 400 Bad Request
  message: "walletAddress query missing" | "Invalid wallet address";

  // 500 Internal Server Error
  message: "Validation failed";
  error: string; // Detailed error message
}

// ---

/**
 * GET /registry/:walletAddress
 * Fetch einzelnen Registry Entry (Cache oder On-Chain)
 *
 * @method GET
 * @path /registry/:walletAddress
 * @param walletAddress - Solana Public Key
 */
export interface GetRegistryEntryResponse {
  mintAddress: string;
  walletAddress: string;
  ataAddress: string;
  userHash: string;
  registryTx: string;
  approved: boolean;
  approvedAt: string; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface GetRegistryEntryError {
  // 400 Bad Request
  message: "walletAddress param missing" | "Invalid wallet address";

  // 404 Not Found
  message: "No registry entry found";

  // 500 Internal Server Error
  message: "Fetch failed";
  error: string;
}

// ============================================================================
// 5. HUB ENDPOINTS - Token Swap (Placeholder für zukünftige Erweiterung)
// ============================================================================

/**
 * GET /hub/health
 * Health Check für Hub Service
 *
 * @method GET
 * @path /hub/health
 */
export interface HubHealthResponse {
  ok: boolean;
  hub: "ready" | "maintenance" | "error";
}

// Weitere Hub-Endpoints (für bonding curve swaps) können hier später
// dokumentiert werden, z.B:
// - GET /hub/tokens - list all tokens
// - GET /hub/tokens/:id - get token info + price curve
// - GET /hub/swap/quote - calculate swap amounts
// - POST /hub/swap - execute swap transaction

// ============================================================================
// 6. GLOBAL ERROR RESPONSE FORMAT
// ============================================================================

/**
 * Alle Error-Responses folgen diesem Format:
 *
 * HTTP 4xx/5xx:
 * {
 *   message: "Fehlermeldung (immer vorhanden)",
 *   error?: "Details (optional, bei Server Errors)"
 * }
 *
 * Häufige Status Codes:
 * - 400 Bad Request - Fehlerhafter Input vom Client
 * - 404 Not Found - Resource existiert nicht
 * - 500 Internal Server Error - Server-seitiger Fehler
 */

export interface ApiError {
  message: string;
  error?: string; // Optional, bei 5xx Errors
}

// ============================================================================
// 7. HTTP METHOD & ENDPOINT SUMMARY
// ============================================================================

/**
 * ZUSAMMENFASSUNG ALLER ENDPOINTS:
 *
 * AUTH:
 *   POST   /auth/register/step1    - RegisterStep1Request
 *   POST   /auth/register/step2    - RegisterStep2Request (multipart)
 *   POST   /auth/register/step3    - RegisterStep3Request
 *
 * ADMIN:
 *   GET    /admin/users            - keine Parameter
 *   GET    /admin/users/:id        - User ID als Path Parameter
 *   POST   /admin/approve          - ApproveUserRequest
 *
 * USER:
 *   POST   /user/claim             - ClaimTokenRequest
 *
 * REGISTRY:
 *   GET    /registry/validate      - walletAddress as Query
 *   GET    /registry/:walletAddress- walletAddress as Path
 *
 * HUB:
 *   GET    /hub/health             - keine Parameter
 */
