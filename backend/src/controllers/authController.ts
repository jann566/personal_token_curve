import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { IUser, User } from "../models/userModel";

// Erweiterte Typdefinition für req.file
interface RegisterRequest extends Request {
  file: Express.Multer.File;
  body: {
    name: string;
  };
}

export const registerUser = (req: RegisterRequest, res: Response) => {
  const { name } = req.body;
  const file = req.file;

  if (!name || !file) {
    return res.status(400).json({ message: "Name und Datei sind erforderlich" });
  }

  const newUser: IUser = {
    id: Date.now().toString(),
    name,
    filePath: file.path,
    token: null,
  };

  User.push(newUser);

  res.status(201).json({ message: "User registriert", user: newUser });
};
