// src/utils/tokenGenerator.ts
import jwt from "jsonwebtoken";

// Secret für JWT (in der Produktion als ENV-Variable speichern)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Funktion, um einen personalisierten Token zu generieren
export const generateToken = (userId: string, userName: string) => {
  const payload = {
    id: userId,
    name: userName,
    createdAt: new Date().toISOString(),
  };

  // Token gültig für 7 Tage
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

  return token;
};
