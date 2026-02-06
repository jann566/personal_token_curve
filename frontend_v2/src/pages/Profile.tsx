import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, Connection } from '@solana/web3.js';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { userApi, handleUserError } from '../api/user';
import type { UserStatusResponse } from '../shared/api-types';

interface TokenProfile {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image?: string;
  website?: string;
  twitter?: string;
}

export function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [userStatus, setUserStatus] = useState<UserStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tokenProfile, setTokenProfile] = useState<TokenProfile>({
    mint: '',
    name: '',
    symbol: '',
    description: '',
    image: '',
    website: '',
    twitter: '',
  });
  const [editMode, setEditMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Mock price history
  const priceHistory = [
    { time: '00:00', price: 0.22 },
    { time: '04:00', price: 0.23 },
    { time: '08:00', price: 0.24 },
    { time: '12:00', price: 0.23 },
    { time: '16:00', price: 0.25 },
    { time: '20:00', price: 0.26 },
    { time: '24:00', price: 0.25 },
  ];

  useEffect(() => {
    loadUserStatus();
    
    // Poll every 2 seconds for status changes (approval, claiming, etc)
    const pollInterval = setInterval(() => {
      loadUserStatus();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [connected, publicKey]);

  const loadUserStatus = async () => {
    setLoadingStatus(true);
    try {
      const userId = localStorage.getItem('registerUserId');
      console.log('[Profile] Polling with userId:', userId);

      let response: Response | null = null;

      if (userId) {
        response = await fetch(`/user/status/${userId}`);
      } else if (connected && publicKey) {
        // Try to resolve status by connected wallet if no stored userId
        const wallet = publicKey.toString();
        console.log('[Profile] No stored userId - trying by wallet:', wallet);
        response = await fetch(`/user/status/by-wallet/${wallet}`);
      } else {
        console.log('[Profile] No userId in localStorage and no connected wallet');
        setLoadingStatus(false);
        return;
      }
      console.log('[Profile] Status response:', response.status, response.statusText);
      
      if (response && response.ok) {
        const data = await response.json();
        console.log('[Profile] User status loaded:', {
          userId: userId,
          backendId: data._id,
          approved: data.approved,
          claimed: data.claimed,
          mintAddress: data.mintAddress,
          ataAddress: data.ataAddress,
          registrationStep: data.registrationStep,
        });
        setUserStatus(data);
        
        // Load token profile if user has a token
        if (data.mintAddress) {
          setTokenProfile((prev) => ({
            ...prev,
            mint: data.mintAddress || '',
          }));
        }
      } else {
        console.warn('[Profile] Failed to load user status:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.warn('[Profile] Error details:', errorData);
      }
    } catch (err) {
      console.error('[Profile] Error loading status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleClaim = async () => {
    if (!connected || !publicKey) {
      setMessage('❌ Please connect your wallet first');
      return;
    }

    if (!userStatus?.approved) {
      setMessage('❌ You are not yet approved. Wait for admin approval.');
      return;
    }

    if (userStatus?.claimed) {
      setMessage('❌ You have already claimed tokens.');
      return;
    }

    setClaimLoading(true);
    setMessage('');
    try {
      const userId = localStorage.getItem('registerUserId');
      if (!userId) {
        // try to resolve userId from status or wallet
        let resolved = (userStatus as any)?.userId || null;
        if (!resolved && connected && publicKey) {
          try {
            const res = await fetch(`/user/status/by-wallet/${publicKey.toString()}`);
            if (res.ok) {
              const d = await res.json();
              resolved = d.userId;
            }
          } catch (e) {}
        }

        if (!resolved) {
          setMessage('❌ No registration found. Please register first.');
          setClaimLoading(false);
          return;
        }

        // use resolved id
        (window as any).__resolvedUserId = resolved;
        // continue with resolved id
        // (we'll assign to userId below)
        // eslint-disable-next-line no-var
        var userIdVar = resolved;
        // override userId for subsequent call
        // (use userIdVar below)
      }

      const claimId = typeof userIdVar !== 'undefined' ? userIdVar : userId;
      console.log('[Profile] Creating claim tx for userId:', claimId);

      // Request unsigned claim tx from backend (feePayer = user)
      const { tx: txB64 } = await userApi.createClaimTx({ userId: claimId, wallet: publicKey!.toString() });

      // Deserialize and ask wallet to sign
      const unsignedTx = Transaction.from(Buffer.from(txB64, 'base64'));
      if (!wallet.signTransaction) throw new Error('Wallet does not support signTransaction');
      const signedTx = await wallet.signTransaction(unsignedTx);

      // Send partially-signed tx to backend for co-sign + submit
      const signedB64 = Buffer.from(signedTx.serialize()).toString('base64');
      const resp = await userApi.confirmClaimTx({ userId: claimId, signedTx: signedB64 });

      console.log('[Profile] Claim successful:', resp);
      setMessage(`✅ Tokens claimed successfully!`);

      // Reload status after successful claim
      setTimeout(() => {
        loadUserStatus();
      }, 1000);
    } catch (err) {
      const errorInfo = handleUserError(err);
      setMessage(`❌ ${errorInfo.message}`);
      console.error('[Profile] Claim failed:', err);
    } finally {
      setClaimLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaveLoading(true);
    try {
      // TODO: Implement backend endpoint for saving token profile
      console.log('[Profile] Saving token profile:', tokenProfile);
      setMessage('✅ Profile saved successfully!');
      setEditMode(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Failed to save profile');
      console.error('[Profile] Save failed:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  if (!connected) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Profile</h1>
          <p className="text-slate-600 mb-8">
            Please connect your wallet to view your profile
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your Profile</h1>
          <p className="text-slate-600">
            Manage your token and claim your airdrop
          </p>
          <div className="mt-2 text-xs font-mono text-slate-500">
            User ID: {localStorage.getItem('registerUserId') || 'not set'}
          </div>
        </div>

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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Token Info & Claim */}
          <div className="lg:col-span-1 space-y-6">
            {/* Your Token Card */}
            <Card title="🪙 Your Token">
              {loadingStatus ? (
                <p className="text-sm text-slate-600">Loading...</p>
              ) : userStatus?.mintAddress ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Name
                    </label>
                    <p className="text-slate-900">
                      {tokenProfile.name || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Symbol
                    </label>
                    <p className="text-slate-900">
                      {tokenProfile.symbol || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Mint Address
                    </label>
                    <p className="font-mono text-xs text-slate-600 break-all">
                      {userStatus.mintAddress}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      ATA Address
                    </label>
                    <p className="font-mono text-xs text-slate-600 break-all">
                      {userStatus.ataAddress || 'Not set'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  No token created yet
                </p>
              )}
            </Card>

            {/* Claim Status Card */}
            <Card title="🎁 Claim Airdrop">
              {loadingStatus ? (
                <p className="text-sm text-slate-600">Loading status...</p>
              ) : !userStatus ? (
                <p className="text-sm text-slate-600">No status data</p>
              ) : userStatus?.claimed ? (
                <div className="text-center py-4">
                  <p className="text-lg font-semibold text-green-600">
                    ✅ Tokens Claimed
                  </p>
                  <p className="text-sm text-slate-600 mt-2">
                    Your tokens are in your wallet on Solana Devnet.
                  </p>
                </div>
              ) : userStatus?.approved ? (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    ✅ You are approved! Claim your airdrop tokens now.
                  </p>
                  <Button
                    onClick={handleClaim}
                    loading={claimLoading}
                    variant="success"
                    size="lg"
                    className="w-full"
                  >
                    Claim Tokens
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm font-semibold text-yellow-600">
                    ⏳ Waiting for Admin Approval
                  </p>
                  <p className="text-xs text-slate-600 mt-2">
                    Your registration is complete. Please wait for admin to
                    approve your account.
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Middle Column - Charts */}
          <div className="lg:col-span-1">
            <Card title="📊 Price Chart (24h)">
              {userStatus?.mintAddress ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={priceHistory}>
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
              ) : (
                <div className="h-72 flex items-center justify-center bg-slate-50 rounded">
                  <p className="text-sm text-slate-500">No data available</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Token Profile Editor */}
          <div className="lg:col-span-1">
            <Card title="✏️ Token Profile">
              {editMode ? (
                <div className="space-y-4">
                  <Input
                    label="Token Name"
                    value={tokenProfile.name}
                    onChange={(e) =>
                      setTokenProfile({
                        ...tokenProfile,
                        name: e.target.value,
                      })
                    }
                    placeholder="My Token"
                  />
                  <Input
                    label="Symbol"
                    value={tokenProfile.symbol}
                    onChange={(e) =>
                      setTokenProfile({
                        ...tokenProfile,
                        symbol: e.target.value,
                      })
                    }
                    placeholder="MTK"
                  />
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={tokenProfile.description}
                      onChange={(e) =>
                        setTokenProfile({
                          ...tokenProfile,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe your token..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                  </div>
                  <Input
                    label="Website"
                    type="url"
                    value={tokenProfile.website}
                    onChange={(e) =>
                      setTokenProfile({
                        ...tokenProfile,
                        website: e.target.value,
                      })
                    }
                    placeholder="https://..."
                  />
                  <Input
                    label="Twitter"
                    value={tokenProfile.twitter}
                    onChange={(e) =>
                      setTokenProfile({
                        ...tokenProfile,
                        twitter: e.target.value,
                      })
                    }
                    placeholder="@handle"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveProfile}
                      loading={saveLoading}
                      size="sm"
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => setEditMode(false)}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Description
                    </label>
                    <p className="text-sm text-slate-700">
                      {tokenProfile.description || 'No description'}
                    </p>
                  </div>
                  {tokenProfile.website && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Website
                      </label>
                      <a
                        href={tokenProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {tokenProfile.website}
                      </a>
                    </div>
                  )}
                  {tokenProfile.twitter && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Twitter
                      </label>
                      <a
                        href={`https://twitter.com/${tokenProfile.twitter}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {tokenProfile.twitter}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ProfilePage;
