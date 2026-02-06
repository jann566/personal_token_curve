import "dotenv/config";
import fs from "fs";
import path from "path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

/**
 * Single source of truth:
 * - RPC: SOLANA_RPC_URL (fallback HELIUS_RPC_URL)
 * - Payer/Admin keypair: WALLET_PATH (e.g. ./id.json)
 *
 * No SOLANA_PRIVATE_KEY in env anymore.
 */

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return String(v).trim();
}

let _connection: Connection | null = null;
let _payer: Keypair | null = null;

export function getConnection(): Connection {
  if (_connection) return _connection;

  const rpcUrl = (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "").trim();
  if (!rpcUrl) throw new Error("Missing env var: SOLANA_RPC_URL (or HELIUS_RPC_URL)");

  _connection = new Connection(rpcUrl, "confirmed");
  return _connection;
}

function loadKeypairFromWalletPath(): Keypair {
  const walletPath = mustEnv("WALLET_PATH");

  const absPath = path.isAbsolute(walletPath)
    ? walletPath
    : path.join(process.cwd(), walletPath);

  const raw = fs.readFileSync(absPath, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

export function getPayer(): Keypair {
  if (_payer) return _payer;
  _payer = loadKeypairFromWalletPath();
  return _payer;
}

export function getAdminPubkey(): PublicKey {
  return getPayer().publicKey;
}
