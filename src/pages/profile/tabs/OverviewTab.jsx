import React from 'react';
import { Link } from 'react-router-dom';
import panel from '../components/ProfileTabPanel.module.css';

const OverviewTab = ({ user }) => {
  const firstName = (user?.name || '').split(' ')[0] || '—';

  return (
    <section className={panel.section} aria-labelledby="profile-overview-heading">
      <h2 id="profile-overview-heading" className={panel.sectionTitle}>
        Огляд
      </h2>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Профіль</h3>
        <p>
          <strong>Ім’я:</strong> {user?.name || '—'}
        </p>
        <p>
          <strong>Email:</strong> {user?.email || '—'}
        </p>
        <Link to="/profile#profile" className={panel.btnPrimary}>
          Редагувати профіль
        </Link>
      </div>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Швидкі дії</h3>
        <div className={panel.actionsRow}>
          <Link to="/profile#orders" className={panel.action}>
            Мої замовлення
          </Link>
          <Link to="/profile#favorites" className={panel.action}>
            Обране
          </Link>
          <Link to="/profile#payments" className={panel.action}>
            Оплата
          </Link>
        </div>
      </div>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Вітання</h3>
        <p className={panel.cardText}>Радий бачити, {firstName}. Продовжимо покупки?</p>
        <Link to="/catalog" className={panel.btnPrimary}>
          До каталогу
        </Link>
      </div>
    </section>
  );
};

export default OverviewTab;