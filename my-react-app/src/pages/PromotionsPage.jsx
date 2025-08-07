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
    title: 'Третий товар в подарок!',
    description: 'Купи 2 товара из категории «Для дома» и получи третий бесплатно.',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1770', // Пример изображения
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // Акция закончится через 10 дней
    ctaText: 'Выбрать товары',
    link: '/catalog/home',
  },
  {
    id: 2,
    title: 'Набор «Порядок на столе» со скидкой 15%',
    description: 'Собери свой идеальный набор для рабочего места и получи скидку.',
    imageUrl: 'https://images.unsplash.com/photo-1484417894907-623942c8ee29?q=80&w=1887', // Пример изображения
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Акция закончится через 3 дня
    ctaText: 'Перейти к набору',
    link: '/bundles/office-set',
  },
  {
    id: 3,
    title: 'Товар недели: Эко-бутылка –40%',
    description: 'Стильная и удобная бутылка для воды по супер-цене. Успей купить!',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-247e961438ae?q=80&w=1887', // Пример изображения
    endDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000), // Акция закончится через 1 день 5 часов
    ctaText: 'В корзину',
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
          newTimeLefts[promo.id] = 'Акция завершена';
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
          <h1 className={styles.heroTitle}>Успей забрать!</h1>
          <p className={styles.heroSubtitle}>
            Самые выгодные предложения, которые действуют ограниченное время. Не упустите свою выгоду!
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
                    <span>До конца акции:</span>
                    <strong className={styles.timerDigits}>{timeLefts[promo.id] || 'Загрузка...'}</strong>
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
            <h2 className={homePageStyles.sectionTitle}>Всего 3 простых шага</h2>
            <div className={styles.stepsGrid}>
                <div className={styles.step}>
                    <div className={styles.stepIcon}>1</div>
                    <p>Выбери товары</p>
                </div>
                 <div className={styles.step}>
                    <div className={styles.stepIcon}>2</div>
                    <p>Добавь в корзину</p>
                </div>
                 <div className={styles.step}>
                    <div className={styles.stepIcon}>3</div>
                    <p>Получи выгоду</p>
                </div>
            </div>
         </div>
      </section>
      
      {/* 4. Финальный призыв к действию */}
      <section className={styles.finalCta}>
        <div className={homePageStyles.container}>
            <h2 className={styles.finalCtaTitle}>Хватит ждать — действуй!</h2>
            <p className={styles.finalCtaSubtitle}>Сотни товаров уже ждут вас в каталоге по выгодным ценам.</p>
            <Link to="/catalog" className={`${homePageStyles.ctaButton} ${homePageStyles.ctaButtonLarge}`}>
                В каталог акций
            </Link>
        </div>
      </section>
    </div>
  );
};

export default PromotionsPage;