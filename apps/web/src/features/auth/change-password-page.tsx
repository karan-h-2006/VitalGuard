import { useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import {
  Button,
  Input,
  Badge,
  Alert,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../components/ui/index.js';

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

    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      setError(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
      );
      setLoading(false);
      return;
    }

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
      if (!response.ok) {
        throw new Error(data.message ?? 'Could not change password');
      }
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
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-lg border border-slate-200/80 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="bracketed">Security Setting</Badge>
            <KeyRound className="h-5 w-5 text-brand" />
          </div>
          <CardTitle className="text-2xl mt-2">Change your password</CardTitle>
          <CardDescription>
            A password update is required for your account security. Please
            choose a strong password with at least 8 characters, including an
            uppercase letter, a lowercase letter, and a number.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="error" title="Password update failed">
              {error}
            </Alert>
          )}

          {message && (
            <Alert variant="success" title="Success">
              {message}
            </Alert>
          )}

          <form onSubmit={submit} className="space-y-4">
            <Input
              id="currentPassword"
              label="Current password"
              type="password"
              placeholder="••••••••••••"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <Input
              id="newPassword"
              label="New password"
              type="password"
              placeholder="••••••••••••"
              minLength={8}
              required
              helperText="Must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                rollEffect
                className="w-full"
                icon={<ShieldAlert className="h-4 w-4" />}
              >
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
