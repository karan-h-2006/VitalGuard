import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../shared/auth/auth-context.js';

export interface Availability {
  status: 'available' | 'unavailable';
  effectiveStatus: 'available' | 'unavailable';
  note: string | null;
  unavailableUntil: string | null;
  updatedAt: string;
}

export function useDoctorAvailability() {
  const { token } = useAuth();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/doctors/me/availability', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAvailability(await res.json());
      }
    } catch {
      /* silent on load */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (
      patch: Partial<
        Pick<Availability, 'status' | 'note' | 'unavailableUntil'>
      >,
    ) => {
      if (!token || !availability) return;
      const optimistic = { ...availability, ...patch };
      setAvailability(optimistic);
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/doctors/me/availability', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patch),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setAvailability(availability); // rollback
          const msg = json?.message ?? 'Could not update availability';
          setError(msg);
          setToast({ type: 'error', message: msg });
          return;
        }
        setAvailability(json);
        setToast({ type: 'success', message: 'Availability updated.' });
      } catch {
        setAvailability(availability); // rollback
        setToast({ type: 'error', message: 'Network error.' });
      } finally {
        setSaving(false);
      }
    },
    [token, availability],
  );

  return {
    availability,
    loading,
    saving,
    error,
    toast,
    setToast,
    update,
    reload: load,
  };
}
