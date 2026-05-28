import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AuthGuard } from './auth/AuthGuard';
import { LoginPage } from './auth/LoginPage';
import { SeedPage } from './pages/SeedPage';
import { ReviewPage } from './pages/ReviewPage';
import { PredictPage } from './pages/PredictPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/:model/seed"
          element={
            <AuthGuard>
              <SeedPage />
            </AuthGuard>
          }
        />
        <Route
          path="/:model/review"
          element={
            <AuthGuard>
              <ReviewPage />
            </AuthGuard>
          }
        />
        <Route
          path="/:model/predict"
          element={
            <AuthGuard>
              <PredictPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/uroflow/seed" replace />} />
      </Routes>
    </AuthProvider>
  );
}
