import { Request, Response } from "express";
import { User } from "../models/userModel";
import { claimUserTokens } from "../services/tokenClaim";

export const claimToken = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.isApproved)
            return res.status(400).json({ message: "User is not approved yet" });

        if (user.claimed)
            return res.status(400).json({ message: "Tokens already claimed" });

        if (!user.mintAddress)
            return res.status(400).json({ message: "Mint address missing" });

        if (!user.phantomWallet)
            return res.status(400).json({ message: "No Phantom wallet saved" });

        // PERFORM CLAIM
        const ata = await claimUserTokens(
            user.mintAddress,
            user.phantomWallet
        );

        user.claimed = true;
        await user.save();

        return res.json({
            message: "Tokens claimed successfully!",
            ata,
        });

    } catch (err: any) {
        console.error("Claim error:", err);
        return res.status(500).json({ message: "Interner Serverfehler beim Claim" });
    }
};
