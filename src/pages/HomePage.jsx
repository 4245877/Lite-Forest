// src/pages/HomePage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import { api } from '../api/client';
import { useCart } from '../contexts/CartContext';
import styles from './HomePage.module.css';

const CATEGORY_DECOR = [
  { icon: '📦', bgColor: 'var(--color-sand)' },
  { icon: '🏠', bgColor: 'var(--color-cream)' },
  { icon: '🧰', bgColor: '#eef6ff' },
  { icon: '✨', bgColor: '#f6f3ff' },
  { icon: '🧩', bgColor: '#f5f8ec' },
  { icon: '🎁', bgColor: '#fff6e8' },
];

const BENEFITS = [
  {
    icon: '🧾',
    title: 'Актуальний каталог',
    description: 'Ціни, наявність і зображення підтягуються з backend, а не з локальних заглушок.',
  },
  {
    icon: '🛒',
    title: 'Зручне замовлення',
    description: 'Товари можна одразу додати в кошик і перейти до оформлення без зайвих кроків.',
  },
  {
    icon: '🧰',
    title: 'Практичні рішення',
    description: 'Добираємо товари для дому, майстерні, зберігання та щоденного використання.',
  },
  {
    icon: '💬',
    title: 'Підтримка після покупки',
    description: 'Допомагаємо з питаннями щодо замовлення, комплектації та використання.',
  },
];

function getLocalizedText(value, fallback = '') {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || fallback;
  }

  if (value && typeof value === 'object') {
    const text = [value.uk, value.ua, value.en, value.ru, ...Object.values(value)]
      .find((item) => typeof item === 'string' && item.trim());

    return typeof text === 'string' ? text.trim() : fallback;
  }

  return fallback;
}

