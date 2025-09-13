import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const u = await res.json();
        setUser(u || null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signin = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const { message } = await res.json().catch(()=>({}));
      throw new Error(message || res.statusText || 'Помилка входу');
    }
    await refresh();
  };

  const signout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); }
    finally { setUser(null); }
  };

  return (
    <AuthCtx.Provider value={{ user, loading, signin, signout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const RequireAuth = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null; // або спінер
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
};
