import { Request, Response } from "express";
import { User } from "../models/userModel";
import { mintTokenForUser } from "../services/tokenMint";

export const approveUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.registrationStep !== 3) {
            return res.status(400).json({
                message: "User is not fully registered",
            });
        }

        if (!user.phantomWallet) {
            return res.status(400).json({
                message: "User has no Phantom wallet stored",
            });
        }

        // Mint 0-supply token
        const mintAddress = await mintTokenForUser(user.email);

        user.mintAddress = mintAddress;
        user.isApproved = true;
        await user.save();

        return res.json({
            message: "User approved successfully",
            mintAddress,
        });

    } catch (err) {
        console.error("APPROVE ERROR:", err);
        return res.status(500).json({
            message: "Internal server error during approval",
        });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        return res.json(users);
    } catch (err) {
        console.error("GET USERS ERROR:", err);
        return res.status(500).json({ message: "Error fetching users" });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json(user);

    } catch (err) {
        return res.status(500).json({ message: "Error fetching user" });
    }
};
