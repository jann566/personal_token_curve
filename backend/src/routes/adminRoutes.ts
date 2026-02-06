import { Router } from "express";
import { approveUser, getAllUsers, getUserById } from "../controllers/adminController";

const router = Router();

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.post("/approve", approveUser);

export default router;
