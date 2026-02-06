import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { initMarketWithAdmin, makeProgram } from '../services/hub/anchorService';
import AddressBook from '../models/addressBookModel';
import fs from 'fs';
import path from 'path';
import { getConnection, getPayer } from '../services/solana/connection';

/**
 * POST /hub/admin/init-market
 * Body: { mint: string, baseMint: string }
 * Requires that server WALLET_PATH is configured and funded.
 */
export async function initMarketHandler(req: Request, res: Response) {
  try {
    // Optional admin secret protection
    const secret = process.env.HUB_ADMIN_SECRET;
    if (secret && req.headers['x-admin-secret'] !== secret) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const { mint } = req.body as { mint?: string; baseMint?: string };
    if (!mint) return res.status(400).json({ error: 'Missing params: mint is required' });

    const envBase = process.env.HUB_BASE_MINT || 'So11111111111111111111111111111111111111112';
    const baseMint = (req.body as any).baseMint || envBase;

    const mintPub = new PublicKey(mint);
    const basePub = new PublicKey(baseMint);

    // Ensure admin payer exists
    try {
      getPayer();
    } catch (e: any) {
      return res.status(500).json({ error: 'admin_keypair_missing', message: e?.message ?? String(e) });
    }

    const conn = getConnection();
    const vBase = (req.body as any).vBase;
    const vToken = (req.body as any).vToken;
    const feeBps = (req.body as any).feeBps;
    const protocolFeeShareBps = (req.body as any).protocolFeeShareBps;

    let result;
    try {
      result = await initMarketWithAdmin(conn, mintPub, basePub, { vBase, vToken, feeBps, protocolFeeShareBps });
    } catch (e: any) {
      console.error('[hubAdmin] initMarketWithAdmin failed', e);
      // Try to extract logs if present
      const logs = e?.logs || e?.error?.logs || null;
      return res.status(500).json({ error: 'init_failed', message: e?.message ?? String(e), logs });
    }
    // persist metadata if possible
    try {
      const Market = require('../models/marketModel').default;
      await Market.findOneAndUpdate(
        { mint: mintPub.toBase58() },
        {
          mint: mintPub.toBase58(),
          marketPda: result.marketPda.toBase58(),
          baseMint: basePub.toBase58(),
          treasuryBaseAta: result.treasuryBaseAta.toBase58(),
          adminFeeAta: result.adminFeeAta.toBase58(),
          initializedAt: new Date(),
          initSig: result.sig,
        },
        { upsert: true }
      );
    } catch (e) {
      console.error('[hubAdmin] failed to persist market metadata', e);
    }

    // include programId info (used by address book snapshot)
    let programId: string | null = null;
    try {
      const program = makeProgram(getConnection());
      programId = program.programId.toBase58();
    } catch (e) {
      programId = process.env.HUB_PROGRAM_ID || process.env.SOLANA_PROGRAM_ID || null;
    }

    // Upsert AddressBook entries for mint, market PDA and treasury ATAs
    try {
      const cluster = process.env.SOLANA_CLUSTER || 'devnet';
      const toUpserts = [
        { label: `mint:${mintPub.toBase58()}`, type: 'mint', address: mintPub.toBase58(), cluster, notes: 'initialized via admin init-market' },
        { label: `market:${result.marketPda.toBase58()}`, type: 'pda', address: result.marketPda.toBase58(), cluster, notes: 'hub market PDA' },
        { label: `treasury_base_ata:${result.treasuryBaseAta.toBase58()}`, type: 'ata', address: result.treasuryBaseAta.toBase58(), cluster, notes: 'market treasury base ATA' },
        { label: `admin_fee_ata:${result.adminFeeAta.toBase58()}`, type: 'ata', address: result.adminFeeAta.toBase58(), cluster, notes: 'market admin fee ATA' },
      ];
      for (const e of toUpserts) {
        await AddressBook.findOneAndUpdate({ address: e.address, cluster }, { $set: e }, { upsert: true, new: true });
      }
      // also write a simple addresses.json snapshot for quick reference
      try {
        const outDir = path.join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, 'addresses.json');
        const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
        const updated = {
          ...(existing || {}),
          programId: programId || process.env.HUB_PROGRAM_ID || process.env.SOLANA_PROGRAM_ID || null,
          mint: mintPub.toBase58(),
          marketPda: result.marketPda.toBase58(),
          treasuryBaseAta: result.treasuryBaseAta.toBase58(),
          adminFeeAta: result.adminFeeAta.toBase58(),
          cluster,
          lastInit: new Date().toISOString(),
        };
        fs.writeFileSync(outPath, JSON.stringify(updated, null, 2), 'utf8');
      } catch (werr) {
        console.error('[hubAdmin] failed to write addresses.json', werr);
      }
    } catch (e) {
      console.error('[hubAdmin] failed to upsert address book entries', e);
    }

    return res.json({
      success: true,
      mint: mintPub.toBase58(),
      baseMint: basePub.toBase58(),
      programId,
      marketPda: result.marketPda.toBase58(),
      signature: result.sig,
      reserves: { vBase: String(vBase || process.env.HUB_V_BASE || '1000000000000'), vToken: String(vToken || process.env.HUB_V_TOKEN || '1000000000000') },
    });
  } catch (err: any) {
    console.error('[hubAdmin] initMarket error', err);
    const logs = err?.logs || err?.error?.logs || null;
    return res.status(500).json({ error: 'internal_error', message: err?.message ?? String(err), logs });
  }
}
