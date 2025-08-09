// src/pages/ContactPage.jsx
import React, { useState } from 'react';
import styles from './ContactPage.module.css';

const FAQ = ({ items = [] }) => {
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <div className={styles.accordion}>
      {items.map((it, i) => (
        <div key={i} className={styles.accordionItem}>
          <button
            className={styles.accordionBtn}
            aria-expanded={openIndex === i}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <span className={styles.q}>{it.q}</span>
            <span className={styles.chev} aria-hidden>{openIndex === i ? '−' : '+'}</span>
          </button>
          <div className={`${styles.answer} ${openIndex === i ? styles.open : ''}`}>
            <p>{it.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function ContactPage() {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', order: '', topic: 'order', message: '' });

  const faqItems = [
    { q: 'Какие сроки изготовления и доставки?', a: 'Срок печати 2–5 рабочих дней в зависимости от загрузки. Доставка по Украине обычно 1–3 дня.' },
    { q: 'Как я могу отследить свой заказ?', a: 'После отправки на e-mail придёт трек-номер курьерской службы и ссылка для отслеживания.' },
    { q: 'Сколько стоит доставка в мой город?', a: 'Стоимость доставки зависит от региона. Стандартная ставка — 50 грн, при достижении порога бесплатной доставки — доставка бесплатна.' },
    { q: 'Из какого материала вы печатаете? Насколько он прочный?', a: 'Мы используем фотополимер для деталей высокой точности и PLA/ABS для крупных элементов. Подберём материал под задачу.' },
    { q: 'Можно ли заказать модель в другом цвете/размере?', a: 'Да — укажите желаемые параметры в теме заказа или через форму кастомного заказа.' },
    { q: 'Что делать, если товар пришел с дефектом?', a: 'Свяжитесь с нами, приложите фото дефекта и номер заказа. Мы оперативно решим вопрос — возврат или переделка.' },
    { q: 'Можете ли вы напечатать по моей 3D-модели?', a: 'Да. Отправьте STL/OBJ-файл — мы оценим и согласуем стоимость и сроки.' },
    { q: 'Как рассчитывается стоимость индивидуального заказа?', a: 'Стоимость зависит от времени печати, материалов и постобработки. Мы предоставляем коммерческое предложение после оценки модели.' },
    { q: 'Какие есть способы оплаты?', a: 'Принимаем карту (Visa/MasterCard), Google Pay, а также безналичный перевод для юрлиц.' },
    { q: 'Можете ли вы выставить счет для компании (юрлица)?', a: 'Да, можем выставить счёт и отправить реквизиты для оплаты. Укажите это в форме — мы подготовим документы.' },
  ];

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      // Демонстрационная отправка — замените URL на ваш бэкенд
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('network');
      setStatus({ ok: true, msg: 'Сообщение отправлено! Мы свяжемся в течение 24 часов.' });
      setForm({ name: '', email: '', order: '', topic: 'order', message: '' });
    } catch (err) {
      setStatus({ ok: false, msg: 'Ошибка отправки. Попробуйте позже или свяжитесь по телефону.' });
    } finally {
      setSending(false);
    }
  }

  // quick links for messengers (fill your actual links)
  const messengers = {
    telegram: 'https://t.me/yourshop',
    whatsapp: 'https://wa.me/380XXXXXXXXX',
    viber: 'viber://chat?number=%2B380XXXXXXXXX',
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Контакты и Помощь</h1>
        <p className={styles.lead}>Нужна помощь? Выберите удобный способ: сначала посмотрите FAQ — он закрывает самые частые вопросы.</p>
      </header>

      <section className={styles.faqSection}>
        <h2>Найдите ответ мгновенно</h2>
        <p className={styles.small}>Часто задаваемые вопросы</p>
        <FAQ items={faqItems} />
      </section>

      <section className={styles.channels}>
        <h2>Свяжитесь с нами напрямую</h2>
        <p className={styles.small}>Выберите удобный способ связи</p>
        <div className={styles.grid}>
          <a className={styles.channelCard} href="tel:+380XXXXXXXXX">
            <div className={styles.icon} aria-hidden>📞</div>
            <div>
              <div className={styles.chTitle}>Позвонить нам</div>
              <div className={styles.chDesc}>+380 XX XXX XX XX<br/><span className={styles.muted}>Пн–Пт 10:00–19:00</span></div>
            </div>
          </a>

          <a className={styles.channelCard} href="mailto:info@yourshop.com">
            <div className={styles.icon} aria-hidden>✉️</div>
            <div>
              <div className={styles.chTitle}>Написать на Email</div>
              <div className={styles.chDesc}>info@yourshop.com<br/><span className={styles.muted}>Отвечаем в течение 2–4 рабочих часов</span></div>
            </div>
          </a>

          <div className={styles.channelCard}> 
            <div className={styles.icon} aria-hidden>💬</div>
            <div>
              <div className={styles.chTitle}>Мессенджеры</div>
              <div className={styles.chDesc}>
                <a href={messengers.telegram} target="_blank" rel="noreferrer">Telegram</a> · <a href={messengers.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> · <a href={messengers.viber} target="_blank" rel="noreferrer">Viber</a>
              </div>
            </div>
          </div>

          <a className={styles.channelCard} href="/instagram" aria-label="Instagram">
            <div className={styles.icon} aria-hidden>❤️</div>
            <div>
              <div className={styles.chTitle}>Следите за нами</div>
              <div className={styles.chDesc}>Instagram · TikTok · Facebook</div>
            </div>
          </a>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2>Для оптовых заказов, сотрудничества или вопросов по конкретному заказу</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.rowTwo}>
            <label>
              Ваше имя
              <input name="name" value={form.name} onChange={handleChange} required />
            </label>
            <label>
              Ваш Email
              <input name="email" type="email" value={form.email} onChange={handleChange} required />
            </label>
          </div>

          <div className={styles.rowTwo}>
            <label>
              Номер заказа (необязательно)
              <input name="order" value={form.order} onChange={handleChange} />
            </label>

            <label>
              Тема обращения
              <select name="topic" value={form.topic} onChange={handleChange}>
                <option value="order">Вопрос по моему заказу</option>
                <option value="wholesale">Оптовый/Корпоративный заказ</option>
                <option value="partner">Сотрудничество и партнерство</option>
                <option value="print">Предложение по печати моей модели</option>
                <option value="other">Другое</option>
              </select>
            </label>
          </div>

          <label>
            Ваше сообщение
            <textarea name="message" rows={6} value={form.message} onChange={handleChange} required />
          </label>

          <div className={styles.formFooter}>
            <div className={styles.formStatus}>{status ? (status.ok ? <span className={styles.ok}>{status.msg}</span> : <span className={styles.err}>{status.msg}</span>) : null}</div>
            <button type="submit" className={styles.submit} disabled={sending}>{sending ? 'Отправка...' : 'Отправить запрос'}</button>
          </div>
        </form>
      </section>

      <section className={styles.bottom}>
        <div className={styles.mapCol}>
          <h3>Наше присутствие</h3>
          <div className={styles.mapWrap}>
            {/* Replace the src query with your actual location */}
            <iframe
              title="map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127567.123456789!2d30.0!3d50.45!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40d4c...!2sKyiv!5e0!3m2!1sen!2sua!4v000000000"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>

        <div className={styles.infoCol}>
          <h3>Наш адрес и реквизиты</h3>
          <address className={styles.address}>
            г. Киев, ул. Примерная, 10<br />
            Тел: <a href="tel:+380XXXXXXXXX">+380 XX XXX XX XX</a><br />
            Email: <a href="mailto:info@yourshop.com">info@yourshop.com</a>
          </address>

          <div className={styles.company}> 
            <strong>ФОП Иванов Иван Иванович</strong><br />
            ІПН/ЄДРПОУ: 1234567890
          </div>
        </div>
      </section>
    </div>
  );
}