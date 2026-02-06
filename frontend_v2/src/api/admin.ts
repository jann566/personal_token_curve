import axios from "axios";
import type { AxiosInstance } from "axios";
import type {
  AdminUser,
  AdminApproveRequest,
  AdminApproveResponse,
} from "../shared/api-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

class AdminApi {
  private api: AxiosInstance;
  private readonly baseURL = `${API_BASE}/admin`;

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * GET /admin/users
   * Ruft Liste aller registrierten User ab
   */
  async getAllUsers(): Promise<AdminUser[]> {
    const response = await this.api.get<AdminUser[]>("/users");
    return response.data;
  }

  /**
   * GET /admin/users/:id
   * Ruft einen einzelnen User ab
   */
  async getUserById(userId: string): Promise<AdminUser> {
    const response = await this.api.get<AdminUser>(`/users/${userId}`);
    return response.data;
  }

  /**
   * POST /admin/approve
   * Genehmigt einen User (erstellt Mint)
   */
  async approveUser(
    data: AdminApproveRequest
  ): Promise<AdminApproveResponse> {
    const response = await this.api.post<AdminApproveResponse>(
      "/approve",
      data
    );
    return response.data;
  }
}

export const adminApi = new AdminApi();

/**
 * Error Handler für Admin-spezifische Fehler
 */
export function handleAdminError(
  error: unknown
): { message: string; code?: string } {
  if (axios.isAxiosError(error)) {
    const msg =
      (error.response?.data as any)?.message ||
      error.message ||
      "Admin operation failed";
    return {
      message: msg,
      code: `ERROR_${error.response?.status || 0}`,
    };
  }

  return {
    message: "An unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

export default adminApi;
