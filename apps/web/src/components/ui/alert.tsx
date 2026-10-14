import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onClose?: () => void;
}

export function Alert({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
  ...props
}: AlertProps) {
  const config = {
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200',
      icon: (
        <Info
          className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0"
          aria-hidden="true"
        />
      ),
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200',
      icon: (
        <CheckCircle2
          className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0"
          aria-hidden="true"
        />
      ),
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200',
      icon: (
        <AlertTriangle
          className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0"
          aria-hidden="true"
        />
      ),
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200',
      icon: (
        <AlertCircle
          className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0"
          aria-hidden="true"
        />
      ),
    },
  }[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-2xl border p-4 text-sm ${config.bg} ${className}`}
      {...props}
    >
      {config.icon}
      <div className="flex-1">
        {title && <h5 className="font-semibold mb-0.5">{title}</h5>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded p-1 opacity-70 hover:opacity-100 transition-opacity focus:outline-none"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
