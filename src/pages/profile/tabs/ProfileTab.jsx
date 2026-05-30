import React, { useEffect, useRef, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const ProfileTab = ({ user }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);

  const [twoFAEnabled, setTwoFAEnabled] = useState(!!user?.twoFAEnabled);
  const [twoFAStage, setTwoFAStage] = useState('idle');
  const [otpUri, setOtpUri] = useState('');
  const [otpSecret, setOtpSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [twoMsg, setTwoMsg] = useState('');
  const [twoErr, setTwoErr] = useState('');
  const codeRef = useRef(null);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setTwoFAEnabled(!!user?.twoFAEnabled);
  }, [user?.name, user?.email, user?.twoFAEnabled]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setSaving(true);

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email }),
      });

      if (!res.ok) throw new Error(await readError(res));
      setMsg('Профіль оновлено');
    } catch (e) {
      setErr(e.message || 'Не вдалося оновити профіль');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    if (newPwd.length < 8) {
      setErr('Пароль має бути не менше 8 символів');
      return;
    }

    if (newPwd !== newPwd2) {
      setErr('Паролі не співпадають');
      return;
    }

    try {
      const res = await fetch('/api/account/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });

      if (!res.ok) throw new Error(await readError(res));
      setMsg('Пароль змінено');
      setOldPwd('');
      setNewPwd('');
      setNewPwd2('');
    } catch (e) {
      setErr(e.message || 'Помилка зміни пароля');
    }
  };

  const start2FA = async () => {
    setTwoErr('');
    setTwoMsg('');

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setOtpUri(data?.otpauthUrl || '');
      setOtpSecret(data?.secret || '');
      setTwoFAStage('verify');
      setTimeout(() => codeRef.current?.focus(), 0);
    } catch (e) {
      setTwoErr(e.message || 'Не вдалося ініціювати 2FA');
    }
  };

  const confirm2FA = async () => {
    setTwoErr('');
    setTwoMsg('');

    try {
      const res = await fetch('/api/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: otpCode }),
      });

      if (!res.ok) throw new Error(await readError(res));
      setTwoMsg('2FA увімкнено');
      setTwoFAEnabled(true);
      setTwoFAStage('idle');
      setOtpUri('');
      setOtpSecret('');
      setOtpCode('');
    } catch (e) {
      setTwoErr(e.message || 'Код невірний');
    }
  };

  const disable2FA = async () => {
    setTwoErr('');
    setTwoMsg('');

    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
      setTwoMsg('2FA вимкнено');
      setTwoFAEnabled(false);
      setTwoFAStage('idle');
    } catch (e) {
      setTwoErr(e.message || 'Не вдалося вимкнути 2FA');
    }
  };

  return (
    <section className={panel.section} aria-labelledby="profile-tab-heading">
      <h2 id="profile-tab-heading" className={panel.sectionTitle}>
        Профіль
      </h2>

      {(msg || err) && (
        <div
          className={err ? panel.serverError : panel.serverOk}
          role={err ? 'alert' : 'status'}
          aria-live="polite"
        >
          {err || msg}
        </div>
      )}

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Дані профілю</h3>
        <form onSubmit={saveProfile} noValidate>
          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="p-name">
              Ім’я
            </label>
            <input
              id="p-name"
              className={panel.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="p-email">
              Email
            </label>
            <input
              id="p-email"
              type="email"
              className={panel.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            className={panel.btnPrimary}
            disabled={saving}
            aria-busy={saving ? 'true' : undefined}
          >
            Зберегти
          </button>
        </form>
      </div>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Зміна пароля</h3>
        <form onSubmit={changePassword} noValidate>
          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="pwd-old">
              Поточний пароль
            </label>
            <div className={panel.controlRow}>
              <input
                id="pwd-old"
                type={show1 ? 'text' : 'password'}
                className={panel.input}
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={panel.toggleBtn}
                aria-pressed={show1}
                onClick={() => setShow1((v) => !v)}
              >
                {show1 ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="pwd-new">
              Новий пароль
            </label>
            <div className={panel.controlRow}>
              <input
                id="pwd-new"
                type={show2 ? 'text' : 'password'}
                className={panel.input}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={panel.toggleBtn}
                aria-pressed={show2}
                onClick={() => setShow2((v) => !v)}
              >
                {show2 ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="pwd-new2">
              Підтвердження
            </label>
            <div className={panel.controlRow}>
              <input
                id="pwd-new2"
                type={show3 ? 'text' : 'password'}
                className={panel.input}
                value={newPwd2}
                onChange={(e) => setNewPwd2(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={panel.toggleBtn}
                aria-pressed={show3}
                onClick={() => setShow3((v) => !v)}
              >
                {show3 ? 'Сховати' : 'Показати'}
              </button>
            </div>
          </div>

          <button className={panel.btnPrimary} type="submit">
            Змінити пароль
          </button>
        </form>
      </div>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Двоетапна перевірка (2FA)</h3>

        {(twoMsg || twoErr) && (
          <div
            className={twoErr ? panel.serverError : panel.serverOk}
            role={twoErr ? 'alert' : 'status'}
            aria-live="polite"
          >
            {twoErr || twoMsg}
          </div>
        )}

        {twoFAEnabled ? (
          <>
            <p className={panel.cardText}>2FA увімкнено для вашого облікового запису.</p>
            <button type="button" className={panel.btnPrimary} onClick={disable2FA}>
              Вимкнути 2FA
            </button>
          </>
        ) : (
          <>
            {twoFAStage === 'idle' && (
              <button type="button" className={panel.btnPrimary} onClick={start2FA}>
                Увімкнути 2FA
              </button>
            )}

            {twoFAStage === 'verify' && (
              <div className={panel.twofaBox}>
                {otpUri && (
                  <p className={panel.cardText}>
                    Додайте акаунт у застосунок-аутентифікатор, відсканувавши QR або введіть
                    секрет:
                    <br />
                    <code>{otpSecret || '—'}</code>
                  </p>
                )}

                <div className={panel.inputGroup}>
                  <label className={panel.inputLabel} htmlFor="otp">
                    Код з додатку
                  </label>
                  <input
                    id="otp"
                    ref={codeRef}
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    className={panel.input}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <button type="button" className={panel.btnPrimary} onClick={confirm2FA}>
                  Підтвердити 2FA
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default ProfileTab;