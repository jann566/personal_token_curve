import { Request, Response } from "express";
import { User } from "../models/userModel";
import { claimTokenFlow } from "../services/flows/claimToken";
import { PublicKey, Transaction } from '@solana/web3.js';
import { getConnection, getPayer } from '../services/solana/connection';
import { getAssociatedTokenAddress, createMintToInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export const getUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId?: string };
    if (!userId) return res.status(400).json({ message: "userId missing" });

    const user = await User.findById(userId).select(
      "isApproved claimed phantomWallet mintAddress ataAddress registrationStep"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      userId: String(user._id),
      approved: user.isApproved,
      claimed: user.claimed,
      phantomWallet: user.phantomWallet,
      mintAddress: user.mintAddress,
      ataAddress: user.ataAddress,
      registrationStep: user.registrationStep,
    });
  } catch (err: any) {
    console.error("GET USER STATUS ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

export const getUserStatusByWallet = async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params as { wallet?: string };
    if (!wallet) return res.status(400).json({ message: 'wallet missing' });

    const normalized = String(wallet).trim();
    const user = await User.findOne({ phantomWallet: normalized }).select(
      'isApproved claimed phantomWallet mintAddress ataAddress registrationStep'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      userId: String(user._id),
      approved: user.isApproved,
      claimed: user.claimed,
      phantomWallet: user.phantomWallet,
      mintAddress: user.mintAddress,
      ataAddress: user.ataAddress,
      registrationStep: user.registrationStep,
    });
  } catch (err: any) {
    console.error('GET USER STATUS BY WALLET ERROR:', err);
    return res.status(500).json({ message: err?.message ?? 'Internal server error' });
  }
};

export const claimToken = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ message: "userId missing" });

    const supplyStr = process.env.INITIAL_SUPPLY_BASE_UNITS ?? "0";
    let amountBaseUnits: bigint;
    try {
      amountBaseUnits = BigInt(supplyStr);
    } catch {
      return res.status(500).json({
        message: "INITIAL_SUPPLY_BASE_UNITS invalid (must be integer string)",
      });
    }

    const result = await claimTokenFlow({
      userId: String(userId),
      amountBaseUnits,
    });

    return res.json({
      message: "Claim successful",
      ...result,
    });
  } catch (err: any) {
    console.error("CLAIM ERROR:", err);
    return res.status(500).json({ message: err?.message ?? "Internal server error" });
  }
};

/**
 * Build unsigned claim transaction: Backend returns unsigned tx for user to sign.
 * Client must sign (fee payer = user) and POST the signed tx to /user/tx/claim/confirm
 */
export const createClaimTx = async (req: Request, res: Response) => {
  try {
    const { userId, wallet } = req.body as { userId?: string; wallet?: string };
    if (!userId || !wallet) return res.status(400).json({ message: 'userId and wallet required' });

    const user: any = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isApproved) return res.status(400).json({ message: 'User is not approved' });
    if (user.claimed) return res.status(400).json({ message: 'User has already claimed' });
    if (!user.mintAddress) return res.status(400).json({ message: 'User has no mintAddress' });

    // Ensure provided wallet matches stored phantomWallet
    if (user.phantomWallet && user.phantomWallet !== String(wallet).trim()) {
      return res.status(400).json({ message: 'Wallet does not match registered user' });
    }

    const connection = getConnection();
    const mint = new PublicKey(String(user.mintAddress));
    const owner = new PublicKey(String(wallet));

    // derive or use stored ata
    const ata = user.ataAddress ? new PublicKey(String(user.ataAddress)) : await getAssociatedTokenAddress(mint, owner);

    const supplyStr = process.env.INITIAL_SUPPLY_BASE_UNITS ?? '0';
    const amount = BigInt(supplyStr);

    const ix = createMintToInstruction(mint, ata, getPayer().publicKey, amount, [], TOKEN_PROGRAM_ID);

    const tx = new Transaction();
    tx.add(ix);
    tx.feePayer = owner;
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

    const serialized = tx.serialize({ requireAllSignatures: false });
    return res.json({ tx: serialized.toString('base64'), recentBlockhash: latest.blockhash });
  } catch (err: any) {
    console.error('CREATE CLAIM TX ERROR:', err);
    return res.status(500).json({ message: err?.message ?? 'Internal server error' });
  }
};

/**
 * Confirm claim: client submits partially-signed tx (signed by user). Backend will co-sign (mint authority) and submit.
 */
export const confirmClaimTx = async (req: Request, res: Response) => {
  try {
    const { userId, signedTx } = req.body as { userId?: string; signedTx?: string };
    if (!userId || !signedTx) return res.status(400).json({ message: 'userId and signedTx required' });

    const user: any = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isApproved) return res.status(400).json({ message: 'User is not approved' });
    if (user.claimed) return res.status(400).json({ message: 'User has already claimed' });

    const connection = getConnection();
    const payer = getPayer();

    const txBuf = Buffer.from(signedTx, 'base64');
    const tx = Transaction.from(txBuf);

    // Backend (mint authority) co-signs
    tx.partialSign(payer);

    const raw = tx.serialize();
    const sig = await connection.sendRawTransaction(raw);
    await connection.confirmTransaction(sig, 'confirmed');

    // update user claimed flag and store tx sig
    user.claimed = true;
    user.mintTx = sig;
    await user.save();

    return res.json({ message: 'Claim successful', claimTx: sig });
  } catch (err: any) {
    console.error('CONFIRM CLAIM TX ERROR:', err);
    return res.status(500).json({ message: err?.message ?? 'Internal server error' });
  }
};

export const getBalancesByWallet = async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params as { wallet?: string };
    if (!wallet) return res.status(400).json({ message: 'wallet missing' });

    const connection = getConnection();
    const owner = new PublicKey(String(wallet));

    const solBalance = await connection.getBalance(owner, 'confirmed');

    const parsed = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });

    const tokens = parsed.value.map((t) => {
      const info = (t.account.data as any).parsed?.info;
      const mint = info?.mint;
      const tokenAmount = info?.tokenAmount;
      return {
        pubkey: t.pubkey.toBase58(),
        mint,
        amount: tokenAmount?.amount ?? '0',
        uiAmountString: tokenAmount?.uiAmountString ?? '0',
        decimals: tokenAmount?.decimals ?? 0,
      };
    });

    return res.json({ sol: solBalance, tokens });
  } catch (err: any) {
    console.error('GET BALANCES ERROR:', err);
    return res.status(500).json({ message: err?.message ?? 'Internal server error' });
  }
};
