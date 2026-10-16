import { useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { Badge, Button, Input, Alert } from '../../components/ui/index.js';
import type { Availability } from './use-availability.js';

interface Props {
  availability: Availability;
  saving: boolean;
  toast: { type: 'success' | 'error'; message: string } | null;
  onClearToast: () => void;
  onUpdate: (
    patch: Partial<Pick<Availability, 'status' | 'note' | 'unavailableUntil'>>,
  ) => void;
}

export function AvailabilityControl({
  availability,
  saving,
  toast,
  onClearToast,
  onUpdate,
}: Props) {
  const isAvailable = availability.effectiveStatus === 'available';
  const [note, setNote] = useState(availability.note ?? '');
  const [untilDate, setUntilDate] = useState(
    availability.unavailableUntil ?? '',
  );
  const [showUntil, setShowUntil] = useState(!!availability.unavailableUntil);

  const handleToggle = () => {
    const newStatus = isAvailable ? 'unavailable' : 'available';
    onUpdate({
      status: newStatus,
      note: note.trim() || null,
      unavailableUntil:
        newStatus === 'unavailable' && showUntil && untilDate
          ? untilDate
          : null,
    });
  };

  const handleSaveNote = () => {
    onUpdate({ note: note.trim() || null });
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="bracketed" size="sm">
            Availability
          </Badge>
          <h2 className="mt-1 font-sans text-base font-bold text-slate-900 dark:text-slate-100">
            Availability for new patients
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            role="switch"
            aria-checked={isAvailable}
            aria-label="Available for new patients"
            disabled={saving}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 ${
              isAvailable
                ? 'bg-emerald-500 dark:bg-emerald-600'
                : 'bg-rose-400 dark:bg-rose-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isAvailable ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span
            className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
              isAvailable
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isAvailable ? '[ AVAILABLE ]' : '[ UNAVAILABLE ]'}
          </span>
        </div>
      </div>

      {!isAvailable && availability.status !== 'available' && (
        <Alert variant="info" title="Patients still visible">
          You are marked unavailable. Your assigned patients are still visible
          to you and you will still receive their alerts until an administrator
          transfers them.
        </Alert>
      )}

      <div className="space-y-3">
        <div>
          <label className="block font-mono text-xs text-slate-500 dark:text-slate-400 mb-1">
            Status note{' '}
            <span className="text-slate-400">(optional, max 200 chars)</span>
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. On leave until Monday"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNote}
              disabled={saving}
            >
              Save note
            </Button>
          </div>
          <div className="text-right font-mono text-[10px] text-slate-400 mt-0.5">
            {note.length}/200
          </div>
        </div>

        {!isAvailable && (
          <div>
            <label className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400 mb-2">
              <input
                type="checkbox"
                checked={showUntil}
                onChange={(e) => setShowUntil(e.target.checked)}
                className="rounded border-slate-300 text-brand focus:ring-brand"
              />
              Set "Unavailable until" time (optional)
            </label>
            {showUntil && (
              <input
                type="datetime-local"
                value={untilDate ? untilDate.slice(0, 16) : ''}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) =>
                  setUntilDate(
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
        {isAvailable ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-rose-500" />
        )}
        <span className="font-mono text-[10px] text-slate-400">
          Last updated: {new Date(availability.updatedAt).toLocaleString()}
        </span>
      </div>

      {toast && (
        <Alert
          variant={toast.type === 'success' ? 'success' : 'error'}
          title={toast.type === 'success' ? 'Saved' : 'Error'}
          onClose={onClearToast}
        >
          {toast.message}
        </Alert>
      )}
    </div>
  );
}
