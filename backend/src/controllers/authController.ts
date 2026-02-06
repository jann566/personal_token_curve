import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/userModel";
import { PublicKey } from "@solana/web3.js";

export const registerStep1 = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashed,
      registrationStep: 1,
    });

    return res.json({ message: "Step 1 complete", userId: user._id });
  } catch (err) {
    console.error("REGISTER STEP1 ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const registerStep2 = async (req: Request, res: Response) => {
  try {
    // Log request context to help debugging client->server issues
    console.info("REGISTER STEP2 REQ", {
      url: req.originalUrl,
      ip: req.ip,
      method: req.method,
      contentType: req.headers["content-type"],
      bodyKeys: Object.keys(req.body || {}),
    });

    const { userId } = req.body as { userId?: string };
    const file = req.file;

    if (!userId) return res.status(400).json({ message: "userId missing" });
    if (!file) return res.status(400).json({ message: "No PDF uploaded" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.idDocumentPath = file.path;
    user.registrationStep = Math.max(user.registrationStep, 2);
    await user.save();

    return res.json({ message: "Step 2 complete" });
  } catch (err) {
    console.error("REGISTER STEP2 ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const registerStep3 = async (req: Request, res: Response) => {
  try {
    // Log incoming body for debugging validation issues
    console.info("REGISTER STEP3 REQ", {
      url: req.originalUrl,
      ip: req.ip,
      method: req.method,
      contentType: req.headers["content-type"],
      bodyKeys: Object.keys(req.body || {}),
      body: req.body,
    });

    const { userId, phantomWallet } = req.body as { userId?: string; phantomWallet?: string };

    if (!userId) {
      console.warn("REGISTER STEP3 - missing userId", { body: req.body });
      return res.status(400).json({ message: "missing_userId" });
    }

    if (!phantomWallet) {
      console.warn("REGISTER STEP3 - missing phantomWallet", { userId });
      return res.status(400).json({ message: "missing_phantomWallet" });
    }

    // Validate Solana public key syntax using @solana/web3.js
    try {
      const pk = new PublicKey(phantomWallet.trim());
      const normalized = pk.toString();

      const user = await User.findById(userId);
      if (!user) {
        console.warn("REGISTER STEP3 - user not found", { userId });
        return res.status(404).json({ message: "user_not_found" });
      }

      user.phantomWallet = normalized;
      user.registrationStep = 3;
      await user.save();

      return res.json({ message: "Registration complete" });
    } catch (valErr) {
      console.error("REGISTER STEP3 - invalid phantomWallet", { phantomWallet, error: valErr });
      return res.status(400).json({ message: "invalid_phantomWallet", details: (valErr as Error).message });
    }
  } catch (err) {
    console.error("REGISTER STEP3 ERROR:", err);
    return res.status(500).json({ message: "internal_server_error", details: (err as Error).message });
  }
};
