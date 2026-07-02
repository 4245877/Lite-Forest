import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const mainCategories = [
  { slug: 'home', label: 'Будинок та інтерʼєр' },
  { slug: 'toys', label: 'Іграшки та ігри' },
  { slug: 'miniatures', label: 'Мініатюри' },
  { slug: 'electronics', label: 'Електроніка та гаджети' },
  { slug: 'tools', label: 'Інструменти та майстерня' },
  { slug: 'materials', label: 'Матеріали та витратні' },
];

const supportLinks = [
  { to: '/promotions', label: 'Акції' },
  { to: '/contacts', label: 'Контакти' },
  { to: '/faq', label: 'Питання та відповіді' },
  { to: '/delivery', label: 'Доставка' },
  { to: '/returns', label: 'Повернення' },
  { to: '/support', label: 'Служба підтримки' },
];

const legalLinks = [
  { to: '/legal#privacy', label: 'Політика конфіденційності' },
  { to: '/legal#terms', label: 'Угода користувача' },
  { to: '/legal#cookies', label: 'Cookies' },
];

const socialLinks = [
  {
    href: 'https://facebook.com',
    label: 'Facebook',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    href: 'https://instagram.com',
    label: 'Instagram',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162S8.597 18.163 12 18.163 18.162 15.404 18.162 12 15.403 5.838 12 5.838zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    href: 'https://t.me/Lite_Forest',
    label: 'Telegram',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    href: 'https://youtube.com',
    label: 'YouTube',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-column">
            <h3 className="footer-title">Про компанію</h3>
            <div className="footer-logo">
              <div className="footer-logo-icon">🌿</div>
              <span>Lite-Forest</span>
            </div>
            <p className="footer-mission">
              Каталог практичних виробів для дому, майстерні, хобі та організації простору.
              У частині виробів використовуємо філамент із переробленого пластику.
            </p>
            <Link to="/about" className="footer-link-accent">
              Дізнатися більше →
            </Link>
          </div>

          <div className="footer-column">
            <h3 className="footer-title">Категорії</h3>
            <ul className="footer-links">
              {mainCategories.map((category) => (
                <li key={category.slug}>
                  <Link to={`/catalog?cats=${encodeURIComponent(category.slug)}`}>{category.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-title">Підтримка</h3>
            <ul className="footer-links">
              {supportLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h3 className="footer-title">Ми в соцмережах</h3>
            <p className="footer-social-text">Слідкуйте за новинами, новинками та трендами.</p>

            <div className="social-links">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>

            <div className="newsletter-signup">
              <h4>Підписка на новини</h4>
              <div className="newsletter-form">
                <input
                  type="email"
                  placeholder="Ваш email"
                  className="newsletter-input"
                  aria-label="Email для підписки"
                />
                <button type="submit" className="newsletter-btn" aria-label="Підписатися">
                  →
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <p>&copy; {new Date().getFullYear()} Lite-Forest. Усі права захищені.</p>
          </div>

          <div className="footer-bottom-right">
            {legalLinks.map((link) => (
              <Link key={link.to} to={link.to} className="footer-bottom-link">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-decoration">
        <div className="eco-particle"></div>
        <div className="eco-particle"></div>
        <div className="eco-particle"></div>
      </div>
    </footer>
  );
};

export default Footer;