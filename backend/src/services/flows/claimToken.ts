import { PublicKey } from "@solana/web3.js";

import { getConnection, getPayer } from "../solana/connection";
import { mintToAta } from "../solana/ataService";
import { User } from "../../models/userModel";

/**
 * Claim = mint initial supply (einmalig) an die ATA des Users.
 * Voraussetzung: User approved + mintAddress + ataAddress vorhanden.
 * Idempotent: wenn claimed=true -> gibt vorhandene Daten zurück.
 */
export async function claimTokenFlow(params: {
  userId: string;
  amountBaseUnits: bigint;
}): Promise<{
  mintAddress: string;
  ataAddress: string;
  claimTx: string;
}> {
  const connection = getConnection();
  const payer = getPayer();

  const user: any = await (User as any).findById(params.userId);
  if (!user) throw new Error("User not found");

  if (!user.isApproved) throw new Error("User is not approved");
  if (!user.mintAddress) throw new Error("User has no mintAddress");
  if (!user.ataAddress) throw new Error("User has no ataAddress");

  // Idempotenz: wenn schon geclaimt, nichts mehr tun
  if (user.claimed && user.mintTx) {
    return {
      mintAddress: String(user.mintAddress),
      ataAddress: String(user.ataAddress),
      claimTx: String(user.mintTx), // wir re-verwenden mintTx als claimTx (kein Schema-Change nötig)
    };
  }

  const mint = new PublicKey(String(user.mintAddress));
  const ata = new PublicKey(String(user.ataAddress));

  // Mint initial supply (Admin/Payer ist Mint Authority)
  const claimTx = await mintToAta({
    connection,
    payer,
    mint,
    ata,
    amount: params.amountBaseUnits,
  });

  user.claimed = true;
  user.mintTx = claimTx; // wir nutzen mintTx als "Claim-TX"
  await user.save();

  return {
    mintAddress: mint.toBase58(),
    ataAddress: ata.toBase58(),
    claimTx,
  };
}
