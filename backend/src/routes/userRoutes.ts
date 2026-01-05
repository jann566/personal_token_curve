import { Router } from "express";
import { claimToken } from "../controllers/userController";

const router = Router();

router.post("/claim", claimToken);

export default router;
