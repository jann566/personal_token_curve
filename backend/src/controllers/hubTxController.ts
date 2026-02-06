import { Request, Response } from 'express';
import { PublicKey, Transaction, SystemProgram, Connection } from '@solana/web3.js';
import { getOrCreateUserAta, mintToAta } from '../services/solana/ataService';
import { getConnection, getPayer } from '../services/solana/connection';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const ESCROW_PUBKEY = process.env.ESCROW_PUBKEY || '';
const ESCROW_TOKEN_ACCOUNT = process.env.ESCROW_TOKEN_ACCOUNT || '';

export async function createBuyTransaction(req: Request, res: Response) {
  try {
    const { buyer, lamports } = req.body as { buyer: string; lamports: number };
    if (!buyer || !lamports) return res.status(400).json({ error: 'Missing buyer or lamports' });

    const connection: Connection = getConnection();
    const buyerPub = new PublicKey(buyer);
    const toPub = new PublicKey(ESCROW_PUBKEY);

    const tx = new Transaction();
    tx.add(
      SystemProgram.transfer({ fromPubkey: buyerPub, toPubkey: toPub, lamports })
    );

    let latest;
    if (typeof (connection as any).getLatestBlockhash === 'function') {
      try {
        latest = await (connection as any).getLatestBlockhash('finalized');
      } catch {
        latest = await (connection as any).getLatestBlockhash();
      }
    } else {
      latest = await (connection as any).getRecentBlockhash();
    }
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = buyerPub;

    // Serialize unsigned transaction (missing signature). Frontend will deserialize and sign.
    const serialized = tx.serialize({ requireAllSignatures: false });
    const b64 = serialized.toString('base64');

    return res.json({ tx: b64, recentBlockhash: latest.blockhash });
  } catch (err) {
    console.error('[hubTx] createBuyTransaction error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function confirmBuyTransaction(req: Request, res: Response) {
  try {
    const { signature, buyer, mint, amount } = req.body as {
      signature: string;
      buyer: string;
      mint: string;
      amount: string; // base units as string
    };
    if (!signature || !buyer || !mint || !amount) return res.status(400).json({ error: 'Missing params' });

    const connection = getConnection();

    // Wait for confirmation
    const status = await connection.getSignatureStatus(signature);
    if (!status || !status.value || status.value.err) {
      return res.status(400).json({ error: 'tx_failed_or_unconfirmed' });
    }

    // Mint tokens to buyer ATA using existing ataService which uses backend mint authority
    const buyerPub = new PublicKey(buyer);
    const mintPub = new PublicKey(mint);

    // Ensure ATA exists and mint tokens to it. Use server WALLET_PATH as payer/authority.
    const payer = getPayer();
    const ata = await getOrCreateUserAta({ connection, payer, mint: mintPub, owner: buyerPub });
    await mintToAta({ connection, payer, mint: mintPub, ata, amount: BigInt(amount) });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[hubTx] confirmBuyTransaction error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function createSellTransaction(req: Request, res: Response) {
  try {
    const { seller, mint, tokenAmount } = req.body as { seller: string; mint: string; tokenAmount: string };
    if (!seller || !mint || !tokenAmount) return res.status(400).json({ error: 'Missing params' });

    const connection: Connection = getConnection();
    const sellerPub = new PublicKey(seller);
    const mintPub = new PublicKey(mint);

    // compute seller ATA
    const sellerAta = await getAssociatedTokenAddress(mintPub, sellerPub);

    if (!ESCROW_TOKEN_ACCOUNT) {
      return res.status(500).json({ error: 'ESCROW_TOKEN_ACCOUNT not configured' });
    }
    const escrowTokenAcct = new PublicKey(ESCROW_TOKEN_ACCOUNT);

    // build token transfer instruction
    const amount = BigInt(tokenAmount);
    const transferIx = createTransferInstruction(
      sellerAta,
      escrowTokenAcct,
      sellerPub,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );

    const tx = new Transaction();
    tx.add(transferIx);

    let latest;
    if (typeof (connection as any).getLatestBlockhash === 'function') {
      try {
        latest = await (connection as any).getLatestBlockhash('finalized');
      } catch {
        latest = await (connection as any).getLatestBlockhash();
      }
    } else {
      latest = await (connection as any).getRecentBlockhash();
    }
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = sellerPub;

    const serialized = tx.serialize({ requireAllSignatures: false });
    const b64 = serialized.toString('base64');
    return res.json({ tx: b64, recentBlockhash: latest.blockhash });
  } catch (err) {
    console.error('[hubTx] createSellTransaction error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export async function confirmSellTransaction(req: Request, res: Response) {
  try {
    const { signature, seller, mint, tokenAmount, lamports } = req.body as {
      signature: string;
      seller: string;
      mint: string;
      tokenAmount: string;
      lamports: number;
    };
    if (!signature || !seller || !mint || !tokenAmount || lamports == null) return res.status(400).json({ error: 'Missing params' });

    const connection = getConnection();
    const status = await connection.getSignatureStatus(signature);
    if (!status || !status.value || status.value.err) {
      return res.status(400).json({ error: 'tx_failed_or_unconfirmed' });
    }

    // After escrow received tokens, pay seller in SOL
    const sellerPub = new PublicKey(seller);
    const payer = getPayer();

    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: sellerPub, lamports }));
    tx.feePayer = payer.publicKey;
    let latest;
    if (typeof (connection as any).getLatestBlockhash === 'function') {
      try {
        latest = await (connection as any).getLatestBlockhash('finalized');
      } catch {
        latest = await (connection as any).getLatestBlockhash();
      }
    } else {
      latest = await (connection as any).getRecentBlockhash();
    }
    tx.recentBlockhash = latest.blockhash;

    const signed = await connection.sendTransaction(tx, [payer]);
    await connection.confirmTransaction(signed, 'confirmed');

    return res.json({ ok: true });
  } catch (err) {
    console.error('[hubTx] confirmSellTransaction error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
