import { Connection, Keypair, PublicKey, Transaction, TransactionSignature } from "@solana/web3.js";
import { createMemoInstruction } from "@solana/spl-memo";
import { encodeRegistryMemo, RegistryPayloadV1 } from "./registryTypes";

/**
 * Schreibt einen unveränderbaren on-chain Proof als Memo-TX.
 * Admin (payer) signiert => Proof ist öffentlich verifizierbar.
 */
export async function writeRegistryProof(params: {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
  wallet: PublicKey;
  ata: PublicKey;
  userHash: string;
}): Promise<{ signature: TransactionSignature; payload: RegistryPayloadV1 }> {
  const payload: RegistryPayloadV1 = {
    v: 1,
    mint: params.mint.toBase58(),
    wallet: params.wallet.toBase58(),
    ata: params.ata.toBase58(),
    userHash: params.userHash,
    ts: Date.now(),
  };

  const memo = encodeRegistryMemo(payload);

  const tx = new Transaction().add(
    createMemoInstruction(memo, [params.payer.publicKey])
  );

  const sig = await params.connection.sendTransaction(tx, [params.payer]);
  await params.connection.confirmTransaction(sig, "confirmed");

  return { signature: sig, payload };
}
