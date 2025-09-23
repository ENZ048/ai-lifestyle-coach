import { useEffect, useMemo, useState } from 'react';
import { auth, onAuthStateChanged, onIdTokenChanged, signOut as fbSignOut } from '../lib/firebase';
import { AuthContext } from './authContextShared';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
    });

    const unsubToken = onIdTokenChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdToken();
        setIdToken(token);
      } else {
        setIdToken(null);
      }
    });

    return () => {
      unsubAuth?.();
      unsubToken?.();
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, idToken, signOut: () => fbSignOut(auth) }),
    [user, loading, idToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
