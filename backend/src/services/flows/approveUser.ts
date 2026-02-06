import { PublicKey } from "@solana/web3.js";
import crypto from "crypto";

import { getConnection, getPayer } from "../solana/connection";
import { createUserMint } from "../solana/mintService";
import { getOrCreateUserAta } from "../solana/ataService";
import { writeRegistryProof } from "../registry/registryWriter";

import { User } from "../../models/userModel";

/**
 * Variante B: Approve = Mint pro User + ATA + on-chain registry proof
 * KEIN mintToAta mehr -> User claimed später selbst (Claim-Endpoint).
 */
export async function approveUserFlow(params: {
  userId: string;
}): Promise<{
  mintAddress: string;
  ataAddress: string;
  registryTx: string;
  userHash: string;
}> {
  const connection = getConnection();
  const payer = getPayer();

  const user: any = await (User as any).findById(params.userId);
  if (!user) throw new Error("User not found");

  const walletStr = String(user.phantomWallet || "").trim();
  if (!walletStr) throw new Error("User has no phantomWallet saved");

  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletStr);
  } catch {
    throw new Error("Invalid user wallet address");
  }

  // Idempotenz: wenn Mint/ATA schon existieren -> nicht neu erstellen
  // (Claim ist separat, daher claimed hier NICHT relevant)
  if (user.isApproved && user.minted && user.mintAddress && user.ataAddress && user.registryTx) {
    return {
      mintAddress: String(user.mintAddress),
      ataAddress: String(user.ataAddress),
      registryTx: String(user.registryTx),
      userHash: String(user.userHash || ""),
    };
  }

  const decimals = Number(process.env.TOKEN_DECIMALS ?? 9);

  // deterministischer Hash (keine PII on-chain)
  const userHash = crypto
    .createHash("sha256")
    .update(`${user._id}:${wallet.toBase58()}`)
    .digest("hex");

  // 1) Per-user Mint erstellen
  const mint = await createUserMint({
    connection,
    payer,
    decimals,
    mintAuthority: payer.publicKey,
    freezeAuthority: null,
  });

  // 2) ATA für diesen Mint und diese Wallet
  const ata = await getOrCreateUserAta({
    connection,
    payer,
    mint,
    owner: wallet,
  });

  // 3) On-chain Proof (Memo TX)
  const { signature: registryTx } = await writeRegistryProof({
    connection,
    payer,
    mint,
    wallet,
    ata,
    userHash,
  });

  // 4) DB Update
  user.isApproved = true;

  // "minted" bedeutet jetzt: Mint/ATA/Proof erstellt (Supply wird erst beim Claim geminted)
  user.minted = true;
  user.claimed = false;

  user.mintAddress = mint.toBase58();
  user.ataAddress = ata.toBase58();
  user.registryTx = registryTx;
  user.userHash = userHash;

  // mintTx wird NICHT gesetzt, weil hier noch nicht geminted wird
  user.mintTx = "";

  user.registrationStep = Math.max(Number(user.registrationStep || 0), 4);

  await user.save();

  return {
    mintAddress: mint.toBase58(),
    ataAddress: ata.toBase58(),
    registryTx,
    userHash,
  };
}
