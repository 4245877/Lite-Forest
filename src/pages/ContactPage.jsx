// src/pages/ContactPage.jsx
import React, { useState } from 'react';
import styles from './ContactPage.module.css';

const FAQ_ITEMS = [
  { q: 'Які терміни виготовлення та доставки?', a: 'Термін друку 2–5 робочих днів, залежно від завантаження. Доставка по Україні зазвичай 1–3 дні.' },
  { q: 'Як я можу відстежити своє замовлення?', a: 'Після відправки на e-mail прийде трек-номер кур’єрської служби та посилання для відстеження.' },
  { q: 'Скільки коштує доставка до мого міста?', a: 'Вартість доставки залежить від регіону. Стандартна ставка — 50 грн, при досягненні порога безкоштовної доставки — доставка безкоштовна.' },
  { q: 'З якого матеріалу ви друкуєте? Наскільки він міцний?', a: 'Ми використовуємо фотополімер для деталей високої точності та PLA/ABS для великих елементів. Підберемо матеріал під завдання.' },
  { q: 'Чи можна замовити модель в іншому кольорі/розмірі?', a: 'Так, вкажіть бажані параметри в темі замовлення або через форму кастомного замовлення.' },
  { q: 'Що робити, якщо товар прийшов із дефектом?', a: 'Зв’яжіться з нами, додайте фото дефекту та номер замовлення. Ми оперативно вирішимо питання — повернення чи переробка.' },
  { q: 'Чи можете ви надрукувати за моєю 3D-моделлю?', a: 'Так. Надішліть STL/OBJ-файл — ми оцінимо та узгодимо вартість та терміни.' },
  { q: 'Як розраховується вартість індивідуального замовлення?', a: 'Вартість залежить від часу друку, матеріалів та постобробки. Ми надаємо комерційну пропозицію після оцінки моделі.' },
  { q: 'Які є способи оплати?', a: 'Приймаємо карту (Visa/MasterCard), Google Pay, а також безготівковий переказ для юросіб.' },
  { q: 'Чи можете ви виставити рахунок для компанії (юридичні особи)?', a: 'Так, можемо виставити рахунок та надіслати реквізити для оплати. Вкажіть це у формі — ми підготуємо документи.' },
];

const MESSENGERS = {
  telegram: 'https://t.me/yourshop',
  whatsapp: 'https://wa.me/380XXXXXXXXX',
  viber: 'viber://chat?number=%2B380XXXXXXXXX',
};

