import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// Стили, специфичные для конкретно этой страницы/вкладки (списки заказов, статусы и т.д.)
import styles from '../ProfilePage.module.css';
// Общие стили для структуры вкладок
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const OrdersTab = () => {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (next = null) => {
    setLoading(true);
    setErr('');

    try {
      const url = new URL('/api/me/orders', window.location.origin);
      url.searchParams.set('limit', '10');
      if (next) url.searchParams.set('cursor', next);

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(await readError(res));

      const data = await res.json();
      setItems((prev) => (next ? [...prev, ...(data?.items || [])] : data?.items || []));
      setCursor(data?.nextCursor || null);
    } catch (e) {
      setErr(e.message || 'Не вдалося завантажити замовлення');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const repeatOrder = async (id) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}/repeat`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await readError(res));
    } catch {
      // навмисно мовчимо
    }
  };

  return (
    <section className={panel.section} aria-labelledby="orders-tab-heading">
      <h2 id="orders-tab-heading" className={panel.sectionTitle}>
        Замовлення
      </h2>

      {err && (
        <div className={panel.serverError} role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className={styles.skeletonMain} aria-hidden />
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Замовлень ще немає</div>
          <div className={styles.emptyText}>Переглянь каталог та додай перше замовлення.</div>
          <Link to="/catalog" className={panel.btnPrimary}>
            До каталогу
          </Link>
        </div>
      ) : (
        <>
          <ul className={styles.ordersList}>
            {items.map((o) => (
              <li key={o.id} className={styles.orderItem}>
                <div className={styles.orderHead}>
                  <strong>{o.id}</strong>
                  <span className={styles.orderDate}>{o.date || o.createdAt || ''}</span>
                </div>

                <div className={styles.orderFoot}>
                  <span className={styles.orderSum}>
                    {typeof o.total === 'number' ? `₴${o.total}` : o.total || ''}
                  </span>

                  {o.status && (
                    <span
                      className={`${styles.status} ${
                        o.status === 'delivered' ? styles.statusOk : styles.statusNeutral
                      }`}
                    >
                      {o.statusTitle || o.status}
                    </span>
                  )}

                  <Link to={`/orders/${o.id}`} className={styles.btnSmall}>
                    Деталі
                  </Link>

                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => repeatOrder(o.id)}
                  >
                    Повторити
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {cursor && (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={panel.btnPrimary}
                onClick={() => load(cursor)}
                disabled={loading}
                aria-busy={loading ? 'true' : undefined}
              >
                Показати ще
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default OrdersTab;