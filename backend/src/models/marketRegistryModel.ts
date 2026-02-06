import mongoose from 'mongoose';

const MarketRegistrySchema = new mongoose.Schema(
  {
    mint: { type: String, required: true, unique: true },
    programId: { type: String },
    baseMint: { type: String },
    marketPda: { type: String },
    treasuryAuthorityPda: { type: String },
    treasuryBaseAta: { type: String },
    adminFeeAta: { type: String },
    lastInitSig: { type: String },
    lastVerifiedSlot: { type: Number },
    status: {
      type: String,
      enum: ['missing', 'initialized', 'failed'],
      default: 'missing',
    },
    lastError: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.MarketRegistry || mongoose.model('MarketRegistry', MarketRegistrySchema);
