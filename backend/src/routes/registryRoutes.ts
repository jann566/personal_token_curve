import { Router } from "express";
import { validateWallet, getRegistryEntry } from "../controllers/registryController";

const router = Router();

router.get("/validate", validateWallet);
router.get("/:walletAddress", getRegistryEntry);

export default router;
