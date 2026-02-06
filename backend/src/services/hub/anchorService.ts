import fs from 'fs';
import path from 'path';
import { Connection, PublicKey, Transaction, TransactionInstruction, AccountMeta } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import BN from 'bn.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getConnection, getPayer } from '../../services/solana/connection';
import Market from '../../models/marketModel';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const IDL_PATH = path.join(__dirname, '..', '..', '..', 'onchain', 'hub-mm', 'target', 'idl', 'hub_mm.json');

function loadIdl() {
  const raw = fs.readFileSync(IDL_PATH, 'utf8');
  return JSON.parse(raw);
}

export function makeProgram(connection: Connection) {
  const rawIdl = loadIdl();
  // Some IDL generators output account type definitions under `types` and
  // leave `accounts` entries without a `type` field. Anchor's coder expects
  // each account entry to include its `type`. Merge types into accounts when
  // necessary to maintain compatibility across Anchor versions.
  const idl: any = JSON.parse(JSON.stringify(rawIdl));
  if (idl.accounts && Array.isArray(idl.accounts) && idl.types && Array.isArray(idl.types)) {
    idl.accounts = idl.accounts.map((acc: any) => {
      if (!acc.type) {
        const match = idl.types.find((t: any) => String(t.name).toLowerCase() === String(acc.name).toLowerCase() || t.name === acc.name);
        if (match && match.type) {
          return { ...acc, type: match.type };
        }
      }
      return acc;
    });
  }

  // Normalize IDL type names that differ between generators and Anchor expectation.
  // Anchor's IdlCoder expects `publicKey` (camelCase). Some IDLs use `pubkey`.
  function normalizeTypeNames(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === 'pubkey') obj[k] = 'publicKey';
      else if (typeof v === 'object') normalizeTypeNames(v);
    }
  }
  // Normalize types array entries and accounts fields
  if (idl.types && Array.isArray(idl.types)) {
    for (const t of idl.types) {
      if (t && t.type && t.type.fields) {
        for (const f of t.type.fields) {
          if (typeof f.type === 'string' && f.type === 'pubkey') f.type = 'publicKey';
          else normalizeTypeNames(f.type);
        }
      }
    }
  }
  if (idl.accounts && Array.isArray(idl.accounts)) {
    for (const acc of idl.accounts) {
      if (acc.type && acc.type.fields) {
        for (const f of acc.type.fields) {
          if (typeof f.type === 'string' && f.type === 'pubkey') f.type = 'publicKey';
          else normalizeTypeNames(f.type);
        }
      }
    }
  }
  const programIdStr = (process.env.HUB_PROGRAM_ID || process.env.SOLANA_PROGRAM_ID || idl.address);
  const programId = new PublicKey(programIdStr);
  console.log('[anchorService] makeProgram using programId:', programId.toBase58());

  // Minimal wallet for Anchor provider; we won't sign with it when building unsigned txs
  const payer = getPayer();
  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
  } as any;

  // Support multiple Anchor versions: prefer AnchorProvider, fallback to Provider
  const ProviderCtor = (anchor as any).AnchorProvider || (anchor as any).Provider || (anchor as any).AnchorProvider;
  const provider = new ProviderCtor(connection, wallet, { commitment: 'confirmed' }) as any;
  return new anchor.Program(idl as anchor.Idl, programId, provider as any);
}

