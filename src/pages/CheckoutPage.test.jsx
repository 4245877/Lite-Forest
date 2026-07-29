// Регрессионные тесты оформления заказа (Vitest + React Testing Library).
// Запуск: pnpm test
//
// Проверяется одно: покупатель не может оформить заказ по сумме, которой он не
// видел. Отсюда все кейсы — устаревшая котировка на экране, submit во время
// пересчёта (в т.ч. по Enter), и расхождение цены между котировкой и
// оформлением (409 PRICE_CHANGED).
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// vi.hoisted — потому что vi.mock поднимается наверх файла, и фабрика мока не
// может ссылаться на обычные const'ы, объявленные ниже.
//
// Значения ОБЯЗАНЫ быть стабильными между вызовами: useCart() дёргается на
// каждый рендер, и если возвращать новые литералы, orderItems окажется новым
// массивом → пересчитается useMemo(quotePayload) → эффект котировки → setState →
// рендер → и так вечно (настоящий CartProvider всё это мемоизирует).
const { quoteOrder, checkout, cartValue, authValue } = vi.hoisted(() => {
  const items = [
    {
      id: 'line-1',
      product_id: 'prod-1',
      name: 'Ваза',
      price: 500,
      qty: 1,
      models: [],
      selected_model_keys: [],
      files: [],
    },
  ];
  const orderItems = [{ product_id: 'prod-1', variant_id: null, qty: 1, files: [] }];
  const quoteOrderFn = vi.fn();
  const checkoutFn = vi.fn();

  return {
    quoteOrder: quoteOrderFn,
    checkout: checkoutFn,
    cartValue: { items, orderItems, totalQty: 1, checkout: checkoutFn },
    authValue: { user: { id: 1, email: 'buyer@example.com' }, loading: false },
  };
});

vi.mock('../api/client.js', () => ({
  api: {
    quoteOrder,
    // Самовывоз не ходит в Новую пошту, но модуль импортируется целиком.
    getNovaPostCities: vi.fn().mockResolvedValue([]),
    getNovaPostWarehouses: vi.fn().mockResolvedValue([]),
    purchaseCustomPrintRequest: vi.fn(),
  },
}));

vi.mock('../auth/index.jsx', () => ({
  useAuth: () => authValue,
}));

vi.mock('../contexts/CartContext.jsx', () => ({
  useCart: () => cartValue,
}));

// Роутер настоящий (MemoryRouter), а не мок: useNavigate/useLocation/Link внутри
// него работают штатно, а мок react-router-dom через importActual в паре с
// top-level await намертво вешает загрузку модуля.
const { MemoryRouter } = await import('react-router-dom');
const CheckoutPage = (await import('./CheckoutPage.jsx')).default;

const QUOTE = {
  subtotal: 500,
  discount_total: 0,
  shipping_total: 0,
  tax_total: 0,
  grand_total: 500,
  payment_required_amount: 290,
  shipping_options: { pickup: 0 },
};

// Отложенный промис — чтобы поймать состояние «котировка ещё считается».
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>,
  );

// Форма самовывоза: минимум обязательных полей, чтобы дойти до submit.
// Поля страница предзаполняет из аккаунта, поэтому именно set, а не type: без
// clear() набранное дописывалось бы к готовому значению (email превращался в
// невалидный, и submit молча блокировался валидацией).
async function setField(user, label, value) {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  await user.type(field, value);
}

async function fillForm(user) {
  await setField(user, /Прізвище/i, 'Шевченко');
  await setField(user, /Ім’я/i, 'Тарас');
  await setField(user, /Телефон/i, '+380501234567');
  await setField(user, /Email/i, 'buyer@example.com');
}

const submitButton = () => screen.getByRole('button', { name: /Підтвердити замовлення/i });

// Итог («Разом») — не единственное место, где встречается сумма: та же цифра
// стоит в строке товара и в подытоге. Поэтому читаем именно строку итога, а не
// ищем текст по всей странице.
const totalValue = () =>
  screen.getByText('Разом').closest('div')?.querySelector('strong')?.textContent?.trim();