function normalizeProducts(data) {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function pickMainImage(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const firstImage = images[0];

  if (typeof firstImage === 'string') return firstImage;

  return (
    firstImage?.url ||
    firstImage?.thumb_url ||
    product?.image_url ||
    product?.main_image_url ||
    product?.image?.url ||
    null
  );
}

function getProductRouteKey(product) {
  const key =
    product?.sku ??
    product?.slug ??
    product?.path ??
    product?.url_key ??
    product?.id ??
    product?._id ??
    product?.product_id;

  return key ? String(key) : '';
}

function getAvailabilityState(product) {
  const attrs = product?.attributes ?? {};
  const stock = Number(product?.stock ?? attrs.stock ?? 0);
  const explicitAvailability = String(attrs.availability ?? '').trim().toLowerCase();
  const leadDays = Number(attrs.lead_time_days ?? product?.lead_time_days ?? 0);

  if (stock > 0 || explicitAvailability === 'in-stock' || explicitAvailability === 'in_stock') {
    return 'in-stock';
  }

  if (
    explicitAvailability === 'made-to-order' ||
    explicitAvailability === 'made_to_order' ||
    explicitAvailability === 'preorder' ||
    explicitAvailability === 'pre-order' ||
    leadDays > 0
  ) {
    return 'made-to-order';
  }

  return 'out-of-stock';
}

function getAvailabilityLabel(product, state) {
  const attrs = product?.attributes ?? {};
  const leadDays = Number(attrs.lead_time_days ?? product?.lead_time_days ?? 0);

  if (state === 'in-stock') return 'Є в наявності';
  if (state === 'made-to-order') {
    return leadDays > 0 ? `Під замовлення • ${leadDays} дн.` : 'Під замовлення';
  }
  return 'Тимчасово недоступно';
}

function getAttributeBadges(product) {
  const attrs = product?.attributes ?? {};
  const badges = [];

  const materials = normalizeTextList(attrs.materials ?? attrs.material ?? product?.materials);
  const printType = attrs.print_type || attrs.printTech || '';
  const finish = attrs.finish || '';
  const scale = attrs.scale || '';

  if (materials.length) badges.push(materials.slice(0, 2).join(', '));
  if (printType) badges.push(String(printType).toUpperCase());
  if (finish) badges.push(String(finish));
  if (scale) badges.push(`Масштаб ${scale}`);

  return badges.slice(0, 3);
}

function toNumberOrUndefined(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

const HomePage = () => {
  const { addItem } = useCart();
  const sliderRef = useRef(null);

  const [allCategories, setAllCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState('');
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [email, setEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState({ type: 'idle', message: '' });
  const [isNewsletterSubmitting, setIsNewsletterSubmitting] = useState(false);
  const [cartNotice, setCartNotice] = useState('');

  const categoriesBySlug = useMemo(
    () => new Map(allCategories.map((category) => [String(category.slug), category])),
    [allCategories],
  );

  const visibleCategories = useMemo(() => {
    const visible = allCategories.filter((item) => item && !item.is_hidden);
    const roots = visible.filter((item) => !item.parent_slug);
    return (roots.length ? roots : visible).slice(0, 6);
  }, [allCategories]);

  const visibleCategoriesNormalized = useMemo(() => {
    return visibleCategories
      .filter((category) => category?.slug)
      .map((category) => ({
        ...category,
        displayName: getLocalizedText(category?.name, String(category.slug)),
      }));
  }, [visibleCategories]);

  const getCategoryLabelBySlug = useCallback(
    (slug) => {
      const category = categoriesBySlug.get(slug);
      if (!category) return '';
      return getLocalizedText(category.name, slug);
    },
    [categoriesBySlug],
  );

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function loadHomePage() {
      setIsLoadingCategories(true);
      setIsLoadingProducts(true);
      setCategoriesError('');
      setProductsError('');

      const [categoriesResult, productsResult] = await Promise.allSettled([
        api.getCategories({ signal: controller.signal }),
        api.listProducts('', 8, { sortBy: 'new' }, { signal: controller.signal }),
      ]);

      if (!alive) return;

      if (categoriesResult.status === 'fulfilled') {
        const rows = Array.isArray(categoriesResult.value) ? categoriesResult.value : [];
        setAllCategories(rows.filter(Boolean));
        setCategoriesError('');
      } else if (categoriesResult.reason?.name !== 'AbortError') {
        setAllCategories([]);
        setCategoriesError(categoriesResult.reason?.message || 'Не вдалося завантажити категорії');
      }

      if (productsResult.status === 'fulfilled') {
        setProducts(normalizeProducts(productsResult.value).slice(0, 8));
        setProductsError('');
      } else if (productsResult.reason?.name !== 'AbortError') {
        setProducts([]);
        setProductsError(productsResult.reason?.message || 'Не вдалося завантажити новинки');
      }

      setIsLoadingCategories(false);
      setIsLoadingProducts(false);
    }

    loadHomePage().catch((error) => {
      if (!alive || error?.name === 'AbortError') return;
      setCategoriesError(error?.message || 'Не вдалося завантажити категорії');
      setProductsError(error?.message || 'Не вдалося завантажити новинки');
      setIsLoadingCategories(false);
      setIsLoadingProducts(false);
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!cartNotice) return undefined;

    const timeoutId = window.setTimeout(() => {
      setCartNotice('');
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [cartNotice]);

  const handleAddToCart = useCallback(
    (product) => {
      const productName =
        String(product?.name ?? product?.title ?? product?.name_uk ?? 'Товар').trim() || 'Товар';

      addItem({
        id: product?.id ?? product?._id ?? product?.product_id ?? product?.sku,
        product_id: product?.product_id ?? product?.id ?? product?._id ?? product?.sku,
        sku: product?.sku,
        name: productName,
        title: productName,
        price: toNumberOrUndefined(product?.price ?? product?.price_min_printed ?? product?.base_price),
        image: pickMainImage(product),
        image_url: pickMainImage(product),
        images: Array.isArray(product?.images) ? product.images : [],
      });

      setCartNotice(`«${productName}» додано до кошика`);
    },
    [addItem],
  );

  const handleSlideChange = useCallback((direction) => {
    const sliderNode = sliderRef.current;
    if (!sliderNode) return;

    const delta = Math.max(sliderNode.clientWidth * 0.85, 280);
    sliderNode.scrollBy({
      left: direction === 'next' ? delta : -delta,
      behavior: 'smooth',
    });
  }, []);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();

    const nextEmail = email.trim();
    if (!nextEmail) return;

    setIsNewsletterSubmitting(true);
    setNewsletterState({ type: 'idle', message: '' });

    api.subscribeNewsletter({ email: nextEmail })
      .then(() => {
        setNewsletterState({
          type: 'success',
          message: 'Дякуємо. Підписку оформлено.',
        });
        setEmail('');
      })
      .catch((error) => {
        const raw = String(error?.message || '');
        let message = 'Не вдалося оформити підписку. Спробуйте трохи пізніше.';

        if (/404|501/.test(raw)) {
          message = 'Розсилку тимчасово недоступно. Спробуйте пізніше.';
        } else if (/409/.test(raw)) {
          message = 'Цей email уже підписаний.';
        }

        setNewsletterState({
          type: 'error',
          message,
        });
      })
      .finally(() => {
        setIsNewsletterSubmitting(false);
      });
  };

  return (
    <div className={styles.homePage}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>🌿 Продумані товари для дому й майстерні</span>
            <h1 className={styles.heroTitle}>
              Ласкаво просимо до <span className={styles.titleAccent}>Lite Forest</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Обирайте товари для дому, зберігання, організації простору та щоденного використання.
              Актуальний каталог, реальні ціни та зручне замовлення — в одному місці.
            </p>
            <div className={styles.heroActions}>
              <Link to="/catalog" className={styles.ctaButton}>
                <span>Перейти до каталогу</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link to="/about" className={styles.secondaryButton}>
                Дізнатися більше
              </Link>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroIcon} aria-hidden="true">🌍</div>
            <div className={styles.floatingElements}>
              <div className={styles.floatingElement} aria-hidden="true">🌿</div>
              <div className={styles.floatingElement} aria-hidden="true">♻️</div>
              <div className={styles.floatingElement} aria-hidden="true">🌱</div>
            </div>
          </div>
        </div>
        <div className={styles.heroDecoration}></div>
      </section>

      <section className={styles.categories}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Популярні категорії</h2>
            <p className={styles.sectionSubtitle}>Переходьте до актуальних розділів каталогу</p>
          </div>

          {isLoadingCategories && !visibleCategories.length ? (
            <p>Завантаження категорій…</p>
          ) : categoriesError && !visibleCategories.length ? (
            <p className={`${styles.statusMessage} ${styles.statusMessageError}`}>Помилка: {categoriesError}</p>
          ) : (
            <div className={styles.categoriesGrid}>
              {visibleCategoriesNormalized.map((category, index) => {
                const decor = CATEGORY_DECOR[index % CATEGORY_DECOR.length];

                return (
                  <Link
                    key={category.slug}
                    to={`/catalog?cats=${encodeURIComponent(category.slug)}`}
                    className={styles.categoryCard}
                    style={{ '--category-bg': decor.bgColor }}
                  >
                    <div className={styles.categoryIcon} aria-hidden="true">{decor.icon}</div>
                    <h3 className={styles.categoryName}>{category.displayName}</h3>
                    <p className={styles.categorySlogan}>Переглянути товари категорії</p>
                    <div className={styles.categoryArrow}>→</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className={styles.newProducts}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Новинки</h2>
            <p className={styles.sectionSubtitle}>Останні додані товари з каталогу</p>
          </div>

          {cartNotice ? (
            <p
              role="status"
              aria-live="polite"
              className={`${styles.statusMessage} ${styles.statusMessageSuccess} ${styles.cartNotice}`}
            >
              {cartNotice}
            </p>
          ) : null}

          {isLoadingProducts && !products.length ? (
            <p>Завантаження новинок…</p>
          ) : productsError && !products.length ? (
            <p className={`${styles.statusMessage} ${styles.statusMessageError}`}>Помилка: {productsError}</p>
          ) : products.length > 0 ? (
            <div className={styles.slider}>
              {products.length > 1 ? (
                <button
                  type="button"
                  className={`${styles.sliderBtn} ${styles.sliderBtnPrev}`}
                  onClick={() => handleSlideChange('prev')}
                  aria-label="Попередні товари"
                >
                  ←
                </button>
              ) : null}

              <div ref={sliderRef} className={styles.sliderContainer}>
                <div className={styles.sliderTrack}>
                  {products.map((product, index) => {
                    const routeKey = getProductRouteKey(product) || String(product?.id ?? index);
                    const productId = product.id ?? product._id ?? product.product_id ?? product.sku;
                    const productName =
                      String(product?.name ?? product?.title ?? product?.name_uk ?? 'Товар').trim() || 'Товар';
                    const productUrl = `/products/${encodeURIComponent(routeKey)}`;
                    const categorySlugs = Array.isArray(product?.categories)
                      ? product.categories.map((value) => String(value).trim()).filter(Boolean)
                      : [];
                    const primaryCategorySlug =
                      categorySlugs.find((slug) => categoriesBySlug.has(slug)) || '';
                    const availabilityState = getAvailabilityState(product);

                    return (
                      <div key={routeKey} className={styles.slideItem}>
                        <ProductCard
                          productId={productId}
                          image={pickMainImage(product)}
                          title={
                            <Link to={productUrl} className={styles.productTitleLink}>
                              {productName}
                            </Link>
                          }
                          titleText={productName}
                          price={toNumberOrUndefined(product?.price ?? product?.price_min_printed ?? product?.base_price)}
                          categoryLabel={primaryCategorySlug ? getCategoryLabelBySlug(primaryCategorySlug) : ''}
                          availabilityLabel={getAvailabilityLabel(product, availabilityState)}
                          availabilityState={availabilityState}
                          attributesList={getAttributeBadges(product)}
                          onAddToCart={() => handleAddToCart(product)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {products.length > 1 ? (
                <button
                  type="button"
                  className={`${styles.sliderBtn} ${styles.sliderBtnNext}`}
                  onClick={() => handleSlideChange('next')}
                  aria-label="Наступні товари"
                >
                  →
                </button>
              ) : null}
            </div>
          ) : (
            <div className={styles.slider}>
              <div className={styles.sliderContainer}>
                <div className={styles.emptyState}>
                  Новинок поки немає. Перегляньте повний каталог.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={styles.benefits}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Чому обирають нас?</h2>
            <p className={styles.sectionSubtitle}>Головне, що важливо для зручного замовлення</p>
          </div>
          <div className={styles.benefitsGrid}>
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className={styles.benefitCard}>
                <div className={styles.benefitIcon} aria-hidden="true">{benefit.icon}</div>
                <h3 className={styles.benefitTitle}>{benefit.title}</h3>
                <p className={styles.benefitDescription}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.newsletter}>
        <div className={styles.container}>
          <div className={styles.newsletterContent}>
            <div className={styles.newsletterText}>
              <h2 className={styles.newsletterTitle}>Будьте в курсі новинок Lite Forest</h2>
              <p className={styles.newsletterSubtitle}>
                Підпишіться на розсилку, щоб отримувати інформацію про нові товари, акції та
                оновлення каталогу.
              </p>
            </div>

            <form className={styles.newsletterForm} onSubmit={handleNewsletterSubmit}>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  placeholder="Введіть ваш email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.newsletterInput}
                  disabled={isNewsletterSubmitting}
                  required
                />
                <button
                  type="submit"
                  className={styles.newsletterBtn}
                  disabled={isNewsletterSubmitting}
                >
                  {isNewsletterSubmitting ? 'Надсилання…' : 'Підписатися'}
                </button>
              </div>

              {newsletterState.message ? (
                <p
                  role="status"
                  aria-live="polite"
                  className={`${styles.statusMessage} ${styles.newsletterMessage} ${
                    newsletterState.type === 'error' ? styles.statusMessageError : styles.statusMessageSuccess
                  }`}
                >
                  {newsletterState.message}
                </p>
              ) : null}

              <p className={styles.newsletterPrivacy}>
                Натискаючи «Підписатися», ви погоджуєтесь із{' '}
                <Link to="/privacy">політикою конфіденційності</Link>.
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;