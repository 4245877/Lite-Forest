import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './ProfileSidebar.module.css'; // <-- Импорт заменен на локальный
import { LABELS, TABS } from '../profileTabs';

const ProfileSidebar = ({ user, tab, setTab, onTabsKey, onLogout }) => {
  const displayName = user?.name || 'Користувач';
  const firstLetter = useMemo(
    () => displayName?.trim()?.[0]?.toUpperCase() || '🙂',
    [displayName]
  );

  return (
    <aside className={styles.sidebar} aria-labelledby="account-nav-label">
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
        {TABS.map((key) => (
          <button
            key={key}
            id={`tab-trigger-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`tab-${key}`}
            onClick={() => setTab(key)}
            className={`${styles.menuItem} ${tab === key ? styles.active : ''}`}
          >
            {LABELS[key]}
          </button>
        ))}

        <Link to="/" className={styles.menuItemLink}>
          Повернутись до магазину
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className={`${styles.menuItem} ${styles.logout}`}
        >
          Вийти
        </button>
      </nav>
    </aside>
  );
};

export default ProfileSidebar;