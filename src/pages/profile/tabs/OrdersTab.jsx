import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import panel from '../components/ProfileTabPanel.module.css';
import styles from './OrdersTab.module.css';
import { readError } from '../utils/readError';
import assetUrl from '../../../utils/assetUrl';

const PAYABLE_STATUS = 'pending_payment';
const REVIEW_STATUS = 'delivered';
const CANCELLABLE_STATUSES = new Set(['new', 'pending', 'processing']);

const STATUS_TITLES = {
  new: 'Нове',
  pending: 'Очікує підтвердження',
  pending_payment: 'Очікує оплати',
  processing: 'В обробці',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  cancelled: 'Скасовано',
  canceled: 'Скасовано',
};

const PAYMENT_STATUS_TITLES = {
  pending: 'Оплата очікується',
  processing: 'Оплата обробляється',
  paid_deposit: 'Передоплату внесено',
  paid_full: 'Оплачено повністю',
  failed: 'Оплата не пройшла',
};

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
});

const cx = (...classes) => classes.filter(Boolean).join(' ');

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const getStatusClass = (status) => {
  if (status === 'pending_payment') return styles.statusPendingPayment;
  if (status === 'new' || status === 'pending' || status === 'processing') {
    return styles.statusProcessing;
  }
  if (status === 'shipped') return styles.statusShipped;
  if (status === 'delivered') return styles.statusDelivered;
  if (status === 'cancelled' || status === 'canceled') return styles.statusCancelled;

  return styles.statusNeutral;
};

const encode = (value) => encodeURIComponent(String(value));

const isExternalUrl = (url) => /^https?:\/\//i.test(String(url || ''));

const getOrderId = (order) =>
  order?.id ?? order?._id ?? order?.orderId ?? order?.orderNumber ?? order?.number ?? '';

const getOrderNumber = (order) =>
  order?.number ?? order?.orderNumber ?? order?.code ?? getOrderId(order);

