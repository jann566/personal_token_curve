import { Request, Response } from "express";
import { User } from "../models/userModel";
import { generateToken } from "../utils/generateToken";

export const getAllUsers = (req: Request, res: Response) => {
    return res.json(User);
};

export const approveUser = (req: Request, res: Response) => {
    const { id, userId } = req.body;

    // akzeptiert beide
    const finalId = id || userId;

    if (!finalId) {
        return res.status(400).json({ message: "userId oder id ist erforderlich" });
    }

    const user = User.find(u => u.id === finalId);

    if (!user) {
        return res.status(404).json({ message: "User wurde nicht gefunden" });
    }

    // Token generieren
    const token = generateToken({
        id: user.id,
        name: user.name
    });

    user.token = token;

    return res.json({
        message: "User genehmigt",
        user
    });
};


