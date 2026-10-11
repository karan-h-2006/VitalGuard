import { useState } from 'react';
import { useAuth } from '../../shared/auth/auth-context.js';

export function ChangePasswordPage() {
  const { token, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? 'Could not change password');
      setMessage('Password updated. Sign in again with your new password.');
      logout();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not change password',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto max-w-lg rounded-xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Change your password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose a new password with at least 12 characters.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded bg-green-50 p-3 text-green-700">{message}</p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Current password
          <input
            className="mt-1 w-full rounded border p-2"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          New password
          <input
            className="mt-1 w-full rounded border p-2"
            type="password"
            minLength={12}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <button
          disabled={loading}
          className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
