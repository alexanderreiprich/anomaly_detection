import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { CognitoUserSession } from 'amazon-cognito-identity-js';
import * as cognito from '../config/cognito';

interface AuthState {
  loading: boolean;
  username: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function extractUsername(session: CognitoUserSession): string {
  const payload = session.getIdToken().payload;
  return payload['email'] ?? payload['cognito:username'];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    cognito
      .getSession()
      .then((session: CognitoUserSession) => {
        setUsername(extractUsername(session));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSignIn = useCallback(async (user: string, password: string) => {
    const session = await cognito.signIn(user, password);
    setUsername(extractUsername(session));
  }, []);

  const handleSignOut = useCallback(() => {
    cognito.signOut();
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, username, signIn: handleSignIn, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
