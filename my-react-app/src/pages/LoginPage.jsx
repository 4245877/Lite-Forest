// src/pages/LoginPage.jsx
import React, { useState, useRef } from 'react';
import styles from './LoginPage.module.css';
import { FaEye, FaEyeSlash, FaGoogle, FaFacebook } from 'react-icons/fa';

// --- helper для читання тіла помилки ---
async function readError(res) {
  try {
    const j = await res.json();
    return j?.message || res.statusText || 'Помилка запиту';
  } catch {
    return res.statusText || 'Помилка запиту';
  }
}

/**
 * Відкриває OAuth у pop-up вікні та завершує вхід, коли:
 *  1) попап повернувся на наш origin (після того, як бекенд поставив HttpOnly cookie) — закриваємо попап і рефрешимо сторінку
 *  2) попап надіслав window.postMessage('oauth:success') на наш origin — закриваємо попап і рефрешимо сторінку
 */
function useOAuthPopup() {
  const timerRef = useRef(null);

  const finalize = () => {
    // Куки вже мають бути встановлені бекендом; оновлюємо застосунок:
    window.location.assign('/');
  };

  const openPopup = (url, { onBlocked, onStart, onFinish } = {}) => {
    const width = 520;
    const height = 650;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const features = [
      'toolbar=no',
      'menubar=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes',
      `width=${width}`,
      `height=${height}`,
      `top=${Math.round(top)}`,
      `left=${Math.round(left)}`,
    ].join(',');

    onStart?.();

    const popup = window.open(url, 'oauth_popup', features);

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      onBlocked?.();
      onFinish?.();
      return;
    }

    // Спроба взяти фокус
    popup.focus?.();

    // 1) Обробка postMessage з попапа (якщо бекенд віддає сторінку-заглушку з window.opener.postMessage)
    const onMessage = (event) => {
      try {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (data === 'oauth:success' || (data && data.type === 'oauth:success')) {
          window.removeEventListener('message', onMessage);
          try { popup.close(); } catch {}
          clearInterval(timerRef.current);
          onFinish?.();
          finalize();
        }
      } catch {
        // ігноруємо
      }
    };
    window.addEventListener('message', onMessage);

    // 2) Полінг попапа: як тільки він повернувся на наш origin — закриваємо і завершуємо
    timerRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(timerRef.current);
        window.removeEventListener('message', onMessage);
        onFinish?.();
        // Якщо користувач сам закрив попап — все одно спробуємо оновити сторінку:
        finalize();
        return;
      }
      try {
        // Коли попап повернувся на наш origin (наприклад, "/", "/oauth-complete" тощо)
        const sameOrigin = popup.location.origin === window.location.origin;
        if (sameOrigin) {
          // Бекенд уже встановив куки — можна закривати попап і оновлювати застосунок
          popup.close();
          clearInterval(timerRef.current);
          window.removeEventListener('message', onMessage);
          onFinish?.();
          finalize();
        }
      } catch {
        // Cross-origin під час переходів на google.com/facebook.com — очікувано
      }
    }, 500);
  };

  return { openPopup };
}

// --- Блок соц-автентифікації (кнопки) ---
const SocialAuth = ({ setInlineError }) => {
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'facebook' | null
  const { openPopup } = useOAuthPopup();

  const startOAuth = (provider) => {
    if (oauthLoading) return;
    setInlineError?.('');
    setOauthLoading(provider);

    const origin = window.location.origin; // наприклад, https://app.example.com
    // Куди повертатись після логіну на бекенді: назад у застосунок. Попап закриємо автоматично.
    const redirectTo = encodeURIComponent(`${origin}/`);
    // Параметри підказки для Google — щоб гарантовано показати вибір акаунта і базові скоупи.
    const authParams =
      provider === 'google'
        ? '&prompt=select_account&scope=openid%20email%20profile'
        : '';

    // Підказка бекенду, що ми працюємо у попапі (щоб він, наприклад, віддав сторінку із postMessage і window.close() після успіху)
    const url = `/api/auth/oauth/${provider}?mode=popup&origin=${encodeURIComponent(
      origin
    )}&redirectTo=${redirectTo}${authParams}`;

    openPopup(url, {
      onBlocked: () => {
        setInlineError?.(
          'Браузер заблокував спливаюче вікно. Дозвольте pop-up для сайту і спробуйте ще раз.'
        );
      },
      onStart: () => {},
      onFinish: () => setOauthLoading(null),
    });
  };

  return (
    <div className={styles.socialButtons} role="group" aria-label="Соціальний вхід">
      <button
        type="button"
        className={`${styles.socialBtn} ${styles.googleBtn}`}
        onClick={() => startOAuth('google')}
        aria-label="Продовжити з Google"
        disabled={oauthLoading !== null}
      >
        <FaGoogle aria-hidden="true" />
        {oauthLoading === 'google' ? 'Входимо через Google…' : 'Продовжити з Google'}
      </button>

      <button
        type="button"
        className={`${styles.socialBtn} ${styles.facebookBtn}`}
        onClick={() => startOAuth('facebook')}
        aria-label="Продовжити з Facebook"
        disabled={oauthLoading !== null}
      >
        <FaFacebook aria-hidden="true" />
        {oauthLoading === 'facebook' ? 'Входимо через Facebook…' : 'Продовжити з Facebook'}
      </button>
    </div>
  );
};

