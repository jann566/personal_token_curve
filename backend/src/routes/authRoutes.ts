import { Router } from "express";
import multer from "multer";
import { registerUser } from "../controllers/authController";

// Multer Setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

const router = Router();

// Registration Route
router.post("/register", upload.single("file"), registerUser);

export default router;
