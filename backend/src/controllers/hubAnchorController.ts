import { Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { buildSwapBuyTx, buildSwapSellTx } from '../services/hub/anchorService';

export async function createSwapBuyTx(req: Request, res: Response) {
  try {
    const { buyer, mint, baseIn, minTokenOut } = req.body as { buyer: string; mint: string; baseIn: number; minTokenOut: number };
    console.log('[hubAnchor] createSwapBuyTx request', { buyer, mint, baseIn, minTokenOut });
    if (!buyer || !mint || !baseIn) return res.status(400).json({ error: 'Missing params' });
    const buyerPub = new PublicKey(buyer);
    const mintPub = new PublicKey(mint);
    const result = await buildSwapBuyTx(buyerPub, mintPub, baseIn, minTokenOut || 0);
    return res.json(result);
  } catch (err) {
    console.error('[hubAnchor] createSwapBuyTx error', err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'internal_error', message: msg });
  }
}

export async function createSwapSellTx(req: Request, res: Response) {
  try {
    const { seller, mint, tokenIn, minBaseOut } = req.body as { seller: string; mint: string; tokenIn: number; minBaseOut: number };
    console.log('[hubAnchor] createSwapSellTx request', { seller, mint, tokenIn, minBaseOut });
    if (!seller || !mint || !tokenIn) return res.status(400).json({ error: 'Missing params' });
    const sellerPub = new PublicKey(seller);
    const mintPub = new PublicKey(mint);
    const result = await buildSwapSellTx(sellerPub, mintPub, tokenIn, minBaseOut || 0);
    return res.json(result);
  } catch (err) {
    console.error('[hubAnchor] createSwapSellTx error', err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'internal_error', message: msg });
  }
}
