import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import {
    createMint,
} from "@solana/spl-token";
import fs from "fs";

export const mintTokenForUser = async (username: string) => {
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL!, {
            commitment: "confirmed",
        });

        // Admin Wallet laden
        const adminWallet = Keypair.fromSecretKey(
            new Uint8Array(
                JSON.parse(fs.readFileSync(process.env.WALLET_PATH!, "utf8"))
            )
        );

        // Mint erstellen (Supply = 0)
        const mint = await createMint(
            connection,
            adminWallet,
            adminWallet.publicKey,   // mint authority
            null,                     // freeze authority
            0                         // decimals
        );

        console.log("Mint Created:", mint.toBase58());

        // Final return
        return mint.toBase58();

    } catch (err) {
        console.error("MINT ERROR:", err);
        throw new Error("Mint creation failed");
    }
};
