'use client';

import { ToastProvider } from './ui/Toast';
import { ErrorBoundary } from './ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ErrorBoundary>
  );
}
