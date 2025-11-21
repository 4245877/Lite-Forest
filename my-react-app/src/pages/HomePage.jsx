// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

// Данные вынесены за пределы компонента (статичный контент)
const newProducts = [
  {
    id: 1,
    name: 'Еко-пляшка з бамбука',
    price: '1 290 ₴',
    image: '🌿',
    ecoScore: 95
  },
  {
    id: 2,
    name: 'Органічна косметичка',
    price: '2 150 ₴',
    image: '🌱',
    ecoScore: 92
  },
  {
    id: 3,
    name: 'Набір еко-посуду',
    price: '3 450 ₴',
    image: '🍃',
    ecoScore: 98
  },
  {
    id: 4,
    name: 'Органічне мило',
    price: '450 ₴',
    image: '🌾',
    ecoScore: 89
  },
  {
    id: 5,
    name: 'Лляна сумка-шопер',
    price: '890 ₴',
    image: '🌿',
    ecoScore: 94
  }
];

const categories = [
  {
    id: 1,
    name: 'Еко-пакування',
    slogan: 'Збережемо природу разом',
    icon: '📦',
    bgColor: 'var(--color-sand)' // Використовуємо змінні global.css
  },
  {
    id: 2,
    name: 'Сад та дача',
    slogan: 'Вирощуй екологічно',
    icon: '🌱',
    bgColor: '#f7fee7'
  },
  {
    id: 3,
    name: 'Домашній затишок',
    slogan: 'Комфорт без шкоди',
    icon: '🏠',
    bgColor: 'var(--color-cream)'
  },
  {
    id: 4,
    name: 'Краса та здоров\'я',
    slogan: 'Натуральна краса',
    icon: '💚',
    bgColor: '#f0f9ff'
  }
];

const benefits = [
  {
    icon: '♻️',
    title: '100% еко-матеріали',
    description: 'Лише сертифіковані екологічні товари'
  },
  {
    icon: '🤝',
    title: 'Підтримка локальних виробників',
    description: 'Розвиваємо місцеву еко-економіку'
  },
  {
    icon: '🚚',
    title: 'Швидка доставка',
    description: 'Доставка в еко-пакуванні за 1-2 дні'
  },
  {
    icon: '✅',
    title: 'Гарантія якості',
    description: '30 днів на повернення, пожиттєва підтримка'
  }
];

const HomePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState('');

  // Автопрокрутка слайдера
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % newProducts.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleSlideChange = (direction) => {
    if (direction === 'next') {
      setCurrentSlide((prev) => (prev + 1) % newProducts.length);
    } else {
      setCurrentSlide((prev) => (prev - 1 + newProducts.length) % newProducts.length);
    }
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (email) {
      alert('Дякуємо за підписку на еко-новини!');
      setEmail('');
    }
  };

  return (
    <div className={styles.homePage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>🌿 Екологічні покупки</span>
            <h1 className={styles.heroTitle}>
              Ласкаво просимо в <span className={styles.titleAccent}>Lite Forest</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Купуй екологічно — живи краще. Відкрийте для себе світ сталих товарів, створених з турботою про країну і майбутні покоління.
            </p>
            <div className={styles.heroActions}>
              <Link to="/catalog" className={styles.ctaButton}>
                <span>Перейти до каталогу</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
              <Link to="/about" className={styles.secondaryButton}>
                Дізнатися більше
              </Link>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroIcon}>🌍</div>
            <div className={styles.floatingElements}>
              <div className={styles.floatingElement}>🌿</div>
              <div className={styles.floatingElement}>♻️</div>
              <div className={styles.floatingElement}>🌱</div>
            </div>
          </div>
        </div>
        <div className={styles.heroDecoration}></div>
      </section>

      {/* Popular Categories */}
      <section className={styles.categories}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Популярні категорії</h2>
            <p className={styles.sectionSubtitle}>
              Обирайте з наших найпопулярніших еко-категорій
            </p>
          </div>
          <div className={styles.categoriesGrid}>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/catalog/${encodeURIComponent(category.name.toLowerCase())}`}
                className={styles.categoryCard}
                style={{ backgroundColor: category.bgColor }}
              >
                <div className={styles.categoryIcon}>{category.icon}</div>
                <h3 className={styles.categoryName}>{category.name}</h3>
                <p className={styles.categorySlogan}>{category.slogan}</p>
                <div className={styles.categoryArrow}>→</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* New Products Slider */}
      <section className={styles.newProducts}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Новинки</h2>
            <p className={styles.sectionSubtitle}>
              Свіжі надходження еко-товарів від наших партнерів
            </p>
          </div>
          <div className={styles.slider}>
            <button
              className={`${styles.sliderBtn} ${styles.sliderBtnPrev}`}
              onClick={() => handleSlideChange('prev')}
              aria-label="Попередній товар"
            >
              ←
            </button>
            <div className={styles.sliderContainer}>
              <div 
                className={styles.sliderTrack}
                style={{ 
                  transform: `translateX(-${currentSlide * 280}px)`,
                  '--current-slide': currentSlide 
                }}
              >
                {newProducts.map((product) => (
                  <div key={product.id} className={styles.productCard}>
                    <div className={styles.productImage}>
                      <span className={styles.productEmoji}>{product.image}</span>
                      <div className={styles.ecoScore}>
                        <span>♻️ {product.ecoScore}%</span>
                      </div>
                    </div>
                    <div className={styles.productInfo}>
                      <h4 className={styles.productName}>{product.name}</h4>
                      <div className={styles.productPrice}>{product.price}</div>
                      <button className={styles.productBtn}>В кошик</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              className={`${styles.sliderBtn} ${styles.sliderBtnNext}`}
              onClick={() => handleSlideChange('next')}
              aria-label="Наступний товар"
            >
              →
            </button>
          </div>
          <div className={styles.sliderDots}>
            {newProducts.map((_, index) => (
              <button
                key={index}
                className={`${styles.sliderDot} ${index === currentSlide ? styles.sliderDotActive : ''}`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Перейти до товару ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className={styles.benefits}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Чому обирають нас?</h2>
            <p className={styles.sectionSubtitle}>
              Наші принципи і переваги для усвідомлених покупців
            </p>
          </div>
          <div className={styles.benefitsGrid}>
            {benefits.map((benefit, index) => (
              <div key={index} className={styles.benefitCard}>
                <div className={styles.benefitIcon}>{benefit.icon}</div>
                <h3 className={styles.benefitTitle}>{benefit.title}</h3>
                <p className={styles.benefitDescription}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className={styles.newsletter}>
        <div className={styles.container}>
          <div className={styles.newsletterContent}>
            <div className={styles.newsletterText}>
              <h2 className={styles.newsletterTitle}>
                Будьте в курсі еко-новинок
              </h2>
              <p className={styles.newsletterSubtitle}>
                Підпишіться на нашу розсилку та отримуйте інформацію про нові товари, акції та еко-тренди
              </p>
            </div>
            <form className={styles.newsletterForm} onSubmit={handleNewsletterSubmit}>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  placeholder="Введіть ваш email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.newsletterInput}
                  required
                />
                <button type="submit" className={styles.newsletterBtn}>
                  Підписатися
                </button>
              </div>
              <p className={styles.newsletterPrivacy}>
                Натискаючи "Підписатися", ви погоджуєтесь з <Link to="/privacy">політикою конфіденційності</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;