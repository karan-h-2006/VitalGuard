import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';

export function DoctorAvailabilityIndicator() {
  const { user, token } = useAuth();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!token || user?.role !== 'doctor') return;
    const check = async () => {
      try {
        const res = await fetch('/api/doctors/me/availability', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnavailable(data.effectiveStatus === 'unavailable');
        }
      } catch {
        /* ignore */
      }
    };
    void check();
    const timer = setInterval(() => void check(), 60_000);
    return () => clearInterval(timer);
  }, [token, user?.role]);

  if (!unavailable) return null;
  return (
    <span
      title="You are currently marked as unavailable"
      className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
    >
      <WifiOff className="h-3 w-3" />
      Unavailable
    </span>
  );
}
