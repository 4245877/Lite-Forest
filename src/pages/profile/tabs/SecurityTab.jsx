import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const SecurityTab = () => {
  const [sessions, setSessions] = useState([]);
  // Бекенд не веде реєстр сесій (JWT — stateless), тому список недоступний і
  // повертає supported:false. Раніше порожній items малювався як «Сесій не
  // знайдено», що читалось як «ви більше ніде не залогінені» — це неправда.
  const [sessionsSupported, setSessionsSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [logoutAllMsg, setLogoutAllMsg] = useState('');
  const [logoutAllErr, setLogoutAllErr] = useState('');
  // Видалення акаунта: бекенд вимагає пароль для парольних акаунтів
  // (403 PASSWORD_REQUIRED). Показуємо поле лише після такої відповіді —
  // OAuth-акаунтам пароль вводити нема чого.
  const [deletePassword, setDeletePassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const res = await fetch('/api/auth/sessions', { credentials: 'include' });
        if (!res.ok) throw new Error(await readError(res));
        const j = await res.json();
        setSessions(j?.items || []);
        setSessionsSupported(j?.supported !== false);
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Раніше будь-яка помилка мовчки ковталась, і кнопка виглядала спрацьованою,
  // навіть коли сесії лишались дійсними. Тепер результат видно.
  const logoutAll = async () => {
    setLogoutAllMsg('');
    setLogoutAllErr('');

    try {
      const res = await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
      setLogoutAllMsg('Готово: усі інші сесії завершено.');
    } catch (e) {
      setLogoutAllErr(e.message || 'Не вдалося завершити сесії');
    }
  };

  const exportData = () => {
    window.location.href = '/api/account/export';
  };

  // Раніше запит йшов БЕЗ пароля і будь-яка помилка мовчки ковталася: для
  // парольного акаунта бекенд завжди відповідав 403, а користувач бачив
  // «успіх». Тепер: тіло з паролем, показ помилки і вихід після видалення.
  const deleteData = async () => {
    if (!window.confirm('Видалити дані облікового запису без можливості відновлення?')) return;

    setDeleteErr('');
    setDeleting(true);

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletePassword ? { password: deletePassword } : {}),
      });

      if (res.status === 403) {
        let code = '';
        try {
          code = (await res.clone().json())?.code || '';
        } catch {
          code = '';
        }

        if (code === 'PASSWORD_REQUIRED') {
          setNeedPassword(true);
          setDeletePassword('');
          setDeleteErr(
            deletePassword
              ? 'Невірний пароль. Спробуйте ще раз.'
              : 'Підтвердьте видалення паролем.',
          );
          return;
        }
      }

      if (!res.ok) throw new Error(await readError(res));

      // Акаунт видалено: сесія вже недійсна (бекенд зчистив куки), тому
      // відправляємо на головну повним перезавантаженням.
      setDeletePassword('');
      window.location.assign('/');
    } catch (e) {
      setDeleteErr(e.message || 'Не вдалося видалити дані');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className={panel.section} aria-labelledby="security-tab-heading">
      <h2 id="security-tab-heading" className={panel.sectionTitle}>
        Безпека
      </h2>

      {err && (
        <div className={panel.serverError} role="alert">
          {err}
        </div>
      )}

      {loading ? (
        <div className={panel.skeletonMain} aria-hidden />
      ) : (
        <>
          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Активні сесії</h3>
            {!sessionsSupported ? (
              <p className={panel.cardText}>
                Перелік активних сесій недоступний. Якщо є сумнів, що доступ до акаунта
                має хтось іще — завершіть усі сесії кнопкою нижче та змініть пароль.
              </p>
            ) : sessions.length === 0 ? (
              <p className={panel.cardText}>Сесій не знайдено.</p>
            ) : (
              <ul className={panel.list}>
                {sessions.map((s) => (
                  <li key={s.id} className={panel.listItem}>
                    {s.device || s.ua || 'Пристрій'} — {s.ip || '—'}{' '}
                    <span className={panel.smallNote}>
                      ост. активність: {s.last || s.lastSeen}
                    </span>{' '}
                    {s.current && <em>(поточна)</em>}
                  </li>
                ))}
              </ul>
            )}

            {logoutAllErr && (
              <div className={panel.fieldError} role="alert">
                {logoutAllErr}
              </div>
            )}
            {logoutAllMsg && (
              <div className={panel.serverOk} role="status">
                {logoutAllMsg}
              </div>
            )}

            <button type="button" className={panel.btnPrimary} onClick={logoutAll}>
              Вийти на всіх пристроях
            </button>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Експорт та видалення</h3>

            {needPassword && (
              <div className={panel.inputGroup}>
                <label className={panel.inputLabel} htmlFor="delete-account-password">
                  Пароль для підтвердження
                </label>
                <input
                  id="delete-account-password"
                  className={panel.input}
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              </div>
            )}

            {deleteErr && (
              <div className={panel.fieldError} role="alert">
                {deleteErr}
              </div>
            )}

            <div className={panel.actionsRow}>
              <button type="button" className={panel.btnPrimary} onClick={exportData}>
                Експортувати дані
              </button>
              <button
                type="button"
                className={panel.btnSmall}
                onClick={deleteData}
                disabled={deleting || (needPassword && !deletePassword)}
              >
                {deleting ? 'Видаляємо…' : 'Видалити дані'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default SecurityTab;