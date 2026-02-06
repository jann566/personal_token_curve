/**
 * Quote Service für Hub-MM Trading
 * Berechnet Buy/Sell Preise basierend auf CPMM-Curve
 */

export interface QuoteResult {
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
  protocolFee: bigint;
  priceImpact: number; // in %
}

/**
 * Berechnet Output beim Buy (SOL -> Token)
 * @param baseIn Eingabe in Base (SOL)
 * @param vBase Virtual base reserve
 * @param vToken Virtual token reserve
 * @param feeBps Gebühren in basis points
 * @param protocolShareBps Protokoll-Anteil der Gebühren
 */
export function quoteBuy(params: {
  baseIn: bigint;
  vBase: bigint;
  vToken: bigint;
  feeBps: number;
  protocolShareBps: number;
}): QuoteResult {
  const { baseIn, vBase, vToken, feeBps, protocolShareBps } = params;

  // Gebühren berechnen
  const totalFee = (baseIn * BigInt(feeBps)) / BigInt(10_000);
  const protocolFee = (totalFee * BigInt(protocolShareBps)) / BigInt(10_000);
  const baseEffective = baseIn - totalFee;

  // CPMM: k = vBase * vToken
  const k = vBase * vToken;
  const vBaseNew = vBase + baseEffective;
  const vTokenNew = k / vBaseNew;

  const tokenOut = vToken - vTokenNew;

  // Price impact = (baseEffective / vBase) * 100
  const priceImpact = Number((baseEffective * BigInt(10_000)) / vBase) / 100;

  return {
    inputAmount: baseIn,
    outputAmount: tokenOut,
    fee: totalFee,
    protocolFee,
    priceImpact,
  };
}

/**
 * Berechnet Output beim Sell (Token -> SOL)
 * @param tokenIn Eingabe in Token
 * @param vBase Virtual base reserve
 * @param vToken Virtual token reserve
 * @param feeBps Gebühren in basis points
 * @param protocolShareBps Protokoll-Anteil der Gebühren
 */
export function quoteSell(params: {
  tokenIn: bigint;
  vBase: bigint;
  vToken: bigint;
  feeBps: number;
  protocolShareBps: number;
}): QuoteResult {
  const { tokenIn, vBase, vToken, feeBps, protocolShareBps } = params;

  // CPMM: k = vBase * vToken
  const k = vBase * vToken;
  const vTokenNew = vToken + tokenIn;
  const vBaseNew = k / vTokenNew;

  const grossBaseOut = vBase - vBaseNew;

  // Gebühren auf Output
  const totalFee = (grossBaseOut * BigInt(feeBps)) / BigInt(10_000);
  const protocolFee = (totalFee * BigInt(protocolShareBps)) / BigInt(10_000);
  const userBaseOut = grossBaseOut - totalFee;

  // Price impact = (tokenIn / vToken) * 100
  const priceImpact = Number((tokenIn * BigInt(10_000)) / vToken) / 100;

  return {
    inputAmount: tokenIn,
    outputAmount: userBaseOut,
    fee: totalFee,
    protocolFee,
    priceImpact,
  };
}

/**
 * Berechnet aktuellen Token-Preis basierend auf virtuelle Reserves
 * Preis = vBase / vToken (in Base Units)
 */
export function getCurrentPrice(vBase: bigint, vToken: bigint): number {
  if (vToken === BigInt(0)) return 0;
  return Number((vBase * BigInt(10_000)) / vToken) / 10_000;
}

/**
 * Berechnet Market Cap (vereinfacht)
 */
export function getMarketCap(supply: bigint, vBase: bigint, vToken: bigint, baseDecimals: number, tokenDecimals: number): number {
  const price = getCurrentPrice(vBase, vToken);
  const supplyInTokens = Number(supply) / Math.pow(10, tokenDecimals);
  return supplyInTokens * price * Math.pow(10, baseDecimals);
}
