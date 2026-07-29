import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const CouponsTab = () => {
  const [code, setCode] = useState('');
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const [rb, rh] = await Promise.all([
          fetch('/api/coupons/balance', { credentials: 'include' }),
          fetch('/api/coupons/history?limit=50', { credentials: 'include' }),
        ]);

        if (!rb.ok) throw new Error(await readError(rb));
        if (!rh.ok) throw new Error(await readError(rh));

        setBalance(await rb.json());
        const jh = await rh.json();
        setHistory(jh?.items || []);
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applyCode = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');

    try {
      const res = await fetch('/api/coupons/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) throw new Error(await readError(res));
      setMsg('Промокод застосовано');
      setCode('');
    } catch (e) {
      setErr(e.message || 'Не вдалося застосувати код');
    }
  };

  return (
    <section className={panel.section} aria-labelledby="coupons-tab-heading">
      <h2 id="coupons-tab-heading" className={panel.sectionTitle}>
        Купони та бали
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
            <h3 className={panel.cardTitle}>Баланс</h3>
            <p className={panel.cardText}>
              Бали: <strong>{balance?.points ?? 0}</strong>, Купони:{' '}
              <strong>{balance?.coupons ?? 0}</strong>
            </p>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Ввести промокод</h3>
            <form onSubmit={applyCode}>
              <div className={panel.controlRow}>
                <input
                  className={panel.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PROMO2025"
                />
                <button className={panel.btnPrimary} type="submit">
                  Застосувати
                </button>
              </div>
            </form>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Історія</h3>
            {history.length === 0 ? (
              <p className={panel.cardText}>Операцій ще не було.</p>
            ) : (
              <ul className={panel.list}>
                {history.map((h) => (
                  <li key={h.id} className={panel.listItem}>
                    {h.date}: {h.delta > 0 ? `+${h.delta}` : h.delta} — {h.comment}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default CouponsTab;