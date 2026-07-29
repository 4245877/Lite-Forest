// Тесты изоляции переписки мини-чата «Питання майстру» на уровне компонента
// (Vitest + React Testing Library). Запуск: pnpm test
//
// Модульные тесты самого хранилища лежат в utils/productQuestionStorage.test.js.
// Здесь проверяется то, ради чего всё делалось: что при смене пользователя
// компонент действительно не показывает чужую переписку и не подставляет чужой
// thread_token в исходящий запрос.
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const sendProductQuestion = vi.fn();
const getProductQuestionThread = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    sendProductQuestion: (...args) => sendProductQuestion(...args),
    getProductQuestionThread: (...args) => getProductQuestionThread(...args),
  },
}));

// useAuth мокаем, а не поднимаем реального провайдера: провайдер на монтировании
// ходит в /api/me и тянет за собой роутер, а проверяем мы не его.
let currentUser = null;
vi.mock('../../auth', () => ({
  useAuth: () => ({ user: currentUser }),
}));

const { GUEST_SCOPE, loadThread, ownerScopeOf, saveThread, storageKeyFor } = await import(
  '../../utils/productQuestionStorage.js'
);
const ProductQuestionChat = (await import('./ProductQuestionChat.jsx')).default;

const PRODUCT = { productId: 'prod-1', productName: 'Ваза', productSku: 'SKU-1' };

const msg = (id, text) => ({
  id,
  author: 'customer',
  text,
  created_at: '2026-07-15T10:00:00.000Z',
  status: 'sent',
});

beforeEach(() => {
  currentUser = null;
  sendProductQuestion.mockReset();
  getProductQuestionThread.mockReset();
  getProductQuestionThread.mockResolvedValue({ messages: [] });
  sendProductQuestion.mockResolvedValue({
    thread_id: 'thread-new',
    thread_token: 'token-new',
    delivered: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const openChat = async (user) => {
  await user.click(screen.getByRole('button', { name: /Питання майстру/i }));
};

test('переписка Алисы не видна Бобу после смены аккаунта', async () => {
  const user = userEvent.setup();

  // У Алисы есть сохранённый тред на этом товаре.
  saveThread(storageKeyFor(ownerScopeOf({ id: 1 }), PRODUCT.productId, PRODUCT.productSku),
    'thread-alice',
    'token-alice',
    [msg('m1', 'Секретне питання Аліси')],
  );

  currentUser = { id: 1, name: 'Alice' };
  const { unmount } = render(<ProductQuestionChat {...PRODUCT} />);
  await openChat(user);
  expect(await screen.findByText('Секретне питання Аліси')).toBeInTheDocument();

  // Логин под другим аккаунтом в том же браузере.
  unmount();
  currentUser = { id: 2, name: 'Bob' };
  render(<ProductQuestionChat {...PRODUCT} />);
  await openChat(user);

  await waitFor(() => {
    expect(screen.queryByText('Секретне питання Аліси')).not.toBeInTheDocument();
  });
  // Боб видит пустой чат, а не чужой диалог.
  expect(screen.getByText(/Поставте перше запитання/i)).toBeInTheDocument();
});

test('Боб не отправляет thread_token Алисы: его первый вопрос открывает новый тред', async () => {
  const user = userEvent.setup();

  saveThread(storageKeyFor(ownerScopeOf({ id: 1 }), PRODUCT.productId, PRODUCT.productSku),
    'thread-alice',
    'token-alice',
    [msg('m1', 'Питання Аліси')],
  );

  currentUser = { id: 2, name: 'Bob' };
  render(<ProductQuestionChat {...PRODUCT} />);
  await openChat(user);

  await user.type(screen.getByRole('textbox'), 'Питання Боба');
  await user.click(screen.getByRole('button', { name: /Надіслати/i }));

  await waitFor(() => expect(sendProductQuestion).toHaveBeenCalled());

  const payload = sendProductQuestion.mock.calls[0][0];
  // Ключевое: чужой токен/тред не подставляются — иначе Боб дописал бы в диалог Алисы.
  expect(payload.thread_token).toBeUndefined();
  expect(payload.thread_id).toBeUndefined();
  expect(payload.message).toBe('Питання Боба');

  // Тред Алисы не тронут.
  const alice = loadThread(
    storageKeyFor(ownerScopeOf({ id: 1 }), PRODUCT.productId, PRODUCT.productSku),
  );
  expect(alice.threadId).toBe('thread-alice');
  expect(alice.threadToken).toBe('token-alice');
});

test('гостевой тред не виден залогиненному пользователю с собственной перепиской', async () => {
  const user = userEvent.setup();

  saveThread(storageKeyFor(GUEST_SCOPE, PRODUCT.productId, PRODUCT.productSku),
    'thread-guest',
    'token-guest',
    [msg('g1', 'Питання гостя')],
  );
  saveThread(storageKeyFor(ownerScopeOf({ id: 5 }), PRODUCT.productId, PRODUCT.productSku),
    'thread-user',
    'token-user',
    [msg('u1', 'Питання власника акаунта')],
  );

  currentUser = { id: 5, name: 'Eve' };
  render(<ProductQuestionChat {...PRODUCT} />);
  await openChat(user);

  expect(await screen.findByText('Питання власника акаунта')).toBeInTheDocument();
  expect(screen.queryByText('Питання гостя')).not.toBeInTheDocument();
});

test('гостевой тред переносится в аккаунт при логине, если своей переписки ещё нет', async () => {
  const user = userEvent.setup();

  const guestKey = storageKeyFor(GUEST_SCOPE, PRODUCT.productId, PRODUCT.productSku);
  saveThread(guestKey, 'thread-guest', 'token-guest', [msg('g1', 'Питання гостя')]);

  // Тот же человек логинится — терять начатый им же диалог незачем.
  currentUser = { id: 9, name: 'Newbie' };
  render(<ProductQuestionChat {...PRODUCT} />);
  await openChat(user);

  expect(await screen.findByText('Питання гостя')).toBeInTheDocument();

  await waitFor(() => {
    const moved = loadThread(
      storageKeyFor(ownerScopeOf({ id: 9 }), PRODUCT.productId, PRODUCT.productSku),
    );
    expect(moved.threadId).toBe('thread-guest');
  });

  // Из гостевого namespace тред уехал — следующий гость его не увидит.
  expect(loadThread(guestKey).threadId).toBeNull();
});