// Create a program instance with a wallet that actually signs using server's payer.
export function makeProgramWithSigner(connection: Connection) {
  const rawIdl = loadIdl();
  const idl: any = JSON.parse(JSON.stringify(rawIdl));
  // reuse normalization from makeProgram
  if (idl.accounts && Array.isArray(idl.accounts) && idl.types && Array.isArray(idl.types)) {
    idl.accounts = idl.accounts.map((acc: any) => {
      if (!acc.type) {
        const match = idl.types.find((t: any) => String(t.name).toLowerCase() === String(acc.name).toLowerCase() || t.name === acc.name);
        if (match && match.type) {
          return { ...acc, type: match.type };
        }
      }
      return acc;
    });
  }
  function normalizeTypeNames(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === 'pubkey') obj[k] = 'publicKey';
      else if (typeof v === 'object') normalizeTypeNames(v);
    }
  }
  if (idl.types && Array.isArray(idl.types)) {
    for (const t of idl.types) {
      if (t && t.type && t.type.fields) {
        for (const f of t.type.fields) {
          if (typeof f.type === 'string' && f.type === 'pubkey') f.type = 'publicKey';
          else normalizeTypeNames(f.type);
        }
      }
    }
  }
  if (idl.accounts && Array.isArray(idl.accounts)) {
    for (const acc of idl.accounts) {
      if (acc.type && acc.type.fields) {
        for (const f of acc.type.fields) {
          if (typeof f.type === 'string' && f.type === 'pubkey') f.type = 'publicKey';
          else normalizeTypeNames(f.type);
        }
      }
    }
  }
  const programIdStr = (process.env.HUB_PROGRAM_ID || process.env.SOLANA_PROGRAM_ID || idl.address);
  const programId = new PublicKey(programIdStr);
  console.log('[anchorService] makeProgramWithSigner using programId:', programId.toBase58());

  const payer = getPayer();
  const wallet = {
    publicKey: payer.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(payer);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      for (const tx of txs) tx.partialSign(payer);
      return txs;
    },
  } as any;

  const ProviderCtor = (anchor as any).AnchorProvider || (anchor as any).Provider || (anchor as any).AnchorProvider;
  const provider = new ProviderCtor(connection, wallet, { commitment: 'confirmed' }) as any;
  return new anchor.Program(idl as anchor.Idl, programId, provider as any);
}

