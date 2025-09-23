import { createContext, useContext } from 'react';

export const AuthContext = createContext({ user: null, loading: true, idToken: null, signOut: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return null;
  return children;
}
