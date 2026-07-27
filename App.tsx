import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { AdminCreditsPage } from './pages/AdminCreditsPage';
import { BatchWorkspacePage } from './pages/BatchWorkspacePage';
import { CreditsPage } from './pages/CreditsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StatsPage } from './pages/StatsPage';

const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const HomeRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }
  if (user) return <DashboardPage />;
  return <LandingPage />;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route
      path="/login"
      element={
        <PublicOnly>
          <LoginPage />
        </PublicOnly>
      }
    />
    <Route
      path="/register"
      element={
        <PublicOnly>
          <RegisterPage />
        </PublicOnly>
      }
    />
    <Route
      path="/batches/:id"
      element={
        <Protected>
          <BatchWorkspacePage />
        </Protected>
      }
    />
    <Route
      path="/credits"
      element={
        <Protected>
          <CreditsPage />
        </Protected>
      }
    />
    <Route
      path="/stats"
      element={
        <Protected>
          <StatsPage />
        </Protected>
      }
    />
    <Route path="/admin/credits" element={<AdminCreditsPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
