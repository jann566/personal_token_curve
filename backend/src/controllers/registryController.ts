import { Request, Response } from "express";
import { RegistryCache } from "../models/registryModel";

// Optional: falls du schon on-chain Reader hast, nutzen wir ihn.
// Wenn noch nicht fertig, bleibt es bei Cache.
import * as registryReader from "../services/registry/registryReader";

export const validateWallet = async (req: Request, res: Response) => {
  try {
    const walletAddress = String(req.query.walletAddress || "").trim();
    if (!walletAddress) return res.status(400).json({ message: "walletAddress query missing" });

    // 1) Cache check (schnell)
    const cached: any = await (RegistryCache as any).findOne({ walletAddress }).lean();

    // 2) Optional on-chain validation
    // Erwartete Funktion (wenn du sie so implementiert hast):
    // registryReader.validateApprovedWallet({ walletAddress }) -> { approved, mintAddress, ataAddress, userHash, registryTx }
    const onChainFn: any = (registryReader as any).validateApprovedWallet;
    const onChain = onChainFn ? await onChainFn({ walletAddress }) : null;

    const best = onChain || cached;

    return res.json({
      walletAddress,
      approved: !!best,
      data: best || null,
      source: onChain ? "on-chain" : cached ? "cache" : "none",
    });
  } catch (err: any) {
    console.error("validateWallet error:", err?.message || err);
    return res.status(500).json({ message: "Validation failed", error: String(err?.message || err) });
  }
};

export const getRegistryEntry = async (req: Request, res: Response) => {
  try {
    const walletAddress = String(req.params.walletAddress || "").trim();
    if (!walletAddress) return res.status(400).json({ message: "walletAddress param missing" });

    const cached: any = await (RegistryCache as any).findOne({ walletAddress }).lean();
    if (cached) return res.json(cached);

    // Optional on-chain direct fetch
    const getFn: any = (registryReader as any).getRegistryEntryByWallet;
    if (getFn) {
      const entry = await getFn({ walletAddress });
      if (entry) return res.json(entry);
    }

    return res.status(404).json({ message: "No registry entry found" });
  } catch (err: any) {
    return res.status(500).json({ message: "Fetch failed", error: String(err?.message || err) });
  }
};
