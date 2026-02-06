import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';

export function HomePage() {
  const { connected } = useWallet();

  return (
    <Layout>
      <div className="space-y-12">
        {/* Hero Section */}
        <section className="text-center py-20">
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-slate-900 mb-4">
              Token Bonding Curves
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Create and manage dynamic token pricing with linear bonding curves.
              Fair price discovery for your token economy.
            </p>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            {connected ? (
              <>
                <Link to="/profile">
                  <Button size="lg" variant="primary">
                    My Profile
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button size="lg" variant="secondary">
                    Explore Tokens
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" variant="primary">
                    Get Started
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="secondary">
                    Login
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section className="grid md:grid-cols-3 gap-8">
          <Card title="📈 Linear Pricing" className="text-center">
            <p className="text-slate-600">
              Price increases linearly as more tokens are swapped out of the curve.
              Perfect for fair token launches.
            </p>
          </Card>

          <Card title="🔐 Secure Swaps" className="text-center">
            <p className="text-slate-600">
              Built on Solana smart contracts with Anchor framework. Transparent
              and auditable transactions on-chain.
            </p>
          </Card>

          <Card title="💰 Transparent Fees" className="text-center">
            <p className="text-slate-600">
              No hidden fees. See exactly how much you'll receive before confirming
              your swap.
            </p>
          </Card>
        </section>

        {/* CTA Section */}
        <section className="text-center py-12 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to get started?
          </h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Join our community of token creators and traders. Create your own token
            or explore existing bonding curves.
          </p>
          {connected ? (
            <Link to="/profile">
              <Button size="lg" variant="primary">
                Go to Your Profile
              </Button>
            </Link>
          ) : (
            <Link to="/register">
              <Button size="lg" variant="primary">
                Register Now
              </Button>
            </Link>
          )}
        </section>
      </div>
    </Layout>
  );
}

export default HomePage;
