import { Router } from "express";
import { upload } from "../middleware/upload";
import { registerStep1, registerStep2, registerStep3 } from "../controllers/authController";

const router = Router();

router.post("/register/step1", registerStep1);
router.post("/register/step2", upload.single("pdf"), registerStep2);
router.post("/register/step3", registerStep3);

export default router;
