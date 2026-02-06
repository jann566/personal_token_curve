/**
 * 🔐 API Validation Schemas (Zod)
 *
 * Dieses File kann in Frontend und Backend verwendet werden
 * für strikte Input-Validierung basierend auf dem API Contract.
 *
 * Installation: npm install zod
 */

import { z } from "zod";

// ============================================================================
// VALIDATORS
// ============================================================================

// Basis Validators
const EmailSchema = z.string().email("Invalid email address");
const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");
const UserIdSchema = z.string().min(24, "Invalid user ID format"); // MongoDB ObjectId
const WalletAddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Z]{32,34}$/, "Invalid Solana wallet address");
const TxSignatureSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{87,88}$/, "Invalid transaction signature");

// ============================================================================
// 1. AUTH SCHEMAS
// ============================================================================

export const RegisterStep1RequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type RegisterStep1Request = z.infer<
  typeof RegisterStep1RequestSchema
>;

export const RegisterStep1ResponseSchema = z.object({
  message: z.literal("Step 1 complete"),
  userId: UserIdSchema,
});
export type RegisterStep1Response = z.infer<
  typeof RegisterStep1ResponseSchema
>;

// ---

export const RegisterStep2RequestSchema = z.object({
  userId: UserIdSchema,
  // PDF File würde in Multipart handling validiert
});

export const RegisterStep2ResponseSchema = z.object({
  message: z.literal("Step 2 complete"),
});
export type RegisterStep2Response = z.infer<
  typeof RegisterStep2ResponseSchema
>;

// ---

export const RegisterStep3RequestSchema = z.object({
  userId: UserIdSchema,
  phantomWallet: WalletAddressSchema,
});
export type RegisterStep3Request = z.infer<
  typeof RegisterStep3RequestSchema
>;

export const RegisterStep3ResponseSchema = z.object({
  message: z.literal("Registration complete"),
});
export type RegisterStep3Response = z.infer<
  typeof RegisterStep3ResponseSchema
>;

// ============================================================================
// 2. ADMIN SCHEMAS
// ============================================================================

const UserDocumentSchema = z.object({
  _id: z.string(),
  email: EmailSchema,
  fullName: z.string().optional(),
  username: z.string().optional(),
  phantomWallet: WalletAddressSchema.optional(),
  registrationStep: z.number().int().min(1).max(4),
  isApproved: z.boolean(),
  minted: z.boolean(),
  claimed: z.boolean(),
  mintAddress: z.string().optional(),
  ataAddress: z.string().optional(),
  userHash: z.string().optional(),
  registryTx: TxSignatureSchema.optional(),
  mintTx: TxSignatureSchema.optional(),
  claimTx: TxSignatureSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GetAllUsersResponseSchema = z.array(UserDocumentSchema);
export type GetAllUsersResponse = z.infer<typeof GetAllUsersResponseSchema>;

export const GetUserByIdResponseSchema = UserDocumentSchema;
export type GetUserByIdResponse = z.infer<typeof GetUserByIdResponseSchema>;

// ---

export const ApproveUserRequestSchema = z.object({
  userId: UserIdSchema,
});
export type ApproveUserRequest = z.infer<typeof ApproveUserRequestSchema>;

export const ApproveUserResponseSchema = z.object({
  message: z.literal(
    "User approved (mint created). User must claim tokens."
  ),
  mintAddress: WalletAddressSchema,
  ataAddress: WalletAddressSchema,
  registryTx: TxSignatureSchema,
  userHash: z.string().length(64), // SHA256 hex
});
export type ApproveUserResponse = z.infer<typeof ApproveUserResponseSchema>;

// ============================================================================
// 3. USER SCHEMAS
// ============================================================================

export const ClaimTokenRequestSchema = z.object({
  userId: UserIdSchema,
});
export type ClaimTokenRequest = z.infer<typeof ClaimTokenRequestSchema>;

export const ClaimTokenResponseSchema = z.object({
  message: z.literal("Claim successful"),
  mintAddress: WalletAddressSchema,
  ataAddress: WalletAddressSchema,
  claimTx: TxSignatureSchema,
});
export type ClaimTokenResponse = z.infer<typeof ClaimTokenResponseSchema>;

// ============================================================================
// 4. REGISTRY SCHEMAS
// ============================================================================

const RegistryEntryDataSchema = z.object({
  mintAddress: WalletAddressSchema,
  ataAddress: WalletAddressSchema,
  userHash: z.string().length(64),
  registryTx: TxSignatureSchema,
  approved: z.boolean(),
  approvedAt: z.string().datetime(),
});

export const ValidateWalletRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
});
export type ValidateWalletRequest = z.infer<typeof ValidateWalletRequestSchema>;

export const ValidateWalletResponseSchema = z.object({
  walletAddress: WalletAddressSchema,
  approved: z.boolean(),
  data: RegistryEntryDataSchema.nullable(),
  source: z.enum(["on-chain", "cache", "none"]),
});
export type ValidateWalletResponse = z.infer<
  typeof ValidateWalletResponseSchema
>;

// ---

const RegistryEntrySchema = z.object({
  mintAddress: WalletAddressSchema,
  walletAddress: WalletAddressSchema,
  ataAddress: WalletAddressSchema,
  userHash: z.string().length(64),
  registryTx: TxSignatureSchema,
  approved: z.boolean(),
  approvedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GetRegistryEntryResponseSchema = RegistryEntrySchema;
export type GetRegistryEntryResponse = z.infer<
  typeof GetRegistryEntryResponseSchema
>;

// ============================================================================
// 5. HUB SCHEMAS
// ============================================================================

export const HubHealthResponseSchema = z.object({
  ok: z.boolean(),
  hub: z.enum(["ready", "maintenance", "error"]),
});
export type HubHealthResponse = z.infer<typeof HubHealthResponseSchema>;

// ============================================================================
// 6. GLOBAL ERROR SCHEMA
// ============================================================================

export const ApiErrorSchema = z.object({
  message: z.string(),
  error: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// 7. HELPER VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validiert Request-Body und wirft Fehler falls ungültig
 * @throws ZodError falls Validierung fehlschlägt
 */
export function validateRegisterStep1(data: unknown): RegisterStep1Request {
  return RegisterStep1RequestSchema.parse(data);
}

export function validateRegisterStep3(data: unknown): RegisterStep3Request {
  return RegisterStep3RequestSchema.parse(data);
}

export function validateApproveUser(data: unknown): ApproveUserRequest {
  return ApproveUserRequestSchema.parse(data);
}

export function validateClaimToken(data: unknown): ClaimTokenRequest {
  return ClaimTokenRequestSchema.parse(data);
}

export function validateWalletAddress(
  data: unknown
): ValidateWalletRequest {
  return ValidateWalletRequestSchema.parse(data);
}

// ============================================================================
// 8. SAFE VALIDATORS (mit try-catch)
// ============================================================================

/**
 * Sichere Validierung die Error Details zurückgibt
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    ),
  };
}

// Beispiel Verwendung:
// const result = safeValidate(RegisterStep1RequestSchema, req.body);
// if (!result.success) {
//   return res.status(400).json({ message: "Validation failed", errors: result.errors });
// }
// const validData: RegisterStep1Request = result.data;
