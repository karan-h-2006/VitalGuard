import React from 'react';
import { CheckCircle2, Eye, AlertTriangle, AlertOctagon } from 'lucide-react';

export type SeverityLevel = 'normal' | 'watch' | 'warning' | 'critical';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'bracketed' | 'outline' | 'severity' | 'teal';
  severity?: SeverityLevel;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export function Badge({
  children,
  className = '',
  variant = 'default',
  severity = 'normal',
  size = 'md',
  icon,
  ...props
}: BadgeProps) {
  if (variant === 'bracketed') {
    return (
      <span
        className={`inline-flex items-center font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none ${
          size === 'sm' ? 'text-[10px]' : 'text-xs'
        } ${className}`}
        {...props}
      >
        <span className="text-slate-400 dark:text-slate-600 mr-1">[</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {children}
        </span>
        <span className="text-slate-400 dark:text-slate-600 ml-1">]</span>
      </span>
    );
  }

  if (variant === 'severity' || severity) {
    const severityConfig = {
      normal: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: (
          <CheckCircle2
            className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0"
            aria-hidden="true"
          />
        ),
        label: 'Normal',
      },
      watch: {
        bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: (
          <Eye
            className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400 shrink-0"
            aria-hidden="true"
          />
        ),
        label: 'Watch',
      },
      warning: {
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
        icon: (
          <AlertTriangle
            className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0"
            aria-hidden="true"
          />
        ),
        label: 'Warning',
      },
      critical: {
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800',
        icon: (
          <AlertOctagon
            className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400 shrink-0"
            aria-hidden="true"
          />
        ),
        label: 'Critical',
      },
    }[severity];

    return (
      <span
        role="status"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${severityConfig.bg} ${className}`}
        {...props}
      >
        {severityConfig.icon}
        <span>{children || severityConfig.label}</span>
      </span>
    );
  }

  const baseStyles =
    'inline-flex items-center gap-1.5 font-mono font-medium uppercase tracking-wider rounded-full border';
  const sizeStyles =
    size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  const variantStyles: Record<string, string> = {
    default:
      'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    outline:
      'bg-transparent text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-600',
    teal: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  };
  const activeVariant = variantStyles[variant] ?? variantStyles.default;

  return (
    <span
      className={`${baseStyles} ${sizeStyles} ${activeVariant} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
