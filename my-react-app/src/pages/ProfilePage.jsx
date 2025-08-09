import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './ProfilePage.module.css';

// Небольшие демонстрационные подкомпоненты — можно вынести в отдельные файлы позже
const Overview = ({ user }) => (
  <section className={styles.section} aria-label="Overview">
    <h2 className={styles.sectionTitle}>Обзор</h2>
    <div className={styles.card}>
      <h3>Профиль</h3>
      <p><strong>Имя:</strong> {user.name}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <Link to="/profile/edit" className={styles.linkBtn}>Редактировать профиль</Link>
    </div>
    <div className={styles.card}>
      <h3>Быстрые действия</h3>
      <div className={styles.actionsRow}>
        <Link to="/orders" className={styles.action}>Мои заказы</Link>
        <Link to="/favorites" className={styles.action}>Избранное</Link>
      </div>
    </div>
  </section>
);

const Orders = () => {
  // временные данные — заменить на реальные из API
  const demoOrders = [
    { id: 'ORD-1001', date: '2025-07-09', total: '₴1,200', status: 'Доставлен' },
    { id: 'ORD-1005', date: '2025-08-02', total: '₴450', status: 'В обработке' },
  ];

  return (
    <section className={styles.section} aria-label="Orders">
      <h2 className={styles.sectionTitle}>Заказы</h2>
      {demoOrders.length === 0 ? (
        <p>У вас пока нет заказов.</p>
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
                <Link to={`/orders/${o.id}`} className={styles.btnSmall}>Подробнее</Link>
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
      <p>Добавьте адрес для быстрой доставки.</p>
      <Link to="/profile/addresses" className={styles.linkBtn}>Управлять адресами</Link>
    </div>
  </section>
);

const ProfilePage = () => {
  const [tab, setTab] = useState('overview');

  // временный заглушечный пользователь — позже подключить useAuth / API
  const user = { name: 'Иван Иванов', email: 'ivan@example.com' };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Личный кабинет</h1>
        <div className={styles.smallNote}>Добро пожаловать, <strong>{user.name.split(' ')[0]}</strong></div>
      </div>

      <div className={styles.grid}>
        <aside className={styles.sidebar}>
          <div className={styles.userCard}>
            <div className={styles.avatar} aria-hidden> {user.name[0]}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>

          <nav className={styles.menu} aria-label="Панель навигации">
            <button onClick={() => setTab('overview')} className={`${styles.menuItem} ${tab === 'overview' ? styles.active : ''}`}>Обзор</button>
            <button onClick={() => setTab('orders')} className={`${styles.menuItem} ${tab === 'orders' ? styles.active : ''}`}>Заказы</button>
            <button onClick={() => setTab('addresses')} className={`${styles.menuItem} ${tab === 'addresses' ? styles.active : ''}`}>Адреса</button>
            <Link to="/favorites" className={styles.menuItemLink}>Избранное</Link>
            <Link to="/profile/settings" className={styles.menuItemLink}>Настройки</Link>
            <Link to="/" className={styles.menuItemLink}>Вернуться в магазин</Link>
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
  Подсказки:
  - Замените заглушки user / demoOrders на реальные данные из API (src/api/user.js)
  - Рассмотрите добавление защиты маршрута (PrivateRoute / useAuth hook)
*/
