import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, username } = useAuth();
  if (loading) return <div className="loading-screen">Laden...</div>;
  if (!username) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
