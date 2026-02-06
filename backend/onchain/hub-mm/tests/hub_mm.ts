import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { HubMm } from "../target/types/hub_mm";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createMint,
  getMint,
  createAssociatedTokenAccountIdempotent,
  mintTo,
  setAuthority,
  AuthorityType,
} from "@solana/spl-token";
import { expect } from "chai";

import { quoteBuy, quoteSell } from "./quote";

describe("hub_mm", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.HubMm as Program<HubMm>;
  const connection = provider.connection;
  const admin = provider.wallet.publicKey;

  // --- PATCH PROVIDER: robust sendAndConfirm (fixes "Blockhash not found") ---
  const origSendAndConfirm = provider.sendAndConfirm.bind(provider);
  provider.sendAndConfirm = async (tx: any, signers?: any, opts?: any) => {
    const latest1 = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest1.blockhash;
    tx.feePayer = provider.wallet.publicKey;

    const sig = await origSendAndConfirm(tx, signers, {
      ...opts,
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      skipPreflight: false,
    });

    const latest2 = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest2.blockhash,
        lastValidBlockHeight: latest2.lastValidBlockHeight,
      },
      "confirmed"
    );

    return sig;
  };

  async function confirmSig(signature: string) {
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
  }

  async function airdrop(pubkey: PublicKey, lamports = 2e9) {
    const sig = await connection.requestAirdrop(pubkey, lamports);
    await confirmSig(sig);
  }

  // Hard assert helpers to kill flaky “AccountNotInitialized”
  async function assertIsMint(mint: PublicKey, label: string) {
    const maxTries = 15;
    const sleepMs = 200;

    let info = await connection.getAccountInfo(mint, "confirmed");

    for (let i = 0; i < maxTries && !info; i++) {
      await new Promise((r) => setTimeout(r, sleepMs));
      info = await connection.getAccountInfo(mint, "confirmed");
    }

    console.log(`[DEBUG ${label}]`, mint.toBase58(), "exists?", !!info);
    if (!info) {
      throw new Error(`[${label}] mint account missing (after retries)`);
    }

    console.log(
      `[DEBUG ${label}] owner=`,
      info.owner.toBase58(),
      "dataLen=",
      info.data.length
    );

    if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
      throw new Error(
        `[${label}] mint owner mismatch. Expected TOKEN_PROGRAM_ID (${TOKEN_PROGRAM_ID.toBase58()}), got ${info.owner.toBase58()}`
      );
    }

    if (info.data.length !== 82) {
      throw new Error(
        `[${label}] mint data length unexpected: ${info.data.length}`
      );
    }
  }

  async function assertTokenBalance(
    ataPk: PublicKey,
    label: string,
    min: bigint = 0n
  ) {
    const bal = BigInt(
      (await connection.getTokenAccountBalance(ataPk)).value.amount
    );
    console.log(
      `[DEBUG ${label}] ata=${ataPk.toBase58()} bal=${bal.toString()}`
    );
    if (bal < min)
      throw new Error(`[${label}] balance too low: ${bal.toString()}`);
  }

  function ata(mint: PublicKey, owner: PublicKey, allowOffCurve = false) {
    return getAssociatedTokenAddressSync(
      mint,
      owner,
      allowOffCurve,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  it("init_market: creates market + treasury/admin ATAs via init_market", async () => {
    const mintAuthority = Keypair.generate();
    await airdrop(mintAuthority.publicKey);

    const tokenMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    const baseMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    await assertIsMint(tokenMint, "init_market tokenMint");
    await assertIsMint(baseMint, "init_market baseMint");

    const tokenMintInfo = await getMint(connection, tokenMint, "confirmed");
    const baseMintInfo = await getMint(connection, baseMint, "confirmed");
    expect(tokenMintInfo.decimals).to.equal(9);
    expect(baseMintInfo.decimals).to.equal(9);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), tokenMint.toBuffer()],
      program.programId
    );

    const [treasuryAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_authority"), marketPda.toBuffer()],
      program.programId
    );

    const treasuryBaseAta = ata(baseMint, treasuryAuthorityPda, true);
    const adminFeeAta = ata(baseMint, admin, false);

    await createAssociatedTokenAccountIdempotent(
      connection,
      mintAuthority,
      baseMint,
      admin
    );

    const vBase = new anchor.BN(1_000_000_000);
    const vToken = new anchor.BN(1_000_000_000);
    const feeBps = 100;
    const protocolFeeShareBps = 5000;

    const sig = await program.methods
      .initMarket(vBase, vToken, feeBps, protocolFeeShareBps)
      .accounts({
        admin,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        treasuryBaseAta,
        adminFeeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc({ commitment: "confirmed" });

    await confirmSig(sig);

    const marketAcc = await program.account.hubMarket.fetch(marketPda);
    expect(marketAcc.admin.toBase58()).to.equal(admin.toBase58());
    expect(marketAcc.mint.toBase58()).to.equal(tokenMint.toBase58());
    expect(marketAcc.baseMint.toBase58()).to.equal(baseMint.toBase58());
    expect(marketAcc.treasuryBaseAta.toBase58()).to.equal(
      treasuryBaseAta.toBase58()
    );
    expect(marketAcc.adminFeeAta.toBase58()).to.equal(adminFeeAta.toBase58());
    expect(marketAcc.vBase.toString()).to.equal(vBase.toString());
    expect(marketAcc.vToken.toString()).to.equal(vToken.toString());
    expect(marketAcc.feeBps).to.equal(feeBps);
    expect(marketAcc.protocolFeeShareBps).to.equal(protocolFeeShareBps);
    expect(marketAcc.isPaused).to.equal(false);
  });

  it("register_user: writes RegistryEntry PDA (seeded by owner wallet)", async () => {
    const mintAuthority = Keypair.generate();
    await airdrop(mintAuthority.publicKey);

    const tokenMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    const owner = Keypair.generate();
    await airdrop(owner.publicKey);

    const [registryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry"), owner.publicKey.toBuffer()],
      program.programId
    );

    const kycHash = new Uint8Array(32);

    const ix = (program as any).instruction.registerUser
      ? await (program as any).instruction.registerUser(Array.from(kycHash), {
          accounts: {
            admin,
            ownerWallet: owner.publicKey,
            mint: tokenMint,
            registry: registryPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          },
        })
      : await (program as any).instruction.register_user(Array.from(kycHash), {
          accounts: {
            admin,
            ownerWallet: owner.publicKey,
            mint: tokenMint,
            registry: registryPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          },
        });

    const tx = new Transaction().add(ix);
    const sig = await provider.sendAndConfirm(tx, [], {
      commitment: "confirmed",
    });
    await confirmSig(sig);

    const entry = await program.account.registryEntry.fetch(registryPda);
    expect(entry.admin.toBase58()).to.equal(admin.toBase58());
    expect(entry.ownerWallet.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(entry.mint.toBase58()).to.equal(tokenMint.toBase58());
  });

  it("swap_buy: user buys token with base; mints out + routes base + fee", async () => {
    const mintAuthority = Keypair.generate();
    await airdrop(mintAuthority.publicKey);

    const tokenMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    const baseMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    await assertIsMint(tokenMint, "swap_buy tokenMint");
    await assertIsMint(baseMint, "swap_buy baseMint");

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), tokenMint.toBuffer()],
      program.programId
    );

    const [treasuryAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_authority"), marketPda.toBuffer()],
      program.programId
    );

    const treasuryBaseAta = ata(baseMint, treasuryAuthorityPda, true);
    const adminFeeAta = ata(baseMint, admin, false);

    await createAssociatedTokenAccountIdempotent(
      connection,
      mintAuthority,
      baseMint,
      admin
    );

    const feeBps = 100;           // 1%
    const protocolFeeShareBps = 5_000; // 50% der Fee -> adminFeeAta, 50% bleibt Treasury


    const initSig = await program.methods
      .initMarket(
        new anchor.BN(1_000_000_000),
        new anchor.BN(1_000_000_000),
        feeBps,
        protocolFeeShareBps
      )
      .accounts({
        admin,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        treasuryBaseAta,
        adminFeeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc({ commitment: "confirmed" });
    await confirmSig(initSig);

    await setAuthority(
      connection,
      mintAuthority,
      tokenMint,
      mintAuthority.publicKey,
      AuthorityType.MintTokens,
      treasuryAuthorityPda
    );

    const user = Keypair.generate();
    await airdrop(user.publicKey);

    const userBaseAta = await createAssociatedTokenAccountIdempotent(
      connection,
      user,
      baseMint,
      user.publicKey
    );

    const userTokenAta = await createAssociatedTokenAccountIdempotent(
      connection,
      user,
      tokenMint,
      user.publicKey
    );

    const mSig = await mintTo(
      connection,
      mintAuthority,
      baseMint,
      userBaseAta,
      mintAuthority.publicKey,
      2_000_000_000n
    );
    await confirmSig(mSig);

    await assertTokenBalance(
      userBaseAta,
      "swap_buy userBaseAta",
      1_000_000_000n
    );

    const treasuryBefore = BigInt(
      (await connection.getTokenAccountBalance(treasuryBaseAta)).value.amount
    );
    const feeBefore = BigInt(
      (await connection.getTokenAccountBalance(adminFeeAta)).value.amount
    );
    const userBefore = BigInt(
      (await connection.getTokenAccountBalance(userBaseAta)).value.amount
    );

    const baseIn = new anchor.BN(1_000_000_000);
    const buySig = await program.methods
      .swapBuy(baseIn, new anchor.BN(1))
      .accounts({
        user: user.publicKey,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        userBaseAta,
        treasuryBaseAta,
        adminFeeAta,
        userTokenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([user])
      .rpc({ commitment: "confirmed" });
    await confirmSig(buySig);

    const treasuryAfter = BigInt(
      (await connection.getTokenAccountBalance(treasuryBaseAta)).value.amount
    );
    const feeAfter = BigInt(
      (await connection.getTokenAccountBalance(adminFeeAta)).value.amount
    );
    const userAfter = BigInt(
      (await connection.getTokenAccountBalance(userBaseAta)).value.amount
    );

    expect(userAfter < userBefore).to.equal(true);
    // treasury still increases (base_in - protocol_fee)
    expect(treasuryAfter > treasuryBefore).to.equal(true);
    expect(feeAfter > feeBefore).to.equal(true);

    const received = BigInt(
      (await connection.getTokenAccountBalance(userTokenAta)).value.amount
    );
    expect(received > 0n).to.equal(true);
  });

it("swap_sell: user sells token for base; burns + pays out (fee split admin/treasury)", async () => {
  const mintAuthority = Keypair.generate();
  await airdrop(mintAuthority.publicKey);

  const tokenMint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    9
  );

  const baseMint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    9
  );

  await assertIsMint(tokenMint, "swap_sell tokenMint");
  await assertIsMint(baseMint, "swap_sell baseMint");

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), tokenMint.toBuffer()],
    program.programId
  );
  const [treasuryAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_authority"), marketPda.toBuffer()],
    program.programId
  );

  const treasuryBaseAta = ata(baseMint, treasuryAuthorityPda, true);
  const adminFeeAta = ata(baseMint, admin, false);

  await createAssociatedTokenAccountIdempotent(
    connection,
    mintAuthority,
    baseMint,
    admin
  );

  // ✅ 1% total fee, 50% of fee to admin => 0.5% admin + 0.5% treasury
  const initSig = await program.methods
    .initMarket(
      new anchor.BN(1_000_000_000),
      new anchor.BN(1_000_000_000),
      100,
      5_000
    )
    .accounts({
      admin,
      mint: tokenMint,
      baseMint,
      market: marketPda,
      treasuryAuthority: treasuryAuthorityPda,
      treasuryBaseAta,
      adminFeeAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc({ commitment: "confirmed" });
  await confirmSig(initSig);

  await setAuthority(
    connection,
    mintAuthority,
    tokenMint,
    mintAuthority.publicKey,
    AuthorityType.MintTokens,
    treasuryAuthorityPda
  );

  const user = Keypair.generate();
  await airdrop(user.publicKey);

  const userBaseAta = await createAssociatedTokenAccountIdempotent(
    connection,
    user,
    baseMint,
    user.publicKey
  );

  const userTokenAta = await createAssociatedTokenAccountIdempotent(
    connection,
    user,
    tokenMint,
    user.publicKey
  );

  const mSig = await mintTo(
    connection,
    mintAuthority,
    baseMint,
    userBaseAta,
    mintAuthority.publicKey,
    3_000_000_000n
  );
  await confirmSig(mSig);

  await assertTokenBalance(userBaseAta, "swap_sell userBaseAta", 1_000_000_000n);

  // buy first to seed treasury with base + give user tokens
  const buySig = await program.methods
    .swapBuy(new anchor.BN(500_000_000), new anchor.BN(0))
    .accounts({
      user: user.publicKey,
      mint: tokenMint,
      baseMint,
      market: marketPda,
      treasuryAuthority: treasuryAuthorityPda,
      userBaseAta,
      treasuryBaseAta,
      adminFeeAta,
      userTokenAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([user])
    .rpc({ commitment: "confirmed" });
  await confirmSig(buySig);

  const tokenBalAfterBuy = BigInt(
    (await connection.getTokenAccountBalance(userTokenAta)).value.amount
  );
  expect(tokenBalAfterBuy > 0n).to.equal(true);

  const sellAmount = tokenBalAfterBuy / 2n;

  const baseBefore = BigInt(
    (await connection.getTokenAccountBalance(userBaseAta)).value.amount
  );
  const treasuryBefore = BigInt(
    (await connection.getTokenAccountBalance(treasuryBaseAta)).value.amount
  );
  const feeBefore = BigInt(
    (await connection.getTokenAccountBalance(adminFeeAta)).value.amount
  );

  const sellSig = await program.methods
    .swapSell(new anchor.BN(sellAmount.toString()), new anchor.BN(0))
    .accounts({
      user: user.publicKey,
      mint: tokenMint,
      baseMint,
      market: marketPda,
      treasuryAuthority: treasuryAuthorityPda,
      userTokenAta,
      userBaseAta,
      treasuryBaseAta,
      adminFeeAta, // ✅ REQUIRED once Rust swap_sell pays admin_fee_ata
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .signers([user])
    .rpc({ commitment: "confirmed" });
  await confirmSig(sellSig);

  const baseAfter = BigInt(
    (await connection.getTokenAccountBalance(userBaseAta)).value.amount
  );
  const treasuryAfter = BigInt(
    (await connection.getTokenAccountBalance(treasuryBaseAta)).value.amount
  );
  const feeAfter = BigInt(
    (await connection.getTokenAccountBalance(adminFeeAta)).value.amount
  );

  // user gets paid
  expect(baseAfter > baseBefore).to.equal(true);
  // admin fee increases (0.5% of gross baseOut)
  expect(feeAfter > feeBefore).to.equal(true);
  // treasury should not increase on sell; usually decreases. allow equality for rounding edge cases.
  expect(treasuryAfter <= treasuryBefore).to.equal(true);
});


it("swap_sell: fails with InsufficientTreasury if treasury vault is empty", async () => {
  const mintAuthority = Keypair.generate();
  await airdrop(mintAuthority.publicKey);

  const tokenMint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    9
  );

  const baseMint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    null,
    9
  );

  await assertIsMint(tokenMint, "insufficient tokenMint");
  await assertIsMint(baseMint, "insufficient baseMint");

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), tokenMint.toBuffer()],
    program.programId
  );
  const [treasuryAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_authority"), marketPda.toBuffer()],
    program.programId
  );

  const treasuryBaseAta = ata(baseMint, treasuryAuthorityPda, true);
  const adminFeeAta = ata(baseMint, admin, false);

  await createAssociatedTokenAccountIdempotent(
    connection,
    mintAuthority,
    baseMint,
    admin
  );

  const initSig = await program.methods
    .initMarket(
      new anchor.BN(1_000_000_000),
      new anchor.BN(1_000_000_000),
      100,
      5_000
    )
    .accounts({
      admin,
      mint: tokenMint,
      baseMint,
      market: marketPda,
      treasuryAuthority: treasuryAuthorityPda,
      treasuryBaseAta,
      adminFeeAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc({ commitment: "confirmed" });
  await confirmSig(initSig);

  const user = Keypair.generate();
  await airdrop(user.publicKey);

  const userBaseAta = await createAssociatedTokenAccountIdempotent(
    connection,
    user,
    baseMint,
    user.publicKey
  );

  const userTokenAta = await createAssociatedTokenAccountIdempotent(
    connection,
    user,
    tokenMint,
    user.publicKey
  );

  // mint user tokens directly (treasury still has 0 base)
  await mintTo(
    connection,
    mintAuthority,
    tokenMint,
    userTokenAta,
    mintAuthority.publicKey,
    1_000_000_000n
  );

  try {
    const sellSig = await program.methods
      .swapSell(new anchor.BN(1_000_000_000), new anchor.BN(0))
      .accounts({
        user: user.publicKey,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        userTokenAta,
        userBaseAta,
        treasuryBaseAta,
        adminFeeAta, // ✅ REQUIRED once Rust swap_sell uses admin_fee_ata
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([user])
      .rpc({ commitment: "confirmed" });

    await confirmSig(sellSig);
    throw new Error("Expected swap_sell to fail, but it succeeded");
  } catch (e: any) {
    expect(e.toString()).to.match(/InsufficientTreasury|insufficient/i);
  }
});

  it("quote_buy matches swap_buy output (within slippage)", async () => {
    const mintAuthority = Keypair.generate();
    await airdrop(mintAuthority.publicKey);

    const tokenMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );
    const baseMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    await assertIsMint(tokenMint, "quote_buy tokenMint");
    await assertIsMint(baseMint, "quote_buy baseMint");

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), tokenMint.toBuffer()],
      program.programId
    );
    const [treasuryAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_authority"), marketPda.toBuffer()],
      program.programId
    );

    const treasuryBaseAta = ata(baseMint, treasuryAuthorityPda, true);
    const adminFeeAta = ata(baseMint, admin, false);

    await createAssociatedTokenAccountIdempotent(
      connection,
      mintAuthority,
      baseMint,
      admin
    );

    const feeBps = 100;
    const protocolFeeShareBps = 5_000; // keep quote + program aligned

    const initSig = await program.methods
      .initMarket(
        new anchor.BN(1_000_000_000),
        new anchor.BN(1_000_000_000),
        feeBps,
        protocolFeeShareBps
      )
      .accounts({
        admin,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        treasuryBaseAta,
        adminFeeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc({ commitment: "confirmed" });
    await confirmSig(initSig);

    await setAuthority(
      connection,
      mintAuthority,
      tokenMint,
      mintAuthority.publicKey,
      AuthorityType.MintTokens,
      treasuryAuthorityPda
    );

    const user = Keypair.generate();
    await airdrop(user.publicKey);

    const userBaseAta = await createAssociatedTokenAccountIdempotent(
      connection,
      user,
      baseMint,
      user.publicKey
    );
    const userTokenAta = await createAssociatedTokenAccountIdempotent(
      connection,
      user,
      tokenMint,
      user.publicKey
    );

    const mSig = await mintTo(
      connection,
      mintAuthority,
      baseMint,
      userBaseAta,
      mintAuthority.publicKey,
      2_000_000_000n
    );
    await confirmSig(mSig);

    await assertTokenBalance(
      userBaseAta,
      "quote_buy userBaseAta",
      800_000_000n
    );

    const marketAcc = await program.account.hubMarket.fetch(marketPda);

    const baseIn = new anchor.BN(800_000_000);
    const q = quoteBuy(
      {
        vBase: new anchor.BN(marketAcc.vBase.toString()),
        vToken: new anchor.BN(marketAcc.vToken.toString()),
        feeBps: marketAcc.feeBps,
        protocolFeeShareBps: marketAcc.protocolFeeShareBps,
      },
      baseIn
    );

    const quotedOut = BigInt(q.tokenOut.toString());
    const slippageBps = 50n;
    const minOut = quotedOut - (quotedOut * slippageBps) / 10_000n;

    const tokenBefore = BigInt(
      (await connection.getTokenAccountBalance(userTokenAta)).value.amount
    );

    const buySig = await program.methods
      .swapBuy(baseIn, new anchor.BN(minOut.toString()))
      .accounts({
        user: user.publicKey,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        userBaseAta,
        treasuryBaseAta,
        adminFeeAta,
        userTokenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([user])
      .rpc({ commitment: "confirmed" });
    await confirmSig(buySig);

    const tokenAfter = BigInt(
      (await connection.getTokenAccountBalance(userTokenAta)).value.amount
    );
    const got = tokenAfter - tokenBefore;

    expect(got >= minOut).to.equal(true);

    const diff = got > quotedOut ? got - quotedOut : quotedOut - got;
    expect(diff <= 2n).to.equal(true);
  });

  it("quote_sell matches swap_sell output (within slippage)", async () => {
    const mintAuthority = Keypair.generate();
    await airdrop(mintAuthority.publicKey);

    const tokenMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );
    const baseMint = await createMint(
      connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9
    );

    await assertIsMint(tokenMint, "quote_sell tokenMint");
    await assertIsMint(baseMint, "quote_sell baseMint");

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), tokenMint.toBuffer()],
      program.programId
    );
    const [treasuryAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_authority"), marketPda.toBuffer()],
      program.programId
    );

    const treasuryBaseAta = ata(baseMint, treasuryAuthorityPda, true);
    const adminFeeAta = ata(baseMint, admin, false);

    await createAssociatedTokenAccountIdempotent(
      connection,
      mintAuthority,
      baseMint,
      admin
    );

    const initSig = await program.methods
      .initMarket(
        new anchor.BN(1_000_000_000),
        new anchor.BN(1_000_000_000),
        100,
        5_000
      )
      .accounts({
        admin,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        treasuryBaseAta,
        adminFeeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc({ commitment: "confirmed" });
    await confirmSig(initSig);

    await setAuthority(
      connection,
      mintAuthority,
      tokenMint,
      mintAuthority.publicKey,
      AuthorityType.MintTokens,
      treasuryAuthorityPda
    );

    const user = Keypair.generate();
    await airdrop(user.publicKey);

    const userBaseAta = await createAssociatedTokenAccountIdempotent(
      connection,
      user,
      baseMint,
      user.publicKey
    );
    const userTokenAta = await createAssociatedTokenAccountIdempotent(
      connection,
      user,
      tokenMint,
      user.publicKey
    );

    const mSig = await mintTo(
      connection,
      mintAuthority,
      baseMint,
      userBaseAta,
      mintAuthority.publicKey,
      2_000_000_000n
    );
    await confirmSig(mSig);

    // buy first so user has tokens + treasury has base
    const buySig = await program.methods
      .swapBuy(new anchor.BN(1_000_000_000), new anchor.BN(0))
      .accounts({
        user: user.publicKey,
        mint: tokenMint,
        baseMint,
        market: marketPda,
        treasuryAuthority: treasuryAuthorityPda,
        userBaseAta,
        treasuryBaseAta,
        adminFeeAta,
        userTokenAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([user])
      .rpc({ commitment: "confirmed" });
    await confirmSig(buySig);

    const tokenBal = BigInt(
      (await connection.getTokenAccountBalance(userTokenAta)).value.amount
    );
    expect(tokenBal > 0n).to.equal(true);

    const sellIn = tokenBal / 3n;

    const marketAcc = await program.account.hubMarket.fetch(marketPda);
    const q = quoteSell(
      {
        vBase: new anchor.BN(marketAcc.vBase.toString()),
        vToken: new anchor.BN(marketAcc.vToken.toString()),
        feeBps: marketAcc.feeBps,
        protocolFeeShareBps: marketAcc.protocolFeeShareBps,
      },
      new anchor.BN(sellIn.toString())
    );

    const quotedOut = BigInt(q.baseOut.toString());
    const slippageBps = 50n;
    const minOut = quotedOut - (quotedOut * slippageBps) / 10_000n;

    const baseBefore = BigInt(
      (await connection.getTokenAccountBalance(userBaseAta)).value.amount
    );

    const sellSig = await program.methods
  .swapSell(
    new anchor.BN(sellIn.toString()),
    new anchor.BN(minOut.toString())
  )
  .accounts({
    user: user.publicKey,
    mint: tokenMint,
    baseMint,
    market: marketPda,
    treasuryAuthority: treasuryAuthorityPda,
    userTokenAta,
    userBaseAta,
    treasuryBaseAta,
    adminFeeAta, // ✅ ADD THIS
    tokenProgram: TOKEN_PROGRAM_ID,
  } as any)
  .signers([user])
  .rpc({ commitment: "confirmed" });

    const baseAfter = BigInt(
      (await connection.getTokenAccountBalance(userBaseAta)).value.amount
    );
    const got = baseAfter - baseBefore;

    expect(got >= minOut).to.equal(true);

    const diff = got > quotedOut ? got - quotedOut : quotedOut - got;
    expect(diff <= 2n).to.equal(true);
  });
});