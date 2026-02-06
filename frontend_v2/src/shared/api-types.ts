/**
 * 🔐 API Contract - Token Bonding Curve Plattform (FRONTEND COPY)
 *
 * MINIMAL: Nur Typen, keine ausführliche Dokumentation
 */

// ============================================================================
// 1. AUTH TYPES
// ============================================================================

export interface RegisterStep1Request {
  email: string;
  password: string;
}

export interface RegisterStep1Response {
  message: "Step 1 complete";
  userId: string;
}

export interface RegisterStep2Response {
  message: "Step 2 complete";
}

export interface RegisterStep3Request {
  userId: string;
  phantomWallet: string;
}

export interface RegisterStep3Response {
  message: "Registration complete";
}

// ============================================================================
// 2. ADMIN TYPES
// ============================================================================

export interface AdminUser {
  _id: string;
  email: string;
  registrationStep: number;
  isApproved: boolean;
  phantomWallet?: string;
  minted: boolean;
  claimed: boolean;
  createdAt: string;
}

export interface AdminUsersListResponse {
  // Array of users
  [key: string]: any;
}

export interface AdminApproveRequest {
  userId: string;
}

export interface AdminApproveResponse {
  message: "User approved (mint created). User must claim tokens.";
  mintAddress: string;
  ataAddress: string;
  registryTx: string;
  userHash: string;
}

// ============================================================================
// 3. USER TYPES (Claim & Status)
// ============================================================================

export interface UserStatusResponse {
  _id: string;
  email: string;
  registrationStep: number;
  isApproved: boolean;
  phantomWallet?: string;
  minted: boolean;
  claimed: boolean;
}

export interface ClaimTokenRequest {
  userId: string;
}

export interface ClaimTokenResponse {
  message: "Claim successful";
  mintAddress: string;
  ataAddress: string;
  claimTx: string;
}

// ============================================================================
// 4. HUB TYPES
// ============================================================================

export interface HubHealthResponse {
  ok: boolean;
  hub: "ready" | "maintenance" | "error";
}

// ============================================================================
// 5. ERROR TYPE
// ============================================================================

export interface ApiError {
  message: string;
  error?: string;
}
