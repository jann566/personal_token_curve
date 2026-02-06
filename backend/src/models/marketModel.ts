import mongoose from 'mongoose';

const MarketSchema = new mongoose.Schema({
  mint: { type: String, required: true, unique: true, index: true },
  marketPda: { type: String, required: true },
  baseMint: { type: String, required: true },
  treasuryBaseAta: { type: String },
  adminFeeAta: { type: String },
  initializedAt: { type: Date },
  initSig: { type: String },
});

export const Market = mongoose.models.Market || mongoose.model('Market', MarketSchema);

export default Market;
