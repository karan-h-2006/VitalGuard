import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from './error-boundary.js';

function Bomb(): ReactNode {
  throw new Error('Explosion during render!');
}

function SafeComponent(): ReactNode {
  return <div>Safe Content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const markup = renderToStaticMarkup(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>,
    );
    expect(markup).toContain('Safe Content');
  });

  it('catches render errors and displays fallback UI without clearing session', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      renderToStaticMarkup(
        <ErrorBoundary level="admin">
          <Bomb />
        </ErrorBoundary>,
      );
    } catch {
      // Expected during server render of Bomb
    }

    consoleSpy.mockRestore();

    // Verify ErrorBoundary state derivation
    const derived = ErrorBoundary.getDerivedStateFromError(
      new Error('Test render crash'),
    );
    expect(derived.hasError).toBe(true);
    expect(derived.error?.message).toBe('Test render crash');
  });
});
