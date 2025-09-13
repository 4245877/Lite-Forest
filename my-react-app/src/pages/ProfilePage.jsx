// src/pages/ProfilePage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import styles from './ProfilePage.module.css';

// Небольшие демонстрационные подкомпоненты — можно вынести в отдельные файлы позже
const Overview = ({ user }) => (
  <section className={styles.section} aria-label="Overview">
    <h2 className={styles.sectionTitle}>Огляд</h2>
    <div className={styles.card}>
      <h3>Профіль</h3>
      <p><strong>Ім'я:</strong> {user?.name}</p>
      <p><strong>Email:</strong> {user?.email}</p>
      <Link to="/profile/edit" className={styles.linkBtn}>Редагувати профіль</Link>
    </div>
    <div className={styles.card}>
      <h3>Швидкі дії</h3>
      <div className={styles.actionsRow}>
        <Link to="/orders" className={styles.action}>Мої замовлення</Link>
        <Link to="/favorites" className={styles.action}>Обране</Link>
      </div>
    </div>
  </section>
);

const Orders = () => {
  // тимчасові дані — замінити на реальні з API
  const demoOrders = [
    { id: 'ORD-1001', date: '2025-07-09', total: '₴1,200', status: 'Доставлен' },
    { id: 'ORD-1005', date: '2025-08-02', total: '₴450', status: 'В обработке' },
  ];

  return (
    <section className={styles.section} aria-label="Orders">
      <h2 className={styles.sectionTitle}>Замовлення</h2>
      {demoOrders.length === 0 ? (
        <p>У вас поки що немає замовлень.</p>
      ) : (
        <ul className={styles.ordersList}>
          {demoOrders.map(o => (
            <li key={o.id} className={styles.orderItem}>
              <div className={styles.orderHead}>
                <strong>{o.id}</strong>
                <span>{o.date}</span>
              </div>
              <div className={styles.orderFoot}>
                <span>{o.total}</span>
                <span className={styles.status}>{o.status}</span>
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
  <section className={styles.section} aria-label="Addresses">
    <h2 className={styles.sectionTitle}>Адреса доставки</h2>
    <div className={styles.card}>
      <p>Додати адресу для швидкої доставки.</p>
      <Link to="/profile/addresses" className={styles.linkBtn}>Керувати адресами</Link>
    </div>
  </section>
);

const ProfilePage = () => {
  const [tab, setTab] = useState('overview');
  const { user, loading, signout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || 'Користувач';
  const firstLetter = displayName?.trim()?.[0]?.toUpperCase() || '🙂';

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
      </div>
    );
  }

  // Доп. захист: якщо з якоїсь причини user відсутній (неповна сесія)
  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Особистий кабінет</h1>
          <div className={styles.smallNote}>
            Ви не авторизовані. <Link to="/login" className={styles.linkBtn}>Увійти</Link>
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
        <aside className={styles.sidebar}>
          <div className={styles.userCard}>
            <div className={styles.avatar} aria-hidden>{firstLetter}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>

          <nav className={styles.menu} aria-label="Панель навігації">
            <button
              onClick={() => setTab('overview')}
              className={`${styles.menuItem} ${tab === 'overview' ? styles.active : ''}`}
            >
              Обзор
            </button>
            <button
              onClick={() => setTab('orders')}
              className={`${styles.menuItem} ${tab === 'orders' ? styles.active : ''}`}
            >
              Заказы
            </button>
            <button
              onClick={() => setTab('addresses')}
              className={`${styles.menuItem} ${tab === 'addresses' ? styles.active : ''}`}
            >
              Адреси
            </button>

            <Link to="/favorites" className={styles.menuItemLink}>Обране</Link>
            <Link to="/profile/settings" className={styles.menuItemLink}>Налаштування</Link>
            <Link to="/" className={styles.menuItemLink}>Повернутись до магазину</Link>

            <button onClick={handleLogout} className={styles.menuItem}>
              Вийти
            </button>
          </nav>
        </aside>

        <main className={styles.main}>
          {tab === 'overview' && <Overview user={user} />}
          {tab === 'orders' && <Orders />}
          {tab === 'addresses' && <Addresses />}
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;

/*
  Підказки:
  - user приходить із useAuth() (див. src/auth), який звертається до /api/auth/me.
  - Замініть demoOrders на реальні замовлення з вашого API.
*/
