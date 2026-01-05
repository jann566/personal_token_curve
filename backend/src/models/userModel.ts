import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true },
    password: { type: String, required: true },

    username: { type: String },
    idDocumentPath: { type: String },
    phantomWallet: { type: String },

    isApproved: { type: Boolean, default: false },
    mintAddress: { type: String },

    claimed: { type: Boolean, default: false },

    registrationStep: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
