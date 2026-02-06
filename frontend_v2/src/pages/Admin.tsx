import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';
import { adminApi, handleAdminError } from '../api/admin';
import type { AdminUser } from '../shared/api-types';

export function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [approving, setApproving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getAllUsers();
      // Ensure data is an array
      const usersArray = Array.isArray(data) ? data : Object.values(data);
      setUsers(usersArray);
    } catch (err) {
      const errorInfo = handleAdminError(err);
      setError(`❌ ${errorInfo.message}`);
      console.error('Load Users Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setApproving((prev) => ({ ...prev, [userId]: true }));
    setError('');
    setSuccess('');

    try {
      await adminApi.approveUser({ userId });
      setSuccess(`✅ User ${userId} approved! Mint created.`);

      // Refresh user list
      await loadUsers();
    } catch (err) {
      const errorInfo = handleAdminError(err);
      setError(`❌ ${errorInfo.message}`);
      console.error('Approve Error:', err);
    } finally {
      setApproving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const getStatus = (user: AdminUser) => {
    if (user.claimed) return '✅ Claimed';
    if (user.isApproved) return '✅ Approved (Waiting to claim)';
    if (user.registrationStep === 3) return '⏳ Pending approval';
    return `🔄 Step ${user.registrationStep}`;
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        <Card title="Registered Users">
          {loading && <p className="text-slate-600">Loading users...</p>}

          {!loading && users.length === 0 && (
            <p className="text-slate-600">No users registered yet.</p>
          )}

          {!loading && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Phantom Wallet
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Minted
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Claimed
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Registered
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-slate-900">{user.email}</td>
                      <td className="px-4 py-3">{getStatus(user)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                        {user.phantomWallet || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {user.minted ? '✅' : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {user.claimed ? '✅' : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.registrationStep === 3 && !user.isApproved ? (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user._id)}
                            loading={approving[user._id]}
                          >
                            Approve
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {user.isApproved ? 'Approved' : 'Not eligible'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6">
            <Button
              variant="secondary"
              onClick={loadUsers}
              loading={loading}
            >
              🔄 Refresh
            </Button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

export default AdminPage;
