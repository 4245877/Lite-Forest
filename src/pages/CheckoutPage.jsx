// FILE: src/pages/CheckoutPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './CheckoutPage.module.css';
import { useCart } from '../contexts/CartContext.jsx';
import { useAuth } from '../auth/index.jsx';
import { api } from '../api/client.js';

const SHIPPING = {
  FREE_THRESHOLD: 1599,
  DEFAULT_PRICE: 50,
};

const PAYMENT = {
  PROVIDER: 'google_pay',
  DEPOSIT_KIND: 'deposit',
  FULL_KIND: 'full',
  DEPOSIT_RATE: 0.58,
};

const GOOGLE_PAY = {
  ENVIRONMENT: import.meta.env.VITE_GOOGLE_PAY_ENVIRONMENT || 'TEST',
  MERCHANT_ID: import.meta.env.VITE_GOOGLE_PAY_MERCHANT_ID || '',
  MERCHANT_NAME: import.meta.env.VITE_GOOGLE_PAY_MERCHANT_NAME || 'Lite Forest',
  GATEWAY: import.meta.env.VITE_GOOGLE_PAY_GATEWAY || 'example',
  GATEWAY_MERCHANT_ID:
    import.meta.env.VITE_GOOGLE_PAY_GATEWAY_MERCHANT_ID || 'exampleGatewayMerchantId',
};

const PROMO_CODES = {
  SAVE50: {
    type: 'flat',
    value: 50,
  },
  PERC10: {
    type: 'percent',
    value: 10,
  },
};

const SEARCH_DEBOUNCE_MS = 350;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CITY_SEARCH_STATUS_ID = 'nova-post-city-search-status';
const WAREHOUSE_SEARCH_STATUS_ID = 'nova-post-warehouse-search-status';

const normalizePromoCode = (value) => String(value || '').trim().toUpperCase();

const normalizeSearch = (value) => String(value || '').trim();

const formatUAH = (value) =>
  `${Number(value || 0).toLocaleString('uk-UA')} грн`;

