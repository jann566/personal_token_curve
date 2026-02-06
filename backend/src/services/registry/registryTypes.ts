export type RegistryPayloadV1 = {
  v: 1;
  mint: string;        // base58
  wallet: string;      // base58
  ata: string;         // base58
  userHash: string;    // hex/base64 whatever
  ts: number;          // unix ms
};

export function encodeRegistryMemo(p: RegistryPayloadV1): string {
  return JSON.stringify(p);
}

export function decodeRegistryMemo(raw: string): RegistryPayloadV1 | null {
  try {
    const obj = JSON.parse(raw);
    if (obj?.v !== 1) return null;
    if (!obj.mint || !obj.wallet || !obj.ata || !obj.userHash || !obj.ts) return null;
    return obj as RegistryPayloadV1;
  } catch {
    return null;
  }
}
