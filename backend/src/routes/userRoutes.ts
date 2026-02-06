import { Router } from "express";
import { claimToken, getUserStatus, getUserStatusByWallet, createClaimTx, confirmClaimTx, getBalancesByWallet } from "../controllers/userController";

const router = Router();

router.get("/status/:userId", getUserStatus);
router.get('/status/by-wallet/:wallet', getUserStatusByWallet);
router.post("/claim", claimToken);
router.post('/tx/claim', createClaimTx);
router.post('/tx/claim/confirm', confirmClaimTx);
router.get('/balances/:wallet', getBalancesByWallet);

export default router;
