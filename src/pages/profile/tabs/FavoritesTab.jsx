import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../auth';
import { api } from '../../../api/client';
import styles from './FavoritesTab.module.css';
import panel from '../components/ProfileTabPanel.module.css';

const PLACEHOLDER_PRODUCT_IMAGE = '/placeholder-product.png';

const formatPrice = (value) => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return `${num.toLocaleString('uk-UA')} ₴`;
};

const FavoritesHeading = ({ count }) => (
  <h2 id="favorites-tab-heading" className={panel.sectionTitle}>
    Обране
    {count > 0 && (
      <span className={styles.favCount} aria-label={`${count} товарів`}>
        {count}
      </span>
    )}
  </h2>
);

const FavoritesSkeleton = () => (
  <div className={styles.skeletonList} aria-hidden>
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
    <div className={styles.skeletonRow} />
  </div>
);

const FavoritesTab = () => {
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

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
    if (savingId === id) return;

    setErr('');
    setSavingId(id);

    // Оптимістичне оновлення з відкатом у разі помилки.
    const snapshot = items;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );

    try {
      await api.updateFavoritePrefs(id, patch);
    } catch (e) {
      setItems(snapshot);
      setErr(e?.message || 'Не вдалося зберегти налаштування');
    } finally {
      setSavingId(null);
    }
  };

  if (authLoading) {
    return (
      <section
        className={`${panel.section} ${styles.favoritesTab}`}
        aria-labelledby="favorites-tab-heading"
        aria-busy="true"
      >
        <FavoritesHeading count={0} />
        <FavoritesSkeleton />
      </section>
    );
  }

  if (!user) {
    return (
      <section
        className={`${panel.section} ${styles.favoritesTab}`}
        aria-labelledby="favorites-tab-heading"
      >
        <FavoritesHeading count={0} />

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
      aria-busy={loading ? 'true' : undefined}
    >
      <FavoritesHeading count={loading ? 0 : items.length} />

      {err && (
        <div className={panel.serverError} role="alert" aria-live="polite">
          {err}
        </div>
      )}

      {loading ? (
        <FavoritesSkeleton />
      ) : items.length === 0 ? (
        <div className={panel.empty}>
          <div className={panel.emptyTitle}>Список порожній</div>
          <p className={panel.emptyText}>
            Додавай товари до обраного, щоб стежити за наявністю та зміною ціни.
          </p>
          <Link to="/catalog" className={panel.btnPrimary}>
            До каталогу
          </Link>
        </div>
      ) : (
        <ul className={styles.favList}>
          {items.map((item) => {
            const productId = item.product_id || item.productId || item.id;
            const productName = item.name || 'Товар';
            const imageUrl = item.image_url || item.imageUrl || PLACEHOLDER_PRODUCT_IMAGE;
            const price = formatPrice(item.price ?? item.price_uah ?? item.amount);
            const itemSaving = savingId === item.id;

            return (
              <li key={item.id} className={styles.favoriteItem}>
                <Link
                  to={`/products/${productId}`}
                  className={styles.favoriteThumb}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <img
                    src={imageUrl}
                    alt=""
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
                    <Link to={`/products/${productId}`} className={styles.favoriteName}>
                      {productName}
                    </Link>

                    {price && <span className={styles.favoritePrice}>{price}</span>}
                  </div>

                  <fieldset className={styles.notifyGroup} disabled={itemSaving}>
                    <legend className={styles.notifyLegend}>Сповіщення</legend>

                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={!!item.notifyStock}
                        onChange={(e) => setPref(item.id, { notifyStock: e.target.checked })}
                      />
                      <span>Сповіщати про наявність</span>
                    </label>

                    <label className={styles.checkLabel}>
                      <input
                        type="checkbox"
                        checked={!!item.notifyPrice}
                        onChange={(e) => setPref(item.id, { notifyPrice: e.target.checked })}
                      />
                      <span>Сповіщати про зміну ціни</span>
                    </label>
                  </fieldset>
                </div>

                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => remove(item.id)}
                  disabled={removingId === item.id}
                  aria-busy={removingId === item.id ? 'true' : undefined}
                  aria-label={`Видалити з обраного: ${productName}`}
                  title="Видалити з обраного"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default FavoritesTab;
