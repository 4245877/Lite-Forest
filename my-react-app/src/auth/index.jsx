// src/auth/index.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // 1. Пробуем получить данные пользователя
      let res = await fetch('/api/me', { credentials: 'include' });

      // 2. Если Access Token устарел (401), пробуем обновить его через Refresh Token
      if (res.status === 401) {
        try {
          // ВНИМАНИЕ: Проверь, что адрес '/api/auth/refresh' правильный для твоего бэкенда!
          const refreshRes = await fetch('/api/auth/refresh', { 
            method: 'POST', 
            credentials: 'include' 
          });

          if (refreshRes.ok) {
            // Если обновление прошло успешно, повторяем запрос за профилем
            res = await fetch('/api/me', { credentials: 'include' });
          }
        } catch (err) {
          // Если refresh тоже упал — значит точно выходим
          console.error('Auto-refresh failed', err);
        }
      }

      // 3. Обрабатываем итоговый результат
      if (res.ok) {
        const u = await res.json();
        setUser(u || null);
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error('Auth check failed', e);
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
      const { message } = await res.json().catch(() => ({}));
      throw new Error(message || res.statusText || 'Помилка входу');
    }
    await refresh();
  };

  const signout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
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
  
  // Можно добавить красивый спиннер, пока идет проверка
  if (loading) return null; 
  
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
};