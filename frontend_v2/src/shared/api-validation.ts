/**
 * 🔐 API Validation Schemas (Zod) - FRONTEND COPY
 *
 * MINIMAL: Nur Runtime-Validatoren
 */

import { z } from "zod";
import type {
  RegisterStep1Request,
  RegisterStep3Request,
  ClaimTokenRequest,
} from "./api-types";

// Basis Validators
const EmailSchema = z.string().email("Invalid email address");
const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");
const UserIdSchema = z.string().min(20); // MongoDB ObjectId
const WalletAddressSchema = z
  .string()
  // Accept common Base58 Solana public key encodings (typical length ~43-44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,50}$/, "Invalid Solana wallet address");

// ============================================================================
// 1. AUTH SCHEMAS
// ============================================================================

export const RegisterStep1RequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const RegisterStep3RequestSchema = z.object({
  userId: UserIdSchema,
  phantomWallet: WalletAddressSchema,
});

// ============================================================================
// 3. HUB SCHEMAS (optional)
// ============================================================================

export const HubHealthResponseSchema = z.object({
  ok: z.boolean(),
  hub: z.enum(["ready", "maintenance", "error"]),
});

export const ClaimTokenRequestSchema = z.object({
  userId: UserIdSchema,
});

// ============================================================================
// 4. HELPER VALIDATORS
// ============================================================================

export function validateRegisterStep1(
  data: unknown
): RegisterStep1Request {
  return RegisterStep1RequestSchema.parse(data);
}

export function validateRegisterStep3(
  data: unknown
): RegisterStep3Request {
  return RegisterStep3RequestSchema.parse(data);
}

export function validateClaimToken(
  data: unknown
): ClaimTokenRequest {
  return ClaimTokenRequestSchema.parse(data);
}

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
