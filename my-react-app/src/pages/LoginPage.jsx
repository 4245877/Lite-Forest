// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import styles from './LoginPage.module.css';

// Импортируем иконки для UI
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// --- Компонент формы входа ---
const LoginForm = ({ onToggleForm }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isFormValid = email.includes('@') && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setError('');

    // --- ИМИТАЦИЯ ЗАПРОСА К СЕРВЕРУ ---
    // ЗАМЕНИТЕ ЭТОТ КОД РЕАЛЬНЫМ ВЫЗОВОМ API
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (email === "test@example.com" && password === "password123") {
      alert('Успешный вход!');
      // Здесь должен быть редирект на главную страницу
    } else {
      setError('Неверный email или пароль.');
    }
    // ------------------------------------

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className={styles.formTitle}>Вход в аккаунт</h2>

      {error && <div className={styles.serverError}>{error}</div>}

      <div className={styles.inputGroup}>
        <label htmlFor="login-email" className={styles.inputLabel}>Email</label>
        <input
          id="login-email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Поле для ввода email"
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
          aria-label="Поле для ввода пароля"
          required
        />
        <span
          className={styles.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </span>
      </div>
      
      <div className={styles.linkGroup}>
          <a href="#" className={styles.formLink}>Забыли пароль?</a>
      </div>

      <button type="submit" className={styles.submitButton} disabled={!isFormValid || loading}>
        {loading ? 'Входим...' : 'Войти'}
      </button>

      <p className={styles.toggleForm}>
        Нет аккаунта?{' '}
        <a href="#" onClick={onToggleForm} className={styles.formLink}>
          Зарегистрироваться
        </a>
      </p>
    </form>
  );
};

// --- Компонент формы регистрации ---
const RegisterForm = ({ onToggleForm }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const validateForm = () => {
    const newErrors = {};
    if (!email.includes('@')) newErrors.email = 'Введите корректный email.';
    if (password.length < 8) newErrors.password = 'Пароль должен быть не менее 8 символов.';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Пароли не совпадают.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = email && password && confirmPassword && Object.keys(errors).length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setServerError('');
    
    // --- ИМИТАЦИЯ ЗАПРОСА К СЕРВЕРУ ---
    // ЗАМЕНИТЕ ЭТОТ КОД РЕАЛЬНЫМ ВЫЗОВОМ API
    await new Promise(resolve => setTimeout(resolve, 1500));
    // Допустим, email уже занят
    if (email === "test@example.com") {
      setServerError('Пользователь с таким email уже существует.');
    } else {
       alert('Регистрация прошла успешно!');
      // Здесь можно переключить на форму входа или сделать редирект
    }
    // ------------------------------------

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className={styles.formTitle}>Создание аккаунта</h2>

       {serverError && <div className={styles.serverError}>{serverError}</div>}

      <div className={styles.inputGroup}>
        <label htmlFor="reg-email" className={styles.inputLabel}>Email</label>
        <input
          id="reg-email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={validateForm}
          aria-label="Поле для ввода email для регистрации"
          required
        />
        {errors.email && <p className={styles.errorText}>{errors.email}</p>}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="reg-password" className={styles.inputLabel}>Пароль</label>
        <input
          id="reg-password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={validateForm}
          aria-label="Поле для ввода пароля для регистрации"
          required
        />
        {errors.password && <p className={styles.errorText}>{errors.password}</p>}
      </div>
      
      <div className={styles.inputGroup}>
        <label htmlFor="reg-confirm-password" className={styles.inputLabel}>Подтвердите пароль</label>
        <input
          id="reg-confirm-password"
          type="password"
          className={styles.input}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={validateForm}
          aria-label="Поле для подтверждения пароля"
          required
        />
        {errors.confirmPassword && <p className={styles.errorText}>{errors.confirmPassword}</p>}
      </div>

      <button type="submit" className={styles.submitButton} disabled={!isFormValid || loading}>
        {loading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>

      <p className={styles.toggleForm}>
        Уже есть аккаунт?{' '}
        <a href="#" onClick={onToggleForm} className={styles.formLink}>
          Войти
        </a>
      </p>
    </form>
  );
};


// --- Основной компонент страницы ---
const LoginPage = () => {
  const [isLoginView, setIsLoginView] = useState(true);

  const handleToggleForm = (e) => {
    e.preventDefault();
    setIsLoginView(!isLoginView);
  };

  return (
    <div className={styles.loginPage}>
      {/* Левая декоративная панель */}
      <div className={styles.leftPanel}>
        <div className={styles.brandLogo} aria-hidden="true">
          🌿
        </div>
        <h1 className={styles.brandTitle}>DRUKARNYA</h1>
        <p className={styles.brandSlogan}>
          Ваш надежный партнер в мире экологичной продукции и осознанного потребления.
        </p>
      </div>

      {/* Правая панель с формой */}
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