import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { handleAuthError } from '../api/auth';

export function LoginPage() {
  const { connected, publicKey } = useWallet();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    if (!email.trim()) {
      setMessage('❌ Please enter your email');
      return;
    }

    if (!connected || !publicKey) {
      setMessage('❌ Please connect your wallet first');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      console.log('[Login] Attempting login with email:', email);
      // For now, just check if user is registered by fetching user status
      // In a real app, this would be a dedicated login endpoint
      const response = await fetch(`/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          walletAddress: publicKey.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      localStorage.setItem('registerUserId', data.userId);
      console.log('[Login] Login successful:', data);
      setMessage('✅ Login successful! Redirecting...');
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      const errorInfo = handleAuthError(err);
      setMessage(`❌ ${errorInfo.message}`);
      console.error('[Login] Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-20">
          <Card title="Login">
            <div className="text-center py-8">
              <p className="text-slate-600 mb-6">
                Please connect your wallet to login
              </p>
              <Button disabled size="lg" className="w-full">
                Connect Wallet First
              </Button>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto py-20">
        <Card title="🔑 Login">
          <div className="space-y-6">
            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.startsWith('✅')
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {message}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                Connected wallet:{' '}
                <span className="font-mono font-semibold">
                  {publicKey?.toString().slice(0, 8)}...
                </span>
              </p>
            </div>

            <Button
              onClick={handleLogin}
              loading={loading}
              size="lg"
              className="w-full"
            >
              Login
            </Button>

            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600 mb-3">
                Don't have an account?
              </p>
              <a
                href="/register"
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Register here
              </a>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

export default LoginPage;