async function initMarketWithAdmin(
  connection: Connection,
  mint: PublicKey,
  baseMint: PublicKey,
  opts?: { vBase?: bigint | number | string; vToken?: bigint | number | string; feeBps?: number; protocolFeeShareBps?: number }
) {
  const program = makeProgramWithSigner(connection);
  const payer = getPayer();
  const admin = payer.publicKey;

  const [marketPda] = await PublicKey.findProgramAddress([Buffer.from('market'), mint.toBuffer()], program.programId);
  const [treasuryAuthority] = await PublicKey.findProgramAddress([Buffer.from('treasury_authority'), marketPda.toBuffer()], program.programId);

  const treasuryBaseAta = await getAssociatedTokenAddress(baseMint, treasuryAuthority, true);
  const adminFeeAta = await getAssociatedTokenAddress(baseMint, admin);

  const vBase = opts && opts.vBase !== undefined ? BigInt(String(opts.vBase)) : BigInt(process.env.HUB_V_BASE || '1000000000000');
  const vToken = opts && opts.vToken !== undefined ? BigInt(String(opts.vToken)) : BigInt(process.env.HUB_V_TOKEN || '1000000000000');
  const feeBps = opts && typeof opts.feeBps === 'number' ? opts.feeBps : parseInt(process.env.HUB_FEE_BPS || '250');
  const protocolFeeShareBps = opts && typeof opts.protocolFeeShareBps === 'number' ? opts.protocolFeeShareBps : parseInt(process.env.HUB_PROTOCOL_FEE_BPS || '5000');

  // Call initMarket via Anchor program (provider has signer)
  // Use bn.js BN to ensure proper u128 encoding for Anchor
  const vBaseBn = new BN(String(vBase), 10);
  const vTokenBn = new BN(String(vToken), 10);

  console.log('[anchorService] initMarket reserves:', { vBase: vBase.toString(), vToken: vToken.toString(), feeBps, protocolFeeShareBps });

  // Defensive: ensure program object is valid and support both modern `methods` API
  // and older `rpc` style API used by some Anchor versions.
  try {
    console.log('[anchorService] initMarketWithAdmin debug program:', typeof program, Object.keys(program || {}));
    console.log('[anchorService] initMarketWithAdmin flags:', {
      hasMethods: !!(program as any).methods,
      hasRpc: !!(program as any).rpc,
      hasInstruction: !!(program as any).instruction,
    });
  } catch (e) {
    console.warn('[anchorService] failed to introspect program object', e);
  }

  if (!program) {
    throw new Error('Failed to construct Anchor program client. Check WALLET_PATH and IDL path.');
  }

  if (!payer || !payer.publicKey) {
    throw new Error('Admin signer missing: WALLET_PATH or payer not configured');
  }

  let sig: string | undefined;
  // Preferred path: build instruction and send signed transaction. This is
  // deterministic and avoids differences in Anchor `rpc`/`methods` APIs.
  if ((program as any).instruction && (program as any).instruction.initMarket) {
    // Use exact snake_case account names from IDL to avoid Anchor mapping issues.
    const accountsObj = {
      admin: admin,
      mint: mint,
      base_mint: baseMint,
      market: marketPda,
      treasury_authority: treasuryAuthority,
      treasury_base_ata: treasuryBaseAta,
      admin_fee_ata: adminFeeAta,
      token_program: TOKEN_PROGRAM_ID,
      associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
      system_program: anchor.web3.SystemProgram.programId,
    } as any;
    console.log('[anchorService] initMarket accounts keys (snake_case):', Object.keys(accountsObj));
    console.log('[anchorService] initMarket accounts.base_mint:', accountsObj.base_mint?.toBase58?.() ?? String(accountsObj.base_mint));

    // Ensure treasury/admin ATAs exist; if missing, create them in the same tx.
    const tx = new anchor.web3.Transaction();
    try {
      const tInfo = await connection.getAccountInfo(treasuryBaseAta);
      if (!tInfo) {
        console.log('[anchorService] creating treasuryBaseAta in init tx:', treasuryBaseAta.toBase58());
        tx.add(createAssociatedTokenAccountInstruction(payer.publicKey, treasuryBaseAta, treasuryAuthority, baseMint));
      }
    } catch (e) {
      console.warn('[anchorService] check/create treasuryBaseAta failed', e);
    }
    try {
      const aInfo = await connection.getAccountInfo(adminFeeAta);
      if (!aInfo) {
        console.log('[anchorService] creating adminFeeAta in init tx:', adminFeeAta.toBase58());
        tx.add(createAssociatedTokenAccountInstruction(payer.publicKey, adminFeeAta, admin, baseMint));
      }
    } catch (e) {
      console.warn('[anchorService] check/create adminFeeAta failed', e);
    }

    console.log('[anchorService] building initMarket instruction — prefer program.methods where available');
    let ix: TransactionInstruction | null = null;
    // Preferred: modern Anchor `methods` API producing an instruction object
    if ((program as any).methods && (program as any).methods.initMarket) {
      try {
        ix = await (program as any).methods
          .initMarket(vBaseBn, vTokenBn, feeBps, protocolFeeShareBps)
          .accounts({
            admin,
            mint,
            baseMint,
            market: marketPda,
            treasuryAuthority,
            treasuryBaseAta,
            adminFeeAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .instruction();

        // ensure metas correct
        ix!.keys = ix!.keys.map((k: AccountMeta) => {
          if (k.pubkey.equals(marketPda)) return { pubkey: k.pubkey, isSigner: false, isWritable: true };
          if (k.pubkey.equals(admin)) return { pubkey: k.pubkey, isSigner: true, isWritable: true };
          if (k.pubkey.equals(treasuryBaseAta)) return { pubkey: k.pubkey, isSigner: false, isWritable: true };
          if (k.pubkey.equals(adminFeeAta)) return { pubkey: k.pubkey, isSigner: false, isWritable: true };
          return k;
        });

        // Debug: inspect encoded instruction data
        try {
          console.log('[anchorService] initMarket (methods) ix.data length:', ix!.data.length);
          console.log('[anchorService] initMarket (methods) ix.data hex:', ix!.data.toString('hex'));
          if ((program as any).coder && (program as any).coder.instruction) {
            try {
              const decoded = (program as any).coder.instruction.decode(ix!.data);
              console.log('[anchorService] decoded initMarket args (methods path):', decoded);
              const vals = decoded.args || decoded;
              const a0 = vals[0] ?? vals.v_base ?? null;
              const a1 = vals[1] ?? vals.v_token ?? null;
              if (!a0 || !a1 || String(a0) === '0' || String(a1) === '0') {
                throw new Error('Methods encoding produced zero args');
              }
            } catch (e) {
              console.warn('[anchorService] failed to decode/validate methods instruction data', e);
              throw e;
            }
          }
        } catch (e) {
          console.warn('[anchorService] methods path produced invalid encoding, will fallback', e);
          ix = null;
        }
      } catch (e) {
        console.warn('[anchorService] program.methods.initMarket build failed, falling back to instruction/coder', e);
        ix = null;
      }
    }

    if (!ix) {
      console.log('[anchorService] falling back to manual coder.encode construction');
      // Encode instruction data using Anchor coder. Try multiple representations
      // for u128 (bn.js BN, native BigInt, and string) because different
      // Anchor/IDL/Coder versions accept different numeric types.
      let data: Buffer | null = null;
      try {
        if ((program as any).coder && (program as any).coder.instruction) {
          const coder = (program as any).coder.instruction;
          const attempts: Array<{ name: string; args: any[] }> = [
            { name: 'initMarket', args: [vBaseBn, vTokenBn, feeBps, protocolFeeShareBps] },
            { name: 'init_market', args: [vBaseBn, vTokenBn, feeBps, protocolFeeShareBps] },
            { name: 'initMarket', args: [BigInt(vBase), BigInt(vToken), feeBps, protocolFeeShareBps] },
            { name: 'init_market', args: [BigInt(vBase), BigInt(vToken), feeBps, protocolFeeShareBps] },
            { name: 'initMarket', args: [String(vBase), String(vToken), feeBps, protocolFeeShareBps] },
            { name: 'init_market', args: [String(vBase), String(vToken), feeBps, protocolFeeShareBps] },
          ];

          for (const at of attempts) {
            try {
              data = coder.encode(at.name, at.args);
              // quick decode-validate to ensure values encoded non-zero
              try {
                const decoded = coder.decode(data);
                const vals = decoded.args || decoded;
                const a0 = vals[0] ?? vals.v_base ?? null;
                const a1 = vals[1] ?? vals.v_token ?? null;
                console.log('[anchorService] manual coder try', at.name, 'decoded args:', a0, a1);
                if (!a0 || !a1 || String(a0) === '0' || String(a1) === '0') {
                  console.warn('[anchorService] manual coder try produced zero args, trying next encoding');
                  data = null;
                  continue;
                }
                // success
                break;
              } catch (decErr) {
                console.warn('[anchorService] decode after encode failed, trying next encoding', decErr);
                data = null;
                continue;
              }
            } catch (e) {
              // ignore and try next
            }
          }
        }
      } catch (e) {
        console.warn('[anchorService] coder.encode failed', e);
      }
      if (data) {
        const keys: AccountMeta[] = [
          { pubkey: admin, isSigner: true, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: baseMint, isSigner: false, isWritable: false },
          { pubkey: marketPda, isSigner: false, isWritable: true },
          { pubkey: treasuryAuthority, isSigner: false, isWritable: false },
          { pubkey: treasuryBaseAta, isSigner: false, isWritable: true },
          { pubkey: adminFeeAta, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false },
        ];
        ix = new TransactionInstruction({ keys, programId: program.programId, data });
        // Debug decode for manual coder path
        try {
          console.log('[anchorService] manual coder initMarket data length:', ix!.data.length);
          console.log('[anchorService] manual coder initMarket data hex:', ix!.data.toString('hex'));
          if ((program as any).coder && (program as any).coder.instruction) {
            try {
              const decoded = (program as any).coder.instruction.decode(ix!.data);
              console.log('[anchorService] decoded initMarket args (coder path):', decoded);
              const vals = decoded.args || decoded;
              const a0 = vals[0] ?? vals.v_base ?? null;
              const a1 = vals[1] ?? vals.v_token ?? null;
              if (!a0 || !a1 || String(a0) === '0' || String(a1) === '0') {
                throw new Error('Coder-encoded initMarket args are zero');
              }
            } catch (e) {
              console.warn('[anchorService] failed to decode/validate coder-encoded data', e);
              throw e;
            }
          }
        } catch (e) {
          console.warn('[anchorService] manual coder path produced invalid encoding', e);
          throw e;
        }
      } else {
        throw new Error('Unable to build initMarket instruction: no coder or program.instruction available');
      }
    }
    tx.add(ix! as any);
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
    tx.partialSign(payer);
    const raw = tx.serialize();
    try {
      const sendSig = await connection.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: 'confirmed' });
      await connection.confirmTransaction(sendSig, 'confirmed');
      sig = sendSig;
    } catch (sendErr: any) {
      // Attach logs if available and rethrow to controller for reporting
      const logs = sendErr?.logs || sendErr?.transactionLogs || sendErr?.error?.logs || null;
      const err: any = new Error('initMarket sendRawTransaction failed: ' + (sendErr?.message || String(sendErr)));
      if (logs) err.logs = logs;
      throw err;
    }

    // persist metadata after successful init
    await saveMarketMetadata(mint, baseMint, marketPda, treasuryBaseAta, adminFeeAta, sig);
  } else if ((program as any).methods && (program as any).methods.initMarket) {
    // If instruction path not available, try `methods` API (modern Anchor)
    sig = await (program as any).methods
      .initMarket(vBaseBn, vTokenBn, feeBps, protocolFeeShareBps)
      .accounts({
        admin,
        mint,
        baseMint,
        market: marketPda,
        treasuryAuthority,
        treasuryBaseAta,
        adminFeeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc({ commitment: 'confirmed' });
  } else if ((program as any).rpc && (program as any).rpc.initMarket) {
    // Fallback for older Anchor versions using `program.rpc.method(...)` signature
    try {
      console.log('[anchorService] calling rpc.initMarket with admin:', admin.toBase58());
      const accountsObj = {
        admin: admin,
        mint: mint,
        base_mint: baseMint,
        market: marketPda,
        treasury_authority: treasuryAuthority,
        treasury_base_ata: treasuryBaseAta,
        admin_fee_ata: adminFeeAta,
        token_program: TOKEN_PROGRAM_ID,
        associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
        system_program: anchor.web3.SystemProgram.programId,
      } as any;
      console.log('[anchorService] rpc.initMarket accounts (snake_case):', Object.keys(accountsObj));
      console.log('[anchorService] rpc.initMarket accounts.base_mint:', accountsObj.base_mint?.toBase58?.() ?? String(accountsObj.base_mint));
      // Use rpc initMarket with signers for legacy Anchor
      sig = await (program as any).rpc.initMarket(vBaseBn, vTokenBn, feeBps, protocolFeeShareBps, {
        accounts: accountsObj,
        signers: [payer],
      });
    } catch (e) {
      // Some older APIs may expect slightly different argument ordering; try a minimal call
      const accountsObj = {
        admin,
        mint,
        baseMint,
        market: marketPda,
        treasuryAuthority,
        treasuryBaseAta,
        adminFeeAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any;
      sig = await (program as any).rpc.initMarket(vBaseBn, vTokenBn, {
        accounts: accountsObj,
        signers: [payer],
      });
    }
  } else {
    throw new Error('Anchor program client does not expose initMarket method (program.methods or program.rpc missing)');
  }

  return { marketPda, treasuryAuthority, treasuryBaseAta, adminFeeAta, sig };
}

export { initMarketWithAdmin };

async function saveMarketMetadata(mint: PublicKey, baseMint: PublicKey, marketPda: PublicKey, treasuryBaseAta: PublicKey, adminFeeAta: PublicKey, sig?: string) {
  try {
    await Market.findOneAndUpdate(
      { mint: mint.toBase58() },
      {
        mint: mint.toBase58(),
        marketPda: marketPda.toBase58(),
        baseMint: baseMint.toBase58(),
        treasuryBaseAta: treasuryBaseAta.toBase58(),
        adminFeeAta: adminFeeAta.toBase58(),
        initializedAt: new Date(),
        initSig: sig || null,
      },
      { upsert: true }
    );
  } catch (e) {
    console.error('[anchorService] failed to persist market metadata', e);
  }
}

export async function buildSwapBuyTx(buyerPubkey: PublicKey, mint: PublicKey, baseIn: number, minTokenOut: number) {
  const connection = getConnection();
  const program = makeProgram(connection);
  // Debug: log cluster and derived PDA info for deterministic cluster checks
  try {
    console.log('[anchorService] buildSwapBuyTx debug:', {
      rpcUrl: (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || '<unset>'),
      programId: program.programId.toBase58(),
      commitment: 'confirmed',
      mint: mint.toBase58(),
    });
  } catch (e) {
    console.warn('[anchorService] failed to log debug info', e);
  }

  // Derive market PDA
  const [marketPda] = await PublicKey.findProgramAddress([Buffer.from('market'), mint.toBuffer()], program.programId);
  // verify market PDA exists on-chain, then fetch market to get base_mint and treasury bump
  const marketInfo = await connection.getAccountInfo(marketPda);
  if (!marketInfo) {
    // Market missing — do NOT auto-init here. Require explicit admin init.
    console.error('[anchorService] Market PDA missing (auto-init disabled). RPC:', process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL);
    console.error('[anchorService] programId:', program.programId.toBase58());
    console.error('[anchorService] derived marketPda:', marketPda.toBase58());
    throw new Error(`Market account does not exist for PDA ${marketPda.toBase58()}. Call POST /hub/admin/init-market to initialize.`);
  }
  const marketAccount = await program.account.hubMarket.fetch(marketPda);
  if (!marketAccount) {
    console.error('[anchorService] Failed to fetch market account after init. programId=', program.programId.toBase58());
    throw new Error(`Failed to fetch market account data for PDA ${marketPda.toBase58()}`);
  }
  const baseMint = new PublicKey(marketAccount.baseMint as any);

  const [treasuryAuthority] = await PublicKey.findProgramAddress([Buffer.from('treasury_authority'), marketPda.toBuffer()], program.programId);

  const userBaseAta = await getAssociatedTokenAddress(baseMint, buyerPubkey);
  const treasuryBaseAta = new PublicKey(marketAccount.treasuryBaseAta as any);
  const adminFeeAta = new PublicKey(marketAccount.adminFeeAta as any);
  if (!treasuryBaseAta || !adminFeeAta) {
    throw new Error('Market treasury accounts missing or invalid');
  }
  const userTokenAta = await getAssociatedTokenAddress(mint, buyerPubkey);

  // Ensure treasury/admin ATAs exist on-chain
  const tInfo = await connection.getAccountInfo(treasuryBaseAta);
  if (!tInfo) throw new Error(`Account does not exist ${treasuryBaseAta.toBase58()} (market treasury_base_ata missing)`);
  const aInfo = await connection.getAccountInfo(adminFeeAta);
  if (!aInfo) throw new Error(`Account does not exist ${adminFeeAta.toBase58()} (market admin_fee_ata missing)`);

  // Ensure buyer ATAs exist (buyer must create ATAs before swap)
  const ubInfo = await connection.getAccountInfo(userBaseAta);
  if (!ubInfo) throw new Error(`Buyer associated token account for base mint does not exist ${userBaseAta.toBase58()}`);
  const utInfo = await connection.getAccountInfo(userTokenAta);
  if (!utInfo) throw new Error(`Buyer associated token account for token mint does not exist ${userTokenAta.toBase58()}`);

    const ix = program.instruction.swapBuy(new anchor.BN(baseIn), new anchor.BN(minTokenOut), {
    accounts: {
      user: buyerPubkey,
      mint: mint,
      baseMint: baseMint,
      market: marketPda,
      treasuryAuthority: treasuryAuthority,
      userBaseAta: userBaseAta,
      treasuryBaseAta: treasuryBaseAta,
      adminFeeAta: adminFeeAta,
      userTokenAta: userTokenAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });

  const tx = new Transaction();
  tx.add(ix as any);
  tx.feePayer = buyerPubkey;
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
  return { tx: serialized.toString('base64'), recentBlockhash: latest.blockhash }; 
}

export async function buildSwapSellTx(sellerPubkey: PublicKey, mint: PublicKey, tokenIn: number, minBaseOut: number) {
  const connection = getConnection();
  const program = makeProgram(connection);

  // Debug: log cluster and derived PDA info for deterministic cluster checks
  try {
    console.log('[anchorService] buildSwapSellTx debug:', {
      rpcUrl: (process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || '<unset>'),
      programId: program.programId.toBase58(),
      commitment: 'confirmed',
      mint: mint.toBase58(),
    });
  } catch (e) {
    console.warn('[anchorService] failed to log debug info', e);
  }


  const [marketPda] = await PublicKey.findProgramAddress([Buffer.from('market'), mint.toBuffer()], program.programId);
  const marketInfo = await connection.getAccountInfo(marketPda);
  if (!marketInfo) {
    const autoInit = (process.env.HUB_AUTO_INIT_MARKET || 'false').toLowerCase() === 'true';
    const envBase = process.env.HUB_BASE_MINT;
    if (autoInit && envBase) {
      try {
        const baseMint = new PublicKey(envBase);
        console.log('[anchorService] Auto-initializing market for mint', mint.toBase58(), 'with base', baseMint.toBase58());
        const initRes = await initMarketWithAdmin(connection, mint, baseMint);
        console.log('[anchorService] initMarket sig', initRes.sig);
      } catch (e) {
        console.error('[anchorService] auto init market failed', e);
      }
    }

    const marketInfo2 = await connection.getAccountInfo(marketPda);
    if (!marketInfo2) {
      throw new Error(`Market account does not exist for PDA ${marketPda.toBase58()}`);
    }
  }
  const marketAccount = await program.account.hubMarket.fetch(marketPda);
  if (!marketAccount) {
    throw new Error(`Failed to fetch market account data for PDA ${marketPda.toBase58()}`);
  }
  const baseMint = new PublicKey(marketAccount.baseMint as any);

  const [treasuryAuthority] = await PublicKey.findProgramAddress([Buffer.from('treasury_authority'), marketPda.toBuffer()], program.programId);

  const userTokenAta = await getAssociatedTokenAddress(mint, sellerPubkey);
  const userBaseAta = await getAssociatedTokenAddress(baseMint, sellerPubkey);
  const treasuryBaseAta = new PublicKey(marketAccount.treasuryBaseAta as any);
  const adminFeeAta = new PublicKey(marketAccount.adminFeeAta as any);
  if (!treasuryBaseAta || !adminFeeAta) {
    throw new Error('Market treasury accounts missing or invalid');
  }

  // Ensure treasury/admin ATAs exist on-chain
  const tInfo = await connection.getAccountInfo(treasuryBaseAta);
  if (!tInfo) throw new Error(`Account does not exist ${treasuryBaseAta.toBase58()} (market treasury_base_ata missing)`);
  const aInfo = await connection.getAccountInfo(adminFeeAta);
  if (!aInfo) throw new Error(`Account does not exist ${adminFeeAta.toBase58()} (market admin_fee_ata missing)`);

  // Ensure seller ATAs exist (seller must have ATAs to sell)
  const sellerTokenInfo = await connection.getAccountInfo(userTokenAta);
  if (!sellerTokenInfo) throw new Error(`Seller associated token account for mint does not exist ${userTokenAta.toBase58()}`);
  const sellerBaseInfo = await connection.getAccountInfo(userBaseAta);
  if (!sellerBaseInfo) throw new Error(`Seller associated token account for base mint does not exist ${userBaseAta.toBase58()}`);

    const ix = program.instruction.swapSell(new anchor.BN(tokenIn), new anchor.BN(minBaseOut), {
    accounts: {
      user: sellerPubkey,
      mint: mint,
      baseMint: baseMint,
      market: marketPda,
      treasuryAuthority: treasuryAuthority,
      userTokenAta: userTokenAta,
      userBaseAta: userBaseAta,
      treasuryBaseAta: treasuryBaseAta,
      adminFeeAta: adminFeeAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
  });

  const tx = new Transaction();
  tx.add(ix as any);
  tx.feePayer = sellerPubkey;
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
  return { tx: serialized.toString('base64'), recentBlockhash: latest.blockhash }; 
}
