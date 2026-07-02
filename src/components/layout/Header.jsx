// src/components/layout/Header.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';
import HeaderSearch from '../search/HeaderSearch';
import { useCart } from '../../contexts/CartContext.jsx';

const Header = () => {
  const location = useLocation();
  const isCatalog = location.pathname.startsWith('/catalog');

  const { totalQty } = useCart();
  const visibleCartQty = totalQty > 99 ? '99+' : totalQty;

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const toggleSearch = () => setIsSearchOpen(prev => !prev);
  const closeSearch = () => setIsSearchOpen(false);

  // Закрывать поиск при любом переходе
  useEffect(() => {
    setIsSearchOpen(false);
  }, [location.pathname]);

  // Блокировка прокрутки и класс для убирания "шва" при открытом поиске
  useEffect(() => {
    const needLock = isSearchOpen && !isCatalog;
    document.body.classList.toggle('no-scroll', needLock);
    document.body.classList.toggle('search-open', isSearchOpen); // <-- добавлено
    return () => {
      document.body.classList.remove('no-scroll');
      document.body.classList.remove('search-open'); // очистка
    };
  }, [isSearchOpen, isCatalog]);

  // Закрыть поиск по Escape
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape' && isSearchOpen) setIsSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchOpen]);

  // Если на каталоге — принудительно закрыть поиск из хедера
  useEffect(() => {
    if (isCatalog && isSearchOpen) setIsSearchOpen(false);
  }, [isCatalog, isSearchOpen]);

  // Кастомные события: open/close/toggle
  useEffect(() => {
    const onOpen = () => {
      if (!isCatalog) setIsSearchOpen(true);
      else window.dispatchEvent(new CustomEvent('lf:focusCatalogSearch'));
    };
    const onClose = () => setIsSearchOpen(false);
    const onToggle = () => {
      if (isCatalog) {
        window.dispatchEvent(new CustomEvent('lf:focusCatalogSearch'));
      } else {
        setIsSearchOpen(prev => !prev);
      }
    };

    window.addEventListener('lf:openSearch', onOpen);
    window.addEventListener('lf:closeSearch', onClose);
    window.addEventListener('lf:toggleSearch', onToggle);
    return () => {
      window.removeEventListener('lf:openSearch', onOpen);
      window.removeEventListener('lf:closeSearch', onClose);
      window.removeEventListener('lf:toggleSearch', onToggle);
    };
  }, [isCatalog]);

  return (
    <header className={`app-header ${isCatalog ? 'is-catalog' : ''}`}>
      <div className="header-container">
        {/* Логотип */}
        <Link to="/" className="logo" aria-label="Lite Forest — на головну">
          <div className="logo-icon">🌿</div>
          <span className="logo-text">
            Lite<span className="logo-accent">Forest</span>
          </span>
        </Link>

        {/* Основное меню */}
        <nav
          id="main-nav"
          className="main-nav"
          role="navigation"
          aria-label="Основне меню"
        >
          <Link to="/" className="nav-link">
            <span>Головна</span>
          </Link>
          <Link to="/catalog" className="nav-link">
            <span>Каталог</span>
          </Link>
          <Link to="/promotions" className="nav-link">
            <span>Акції</span>
          </Link>
          <Link to="/about" className="nav-link">
            <span>Про нас</span>
          </Link>
          <Link to="/contacts" className="nav-link">
            <span>Контакти</span>
          </Link>
        </nav>

        {/* Действия */}
        <div className="header-actions">
          <button
            className={`action-btn search-btn ${isSearchOpen ? 'active' : ''} ${isCatalog ? 'inert' : ''}`}
            aria-label="Пошук"
            onClick={isCatalog ? undefined : toggleSearch}
            aria-hidden={isCatalog || undefined}
            tabIndex={isCatalog ? -1 : undefined}
          >
            <svg
              className="icon-search"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21L16.65 16.65" />
            </svg>
          </button>

          <Link
            to="/cart"
            className="action-btn cart-btn"
            aria-label={totalQty > 0 ? `Кошик, товарів: ${totalQty}` : 'Кошик'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6" />
            </svg>

            {totalQty > 0 && (
              <span className="cart-count" aria-live="polite">
                {visibleCartQty}
              </span>
            )}
          </Link>

          <Link to="/login" className="action-btn profile-btn" aria-label="Особистий кабінет">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </div>

        {/* Слот для контролів каталогу (пошук/сортування/фільтри) на мобільному.
            Заповнюється з CatalogPage через portal, щоб звільнити місце під сітку. */}
        {isCatalog && <div className="header-catalog-slot" id="header-catalog-slot" />}
      </div>

      {/* Поиск: скрыт на каталоге */}
      {!isCatalog && (
        <div
          className={`header-search-wrap ${isSearchOpen ? 'open' : ''}`}
          role="dialog"
          aria-modal={isSearchOpen || undefined}
          aria-label="Пошук"
        >
          <div className="search-overlay" onClick={closeSearch} aria-hidden="true"></div>
          <div className="header-search-panel">
            <div className="header-search-card">
              {isSearchOpen && <HeaderSearch onClose={closeSearch} autoFocus />}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;