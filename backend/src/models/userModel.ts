import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    // Auth
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },

    // Profile
    fullName: { type: String },
    username: { type: String },
    idDocumentPath: { type: String },

    // Wallet
    phantomWallet: { type: String, index: true },

    // Flow-State
    registrationStep: { type: Number, default: 1, index: true },
    isApproved: { type: Boolean, default: false, index: true },

    // Token System (Global Mint)
    minted: { type: Boolean, default: false, index: true }, // schützt vor Double-Mint
    mintAddress: { type: String }, // per-user mint address
    ataAddress: { type: String }, // ATA des Users für globalen Mint

    // On-chain Proof / Audit
    userHash: { type: String, index: true }, // sha256(userId:wallet:mint)
    mintTx: { type: String }, // TX-Signatur vom mintTo
    registryTx: { type: String }, // TX-Signatur vom Memo/Proof

    // Optional Claim-Path (wenn du C2 verwendest)
    claimed: { type: Boolean, default: false, index: true },
    claimTx: { type: String },
  },
  { timestamps: true }
);

// Optional: saubere Indexe (hilft später beim Admin-Dashboard)
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phantomWallet: 1 });
UserSchema.index({ isApproved: 1, minted: 1 });

export const User = mongoose.model("User", UserSchema);
