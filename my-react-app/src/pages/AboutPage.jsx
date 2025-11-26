import React from 'react';
import styles from './AboutPage.module.css';

// Нова команда з реальними ролями (замість одного імені)
const teamMembers = [
  {
    name: 'Михайло Головач',
    role: 'Засновник & CEO',
    avatar: '👨‍💻', // Заміни на фото: '/images/team/mykhailo.jpg'
  },
  {
    name: 'Громницький Вались',
    role: 'Технічний спеціаліст',
    avatar: '👨‍🔧',
  },
  {
    name: 'Іван Єфіменко',
    role: 'Аналітик даних',
    avatar: '👨‍💼',
  },
  {
    name: 'Ірина Бойко',
    role: 'Маркетинг',
    avatar: '👩‍🎤',
  },
  {
    name: 'Дмитро Кравченко',
    role: 'Лід-дизайнер',
    avatar: '👨‍🎨',
  },
  {
    name: 'Катерина Ткаченко',
    role: 'Партнерства та закупівлі',
    avatar: '🤝',
  },
];

// Реалістичний таймлайн: корені проєкту до офіційного запуску у 2025
const historyEvents = [
  { year: '2022', description: 'Почали як волонтерська ініціатива: зібрали перші еко-набори для місцевих спільнот.' },
  { year: '2023', description: 'Випустили тестову лінійку товарів та провели опитування 50 сімей у Києві.' },
  { year: '2024', description: 'Запустили передзамовлення, домовилися з 5 локальними виробниками, відпрацювали контроль якості.' },
  { year: '2025', description: 'Офіційний запуск бренду та онлайн-каталогу. Перші корпоративні клієнти.' },
];

const AboutPage = () => {
  return (
    <div className={styles.aboutPage}>
      {/* Hero-блок */}
      <section className={`${styles.hero} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1>
              Новий бренд. Перевірені{' '}
              <span className={styles.titleAccent}>принципи</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Ми народилися з практичної потреби: дати прості та чесні еко-рішення для щоденного життя. 
              Невелика команда з досвідом у e-commerce, дизайні та логістиці перетворила пілот на повноцінний сервіс.
            </p>
          </div>
        </div>
      </section>

      {/* Наша місія */}
      <section className={`${styles.mission} ${styles.slideInRight}`}>
        <div className={`${styles.container} ${styles.missionContent}`}>
          <div className={styles.missionIcon}>🌍</div>
          <div className={styles.missionText}>
            <h2 className={styles.sectionTitle}>Наша місія</h2>
            <p>
              Зробити екологічні товари звичним вибором. Ми відбираємо те, що справді корисно для вас і планети, 
              працюємо прозоро та спираємося на відгуки спільноти, а не на гучні обіцянки.
            </p>
          </div>
        </div>
      </section>

      {/* Цінності */}
      <section className={`${styles.values} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Наші цінності</h2>
          </div>
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🌱</div>
              <h3>Екологічність</h3>
              <p>Вибираємо матеріали з мінімальним слідом та продовжуємо їхній життєвий цикл.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>💎</div>
              <h3>Якість</h3>
              <p>Кожна позиція проходить тестування в реальних умовах до потрапляння в каталог.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🤝</div>
              <h3>Прозорість</h3>
              <p>Відкрито розповідаємо про склад, походження та партнерів-виробників.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Чому нам довіряють */}
      <section className={`${styles.values} ${styles.slideInRight}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Чому нам довіряють</h2>
          </div>
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>📦</div>
              <h3>Малі партії — більше контролю</h3>
              <p>Працюємо з локальними партнерами та перевіряємо кожну партію вручну.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🔍</div>
              <h3>Відкриті характеристики</h3>
              <p>Публікуємо реальні фото, параметри та рекомендації по використанню.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>💬</div>
              <h3>Зв’язок із засновником</h3>
              <p>Можна написати напряму — ми швидко реагуємо на пропозиції та зауваження.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Команда */}
      <section className={`${styles.team} ${styles.slideInRight}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Наша команда</h2>
            <p className={styles.sectionSubtitle}>
              Невелика, але досвідчена команда, яка перетворює ідеї на корисні продукти.
            </p>
          </div>
          <div className={styles.teamGrid}>
            {teamMembers.map((member, index) => (
              <div key={index} className={styles.teamMemberCard}>
                <div className={styles.teamAvatar}>{member.avatar}</div>
                <h3 className={styles.teamName}>{member.name}</h3>
                <p className={styles.teamRole}>{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Історія компанії */}
      <section className={`${styles.history} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Шлях компанії</h2>
          </div>
          <div className={styles.timeline}>
            {historyEvents.map((event, index) => (
              <div key={index} className={styles.timelineItem}>
                <div className={styles.timelineDot}></div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineYear}>{event.year}</div>
                  <p className={styles.timelineDescription}>{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Цифри та досягнення — реалістично для старту */}
      <section className={`${styles.achievements} ${styles.slideInRight}`}>
        <div className={styles.container}>
          <div className={styles.achievementsGrid}>
            <div className={styles.achievementCard}>
              <span className={styles.achievementNumber}>5+</span>
              <span className={styles.achievementLabel}>Локальних виробників</span>
            </div>
            <div className={styles.achievementCard}>
              <span className={styles.achievementNumber}>60+</span>
              <span className={styles.achievementLabel}>Позицій у каталозі {/* TODO: оновлюйте після релізу */}</span>
            </div>
            <div className={styles.achievementCard}>
              <span className={styles.achievementNumber}>100+</span>
              <span className={styles.achievementLabel}>Передзамовлень від тест-групи {/* TODO: замініть на фактичне число */}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Призив до дії */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Готові спробувати?</h2>
            <p>
              Перегляньте каталог або напишіть нам — підкажемо, з чого почати.
            </p>
            <a href="/catalog" className={styles.ctaButton}>
              Перейти до каталогу
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
