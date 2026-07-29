import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth';
import {
  GUEST_SCOPE,
  loadThread,
  ownerScopeOf,
  removeThread,
  saveThread,
  storageKeyFor,
} from '../../utils/productQuestionStorage';
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
//
// Ключ хранения включает владельца (id аккаунта либо 'guest'): переписка вместе с
// thread_token лежит в localStorage, а он общий для всех, кто сидит за этим
// браузером. По ключу «только товар» следующий пользователь того же браузера
// открывал чужой тред и продолжал переписку от своего имени. Разные namespace'ы
// этого не дают, а PURGE_PREFIX + purgeProductQuestionThreads() дочищают всё при
// логауте (см. auth/index.jsx).

const ACK_TEXT =
  'Дякуємо! Ваше запитання надіслано майстру. Ми відповімо вам тут найближчим часом.';

// Бекенд принял сообщение, но сервис «Звернення» не настроен (delivered:false) —
// это dev-режим. Обещать ответ майстра тут нельзя: сообщение никуда не ушло.
const UNDELIVERED_TEXT =
  'Повідомлення прийнято локально, але сервіс звернень зараз не підключений — майстер його не побачить.';

const EMPTY_HINT =
  'Поставте перше запитання про цей товар — майстер відповість вам у цьому чаті.';

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

  const ownerScope = ownerScopeOf(user);

  const storageKey = useMemo(
    () => storageKeyFor(ownerScope, productId, productSku),
    [ownerScope, productId, productSku],
  );

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [threadToken, setThreadToken] = useState(null);
  const [messages, setMessages] = useState([]);

  const textareaRef = useRef(null);
  const listEndRef = useRef(null);

  // Загружаем сохранённую переписку при смене товара или владельца.
  //
  // Гостевой тред при входе в аккаунт переносим в namespace пользователя: это тот
  // же человек, и терять начатый диалог из-за логина незачем. Переносим только в
  // пустой аккаунтный тред, чтобы не затереть собственную переписку пользователя.
  useEffect(() => {
    let loaded = loadThread(storageKey);

    if (ownerScope !== GUEST_SCOPE && !loaded.threadId && !loaded.messages.length) {
      const guestKey = storageKeyFor(GUEST_SCOPE, productId, productSku);
      const guestThread = loadThread(guestKey);

      if (guestThread.threadId || guestThread.messages.length) {
        loaded = guestThread;
        saveThread(storageKey, guestThread.threadId, guestThread.threadToken, guestThread.messages);
        removeThread(guestKey);
      }
    }

    setThreadId(loaded.threadId);
    setThreadToken(loaded.threadToken);
    setMessages(loaded.messages);
    setError('');
  }, [storageKey, ownerScope, productId, productSku]);

  // Сохраняем переписку при любом изменении.
  useEffect(() => {
    if (!messages.length && !threadId) return;
    saveThread(storageKey, threadId, threadToken, messages);
  }, [storageKey, threadId, threadToken, messages]);

  // Поллинг ответов оператора из сервиса «Звернення» по thread_id — обратная
  // сторона переписки. Как только у диалога есть thread_id (после первого
  // отправленного вопроса или после перезагрузки из localStorage), раз в 5 с
  // запрашиваем свежие сообщения и вливаем операторские ответы в чат. Пауза,
  // когда вкладка скрыта, — не поллим фоном без нужды.
  // Без токена поллить нечего: бекенд ответит 403. Такое бывает у переписок,
  // сохранённых до введения токенов, — их дочитать нельзя, продолжение диалога
  // начнёт новый тред.
  useEffect(() => {
    if (!threadId || !threadToken) return undefined;

    let cancelled = false;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await api.getProductQuestionThread(threadId, threadToken);
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
  }, [threadId, threadToken]);

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
      // thread_id без thread_token бекенд не примет — начнёт новый тред.
      thread_id: threadId || undefined,
      thread_token: threadToken || undefined,
      product_id: productId ?? null,
      product_name: productName || null,
      product_sku: productSku || null,
      product_slug: productSlug || null,
      product_url: typeof window !== 'undefined' ? window.location.href : null,
      customer_name: user?.name || null,
      customer_contact: user?.email || user?.phone || null,
      client_sent_at: sentAt,
    }),
    [threadId, threadToken, productId, productName, productSku, productSlug, user],
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
        if (res?.thread_token && res.thread_token !== threadToken) setThreadToken(res.thread_token);

        setMessages((prev) => {
          const updated = prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m));
          // Однократное системное подтверждение для нового диалога. Обещать
          // ответ майстра можно только если сообщение реально доставлено:
          // delivered:false — это dev-заглушка без сервиса «Звернення».
          const hasAck = updated.some((m) => m.author === 'system');
          if (!hasAck) {
            updated.push({
              id: nextLocalId(),
              author: 'system',
              text: res?.delivered === false ? UNDELIVERED_TEXT : ACK_TEXT,
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
    [sending, threadId, threadToken, buildPayload],
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
