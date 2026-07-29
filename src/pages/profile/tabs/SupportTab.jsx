import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const SupportTab = () => {
  const [orderId, setOrderId] = useState('');
  const [text, setText] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadTickets = async () => {
    const res = await fetch('/api/support/tickets?limit=10', { credentials: 'include' });
    if (res.ok) {
      const j = await res.json();
      setTickets(j?.items || []);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadTickets();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Раніше помилка мовчки ковталась: тікет не зберігався взагалі (бекенд повертав
  // {ok:true}, нічого не пишучи), а користувач бачив очищену форму й вважав, що
  // звернення прийнято. Тепер показуємо результат і одразу оновлюємо список.
  const openTicket = async (e) => {
    e.preventDefault();

    setMsg('');
    setErr('');
    setSending(true);

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, orderId: orderId || undefined }),
      });

      if (!res.ok) throw new Error(await readError(res));

      setOrderId('');
      setText('');
      setMsg('Звернення створено. Ми відповімо на вашу пошту.');
      await loadTickets();
    } catch (e2) {
      setErr(e2.message || 'Не вдалося створити звернення');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={panel.section} aria-labelledby="support-tab-heading">
      <h2 id="support-tab-heading" className={panel.sectionTitle}>
        Підтримка
      </h2>

      {(msg || err) && (
        <div
          className={err ? panel.serverError : panel.serverOk}
          role={err ? 'alert' : 'status'}
          aria-live="polite"
        >
          {err || msg}
        </div>
      )}

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Створити тикет</h3>
        <form onSubmit={openTicket} noValidate>
          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="sup-order">
              Номер замовлення (необовʼязково)
            </label>
            <input
              id="sup-order"
              className={panel.input}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Ідентифікатор замовлення з розділу «Мої замовлення»"
            />
          </div>

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="sup-msg">
              Повідомлення
            </label>
            <textarea
              id="sup-msg"
              className={panel.input}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/*
            Поле «Вкладення» прибрано: приватного сховища для файлів звернень
            немає, бекенд їх не зберігає. Інпут, який мовчки викидає вибрані
            файли, гірший за його відсутність — користувач вважав, що надіслав
            фото дефекту. Повернути разом із реалізацією зберігання вкладень.
          */}
          <button type="submit" className={panel.btnPrimary} disabled={sending || !text.trim()}>
            {sending ? 'Надсилаємо…' : 'Надіслати'}
          </button>
        </form>
      </div>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Останні звернення</h3>
        {loading ? (
          <div className={panel.skeletonMain} aria-hidden />
        ) : tickets.length === 0 ? (
          <p className={panel.cardText}>Поки що звернень немає.</p>
        ) : (
          <ul className={panel.list}>
            {tickets.map((t) => (
              <li key={t.id} className={panel.listItem}>
                #{t.id} — {t.subject || 'без теми'}{' '}
                <span className={panel.smallNote}>{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default SupportTab;