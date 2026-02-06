import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";

/**
 * Erstellt einen SPL Mint für genau EINEN User (Variante B).
 * Kein Global Mint, keine ENV-Abhängigkeit.
 */
export async function createUserMint(params: {
  connection: Connection;
  payer: Keypair;
  decimals: number;
  mintAuthority: PublicKey;
  freezeAuthority?: PublicKey | null;
}): Promise<PublicKey> {
  const mint = await createMint(
    params.connection,
    params.payer,                 // zahlt Rent + Fees
    params.mintAuthority,         // Mint Authority (zunächst Admin)
    params.freezeAuthority ?? null,
    params.decimals
  );

  return mint;
}
