import React, { createContext, useContext, useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface AccordionContextValue {
  openItems: string[];
  toggleItem: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  children: React.ReactNode;
  className?: string;
}

export function Accordion({
  type = 'single',
  defaultValue,
  children,
  className = '',
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(() => {
    if (!defaultValue) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  });

  const toggleItem = (id: string) => {
    if (type === 'single') {
      setOpenItems((prev) => (prev.includes(id) ? [] : [id]));
    } else {
      setOpenItems((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
      );
    }
  };

  return (
    <AccordionContext.Provider value={{ openItems, toggleItem }}>
      <div
        className={`divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800 ${className}`}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({
  value,
  children,
  className = '',
}: AccordionItemProps) {
  return (
    <div data-value={value} className={`py-2 transition-colors ${className}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{ value?: string }>,
            { value },
          );
        }
        return child;
      })}
    </div>
  );
}

export interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string;
}

export function AccordionTrigger({
  value,
  children,
  className = '',
  ...props
}: AccordionTriggerProps) {
  const ctx = useContext(AccordionContext);
  if (!ctx || !value)
    throw new Error('AccordionTrigger must be used within AccordionItem');

  const isOpen = ctx.openItems.includes(value);

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => ctx.toggleItem(value)}
      className={`flex w-full items-center justify-between py-4 text-left font-sans text-base sm:text-lg font-medium text-slate-900 transition-all hover:text-brand dark:text-slate-100 dark:hover:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg px-2 ${className}`}
      {...props}
    >
      <span>{children}</span>
      <span className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-transform duration-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {isOpen ? (
          <Minus className="h-3.5 w-3.5" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
}

export function AccordionContent({
  value,
  children,
  className = '',
  ...props
}: AccordionContentProps) {
  const ctx = useContext(AccordionContext);
  if (!ctx || !value)
    throw new Error('AccordionContent must be used within AccordionItem');

  const isOpen = ctx.openItems.includes(value);

  if (!isOpen) return null;

  return (
    <div
      className={`px-2 pb-5 pt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400 animate-fade-in-up ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
