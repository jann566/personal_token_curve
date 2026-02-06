import axios from "axios";
import type { AxiosInstance } from "axios";
import type { AxiosError } from "axios";
import { ZodError } from "zod";
import type {
  RegisterStep1Request,
  RegisterStep1Response,
  RegisterStep2Response,
  RegisterStep3Request,
  RegisterStep3Response,
} from "../shared/api-types";
import {
  validateRegisterStep1,
  validateRegisterStep3,
  safeValidate,
  RegisterStep1RequestSchema,
  RegisterStep3RequestSchema,
} from "../shared/api-validation";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

class AuthApi {
  private api: AxiosInstance;
  private readonly baseURL = `${API_BASE}/auth`;

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * POST /auth/register/step1
   * Registrierung Schritt 1: Email & Passwort
   *
   * @throws {AxiosError<ApiError>} Falls Validierung oder API-Call fehlschlägt
   */
  async registerStep1(
    data: RegisterStep1Request
  ): Promise<RegisterStep1Response> {
    // ✅ Validierung gegen Contract
    const validated = validateRegisterStep1(data);

    const response = await this.api.post<RegisterStep1Response>(
      "/register/step1",
      validated
    );

    return response.data;
  }

  /**
   * POST /auth/register/step2
   * Registrierung Schritt 2: PDF-Upload
   *
   * @throws {AxiosError<ApiError>} Falls Validierung oder API-Call fehlschlägt
   */
  async registerStep2(
    userId: string,
    pdfFile: File
  ): Promise<RegisterStep2Response> {
    // ✅ Validierung: userId muss gültige MongoDB ObjectId sein
    if (!userId || userId.length !== 24) {
      throw new Error("Invalid userId format (must be 24-char MongoDB ID)");
    }

    // ✅ Validierung: PDF-Datei
    if (!pdfFile || pdfFile.type !== "application/pdf") {
      throw new Error("File must be a valid PDF");
    }

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("pdf", pdfFile);

    const response = await this.api.post<RegisterStep2Response>(
      "/register/step2",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  }

  /**
   * POST /auth/register/step3
   * Registrierung Schritt 3: Phantom Wallet
   *
   * @throws {AxiosError<ApiError>} Falls Validierung oder API-Call fehlschlägt
   */
  async registerStep3(
    data: RegisterStep3Request
  ): Promise<RegisterStep3Response> {
    // ✅ Validierung gegen Contract
    const validated = validateRegisterStep3(data);

    // Construct explicit payload with only the accepted fields
    const payload = {
      userId: validated.userId,
      phantomWallet: validated.phantomWallet,
    };

    console.log('[AuthApi.registerStep3] Sending payload:', payload);

    const response = await this.api.post<RegisterStep3Response>(
      "/register/step3",
      payload
    );

    console.log('[AuthApi.registerStep3] Response:', response.data);
    return response.data;
  }

  /**
   * Wrapper für sichere Validierung (ohne Exception)
   */
  static safeValidateStep1(
    data: unknown
  ): { success: true; data: RegisterStep1Request } | {
    success: false;
    errors: string[];
  } {
    return safeValidate(RegisterStep1RequestSchema, data);
  }

  static safeValidateStep3(
    data: unknown
  ): { success: true; data: RegisterStep3Request } | {
    success: false;
    errors: string[];
  } {
    return safeValidate(RegisterStep3RequestSchema, data);
  }
}

export const authApi = new AuthApi();

/**
 * Error Handler für Auth-spezifische Fehler
 */
export function handleAuthError(
  error: unknown
): { message: string; code?: string } {
  // Zod validation errors (client-side contract validation)
  if (error instanceof ZodError) {
    const msg = error.issues
      .map((i) => `${i.path.join('.') || 'value'}: ${i.message}`)
      .join('; ');
    return { message: msg, code: "VALIDATION_ERROR" };
  }
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 400
  ) {
    const msg = (error.response?.data as any)?.message || "Validation failed";
    return { message: msg, code: "VALIDATION_ERROR" };
  }

  if (
    axios.isAxiosError(error) &&
    error.response?.status === 404
  ) {
    return {
      message: "User not found",
      code: "NOT_FOUND",
    };
  }

  if (
    axios.isAxiosError(error) &&
    error.response?.status === 500
  ) {
    const msg = (error.response?.data as any)?.message || "Server error";
    return { message: msg, code: "SERVER_ERROR" };
  }

  if (axios.isAxiosError(error) && error.message === "Network Error") {
    return {
      message: "Network error - please check your connection",
      code: "NETWORK_ERROR",
    };
  }

  return {
    message: axios.isAxiosError(error)
      ? error.message
      : "An unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

export default authApi;
