import { Request, Response } from "express";
import { User } from "../models/userModel";
import { approveUserFlow } from "../services/flows/approveUser";

export const approveUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ message: "userId missing" });

    const user: any = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.registrationStep !== 3) {
      return res.status(400).json({ message: "User is not fully registered" });
    }

    if (!user.phantomWallet) {
      return res.status(400).json({ message: "User has no Phantom wallet stored" });
    }

    const result = await approveUserFlow({ userId: String(user._id) });

    return res.json({
      message: "User approved (mint created). User must claim tokens.",
      ...result,
    });
  } catch (err: any) {
    console.error("APPROVE ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    return res.status(500).json({ message: "Error fetching users" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("GET USER ERROR:", err);
    return res.status(500).json({ message: "Error fetching user" });
  }
};

