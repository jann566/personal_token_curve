import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/database";

import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import userRoutes from "./routes/userRoutes";
import registryRoutes from "./routes/registryRoutes";
import hubRoutes from "./routes/hubRoutes";
import path from "path";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

connectDB();

app.get("/health", (_req, res) => res.json({ ok: true }));

// Serve local admin.html (development convenience)
app.get("/admin.html", (_req, res) => {
  const adminPath = path.resolve(__dirname, "..", "..", "frontend_v2", "public", "admin.html");
  return res.sendFile(adminPath);
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/registry", registryRoutes);
app.use("/hub", hubRoutes);

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
