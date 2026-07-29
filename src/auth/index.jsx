// src/auth/index.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { purgeProductQuestionThreads } from '../utils/productQuestionStorage';

const AuthCtx = createContext(null);

/**
 * Хук доступа к контексту авторизации.
 * Если <AuthProvider> не обернул дерево — бросаем понятную ошибку,
 * чтобы не получать “пустой экран” без причины.
 */
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
};

const safeJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const formatHttpError = async (res, fallback) => {
  const data = await safeJson(res);
  const msg =
    (data && (data.message || data.error)) ||
    fallback ||
    res.statusText ||
    'Request failed';
  return new Error(`[${res.status}] ${msg}`);
};

const formatUnknownError = (e, fallback = 'Unexpected error') => {
  if (e instanceof Error) return e;
  return new Error(`${fallback}: ${String(e)}`);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ошибка авторизации/проверки сессии, чтобы показывать её в UI
  const [error, setError] = useState(null);

  // Чтобы не делать setState после размонтирования
  const aliveRef = useRef(true);
  const inflightRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // deps []
  const refresh = useCallback((opts = {}) => {
    const { silent = false } = opts;

    if (inflightRef.current) return inflightRef.current;

    const p = (async () => {
      if (!silent && aliveRef.current) setLoading(true);
      if (aliveRef.current) setError(null);

      try {
        let res = await fetch('/api/me', { credentials: 'include' });

        if (res.status === 401) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshRes.ok) {
            res = await fetch('/api/me', { credentials: 'include' });
          } else if (refreshRes.status !== 401) {
            throw await formatHttpError(refreshRes, 'Token refresh failed');
          }
        }

        if (res.ok) {
          const u = await safeJson(res);
          if (aliveRef.current) setUser(u || null);
        } else if (res.status === 401) {
          if (aliveRef.current) setUser(null);
        } else {
          const err = await formatHttpError(res, 'Auth check failed');
          console.error(err);
          if (aliveRef.current) {
            setUser(null);
            setError(err.message);
          }
        }
      } catch (e) {
        const err = formatUnknownError(e, 'Auth check failed');
        console.error(err);
        if (aliveRef.current) {
          setUser(null);
          setError(err.message);
        }
      } finally {
        if (!silent && aliveRef.current) setLoading(false);
      }
    })();

    inflightRef.current = p.finally(() => {
      inflightRef.current = null;
    });

    return inflightRef.current;
  }, []);

  useEffect(() => {
    refresh({ silent: false });
  }, [refresh]);

  const signin = useCallback(
    async (email, password) => {
      if (aliveRef.current) setError(null);

      let res;
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
      } catch (e) {
        const err = formatUnknownError(e, 'Login request failed');
        if (aliveRef.current) setError(err.message);
        throw err;
      }

      if (!res.ok) {
        const err = await formatHttpError(res, 'Помилка входу');
        if (aliveRef.current) setError(err.message);
        throw err;
      }

      // После логина подтягиваем /api/me
      await refresh({ silent: false });
    },
    [refresh]
  );

  const signout = useCallback(async () => {
    if (aliveRef.current) setError(null);

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      // Логаут мог упасть по сети — всё равно чистим локальное состояние
      console.error(formatUnknownError(e, 'Logout request failed'));
    } finally {
      // Треды «Питання майстру» держат в localStorage thread_token, который даёт
      // доступ к переписке без кук. После выхода он не должен пережить сессию:
      // иначе следующий пользователь этого браузера дочитает и продолжит чужой
      // диалог.
      purgeProductQuestionThreads();
      if (aliveRef.current) setUser(null);
    }
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, error, signin, signout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const RequireAuth = () => {
  const { user, loading, error } = useAuth();
  const location = useLocation();

  // Вместо "пустого экрана" показываем понятное состояние
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div>Проверяю сессию…</div>
      </div>
    );
  }

  // Если при проверке была ошибка — покажем её в UI
  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8 }}>Сейчас не получилось проверить вход.</div>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{error}</pre>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
};
