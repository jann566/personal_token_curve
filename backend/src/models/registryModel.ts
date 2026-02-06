import mongoose, { Schema } from "mongoose";

const RegistryCacheSchema = new Schema(
  {
    // Global mint
    mintAddress: { type: String, required: true, index: true },

    // Subject
    walletAddress: { type: String, required: true, index: true },
    ataAddress: { type: String, required: true, index: true },

    // Proof material
    userHash: { type: String, required: true, index: true },
    registryTx: { type: String, required: true },

    // Status
    approved: { type: Boolean, default: true, index: true },
    approvedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

// Unique: pro mint + wallet nur 1 Eintrag
RegistryCacheSchema.index({ mintAddress: 1, walletAddress: 1 }, { unique: true });

export const RegistryCache = mongoose.model("RegistryCache", RegistryCacheSchema);