// --- Компонент форми входу ---
const LoginForm = ({ onToggleForm }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [inlineError, setInlineError] = useState(''); // для помилок попапа
  const [loading, setLoading] = useState(false);

  const isFormValid = email.includes('@') && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');
    setInlineError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ВАЖЛИВО: для HttpOnly cookie
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error(await readError(res));

      alert('Успішний вхід!');
      // window.location.assign('/'); // якщо хочеш одразу на головну
    } catch (e) {
      setError(e.message || 'Помилка входу');
    } finally {
      setLoading(false);
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
          aria-label="Поле для вводу email"
          required
        />
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="login-password" className={styles.inputLabel}>Пароль</label>
        <input
          id="login-password"
          type={showPassword ? 'text' : 'password'}
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-label="Поле для введення пароля"
          required
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>

      <div className={styles.linkGroup}>
        <a href="#" className={styles.formLink} onClick={(e)=>e.preventDefault()}>Забули пароль?</a>
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

      {/* --- Роздільник і соц-кнопки ПІД блоком "Немає аккаунта? ..." --- */}
      <div className={styles.orDivider} aria-hidden="true">
        <span>або</span>
      </div>
      <SocialAuth setInlineError={setInlineError} />
    </form>
  );
};

// --- Компонент форми реєстрації ---
const RegisterForm = ({ onToggleForm }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState(''); // опціонально
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverOk, setServerOk] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const e = {};
    if (!email || !email.includes('@')) e.email = 'Введіть правильний email.';
    if (!password || password.length < 8) e.password = 'Пароль має бути не менше 8 символів.';
    if (password !== confirmPassword) e.confirmPassword = 'Паролі не збігаються.';
    if (name && name.length > 120) e.name = 'Занадто довге ім’я.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isFormValid = email && password && confirmPassword && Object.keys(errors).length === 0;

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
        credentials: 'include', // ВАЖЛИВО: server ставить HttpOnly cookie
        body: JSON.stringify({
          email,
          password,
          name: name?.trim() || email.split('@')[0], // якщо ім'я пусте — поставимо нік з email
        }),
      });

      if (!res.ok) {
        // 409 — email вже існує та ін.
        throw new Error(await readError(res));
      }

      setServerOk('Реєстрація пройшла успішно! Ви можете увійти.');
      setTimeout(() => {
        onToggleForm?.({ preventDefault: () => {} });
      }, 600);
      // або: window.location.assign('/');
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
          aria-label="Поле для вводу email для реєстрації"
          required
        />
        {errors.email && <p className={styles.errorText}>{errors.email}</p>}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="reg-name" className={styles.inputLabel}>Ім’я (необов’язково)</label>
        <input
          id="reg-name"
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={validateForm}
          autoComplete="name"
          aria-label="Ім’я користувача"
          placeholder="Іван"
        />
        {errors.name && <p className={styles.errorText}>{errors.name}</p>}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="reg-password" className={styles.inputLabel}>Пароль</label>
        <input
          id="reg-password"
          type={showPwd1 ? 'text' : 'password'}
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={validateForm}
          autoComplete="new-password"
          aria-label="Поле для вводу пароля для реєстрації"
          required
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setShowPwd1(!showPwd1)}
          aria-label={showPwd1 ? 'Приховати пароль' : 'Показати пароль'}
        >
          {showPwd1 ? <FaEyeSlash /> : <FaEye />}
        </button>
        {errors.password && <p className={styles.errorText}>{errors.password}</p>}
      </div>
      
      <div className={styles.inputGroup}>
        <label htmlFor="reg-confirm-password" className={styles.inputLabel}>Підтвердьте пароль</label>
        <input
          id="reg-confirm-password"
          type={showPwd2 ? 'text' : 'password'}
          className={styles.input}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={validateForm}
          autoComplete="new-password"
          aria-label="Поле для підтвердження пароля"
          required
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setShowPwd2(!showPwd2)}
          aria-label={showPwd2 ? 'Приховати пароль' : 'Показати пароль'}
        >
          {showPwd2 ? <FaEyeSlash /> : <FaEye />}
        </button>
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
      {/* Соц-вхід тут не показуємо: він зосереджений на формі входу */}
    </form>
  );
};

// --- Основний компонент сторінки ---
const LoginPage = () => {
  const [isLoginView, setIsLoginView] = useState(true);

  const handleToggleForm = (e) => {
    e?.preventDefault?.();
    setIsLoginView(v => !v);
  };

  return (
    <div className={styles.loginPage}>
      {/* Ліва декоративна панель */}
      <div className={styles.leftPanel}>
        <div className={styles.brandLogo} aria-hidden="true">🌿</div>
        <h1 className={styles.brandTitle}>Lite Forest</h1>
        <p className={styles.brandSlogan}>
          Ваш надійний партнер у світі екологічної продукції та усвідомленого споживання.
        </p>
      </div>

      {/* Права панель з формою */}
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
