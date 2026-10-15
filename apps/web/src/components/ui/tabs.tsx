import React, { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
  variant?: 'pills' | 'bracketed' | 'underline';
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: 'pills' | 'bracketed' | 'underline';
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  variant = 'pills',
  children,
  className = '',
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newVal: string) => {
    if (!isControlled) {
      setInternalValue(newVal);
    }
    onValueChange?.(newVal);
  };

  return (
    <TabsContext.Provider
      value={{ value: activeValue, onValueChange: handleValueChange, variant }}
    >
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

export function TabsList({
  children,
  className = '',
  ...props
}: TabsListProps) {
  const ctx = useContext(TabsContext);
  const variant = ctx?.variant || 'pills';

  const variantStyles = {
    pills:
      'inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60',
    bracketed:
      'inline-flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800',
    underline:
      'inline-flex border-b border-slate-200 dark:border-slate-800 gap-6',
  }[variant];

  return (
    <div role="tablist" className={`${variantStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  children,
  className = '',
  ...props
}: TabsTriggerProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsTrigger must be used within Tabs');

  const isSelected = ctx.value === value;
  const variant = ctx.variant || 'pills';

  const baseStyles =
    'font-mono text-xs uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

  let variantStyles = '';
  if (variant === 'pills') {
    variantStyles = isSelected
      ? 'rounded-full bg-white px-4 py-1.5 font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
      : 'rounded-full px-4 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200';
  } else if (variant === 'bracketed') {
    variantStyles = isSelected
      ? 'font-semibold text-brand'
      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200';
  } else {
    variantStyles = isSelected
      ? 'border-b-2 border-brand pb-2 font-semibold text-brand'
      : 'pb-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200';
  }

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isSelected}
      onClick={() => ctx.onValueChange(value)}
      className={`${baseStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {variant === 'bracketed' ? (
        <span>
          <span className="text-slate-400 mr-1">[</span>
          {children}
          <span className="text-slate-400 ml-1">]</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({
  value,
  children,
  className = '',
  ...props
}: TabsContentProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabsContent must be used within Tabs');

  if (ctx.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-4 focus-visible:outline-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
