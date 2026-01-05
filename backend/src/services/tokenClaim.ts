import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";

import {
    mintTo,
    getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

import fs from "fs";

export const claimUserTokens = async (
    mintAddress: string,
    userWallet: string
) => {
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL!);

        // ADMIN WALLET
        const adminWallet = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(process.env.WALLET_PATH!, "utf8")))
        );

        // VALIDATE ADDRESSES
        const mint = new PublicKey(mintAddress.trim());
        const userPubkey = new PublicKey(userWallet.trim());

        // CREATE / FETCH ASSOCIATED TOKEN ACCOUNT
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            adminWallet,
            mint,
            userPubkey
        );

        // MINT EXACTLY 1,000,000 TOKENS
        await mintTo(
            connection,
            adminWallet,
            mint,
            ata.address,
            adminWallet,
            1_000_000
        );

        return ata.address.toBase58();

    } catch (err: any) {
        console.error("CLAIM ERROR:", err);
        throw new Error("Token claim failed: " + err.message);
    }
};
