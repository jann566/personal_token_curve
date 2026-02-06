import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';

interface HoldingToken {
  id: string;
  name: string;
  symbol: string;
  amount: number;
  price: number;
  value: number;
  change24h: number;
}

// Mock portfolio data
const MOCK_HOLDINGS: HoldingToken[] = [
  {
    id: 'token-1',
    name: 'Community Token A',
    symbol: 'CTA',
    amount: 1000,
    price: 0.25,
    value: 250,
    change24h: 12.5,
  },
  {
    id: 'token-2',
    name: 'Creator Token B',
    symbol: 'CTB',
    amount: 50,
    price: 1.5,
    value: 75,
    change24h: -5.2,
  },
];

export function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const [holdings] = useState<HoldingToken[]>(MOCK_HOLDINGS);

  const totalPortfolioValue = holdings.reduce((sum, t) => sum + t.value, 0);
  const totalChange = holdings.reduce(
    (sum, t) => sum + (t.value * t.change24h) / 100,
    0
  );
  const totalChangePercent = totalPortfolioValue > 0
    ? ((totalChange / totalPortfolioValue) * 100).toFixed(2)
    : '0.00';

  if (!connected) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Portfolio</h1>
          <p className="text-slate-600 mb-8">
            Please connect your wallet to view your portfolio
          </p>
          <Button disabled size="lg">
            Connect Wallet First
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Portfolio</h1>
          <p className="text-slate-600">
            Your holdings overview
          </p>
        </div>

        {/* Portfolio Summary */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Total Portfolio Value</p>
              <p className="text-2xl font-bold text-slate-900">
                ${totalPortfolioValue.toFixed(2)}
              </p>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">24h Change</p>
              <p
                className={`text-2xl font-bold ${
                  parseFloat(totalChangePercent) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {parseFloat(totalChangePercent) > 0 ? '+' : ''}
                {totalChangePercent}%
              </p>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Holdings</p>
              <p className="text-2xl font-bold text-slate-900">
                {holdings.length} Token{holdings.length !== 1 ? 's' : ''}
              </p>
            </div>
          </Card>
        </div>

        {/* Holdings List */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Your Holdings</h2>
          {holdings.length > 0 ? (
            <div className="grid gap-4">
              {holdings.map((token) => (
                <Card key={token.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {token.name}
                      </h3>
                      <p className="text-sm text-slate-600">{token.symbol}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {token.amount} {token.symbol}
                      </p>
                      <p className="text-sm text-slate-600">
                        @ ${token.price.toFixed(4)}
                      </p>
                    </div>

                    <div className="text-right pr-4">
                      <p className="font-semibold text-slate-900">
                        ${token.value.toFixed(2)}
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          token.change24h >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {token.change24h > 0 ? '+' : ''}
                        {token.change24h}%
                      </p>
                    </div>

                    <Link to={`/token/${token.id}`}>
                      <Button size="sm" variant="primary">
                        View
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="text-center py-12">
                <p className="text-slate-600 mb-4">
                  You don't have any token holdings yet
                </p>
                <Link to="/explore">
                  <Button>Explore Tokens</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default DashboardPage;
