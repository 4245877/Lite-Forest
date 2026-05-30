import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth';
import { api } from '../../../api/client';
import styles from '../ProfilePage.module.css';
import panel from '../components/ProfileTabPanel.module.css';

const FavoritesTab = () => {
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (authLoading) return;

    if (!user) {
      setItems([]);
      setErr('');
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErr('');

      try {
        const data = await api.getFavorites();
        if (!cancelled) setItems(data?.items || []);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Не вдалося завантажити обране');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const remove = async (id) => {
    setErr('');
    try {
      await api.removeFavorite(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      setErr(e?.message || 'Не вдалося видалити товар з обраного');
    }
  };

  const setPref = async (id, patch) => {
    setErr('');
    try {
      await api.updateFavoritePrefs(id, patch);
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    } catch (e) {
      setErr(e?.message || 'Не вдалося зберегти налаштування');
    }
  };

  if (authLoading) {
    return (
      <section className={panel.section} aria-labelledby="favorites-tab-heading">
        <h2 id="favorites-tab-heading" className={panel.sectionTitle}>
          Обране
        </h2>
        <div className={panel.skeletonMain} aria-hidden />
      </section>
    );
  }

  if (!user) {
    return (
      <section className={panel.section} aria-labelledby="favorites-tab-heading">
        <h2 id="favorites-tab-heading" className={panel.sectionTitle}>
          Обране
        </h2>

        <div className={panel.card}>
          <h3 className={panel.cardTitle}>Потрібен вхід</h3>
          <p className={panel.cardText}>Увійди, щоб переглядати та зберігати обране.</p>
          <Link
            to="/login"
            state={{ from: { pathname: '/profile', hash: '#favorites' } }}
            className={panel.btnPrimary}
          >
            Увійти
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={panel.section} aria-labelledby="favorites-tab-heading">
      <h2 id="favorites-tab-heading" className={panel.sectionTitle}>
        Обране
      </h2>

      {err && (
        <div className={panel.serverError} role="alert" aria-live="polite">
          {err}
        </div>
      )}

      {loading ? (
        <div className={panel.skeletonMain} aria-hidden />
      ) : items.length === 0 ? (
        <div className={panel.empty}>
          <div className={panel.emptyTitle}>Список порожній</div>
          <Link to="/catalog" className={panel.btnPrimary}>
            До каталогу
          </Link>
        </div>
      ) : (
        <ul className={panel.list}>
          {items.map((i) => (
            <li key={i.id} className={`${panel.listItem} ${styles.favoriteItem}`}>
              <Link to={`/products/${i.id}`} className={styles.favoriteThumb}>
                <img
                  src={i.image_url || '/placeholder-product.png'}
                  alt={i.name || 'Товар'}
                  className={styles.favoriteThumbImg}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-product.png';
                  }}
                />
              </Link>

              <div className={styles.favoriteMeta}>
                <div className={styles.favoriteTitleRow}>
                  <Link to={`/products/${i.id}`} className={styles.inlineLink}>
                    {i.name}
                  </Link>
                  {typeof i.price === 'number' && <> — ₴{i.price}</>}
                </div>

                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={!!i.notifyStock}
                    onChange={(e) => setPref(i.id, { notifyStock: e.target.checked })}
                  />{' '}
                  Сповіщати про наявність
                </label>

                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={!!i.notifyPrice}
                    onChange={(e) => setPref(i.id, { notifyPrice: e.target.checked })}
                  />{' '}
                  Про зміну ціни
                </label>

                <button
                  type="button"
                  className={`${panel.btnSmall} ${styles.inlineActionBtn}`}
                  onClick={() => remove(i.id)}
                >
                  Видалити
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default FavoritesTab;