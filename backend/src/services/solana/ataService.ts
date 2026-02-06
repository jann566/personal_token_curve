import { Connection, Keypair, PublicKey, TransactionSignature } from "@solana/web3.js";
import * as splToken from "@solana/spl-token";

export async function getOrCreateUserAta(params: {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
  owner: PublicKey;
}): Promise<PublicKey> {
  const ata = await splToken.getOrCreateAssociatedTokenAccount(
    params.connection,
    params.payer,
    params.mint,
    params.owner
  );
  return ata.address;
}

export async function mintToAta(params: {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
  ata: PublicKey;
  amount: bigint; // in base units
}): Promise<TransactionSignature> {
  try {
    // spl-token mintTo nimmt number | bigint je nach Version.
    // Hier geben wir die payer Keypair als authority (Signers werden korrekt angefügt)
    // und konvertieren amount zu number wenn möglich.
    let amount: number | bigint = params.amount;
    try {
      const asNumber = Number(params.amount);
      if (Number.isFinite(asNumber) && asNumber <= Number.MAX_SAFE_INTEGER) {
        amount = asNumber;
      }
    } catch (e) {
      // leave as bigint
    }

    const sig = await splToken.mintTo(
      params.connection,
      params.payer,
      params.mint,
      params.ata,
      params.payer, // use Keypair so signature is included
      amount as any
    );

    return sig;
  } catch (err) {
    console.error('mintToAta failed', { mint: params.mint.toBase58(), ata: params.ata.toBase58(), amount: String(params.amount), error: err });
    throw err;
  }
}
