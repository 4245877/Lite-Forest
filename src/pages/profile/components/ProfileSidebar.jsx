import React, { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Package,
  Printer,
  CreditCard,
  Truck,
  RotateCcw,
  Heart,
  Bell,
  LifeBuoy,
  Ticket,
  ShieldCheck,
  Store,
  LogOut,
} from 'lucide-react';
import styles from './ProfileSidebar.module.css';
import { LABELS, TABS } from '../profileTabs';

// Иконка для каждой вкладки — помогает быстро «считывать» навигацию
const TAB_ICONS = {
  overview: LayoutDashboard,
  profile: User,
  orders: Package,
  'custom-print': Printer,
  payments: CreditCard,
  shipping: Truck,
  returns: RotateCcw,
  favorites: Heart,
  notifications: Bell,
  support: LifeBuoy,
  coupons: Ticket,
  security: ShieldCheck,
};

const ProfileSidebar = ({ user, tab, setTab, onTabsKey, onLogout }) => {
  const displayName = user?.name || 'Користувач';
  const firstLetter = useMemo(
    () => displayName?.trim()?.[0]?.toUpperCase() || '🙂',
    [displayName]
  );

  const activeRef = useRef(null);

  // На мобильном — центрируем активную «таблетку» в горизонтальной ленте
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const el = activeRef.current;
    if (!el) return;
    if (!window.matchMedia('(max-width: 768px)').matches) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [tab]);

  return (
    <aside className={styles.sidebar} aria-label="Особистий кабінет">
      <div className={styles.userCard}>
        <div className={styles.avatar} aria-hidden>
          {firstLetter}
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userEmail}>{user?.email || '—'}</div>
        </div>
      </div>

      <nav
        className={styles.menu}
        aria-label="Панель навігації"
        role="tablist"
        onKeyDown={onTabsKey}
      >
        {TABS.map((key) => {
          const Icon = TAB_ICONS[key] || LayoutDashboard;
          const isActive = tab === key;

          return (
            <button
              key={key}
              ref={isActive ? activeRef : null}
              id={`tab-trigger-${key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-${key}`}
              onClick={() => setTab(key)}
              className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
            >
              <Icon className={styles.menuIcon} size={18} strokeWidth={2} aria-hidden />
              <span className={styles.menuLabel}>{LABELS[key]}</span>
            </button>
          );
        })}

        <Link to="/" className={styles.menuItemLink}>
          <Store className={styles.menuIcon} size={18} strokeWidth={2} aria-hidden />
          <span className={styles.menuLabel}>Повернутись до магазину</span>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className={`${styles.menuItem} ${styles.logout}`}
        >
          <LogOut className={styles.menuIcon} size={18} strokeWidth={2} aria-hidden />
          <span className={styles.menuLabel}>Вийти</span>
        </button>
      </nav>
    </aside>
  );
};

export default ProfileSidebar;
