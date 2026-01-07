// src/pages/LoginPage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import styles from './LoginPage.module.css';
import { FaEye, FaEyeSlash, FaGoogle, FaFacebook } from 'react-icons/fa';

// --- Helper для чтения тела ошибки ---
async function readError(res) {
  try {
    const j = await res.json();
    return j?.message || res.statusText || 'Помилка запиту';
  } catch (e) {
    return res.statusText || 'Помилка запиту';
  }
}

/**
 * Хук для OAuth в pop-up вікні.
 * Керує відкриттям вікна та відстеженням результату.
 */
function useOAuthPopup() {
  const timerRef = useRef(null);

  // Очистка таймера при размонтировании компонента
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const finalize = useCallback(() => {
    // После успеха ведем пользователя в кабинет
    // Использование location.replace гарантирует полную перезагрузку и актуализацию состояния auth
    window.location.replace('/profile');
  }, []);

  const openPopup = useCallback((url, { onBlocked, onStart, onFinish } = {}) => {
    const width = 520;
    const height = 650;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    
    const features = [
      'toolbar=no', 'menubar=no', 'status=no', 'resizable=yes', 'scrollbars=yes',
      `width=${width}`, `height=${height}`,
      `top=${Math.round(top)}`, `left=${Math.round(left)}`,
    ].join(',');

    onStart?.();

    const popup = window.open(url, 'oauth_popup', features);

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      onBlocked?.();
      onFinish?.();
      return;
    }

    popup.focus?.();

    // 1) Обработка postMessage (если бекенд присылает событие)
    const onMessage = (event) => {
      try {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (data === 'oauth:success' || (data && data.type === 'oauth:success')) {
          window.removeEventListener('message', onMessage);
          popup.close();
          clearInterval(timerRef.current);
          onFinish?.();
          finalize();
        }
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('message', onMessage);

    // 2) Поллинг закрытия окна или смены URL
    timerRef.current = setInterval(() => {
      // Если окно закрыто пользователем
      if (popup.closed) {
        clearInterval(timerRef.current);
        window.removeEventListener('message', onMessage);
        onFinish?.();
        // Можно попробовать обновить, вдруг кука успела встать
        finalize();
        return;
      }
      try {
        // Проверка на same-origin (значит редирект прошел успешно)
        const sameOrigin = popup.location.origin === window.location.origin;
        if (sameOrigin) {
          popup.close();
          clearInterval(timerRef.current);
          window.removeEventListener('message', onMessage);
          onFinish?.();
          finalize();
        }
      } catch (e) {
        // Ожидаемая ошибка Cross-origin пока мы на google/facebook
      }
    }, 500);
  }, [finalize]);

  return { openPopup };
}

// --- Блок соц-автентифікації ---
const SocialAuth = ({ setInlineError }) => {
  const [oauthLoading, setOauthLoading] = useState(null);
  const { openPopup } = useOAuthPopup();

  const startOAuth = (provider) => {
    if (oauthLoading) return;
    setInlineError?.('');
    setOauthLoading(provider);

    const origin = window.location.origin;
    const redirectTo = encodeURIComponent(`${origin}/`);
    const authParams = provider === 'google'
        ? '&prompt=select_account&scope=openid%20email%20profile'
        : '';

    const url = `/api/auth/oauth/${provider}?mode=popup&origin=${encodeURIComponent(origin)}&redirectTo=${redirectTo}${authParams}`;

    openPopup(url, {
      onBlocked: () => {
        setInlineError?.('Браузер заблокував спливаюче вікно. Дозвольте pop-up для сайту.');
      },
      onStart: () => {}, // loading уже установлен
      onFinish: () => setOauthLoading(null),
    });
  };

  return (
    <div className={styles.socialButtons} role="group" aria-label="Соціальний вхід">
      <button
        type="button"
        className={`${styles.socialBtn} ${styles.googleBtn}`}
        onClick={() => startOAuth('google')}
        disabled={oauthLoading !== null}
      >
        <FaGoogle aria-hidden="true" />
        {oauthLoading === 'google' ? 'Входимо...' : 'Google'}
      </button>

      <button
        type="button"
        className={`${styles.socialBtn} ${styles.facebookBtn}`}
        onClick={() => startOAuth('facebook')}
        disabled={oauthLoading !== null}
      >
        <FaFacebook aria-hidden="true" />
        {oauthLoading === 'facebook' ? 'Входимо...' : 'Facebook'}
      </button>
    </div>
  );
};

// --- Форма входу ---
const LoginForm = ({ onToggleForm }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/profile';

  const isFormValid = email.includes('@') && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');
    setInlineError('');

    try {
      await signin(email, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message || 'Помилка входу');
      setLoading(false); // Сбрасываем только при ошибке, при успехе мы уходим со страницы
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className={styles.formTitle}>Вхід в аккаунт</h2>

      {(error || inlineError) && (
        <div className={styles.serverError}>{error || inlineError}</div>
      )}

      <div className={styles.inputGroup}>
        <label htmlFor="login-email" className={styles.inputLabel}>Email</label>
        <input
          id="login-email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="login-password" className={styles.inputLabel}>Пароль</label>
        <div className={styles.fieldControl}>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            className={`${styles.input} ${styles.inputWithToggle}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? 'Приховати' : 'Показати'}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
      </div>

      <div className={styles.linkGroup}>
        <button type="button" className={styles.formLink} onClick={() => navigate('/reset')}>
          Забули пароль?
        </button>
      </div>

      <button type="submit" className={styles.submitButton} disabled={!isFormValid || loading}>
        {loading ? 'Входимо...' : 'Увійти'}
      </button>

      <p className={styles.toggleForm}>
        Немає аккаунта?{' '}
        <a href="#" onClick={onToggleForm} className={styles.formLink}>
          Зареєструватися
        </a>
      </p>

      <div className={styles.orDivider} aria-hidden="true"><span>або</span></div>
      <SocialAuth setInlineError={setInlineError} />
    </form>
  );
};

// --- Форма реєстрації ---
const RegisterForm = ({ onToggleForm }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverOk, setServerOk] = useState('');
  const [loading, setLoading] = useState(false);

  // FIX: Таймер теперь живет в useEffect и не течет при размонтировании
  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const validateForm = () => {
    const e = {};
    if (!email || !email.includes('@')) e.email = 'Введіть правильний email.';
    if (!password || password.length < 8) e.password = 'Пароль має бути не менше 8 символів.';
    if (password !== confirmPassword) e.confirmPassword = 'Паролі не збігаються.';
    if (name && name.length > 120) e.name = 'Занадто довге ім’я.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isFormValid = email && password && confirmPassword && /^\d{6}$/.test(code) && Object.keys(errors).length === 0;

  async function sendSignupCode() {
    if (!email || !email.includes('@')) {
      setErrors((e) => ({ ...e, email: 'Введіть правильний email.' }));
      return;
    }
    setSendingCode(true);
    setServerError('');
    try {
      await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, purpose: 'signup' }),
      });
      setCodeSent(true);
      setCooldown(60); // Запускает useEffect
    } catch (e) {
      setServerError('Не вдалося надіслати код');
    } finally {
      setSendingCode(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerOk('');
    setServerError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          name: name?.trim() || email.split('@')[0],
          code,
        }),
      });

      if (!res.ok) throw new Error(await readError(res));

      setServerOk('Реєстрація пройшла успішно! Ви можете увійти.');
      setTimeout(() => {
        onToggleForm?.({ preventDefault: () => {} });
      }, 600);
    } catch (err) {
      setServerError(err.message || 'Помилка реєстрації');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className={styles.formTitle}>Створення аккаунта</h2>

      {serverError && <div className={styles.serverError}>{serverError}</div>}
      {serverOk && <div className={styles.serverOk}>{serverOk}</div>}

      <div className={styles.inputGroup}>
        <label htmlFor="reg-email" className={styles.inputLabel}>Email</label>
        <input
          id="reg-email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={validateForm}
          autoComplete="email"
          required
        />
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            className={styles.secondaryButton} // Убедись, что этот класс есть в CSS или используй inline/общий класс
            style={{ fontSize: '0.9rem', color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
            onClick={sendSignupCode}
            disabled={sendingCode || cooldown > 0}
          >
            {sendingCode ? 'Надсилаємо…' : cooldown ? `Повторити через ${cooldown} c` : 'Надіслати код'}
          </button>
          {codeSent && <span style={{ marginLeft: 8, fontSize: 12, color: 'green' }}>Код відправлено</span>}
        </div>
        {errors.email && <p className={styles.errorText}>{errors.email}</p>}
      </div>

      {codeSent && (
        <div className={styles.inputGroup}>
          <label htmlFor="reg-code" className={styles.inputLabel}>Код з email</label>
          <input
            id="reg-code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            className={styles.input}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          {!/^\d{6}$/.test(code) && <p className={styles.errorText} style={{marginTop:4}}>Введіть 6 цифр</p>}
        </div>
      )}

      <div className={styles.inputGroup}>
        <label htmlFor="reg-name" className={styles.inputLabel}>Ім’я (необов’язково)</label>
        <input
          id="reg-name"
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Іван"
        />
      </div>

      {/* Пароли */}
      <div className={styles.inputGroup}>
        <label htmlFor="reg-password" className={styles.inputLabel}>Пароль</label>
        <div className={styles.fieldControl}>
          <input
            id="reg-password"
            type={showPwd1 ? 'text' : 'password'}
            className={`${styles.input} ${styles.inputWithToggle}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={validateForm}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPwd1(!showPwd1)}
          >
            {showPwd1 ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errors.password && <p className={styles.errorText}>{errors.password}</p>}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="reg-confirm-password" className={styles.inputLabel}>Підтвердьте пароль</label>
        <div className={styles.fieldControl}>
          <input
            id="reg-confirm-password"
            type={showPwd2 ? 'text' : 'password'}
            className={`${styles.input} ${styles.inputWithToggle}`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={validateForm}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPwd2(!showPwd2)}
          >
            {showPwd2 ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errors.confirmPassword && <p className={styles.errorText}>{errors.confirmPassword}</p>}
      </div>

      <button type="submit" className={styles.submitButton} disabled={!isFormValid || loading}>
        {loading ? 'Реєстрація...' : 'Зареєструватися'}
      </button>

      <p className={styles.toggleForm}>
        Вже є обліковий аккаунт?{' '}
        <a href="#" onClick={onToggleForm} className={styles.formLink}>
          Увійти
        </a>
      </p>
    </form>
  );
};

const LoginPage = () => {
  const [isLoginView, setIsLoginView] = useState(true);

  // Достаем user и loading из нашего контекста
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Если загрузка прошла и user существует — сразу уходим в профиль
  useEffect(() => {
    if (!loading && user) {
      navigate('/profile', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleToggleForm = (e) => {
    e?.preventDefault?.();
    setIsLoginView((v) => !v);
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.leftPanel}>
        <div className={styles.brandLogo} aria-hidden="true">🌿</div>
        <h1 className={styles.brandTitle}>Lite Forest</h1>
        <p className={styles.brandSlogan}>
          Ваш надійний партнер у світі екологічної продукції та усвідомленого споживання.
        </p>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          {isLoginView ? (
            <LoginForm onToggleForm={handleToggleForm} />
          ) : (
            <RegisterForm onToggleForm={handleToggleForm} />
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
