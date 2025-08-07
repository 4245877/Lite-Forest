// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

const HomePage = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState('');

  // Данные для слайдера новинок
  const newProducts = [
    {
      id: 1,
      name: 'Эко-бутылка из бамбука',
      price: '1 290 ₽',
      image: '🌿',
      ecoScore: 95
    },
    {
      id: 2,
      name: 'Органическая косметичка',
      price: '2 150 ₽',
      image: '🌱',
      ecoScore: 92
    },
    {
      id: 3,
      name: 'Набор эко-посуды',
      price: '3 450 ₽',
      image: '🍃',
      ecoScore: 98
    },
    {
      id: 4,
      name: 'Органическое мыло',
      price: '450 ₽',
      image: '🌾',
      ecoScore: 89
    },
    {
      id: 5,
      name: 'Льняная сумка-шоппер',
      price: '890 ₽',
      image: '🌿',
      ecoScore: 94
    }
  ];

  // Категории
  const categories = [
    {
      id: 1,
      name: 'Эко-упаковка',
      slogan: 'Сохраним природу вместе',
      icon: '📦',
      bgColor: '#f0fdf4'
    },
    {
      id: 2,
      name: 'Сад и дача',
      slogan: 'Выращивай экологично',
      icon: '🌱',
      bgColor: '#f7fee7'
    },
    {
      id: 3,
      name: 'Домашний уют',
      slogan: 'Комфорт без вреда',
      icon: '🏠',
      bgColor: '#fefce8'
    },
    {
      id: 4,
      name: 'Красота и здоровье',
      slogan: 'Натуральная красота',
      icon: '💚',
      bgColor: '#f0f9ff'
    }
  ];

  // Преимущества
  const benefits = [
    {
      icon: '♻️',
      title: '100% эко-материалы',
      description: 'Только сертифицированные экологичные товары'
    },
    {
      icon: '🤝',
      title: 'Поддержка локальных производителей',
      description: 'Развиваем местную эко-экономику'
    },
    {
      icon: '🚚',
      title: 'Быстрая доставка',
      description: 'Доставка в эко-упаковке за 1-2 дня'
    },
    {
      icon: '✅',
      title: 'Гарантия качества',
      description: '30 дней на возврат, пожизненная поддержка'
    }
  ];

  // Автопрокрутка слайдера
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % newProducts.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [newProducts.length]);

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
      // Здесь будет логика подписки
      alert('Спасибо за подписку на эко-новости!');
      setEmail('');
    }
  };

  return (
    <div className={styles.homePage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>🌿 Экологичные покупки</span>
            <h1 className={styles.heroTitle}>
              Добро пожаловать в <span className={styles.titleAccent}>Lite-Forest</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Купи экологично — живи лучше. Откройте для себя мир устойчивых товаров, созданных с заботой о планете и будущих поколениях.
            </p>
            <div className={styles.heroActions}>
              <Link to="/catalog" className={styles.ctaButton}>
                <span>Перейти в каталог</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
              <Link to="/about" className={styles.secondaryButton}>
                Узнать больше
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
            <h2 className={styles.sectionTitle}>Популярные категории</h2>
            <p className={styles.sectionSubtitle}>
              Выбирайте из наших самых востребованных эко-категорий
            </p>
          </div>
          <div className={styles.categoriesGrid}>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/catalog/${category.name.toLowerCase()}`}
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
              Свежие поступления эко-товаров от наших партнёров
            </p>
          </div>
          <div className={styles.slider}>
            <button
              className={`${styles.sliderBtn} ${styles.sliderBtnPrev}`}
              onClick={() => handleSlideChange('prev')}
              aria-label="Предыдущий товар"
            >
              ←
            </button>
            <div className={styles.sliderContainer}>
              <div 
                className={styles.sliderTrack}
                style={{ transform: `translateX(-${currentSlide * 280}px)` }}
              >
                {newProducts.map((product, index) => (
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
                      <button className={styles.productBtn}>В корзину</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              className={`${styles.sliderBtn} ${styles.sliderBtnNext}`}
              onClick={() => handleSlideChange('next')}
              aria-label="Следующий товар"
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
                aria-label={`Перейти к товару ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className={styles.benefits}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Почему выбирают нас?</h2>
            <p className={styles.sectionSubtitle}>
              Наши принципы и преимущества для осознанных покупателей
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
                Будьте в курсе эко-новинок
              </h2>
              <p className={styles.newsletterSubtitle}>
                Подпишитесь на нашу рассылку и получайте информацию о новых товарах, акциях и эко-трендах
              </p>
            </div>
            <form className={styles.newsletterForm} onSubmit={handleNewsletterSubmit}>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  placeholder="Введите ваш email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.newsletterInput}
                  required
                />
                <button type="submit" className={styles.newsletterBtn}>
                  Подписаться
                </button>
              </div>
              <p className={styles.newsletterPrivacy}>
                Нажимая "Подписаться", вы соглашаетесь с <Link to="/privacy">политикой конфиденциальности</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;