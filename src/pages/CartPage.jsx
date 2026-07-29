// FILE: src/pages/CartPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './CartPage.module.css';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../auth/index.jsx';
import ProductFilesModal from '../components/product/ProductFilesModal.jsx';
import { selectableModelCount } from '../utils/productModels';
import { normalizeAvailabilityState, getAvailabilityLabel } from '../utils/availability';

// Ни доставки, ни её порога, ни списка промокодов здесь нет, и это осознанно.
// Кошик показывал жёстко зашитые 1599/50 и сам «применял» SAVE50/PERC10 — числа,
// которых сервер не знает: доставку и скидку считает POST /api/orders/quote
// (core/orderPricing.ts), промокоды берутся из env PROMO_CODES и по умолчанию
// выключены. То есть кошик обещал бесплатную доставку и скидку, а оформление
// выставляло другую сумму. Здесь показываем только то, что знаем точно, —
// стоимость самих товаров; доставку, скидку и итог называет сервер на /checkout.
//
// Котировку прямо тут не запрашиваем: /api/orders/quote требует авторизации, а
// кошик доступен и гостю.
const TOAST_TIMEOUT_MS = 2500;
const REMOVE_ANIMATION_MS = 280;
const LOGIN_PATH = '/login';
const CHECKOUT_PATH = '/checkout';
const RECOMMENDED_ITEMS = [
  { id: 'demo-r-1', name: 'Набір фарб, 6 шт.', image: '/assets/products/paint-set.jpg', price: 120 },
  { id: 'demo-r-2', name: 'Пензель для деталей', image: '/assets/products/brush.jpg', price: 60 },
];

const cx = (...c) => c.filter(Boolean).join(' ');
const formatUAH = (n) => `${Number(n || 0).toLocaleString('uk-UA')} грн`;
const normalizePromoCode = (value) => String(value || '').trim().toUpperCase();

