import { Router } from "express";
import { getAllUsers, approveUser } from "../controllers/adminController";

const router = Router();

// Route: alle registrierten User (Admin)
router.get("/users", getAllUsers);

// Route: User genehmigen + Token generieren
router.post("/approve", approveUser);

export default router;
