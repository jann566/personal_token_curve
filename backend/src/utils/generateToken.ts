import jwt from "jsonwebtoken";

const SECRET = "SUPER_SECRET_KEY_CHANGE_ME";

export const generateToken = (payload: object): string => {
    return jwt.sign(payload, SECRET, { expiresIn: "7d" });
};
