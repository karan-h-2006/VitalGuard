import { useEffect, useState } from 'react';

export interface StatProps {
  value: number | string;
  unit?: string;
  label: string;
  tag?: string;
  animate?: boolean;
  className?: string;
}

export function Stat({
  value,
  unit,
  label,
  tag,
  animate = false,
  className = '',
}: StatProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(() => {
    if (typeof value === 'number' && animate) return 0;
    return value;
  });

  useEffect(() => {
    if (typeof value !== 'number' || !animate) {
      setDisplayValue(value);
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const duration = 1200;
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(easeProgress * value);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(updateCounter);
  }, [value, animate]);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {tag && (
        <span className="mb-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">
          [{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {tag}
          </span>{' '}
          ]
        </span>
      )}
      <div className="flex items-baseline gap-1 font-mono tracking-tight text-slate-900 dark:text-slate-100">
        <span className="text-3xl sm:text-4xl lg:text-5xl font-bold">
          {displayValue}
        </span>
        {unit && (
          <span className="text-xl sm:text-2xl font-medium text-slate-500">
            {unit}
          </span>
        )}
      </div>
      <p className="mt-2 font-sans text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
        {label}
      </p>
    </div>
  );
}
