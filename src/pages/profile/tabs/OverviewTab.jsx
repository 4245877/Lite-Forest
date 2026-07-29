import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Heart, CreditCard, ChevronRight } from 'lucide-react';
import panel from '../components/ProfileTabPanel.module.css';

const QUICK_ACTIONS = [
  { to: '/profile#orders', label: 'Мої замовлення', Icon: Package },
  { to: '/profile#favorites', label: 'Обране', Icon: Heart },
  { to: '/profile#payments', label: 'Оплата', Icon: CreditCard },
];

const OverviewTab = ({ user }) => {
  const firstName = (user?.name || '').split(' ')[0] || '—';

  return (
    <section className={panel.section} aria-labelledby="profile-overview-heading">
      <h2 id="profile-overview-heading" className={panel.sectionTitle}>
        Огляд
      </h2>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Профіль</h3>
        <p className={panel.cardText}>
          <strong>Ім’я:</strong> {user?.name || '—'}
        </p>
        <p className={panel.cardText}>
          <strong>Email:</strong> {user?.email || '—'}
        </p>
        <Link to="/profile#profile" className={panel.btnPrimary}>
          Редагувати профіль
        </Link>
      </div>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Швидкі дії</h3>
        <div className={panel.actionsRow}>
          {QUICK_ACTIONS.map((action) => {
            const ActionIcon = action.Icon;

            return (
              <Link key={action.to} to={action.to} className={panel.action}>
                <span className={panel.actionIcon} aria-hidden="true">
                  <ActionIcon size={20} strokeWidth={2} />
                </span>
                <span className={panel.actionLabel}>{action.label}</span>
                <ChevronRight className={panel.actionArrow} size={18} aria-hidden="true" />
              </Link>
            );
          })}
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