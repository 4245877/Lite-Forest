import React from 'react';
import styles from './AboutPage.module.css'; // Подключаем стили

// Данные для секции "Наша команда". Вы можете заменить их на свои.
const teamMembers = [
  {
    name: 'Михайло Головач',
    role: 'CEO & Основатель',
    avatar: '👨‍💻', // Замените на путь к фото, например: '/images/team/anna.jpg'
  },
  {
    name: 'Михайло Головач',
    role: 'Технический директор',
    avatar: '👨‍💻',
  },
  {
    name: 'Михайло Головач',
    role: 'Маркетолог',
    avatar: '👨‍💻',
  },
  {
    name: 'Михайло Головач',
    role: 'Ведущий дизайнер',
    avatar: '👨‍🎨',
  },
];

// Данные для временной шкалы истории компании
const historyEvents = [
  { year: '2020', description: 'Підстава компанії з місією зробити світ зеленішим.' },
  { year: '2021', description: 'Запуск нашого першого флагманського продукту.' },
  { year: '2023', description: 'Подолали позначку 10 000 задоволених клієнтів.' },
  { year: '2025', description: 'Вихід на міжнародний ринок та відкриття нового офісу.' },
];

const AboutPage = () => {
  return (
    <div className={styles.aboutPage}>
      {/* Hero-блок */}
      <section className={`${styles.hero} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1>
              Наша історія — це турбота про{' '}
              <span className={styles.titleAccent}>країну</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Ми віримо, що малі кроки ведуть до великих змін. Наша мета - надати екологічні та якісні товари для кожного будинку.
            </p>
          </div>
        </div>
      </section>

      {/* Наша миссия */}
      <section className={`${styles.mission} ${styles.slideInRight}`}>
        <div className={`${styles.container} ${styles.missionContent}`}>
          <div className={styles.missionIcon}>🌍</div>
          <div className={styles.missionText}>
            <h2 className={styles.sectionTitle}>Наша миссия</h2>
            <p>
              Зробити екологічний спосіб життя доступним та простим для кожного. Ми 
              ретельно відбираємо продукти, які не тільки безпечні для вас та 
              вашої сім'ї, а й для нашої планети.
            </p>
          </div>
        </div>
      </section>

      {/* Ценности компании */}
      <section className={`${styles.values} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Наші цінності</h2>
          </div>
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🌱</div>
              <h3>Екологічність</h3>
              <p>Ми використовуємо тільки стійкі та перероблені матеріали.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>💎</div>
              <h3>Якість</h3>
              <p>Кожен наш продукт проходить суворий контроль якості.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🤝</div>
              <h3>Прозорість</h3>
              <p>Ми відкрито розповідаємо про склад та походження товарів.</p>
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
              Люди, які щодня працюють над тим, щоб зробити світ кращим.
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

      {/* История компании */}
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

      {/* Цифры и достижения */}
      <section className={`${styles.achievements} ${styles.slideInRight}`}>
        <div className={styles.container}>
            <div className={styles.achievementsGrid}>
                <div className={styles.achievementCard}>
                    <span className={styles.achievementNumber}>10k+</span>
                    <span className={styles.achievementLabel}>Щасливих клієнтів</span>
                </div>
                 <div className={styles.achievementCard}>
                    <span className={styles.achievementNumber}>500+</span>
                    <span className={styles.achievementLabel}>Еко-товарів</span>
                </div>
                 <div className={styles.achievementCard}>
                    <span className={styles.achievementNumber}>4</span>
                    <span className={styles.achievementLabel}>Року на ринку</span>
                </div>
            </div>
        </div>
      </section>


      {/* Призыв к действию */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Чи готові приєднатися до нас?</h2>
            <p>
              Ознайомтеся з нашим каталогом або зв'яжіться з нами, якщо у вас є запитання.
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