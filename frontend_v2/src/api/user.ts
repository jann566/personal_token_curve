import axios from "axios";
import type { AxiosInstance, AxiosError } from "axios";
import type {
  ClaimTokenRequest,
  ClaimTokenResponse,
  ApiError,
} from "../shared/api-types";
import {
  validateClaimToken,
  safeValidate,
  ClaimTokenRequestSchema,
} from "../shared/api-validation";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

class UserApi {
  private api: AxiosInstance;
  private readonly baseURL = `${API_BASE}/user`;

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * POST /user/claim
   * Claims Token für einen User
   * Voraussetzung: User muss approved sein
   *
   * @throws {AxiosError<ApiError>} Falls User nicht approved oder bereits geclaimt
   */
  async claimToken(data: ClaimTokenRequest): Promise<ClaimTokenResponse> {
    // ✅ Validierung gegen Contract
    const validated = validateClaimToken(data);

    console.log('[UserApi.claimToken] Sending payload:', validated);
    const response = await this.api.post<ClaimTokenResponse>(
      "/claim",
      validated
    );
    console.log('[UserApi.claimToken] Response:', response.data);

    return response.data;
  }

    /**
     * Build unsigned claim tx on backend (fee payer = user)
     */
    async createClaimTx(data: { userId: string; wallet: string }) {
      const response = await this.api.post('/tx/claim', data);
      return response.data as { tx: string; recentBlockhash: string };
    }

    /**
     * Submit partially-signed tx (signed by user). Backend will co-sign and submit.
     */
    async confirmClaimTx(data: { userId: string; signedTx: string }) {
      const response = await this.api.post('/tx/claim/confirm', data);
      return response.data;
    }

  /**
   * Sichere Validierung ohne Exception
   */
  static safeValidateClaim(
    data: unknown
  ): { success: true; data: ClaimTokenRequest } | {
    success: false;
    errors: string[];
  } {
    return safeValidate(ClaimTokenRequestSchema, data);
  }
}

export const userApi = new UserApi();

/**
 * Error Handler für User-spezifische Fehler
 */
export function handleUserError(
  error: unknown
): { message: string; code?: string } {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;

    if (axiosError.response?.status === 400) {
      return {
        message: axiosError.response.data.message,
        code: "VALIDATION_ERROR",
      };
    }

    if (axiosError.response?.status === 404) {
      return {
        message: "User not found",
        code: "NOT_FOUND",
      };
    }

    if (axiosError.response?.status === 500) {
      return {
        message: axiosError.response.data.message,
        code: "SERVER_ERROR",
      };
    }

    if (error.message === "Network Error") {
      return {
        message: "Network error - please check your connection",
        code: "NETWORK_ERROR",
      };
    }

    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
    };
  }

  return {
    message: "An unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

export default userApi;
