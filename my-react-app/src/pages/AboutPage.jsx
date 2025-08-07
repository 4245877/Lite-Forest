import React from 'react';
import styles from './AboutPage.module.css'; // Подключаем стили

// Данные для секции "Наша команда". Вы можете заменить их на свои.
const teamMembers = [
  {
    name: 'Анна Коваленко',
    role: 'CEO & Основатель',
    avatar: '👩‍💼', // Замените на путь к фото, например: '/images/team/anna.jpg'
  },
  {
    name: 'Максим Шевченко',
    role: 'Технический директор',
    avatar: '👨‍💻',
  },
  {
    name: 'Ольга Петренко',
    role: 'Маркетолог',
    avatar: '👩‍🎨',
  },
  {
    name: 'Иван Франко',
    role: 'Ведущий дизайнер',
    avatar: '👨‍🎨',
  },
];

// Данные для временной шкалы истории компании
const historyEvents = [
  { year: '2020', description: 'Основание компании с миссией сделать мир зеленее.' },
  { year: '2021', description: 'Запуск нашего первого флагманского продукта.' },
  { year: '2023', description: 'Преодолели отметку в 10 000 довольных клиентов.' },
  { year: '2025', description: 'Выход на международный рынок и открытие нового офиса.' },
];

const AboutPage = () => {
  return (
    <div className={styles.aboutPage}>
      {/* Hero-блок */}
      <section className={`${styles.hero} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1>
              Наша история — это забота о{' '}
              <span className={styles.titleAccent}>планете</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Мы верим, что малые шаги ведут к большим переменам. Наша цель —
              предоставить экологичные и качественные товары для каждого дома.
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
              Сделать экологичный образ жизни доступным и простым для каждого. Мы
              тщательно отбираем продукты, которые не только безопасны для вас и
              вашей семьи, но и для нашей планеты.
            </p>
          </div>
        </div>
      </section>

      {/* Ценности компании */}
      <section className={`${styles.values} ${styles.slideInLeft}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Наши ценности</h2>
          </div>
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🌱</div>
              <h3>Экологичность</h3>
              <p>Мы используем только устойчивые и перерабатываемые материалы.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>💎</div>
              <h3>Качество</h3>
              <p>Каждый наш продукт проходит строгий контроль качества.</p>
            </div>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🤝</div>
              <h3>Прозрачность</h3>
              <p>Мы открыто рассказываем о составе и происхождении товаров.</p>
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
              Люди, которые каждый день работают над тем, чтобы сделать мир лучше.
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
                <h2 className={styles.sectionTitle}>Путь компании</h2>
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
                    <span className={styles.achievementLabel}>Счастливых клиентов</span>
                </div>
                 <div className={styles.achievementCard}>
                    <span className={styles.achievementNumber}>500+</span>
                    <span className={styles.achievementLabel}>Эко-товаров</span>
                </div>
                 <div className={styles.achievementCard}>
                    <span className={styles.achievementNumber}>4</span>
                    <span className={styles.achievementLabel}>Года на рынке</span>
                </div>
            </div>
        </div>
      </section>


      {/* Призыв к действию */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Готовы присоединиться к нам?</h2>
            <p>
              Ознакомьтесь с нашим каталогом или свяжитесь с нами, если у вас есть вопросы.
            </p>
            <a href="/catalog" className={styles.ctaButton}>
              Перейти в каталог
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;