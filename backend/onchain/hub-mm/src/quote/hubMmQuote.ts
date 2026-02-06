import BN from "bn.js";

function bnToBig(bn: BN): bigint {
  return BigInt(bn.toString(10));
}
function bigToBn(x: bigint): BN {
  return new BN(x.toString(10));
}

export type MarketLike = {
  vBase: BN;
  vToken: BN;
  feeBps: number;
  protocolFeeShareBps: number;
};

export type QuoteBuyResult = {
  tokenOut: BN;
  totalFee: BN;
  protocolFee: BN;
  toTreasury: BN;
  vBaseNew: BN;
  vTokenNew: BN;

  // pricing helpers (all rational -> returned as numerator/denominator + bps)
  spotPriceBefore_n: BN; // base
  spotPriceBefore_d: BN; // token
  executionPrice_n: BN;  // base paid (gross baseIn)
  executionPrice_d: BN;  // tokenOut
  priceImpactBps: number;
};

export type QuoteSellResult = {
  baseOut: BN;
  totalFee: BN;
  vBaseNew: BN;
  vTokenNew: BN;

  spotPriceBefore_n: BN; // base
  spotPriceBefore_d: BN; // token
  executionPrice_n: BN;  // baseOut
  executionPrice_d: BN;  // tokenIn (gross)
  priceImpactBps: number;
};

// Spot price (base per token) from reserves.
// For CPMM: spot ~ vBase / vToken (ignoring fees).
export function spotPrice(market: MarketLike): { n: BN; d: BN } {
  const vB = bnToBig(market.vBase);
  const vT = bnToBig(market.vToken);
  if (vB <= 0n || vT <= 0n) throw new Error("Invalid reserves");
  return { n: bigToBn(vB), d: bigToBn(vT) };
}

// Helper: compute price impact in bps using two fractions a/b vs c/d
// impact = |exec - spot| / spot * 10_000
function priceImpactBps(
  spotN: bigint,
  spotD: bigint,
  execN: bigint,
  execD: bigint
): number {
  // impact = (execN/execD - spotN/spotD) / (spotN/spotD)
  // = (execN*spotD - spotN*execD) / (spotN*execD)
  const num = execN * spotD - spotN * execD;
  const den = spotN * execD;
  if (den === 0n) return 0;

  const abs = num < 0n ? -num : num;
  const bps = (abs * 10_000n) / den;

  // clamp into JS number safely
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const safe = bps > max ? max : bps;
  return Number(safe);
}

// Slippage helper (bps). Returns BN >= 0
export function minOutFromSlippage(quotedOut: BN, slippageBps: number): BN {
  if (slippageBps < 0) throw new Error("slippageBps must be >= 0");
  const q = bnToBig(quotedOut);
  const s = BigInt(slippageBps);
  const min = q - (q * s) / 10_000n;
  return bigToBn(min < 0n ? 0n : min);
}

/**
 * Quote BUY (swap_buy)
 * Fee on input base_in.
 */
export function quoteBuy(market: MarketLike, baseIn: BN): QuoteBuyResult {
  const vB = bnToBig(market.vBase);
  const vT = bnToBig(market.vToken);
  if (vB <= 0n || vT <= 0n) throw new Error("Invalid reserves");

  const feeBps = BigInt(market.feeBps);
  const protocolShare = BigInt(market.protocolFeeShareBps);

  const baseInU = bnToBig(baseIn);
  if (baseInU <= 0n) throw new Error("baseIn must be > 0");

  const totalFee = (baseInU * feeBps) / 10_000n;
  const baseEffective = baseInU - totalFee;

  const protocolFee = (totalFee * protocolShare) / 10_000n;
  const toTreasury = baseInU - protocolFee;

  const k = vB * vT;
  const vBNew = vB + baseEffective;
  if (vBNew <= 0n) throw new Error("vBNew invalid");
  const vTNew = k / vBNew;

  const tokenOut = vT - vTNew;
  if (tokenOut <= 0n) throw new Error("tokenOut is 0");

  const spotN = vB;
  const spotD = vT;
  const execN = baseInU;   // gross base paid
  const execD = tokenOut;  // tokens received

  return {
    tokenOut: bigToBn(tokenOut),
    totalFee: bigToBn(totalFee),
    protocolFee: bigToBn(protocolFee),
    toTreasury: bigToBn(toTreasury),
    vBaseNew: bigToBn(vBNew),
    vTokenNew: bigToBn(vTNew),

    spotPriceBefore_n: bigToBn(spotN),
    spotPriceBefore_d: bigToBn(spotD),
    executionPrice_n: bigToBn(execN),
    executionPrice_d: bigToBn(execD),
    priceImpactBps: priceImpactBps(spotN, spotD, execN, execD),
  };
}

/**
 * Quote SELL (swap_sell)
 * Fee on input token_in.
 */
export function quoteSell(market: MarketLike, tokenIn: BN): QuoteSellResult {
  const vB = bnToBig(market.vBase);
  const vT = bnToBig(market.vToken);
  if (vB <= 0n || vT <= 0n) throw new Error("Invalid reserves");

  const feeBps = BigInt(market.feeBps);
  const tokenInU = bnToBig(tokenIn);
  if (tokenInU <= 0n) throw new Error("tokenIn must be > 0");

  const totalFee = (tokenInU * feeBps) / 10_000n;
  const tokenEffective = tokenInU - totalFee;

  const k = vB * vT;
  const vTNew = vT + tokenEffective;
  if (vTNew <= 0n) throw new Error("vTNew invalid");
  const vBNew = k / vTNew;

  const baseOut = vB - vBNew;
  if (baseOut <= 0n) throw new Error("baseOut is 0");

  const spotN = vB;
  const spotD = vT;
  const execN = baseOut;   // base received
  const execD = tokenInU;  // gross tokens sold

  return {
    baseOut: bigToBn(baseOut),
    totalFee: bigToBn(totalFee),
    vBaseNew: bigToBn(vBNew),
    vTokenNew: bigToBn(vTNew),

    spotPriceBefore_n: bigToBn(spotN),
    spotPriceBefore_d: bigToBn(spotD),
    executionPrice_n: bigToBn(execN),
    executionPrice_d: bigToBn(execD),
    priceImpactBps: priceImpactBps(spotN, spotD, execN, execD),
  };
}
