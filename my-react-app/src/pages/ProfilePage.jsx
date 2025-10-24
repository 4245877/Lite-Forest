// src/pages/ProfilePage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import styles from './ProfilePage.module.css';

const TABS = ['overview','orders','addresses'];
const getInitialTab = () => {
  if (typeof window === 'undefined') return 'overview';
  const h = window.location.hash?.slice(1);
  return TABS.includes(h) ? h : 'overview';
};

// Подкомпоненты
const Overview = ({ user }) => (
  <section className={styles.section} aria-labelledby="tab-overview-label">
    <h2 id="tab-overview-label" className={styles.sectionTitle}>Огляд</h2>
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Профіль</h3>
      <p><strong>Ім’я:</strong> {user?.name || '—'}</p>
      <p><strong>Email:</strong> {user?.email || '—'}</p>
      <Link to="/profile/edit" className={styles.btnPrimary}>Редагувати профіль</Link>
    </div>
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Швидкі дії</h3>
      <div className={styles.actionsRow}>
        <Link to="/orders" className={styles.action}>Мої замовлення</Link>
        <Link to="/favorites" className={styles.action}>Обране</Link>
      </div>
    </div>
  </section>
);

const Orders = () => {
  // демо-дані, замінити даними з API
  const demoOrders = [
    { id: 'ORD-1001', date: '2025-07-09', total: '₴1 200', status: 'Доставлено' },
    { id: 'ORD-1005', date: '2025-08-02', total: '₴450', status: 'В обробці' },
  ];
  const empty = demoOrders.length === 0;

  return (
    <section className={styles.section} aria-labelledby="tab-orders-label">
      <h2 id="tab-orders-label" className={styles.sectionTitle}>Замовлення</h2>
      {empty ? (
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>Замовлень ще немає</div>
          <div className={styles.emptyText}>Переглянь каталог та додай перше замовлення.</div>
          <Link to="/catalog" className={styles.btnPrimary}>До каталогу</Link>
        </div>
      ) : (
        <ul className={styles.ordersList}>
          {demoOrders.map(o => (
            <li key={o.id} className={styles.orderItem}>
              <div className={styles.orderHead}>
                <strong>{o.id}</strong>
                <span className={styles.orderDate}>{o.date}</span>
              </div>
              <div className={styles.orderFoot}>
                <span className={styles.orderSum}>{o.total}</span>
                <span className={`${styles.status} ${styles.statusNeutral}`}>{o.status}</span>
                <Link to={`/orders/${o.id}`} className={styles.btnSmall}>Докладніше</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Addresses = () => (
  <section className={styles.section} aria-labelledby="tab-addresses-label">
    <h2 id="tab-addresses-label" className={styles.sectionTitle}>Адреси доставки</h2>
    <div className={styles.card}>
      <p className={styles.cardText}>Додай адресу, щоб оформлювати швидше.</p>
      <Link to="/profile/addresses" className={styles.btnPrimary}>Керувати адресами</Link>
    </div>
  </section>
);

const ProfilePage = () => {
  const [tab, setTab] = useState(getInitialTab);
  const { user, loading, signout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, [tab]);

  const displayName = user?.name || 'Користувач';
  const firstLetter = useMemo(
    () => displayName?.trim()?.[0]?.toUpperCase() || '🙂',
    [displayName]
  );

  const handleLogout = async () => {
    await signout();
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Особистий кабінет</h1>
          <div className={styles.smallNote}>Завантаження…</div>
        </div>
        <div className={styles.skeletonGrid}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonMain} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Особистий кабінет</h1>
          <div className={styles.smallNote}>
            Ви не авторизовані. <Link to="/login" className={styles.linkInline}>Увійти</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Особистий кабінет</h1>
        <div className={styles.smallNote}>
          Ласкаво просимо, <strong>{displayName.split(' ')[0]}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <aside className={styles.sidebar} aria-labelledby="account-nav-label">
          <div className={styles.userCard}>
            <div className={styles.avatar} aria-hidden>{firstLetter}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>

          <nav
            className={styles.menu}
            aria-label="Панель навігації"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'overview'}
              aria-controls="tab-overview"
              onClick={() => setTab('overview')}
              className={`${styles.menuItem} ${tab === 'overview' ? styles.active : ''}`}
            >
              Огляд
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'orders'}
              aria-controls="tab-orders"
              onClick={() => setTab('orders')}
              className={`${styles.menuItem} ${tab === 'orders' ? styles.active : ''}`}
            >
              Замовлення
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'addresses'}
              aria-controls="tab-addresses"
              onClick={() => setTab('addresses')}
              className={`${styles.menuItem} ${tab === 'addresses' ? styles.active : ''}`}
            >
              Адреси
            </button>

            <Link to="/favorites" className={styles.menuItemLink}>Обране</Link>
            <Link to="/profile/settings" className={styles.menuItemLink}>Налаштування</Link>
            <Link to="/" className={styles.menuItemLink}>Повернутись до магазину</Link>

            <button type="button" onClick={handleLogout} className={`${styles.menuItem} ${styles.logout}`}>
              Вийти
            </button>
          </nav>
        </aside>

        <main className={styles.main}>
          <div
            id="tab-overview"
            role="tabpanel"
            hidden={tab !== 'overview'}
            aria-labelledby="tab-overview-label"
          >
            <Overview user={user} />
          </div>
          <div
            id="tab-orders"
            role="tabpanel"
            hidden={tab !== 'orders'}
            aria-labelledby="tab-orders-label"
          >
            <Orders />
          </div>
          <div
            id="tab-addresses"
            role="tabpanel"
            hidden={tab !== 'addresses'}
            aria-labelledby="tab-addresses-label"
          >
            <Addresses />
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
