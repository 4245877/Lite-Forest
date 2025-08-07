import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

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

        {/* Основное меню - десктоп */}
        <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <Link to="/" className="nav-link">
            <span>Главная</span>
          </Link>
          <Link to="/catalog" className="nav-link">
            <span>Каталог</span>
          </Link>
          <Link to="/promotions" className="nav-link">
            <span>Акции</span>
          </Link>
          <Link to="/about" className="nav-link">
            <span>О нас</span>
          </Link>
          <Link to="/contacts" className="nav-link">
            <span>Контакты</span>
          </Link>
        </nav>

        {/* Иконки действий */}
        <div className="header-actions">
          <button className="action-btn search-btn" aria-label="Поиск">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
          
          <Link to="/cart" className="action-btn cart-btn" aria-label="Корзина">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-6"></path>
            </svg>
            <span className="cart-count">0</span>
          </Link>
          
       
          <Link to="/login" className="action-btn profile-btn" aria-label="Личный кабинет">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
          </svg>
          </Link>

          {/* Мобильное меню кнопка */}
          <button 
            className={`mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Меню"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Мобильное меню overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={toggleMobileMenu}></div>
      )}
    </header>
  );
};

export default Header;