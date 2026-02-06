import axios from "axios";
import type { AxiosInstance, AxiosError } from "axios";
import type { ApiError } from "../shared/api-types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export interface MarketData {
  tokenMint: string;
  tokenSymbol: string;
  currentPrice: number;
  vBase: string;
  vToken: string;
  feeBps: number;
  protocolFeeBps: number;
}

export interface QuoteResponse {
  tokenMint: string;
  inputAmount: string;
  outputAmount: string;
  fee: string;
  protocolFee: string;
  priceImpact: string;
  minTokenOut?: string;
  minBaseOut?: string;
}

export interface TokenListItem {
  mint: string;
  symbol: string;
  name: string;
  currentPrice: number;
  creator: string;
  claimed: string;
}

class HubApi {
  private api: AxiosInstance;
  private readonly baseURL = `${API_BASE}/hub`;

  constructor() {
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * GET /hub/health
   * Health Check für den Hub Service
   */
  async getHealth(): Promise<{ ok: boolean; hub: string }> {
    const response = await this.api.get<{ ok: boolean; hub: string }>("/health");
    return response.data;
  }

  /**
   * GET /hub/markets/:tokenMint
   * Fetch market data für einen Token
   */
  async getMarket(tokenMint: string): Promise<MarketData> {
    console.log("[HubApi] Fetching market data for:", tokenMint);
    const response = await this.api.get<MarketData>(`/markets/${tokenMint}`);
    return response.data;
  }

  /**
   * POST /hub/quote/buy
   * Get quote für Buy (SOL -> Token)
   */
  async quoteBuy(tokenMint: string, baseAmount: string, slippage?: number): Promise<QuoteResponse> {
    console.log("[HubApi] Quote BUY:", { tokenMint, baseAmount, slippage });
    const response = await this.api.post<QuoteResponse>("/quote/buy", {
      tokenMint,
      baseAmount,
    });
    return response.data;
  }

  /**
   * POST /hub/quote/sell
   * Get quote für Sell (Token -> SOL)
   */
  async quoteSell(tokenMint: string, tokenAmount: string, slippage?: number): Promise<QuoteResponse> {
    console.log("[HubApi] Quote SELL:", { tokenMint, tokenAmount, slippage });
    const response = await this.api.post<QuoteResponse>("/quote/sell", {
      tokenMint,
      tokenAmount,
    });
    return response.data;
  }

  /**
   * GET /hub/tokens
   * List all tradeable tokens
   */
  async listTokens(): Promise<TokenListItem[]> {
    console.log("[HubApi] Fetching token list");
    const response = await this.api.get<TokenListItem[]>("/tokens");
    return response.data;
  }

  /**
   * POST /hub/tx/buy
   * Prepare an unsigned transaction (base64) for the client to sign.
   */
  async createBuyTx(buyerPubkey: string, lamports: number): Promise<{ tx: string; recentBlockhash: string }>{
    const response = await this.api.post<{ tx: string; recentBlockhash: string }>('/tx/buy', { buyer: buyerPubkey, lamports });
    return response.data;
  }

  /**
   * POST /hub/tx/confirm-buy
   * Confirm a signed tx (signature) and trigger server-side minting.
   */
  async confirmBuyTx(signature: string, buyer: string, mint: string, amount: string): Promise<{ ok: boolean }> {
    const response = await this.api.post<{ ok: boolean }>('/tx/confirm-buy', { signature, buyer, mint, amount });
    return response.data;
  }

  async createSellTx(sellerPubkey: string, mint: string, tokenAmount: string): Promise<{ tx: string; recentBlockhash: string }>{
    const response = await this.api.post<{ tx: string; recentBlockhash: string }>('/tx/sell', { seller: sellerPubkey, mint, tokenAmount });
    return response.data;
  }

  async confirmSellTx(signature: string, seller: string, mint: string, tokenAmount: string, lamports: number): Promise<{ ok: boolean }>{
    const response = await this.api.post<{ ok: boolean }>('/tx/confirm-sell', { signature, seller, mint, tokenAmount, lamports });
    return response.data;
  }

  // Anchor swap endpoints
  async createSwapBuy(buyerPubkey: string, mint: string, baseIn: number, minTokenOut?: number) {
    const response = await this.api.post<{ tx: string; recentBlockhash: string }>('/tx/swap-buy', { buyer: buyerPubkey, mint, baseIn, minTokenOut });
    return response.data;
  }

  async createSwapSell(sellerPubkey: string, mint: string, tokenIn: number, minBaseOut?: number) {
    const response = await this.api.post<{ tx: string; recentBlockhash: string }>('/tx/swap-sell', { seller: sellerPubkey, mint, tokenIn, minBaseOut });
    return response.data;
  }

  async getBalances(wallet: string) {
    // Call the top-level user API directly (not relative to /hub baseURL)
    const url = `${API_BASE.replace(/\/$/, '')}/user/balances/${wallet}`;
    const response = await axios.get<{ sol: number; tokens: any[] }>(url);
    return response.data;
  }
}

export const hubApi = new HubApi();

/**
 * Format output amount for display
 * Converts base units to decimal representation
 */
export function formatTokenAmount(amount: string | bigint, decimals: number = 9): string {
  const num = typeof amount === "string" ? BigInt(amount) : amount;
  const divisor = BigInt(Math.pow(10, decimals));
  const intPart = num / divisor;
  const fracPart = num % divisor;

  const fracStr = fracPart
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fracStr ? `${intPart}.${fracStr}` : intPart.toString();
}

/**
 * Parse user input to base units
 */
export function parseTokenAmount(amount: string, decimals: number = 9): bigint {
  const [intPart, fracPart = ""] = amount.split(".");
  const fracPadded = fracPart.padEnd(decimals, "0");
  return BigInt(intPart + fracPadded);
}

/**
 * Error Handler für Hub-spezifische Fehler
 */
export function handleHubError(
  error: unknown
): { message: string; code?: string } {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;

    if (axiosError.response?.status === 400) {
      return {
        message: axiosError.response.data?.message || "Invalid request",
        code: "VALIDATION_ERROR",
      };
    }

    if (axiosError.response?.status === 404) {
      return {
        message: "Resource not found",
        code: "NOT_FOUND",
      };
    }

    if (axiosError.response?.status === 500) {
      return {
        message: axiosError.response.data?.message || "Server error",
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

export default hubApi;
