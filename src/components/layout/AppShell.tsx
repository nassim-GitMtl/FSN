import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toast } from './Toast';
import { ErrorBoundary } from './ErrorBoundary';

export const AppShell: React.FC = () => {
  const { sidebarCollapsed, unsavedChanges } = useUIStore();
  const location = useLocation();

  // Mobile: check if we're on a mobile-specific route
  const isMobileRoute = location.pathname.startsWith('/mobile');

  if (isMobileRoute) {
    return (
      <div className="h-full bg-surface-50">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
        <Toast />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <Sidebar />
      <div
        className={cn(
          'relative min-h-screen transition-[margin] duration-200',
          sidebarCollapsed ? 'ml-[88px]' : 'ml-[272px]',
        )}
      >
        <Header />
        <main className="pt-[88px]">
          <div className="mx-auto min-h-[calc(100vh-88px)] max-w-[1480px] px-5 pb-8 xl:px-8">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {unsavedChanges && (
        <div className="fixed bottom-5 right-6 z-40 max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_18px_32px_-28px_rgba(120,53,15,0.35)]">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
            <div className="min-w-0">
              <div className="font-semibold">Unsaved changes are still open on this page.</div>
              <div className="mt-1 text-amber-800/85">Save or cancel the page before moving to another workspace.</div>
            </div>
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
};
