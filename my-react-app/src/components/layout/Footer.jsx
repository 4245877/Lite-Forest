import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        {/* Основное содержимое футера */}
        <div className="footer-content">
          
          {/* Колонка 1: О компании */}
          <div className="footer-column">
            <h3 className="footer-title">О компании</h3>
            <div className="footer-logo">
              <div className="footer-logo-icon">🌿</div>
              <span>Lite-Forest</span>
            </div>
            <p className="footer-mission">
              Мы создаём экологичное будущее через продвижение товаров из переработанных материалов и поддержку устойчивого потребления.
            </p>
            <Link to="/about" className="footer-link-accent">
              Узнать больше →
            </Link>
          </div>

          {/* Колонка 2: Категории */}
          <div className="footer-column">
            <h3 className="footer-title">Категории</h3>
            <ul className="footer-links">
              <li><Link to="/catalog/furniture">Мебель</Link></li>
              <li><Link to="/catalog/textiles">Текстиль</Link></li>
              <li><Link to="/catalog/accessories">Аксессуары</Link></li>
              <li><Link to="/catalog/decor">Декор</Link></li>
              <li><Link to="/catalog/packaging">Упаковка</Link></li>
              <li><Link to="/catalog/electronics">Электроника</Link></li>
            </ul>
          </div>

          {/* Колонка 3: Поддержка */}
          <div className="footer-column">
            <h3 className="footer-title">Поддержка</h3>
            <ul className="footer-links">
              <li><Link to="/contacts">Контакты</Link></li>
              <li><Link to="/faq">Вопросы и ответы</Link></li>
              <li><Link to="/delivery">Условия доставки</Link></li>
              <li><Link to="/returns">Возврат товара</Link></li>
              <li><Link to="/support">Служба поддержки</Link></li>
              <li><Link to="/help">Помощь покупателям</Link></li>
            </ul>
          </div>

          {/* Колонка 4: Социальные сети */}
          <div className="footer-column">
            <h3 className="footer-title">Мы в соцсетях</h3>
            <p className="footer-social-text">
              Следите за новостями и эко-трендами
            </p>
            <div className="social-links">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link"
                aria-label="Facebook"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link"
                aria-label="Instagram"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              
              <a 
                href="https://t.me/ecomarket" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link"
                aria-label="Telegram"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </a>
              
              <a 
                href="https://youtube.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-link"
                aria-label="YouTube"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
            
            {/* Подписка на рассылку */}
            <div className="newsletter-signup">
              <h4>Эко-новости</h4>
              <div className="newsletter-form">
                <input 
                  type="email" 
                  placeholder="Ваш email"
                  className="newsletter-input"
                />
                <button type="submit" className="newsletter-btn">
                  →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Нижняя часть футера */}
        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <p>&copy; {new Date().getFullYear()} LiteForest. Все права защищены.</p>
          </div>
          <div className="footer-bottom-right">
            <Link to="/privacy" className="footer-bottom-link">
              Политика конфиденциальности
            </Link>
            <Link to="/terms" className="footer-bottom-link">
              Пользовательское соглашение
            </Link>
            <Link to="/cookies" className="footer-bottom-link">
              Cookies
            </Link>
          </div>
        </div>
      </div>

      {/* Декоративные элементы */}
      <div className="footer-decoration">
        <div className="eco-particle"></div>
        <div className="eco-particle"></div>
        <div className="eco-particle"></div>
      </div>
    </footer>
  );
};

export default Footer;