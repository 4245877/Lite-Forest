import React, { useEffect, useState } from 'react';
import panel from '../components/ProfileTabPanel.module.css';
import { readError } from '../utils/readError';

const ReturnsTab = () => {
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');

      try {
        const res = await fetch('/api/returns', { credentials: 'include' });
        if (!res.ok) throw new Error(await readError(res));
        const j = await res.json();
        setList(j?.items || []);
      } catch (e) {
        setErr(e.message || 'Помилка завантаження');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submitReturn = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');

    try {
      const fd = new FormData();
      fd.append('orderId', orderId);
      fd.append('reason', reason);
      [...files].forEach((f) => fd.append('photos', f));

      const res = await fetch('/api/returns', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (!res.ok) throw new Error(await readError(res));

      setMsg('Заявку подано');
      setOrderId('');
      setReason('');
      setFiles([]);
    } catch (e) {
      setErr(e.message || 'Не вдалося подати заявку');
    }
  };

  return (
    <section className={panel.section} aria-labelledby="returns-tab-heading">
      <h2 id="returns-tab-heading" className={panel.sectionTitle}>
        Повернення і гарантія
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
        <h3 className={panel.cardTitle}>Подати заявку</h3>
        <form onSubmit={submitReturn} noValidate>
          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="ret-order">
              Номер замовлення
            </label>
            <input
              id="ret-order"
              className={panel.input}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
          </div>

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="ret-reason">
              Причина
            </label>
            <textarea
              id="ret-reason"
              className={panel.input}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className={panel.inputGroup}>
            <label className={panel.inputLabel} htmlFor="ret-files">
              Фото
            </label>
            <input
              id="ret-files"
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
        <h3 className={panel.cardTitle}>Статуси заяв</h3>
        {loading ? (
          <div className={panel.skeletonMain} aria-hidden />
        ) : list.length === 0 ? (
          <p className={panel.cardText}>Немає заяв.</p>
        ) : (
          <ul className={panel.list}>
            {list.map((r) => (
              <li key={r.id} className={panel.listItem}>
                {r.id}: {r.order} — {r.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ReturnsTab;