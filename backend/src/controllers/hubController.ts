import { Request, Response } from "express";
import { User } from "../models/userModel";
import { quoteBuy, quoteSell, getCurrentPrice } from "../services/hub/quoteService";
import { getConnection } from "../services/solana/connection";
import { PublicKey } from "@solana/web3.js";
import { makeProgram as _makeProgram } from "../services/hub/anchorService";

interface QuoteBuyRequest {
  tokenMint: string; // User Token Mint
  baseAmount: string; // Eingabe SOL (in lamports, als string wegen precision)
  minTokenOut?: string; // Slippage protection
}

interface QuoteSellRequest {
  tokenMint: string; // User Token Mint
  tokenAmount: string; // Eingabe Token (base units, als string)
  minBaseOut?: string; // Slippage protection
}

interface TradeData {
  tokenMint: string;
  currentPrice: number;
  vBase: string; // bigint als string
  vToken: string; // bigint als string
}

/**
 * GET /hub/markets/:tokenMint
 * Liefert Market-Info für einen Token (für Trade-Seite nötig)
 */
export const getMarketData = async (req: Request, res: Response) => {
  try {
    const { tokenMint } = req.params as { tokenMint?: string };
    if (!tokenMint) return res.status(400).json({ message: "tokenMint missing" });

    const user = await User.findOne({ mintAddress: tokenMint });
    if (!user) return res.status(404).json({ message: "Token not found" });

    // Placeholder: vBase, vToken sollten von Hub-MM-Programm gelesen werden
    // Für jetzt: hardcoded defaults oder aus user profile
    const vBase = BigInt(process.env.HUB_V_BASE || "1000000000000"); // 1 USDC in units
    const vToken = BigInt(process.env.HUB_V_TOKEN || "1000000000000"); // 1B Token units
    const currentPrice = getCurrentPrice(vBase, vToken);

    return res.json({
      tokenMint,
      tokenSymbol: "USR", // später aus user
      currentPrice,
      vBase: vBase.toString(),
      vToken: vToken.toString(),
      feeBps: parseInt(process.env.HUB_FEE_BPS || "250"), // 2.5%
      protocolFeeBps: parseInt(process.env.HUB_PROTOCOL_FEE_BPS || "5000"), // 50% of fee
    });
  } catch (err: any) {
    console.error("GET MARKET DATA ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

/**
 * POST /hub/quote/buy
 * Gibt Preis-Quote für Buy-Operation
 */
export const quoteBuyHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body as QuoteBuyRequest;
    const { tokenMint, baseAmount, minTokenOut } = body;

    if (!tokenMint || !baseAmount) {
      return res.status(400).json({ message: "tokenMint and baseAmount required" });
    }

    // Hole Market Data
    const user = await User.findOne({ mintAddress: tokenMint });
    if (!user) return res.status(404).json({ message: "Token not found" });

    const vBase = BigInt(process.env.HUB_V_BASE || "1000000000000");
    const vToken = BigInt(process.env.HUB_V_TOKEN || "1000000000000");
    const feeBps = parseInt(process.env.HUB_FEE_BPS || "250");
    const protocolFeeBps = parseInt(process.env.HUB_PROTOCOL_FEE_BPS || "5000");

    const baseIn = BigInt(baseAmount);

    const quote = quoteBuy({
      baseIn,
      vBase,
      vToken,
      feeBps,
      protocolShareBps: protocolFeeBps,
    });

    return res.json({
      tokenMint,
      inputAmount: quote.inputAmount.toString(),
      outputAmount: quote.outputAmount.toString(),
      fee: quote.fee.toString(),
      protocolFee: quote.protocolFee.toString(),
      priceImpact: quote.priceImpact.toFixed(2),
      minTokenOut: minTokenOut || quote.outputAmount.toString(),
    });
  } catch (err: any) {
    console.error("QUOTE BUY ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

/**
 * POST /hub/quote/sell
 * Gibt Preis-Quote für Sell-Operation
 */
export const quoteSellHandler = async (req: Request, res: Response) => {
  try {
    const body = req.body as QuoteSellRequest;
    const { tokenMint, tokenAmount, minBaseOut } = body;

    if (!tokenMint || !tokenAmount) {
      return res.status(400).json({ message: "tokenMint and tokenAmount required" });
    }

    const user = await User.findOne({ mintAddress: tokenMint });
    if (!user) return res.status(404).json({ message: "Token not found" });

    const vBase = BigInt(process.env.HUB_V_BASE || "1000000000000");
    const vToken = BigInt(process.env.HUB_V_TOKEN || "1000000000000");
    const feeBps = parseInt(process.env.HUB_FEE_BPS || "250");
    const protocolFeeBps = parseInt(process.env.HUB_PROTOCOL_FEE_BPS || "5000");

    const tokenIn = BigInt(tokenAmount);

    const quote = quoteSell({
      tokenIn,
      vBase,
      vToken,
      feeBps,
      protocolShareBps: protocolFeeBps,
    });

    return res.json({
      tokenMint,
      inputAmount: quote.inputAmount.toString(),
      outputAmount: quote.outputAmount.toString(),
      fee: quote.fee.toString(),
      protocolFee: quote.protocolFee.toString(),
      priceImpact: quote.priceImpact.toFixed(2),
      minBaseOut: minBaseOut || quote.outputAmount.toString(),
    });
  } catch (err: any) {
    console.error("QUOTE SELL ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

/**
 * GET /hub/tokens
 * Liefert Liste aller handelbaren Tokens (alle User mit mintAddress)
 */
export const listTokens = async (_req: Request, res: Response) => {
  try {
    const users = await User.find({ mintAddress: { $exists: true, $ne: "" } }).select(
      "mintAddress phantomWallet email registrationStep claimed"
    );

    const vBase = BigInt(process.env.HUB_V_BASE || "1000000000000");
    const vToken = BigInt(process.env.HUB_V_TOKEN || "1000000000000");
    const currentPrice = getCurrentPrice(vBase, vToken);

    const tokens = users.map((u) => ({
      mint: u.mintAddress,
      symbol: "USR", // Placeholder
      name: `User Token (${(u.email || "").split("@")[0]})`,
      currentPrice,
      creator: (u.email || "").split("@")[0],
      claimed: u.claimed ? "Claimed" : "Pending",
    }));

    return res.json(tokens);
  } catch (err: any) {
    console.error("LIST TOKENS ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

/**
 * GET /hub/market/status?mint=<MINT>
 * Returns read-only status whether a market PDA exists on the backend RPC
 */
export const getMarketStatus = async (req: Request, res: Response) => {
  try {
    const { mint } = req.query as { mint?: string };
    if (!mint) return res.status(400).json({ message: 'mint query param required' });

    const mintPub = new PublicKey(mint);
    const conn = getConnection();

    // create program instance to derive same PDA
    const program = _makeProgram(conn as any);
    const [marketPda] = await PublicKey.findProgramAddress([Buffer.from('market'), mintPub.toBuffer()], program.programId);

    const info = await conn.getAccountInfo(marketPda);

    return res.json({
      mint,
      marketPda: marketPda.toBase58(),
      exists: !!info,
      rpcUrl: (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || null),
      programId: program.programId.toBase58(),
    });
  } catch (err: any) {
    console.error('[hubController] getMarketStatus error', err);
    return res.status(500).json({ message: err?.message ?? 'Internal server error' });
  }
};