beforeEach(() => {
  quoteOrder.mockReset();
  checkout.mockReset();
  quoteOrder.mockResolvedValue(QUOTE);
  checkout.mockResolvedValue({ id: 'order-1' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('котировка и submit', () => {
  test('пока котировка считается, сумм нет и кнопка заблокирована', async () => {
    const pending = deferred();
    quoteOrder.mockReturnValue(pending.promise);

    renderPage();

    // Суммы не показываем вовсе — вместо них прочерк.
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(/Рахуємо вартість…/i)).toBeInTheDocument();

    pending.resolve(QUOTE);

    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  test('пересчёт обесценивает старую котировку: суммы исчезают, submit снова заблокирован', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(totalValue()).toBe('500 грн');

    // Смена способа доставки — начинается пересчёт.
    const pending = deferred();
    quoteOrder.mockReturnValue(pending.promise);
    await user.click(screen.getByRole('radio', { name: /Нова пошта/i }));

    // Ключевое: старая сумма НЕ висит на экране как действительная, и оформить нельзя.
    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(totalValue()).toBe('—');

    pending.resolve({ ...QUOTE, shipping_total: 100, grand_total: 600 });
    await waitFor(() => expect(submitButton()).toBeEnabled());
    expect(totalValue()).toBe('600 грн');
  });

  test('Enter в поле формы не оформляет заказ, пока идёт пересчёт', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(submitButton()).toBeEnabled());
    await fillForm(user);

    // Пересчёт запускаем сменой типа оплаты, а НЕ способа доставки: «Нова пошта»
    // делает форму невалидной (нужны місто/відділення), и тогда submit не
    // дошёл бы до заказа в любом случае — тест прошёл бы и без защиты, ничего не
    // проверяя. При самовывозе форма остаётся валидной, и единственное, что
    // держит заказ, — проверка !totalsReady в handleSubmit.
    const pending = deferred();
    quoteOrder.mockReturnValue(pending.promise);
    await user.click(screen.getByRole('radio', { name: /Повна оплата 100%/i }));
    await waitFor(() => expect(submitButton()).toBeDisabled());

    // Кнопка задизейблена, но submit формы прилетает и с Enter в текстовом поле.
    await user.type(screen.getByLabelText(/Телефон/i), '{Enter}');

    expect(checkout).not.toHaveBeenCalled();

    // А после котировки тот же Enter заказ оформляет — значит блокировал именно
    // пересчёт, а не сломанная форма.
    pending.resolve({ ...QUOTE, payment_required_amount: 500 });
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await user.type(screen.getByLabelText(/Телефон/i), '{Enter}');
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(1));
  });

  test('submit формы во время пересчёта не создаёт заказ (проверка в handleSubmit)', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await waitFor(() => expect(submitButton()).toBeEnabled());
    await fillForm(user);

    const pending = deferred();
    quoteOrder.mockReturnValue(pending.promise);
    await user.click(screen.getByRole('radio', { name: /Повна оплата 100%/i }));
    await waitFor(() => expect(submitButton()).toBeDisabled());

    // Событие submit напрямую — минуя задизейбленную кнопку.
    //
    // Через Enter сюда не пройти: по спецификации HTML неявная отправка формы
    // кликает default-кнопку, а клик по disabled-кнопке ничего не делает. То есть
    // Enter упирается в саму кнопку, и проверку !totalsReady внутри handleSubmit
    // так не проверить — тест зеленел бы и без неё. Но кнопка — не единственный
    // способ отправить форму (requestSubmit, отправка из кода), поэтому защита
    // стоит и в обработчике, и вот она.
    fireEvent.submit(container.querySelector('form'));

    expect(checkout).not.toHaveBeenCalled();

    pending.resolve({ ...QUOTE, payment_required_amount: 500 });
    await waitFor(() => expect(submitButton()).toBeEnabled());

    // Та же отправка после котировки заказ создаёт.
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(1));
  });

  test('без котировки (сервер отдал ошибку) заказ отправить нельзя', async () => {
    const user = userEvent.setup();
    quoteOrder.mockRejectedValue(new Error('quote failed'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Не вдалося розрахувати вартість/i)).toBeInTheDocument(),
    );

    expect(submitButton()).toBeDisabled();

    await user.type(screen.getByLabelText(/Телефон/i), '{Enter}');
    expect(checkout).not.toHaveBeenCalled();
  });

  test('оформление отправляет подтверждённую сумму (expected_total)', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(submitButton()).toBeEnabled());
    await fillForm(user);
    await user.click(submitButton());

    await waitFor(() => expect(checkout).toHaveBeenCalled());
    // Сервер обязан получить сумму, которую видел покупатель, — иначе он не сможет
    // отличить «подтверждено» от «цена уехала».
    expect(checkout.mock.calls[0][0].expected_total).toBe(500);
  });
});

