import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const ShippingTab = () => {
  const [addresses, setAddresses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const [r1, r2, r3] = await Promise.all([
          fetch('/api/shipping/addresses', { credentials: 'include' }),
          fetch('/api/shipping/branches', { credentials: 'include' }),
          fetch('/api/shipping/recipients', { credentials: 'include' }),
        ]);

        if (!r1.ok) throw new Error(await readError(r1));
        if (!r2.ok) throw new Error(await readError(r2));
        if (!r3.ok) throw new Error(await readError(r3));

        setAddresses((await r1.json())?.items || []);
        setBranches((await r2.json())?.items || []);
        setRecipients((await r3.json())?.items || []);
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className={panel.section} aria-labelledby="shipping-tab-heading">
      <h2 id="shipping-tab-heading" className={panel.sectionTitle}>
        Доставка
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
            <h3 className={panel.cardTitle}>Адреси</h3>
            {addresses.length === 0 ? (
              <p className={panel.cardText}>Адреси не додані.</p>
            ) : (
              <ul className={panel.list}>
                {addresses.map((a) => (
                  <li key={a.id} className={panel.listItem}>
                    <strong>{a.label || 'Адреса'}:</strong> {a.line}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/profile/addresses" className={panel.btnPrimary}>
              Керувати адресами
            </Link>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Обрані відділення</h3>
            {branches.length === 0 ? (
              <p className={panel.cardText}>Відділення не додані.</p>
            ) : (
              <ul className={panel.list}>
                {branches.map((b) => (
                  <li key={b.id} className={panel.listItem}>
                    {b.city}, {b.branch}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/profile/branches" className={panel.btnPrimary}>
              Додати відділення
            </Link>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Отримувачі</h3>
            {recipients.length === 0 ? (
              <p className={panel.cardText}>Немає отримувачів.</p>
            ) : (
              <ul className={panel.list}>
                {recipients.map((r) => (
                  <li key={r.id} className={panel.listItem}>
                    {r.name} — {r.phone}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/profile/recipients" className={panel.btnPrimary}>
              Додати отримувача
            </Link>
          </div>
        </>
      )}
    </section>
  );
};

export default ShippingTab;