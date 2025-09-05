import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const firstNavLinkRef = useRef(null);

  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  // Блокировка прокрутки и фокус при открытии
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('no-scroll');
      setTimeout(() => firstNavLinkRef.current?.focus(), 120);
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [isMobileMenuOpen]);

  // Закрыть мобильное меню при переходе на десктоп
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 769px)');
    const onChange = e => { if (e.matches) setIsMobileMenuOpen(false); };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  // Закрыть меню по Escape
  useEffect(() => {
    const onKeyDown = e => { if (e.key === 'Escape' && isMobileMenuOpen) setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  const handleNavLinkClick = () => { if (isMobileMenuOpen) setIsMobileMenuOpen(false); };

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Логотип */}
        <Link to="/" className="logo">
          <div className="logo-icon">🌿</div>
          <span className="logo-text">
            Lite<span className="logo-accent">Forest</span>
          </span>
        </Link>

        {/* Основное меню */}
        <nav
          id="main-nav"
          className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}
          role="navigation"
          aria-label="Основное меню"
        >
          <Link to="/" className="nav-link" onClick={handleNavLinkClick} ref={firstNavLinkRef}>
            <span>Головна</span>
          </Link>
          <Link to="/catalog" className="nav-link" onClick={handleNavLinkClick}>
            <span>Каталог</span>
          </Link>
          <Link to="/promotions" className="nav-link" onClick={handleNavLinkClick}>
            <span>Акції</span>
          </Link>
          <Link to="/about" className="nav-link" onClick={handleNavLinkClick}>
            <span>Про нас</span>
          </Link>
          <Link to="/contacts" className="nav-link" onClick={handleNavLinkClick}>
            <span>Контакти</span>
          </Link>
        </nav>

        {/* Действия */}
        <div className="header-actions">
          <button className="action-btn search-btn" aria-label="Поиск">
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

          <Link to="/cart" className="action-btn cart-btn" aria-label="Корзина">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6" />
            </svg>
            <span className="cart-count">0</span>
          </Link>

          <Link to="/login" className="action-btn profile-btn" aria-label="Личный кабинет">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>

          {/* Мобильное меню кнопка */}
          <button
            className={`mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Меню"
            aria-expanded={isMobileMenuOpen}
            aria-controls="main-nav"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Мобильное меню overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={toggleMobileMenu} aria-hidden="true"></div>
      )}
    </header>
  );
};

export default Header;
