import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth';
import './ProductQuestionChat.css';

// Мини-чат «Питання майстру» для страницы товара.
//
// Кнопка-лаунчер открывает компактное окно (десктоп — карточка справа снизу,
// мобайл — нижняя панель). Клиент пишет первый вопрос по товару, сообщение
// уходит через api.sendProductQuestion → бекенд → сервіс «Звернення»
// (192.168.0.139). Переписка сохраняется в localStorage по товару, поэтому
// клиент может продолжить диалог на этой же странице.
//
// Первый этап — только текст. Фото/файлы/вложения не передаются.

const ACK_TEXT =
  'Дякуємо! Ваше запитання надіслано майстру. Ми відповімо вам тут найближчим часом.';

const EMPTY_HINT =
  'Поставте перше запитання про цей товар — майстер відповість вам у цьому чаті.';

function storageKeyFor(productId, productSku) {
  const id = productId ?? productSku ?? 'unknown';
  return `lf:pq:${id}`;
}

function loadThread(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { threadId: null, messages: [] };
    const parsed = JSON.parse(raw);
    return {
      threadId: typeof parsed?.threadId === 'string' ? parsed.threadId : null,
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch {
    return { threadId: null, messages: [] };
  }
}

function saveThread(key, threadId, messages) {
  try {
    // Храним только доставленные сообщения: незавершённые (sending) и упавшие
    // (failed) — это транзиентные состояния текущей сессии.
    const persistable = messages.filter((m) => m.status !== 'failed' && m.status !== 'sending');
    window.localStorage.setItem(key, JSON.stringify({ threadId, messages: persistable }));
  } catch {
    // приватный режим / переполнение — переписка просто не сохранится, не критично
  }
}

const formatTime = (iso) => {
  try {
    return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    return '';
  }
};

let messageCounter = 0;
const nextLocalId = () => `local-${Date.now()}-${++messageCounter}`;

// Вливает ответы оператора из сервиса «Звернення» в локальную переписку.
// Клиентские и системные сообщения не трогаем (они уже есть локально); из
// сервиса берём только операторские и добавляем по стабильному id (msg-…), без
// дублей, затем сортируем всё по времени. Возвращаем прежний массив, если
// ничего нового нет, — тогда React не делает лишний ре-рендер.
function mergeOperatorMessages(prev, serverMessages) {
  if (!Array.isArray(serverMessages) || serverMessages.length === 0) return prev;

  const known = new Set(prev.map((m) => m.id));
  const incoming = serverMessages
    .filter((m) => m && m.author === 'operator' && m.id && !known.has(m.id))
    .map((m) => ({
      id: m.id,
      author: 'operator',
      text: m.text,
      created_at: m.created_at || new Date().toISOString(),
      status: 'sent',
    }));

  if (incoming.length === 0) return prev;

  return [...prev, ...incoming].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
}

export default function ProductQuestionChat({
  productId = null,
  productName = '',
  productSku = '',
  productSlug = '',
}) {
  const { user } = useAuth();

  const storageKey = useMemo(
    () => storageKeyFor(productId, productSku),
    [productId, productSku],
  );

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);

  const textareaRef = useRef(null);
  const listEndRef = useRef(null);

  // Загружаем сохранённую переписку при смене товара.
  useEffect(() => {
    const { threadId: savedThread, messages: savedMessages } = loadThread(storageKey);
    setThreadId(savedThread);
    setMessages(savedMessages);
    setError('');
  }, [storageKey]);

  // Сохраняем переписку при любом изменении.
  useEffect(() => {
    if (!messages.length && !threadId) return;
    saveThread(storageKey, threadId, messages);
  }, [storageKey, threadId, messages]);

  // Поллинг ответов оператора из сервиса «Звернення» по thread_id — обратная
  // сторона переписки. Как только у диалога есть thread_id (после первого
  // отправленного вопроса или после перезагрузки из localStorage), раз в 5 с
  // запрашиваем свежие сообщения и вливаем операторские ответы в чат. Пауза,
  // когда вкладка скрыта, — не поллим фоном без нужды.
  useEffect(() => {
    if (!threadId) return undefined;

    let cancelled = false;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await api.getProductQuestionThread(threadId);
        if (cancelled) return;
        setMessages((prev) => mergeOperatorMessages(prev, res?.messages));
      } catch {
        // тихо игнорируем — попробуем на следующем тике
      }
    };

    poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [threadId]);

  // Прокрутка к последнему сообщению.
  useEffect(() => {
    if (open) listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  // Фокус на поле ввода при открытии.
  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => textareaRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  // Закрытие по Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const buildPayload = useCallback(
    (messageText, sentAt) => ({
      message: messageText,
      thread_id: threadId || undefined,
      product_id: productId ?? null,
      product_name: productName || null,
      product_sku: productSku || null,
      product_slug: productSlug || null,
      product_url: typeof window !== 'undefined' ? window.location.href : null,
      customer_name: user?.name || null,
      customer_contact: user?.email || user?.phone || null,
      client_sent_at: sentAt,
    }),
    [threadId, productId, productName, productSku, productSlug, user],
  );

  // Отправка сообщения. retryId задаётся при повторе упавшего сообщения —
  // тогда переиспользуем его id вместо создания нового пузыря.
  const sendMessage = useCallback(
    async (messageText, retryId = null) => {
      const trimmed = messageText.trim();
      if (!trimmed || sending) return;

      const sentAt = new Date().toISOString();
      const msgId = retryId || nextLocalId();

      setError('');
      setSending(true);
      setMessages((prev) => {
        if (retryId) {
          return prev.map((m) => (m.id === msgId ? { ...m, status: 'sending' } : m));
        }
        return [
          ...prev,
          { id: msgId, author: 'customer', text: trimmed, created_at: sentAt, status: 'sending' },
        ];
      });

      try {
        const res = await api.sendProductQuestion(buildPayload(trimmed, sentAt));
        const nextThread = res?.thread_id || threadId;
        if (nextThread && nextThread !== threadId) setThreadId(nextThread);

        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m));
          // Однократное системное подтверждение для нового диалога.
          const hasAck = updated.some((m) => m.author === 'system');
          if (!hasAck) {
            updated.push({
              id: nextLocalId(),
              author: 'system',
              text: ACK_TEXT,
              created_at: new Date().toISOString(),
              status: 'sent',
            });
          }
          return updated;
        });
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'failed' } : m)));
        setError('Не вдалося надіслати повідомлення. Перевірте звʼязок і спробуйте ще раз.');
      } finally {
        setSending(false);
      }
    },
    [sending, threadId, buildPayload],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    const value = text;
    if (!value.trim() || sending) return;
    setText('');
    sendMessage(value);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  };

  const chat = (
    <>
      <div
        className={`pq-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <section
        className={`pq-panel ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Питання майстру"
        aria-hidden={!open}
      >
        <header className="pq-head">
          <div className="pq-head-text">
            <strong>Питання майстру</strong>
            {productName ? <span className="pq-head-sub">{productName}</span> : null}
          </div>
          <button
            type="button"
            className="pq-close"
            onClick={() => setOpen(false)}
            aria-label="Закрити чат"
          >
            ×
          </button>
        </header>

        <div className="pq-body">
          {messages.length === 0 ? (
            <p className="pq-empty">{EMPTY_HINT}</p>
          ) : (
            <ul className="pq-messages">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={`pq-msg pq-msg--${message.author} ${
                    message.status === 'failed' ? 'is-failed' : ''
                  }`}
                >
                  <div className="pq-bubble">
                    <span className="pq-bubble-text">{message.text}</span>
                    <span className="pq-bubble-meta">
                      {message.status === 'sending' && message.author === 'customer'
                        ? 'Надсилання…'
                        : formatTime(message.created_at)}
                    </span>
                  </div>

                  {message.status === 'failed' ? (
                    <button
                      type="button"
                      className="pq-retry"
                      onClick={() => sendMessage(message.text, message.id)}
                      disabled={sending}
                    >
                      Не доставлено — повторити
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div ref={listEndRef} />
        </div>

        {error ? (
          <div className="pq-error" role="alert">
            {error}
          </div>
        ) : null}

        <form className="pq-form" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            className="pq-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишіть запитання про цей товар…"
            rows={1}
            maxLength={4000}
            disabled={sending}
          />
          <button
            type="submit"
            className="pq-send"
            disabled={sending || !text.trim()}
            aria-label="Надіслати"
          >
            {sending ? '…' : '➤'}
          </button>
        </form>
      </section>
    </>
  );

  return (
    <div className="pq-root">
      <button
        type="button"
        className="btn-primary pq-launcher"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Поставити запитання майстру
      </button>

      {typeof document !== 'undefined' ? createPortal(chat, document.body) : null}
    </div>
  );
}