export default function CartPage() {
  const { items: cart, inc, dec, remove, setItemSelection, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Строка, для которой открыт выбор деталей («Змінити склад»).
  const [editItem, setEditItem] = useState(null);

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  // Код, который покупатель ввёл и хочет применить. Именно «заявленный», а не
  // «применённый»: проверяет и применяет его сервер при оформлении.
  const [requestedPromo, setRequestedPromo] = useState(null);

  const totalQty = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), TOAST_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [toast]);

  // Локальной проверки кода тут больше нет: списка промокодов клиент не знает
  // (env PROMO_CODES на сервере). Прежняя версия «находила» SAVE50/PERC10 и
  // рисовала скидку, которой при оформлении не было, и наоборот — отвечала
  // «Промокод не знайдено» на реально настроенный код. Код просто передаём в
  // /checkout, где его подтвердит (или отвергнет) серверная котировка.
  function requestPromo(e) {
    e.preventDefault();
    const code = normalizePromoCode(promoCode);
    if (!code) return;
    setRequestedPromo(code);
    setPromoOpen(false);
    setPromoCode('');
    setToast('Промокод буде застосовано при оформленні');
  }

  function clearPromo() {
    setRequestedPromo(null);
    setToast('Промокод прибрано');
  }

  const [removingId, setRemovingId] = useState(null);
  function handleRemove(id) {
    setRemovingId(id);
    setTimeout(() => {
      remove(id);
      setRemovingId(null);
      setToast('Товар видалено з кошика');
    }, REMOVE_ANIMATION_MS);
  }

  function handleCheckout() {
    if (!user) {
      navigate(LOGIN_PATH, {
        replace: false,
        state: { from: { pathname: CHECKOUT_PATH } },
      });
      return;
    }

    navigate(CHECKOUT_PATH, {
      replace: false,
      state: {
        promo_code: requestedPromo ?? null,
      },
    });
  }

  return (
    <div className={styles.container}>
      {/* Область для озвучення коротких повідомлень */}
      <div className={styles.srOnly} aria-live="polite">
        {toast}
      </div>

      {/* Ни «резерва на 15 хвилин», ни прогресса до бесплатной доставки здесь
          больше нет. Резерв был чистой выдумкой интерфейса: таймер тикал в
          useState, никакой брони на сервере под ним не было (печать под заказ —
          резервировать нечего), и по истечении кошик пугал покупателя потерей
          товаров, которых он не терял. Прогресс-бар обещал бесплатную доставку с
          порога 1599 ₴, которого сервер не знает. */}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Ваш кошик</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.left}>
          <h2 className={styles.sectionTitle}>Склад замовлення</h2>

          {cart.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Ваш кошик порожній.</p>
              <Link to="/catalog" className={styles.linkBtn}>
                Повернутись до каталогу
              </Link>
            </div>
          ) : (
            <ul className={styles.cartList}>
              {cart.map((item) => {
                const productHref = `/products/${encodeURIComponent(
                  item.product_slug ?? item.product_id ?? item.id
                )}`;

                // Для made-to-order label пустой — статус в корзине не показываем.
                const availabilityLabel = getAvailabilityLabel(
                  normalizeAvailabilityState(
                    item.availabilityState ?? item.availability ?? item.attributes?.availability,
                  ),
                );

                return (
                  <li key={item.id} className={cx(styles.cartItem, removingId === item.id && styles.removing)}>
                    <img src={item.image} alt={item.name} className={styles.thumb} loading="lazy" decoding="async" />
                    <div className={styles.itemBody}>
                      <Link to={productHref} className={styles.itemTitle}>
                        {item.name}
                      </Link>

                      <div className={styles.qtyRow}>
                        <div className={styles.qtyControls} role="group" aria-label={`Кількість для ${item.name}`}>
                          <button
                            type="button"
                            aria-label="Зменшити кількість"
                            onClick={() => dec(item.id)}
                            className={styles.qtyBtn}
                            disabled={item.qty <= 1}
                          >
                            −
                          </button>
                          <span className={styles.qtyValue} aria-label={`Кількість: ${item.qty}`}>
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label="Збільшити кількість"
                            onClick={() => inc(item.id)}
                            className={styles.qtyBtn}
                          >
                            +
                          </button>
                        </div>

                        <div className={styles.itemPrice}>
                          {item.qty} × {formatUAH(item.price)} = <strong>{formatUAH(item.qty * item.price)}</strong>
                        </div>
                      </div>

                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className={styles.linkAction}
                          aria-label={`Видалити ${item.name} з кошика`}
                          disabled={removingId === item.id}
                        >
                          Видалити
                        </button>
                        {selectableModelCount(item.models) > 1 ? (
                          <>
                            <span className={styles.partsInfo}>
                              Обрано {item.selected_model_keys?.length ?? selectableModelCount(item.models)}{' '}
                              з {selectableModelCount(item.models)} деталей
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditItem(item)}
                              className={styles.linkAction}
                              aria-label={`Змінити деталі для ${item.name}`}
                            >
                              Змінити деталі
                            </button>
                          </>
                        ) : availabilityLabel ? (
                          <span className={styles.leadTime}>{availabilityLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Рекомендації */}
          <section className={styles.recoSection} aria-label="Рекомендації">
            <h3>З цим часто купують</h3>
            <div className={styles.recoRow}>
              {RECOMMENDED_ITEMS.map((r) => (
                <div key={r.id} className={styles.recoCard}>
                  <img src={r.image} alt={r.name} loading="lazy" decoding="async" />
                  <div className={styles.recoInfo}>
                    <div className={styles.recoTitle}>{r.name}</div>
                    <div className={styles.recoPrice}>{formatUAH(r.price)}</div>
                    <Link to="/catalog" className={styles.addBtn} aria-label={`Переглянути каталог: ${r.name}`}>
                      До каталогу
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className={styles.right} aria-label="Підсумок замовлення">
          <div className={styles.summaryCard}>
            <h3>Сума замовлення</h3>

            <div className={styles.row}>
              <span>Товари ({totalQty} шт.)</span>
              <span>{formatUAH(subtotal)}</span>
            </div>

            <div className={styles.totalRow}>
              <strong>Проміжний підсумок</strong>
              <strong>{formatUAH(subtotal)}</strong>
            </div>

            <p className={styles.summaryNote}>
              Вартість доставки та знижку за промокодом порахуємо на кроці
              оформлення — там ви побачите остаточну суму до підтвердження
              замовлення.
            </p>

            <div className={styles.promoLinkWrap}>
              {requestedPromo ? (
                <div className={styles.row}>
                  <span>Промокод ({requestedPromo})</span>
                  <button type="button" className={styles.promoLink} onClick={clearPromo}>
                    Прибрати
                  </button>
                </div>
              ) : !promoOpen ? (
                <button
                  type="button"
                  className={styles.promoLink}
                  onClick={() => setPromoOpen(true)}
                >
                  У мене є промокод
                </button>
              ) : (
                <form onSubmit={requestPromo} className={styles.promoForm} noValidate>
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Введіть промокод"
                    aria-label="Промокод"
                    autoComplete="off"
                  />
                  <button type="submit" className={styles.applyBtn}>
                    Застосувати
                  </button>
                </form>
              )}
            </div>

            <button type="button" className={styles.checkoutBtn} disabled={cart.length === 0} onClick={handleCheckout}>
              Перейти до оформлення
            </button>

            <div className={styles.trustBlock}>
              <div className={styles.trustRow}>
                <div className={styles.trustIcons} aria-hidden="true">
                  <svg width="36" height="24" viewBox="0 0 24 24" focusable="false">
                    <rect x="1" y="4" width="22" height="14" rx="2" stroke="currentColor" fill="none" />
                  </svg>
                  <svg width="36" height="24" viewBox="0 0 24 24" focusable="false">
                    <circle cx="12" cy="8" r="2" stroke="currentColor" fill="none" />
                  </svg>
                </div>
                <div className={styles.trustText}>
                  <Link to="/legal#safe-deal" className={styles.trustLink}>
                    <strong>Безпечна угода</strong>
                  </Link>
                  <br />
                  <Link to="/legal#shipping-returns" className={styles.trustLink}>
                    Умови доставки та повернення
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Коротке повідомлення */}
      {toast && (
        <div className={styles.toast} aria-hidden="true">
          {toast}
        </div>
      )}

      <ProductFilesModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onConfirm={(keys) => {
          if (editItem) setItemSelection(editItem.id, keys);
          setEditItem(null);
          setToast('Склад замовлення оновлено');
        }}
        models={editItem?.models ?? []}
        initialSelected={editItem?.selected_model_keys ?? null}
        fallbackImage={editItem?.image ?? ''}
        productName={editItem?.name ?? ''}
        confirmLabel="Зберегти"
      />
    </div>
  );
}