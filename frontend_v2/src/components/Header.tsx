import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';
import Button from './Button';
import StatusModal from './StatusModal';
import { userApi, handleUserError } from '../api/user';

export function Header() {
  const { connected, publicKey } = useWallet();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalType, setStatusModalType] = useState<'approved' | 'denied' | null>(null);
  const [userStatus, setUserStatus] = useState<{ approved?: boolean; claimed?: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const userId = localStorage.getItem('registerUserId');
        let res: Response | null = null;

        if (userId) {
          res = await fetch(`/user/status/${userId}`);
        } else if (connected && publicKey) {
          const wallet = publicKey.toString();
          res = await fetch(`/user/status/by-wallet/${wallet}`);
        } else {
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setUserStatus(data);

        // If just approved and not yet claimed, show modal
        if (data.approved && !data.claimed) {
          setStatusModalType('approved');
          setShowStatusModal(true);
        }
      } catch (err) {
        // ignore errors silently here
      }
    };

    // initial load
    load();
    // poll every 2s for faster feedback
    interval = setInterval(load, 2000);

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [connected, publicKey]);

  const handleClaimFromHeader = async () => {
    if (!connected || !publicKey) {
      // user should connect wallet via WalletMultiButton
      return;
    }

    let userId = localStorage.getItem('registerUserId');
    if (!userId) {
      // try to read from last fetched status
      if (userStatus && (userStatus as any).userId) {
        userId = (userStatus as any).userId;
      } else {
        // fallback: query by wallet
        try {
          const wallet = publicKey.toString();
          const res = await fetch(`/user/status/by-wallet/${wallet}`);
          if (res.ok) {
            const d = await res.json();
            userId = d.userId;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    if (!userId) return;

    try {
      const resp = await userApi.claimToken({ userId });
      // refresh status
      const res = await fetch(`/user/status/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserStatus(data);
      }
      setShowStatusModal(false);
      setStatusModalType(null);
      // Optionally show a short confirmation (left to page-level message)
      console.log('[Header] Claim success', resp);
    } catch (err) {
      const info = handleUserError(err);
      console.error('[Header] Claim failed', info.message);
    }
  };

  const shouldShowClaim = !!(userStatus && userStatus.approved && !userStatus.claimed);

  return (
    <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg">
      <StatusModal
        isOpen={showStatusModal}
        status={statusModalType}
        onClose={() => { setShowStatusModal(false); setStatusModalType(null); }}
        onClaimClick={handleClaimFromHeader}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-600 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold">₿</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Token Curve</h1>
              <p className="text-xs text-slate-400">Bonding Curve Protocol</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className="hover:text-blue-400 transition">
              Home
            </Link>
            <Link to="/profile" className="hover:text-blue-400 transition">
              Profile
            </Link>
            <Link to="/dashboard" className="hover:text-blue-400 transition">
              Portfolio
            </Link>
            <Link to="/explore" className="hover:text-blue-400 transition">
              Explore
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {shouldShowClaim && (
              <Button onClick={handleClaimFromHeader} variant="success" size="md" className="hidden sm:inline-flex">
                Claim Token
              </Button>
            )}

            <WalletMultiButton />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
