import { Connection, PublicKey } from "@solana/web3.js";
import { decodeRegistryMemo, RegistryPayloadV1 } from "./registryTypes";

/**
 * Verifiziert einen Proof:
 * - TX existiert
 * - Admin ist Signer (feePayer / signer check)
 * - Memo enthält korrektes JSON Schema
 * - mint/wallet/ata matchen
 */
export async function verifyRegistryProof(params: {
  connection: Connection;
  signature: string;
  expectedAdmin: PublicKey;
  expectedMint: PublicKey;
  expectedWallet: PublicKey;
  expectedAta: PublicKey;
}): Promise<{ ok: true; payload: RegistryPayloadV1 } | { ok: false; reason: string }> {
  const tx = await params.connection.getTransaction(params.signature, {
    commitment: "confirmed",
  });

  if (!tx) return { ok: false, reason: "TX not found" };

  const msg: any = tx.transaction.message;
  const accountKeys = typeof msg.getAccountKeys === 'function' ? msg.getAccountKeys().staticAccountKeys : msg.accountKeys;

  // Admin muss irgendwo als Signer drin sein — simplest check: feePayer == admin
  const feePayer = accountKeys?.[0];
  if (!feePayer || feePayer.toBase58() !== params.expectedAdmin.toBase58()) {
    return { ok: false, reason: "Admin is not fee payer" };
  }

  // Memo finden: spl-memo program id = MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
  const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

  const ixes: any[] = (tx.transaction.message as any).instructions ?? [];
  let memoStr: string | null = null;

  for (const ix of ixes) {
    const programId = accountKeys[ix.programIdIndex]?.toBase58?.();
    if (programId === MEMO_PROGRAM) {
      // data ist base58/base64 je nach API; in parsed form often Buffer-like
      const raw = ix.data;
      // web3.js liefert bei getTransaction i.d.R. base58 string
      memoStr = typeof raw === "string" ? Buffer.from(raw, "base64").toString("utf8") : null;
      // Fallback: manche RPCs liefern direkt base58
      if (!memoStr && typeof raw === "string") {
        try {
          memoStr = Buffer.from(raw, "base58" as any).toString("utf8");
        } catch {}
      }
      // Wenn das nicht klappt: wir nehmen raw direkt als string (manche RPC geben plain utf8)
      if (!memoStr && typeof raw === "string") memoStr = raw;
      break;
    }
  }

  if (!memoStr) return { ok: false, reason: "No memo instruction found" };

  const payload = decodeRegistryMemo(memoStr);
  if (!payload) return { ok: false, reason: "Invalid memo payload" };

  if (payload.mint !== params.expectedMint.toBase58()) return { ok: false, reason: "Mint mismatch" };
  if (payload.wallet !== params.expectedWallet.toBase58()) return { ok: false, reason: "Wallet mismatch" };
  if (payload.ata !== params.expectedAta.toBase58()) return { ok: false, reason: "ATA mismatch" };

  return { ok: true, payload };
}