const FAQ = ({ items = [] }) => {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className={styles.accordion}>
      {items.map((it, i) => (
        <div key={it.q} className={styles.accordionItem}>
          <button
            type="button"
            className={styles.accordionBtn}
            id={`faq-button-${i}`}
            aria-expanded={openIndex === i}
            aria-controls={`faq-answer-${i}`}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <span className={styles.q}>{it.q}</span>
            <span className={styles.chev} aria-hidden>
              {openIndex === i ? '−' : '+'}
            </span>
          </button>
          <div
            id={`faq-answer-${i}`}
            aria-labelledby={`faq-button-${i}`}
            className={`${styles.answer} ${openIndex === i ? styles.open : ''}`}
          >
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

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setStatus(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('network');
      setStatus({ ok: true, msg: 'Повідомлення надіслано. Ми зв’яжемося з вами протягом 24 годин.' });
      setForm({ name: '', email: '', order: '', topic: 'order', message: '' });
    } catch {
      setStatus({ ok: false, msg: 'Помилка надсилання. Спробуйте пізніше або зв’яжіться з нами телефоном.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Контакти та Допомога</h1>
        <p className={styles.lead}>Потрібна допомога? Виберіть зручний спосіб: спочатку подивіться FAQ — він закриває найчастіші питання.</p>
      </header>

      <section className={styles.faqSection}>
        <h2>Знайдіть відповідь миттєво</h2>
        <p className={styles.small}>Часті питання</p>
        <FAQ items={FAQ_ITEMS} />
      </section>

      <section className={styles.channels}>
        <h2>Зв'яжіться з нами безпосередньо</h2>
        <p className={styles.small}>Оберіть зручний спосіб зв'язку</p>
        <div className={styles.grid}>
          <a className={styles.channelCard} href="tel:+380XXXXXXXXX">
            <div className={styles.icon} aria-hidden>📞</div>
            <div>
              <div className={styles.chTitle}>Зателефонувати нам</div>
              <div className={styles.chDesc}>
                +380 XX XXX XX XX
                <br />
                <span className={styles.muted}>Пн–Пт 10:00–19:00</span>
              </div>
            </div>
          </a>

          <a className={styles.channelCard} href="mailto:info@yourshop.com">
            <div className={styles.icon} aria-hidden>✉️</div>
            <div>
              <div className={styles.chTitle}>Написати на Email</div>
              <div className={styles.chDesc}>
                info@yourshop.com
                <br />
                <span className={styles.muted}>Відповідаємо протягом 2–4 робочих годин</span>
              </div>
            </div>
          </a>

          <div className={styles.channelCard}>
            <div className={styles.icon} aria-hidden>💬</div>
            <div>
              <div className={styles.chTitle}>Месенджери</div>
              <div className={styles.chDesc}>
                <a href={MESSENGERS.telegram} target="_blank" rel="noreferrer">Telegram</a> ·{' '}
                <a href={MESSENGERS.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> ·{' '}
                <a href={MESSENGERS.viber} target="_blank" rel="noreferrer">Viber</a>
              </div>
            </div>
          </div>

          <a className={styles.channelCard} href="/instagram" aria-label="Instagram">
            <div className={styles.icon} aria-hidden>❤️</div>
            <div>
              <div className={styles.chTitle}>Слідкуйте за нами</div>
              <div className={styles.chDesc}>Instagram</div>
            </div>
          </a>
        </div>
      </section>

      <section className={styles.formSection}>
        <h2>Для оптових замовлень, співпраці чи питань щодо конкретного замовлення</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.rowTwo}>
            <label>
              Ваше ім'я
              <input name="name" value={form.name} onChange={handleChange} required />
            </label>
            <label>
              Ваш Email
              <input name="email" type="email" value={form.email} onChange={handleChange} required />
            </label>
          </div>

          <div className={styles.rowTwo}>
            <label>
              Номер замовлення (необов'язково)
              <input name="order" value={form.order} onChange={handleChange} />
            </label>

            <label>
              Тема звернення
              <select name="topic" value={form.topic} onChange={handleChange}>
                <option value="order">Питання щодо мого замовлення</option>
                <option value="wholesale">Оптове / корпоративне замовлення</option>
                <option value="partner">Співробітництво та партнерство</option>
                <option value="print">Друк моєї моделі</option>
                <option value="other">Інше</option>
              </select>
            </label>
          </div>

          <label>
            Ваше повідомлення
            <textarea name="message" rows={6} value={form.message} onChange={handleChange} required />
          </label>

          <div className={styles.formFooter}>
            <div className={styles.formStatus}>
              {status ? (
                status.ok ? <span className={styles.ok}>{status.msg}</span> : <span className={styles.err}>{status.msg}</span>
              ) : null}
            </div>
            <button type="submit" className={styles.submit} disabled={sending}>
              {sending ? 'Надсилання...' : 'Надіслати запит'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.bottom}>
        <div className={styles.mapCol}>
          <h3>Наша присутність</h3>
          <div className={styles.mapWrap}>
            <iframe
              title="Карта"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d127567.123456789!2d30.0!3d50.45!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40d4c...!2sKyiv!5e0!3m2!1sen!2sua!4v000000000"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>

        <div className={styles.infoCol}>
          <h3>Наша адреса та реквізити</h3>
          <address className={styles.address}>
            м. Київ, вул. Прилужна, 4/15, 10
            <br />
            Тел: <a href="tel:+380XXXXXXXXX">+380 XX XXX XX XX</a>
            <br />
            Email: <a href="mailto:info@yourshop.com">info@yourshop.com</a>
          </address>

          <div className={styles.company}>
            <strong>ФОП Головач Михайло Дмитрович</strong>
            <br />
            ІПН/ЄДРПОУ: 1234567890
          </div>
        </div>
      </section>
    </div>
  );
}