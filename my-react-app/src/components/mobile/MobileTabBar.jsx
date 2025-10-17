import React, { useCallback } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext.jsx';
import './mobile-tabbar.css';

function Icon({ children }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="mtb-icon">{children}</svg>;
}

export default function MobileTabBar() {
  const { items = [] } = useCart?.() || {};
  const cartCount = Array.isArray(items) ? items.reduce((s, i) => s + (i.qty || 1), 0) : 0;
  const { pathname } = useLocation();

  const openSearch = useCallback((e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('lf:openSearch'));
  }, []);

  // где не показываем таббар (пример)
  const hideOn = /^\/admin\//.test(pathname);
  if (hideOn) return null;

  return (
    <nav className="mobile-tabbar" role="navigation" aria-label="Нижняя навигация">
      {/* 1. Головна */}
      <NavLink to="/" end className="mtb-link">
        {({ isActive }) => (
          <>
            <Icon><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></Icon>
            <span className={`mtb-label${isActive ? ' active' : ''}`}>Головна</span>
          </>
        )}
      </NavLink>

      {/* 2. Пошук */}
      <Link to="/search" className="mtb-link" onClick={openSearch} aria-label="Пошук">
        <Icon>
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </Icon>
        <span className="mtb-label">Пошук</span>
      </Link>

      {/* 3. Кошик */}
      <NavLink to="/cart" className="mtb-link mtb-cart">
        {({ isActive }) => (
          <>
            <Icon>
              <path d="M3 4h2l2.5 12h11l2-8H7.5" />
              <circle cx="10" cy="20" r="1.5" />
              <circle cx="17" cy="20" r="1.5" />
            </Icon>
            {cartCount > 0 && <span className="mtb-badge" aria-label={`В корзине ${cartCount}`}>{cartCount}</span>}
            <span className={`mtb-label${isActive ? ' active' : ''}`}>Кошик</span>
          </>
        )}
      </NavLink>

      {/* 4. Каталог (подумал за тебя) */}
      <NavLink to="/catalog" className="mtb-link">
        {({ isActive }) => (
          <>
            <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>
            <span className={`mtb-label${isActive ? ' active' : ''}`}>Каталог</span>
          </>
        )}
      </NavLink>

      {/* 5. Аккаунт */}
      <NavLink to="/login" className="mtb-link">
        {({ isActive }) => (
          <>
            <Icon>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </Icon>
            <span className={`mtb-label${isActive ? ' active' : ''}`}>Аккаунт</span>
          </>
        )}
      </NavLink>
    </nav>
  );
}
