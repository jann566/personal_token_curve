import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// === Konfiguration ===
const DEVNET_URL = "https://api.devnet.solana.com";
const OUTPUT_DIR = path.join(__dirname, "output");

// Output-Ordner sicherstellen
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// === Nutzername aus CLI-Argument ===
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Bitte Nutzernamen angeben: ts-node create_user_token.ts <username>");
  process.exit(1);
}
const username = args[0];
console.log("Erstelle Token für Nutzer:", username);

// Token-Symbol intern für spätere Referenz
const tokenSymbol = username.toUpperCase().replace(/\s+/g, "_").substring(0, 10);
console.log("Token-Symbol:", tokenSymbol);

// === 1. Solana Devnet konfigurieren ===
console.log("Setze Solana auf Devnet...");
execSync(`solana config set --url ${DEVNET_URL}`, { stdio: "inherit" });

// === 2. Wallet erstellen oder überschreiben ===
const walletPath = path.join(OUTPUT_DIR, `${username}_wallet.json`);
if (fs.existsSync(walletPath)) {
  console.log("Wallet existiert bereits, überschreibe mit --force...");
  execSync(`solana-keygen new --outfile ${walletPath} --no-passphrase --force`, { stdio: "inherit" });
} else {
  console.log("Generiere neues Wallet...");
  execSync(`solana-keygen new --outfile ${walletPath} --no-passphrase`, { stdio: "inherit" });
}
console.log("Wallet erstellt:", walletPath);

// === 3. Token erstellen ===
console.log("Erstelle neuen Token...");
const tokenOutput = execSync(`spl-token create-token --decimals 9`).toString();
const tokenAddressMatch = tokenOutput.match(/Address:\s*(\S+)/);
if (!tokenAddressMatch) throw new Error("Token-Adresse konnte nicht ermittelt werden.");
const tokenAddress = tokenAddressMatch[1];
console.log("Token erstellt:", tokenAddress);

// === 4. Token-Account erstellen ===
console.log("Erstelle Token-Account...");
const accountOutput = execSync(`spl-token create-account ${tokenAddress}`).toString();
const accountAddressMatch = accountOutput.match(/Creating account (\S+)/);
if (!accountAddressMatch) throw new Error("Token-Account konnte nicht ermittelt werden.");
const accountAddress = accountAddressMatch[1];
console.log("Token-Account erstellt:", accountAddress);

// === 5. Tokens minten ===
const amountToMint = 1000000;
console.log(`Mint ${amountToMint} Tokens auf den Account...`);
execSync(`spl-token mint ${tokenAddress} ${amountToMint}`, { stdio: "inherit" });
console.log(`Minting abgeschlossen: ${amountToMint} Tokens auf ${accountAddress}`);

// === 6. Ergebnisse speichern ===
const resultPath = path.join(OUTPUT_DIR, `${username}_token_info.json`);
fs.writeFileSync(resultPath, JSON.stringify({
  username,
  wallet: walletPath,
  token: tokenAddress,
  account: accountAddress,
  amountMinted: amountToMint,
  tokenSymbol
}, null, 2));
console.log("Alle Daten gespeichert in:", resultPath);
