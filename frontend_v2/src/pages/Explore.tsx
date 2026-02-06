import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { hubApi, handleHubError, type TokenListItem } from '../api/hub';

export function ExplorePage() {
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'watchlist'>('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Load tokens from backend
  useEffect(() => {
    const loadTokens = async () => {
      setLoading(true);
      try {
        const data = await hubApi.listTokens();
        console.log('[Explore] Loaded tokens:', data);
        setTokens(data);
      } catch (err) {
        const errorInfo = handleHubError(err);
        setMessage(`❌ Failed to load tokens: ${errorInfo.message}`);
        console.error('[Explore] Error loading tokens:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, []);

  // Filter and search logic
  const filteredTokens = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const watchlistTokens = tokens.filter((t) => watchlist.includes(t.mint));

  const toggleWatchlist = (mint: string) => {
    setWatchlist((prev) =>
      prev.includes(mint)
        ? prev.filter((id) => id !== mint)
        : [...prev, mint]
    );
  };

  const displayTokens = activeTab === 'all' ? filteredTokens : watchlistTokens;

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Loading Tokens...</h1>
          <p className="text-slate-600">Fetching from Hub-MM</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Explore Tokens</h1>
          <p className="text-slate-600">Discover and trade tokens on the bonding curve</p>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.startsWith('❌')
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}
          >
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="space-y-4">
          <div className="flex gap-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-3 px-4 font-semibold border-b-2 transition ${
                activeTab === 'all'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              All Tokens ({tokens.length})
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`py-3 px-4 font-semibold border-b-2 transition ${
                activeTab === 'watchlist'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              📋 Watchlist ({watchlist.length})
            </button>
          </div>

          {activeTab === 'all' && (
            <Input
              label="Search tokens"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or symbol..."
            />
          )}
        </div>

        {/* Tokens List */}
        <div className="grid gap-4">
          {displayTokens.length > 0 ? (
            displayTokens.map((token) => (
              <Card key={token.mint} title="">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Link
                      to={`/token/${token.mint}`}
                      className="group cursor-pointer"
                    >
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition">
                        {token.name}
                      </h3>
                      <p className="text-sm text-slate-600">{token.symbol} • {token.creator}</p>
                    </Link>
                  </div>

                  <div className="text-right pr-4">
                    <p className="font-semibold text-slate-900">
                      ${token.currentPrice.toFixed(6)}
                    </p>
                    <p className="text-sm text-slate-600">
                      Status: {token.claimed}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/token/${token.mint}`}>
                      <Button size="sm" variant="primary">
                        Trade
                      </Button>
                    </Link>
                    <Button
                      onClick={() => toggleWatchlist(token.mint)}
                      variant={watchlist.includes(token.mint) ? 'danger' : 'secondary'}
                      size="sm"
                    >
                      {watchlist.includes(token.mint) ? '🗑️' : '⭐'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card title="">
              <div className="text-center py-12">
                <p className="text-slate-600">
                  {activeTab === 'all'
                    ? 'No tokens found matching your search'
                    : 'Your watchlist is empty. Add tokens to get started!'}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default ExplorePage;
