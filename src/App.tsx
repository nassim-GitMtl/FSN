import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui';
import { useAuthStore, useUIStore } from '@/store';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { JobList } from '@/pages/jobs/JobList';
import { JobDetail } from '@/pages/jobs/JobDetail';
import { JobForm } from '@/pages/jobs/JobForm';
import { Dispatch } from '@/pages/Dispatch';
import { Schedule } from '@/pages/Schedule';
import { Technicians } from '@/pages/Technicians';
import { ClientList } from '@/pages/clients/ClientList';
import { ClientDetail } from '@/pages/clients/ClientDetail';
import { SearchPage } from '@/pages/Search';
import { BillingList, SODetail } from '@/pages/Billing';
import { Reports } from '@/pages/Reports';
import { MobileApp } from '@/pages/mobile/MobileApp';

const ProtectedAppShell: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);
  const logout = useAuthStore((state) => state.logout);
  const { dataStatus, dataError, bootstrapApp, triggerSync } = useUIStore((state) => ({
    dataStatus: state.dataStatus,
    dataError: state.dataError,
    bootstrapApp: state.bootstrapApp,
    triggerSync: state.triggerSync,
  }));

  useEffect(() => {
    if (isAuthenticated) {
      void bootstrapApp();
    }
  }, [bootstrapApp, isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => {
      if (useUIStore.getState().dataStatus === 'READY') {
        void triggerSync({ silent: true });
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated, triggerSync]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (dataStatus === 'IDLE' || dataStatus === 'LOADING') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950 px-6 text-white">
        <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_30px_80px_-50px_rgba(15,23,32,0.55)]">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-brand-500/20" />
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Loading shared demo workspace</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Pulling jobs, technicians, clients, and billing records from Supabase.
          </p>
        </div>
      </div>
    );
  }

  if (dataStatus === 'ERROR') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950 px-6 text-white">
        <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_-50px_rgba(15,23,32,0.55)]">
          <div className="eyebrow text-white/50">Configuration required</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">The demo backend is not ready yet</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/68">
            {dataError || 'Supabase could not be reached. Check your environment variables and database setup, then retry.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => void bootstrapApp()}>
              Retry connection
            </Button>
            <Button variant="outline" onClick={logout}>
              Back to login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell />;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

export const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route
        path="/login"
        element={(
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        )}
      />
      <Route path="/" element={<ProtectedAppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="jobs" element={<JobList />} />
        <Route path="jobs/new" element={<JobForm />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="jobs/:id/edit" element={<JobForm />} />
        <Route path="dispatch" element={<Dispatch />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="technicians" element={<Technicians />} />
        <Route path="clients" element={<ClientList />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="billing" element={<BillingList />} />
        <Route path="billing/:id" element={<SODetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="mobile" element={<MobileApp />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
