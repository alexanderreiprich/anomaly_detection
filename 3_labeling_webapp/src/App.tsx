import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AuthGuard } from './auth/AuthGuard';
import { LoginPage } from './auth/LoginPage';
import { SeedPage } from './pages/SeedPage';
import { ReviewPage } from './pages/ReviewPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/seed"
          element={
            <AuthGuard>
              <SeedPage />
            </AuthGuard>
          }
        />
        <Route
          path="/review"
          element={
            <AuthGuard>
              <ReviewPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/seed" replace />} />
      </Routes>
    </AuthProvider>
  );
}