const buildFullName = ({ last_name, first_name, middle_name }) =>
  [last_name, first_name, middle_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

const getErrorId = (fieldName) => `checkout-${fieldName}-error`;

const getDescribedBy = (...ids) => ids.filter(Boolean).join(' ') || undefined;

const getFieldAria = (errors, fieldName, extraDescriptionIds = []) => ({
  'aria-invalid': Boolean(errors[fieldName]) || undefined,
  'aria-describedby': getDescribedBy(
    errors[fieldName] && getErrorId(fieldName),
    ...extraDescriptionIds,
  ),
});

const pickUserField = (user, fieldNames) => {
  const value = fieldNames
    .map((fieldName) => user?.[fieldName])
    .find((item) => String(item || '').trim());

  return String(value || '').trim();
};

const getUserNameParts = (user) => ({
  last_name: pickUserField(user, ['last_name', 'lastName']),
  first_name: pickUserField(user, ['first_name', 'firstName']),
  middle_name: pickUserField(user, ['middle_name', 'middleName']),
});

const getPromoDiscount = ({ promoCode, subtotal }) => {
  const promo = PROMO_CODES[promoCode];

  if (!promo) return 0;

  if (promo.type === 'flat') {
    return Math.min(promo.value, subtotal);
  }

  if (promo.type === 'percent') {
    return Math.round(subtotal * (promo.value / 100));
  }

  return 0;
};

const getShippingCost = ({ shippingMethod, subtotal }) => {
  if (shippingMethod === 'pickup') return 0;
  if (subtotal >= SHIPPING.FREE_THRESHOLD) return 0;

  return SHIPPING.DEFAULT_PRICE;
};

const getPaymentAmount = ({ total, paymentKind }) => {
  if (paymentKind === PAYMENT.FULL_KIND) {
    return Math.round(total * 100) / 100;
  }

  return Math.round(total * PAYMENT.DEPOSIT_RATE * 100) / 100;
};

const validateCheckoutForm = (form) => {
  const nextErrors = {};

  if (!form.last_name.trim()) {
    nextErrors.last_name = 'Вкажіть прізвище отримувача.';
  }

  if (!form.first_name.trim()) {
    nextErrors.first_name = 'Вкажіть ім’я отримувача.';
  }

  if (!form.phone.trim()) {
    nextErrors.phone = 'Вкажіть номер телефону.';
  }

  if (!form.email.trim()) {
    nextErrors.email = 'Вкажіть email.';
  } else if (!EMAIL_PATTERN.test(form.email.trim())) {
    nextErrors.email = 'Вкажіть коректний email.';
  }

  if (form.shipping_method !== 'pickup') {
    if (!form.city.trim()) {
      nextErrors.city = 'Вкажіть місто.';
    }

    if (!form.line.trim()) {
      nextErrors.line =
        form.shipping_method === 'nova_post'
          ? 'Вкажіть відділення або поштомат.'
          : 'Вкажіть адресу доставки.';
    }

    if (form.shipping_method === 'nova_post') {
      if (!form.city_ref) {
        nextErrors.city = 'Оберіть місто зі списку Нової пошти.';
      }

      if (!form.warehouse_ref) {
        nextErrors.line = 'Оберіть відділення або поштомат зі списку.';
      }
    }
  }

  return nextErrors;
};

const isMatchingNovaPostOption = (item, value) =>
  item.label === value || item.description === value;

function useNovaPostSearch({ shippingMethod, city, cityRef, line, setForm }) {
  const [cities, setCities] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setCities([]);
    setWarehouses([]);
    setLoadingCities(false);
    setLoadingWarehouses(false);
    setError('');
  }

  function clearError() {
    setError('');
  }

  useEffect(() => {
    if (shippingMethod !== 'nova_post') return;

    const query = normalizeSearch(city);

    if (query.length < 2) {
      setCities([]);
      setLoadingCities(false);

      setForm((prev) =>
        prev.city_ref ? { ...prev, city_ref: '' } : prev,
      );

      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoadingCities(true);
      setError('');

      try {
        const data = await api.getNovaPostCities(query, {
          signal: controller.signal,
        });

        const nextCities = Array.isArray(data?.items) ? data.items : [];
        setCities(nextCities);

        const selectedCity = nextCities.find((item) =>
          isMatchingNovaPostOption(item, city),
        );

        if (selectedCity) {
          setForm((prev) => {
            if (prev.city !== city || prev.city_ref === selectedCity.ref) {
              return prev;
            }

            return {
              ...prev,
              city_ref: selectedCity.ref,
            };
          });
        }
      } catch (requestError) {
        if (requestError?.name !== 'AbortError') {
          setError('Не вдалося завантажити міста Нової пошти.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCities(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [shippingMethod, city, setForm]);

  useEffect(() => {
    if (shippingMethod !== 'nova_post') return;

    if (!cityRef) {
      setWarehouses([]);
      setLoadingWarehouses(false);
      return;
    }

    const controller = new AbortController();
    const query = normalizeSearch(line);

    const timer = window.setTimeout(async () => {
      setLoadingWarehouses(true);
      setError('');

      try {
        const data = await api.getNovaPostWarehouses(
          {
            cityRef,
            q: query,
          },
          {
            signal: controller.signal,
          },
        );

        const nextWarehouses = Array.isArray(data?.items) ? data.items : [];
        setWarehouses(nextWarehouses);

        const selectedWarehouse = nextWarehouses.find((item) =>
          isMatchingNovaPostOption(item, line),
        );

        if (selectedWarehouse) {
          setForm((prev) => {
            if (
              prev.line !== line ||
              prev.warehouse_ref === selectedWarehouse.ref
            ) {
              return prev;
            }

            return {
              ...prev,
              warehouse_ref: selectedWarehouse.ref,
            };
          });
        }
      } catch (requestError) {
        if (requestError?.name !== 'AbortError') {
          setError('Не вдалося завантажити відділення Нової пошти.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingWarehouses(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [shippingMethod, cityRef, line, setForm]);

  return {
    cities,
    warehouses,
    loadingCities,
    loadingWarehouses,
    error,
    reset,
    clearError,
    setWarehouses,
  };
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, loading } = useAuth();
  const { items, subtotal, totalQty, checkout } = useCart();

  const promoCode = useMemo(
    () => normalizePromoCode(location.state?.promo_code),
    [location.state?.promo_code],
  );

  const [form, setForm] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    phone: '',
    email: '',
    shipping_method: 'pickup',
    city: '',
    city_ref: '',
    line: '',
    warehouse_ref: '',
    comment: '',
    payment_provider: PAYMENT.PROVIDER,
    payment_kind: PAYMENT.DEPOSIT_KIND,
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const novaPost = useNovaPostSearch({
    shippingMethod: form.shipping_method,
    city: form.city,
    cityRef: form.city_ref,
    line: form.line,
    setForm,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', {
        replace: true,
        state: { from: { pathname: '/checkout' } },
      });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const nameParts = getUserNameParts(user);

    setForm((prev) => ({
      ...prev,
      last_name: prev.last_name || nameParts.last_name,
      first_name: prev.first_name || nameParts.first_name,
      middle_name: prev.middle_name || nameParts.middle_name,
      phone: prev.phone || user.phone || user.phone_number || '',
      email: prev.email || user.email || '',
    }));
  }, [user]);

  const promoDiscount = useMemo(
    () => getPromoDiscount({ promoCode, subtotal }),
    [promoCode, subtotal],
  );

  const shipping = useMemo(
    () =>
      getShippingCost({
        shippingMethod: form.shipping_method,
        subtotal,
      }),
    [form.shipping_method, subtotal],
  );

  const total = Math.max(0, subtotal + shipping - promoDiscount);

  const paymentAmount = getPaymentAmount({
    total,
    paymentKind: form.payment_kind,
  });

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  }

  function updateShippingMethod(value) {
    setForm((prev) => ({
      ...prev,
      shipping_method: value,
      city: value === 'pickup' ? '' : prev.city,
      city_ref: '',
      line: '',
      warehouse_ref: '',
    }));

    setErrors((prev) => ({
      ...prev,
      city: '',
      line: '',
    }));

    setSubmitError('');
    novaPost.reset();
  }

  function updateNovaCity(value) {
    const selectedCity = novaPost.cities.find((cityItem) =>
      isMatchingNovaPostOption(cityItem, value),
    );

    setForm((prev) => ({
      ...prev,
      city: value,
      city_ref: selectedCity?.ref || '',
      line: '',
      warehouse_ref: '',
    }));

    setErrors((prev) => ({
      ...prev,
      city: '',
      line: '',
    }));

    setSubmitError('');
    novaPost.clearError();
    novaPost.setWarehouses([]);
  }

  function updateNovaWarehouse(value) {
    const selectedWarehouse = novaPost.warehouses.find((warehouse) =>
      isMatchingNovaPostOption(warehouse, value),
    );

    setForm((prev) => ({
      ...prev,
      line: value,
      warehouse_ref: selectedWarehouse?.ref || '',
    }));

    setErrors((prev) => ({ ...prev, line: '' }));
    setSubmitError('');
    novaPost.clearError();
  }

  function validate() {
    const nextErrors = validateCheckoutForm(form);

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    setSubmitError('');

    const fullName = buildFullName(form);

    const contact = {
      name: fullName,
      last_name: form.last_name.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      phone: form.phone.trim(),
      email: form.email.trim(),
    };

    const shippingAddress = {
      ...contact,
      method: form.shipping_method,
      city: form.shipping_method === 'pickup' ? null : form.city.trim(),
      city_ref:
        form.shipping_method === 'nova_post' ? form.city_ref || null : null,
      line:
        form.shipping_method === 'pickup'
          ? 'Самовивіз'
          : form.line.trim(),
      warehouse_ref:
        form.shipping_method === 'nova_post'
          ? form.warehouse_ref || null
          : null,
      comment: form.comment.trim() || null,
    };

    try {
      const order = await checkout({
        customer: contact,
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
        shipping_method: form.shipping_method,
        payment_provider: form.payment_provider,
        payment_kind: form.payment_kind,
        promo_code: promoCode || undefined,
        notes: form.comment.trim() || undefined,
      });

      navigate('/profile#orders', {
        replace: true,
        state: { orderId: order?.id },
      });
    } catch (checkoutError) {
      setSubmitError(
        checkoutError?.message || 'Не вдалося оформити замовлення.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (!loading && !user)) {
    return (
      <div className={styles.container}>
        <div className={styles.card} role="status" aria-live="polite">
          Перевіряємо сесію…
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Оформлення замовлення</h1>
          <p className={styles.muted}>
            Кошик порожній. Додайте товари перед оформленням.
          </p>
          <Link to="/catalog" className={styles.primaryLink}>
            Перейти до каталогу
          </Link>
        </div>
      </div>
    );
  }

  const lineLabel =
    form.shipping_method === 'nova_post'
      ? 'Відділення або поштомат'
      : 'Адреса доставки';

  const linePlaceholder =
    form.shipping_method === 'nova_post'
      ? 'Наприклад: Відділення №12'
      : 'Вулиця, будинок, квартира';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/cart" className={styles.backLink}>
          ← Повернутись до кошика
        </Link>
        <h1 className={styles.title}>Оформлення замовлення</h1>
        <p className={styles.subtitle}>
          Заповніть контактні дані та спосіб отримання перед підтвердженням.
        </p>
      </div>

      <form className={styles.grid} onSubmit={handleSubmit} noValidate>
        <main className={styles.left}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Контактні дані</h2>

            <div className={styles.fieldsGrid}>
              <label className={styles.field} htmlFor="checkout-last-name">
                <span>Прізвище</span>
                <input
                  id="checkout-last-name"
                  type="text"
                  value={form.last_name}
                  onChange={(event) =>
                    updateField('last_name', event.target.value)
                  }
                  autoComplete="family-name"
                  placeholder="Прізвище"
                  required
                  {...getFieldAria(errors, 'last_name')}
                />
                {errors.last_name && (
                  <small
                    id={getErrorId('last_name')}
                    className={styles.error}
                  >
                    {errors.last_name}
                  </small>
                )}
              </label>

              <label className={styles.field} htmlFor="checkout-first-name">
                <span>Ім’я</span>
                <input
                  id="checkout-first-name"
                  type="text"
                  value={form.first_name}
                  onChange={(event) =>
                    updateField('first_name', event.target.value)
                  }
                  autoComplete="given-name"
                  placeholder="Ім’я"
                  required
                  {...getFieldAria(errors, 'first_name')}
                />
                {errors.first_name && (
                  <small
                    id={getErrorId('first_name')}
                    className={styles.error}
                  >
                    {errors.first_name}
                  </small>
                )}
              </label>

              <label className={styles.field} htmlFor="checkout-middle-name">
                <span>По батькові</span>
                <input
                  id="checkout-middle-name"
                  type="text"
                  value={form.middle_name}
                  onChange={(event) =>
                    updateField('middle_name', event.target.value)
                  }
                  autoComplete="additional-name"
                  placeholder="Необов’язково"
                />
              </label>

              <label className={styles.field} htmlFor="checkout-phone">
                <span>Телефон</span>
                <input
                  id="checkout-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  autoComplete="tel"
                  placeholder="+380..."
                  required
                  {...getFieldAria(errors, 'phone')}
                />
                {errors.phone && (
                  <small id={getErrorId('phone')} className={styles.error}>
                    {errors.phone}
                  </small>
                )}
              </label>

              <label className={styles.fieldWide} htmlFor="checkout-email">
                <span>Email</span>
                <input
                  id="checkout-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  {...getFieldAria(errors, 'email')}
                />
                {errors.email && (
                  <small id={getErrorId('email')} className={styles.error}>
                    {errors.email}
                  </small>
                )}
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Отримання</h2>

            <div className={styles.methodGrid}>
              <label className={styles.methodCard}>
                <input
                  type="radio"
                  name="shipping_method"
                  value="pickup"
                  checked={form.shipping_method === 'pickup'}
                  onChange={(event) =>
                    updateShippingMethod(event.target.value)
                  }
                />
                <span>
                  <strong>Самовивіз</strong>
                  <small>Безкоштовно</small>
                </span>
              </label>

              <label className={styles.methodCard}>
                <input
                  type="radio"
                  name="shipping_method"
                  value="nova_post"
                  checked={form.shipping_method === 'nova_post'}
                  onChange={(event) =>
                    updateShippingMethod(event.target.value)
                  }
                />
                <span>
                  <strong>Нова пошта</strong>
                  <small>
                    {subtotal >= SHIPPING.FREE_THRESHOLD
                      ? 'Безкоштовно'
                      : formatUAH(SHIPPING.DEFAULT_PRICE)}
                  </small>
                </span>
              </label>

              <label className={styles.methodCard}>
                <input
                  type="radio"
                  name="shipping_method"
                  value="courier"
                  checked={form.shipping_method === 'courier'}
                  onChange={(event) =>
                    updateShippingMethod(event.target.value)
                  }
                />
                <span>
                  <strong>Кур’єр</strong>
                  <small>
                    {subtotal >= SHIPPING.FREE_THRESHOLD
                      ? 'Безкоштовно'
                      : formatUAH(SHIPPING.DEFAULT_PRICE)}
                  </small>
                </span>
              </label>
            </div>

            {form.shipping_method !== 'pickup' && (
              <div className={styles.fieldsGrid}>
                <label className={styles.field} htmlFor="checkout-city">
                  <span>Місто</span>

                  {form.shipping_method === 'nova_post' ? (
                    <>
                      <input
                        id="checkout-city"
                        type="text"
                        list="nova-post-cities"
                        value={form.city}
                        onChange={(event) =>
                          updateNovaCity(event.target.value)
                        }
                        autoComplete="address-level2"
                        placeholder="Почніть вводити місто"
                        required
                        {...getFieldAria(errors, 'city', [
                          novaPost.loadingCities
                            ? CITY_SEARCH_STATUS_ID
                            : undefined,
                        ])}
                      />

                      <datalist id="nova-post-cities">
                        {novaPost.cities.map((cityItem) => (
                          <option key={cityItem.ref} value={cityItem.label} />
                        ))}
                      </datalist>

                      {novaPost.loadingCities && (
                        <small
                          id={CITY_SEARCH_STATUS_ID}
                          className={styles.muted}
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          Шукаємо місто…
                        </small>
                      )}
                    </>
                  ) : (
                    <input
                      id="checkout-city"
                      type="text"
                      value={form.city}
                      onChange={(event) =>
                        updateField('city', event.target.value)
                      }
                      autoComplete="address-level2"
                      placeholder="Наприклад: Київ"
                      required
                      {...getFieldAria(errors, 'city')}
                    />
                  )}

                  {errors.city && (
                    <small id={getErrorId('city')} className={styles.error}>
                      {errors.city}
                    </small>
                  )}
                </label>

                <label className={styles.field} htmlFor="checkout-line">
                  <span>{lineLabel}</span>

                  {form.shipping_method === 'nova_post' ? (
                    <>
                      <input
                        id="checkout-line"
                        type="text"
                        list="nova-post-warehouses"
                        value={form.line}
                        onChange={(event) =>
                          updateNovaWarehouse(event.target.value)
                        }
                        autoComplete="street-address"
                        placeholder={
                          form.city_ref
                            ? 'Почніть вводити номер або адресу'
                            : 'Спочатку оберіть місто'
                        }
                        disabled={!form.city_ref}
                        required
                        {...getFieldAria(errors, 'line', [
                          novaPost.loadingWarehouses
                            ? WAREHOUSE_SEARCH_STATUS_ID
                            : undefined,
                        ])}
                      />

                      <datalist id="nova-post-warehouses">
                        {novaPost.warehouses.map((warehouse) => (
                          <option
                            key={warehouse.ref}
                            value={warehouse.label}
                          />
                        ))}
                      </datalist>

                      {novaPost.loadingWarehouses && (
                        <small
                          id={WAREHOUSE_SEARCH_STATUS_ID}
                          className={styles.muted}
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          Шукаємо відділення…
                        </small>
                      )}
                    </>
                  ) : (
                    <input
                      id="checkout-line"
                      type="text"
                      value={form.line}
                      onChange={(event) =>
                        updateField('line', event.target.value)
                      }
                      autoComplete="street-address"
                      placeholder={linePlaceholder}
                      required
                      {...getFieldAria(errors, 'line')}
                    />
                  )}

                  {errors.line && (
                    <small id={getErrorId('line')} className={styles.error}>
                      {errors.line}
                    </small>
                  )}
                </label>

                {novaPost.error && (
                  <small className={styles.error} role="alert">
                    {novaPost.error}
                  </small>
                )}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Оплата і коментар</h2>

            <div className={styles.methodGrid}>
              <label className={styles.methodCard}>
                <input
                  type="radio"
                  name="payment_kind"
                  value={PAYMENT.DEPOSIT_KIND}
                  checked={form.payment_kind === PAYMENT.DEPOSIT_KIND}
                  onChange={(event) => updateField('payment_kind', event.target.value)}
                />
                <span>
                  <strong>Передоплата 58%</strong>
                  <small>Оплата матеріалів через Google Pay</small>
                </span>
              </label>

              <label className={styles.methodCard}>
                <input
                  type="radio"
                  name="payment_kind"
                  value={PAYMENT.FULL_KIND}
                  checked={form.payment_kind === PAYMENT.FULL_KIND}
                  onChange={(event) => updateField('payment_kind', event.target.value)}
                />
                <span>
                  <strong>Повна оплата 100%</strong>
                  <small>Оплата всього замовлення через Google Pay</small>
                </span>
              </label>
            </div>

            <label className={styles.fieldWide} htmlFor="checkout-comment">
              <span>Коментар до замовлення</span>
              <textarea
                id="checkout-comment"
                value={form.comment}
                onChange={(event) =>
                  updateField('comment', event.target.value)
                }
                rows={4}
                placeholder="Наприклад: побажання щодо доставки або друку"
              />
            </label>
          </section>
        </main>

        <aside className={styles.right}>
          <div className={styles.summaryCard}>
            <h2 className={styles.sectionTitle}>Підсумок</h2>

            <div className={styles.itemsList}>
              {items.map((item) => (
                <div key={item.id} className={styles.itemRow}>
                  <img src={item.image} alt={item.name} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.qty} × {formatUAH(item.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.summaryRows}>
              <div>
                <span>Товари ({totalQty} шт.)</span>
                <strong>{formatUAH(subtotal)}</strong>
              </div>

              <div>
                <span>Доставка</span>
                <strong>
                  {shipping === 0 ? 'Безкоштовно' : formatUAH(shipping)}
                </strong>
              </div>

              {promoCode && promoDiscount > 0 && (
                <div>
                  <span>Промокод ({promoCode})</span>
                  <strong>-{formatUAH(promoDiscount)}</strong>
                </div>
              )}

              <div className={styles.totalRow}>
                <span>Разом</span>
                <strong>{formatUAH(total)}</strong>
              </div>

              <div>
                <span>
                  До оплати зараз{' '}
                  {form.payment_kind === PAYMENT.DEPOSIT_KIND ? '(58%)' : '(100%)'}
                </span>
                <strong>{formatUAH(paymentAmount)}</strong>
              </div>
            </div>

            {submitError && (
              <div className={styles.submitError} role="alert">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? 'Оформлюємо…' : 'Підтвердити замовлення'}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}