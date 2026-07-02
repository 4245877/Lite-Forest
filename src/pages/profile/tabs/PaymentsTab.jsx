import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const PaymentsTab = () => {
  const [cards, setCards] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const [r1, r2] = await Promise.all([
          fetch('/api/billing/cards', { credentials: 'include' }),
          fetch('/api/billing/invoices?limit=20', { credentials: 'include' }),
        ]);

        if (!r1.ok) throw new Error(await readError(r1));
        if (!r2.ok) throw new Error(await readError(r2));

        const j1 = await r1.json();
        const j2 = await r2.json();

        setCards(j1?.items || []);
        setInvoices(j2?.items || []);
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const removeCard = async (id) => {
    try {
      const res = await fetch(`/api/billing/cards/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
      setCards((x) => x.filter((c) => c.id !== id));
    } catch {
      // навмисно мовчимо
    }
  };

  return (
    <section className={panel.section} aria-labelledby="payments-tab-heading">
      <h2 id="payments-tab-heading" className={panel.sectionTitle}>
        Оплата
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
            <h3 className={panel.cardTitle}>Збережені картки</h3>
            {cards.length === 0 ? (
              <p className={panel.cardText}>Немає збережених карт.</p>
            ) : (
              <ul className={panel.list}>
                {cards.map((c) => (
                  <li key={c.id} className={panel.listItem}>
                    {c.brand || 'Card'} •••• {c.last4}{' '}
                    <span className={panel.smallNote}>{c.exp ? `до ${c.exp}` : ''}</span>
                    <button
                      type="button"
                      className={`${panel.btnSmall} ${panel.inlineActionBtn}`}
                      onClick={() => removeCard(c.id)}
                    >
                      Видалити
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/checkout/payment-methods" className={panel.btnPrimary}>
              Додати картку
            </Link>
          </div>

          <div className={panel.card}>
            <h3 className={panel.cardTitle}>Рахунки та чеки</h3>
            {invoices.length === 0 ? (
              <p className={panel.cardText}>Поки що немає документів.</p>
            ) : (
              <ul className={panel.list}>
                {invoices.map((i) => (
                  <li key={i.id} className={panel.listItem}>
                    {i.id} {i.date ? `від ${i.date}` : ''}{' '}
                    {typeof i.sum === 'number' ? `— ₴${i.sum}` : ''}
                    {i.url && (
                      <a
                        className={`${panel.btnSmall} ${panel.inlineActionBtn}`}
                        href={i.url}
                        download
                      >
                        Завантажити PDF
                      </a>
                    )}
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

export default PaymentsTab;