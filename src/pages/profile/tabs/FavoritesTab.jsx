import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth';
import { api } from '../../../api/client';
import styles from './FavoritesTab.module.css';
import panel from '../components/ProfileTabPanel.module.css';

const PLACEHOLDER_PRODUCT_IMAGE = '/placeholder-product.png';

const FavoritesTab = () => {
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [removingId, setRemovingId] = useState(null);

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

        if (!cancelled) {
          setItems(Array.isArray(data?.items) ? data.items : []);
        }
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
    if (removingId === id) return;

    setErr('');
    setRemovingId(id);

    try {
      await api.removeFavorite(id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (e) {
      setErr(e?.message || 'Не вдалося видалити товар з обраного');
    } finally {
      setRemovingId(null);
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
      <section
        className={`${panel.section} ${styles.favoritesTab}`}
        aria-labelledby="favorites-tab-heading"
      >
        <h2 id="favorites-tab-heading" className={panel.sectionTitle}>
          Обране
        </h2>
        <div className={panel.skeletonMain} aria-hidden />
      </section>
    );
  }

  if (!user) {
    return (
      <section
        className={`${panel.section} ${styles.favoritesTab}`}
        aria-labelledby="favorites-tab-heading"
      >
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
    <section
      className={`${panel.section} ${styles.favoritesTab}`}
      aria-labelledby="favorites-tab-heading"
    >
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
          {items.map((item) => {
            const productId = item.product_id || item.productId || item.id;
            const productName = item.name || 'Товар';
            const imageUrl = item.image_url || item.imageUrl || PLACEHOLDER_PRODUCT_IMAGE;

            return (
              <li key={item.id} className={`${panel.listItem} ${styles.favoriteItem}`}>
                <Link to={`/products/${productId}`} className={styles.favoriteThumb}>
                  <img
                    src={imageUrl}
                    alt={productName}
                    className={styles.favoriteThumbImg}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = PLACEHOLDER_PRODUCT_IMAGE;
                    }}
                  />
                </Link>

                <div className={styles.favoriteMeta}>
                  <div className={styles.favoriteTitleRow}>
                    <Link to={`/products/${productId}`} className={styles.inlineLink}>
                      {productName}
                    </Link>

                    {typeof item.price === 'number' && (
                      <span className={styles.favoritePrice}>
                        — ₴{item.price.toLocaleString('uk-UA')}
                      </span>
                    )}
                  </div>

                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={!!item.notifyStock}
                      onChange={(e) => setPref(item.id, { notifyStock: e.target.checked })}
                    />{' '}
                    Сповіщати про наявність
                  </label>

                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={!!item.notifyPrice}
                      onChange={(e) => setPref(item.id, { notifyPrice: e.target.checked })}
                    />{' '}
                    Про зміну ціни
                  </label>

                  <button
                    type="button"
                    className={`${panel.btnSmall} ${styles.inlineActionBtn}`}
                    onClick={() => remove(item.id)}
                    disabled={removingId === item.id}
                    aria-label={`Видалити з обраного: ${productName}`}
                  >
                    {removingId === item.id ? 'Видалення...' : 'Видалити'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default FavoritesTab;