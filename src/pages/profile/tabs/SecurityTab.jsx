import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const SecurityTab = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const res = await fetch('/api/auth/sessions', { credentials: 'include' });
        if (!res.ok) throw new Error(await readError(res));
        const j = await res.json();
        setSessions(j?.items || []);
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logoutAll = async () => {
    try {
      const res = await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
    } catch {
      // навмисно мовчимо
    }
  };

  const exportData = () => {
    window.location.href = '/api/account/export';
  };

  const deleteData = async () => {
    if (!window.confirm('Видалити дані облікового запису без можливості відновлення?')) return;

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
    } catch {
      // навмисно мовчимо
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
            {sessions.length === 0 ? (
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
            <button type="button" className={panel.btnPrimary} onClick={logoutAll}>
              Вийти на всіх пристроях
            </button>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Експорт та видалення</h3>
            <div className={panel.actionsRow}>
              <button type="button" className={panel.btnPrimary} onClick={exportData}>
                Експортувати дані
              </button>
              <button type="button" className={panel.btnSmall} onClick={deleteData}>
                Видалити дані
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default SecurityTab;