import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { hubApi, formatTokenAmount, parseTokenAmount, handleHubError, type MarketData, type QuoteResponse } from '../api/hub';

interface Token {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  currentPrice: number;
  priceHistory: Array<{ time: string; price: number }>;
  description?: string;
  change24h?: number;
}

export function TokenDetailPage() {
  const { mint } = useParams<{ mint: string }>();
  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  const [token, setToken] = useState<Token | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [swapAmount, setSwapAmount] = useState('');
  const [estimatedQuote, setEstimatedQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [solBalance, setSolBalance] = useState<number | null>(null); // lamports
  const [isBuying, setIsBuying] = useState(true);
  const [watchlisted, setWatchlisted] = useState(false);

  // Load token and market data
  useEffect(() => {
    if (!mint) return;

    const loadToken = async () => {
      setLoading(true);
      try {
        const market = await hubApi.getMarket(mint);
        setMarketData(market);

        // Create token object from market data
        const token: Token = {
          mint: market.tokenMint,
          name: market.tokenSymbol || 'User Token',
          symbol: market.tokenSymbol || 'USR',
          creator: 'User',
          currentPrice: market.currentPrice,
          priceHistory: generateMockPriceHistory(market.currentPrice),
          description: 'User Token on Hub-MM',
        };
        setToken(token);
      } catch (err) {
        const errorInfo = handleHubError(err);
        setMessage(`❌ Failed to load token: ${errorInfo.message}`);
        console.error('[TokenDetail] Error loading token:', err);
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, [mint]);

  // Auto-quote when amount changes
  useEffect(() => {
    if (!swapAmount || !token || !mint) {
      setEstimatedQuote(null);
      return;
    }

    const updateQuote = async () => {
      setQuoteLoading(true);
      try {
        if (isBuying) {
          const quote = await hubApi.quoteBuy(
            mint,
            parseTokenAmount(swapAmount, 9).toString()
          );
          setEstimatedQuote(quote);
        } else {
          const quote = await hubApi.quoteSell(
            mint,
            parseTokenAmount(swapAmount, 9).toString()
          );
          setEstimatedQuote(quote);
        }
      } catch (err) {
        console.error('[TokenDetail] Quote error:', err);
        setEstimatedQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    const timeoutId = setTimeout(updateQuote, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [swapAmount, token, mint, isBuying]);

  // Fetch SOL balance when wallet connects or publicKey changes
  useEffect(() => {
    let mounted = true;
    const fetchBalance = async () => {
      if (!publicKey) {
        if (mounted) setSolBalance(null);
        return;
      }
      try {
        const rpc = import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com';
        const conn = new Connection(rpc, 'confirmed');
        const bal = await conn.getBalance(new PublicKey(publicKey!.toBase58()), 'confirmed');
        if (mounted) setSolBalance(bal);
      } catch (err) {
        console.warn('Failed to fetch SOL balance', err);
        if (mounted) setSolBalance(null);
      }
    };

    fetchBalance();
    return () => { mounted = false; };
  }, [publicKey]);

  const handleSwap = async () => {
    if (!connected || !publicKey) {
      setMessage('❌ Please connect your wallet first');
      return;
    }

    if (!swapAmount || !estimatedQuote) {
      setMessage('❌ Please enter a valid amount');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (isBuying) {
        const solAmount = parseFloat(swapAmount);
        if (Number.isNaN(solAmount) || solAmount <= 0) {
          setMessage('❌ Invalid amount');
          setLoading(false);
          return;
        }

        const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

        // Basic pre-check: ensure wallet has enough SOL to cover lamports + transaction fee
        const MIN_TX_FEE_LAMPORTS = 5000; // ~0.000005 SOL
        if (solBalance === null) {
          setMessage('❗ Unable to read wallet SOL balance. Try reconnecting your wallet.');
          setLoading(false);
          return;
        }
        if (solBalance < lamports + MIN_TX_FEE_LAMPORTS) {
          setMessage('❌ Insufficient SOL balance to perform this buy. Please top-up your wallet.');
          setLoading(false);
          return;
        }

        // Ensure buyer ATAs exist (create if missing)
        try {
          const rpc = import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com';
          const conn = new Connection(rpc, 'confirmed');
          const mintPub = new PublicKey(token.mint);
          const userTokenAta = await splToken.getAssociatedTokenAddress(mintPub, publicKey!);
          const ataInfo = await conn.getAccountInfo(userTokenAta);
          if (!ataInfo) {
            // create associated token account transaction and send
            setMessage('⏳ Creating associated token account for buyer...');
            try {
              // Ensure buyer has enough SOL to cover rent-exempt balance for token account
              const TOKEN_ACCOUNT_SIZE = 165;
              const rent = await conn.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
              if (solBalance != null && solBalance < rent + 5000) {
                setMessage('❌ Insufficient SOL to create associated token account. Please top-up your wallet.');
                setLoading(false);
                return;
              }

              const createAtaTx = new Transaction().add(
                splToken.createAssociatedTokenAccountInstruction(publicKey!, userTokenAta, publicKey!, mintPub, splToken.TOKEN_PROGRAM_ID, splToken.ASSOCIATED_TOKEN_PROGRAM_ID)
              );
              // set fee payer and recent blockhash so wallet can sign
              createAtaTx.feePayer = publicKey!;
              const latest = await conn.getLatestBlockhash('confirmed');
              createAtaTx.recentBlockhash = (latest && (latest as any).blockhash) || (latest as any).blockhash || latest.blockhash;

              if (!wallet.signTransaction) throw new Error('Wallet does not support signTransaction');
              const signedCreate = await wallet.signTransaction(createAtaTx);
              const rawCreate = signedCreate.serialize();
              const createSig = await conn.sendRawTransaction(rawCreate);
              await conn.confirmTransaction(createSig, 'confirmed');
              setMessage('✅ ATA created');
            } catch (e) {
              console.error('Failed to ensure buyer ATA', e);
              setMessage('❌ Failed to create associated token account for buyer');
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error('Failed to ensure buyer ATA', e);
          setMessage('❌ Failed to create associated token account for buyer');
          setLoading(false);
          return;
        }

        // Request unsigned Anchor swapBuy tx
        const { tx: txB64 } = await hubApi.createSwapBuy(publicKey!.toBase58(), token.mint, lamports, Number(estimatedQuote?.minTokenOut ?? 0));

        const unsignedTx = Transaction.from(Buffer.from(txB64, 'base64'));
        if (!wallet.signTransaction) throw new Error('Wallet does not support signTransaction');
        setMessage('⏳ Awaiting wallet signature...');
        const signedTx = await wallet.signTransaction(unsignedTx);

        setMessage('⏳ Sending transaction to network...');
        const rpc = import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com';
        const conn = new Connection(rpc, 'confirmed');
        const raw = signedTx.serialize();
        const signature = await conn.sendRawTransaction(raw);
        setMessage(`⏳ Transaction submitted: ${signature}. Awaiting confirmation...`);
        await conn.confirmTransaction(signature, 'confirmed');
        setMessage(`✅ Transaction confirmed: ${signature}`);

        // Refresh balances
        try {
          await hubApi.getBalances(publicKey!.toBase58());
        } catch (e) {
          console.warn('Failed to refresh balances', e);
        }

        // update local SOL balance from RPC
        try {
          const newBal = await conn.getBalance(publicKey!, 'confirmed');
          setSolBalance(newBal);
        } catch (e) {
          console.warn('Failed to refresh SOL balance', e);
        }

        const amountBase = estimatedQuote?.outputAmount ?? '0';
        const output = formatTokenAmount(amountBase, 9);
        setMessage(`✅ Buy successful! You received ${output} ${token?.symbol}`);
        setSwapAmount('');
        setEstimatedQuote(null);
        setTimeout(() => setMessage(''), 4000);
      } else {
        if (!estimatedQuote) {
          setMessage('❌ No quote available');
          setLoading(false);
          return;
        }

        const tokenAmountBase = estimatedQuote.inputAmount; // token base units as string
        const tokenIn = Number(BigInt(tokenAmountBase));

        // Request unsigned Anchor swapSell tx
        const MIN_TX_FEE_LAMPORTS = 5000; // ~0.000005 SOL
        if (solBalance === null) {
          setMessage('❗ Unable to read wallet SOL balance. Try reconnecting your wallet.');
          setLoading(false);
          return;
        }
        if (solBalance < MIN_TX_FEE_LAMPORTS) {
          setMessage('❌ Insufficient SOL balance to pay transaction fees for this sell. Please top-up your wallet.');
          setLoading(false);
          return;
        }
        const { tx: txB64 } = await hubApi.createSwapSell(publicKey!.toBase58(), token.mint, tokenIn, Number(estimatedQuote?.minBaseOut ?? 0));
        const unsignedTx = Transaction.from(Buffer.from(txB64, 'base64'));
        if (!wallet.signTransaction) throw new Error('Wallet does not support signTransaction');
        setMessage('⏳ Awaiting wallet signature...');
        const signedTx = await wallet.signTransaction(unsignedTx);

        setMessage('⏳ Sending transaction to network...');
        const rpc = import.meta.env.VITE_SOLANA_RPC || 'https://api.devnet.solana.com';
        const conn = new Connection(rpc, 'confirmed');
        const raw = signedTx.serialize();
        const signature = await conn.sendRawTransaction(raw);
        setMessage(`⏳ Transaction submitted: ${signature}. Awaiting confirmation...`);
        await conn.confirmTransaction(signature, 'confirmed');
        setMessage(`✅ Transaction confirmed: ${signature}`);

        // Refresh balances
        try {
          await hubApi.getBalances(publicKey!.toBase58());
        } catch (e) {
          console.warn('Failed to refresh balances', e);
        }

        // Refresh local SOL balance after sell tx
        try {
          const newBal = await conn.getBalance(publicKey!, 'confirmed');
          setSolBalance(newBal);
        } catch (e) {
          console.warn('Failed to refresh SOL balance', e);
        }

        const solBase = estimatedQuote.outputAmount; // base units (9 decimals)
        const lamports = Number(BigInt(solBase));

        setMessage(`✅ Sell successful! You received ${(Number(lamports) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        setSwapAmount('');
        setEstimatedQuote(null);
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (err) {
      console.error('[TokenDetail] swap error', err);
      const errorInfo = handleHubError(err);
      setMessage(`❌ Swap failed: ${errorInfo.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWatchlist = () => {
    setWatchlisted(!watchlisted);
    setMessage(watchlisted ? '⭐ Removed from watchlist' : '⭐ Added to watchlist');
    setTimeout(() => setMessage(''), 2000);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Loading Token...</h1>
          <p className="text-slate-600">Fetching market data from Hub-MM</p>
        </div>
      </Layout>
    );
  }

  if (!token) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Token Not Found</h1>
          <Link to="/explore">
            <Button>Back to Explore</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const estimatedOutput = estimatedQuote ? formatTokenAmount(estimatedQuote.outputAmount, 9) : '0';
  const feeAmount = estimatedQuote ? formatTokenAmount(estimatedQuote.fee, 9) : '0';
  const priceImpact = estimatedQuote ? estimatedQuote.priceImpact : '0';

  // Quick client-side balance check to disable swap button early
  const MIN_TX_FEE_LAMPORTS = 5000;
  let insufficientBalance = false;
  if (connected && solBalance != null) {
    if (isBuying) {
      const reqLamports = Math.round((parseFloat(swapAmount || '0') || 0) * LAMPORTS_PER_SOL);
      if (reqLamports > 0 && solBalance < reqLamports + MIN_TX_FEE_LAMPORTS) insufficientBalance = true;
    } else {
      if (solBalance < MIN_TX_FEE_LAMPORTS) insufficientBalance = true;
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {token.name}
            </h1>
            <p className="text-slate-600">{token.symbol}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-900">
              ${token.currentPrice.toFixed(6)}
            </div>
            <div
              className={`text-lg font-semibold ${
                (token.change24h ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(token.change24h ?? 0) > 0 ? '+' : ''}
              {(token.change24h ?? 0).toFixed(2)}%
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.startsWith('✅') || message.startsWith('⭐')
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Token Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card title="ℹ️ Token Info">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">
                    Mint Address
                  </label>
                  <p className="font-mono text-xs text-slate-600 break-all">
                    {token.mint}
                  </p>
                </div>

                {connected && (
                  <div className="text-sm text-slate-500">
                    Wallet balance: {solBalance == null ? '—' : (Number(solBalance) / LAMPORTS_PER_SOL).toFixed(6)} SOL
                  </div>
                )}
                {marketData && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Virtual Base (v_base)
                      </label>
                      <p className="text-slate-900 font-mono text-xs">
                        {marketData.vBase.substring(0, 20)}...
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Virtual Token (v_token)
                      </label>
                      <p className="text-slate-900 font-mono text-xs">
                        {marketData.vToken.substring(0, 20)}...
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Trading Fee
                      </label>
                      <p className="text-slate-900">
                        {(marketData.feeBps / 100).toFixed(2)}%
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card title="📝 Description">
              <p className="text-sm text-slate-700">{token.description || 'No description'}</p>
            </Card>

            <Button
              onClick={handleToggleWatchlist}
              variant={watchlisted ? 'danger' : 'secondary'}
              size="lg"
              className="w-full"
            >
              {watchlisted ? '🗑️ Remove from Watchlist' : '⭐ Add to Watchlist'}
            </Button>
          </div>

          {/* Middle Column - Chart */}
          <div className="lg:col-span-1">
            <Card title="📊 24h Price Chart">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={token.priceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Right Column - Trade */}
          <div className="lg:col-span-1">
            <Card title="🔄 Swap">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsBuying(true)}
                    className={`flex-1 py-2 px-4 rounded font-semibold transition ${
                      isBuying
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setIsBuying(false)}
                    className={`flex-1 py-2 px-4 rounded font-semibold transition ${
                      !isBuying
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Sell
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {isBuying ? `Pay (SOL)` : `Sell (${token.symbol})`}
                  </label>
                  <input
                    type="number"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-600">You receive:</span>
                    <span className="font-semibold text-slate-900">
                      {quoteLoading ? 'Loading...' : estimatedOutput}{' '}
                      {isBuying ? token.symbol : 'SOL'}
                    </span>
                  </div>
                  {estimatedQuote && (
                    <>
                      <div className="flex justify-between text-sm text-slate-500 mb-1">
                        <span>Fee ({(marketData?.feeBps ?? 0) / 100}%):</span>
                        <span>{feeAmount} {isBuying ? 'SOL' : token.symbol}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Price Impact:</span>
                        <span className={priceImpact > 5 ? 'text-orange-600' : 'text-slate-500'}>
                          {priceImpact}%
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <Button
                    onClick={handleSwap}
                    loading={loading}
                    size="lg"
                    className="w-full"
                    disabled={!swapAmount || parseFloat(swapAmount) <= 0 || !connected || insufficientBalance}
                  >
                  {connected
                    ? isBuying
                      ? 'Buy Now'
                      : 'Sell Now'
                    : 'Connect Wallet'}
                  </Button>
                  {insufficientBalance && (
                    <div className="mt-2 text-sm text-red-600">Insufficient SOL balance for this transaction.</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default TokenDetailPage;

/**
 * Generate mock price history for chart
 * In production, fetch from backend/on-chain
 */
function generateMockPriceHistory(currentPrice: number) {
  const history = [];
  for (let i = 0; i < 24; i++) {
    const variation = (Math.random() - 0.5) * 0.2 * currentPrice;
    history.push({
      time: `${String(i).padStart(2, '0')}:00`,
      price: currentPrice + variation,
    });
  }
  return history;
}
