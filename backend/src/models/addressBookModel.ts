import mongoose from 'mongoose';

const AddressBookSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, required: true }, // user_wallet | admin_wallet | mint | pda | ata
    address: { type: String, required: true, index: true, unique: false },
    cluster: { type: String, default: process.env.SOLANA_CLUSTER || 'devnet' },
    notes: { type: String },
  },
  { timestamps: true }
);

export interface IAddressBook extends mongoose.Document {
  label: string;
  type: string;
  address: string;
  cluster: string;
  notes?: string;
}

export default mongoose.models.AddressBook || mongoose.model<IAddressBook>('AddressBook', AddressBookSchema);