describe('информация об индивидуальном изготовлении', () => {
  // В витрине статус made-to-order намеренно без текста (utils/availability.js),
  // поэтому примечание на оформлении — единственное место, где покупатель
  // узнаёт про индивидуальное изготовление и согласование сроков.
  test('примечание видно в «Підсумку» и стоит перед кнопкой подтверждения', async () => {
    renderPage();

    const note = screen.getByText(/Усі вироби виготовляються індивідуально під ваше замовлення/i);
    expect(note).toHaveTextContent(/Терміни виготовлення узгодимо з вами після підтвердження/i);

    // Сноска — над CTA, а не после него.
    expect(
      note.compareDocumentPosition(submitButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('цена изменилась между котировкой и оформлением', () => {
  test('409 PRICE_CHANGED: заказ не создан, расхождение показано явно, котировка перезапрошена', async () => {
    const user = userEvent.setup();

    const priceChanged = new Error('Order total changed since the quote was issued');
    priceChanged.status = 409;
    priceChanged.code = 'PRICE_CHANGED';
    priceChanged.details = { expected_total: 500, actual_total: 650 };
    checkout.mockRejectedValue(priceChanged);

    renderPage();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await fillForm(user);

    // После отказа котировка перезапрашивается — сервер отдаёт уже новую сумму.
    quoteOrder.mockResolvedValue({ ...QUOTE, grand_total: 650, payment_required_amount: 377 });

    await user.click(submitButton());

    // Заказа нет: сервер его не создал, покупатель остался на оформлении.
    await waitFor(() =>
      expect(screen.getByText(/Вартість замовлення змінилася/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Підтвердити замовлення/i })).toBeInTheDocument();

    // «Было/стало» — явно, а не общим текстом ошибки.
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('500 грн');
    expect(notice).toHaveTextContent('650 грн');
    expect(notice).toHaveTextContent(/Замовлення не створено/i);

    // На экране — новая сумма, и подтвердить её покупатель должен сам.
    await waitFor(() => expect(totalValue()).toBe('650 грн'));
    expect(checkout).toHaveBeenCalledTimes(1);
  });

  test('повторное подтверждение после изменения цены уходит с новой суммой', async () => {
    const user = userEvent.setup();

    const priceChanged = new Error('changed');
    priceChanged.status = 409;
    priceChanged.code = 'PRICE_CHANGED';
    priceChanged.details = { expected_total: 500, actual_total: 650 };
    checkout.mockRejectedValueOnce(priceChanged);

    renderPage();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await fillForm(user);

    quoteOrder.mockResolvedValue({ ...QUOTE, grand_total: 650, payment_required_amount: 377 });
    await user.click(submitButton());

    await waitFor(() => expect(totalValue()).toBe('650 грн'));
    await waitFor(() => expect(submitButton()).toBeEnabled());

    checkout.mockResolvedValue({ id: 'order-2' });
    await user.click(submitButton());

    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2));
    expect(checkout.mock.calls[1][0].expected_total).toBe(650);
  });

  test('прочие отказы сервера показываются как ошибка оформления, а не как смена цены', async () => {
    const user = userEvent.setup();

    const failure = new Error('[Cart] Checkout failed (500 Internal Server Error)');
    failure.status = 500;
    failure.code = null;
    checkout.mockRejectedValue(failure);

    renderPage();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await fillForm(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByText(/Checkout failed/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Вартість замовлення змінилася/i)).not.toBeInTheDocument();
  });
});
