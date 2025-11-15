import { Request, Response } from "express";
import { User } from "../models/userModel";
import { generateToken } from "../utils/tokenGenerator";

// Admin: alle User abrufen
export const getAllUsers = (req: Request, res: Response) => {
    return res.json(User);
};

// Admin: User genehmigen + Token generieren
export const approveUser = (req: Request, res: Response) => {
    const { id, userId } = req.body;

    // sowohl id als auch userId unterstützen
    const finalId = id || userId;

    if (!finalId) {
        return res.status(400).json({ message: "userId oder id ist erforderlich" });
    }

    const user = User.find(u => u.id === finalId);

    if (!user) {
        return res.status(404).json({ message: "User wurde nicht gefunden" });
    }

    // Token generieren (mit 2 Parametern!)
    const token = generateToken(user.id, user.name);

    // User speichern
    user.token = token;

    return res.json({
        message: "User genehmigt",
        user
    });
};


