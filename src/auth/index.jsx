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

const AuthCtx = createContext(null);

/**
 * Õóê äîñòóïà ê êîíòåêñòó àâòîðèçàöèè.
 * Åñëè <AuthProvider> íå îáåðíóë äåðåâî  áðîñàåì ïîíÿòíóþ îøèáêó,
 * ÷òîáû íå ïîëó÷àòü ïóñòîé ýêðàí áåç ïðè÷èíû.
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

  // Îøèáêà àâòîðèçàöèè/ïðîâåðêè ñåññèè, ÷òîáû ïîêàçûâàòü å¸ â UI
  const [error, setError] = useState(null);

  // ×òîáû íå äåëàòü setState ïîñëå ðàçìîíòèðîâàíèÿ
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
        const err = await formatHttpError(res, 'Ïîìèëêà âõîäó');
        if (aliveRef.current) setError(err.message);
        throw err;
      }

      // Ïîñëå ëîãèíà ïîäòÿãèâàåì /api/me
      await refresh({ silent: false });
    },
    [refresh]
  );

  const signout = useCallback(async () => {
    if (aliveRef.current) setError(null);

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      // Ëîãàóò ìîã óïàñòü ïî ñåòè  âñ¸ ðàâíî ÷èñòèì ëîêàëüíîå ñîñòîÿíèå
      console.error(formatUnknownError(e, 'Logout request failed'));
    } finally {
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

  // Âìåñòî "ïóñòîãî ýêðàíà" ïîêàçûâàåì ïîíÿòíîå ñîñòîÿíèå
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <div>Ïðîâåðÿþ ñåññèþ</div>
      </div>
    );
  }

  // Åñëè ïðè ïðîâåðêå áûëà îøèáêà  ïîêàæåì å¸ â UI
  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 8 }}>Ñåé÷àñ íå ïîëó÷èëîñü ïðîâåðèòü âõîä.</div>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{error}</pre>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
};
