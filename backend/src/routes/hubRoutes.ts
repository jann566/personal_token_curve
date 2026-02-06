import { Router } from "express";
import {
  getMarketData,
  quoteBuyHandler,
  quoteSellHandler,
  listTokens,
  getMarketStatus,
} from "../controllers/hubController";
import { createBuyTransaction, confirmBuyTransaction } from "../controllers/hubTxController";
import { createSellTransaction, confirmSellTransaction } from "../controllers/hubTxController";
import { createSwapBuyTx, createSwapSellTx } from "../controllers/hubAnchorController";
import { initMarketHandler } from "../controllers/hubAdminController";
import { getRegistry, listRegistries } from '../controllers/hubRegistryController';

const router = Router();

// Health check
router.get("/health", (_req, res) => res.json({ ok: true, hub: "ready" }));

// Market data & quotes
router.get("/markets/:tokenMint", getMarketData);
router.get('/market/status', getMarketStatus);
router.post("/quote/buy", quoteBuyHandler);
router.post("/quote/sell", quoteSellHandler);

// Build unsigned transactions for client to sign
router.post('/tx/buy', createBuyTransaction);
router.post('/tx/confirm-buy', confirmBuyTransaction);
router.post('/tx/sell', createSellTransaction);
router.post('/tx/confirm-sell', confirmSellTransaction);

// Anchor program swap endpoints (unsigned tx builders)
router.post('/tx/swap-buy', createSwapBuyTx);
router.post('/tx/swap-sell', createSwapSellTx);

// Admin: initialize market on-chain (requires WALLET_PATH configured and funded)
router.post('/admin/init-market', initMarketHandler);

// Registry endpoints for admin/debug
router.get('/registry/:mint', getRegistry);
router.get('/registry', listRegistries);

// Token listing
router.get("/tokens", listTokens);

export default router;
