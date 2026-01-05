import { Router } from "express";
import { approveUser, getAllUsers } from "../controllers/adminController";

const router = Router();

router.get("/users", getAllUsers);
router.post("/approve", approveUser);

export default router;