const getOrderDate = (order) => {
  const value = order?.date || order?.createdAt || order?.created_at || '';

  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatTotal = (total) => {
  if (typeof total === 'number' && Number.isFinite(total)) {
    return moneyFormatter.format(total);
  }

  return total || '';
};

const getOrderTotal = (order) =>
  order?.grand_total ??
  order?.grandTotal ??
  order?.total ??
  order?.amount ??
  '';

const getTrackingUrl = (order) =>
  order?.trackingUrl ||
  order?.trackingURL ||
  order?.tracking?.url ||
  order?.delivery?.trackingUrl ||
  order?.shipping?.trackingUrl ||
  order?.shipment?.trackingUrl ||
  '';

const getTrackingNumber = (order) =>
  order?.ttn ||
  order?.trackingNumber ||
  order?.trackingNo ||
  order?.trackingCode ||
  order?.tracking?.number ||
  order?.delivery?.ttn ||
  order?.delivery?.trackingNumber ||
  order?.shipping?.ttn ||
  order?.shipping?.trackingNumber ||
  order?.shipment?.ttn ||
  order?.shipment?.trackingNumber ||
  order?.novaPost?.ttn ||
  '';

const getPaymentUrl = (order, orderId) =>
  order?.paymentUrl ||
  order?.payment?.url ||
  order?.invoiceUrl ||
  (orderId ? `/orders/${encode(orderId)}/payment` : '');

const getSupportUrl = (orderId) => (orderId ? `/support/orders/${encode(orderId)}` : '/support');

const getReviewUrl = (orderId) => (orderId ? `/orders/${encode(orderId)}/review` : '');

const getTrackingHref = (order, orderId) => {
  const trackingUrl = getTrackingUrl(order);
  const trackingNumber = getTrackingNumber(order);

  if (trackingUrl) return trackingUrl;

  if (trackingNumber && orderId) {
    return `/orders/${encode(orderId)}/tracking?ttn=${encode(trackingNumber)}`;
  }

  if (trackingNumber) {
    return `/tracking?ttn=${encode(trackingNumber)}`;
  }

  return '';
};

const getOrderProducts = (order) => {
  if (Array.isArray(order?.items)) return order.items;
  if (Array.isArray(order?.products)) return order.products;
  if (Array.isArray(order?.orderItems)) return order.orderItems;
  if (Array.isArray(order?.lines)) return order.lines;
  return [];
};

const getProductName = (item) =>
  item?.name ||
  item?.title ||
  item?.productName ||
  item?.product?.name ||
  item?.product?.title ||
  item?.variant?.name ||
  item?.variant?.title ||
  '';

const getProductImage = (item) => {
  const raw =
    item?.image_url ||
    item?.imageUrl ||
    item?.image ||
    item?.thumbnail ||
    item?.thumbnailUrl ||
    item?.product?.image_url ||
    item?.product?.imageUrl ||
    item?.product?.image ||
    item?.product?.thumbnail ||
    item?.product?.thumbnailUrl ||
    '';

  return assetUrl(raw);
};

const getProductId = (item) =>
  item?.product_id ||
  item?.productId ||
  item?.product?.id ||
  '';

const getProductUrl = (item) => {
  const directUrl =
    item?.product_url ||
    item?.productUrl ||
    item?.product?.url ||
    '';

  if (directUrl) return directUrl;

  const productId = getProductId(item);
  return productId ? `/products/${encode(productId)}` : '';
};

const getItemQuantity = (item) => {
  const quantity = Number(item?.quantity ?? item?.qty ?? item?.count ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const getItemsCount = (order, products) => {
  const directValue =
    order?.itemsCount ??
    order?.productsCount ??
    order?.items_count ??
    order?.products_count ??
    order?.quantityTotal ??
    order?.quantity_total;

  const directCount = Number(directValue);

  if (Number.isFinite(directCount) && directCount > 0) {
    return directCount;
  }

  return products.reduce((sum, item) => sum + getItemQuantity(item), 0);
};

const pluralGoods = (count) => {
  const number = Math.abs(Number(count));
  const lastTwo = number % 100;
  const last = number % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} товарів`;
  if (last === 1) return `${count} товар`;
  if (last >= 2 && last <= 4) return `${count} товари`;

  return `${count} товарів`;
};

const ActionLink = ({ to, children, className, ...props }) => {
  if (!to) return null;

  if (isExternalUrl(to)) {
    return (
      <a href={to} className={className} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className} {...props}>
      {children}
    </Link>
  );
};

const OrdersTab = () => {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [repeatingId, setRepeatingId] = useState('');

  const load = useCallback(async (next = null) => {
    setLoading(true);
    setErr('');

    try {
      const url = new URL('/api/me/orders', window.location.origin);
      url.searchParams.set('limit', '10');
      if (next) url.searchParams.set('cursor', next);

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(await readError(res));

      const data = await res.json();

      setItems((prev) => (next ? [...prev, ...(data?.items || [])] : data?.items || []));
      setCursor(data?.nextCursor || null);
    } catch (e) {
      setErr(e.message || 'Не вдалося завантажити замовлення');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const repeatOrder = async (id) => {
    if (!id) return;

    const orderId = String(id);

    setRepeatingId(orderId);
    setErr('');

    try {
      const res = await fetch(`/api/orders/${encode(orderId)}/repeat`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));
    } catch (e) {
      setErr(e.message || 'Не вдалося повторити замовлення');
    } finally {
      setRepeatingId('');
    }
  };

  const cancelOrder = async (id) => {
    if (!id) return;

    const orderId = String(id);

    setCancellingId(orderId);
    setErr('');

    try {
      const res = await fetch(`/api/orders/${encode(orderId)}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) throw new Error(await readError(res));

      setItems((prev) =>
        prev.map((order) =>
          String(getOrderId(order)) === orderId
            ? {
                ...order,
                status: 'cancelled',
                statusTitle: 'Скасовано',
              }
            : order
        )
      );
    } catch (e) {
      setErr(e.message || 'Не вдалося скасувати замовлення');
    } finally {
      setCancellingId('');
    }
  };

  return (
    <section className={cx(panel.section, styles.orders)} aria-labelledby="orders-tab-heading">
      <div className={styles.header}>
        <div>
          <h2 id="orders-tab-heading" className={cx(panel.sectionTitle, styles.title)}>
            Замовлення
          </h2>

          <p className={styles.subtitle}>
            Тут можна переглянути деталі, оплатити, відстежити або вирішити питання щодо
            замовлення.
          </p>
        </div>
      </div>

      {err && (
        <div className={panel.serverError} role="alert" aria-live="assertive">
          {err}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className={styles.skeletonMain} aria-hidden />
      ) : items.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Замовлень ще немає</div>

          <div className={styles.emptyText}>Переглянь каталог та додай перше замовлення.</div>

          <Link to="/catalog" className={panel.btnPrimary}>
            До каталогу
          </Link>
        </div>
      ) : (
        <>
          <ul className={styles.ordersList}>
            {items.map((order, index) => {
              const orderId = getOrderId(order);
              const orderNumber = getOrderNumber(order) || `Замовлення ${index + 1}`;
              const orderDate = getOrderDate(order);
              const orderTotal = formatTotal(getOrderTotal(order));
              const status = normalizeStatus(order.status);
              const paymentStatus = normalizeStatus(order.payment_status);
              const paymentRequiredAmount = Number(order.payment_required_amount || 0);
              const products = getOrderProducts(order);
              const itemsCount = getItemsCount(order, products);

              const firstProduct =
                products.find((product) => getProductName(product) || getProductUrl(product)) ||
                null;

              const firstProductName =
                (firstProduct ? getProductName(firstProduct) : '') ||
                order?.firstProductName ||
                order?.firstProductTitle ||
                '';

              const firstProductUrl =
                (firstProduct ? getProductUrl(firstProduct) : '') ||
                order?.firstProductUrl ||
                '';

              const thumbnails = products
                .map((product) => ({
                  src: getProductImage(product),
                  name: getProductName(product),
                  to: getProductUrl(product),
                }))
                .filter((product) => product.src)
                .slice(0, 4);

              const trackingNumber = getTrackingNumber(order);
              const trackingHref = getTrackingHref(order, orderId);
              const paymentHref = getPaymentUrl(order, orderId);
              const supportHref = getSupportUrl(orderId);
              const reviewHref = getReviewUrl(orderId);

              const canTrack = Boolean(trackingHref || trackingNumber);
              const canPay = status === PAYABLE_STATUS;
              const canCancel = CANCELLABLE_STATUSES.has(status);
              const canReview = status === REVIEW_STATUS;

              const orderIdString = String(orderId || '');
              const isCancelling = cancellingId === orderIdString;
              const isRepeating = repeatingId === orderIdString;

              return (
                <li key={orderId || index} className={styles.orderItem}>
                  <div className={styles.orderHead}>
                    <strong>№ {orderNumber}</strong>

                    {orderDate && <span className={styles.orderDate}>{orderDate}</span>}
                  </div>

                  <div className={styles.orderComposition}>
                    {thumbnails.length > 0 && (
                      <div className={styles.orderThumbs} aria-label="Товари в замовленні">
                        {thumbnails.map((product, thumbIndex) => {
                          const image = (
                            <img
                              src={product.src}
                              alt={
                                product.name ? `Товар: ${product.name}` : 'Товар із замовлення'
                              }
                              className={styles.orderThumb}
                              loading="lazy"
                            />
                          );

                          return product.to ? (
                            <ActionLink
                              key={`${product.src}-${thumbIndex}`}
                              to={product.to}
                              className={styles.orderThumbLink}
                              aria-label={
                                product.name
                                  ? `Перейти до товару: ${product.name}`
                                  : 'Перейти до товару'
                              }
                            >
                              {image}
                            </ActionLink>
                          ) : (
                            <span
                              key={`${product.src}-${thumbIndex}`}
                              className={styles.orderThumbLink}
                            >
                              {image}
                            </span>
                          );
                        })}

                        {itemsCount > thumbnails.length && (
                          <span className={styles.orderThumbMore}>
                            +{itemsCount - thumbnails.length}
                          </span>
                        )}
                      </div>
                    )}

                    <div className={styles.orderSummary}>
                      <span className={styles.orderSummaryCount}>
                        {itemsCount > 0 ? pluralGoods(itemsCount) : 'Склад замовлення'}
                      </span>

                      <span className={styles.orderSummaryText}>
                        {firstProductName ? (
                          firstProductUrl ? (
                            <Link to={firstProductUrl} className={styles.orderProductLink}>
                              {itemsCount > 1 ? `Перше: ${firstProductName}` : firstProductName}
                            </Link>
                          ) : (
                            itemsCount > 1 ? `Перше: ${firstProductName}` : firstProductName
                          )
                        ) : (
                          'Детальний склад доступний у замовленні'
                        )}
                      </span>

                      {trackingNumber && (
                        <span className={styles.orderTrackingNumber}>ТТН: {trackingNumber}</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.orderFoot}>
                    {orderTotal && <span className={styles.orderSum}>{orderTotal}</span>}

                    {order.status && (
                      <span className={cx(styles.status, getStatusClass(status))}>
                        {order.statusTitle || STATUS_TITLES[status] || order.status}
                      </span>
                    )}

                    {order.payment_status && (
                      <span className={styles.status}>
                        {PAYMENT_STATUS_TITLES[paymentStatus] || order.payment_status}
                      </span>
                    )}

                    {paymentRequiredAmount > 0 && (
                      <span className={styles.orderSum}>
                        До оплати: {formatTotal(paymentRequiredAmount)}
                      </span>
                    )}

                    <div className={styles.orderActions}>
                      {canPay && (
                        <ActionLink
                          to={paymentHref}
                          className={cx(styles.btnSmall, styles.btnSmallPrimary)}
                          aria-label={`Оплатити замовлення ${orderNumber}`}
                        >
                          Оплатити
                        </ActionLink>
                      )}

                      <Link
                        to={orderId ? `/orders/${encode(orderId)}` : '/orders'}
                        className={styles.btnSmall}
                      >
                        Деталі
                      </Link>

                      {canTrack && (
                        <ActionLink
                          to={trackingHref}
                          className={styles.btnSmall}
                          aria-label={`Відстежити замовлення ${orderNumber}`}
                        >
                          Відстежити
                        </ActionLink>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          className={cx(styles.btnSmall, styles.btnDanger)}
                          onClick={() => cancelOrder(orderId)}
                          disabled={isCancelling}
                          aria-busy={isCancelling ? 'true' : undefined}
                        >
                          {isCancelling ? 'Скасування...' : 'Скасувати'}
                        </button>
                      )}

                      {canReview && (
                        <Link
                          to={reviewHref}
                          className={styles.btnSmall}
                          aria-label={`Залишити відгук до замовлення ${orderNumber}`}
                        >
                          Залишити відгук
                        </Link>
                      )}

                      <Link
                        to={supportHref}
                        className={styles.btnSmall}
                        aria-label={`Проблема із замовленням ${orderNumber}`}
                      >
                        Допомога
                      </Link>

                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => repeatOrder(orderId)}
                        disabled={isRepeating}
                        aria-busy={isRepeating ? 'true' : undefined}
                      >
                        {isRepeating ? 'Повторення...' : 'Повторити'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {cursor && (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={panel.btnPrimary}
                onClick={() => load(cursor)}
                disabled={loading}
                aria-busy={loading ? 'true' : undefined}
              >
                {loading ? 'Завантаження...' : 'Показати ще'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default OrdersTab;