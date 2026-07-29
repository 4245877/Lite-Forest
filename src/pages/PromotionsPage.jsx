import React from 'react';
import { Link } from 'react-router-dom';
import styles from './PromotionsPage.module.css';
import homePageStyles from './HomePage.module.css';

// Данные для карточек (тексты взяты из твоего ТЗ)
// В будущем эти данные могут приходить с бекенда, но пока они статичны и "вечны"
const permanentPromotions = [
  {
    id: 'shipping',
    title: 'Безкоштовна доставка від 2000 грн', // Пример суммы, можно менять
    description: 'Оформлюй замовлення на суму від 2000 грн — і доставка по Україні для тебе безкоштовна. Якщо сума менша, ми підкажемо, скільки ще додати.',
    icon: '🚚', // Можно заменить на SVG или картинку
    link: '/catalog',
  },
  {
    id: 'sum-discount',
    title: 'Знижка за суму замовлення',
    description: 'Чим більша сума замовлення, тим вигідніша ціна. Приклад: від 1500 грн — 3%, від 3000 грн — 5%. Система автоматично обирає рівень.',
    icon: '💰',
    link: '/catalog',
  },
  {
    id: 'item-count',
    title: 'Більше товарів — вигідніша ціна',
    description: 'Замовляй більше готових виробів і плати менше за штуку. Наприклад: при 3–4 товарах — знижка 5%, при 5 і більше — 7%.',
    icon: '📦',
    link: '/catalog',
  },
  {
    id: 'combo',
    title: 'Комбо-набори з різних категорій',
    description: 'Поєднуй корисні речі! Додай до кошика товари з різних категорій (наприклад, «Організація» + «Зберігання») — і отримай 10% знижки на набір.',
    icon: '🧩',
    link: '/catalog',
  },
  {
    id: 'loyalty',
    title: 'Постійним клієнтам — постійна знижка',
    description: 'Якщо ти вже робив у нас замовлення й авторизувався, отримуєш постійну знижку 3% на всі наступні покупки. Ми цінуємо твою лояльність.',
    icon: '🤝',
    link: '/login', // Ведем на вход, если это про лояльность
  },
  {
    id: 'batch',
    title: 'Вигідно купувати наборами',
    description: 'Замовляєш 5 тримачів чи 10 органайзерів? Після 3-го екземпляра кожна наступна одиниця дешевша. Готуємо й комплектуємо набори вигідніше.',
    icon: '📦',
    link: '/catalog',
  },
];

const PromotionsPage = () => {
  return (
    <div className={styles.promotionsPage}>
      
      {/* 1.1. Hero-блок */}
      <section className={styles.hero}>
        <div className={homePageStyles.container}>
          <h1 className={styles.heroTitle}>
            Постійні акції для вигідних покупок
          </h1>
          <p className={styles.heroSubtitle}>
            Допомагаємо економити на товарах із каталогу.
            Усі акції діють довго й застосовуються автоматично під час оформлення замовлення —
            без промокодів і складних правил.
          </p>
          <p className={styles.heroNote}>
            Просто додавай товари в кошик, а система підкаже, що зробити, щоб отримати більше вигоди.
          </p>
        </div>
      </section>

      {/* 1.2. Список акций (карточки) */}
      <main className={styles.mainContent}>
        <div className={homePageStyles.container}>
          <h2 className={homePageStyles.sectionTitle}>Актуальні акції</h2>
          <p className={styles.sectionIntro}>
            Нижче — умови, які діють постійно або довгий час. Для одного замовлення застосовується 
            одна найвигідніша знижка (крім безкоштовної доставки).
          </p>
          
          <div className={styles.promotionsGrid}>
            {permanentPromotions.map(promo => (
              <div key={promo.id} className={styles.promoCard}>
                {/* Вместо картинки используем иконку для чистоты, или верни promoBanner, если есть фото */}
                <div className={styles.cardIcon}>{promo.icon}</div>
                <div className={styles.promoInfo}>
                  <h3 className={styles.promoTitle}>{promo.title}</h3>
                  <p className={styles.promoDescription}>{promo.description}</p>
                  {/* Кнопка может быть опциональной, так как акции автоматические */}
                  {/* <Link to={promo.link} className={styles.cardLink}>Детальніше &rarr;</Link> */}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 1.3. Блок «Як це працює» */}
      <section className={styles.howItWorks}>
         <div className={homePageStyles.container}>
            <h2 className={homePageStyles.sectionTitle}>Як працюють акції</h2>
            <div className={styles.stepsList}>
               <div className={styles.stepItem}>
                  <span className={styles.checkIcon}>✔</span>
                  <p>Усі акції застосовуються автоматично під час оформлення замовлення.</p>
               </div>
               <div className={styles.stepItem}>
                  <span className={styles.checkIcon}>✔</span>
                  <p>Якщо замовлення підпадає під декілька акцій, система обирає одну найвигіднішу для тебе.</p>
               </div>
               <div className={styles.stepItem}>
                  <span className={styles.checkIcon}>✔</span>
                  <p>Безкоштовна доставка (якщо доступна) може поєднуватися зі знижкою на замовлення.</p>
               </div>
               <div className={styles.stepItem}>
                  <span className={styles.checkIcon}>✔</span>
                  <p>У кошику ти завжди бачиш, яку саме акцію застосовано й яку суму вдалося заощадити.</p>
               </div>
            </div>
         </div>
      </section>
      
      {/* 1.4. Блок із правилами / FAQ */}
      <section className={styles.faqSection}>
        <div className={homePageStyles.container}>
           <h3 className={styles.faqTitle}>Важливі уточнення</h3>
           <ul className={styles.faqList}>
              <li>Акції діють лише для роздрібних замовлень фізичних осіб.</li>
              <li>Знижки не поширюються на індивідуальні проєкти з окремими кошторисами.</li>
              <li>Ми залишаємо за собою право коригувати відсотки знижок і порогові суми, але завжди оновлюємо інформацію на цій сторінці.</li>
              <li>Якщо в тебе є питання щодо застосування акції — напиши нам, і ми перевіримо твоє замовлення.</li>
           </ul>
        </div>
      </section>

    </div>
  );
};

export default PromotionsPage;