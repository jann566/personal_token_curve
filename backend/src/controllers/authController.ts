import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel";

export const registerStep1 = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "Email already registered" });

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            email,
            password: hashed,
            registrationStep: 1
        });

        res.json({ message: "Step 1 complete", userId: user._id });
    } catch (err) {
        res.status(500).json(err);
    }
};

export const registerStep2 = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ message: "No PDF uploaded" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.idDocumentPath = file.path;
        user.registrationStep = 2;
        await user.save();

        res.json({ message: "Step 2 complete" });
    } catch (err) {
        res.status(500).json(err);
    }
};

export const registerStep3 = async (req: Request, res: Response) => {
    try {
        const { userId, phantomWallet } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.phantomWallet = phantomWallet;
        user.registrationStep = 3;
        await user.save();

        res.json({ message: "Registration complete" });
    } catch (err) {
        res.status(500).json(err);
    }
};
