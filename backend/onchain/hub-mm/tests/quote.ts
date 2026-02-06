// tests/quotes.ts
import BN from "bn.js";

/**
 * 128-bit safe math in JS:
 * We use BigInt internally to avoid rounding issues.
 * Inputs are BN (Anchor), outputs BN.
 */
function bnToBig(bn: BN): bigint {
  return BigInt(bn.toString(10));
}

function bigToBn(x: bigint): BN {
  return new BN(x.toString(10));
}

export type MarketLike = {
  vBase: BN;
  vToken: BN;
  feeBps: number;                 // e.g. 100 = 1%
  protocolFeeShareBps: number;    // e.g. 5000 = 50%
};

/**
 * Quote BUY (swap_buy)
 * Fee is taken from BASE INPUT (USDC).
 */
export function quoteBuy(market: MarketLike, baseIn: BN) {
  const vB = bnToBig(market.vBase);
  const vT = bnToBig(market.vToken);
  const feeBps = BigInt(market.feeBps);
  const protocolShare = BigInt(market.protocolFeeShareBps);

  const baseInU = bnToBig(baseIn);
  if (baseInU <= 0n) throw new Error("baseIn must be > 0");

  // 1) fee on input
  const totalFee = (baseInU * feeBps) / 10000n;
  const protocolFee = (totalFee * protocolShare) / 10000n;
  const baseEffective = baseInU - totalFee;

  // 2) CPMM math with effective input
  const k = vB * vT;
  const vBNew = vB + baseEffective;
  const vTNew = k / vBNew;

  const tokenOut = vT - vTNew;
  if (tokenOut <= 0n) throw new Error("tokenOut is 0");

  return {
    tokenOut: bigToBn(tokenOut),
    totalFee: bigToBn(totalFee),
    protocolFee: bigToBn(protocolFee),
    vBaseNew: bigToBn(vBNew),
    vTokenNew: bigToBn(vTNew),
  };
}

/**
 * Quote SELL (swap_sell)
 * Fee is taken from BASE OUTPUT (USDC).
 */
export function quoteSell(market: MarketLike, tokenIn: BN) {
  const vB = bnToBig(market.vBase);
  const vT = bnToBig(market.vToken);
  const feeBps = BigInt(market.feeBps);
  const protocolShare = BigInt(market.protocolFeeShareBps);

  const tokenInU = bnToBig(tokenIn);
  if (tokenInU <= 0n) throw new Error("tokenIn must be > 0");

  // 1) gross curve output (NO fee yet)
  const k = vB * vT;
  const vTNew = vT + tokenInU;
  const vBNew = k / vTNew;

  const grossBaseOut = vB - vBNew;
  if (grossBaseOut <= 0n) throw new Error("grossBaseOut is 0");

  // 2) fee on output
  const totalFee = (grossBaseOut * feeBps) / 10000n;
  const protocolFee = (totalFee * protocolShare) / 10000n;
  const userBaseOut = grossBaseOut - totalFee;

  return {
    baseOut: bigToBn(userBaseOut),          // what user actually receives
    grossBaseOut: bigToBn(grossBaseOut),
    totalFee: bigToBn(totalFee),
    protocolFee: bigToBn(protocolFee),
    vBaseNew: bigToBn(vBNew),
    vTokenNew: bigToBn(vTNew),
  };
}
