import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const SupportTab = () => {
  const [orderId, setOrderId] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/support/tickets?limit=10', { credentials: 'include' });
        if (res.ok) {
          const j = await res.json();
          setTickets(j?.items || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openTicket = async (e) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append('orderId', orderId);
    fd.append('message', text);
    [...files].forEach((f) => fd.append('attachments', f));

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!res.ok) throw new Error(await readError(res));

      setOrderId('');
      setText('');
      setFiles([]);
    } catch {
      // навмисно мовчимо
    }
  };

  return (
    <section className={panel.section} aria-labelledby="support-tab-heading">
      <h2 id="support-tab-heading" className={panel.sectionTitle}>
        Підтримка
      </h2>

      <div className={panel.card}>
        <h3 className={panel.cardTitle}>Створити тикет</h3>
        <form onSubmit={openTicket} noValidate>
          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="sup-order">
              Номер замовлення
            </label>
            <input
              id="sup-order"
              className={panel.input}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
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

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="sup-files">
              Вкладення
            </label>
            <input
              id="sup-files"
              className={panel.fileInput}
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>

          <button type="submit" className={panel.btnPrimary}>
            Надіслати
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