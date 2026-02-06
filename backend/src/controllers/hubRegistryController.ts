import { Request, Response } from 'express';
import MarketRegistry from '../models/marketRegistryModel';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../services/solana/connection';
import { makeProgram } from '../services/hub/anchorService';

export const getRegistry = async (req: Request, res: Response) => {
  try {
    const { mint } = req.params as { mint?: string };
    if (!mint) return res.status(400).json({ error: 'mint required' });

    const mintPub = new PublicKey(mint);
    const conn = getConnection();
    const program = makeProgram(conn as any);
    const [marketPda] = await PublicKey.findProgramAddress([Buffer.from('market'), mintPub.toBuffer()], program.programId);
    const info = await conn.getAccountInfo(marketPda);
    const exists = !!info;

    const registry = await MarketRegistry.findOneAndUpdate(
      { mint: mintPub.toBase58() },
      {
        mint: mintPub.toBase58(),
        programId: process.env.HUB_PROGRAM_ID || process.env.SOLANA_PROGRAM_ID || null,
        marketPda: marketPda.toBase58(),
        status: exists ? 'initialized' : 'missing',
        lastVerifiedSlot: info?.lamports ? undefined : undefined,
      },
      { upsert: true, new: true }
    );

    return res.json({ registry, exists });
  } catch (e: any) {
    console.error('[hubRegistry] getRegistry error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
};

export const listRegistries = async (_req: Request, res: Response) => {
  try {
    const regs = await MarketRegistry.find().sort({ createdAt: -1 }).limit(200);
    return res.json(regs);
  } catch (e: any) {
    console.error('[hubRegistry] list error', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
};
