import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  rollEffect?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      rollEffect = false,
      loading = false,
      icon,
      disabled,
      ...props
    },
    ref,
  ) {
    const baseStyles =
      'group relative inline-flex items-center justify-center font-medium font-mono text-xs uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none';

    const sizeStyles = {
      sm: 'h-8 px-3.5 py-1 text-[11px] rounded-full gap-1.5',
      md: 'h-10 px-5 py-2 text-xs rounded-full gap-2',
      lg: 'h-12 px-7 py-3 text-sm rounded-full gap-2.5',
    }[size];

    const variantStyles = {
      primary:
        'bg-brand text-white hover:bg-brand-700 active:scale-[0.98] shadow-sm hover:shadow',
      secondary:
        'bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] dark:bg-slate-100 dark:text-slate-900',
      outline:
        'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
      ghost:
        'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-slate-800',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] shadow-sm',
    }[variant];

    const isRollable = rollEffect && typeof children === 'string' && !loading;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          icon && <span className="inline-flex shrink-0">{icon}</span>
        )}

        {isRollable ? (
          <span className="relative inline-block h-[1.3em] overflow-hidden leading-[1.3em]">
            <span className="inline-block transition-transform duration-300 ease-out group-hover:-translate-y-full">
              {children}
            </span>
            <span
              aria-hidden="true"
              className="absolute left-0 top-full inline-block transition-transform duration-300 ease-out group-hover:-translate-y-full"
            >
              {children}
            </span>
          </span>
        ) : (
          <span>{children}</span>
        )}
      </button>
    );
  },
);
