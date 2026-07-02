import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const NotificationsTab = () => {
  const [channels, setChannels] = useState(null);
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const res = await fetch('/api/notifications/prefs', { credentials: 'include' });
        if (!res.ok) throw new Error(await readError(res));
        const j = await res.json();
        setChannels(j?.channels || { email: true });
        setEvents(j?.events || {});
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setMsg('');
    setErr('');

    try {
      const res = await fetch('/api/notifications/prefs', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels, events }),
      });

      if (!res.ok) throw new Error(await readError(res));
      setMsg('Налаштування збережено');
    } catch (e) {
      setErr(e.message || 'Не вдалося зберегти');
    }
  };

  return (
    <section className={panel.section} aria-labelledby="notifications-tab-heading">
      <h2 id="notifications-tab-heading" className={panel.sectionTitle}>
        Сповіщення
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

      {loading ? (
        <div className={panel.skeletonMain} aria-hidden />
      ) : (
        <>
          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Канали</h3>

            <label className={panel.checkRow}>
              <input
                type="checkbox"
                checked={!!channels?.email}
                onChange={(e) => setChannels((v) => ({ ...v, email: e.target.checked }))}
              />{' '}
              Email
            </label>

            <label className={panel.checkRow}>
              <input
                type="checkbox"
                checked={!!channels?.telegram}
                onChange={(e) => setChannels((v) => ({ ...v, telegram: e.target.checked }))}
              />{' '}
              Telegram
            </label>

            <label className={panel.checkRow}>
              <input
                type="checkbox"
                checked={!!channels?.viber}
                onChange={(e) => setChannels((v) => ({ ...v, viber: e.target.checked }))}
              />{' '}
              Viber
            </label>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Події</h3>

            {Object.keys(events || {}).length === 0 ? (
              <p className={panel.cardText}>Події не налаштовані.</p>
            ) : (
              Object.entries(events).map(([k, v]) => (
                <label key={k} className={panel.checkRow}>
                  <input
                    type="checkbox"
                    checked={v}
                    onChange={(e) => setEvents((s) => ({ ...s, [k]: e.target.checked }))}
                  />{' '}
                  {k}
                </label>
              ))
            )}

            <button className={`${panel.btnPrimary} ${panel.mtSm}`} type="button" onClick={save}>
              Зберегти
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default NotificationsTab;