import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Предполагаем, что используется React Router

// Импортируем стили для этой страницы
import styles from './PromotionsPage.module.css';
// Импортируем стили с главной страницы, чтобы использовать общий класс кнопки
import homePageStyles from './HomePage.module.css';

// --- Mock-данные для акций ---
// В реальном приложении эти данные будут приходить с API
const mockPromotions = [
  {
    id: 1,
    title: 'Третій товар у подарунок!',
    description: 'Купи 2 товари з категорії «Для дому» та отримай третій безкоштовно.',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1770', // Пример изображения
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Акция закончится через 10 дней
    ctaText: 'Обрати товари',
    link: '/catalog/home',
  },
  {
    id: 2,
    title: 'Набір «Порядок на столі» зі знижкою 15%',
    description: 'Збери свій ідеальний набір для робочого місця та отримай знижку.',
    imageUrl: 'https://images.unsplash.com/photo-1484417894907-623942c8ee29?q=80&w=1887', // Пример изображения
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Акция закончится через 3 дня
    ctaText: 'Перейти до набору',
    link: '/bundles/office-set',
  },
  {
    id: 3,
    title: 'Товар тижня: Еко-пляшка –40%',
    description: 'Стильна та зручна пляшка для води за супер-ціною. Встигни купити!',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-247e961438ae?q=80&w=1887', // Пример изображения
    endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000), // Акция закончится через 1 день 5 часов
    ctaText: 'У кошик',
    link: '/products/eco-bottle',
  },
];

// Функция для форматирования времени
const formatTime = (time) => {
    return time < 10 ? `0${time}` : time;
};


const PromotionsPage = () => {
  const [timeLefts, setTimeLefts] = useState({});

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLefts = {};
      mockPromotions.forEach(promo => {
        const now = new Date();
        const difference = promo.endDate - now;

        if (difference > 0) {
          const days = Math.floor(difference / (1000 * 60 * 60 * 24));
          const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((difference / 1000 / 60) % 60);
          const seconds = Math.floor((difference / 1000) % 60);
          newTimeLefts[promo.id] = `${formatTime(days)}:${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
        } else {
          newTimeLefts[promo.id] = 'Акцію завершено';
        }
      });
      setTimeLefts(newTimeLefts);
    }, 1000);

    // Очистка интервала при размонтировании компонента
    return () => clearInterval(timer);
  }, []); // Пустой массив зависимостей, чтобы useEffect выполнился один раз

  return (
    <div className={styles.promotionsPage}>
      {/* 1. Hero-блок */}
      <section className={styles.hero}>
        <div className={homePageStyles.container}>
          <h1 className={styles.heroTitle}>Встигни забрати!</h1>
          <p className={styles.heroSubtitle}>
            Найвигідніші пропозиції, що діють обмежений час. Не проґавте свою вигоду!
          </p>
        </div>
      </section>

      {/* 2. Список акционных карточек */}
      <main className={styles.mainContent}>
        <div className={homePageStyles.container}>
          <div className={styles.promotionsGrid}>
            {mockPromotions.map(promo => (
              <div key={promo.id} className={styles.promoCard}>
                <div className={styles.promoBanner} style={{backgroundImage: `url(${promo.imageUrl})`}}>
                  <div className={styles.timer}>
                    <span>До кінця акції:</span>
                    <strong className={styles.timerDigits}>{timeLefts[promo.id] || 'Завантаження...'}</strong>
                  </div>
                </div>
                <div className={styles.promoInfo}>
                  <h2 className={styles.promoTitle}>{promo.title}</h2>
                  <p className={styles.promoDescription}>{promo.description}</p>
                  <Link to={promo.link} className={`${homePageStyles.ctaButton} ${styles.promoCardButton}`}>
                    {promo.ctaText}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 3. Блок "Как это работает" */}
      <section className={styles.howItWorks}>
         <div className={homePageStyles.container}>
            <h2 className={homePageStyles.sectionTitle}>Усього 3 простих кроки</h2>
            <div className={styles.stepsGrid}>
                <div className={styles.step}>
                    <div className={styles.stepIcon}>1</div>
                    <p>Обери товари</p>
                </div>
                 <div className={styles.step}>
                    <div className={styles.stepIcon}>2</div>
                    <p>Додай в кошик</p>
                </div>
                 <div className={styles.step}>
                    <div className={styles.stepIcon}>3</div>
                    <p>Отримай вигоду</p>
                </div>
            </div>
         </div>
      </section>
      
      {/* 4. Финальный призыв к действию */}
      <section className={styles.finalCta}>
        <div className={homePageStyles.container}>
            <h2 className={styles.finalCtaTitle}>Годі чекати — дій!</h2>
            <p className={styles.finalCtaSubtitle}>Сотні товарів вже чекають на вас у каталозі за вигідними цінами.</p>
            <Link to="/catalog" className={`${homePageStyles.ctaButton} ${homePageStyles.ctaButtonLarge}`}>
                До каталогу акцій
            </Link>
        </div>
      </section>
    </div>
  );
};

export default PromotionsPage;