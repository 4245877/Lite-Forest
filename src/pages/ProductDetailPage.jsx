import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import { useCart } from '../contexts/CartContext.jsx';
import './ProductDetailPage.css';
import { assetUrl } from '../utils/assetUrl';
import ProductFilesModal from '../components/product/ProductFilesModal.jsx';
import ProductQuestionChat from '../components/product/ProductQuestionChat.jsx';
import ProductContentRenderer from '../components/product/ProductContentRenderer.jsx';
import { isProductContentEnabled } from '../utils/featureFlags';
import { selectProductContent } from '../utils/productContent';
import {
  allSelectionKeys,
  normalizeSelectionKeys,
  previewPriceForSelection,
  selectionSignature,
} from '../utils/productModels';
import {
  buildCategoryMaps,
  findCategoryLabel,
  getCategoryAncestors,
  normalizeMetaCategories,
  resolvePrimaryCategorySlug,
} from '../utils/categoryTree';
import {
  normalizeAvailabilityState,
  getAvailabilityLabel,
  getAvailabilityTiming,
  getSchemaAvailability,
} from '../utils/availability';
import { useFilamentAvailability } from '../hooks/useFilamentAvailability';
import {
  buildAvailabilityIndex,
  EMPTY_INDEX,
  isPairAvailable,
  isFilamentMaterial,
  isColorAvailable,
  isMaterialAvailable,
  hasAnyAvailablePair,
  pickInitialPair,
  resolveAfterMaterialChange,
  resolveAfterColorChange,
} from '../utils/filamentAvailability';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ProductDetailPage error:', error, info);
  }
 
  render() {
    if (this.state.hasError) {
      return (
        <div className="product-detail container">
          <p className="error">Щось пішло не так на сторінці товару.</p>

          {import.meta.env.DEV && (
            <pre className="pd-error-details">
              {this.state.error?.stack || String(this.state.error)}
            </pre>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Спробувати ще раз
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const uaNumber = (value, options = {}) =>
  new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0, ...options }).format(value);

const PRODUCT_REPORT_REASONS = [
  'Некоректний опис',
  'Неправильні характеристики',
  'Підозра на підробку',
  'Заборонений товар',
  'Інше',
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const PLACEHOLDER_IMAGE = '/placeholder-product.png';

// Вынесен на уровень модуля: если объявлять компонент внутри рендера, при каждом
// setQty React пересоздаёт тип и перемонтирует <input> → на мобильном слетает
// фокус и закрывается цифровая клавиатура после первого символа.
function QtyStepper({ qty, setQty }) {
  return (
    <div className="qty">
      <button
        type="button"
        aria-label="Зменшити кількість"
        onClick={() => setQty((value) => clamp(value - 1, 1, 999))}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={1}
        max={999}
        aria-label="Кількість"
        value={qty}
        onChange={(event) => setQty(clamp(Number(event.target.value) || 1, 1, 999))}
      />
      <button
        type="button"
        aria-label="Збільшити кількість"
        onClick={() => setQty((value) => clamp(value + 1, 1, 999))}
      >
        +
      </button>
    </div>
  );
}

// Компактный «липкий» бар покупки уровня страницы (мобайл). Рендерится внутри
// .product-detail (никаких transform/filter у предков → position: fixed привязан
// к вьюпорту), поэтому виден всегда — независимо от того, где скроллит юзер.
function PurchaseBar({ visible, priceLabel, rangeLabel, availabilityLabel, availabilityState, onAddToCart, onBuyNow, disabled }) {
  return (
    <div
      className={`pd-purchase-bar ${visible ? 'visible' : ''}`}
      role="region"
      aria-label="Купівля товару"
      aria-hidden={!visible}
    >
      <div className="pd-purchase-bar-price">
        <span className="amount">{rangeLabel || priceLabel}</span>
        {availabilityLabel ? (
          <span className={`pd-purchase-bar-avail ${availabilityState}`}>{availabilityLabel}</span>
        ) : null}
      </div>
      <div className="pd-purchase-bar-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={onBuyNow}
          disabled={disabled}
          tabIndex={visible ? 0 : -1}
        >
          Купити
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onAddToCart}
          disabled={disabled}
          tabIndex={visible ? 0 : -1}
        >
          У кошик
        </button>
      </div>
    </div>
  );
}

// Полноэкранный просмотр фото: зум по тапу, свайп между кадрами (тач),
// стрелки/клавиатура на десктопе. Модуль-скоуп — чтобы не перемонтироваться.
function Lightbox({ images, index, productName, onClose, onIndexChange }) {
  const touch = useRef({ x: 0, y: 0, active: false });
  const count = images.length;

  const go = useCallback(
    (delta) => {
      if (count < 2) return;
      onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };

    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="pd-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${productName}: фото ${index + 1} з ${count}`}
      onClick={onClose}
    >
      <button type="button" className="pd-lightbox-close" aria-label="Закрити" onClick={onClose}>
        ×
      </button>

      {count > 1 && (
        <button
          type="button"
          className="pd-lightbox-nav prev"
          aria-label="Попереднє фото"
          onClick={(event) => {
            event.stopPropagation();
            go(-1);
          }}
        >
          ‹
        </button>
      )}

      <img
        className="pd-lightbox-img"
        src={assetUrl(current.url ?? current.thumb_url)}
        alt={current.alt || productName}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          const point = event.touches[0];
          touch.current = { x: point.clientX, y: point.clientY, active: true };
        }}
        onTouchEnd={(event) => {
          if (!touch.current.active) return;
          touch.current.active = false;

          const point = event.changedTouches[0];
          const dx = point.clientX - touch.current.x;
          const dy = point.clientY - touch.current.y;

          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            go(dx < 0 ? 1 : -1);
          }
        }}
        onError={(event) => {
          event.currentTarget.src = PLACEHOLDER_IMAGE;
        }}
      />

      {count > 1 && (
        <button
          type="button"
          className="pd-lightbox-nav next"
          aria-label="Наступне фото"
          onClick={(event) => {
            event.stopPropagation();
            go(1);
          }}
        >
          ›
        </button>
      )}

      {count > 1 && <div className="pd-lightbox-counter">{index + 1} / {count}</div>}
    </div>
  );
}

function optionPriority(key) {
  const normalized = String(key).toLowerCase();
  if (/технолог/i.test(normalized) || /technology/i.test(normalized) || /процес/i.test(normalized)) return 0;
  if (/матер/i.test(normalized) || /material/i.test(normalized)) return 1;
  return 2;
}

function toNumber(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function toSafeNumber(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'y', 'так', 'потрібні', 'required'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'ні', 'не потрібні', 'not-required'].includes(normalized)) return false;
  }

  return null;
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

function getProductValue(product, ...keys) {
  const attrs = isRecord(product?.attributes) ? product.attributes : {};

  for (const key of keys) {
    const direct = product?.[key];
    if (direct !== undefined && direct !== null && direct !== '') return direct;

    const nested = attrs?.[key];
    if (nested !== undefined && nested !== null && nested !== '') return nested;
  }

  return undefined;
}

// Экранируем JSON перед вставкой в <script type="application/ld+json"> через
// dangerouslySetInnerHTML: без этого name/description товара с последовательностью
// "</script>" или "<" закрывали бы тег и давали stored XSS. Заодно экранируем
// U+2028/U+2029 (валидны в JSON, но ломают JS-парсер).
function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

// Точная проверка YouTube-хоста: hostname должен БЫТЬ youtube-доменом, а не просто
// содержать подстроку. includes('youtube.com') пропускал бы youtube.com.attacker.tld.
function isYoutubeHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return (
    h === 'youtu.be' ||
    h === 'youtube.com' ||
    h === 'www.youtube.com' ||
    h === 'm.youtube.com' ||
    h.endsWith('.youtube.com')
  );
}

// true только для настоящего youtube-URL (по hostname, а не подстроке).
function isYoutubeUrl(url) {
  if (!url) return false;
  try {
    return isYoutubeHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function getYoutubeEmbedUrl(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);

    if (parsed.hostname.toLowerCase() === 'youtu.be') {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (isYoutubeHost(parsed.hostname)) {
      if (parsed.pathname.startsWith('/embed/')) return url;

      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }

      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    return url;
  } catch {
    return url.includes('watch?v=') ? url.replace('watch?v=', 'embed/') : url;
  }
}

function normalizeCollection(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (Array.isArray(parsed?.items)) return parsed.items.filter(Boolean);
      if (Array.isArray(parsed?.images)) return parsed.images.filter(Boolean);
    } catch {
      // не JSON — продолжаем ниже
    }

    return trimmed.includes(',')
      ? trimmed
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [trimmed];
  }

  if (isRecord(value)) {
    if (Array.isArray(value.items)) return value.items.filter(Boolean);
    if (Array.isArray(value.images)) return value.images.filter(Boolean);
  }

  return [];
}

function normalizeMediaImages(media) {
  const items = normalizeCollection(media);

  return items.filter((item) => {
    if (!item) return false;

    if (typeof item === 'string') {
      return (
        /(^|\/)(gallery|images)\//i.test(item) ||
        /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(item)
      );
    }

    const mediaType = String(
      item.media_type ?? item.type ?? item.kind ?? item.mime_group ?? ''
    ).toLowerCase();

    const raw =
      item.url ??
      item.href ??
      item.path ??
      item.src ??
      item.image_url ??
      item.key ??
      item.filename ??
      item.name ??
      '';

    return (
      mediaType === 'image' ||
      mediaType === 'img' ||
      mediaType === 'photo' ||
      /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(String(raw))
    );
  });
}

function normalizeFileImages(files) {
  const items = normalizeCollection(files);

  return items.filter((item) => {
    if (!item) return false;

    if (typeof item === 'string') {
      return /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(item);
    }

    const mime = String(item.mime_type ?? item.mime ?? '').toLowerCase();
    const kind = String(item.kind ?? item.type ?? item.media_type ?? '').toLowerCase();
    const raw =
      item.url ??
      item.href ??
      item.path ??
      item.src ??
      item.image_url ??
      item.key ??
      item.filename ??
      item.name ??
      '';

    return (
      mime.startsWith('image/') ||
      kind === 'image' ||
      kind === 'img' ||
      kind === 'photo' ||
      /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(String(raw))
    );
  });
}

function normalizeIncomingProduct(product = {}) {
  const pick = (...values) => values.find((value) => value != null && String(value).trim() !== '');
  const attrs = isRecord(product.attributes) ? product.attributes : {};

  const imageUrlRaw = pick(
    product.image_url,
    product.main_image_url,
    product.image?.url,
    attrs.image_url,
    attrs.main_image_url,
    attrs.image?.url
  );

  const imageUrlAbs = imageUrlRaw ? assetUrl(imageUrlRaw) : '';
  const sku = product.slug || product.sku || '';
  const productRoot = sku ? assetUrl(`/uploads/products/${sku}/`) : '';

  const baseFromMain = (() => {
    if (!imageUrlAbs) return '';

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const url = new URL(imageUrlAbs, origin);
      return `${url.origin}${url.pathname.replace(/\/[^/]*$/, '/')}`;
    } catch {
      return '';
    }
  })();

  const baseFromSkuImages = sku ? assetUrl(`/uploads/products/${sku}/images/`) : '';
  const baseFromSkuGallery = sku ? assetUrl(`/uploads/products/${sku}/gallery/`) : '';

  const joinBase = (raw, preferred = 'generic') => {
    if (!raw) return '';
    const value = String(raw).trim().replace(/\\/g, '/');
    if (!value) return '';

    if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value)) {
      return assetUrl(value);
    }

    if (/^uploads\//i.test(value)) {
      return assetUrl(`/${value}`);
    }

    if (/^(gallery|images|files|videos)\//i.test(value) && productRoot) {
      return assetUrl(`${String(productRoot).replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`);
    }

    const baseOrder =
      preferred === 'gallery'
        ? [baseFromSkuGallery, baseFromSkuImages, baseFromMain, productRoot]
        : preferred === 'images'
          ? [baseFromSkuImages, baseFromSkuGallery, baseFromMain, productRoot]
          : preferred === 'files'
            ? [productRoot, baseFromMain, baseFromSkuGallery, baseFromSkuImages]
            : [baseFromMain, productRoot, baseFromSkuGallery, baseFromSkuImages];

    const base = baseOrder.find(Boolean);

    return base
      ? assetUrl(`${String(base).replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`)
      : assetUrl(`/${value.replace(/^\/+/, '')}`);
  };

  const rawImages = [
    ...normalizeCollection(product.images),
    ...normalizeCollection(product.product_images),
    ...normalizeCollection(product.gallery),
    ...normalizeCollection(product.gallery_images),
    ...normalizeCollection(product.photos),
    ...normalizeCollection(product.image_urls),
    ...normalizeCollection(product.media?.images),
    ...normalizeMediaImages(product.media),
    ...normalizeFileImages(product.files),

    ...normalizeCollection(attrs.images),
    ...normalizeCollection(attrs.product_images),
    ...normalizeCollection(attrs.gallery),
    ...normalizeCollection(attrs.gallery_images),
    ...normalizeCollection(attrs.photos),
    ...normalizeCollection(attrs.image_urls),
    ...normalizeCollection(attrs.media?.images),
    ...normalizeMediaImages(attrs.media),
    ...normalizeFileImages(attrs.files),
  ];

  const seenImages = new Set();

  const images = rawImages.length
    ? rawImages
        .filter(Boolean)
        .map((image) => {
          if (typeof image === 'string') {
            const preferred = /(^|\/)gallery\//i.test(image) ? 'gallery' : 'images';
            const url = joinBase(image, preferred);
            return url
              ? {
                  url,
                  thumb_url: url,
                  role: 'gallery',
                }
              : null;
          }

          const rawMain =
            image.url ??
            image.href ??
            image.path ??
            image.src ??
            image.image_url ??
            image.key ??
            image.filename ??
            image.name;

          const rawThumb =
            image.thumb_url ??
            image.thumb ??
            image.preview ??
            image.small ??
            image.thumbnail ??
            rawMain;

          const pathHint = [image.role, image.folder, image.dir, rawMain, rawThumb]
            .filter(Boolean)
            .join(' ');

          const preferred = /gallery/i.test(pathHint) ? 'gallery' : 'images';
          const url = joinBase(rawMain, preferred);
          const thumbUrl = joinBase(rawThumb, preferred);

          return url ? { ...image, url, thumb_url: thumbUrl || url, role: 'gallery' } : null;
        })
        .filter((image) => {
          if (!image?.url) return false;
          if (seenImages.has(image.url)) return false;
          seenImages.add(image.url);
          return true;
        })
    : [];

  const rawFiles = [
    ...normalizeCollection(product.files),
    ...normalizeCollection(attrs.files),
  ];

  const files = rawFiles.length
    ? rawFiles
        .filter(Boolean)
        .map((file) => {
          if (typeof file === 'string') {
            return { url: joinBase(file, 'files') };
          }

          const raw = pick(file.url, file.path, file.src, file.filename, file.name);
          return { ...file, url: joinBase(raw, 'files') };
        })
        .filter((file) => file.url)
    : [];

  const rawVideos = [
    ...normalizeCollection(product.videos),
    ...normalizeCollection(attrs.videos),
  ];

  const videos = rawVideos.length
    ? rawVideos
        .filter(Boolean)
        .map((video) => {
          if (typeof video === 'string') {
            return { url: joinBase(video, 'files') };
          }

          const raw = pick(video.url, video.path, video.src);
          return { ...video, url: joinBase(raw, 'files') };
        })
        .filter((video) => video.url)
    : product.video_url || attrs.video_url
      ? [{ url: assetUrl(product.video_url || attrs.video_url) }]
      : [];

  const imageUrl = imageUrlAbs;

  const normalizedImages = [...images];

  if (imageUrl) {
    const mainIndex = normalizedImages.findIndex((item) => item.url === imageUrl);

    if (mainIndex >= 0) {
      const [main] = normalizedImages.splice(mainIndex, 1);
      normalizedImages.unshift({
        ...main,
        role: 'primary',
      });
    } else {
      normalizedImages.unshift({
        url: imageUrl,
        thumb_url: imageUrl,
        role: 'primary',
      });
    }
  } else if (normalizedImages.length) {
    normalizedImages[0] = {
      ...normalizedImages[0],
      role: 'primary',
    };
  }

  return {
    ...product,
    attributes: attrs,
    images: normalizedImages,
    files,
    videos,
    image_url: imageUrl,
  };
}

function ProductDetailPageInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [mainImage, setMainImage] = useState(null);
  const [activeMediaTab, setActiveMediaTab] = useState('photos');

  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedFilament, setSelectedFilament] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(PRODUCT_REPORT_REASONS[0]);
  const [reportComment, setReportComment] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [cartToast, setCartToast] = useState('');
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [pendingBuyNow, setPendingBuyNow] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [coverBroken, setCoverBroken] = useState(false);
  const [viewer3dFailed, setViewer3dFailed] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!cartToast) return undefined;

    const timer = window.setTimeout(() => {
      setCartToast('');
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [cartToast]);

  useEffect(() => {
    let alive = true;

    setIsLoading(true);
    setErr(null);

    Promise.all([api.getProduct(id), api.getCategories().catch(() => [])])
      .then(([productPayload, categoryRows]) => {
        if (!alive) return;

        const normalizedProduct = normalizeIncomingProduct(productPayload);
        const normalizedCategories = normalizeMetaCategories(categoryRows).filter((item) => !item.is_hidden);

        setProduct(normalizedProduct);
        setCategories(normalizedCategories);

        const primaryImage =
          normalizedProduct.images.find((item) => item && item.role === 'primary') ??
          normalizedProduct.images[0] ??
          null;

        setMainImage(primaryImage?.url ?? normalizedProduct.image_url ?? null);

        const firstVariant =
          Array.isArray(normalizedProduct.variants) && normalizedProduct.variants.length
            ? normalizedProduct.variants[0]
            : null;

        setSelectedOptions(firstVariant?.options ? { ...firstVariant.options } : {});
        setQty(1);
        setActiveMediaTab('photos');
        document.title = `${normalizedProduct.name ?? normalizedProduct.sku ?? 'Товар'} — Lite Forest`;
      })
      .catch((error) => {
        if (!alive) return;
        setErr(error?.message || 'Не вдалося завантажити товар');
      })
      .finally(() => {
        if (!alive) return;
        setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    if (!user || !product?.id) {
      setIsFavorite(false);
      setFavoriteError('');
      return;
    }

    (async () => {
      try {
        const data = await api.getFavorites();
        if (cancelled) return;

        const exists = (data?.items || []).some(
          (item) => String(item.id) === String(product.id)
        );

        setIsFavorite(exists);
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load favorites state:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, product?.id]);

  const categoryMaps = useMemo(() => buildCategoryMaps(categories), [categories]);
  const categoriesById = categoryMaps?.byId || {};

  const productName = getProductValue(product, 'name') ?? product?.sku ?? 'Товар';
  const subtitle = getProductValue(product, 'subtitle', 'tagline');
  const shortDescription = getProductValue(product, 'short_description');
  const fullDescription = getProductValue(product, 'description');
  const brand = getProductValue(product, 'brand');
  const designer = getProductValue(product, 'designer');
  const useCases = normalizeTextList(getProductValue(product, 'use_cases'));

  const colorOptionsFromProduct = useMemo(() => {
    return normalizeTextList(getProductValue(product, 'colors'));
  }, [product]);

  const materialOptionsFromProduct = useMemo(() => {
    const materials = normalizeTextList(getProductValue(product, 'materials', 'material'));

    return [...new Set(materials)];
  }, [product]);

  useEffect(() => {
    setSelectedColor((current) =>
      current && colorOptionsFromProduct.includes(current) ? current : (colorOptionsFromProduct[0] ?? null),
    );
  }, [colorOptionsFromProduct]);

  useEffect(() => {
    setSelectedFilament((current) =>
      current && materialOptionsFromProduct.includes(current)
        ? current
        : (materialOptionsFromProduct[0] ?? null),
    );
  }, [materialOptionsFromProduct]);

  // ── Складська доступність філаментів: обчислюється нижче, ПІСЛЯ orderedOptionKeys
  //    (див. блок після useMemo(orderedOptionKeys)). Тут раніше стояв цей код і
  //    звертався до orderedOptionKeys до його ініціалізації (TDZ-краш). ──────────

  const gallery = useMemo(
    () => (Array.isArray(product?.images) ? product.images.filter(Boolean) : []),
    [product],
  );

  // ── Расширенный контент товара (фича-флаг VITE_PRODUCT_CONTENT_V1) ─────────
  //
  // Картинки контента живут ТОЛЬКО здесь и в галерею не попадают ни при каком
  // раскладе: галерея собирается в normalizeIncomingProduct из product.images и
  // прочих медиа-полей, а контент приходит отдельным полем product.content,
  // которого сборщик галереи не касается. Это не совпадение, а разделение на
  // сервере: галерея идёт из product_assets, контент — из product_content_assets.
  //
  // Флаг проверяется на КАЖДЫЙ рендер (а не при импорте модуля): значение может
  // прийти параметром адреса, и страница обязана переключаться без перезагрузки
  // приложения.
  const productContentEnabled = isProductContentEnabled();
  const productContent = useMemo(
    () => selectProductContent(product, { enabled: productContentEnabled }),
    [product, productContentEnabled],
  );

  const videosView = useMemo(
    () => (Array.isArray(product?.videos) ? product.videos : product?.video_url ? [{ url: product.video_url }] : []),
    [product],
  );

  const filesView = useMemo(
    () => (Array.isArray(product?.files) ? product.files.filter(Boolean) : []),
    [product],
  );

  const models3d = useMemo(
    () =>
      filesView.filter((file) => {
        const role = String(file.role || '').toLowerCase();
        const url = String(file.url || '');
        return (
          ['model3d', '3d', 'gltf', 'glb', 'model', 'model_primary', 'model_alt'].includes(role) ||
          /\.(glb|gltf)$/i.test(url)
        );
      }),
    [filesView],
  );

  const has3d = useMemo(
    () => models3d.length > 0 && models3d.some((model) => /(gltf|glb)$/i.test(model.url || '')),
    [models3d],
  );

  // Завантаження <model-viewer> для вкладки «3D».
  //
  // Раніше сюди динамічно вставлявся <script> з unpkg БЕЗ закріпленої версії і
  // без SRI: `https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js`
  // віддає ЗАВЖДИ найсвіжішу збірку. Тобто сторінка товару виконувала довільний
  // сторонній код, який міг змінитись будь-коли без нашого відома: компрометація
  // CDN або пакета = виконання чужого JS на сторінці з кукою сесії покупця.
  //
  // Тепер пакет закріплено в package.json (@google/model-viewer@4.3.1) і він
  // збирається у власний чанк: Vite віддає його з нашого домену, стороннього
  // запиту немає взагалі — SRI не потрібен, а оновлення версії проходить через
  // review і lock-файл. Це той самий підхід, що й із self-hosted шрифтами.
  useEffect(() => {
    if (!has3d) return undefined;

    setViewer3dFailed(false);

    // Кастомний елемент уже зареєстровано — вантажити чанк удруге не треба.
    if (typeof window !== 'undefined' && window.customElements?.get('model-viewer')) {
      return undefined;
    }

    let cancelled = false;

    // Чанк лежить на нашому домені, але мережа все одно може підвести
    // (обрив, порожній кеш) — фолбек вкладки лишаємо.
    import('@google/model-viewer')
      .then(() => {
        if (cancelled) return;
        return window.customElements?.whenDefined('model-viewer');
      })
      .catch(() => {
        if (!cancelled) setViewer3dFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [has3d]);

  useEffect(() => {
    if (activeMediaTab === 'video' && !videosView.length) {
      setActiveMediaTab(has3d ? '3d' : 'photos');
    }

    if (activeMediaTab === '3d' && !has3d) {
      setActiveMediaTab(videosView.length ? 'video' : 'photos');
    }
  }, [activeMediaTab, has3d, videosView.length]);

  const variants = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product]);

  const optionKeys = useMemo(() => {
    const keys = new Set();
    variants.forEach((variant) => Object.keys(variant.options || {}).forEach((key) => keys.add(key)));
    return Array.from(keys);
  }, [variants]);

  const orderedOptionKeys = useMemo(() => {
    return [...optionKeys].sort((left, right) => {
      const leftPriority = optionPriority(left);
      const rightPriority = optionPriority(right);

      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return String(left).localeCompare(String(right), 'uk');
    });
  }, [optionKeys]);

  // ── Складська доступність філаментів (пара матеріал×колір) ─────────────────
  // Дані тягнемо через backend-проксі магазину (браузер на 192.168.0.139
  // напряму НЕ ходить). До отримання достовірних даних — fail-open: поведінка
  // сторінки не змінюється, нічого не блокуємо. ВАЖЛИВО: цей блок має стояти
  // ПІСЛЯ orderedOptionKeys — він на нього посилається (інакше TDZ на рендері).
  const filamentAvailability = useFilamentAvailability();

  // Достовірні дані = статус ready і items це масив. Інакше (loading / items:null
  // / error) — fail-open.
  const stockItems =
    filamentAvailability.status === 'ready' &&
    filamentAvailability.data &&
    Array.isArray(filamentAvailability.data.items)
      ? filamentAvailability.data.items
      : null;

  const stockStrict = stockItems != null;
  const stockFailOpen = !stockStrict;
  const stockLoading = filamentAvailability.status === 'loading';
  const stockStale = Boolean(filamentAvailability.data?.stale);
  // Інтеграцію не налаштовано на бекенді (configured:false) → фіча просто вимкнена:
  // тихий fail-open без повідомлень. Якщо ж налаштовано, але даних немає (upstream
  // недоступний) або сталася помилка — показуємо нотатку «не вдалося перевірити».
  const stockConfigured = filamentAvailability.data?.configured !== false;
  const stockNoData = !stockLoading && stockFailOpen && stockConfigured;

  const stockIndex = useMemo(
    () => (stockStrict ? buildAvailabilityIndex(stockItems) : EMPTY_INDEX),
    [stockStrict, stockItems],
  );

  // Гейтимо складом ЛИШЕ простий вибір матеріал+колір (aux-блок): потрібні обидва
  // списки товару І хоча б один канонічний філамент. Товари з варіантами
  // (orderedOptionKeys) зберігають exact-variant поведінку; товари лише зі смолою
  // (Resin Standard) не гейтяться складом філаментів (розділ 10) — жодних
  // повідомлень/блокувань про наявність.
  const stockGatingActive =
    orderedOptionKeys.length === 0 &&
    colorOptionsFromProduct.length > 0 &&
    materialOptionsFromProduct.length > 0 &&
    materialOptionsFromProduct.some(isFilamentMaterial);

  // Коли є достовірні дані — наводимо вибір на першу доступну пару (7.1). У
  // fail-open режимі вибір не чіпаємо (зберігаємо поточну поведінку).
  useEffect(() => {
    if (!stockGatingActive || stockFailOpen) return;
    if (
      selectedFilament &&
      selectedColor &&
      isPairAvailable(stockIndex, selectedFilament, selectedColor)
    ) {
      return; // поточна пара доступна — не чіпаємо вибір
    }
    const pair = pickInitialPair(stockIndex, materialOptionsFromProduct, colorOptionsFromProduct);
    if (pair) {
      setSelectedFilament(pair.material);
      setSelectedColor(pair.color);
    }
    // немає доступних пар → лишаємо вибір як є (кнопки disabled, add заблоковано)
  }, [
    stockGatingActive,
    stockFailOpen,
    stockIndex,
    materialOptionsFromProduct,
    colorOptionsFromProduct,
    selectedFilament,
    selectedColor,
  ]);

  // Немає жодної доступної комбінації матеріал×колір (7.4).
  const noAvailablePairs =
    stockGatingActive &&
    !stockFailOpen &&
    !hasAnyAvailablePair(stockIndex, materialOptionsFromProduct, colorOptionsFromProduct);

  // Поточна вибрана пара недоступна за складом → блокуємо додавання в кошик.
  // У fail-open режимі (немає достовірних даних) не блокуємо (зберігаємо поведінку).
  const purchaseBlockedByStock =
    stockGatingActive &&
    !stockFailOpen &&
    (!selectedFilament ||
      !selectedColor ||
      !isPairAvailable(stockIndex, selectedFilament, selectedColor));

  const optionValues = useMemo(() => {
    const map = {};

    optionKeys.forEach((key) => {
      map[key] = new Set();
    });

    variants.forEach((variant) => {
      optionKeys.forEach((key) => {
        const value = variant.options?.[key];
        if (value != null) map[key].add(String(value));
      });
    });

    const output = {};
    optionKeys.forEach((key) => {
      output[key] = Array.from(map[key]);
    });

    return output;
  }, [optionKeys, variants]);

  const activeVariant = useMemo(() => {
    if (!variants.length) return null;

    const exact = variants.find((variant) => {
      const options = variant.options || {};
      return optionKeys.every((key) => {
        return selectedOptions[key] ? String(options[key]) === String(selectedOptions[key]) : true;
      });
    });

    return exact || variants[0];
  }, [optionKeys, selectedOptions, variants]);

  const basePrice = toSafeNumber(getProductValue(product, 'price'), 0);
  const price = toSafeNumber(activeVariant?.price, basePrice);

  const pricesRange = useMemo(() => {
    if (!variants.length) return null;

    const prices = variants
      .map((variant) => toNumber(variant.price ?? basePrice))
      .filter((value) => value != null);

    if (!prices.length) return null;

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [basePrice, variants]);

  const leadDays = toSafeNumber(activeVariant?.lead_time_days ?? getProductValue(product, 'lead_time_days'), 0);

  const explicitAvailability =
    activeVariant?.availability ??
    getProductValue(product, 'availability') ??
    getProductValue(product, 'attributes')?.availability;

  const availability = normalizeAvailabilityState(explicitAvailability);

  const cover = assetUrl(
    mainImage ?? gallery[0]?.url ?? gallery[0]?.thumb_url ?? product?.image_url ?? PLACEHOLDER_IMAGE,
  );

  // При битой обложке подменяем и <img>, и размытый фон ::before (--cover-url),
  // иначе фон продолжает ссылаться на несуществующий URL.
  const effectiveCover = coverBroken ? PLACEHOLDER_IMAGE : cover;

  useEffect(() => {
    setCoverBroken(false);
  }, [cover]);

  // Показываем «липкий» бар покупки, когда основной блок кнопок ушёл из вьюпорта.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    // Прячем плавающий бар, только когда основные кнопки реально видны и не
    // перекрыты нижним fixed-баром/таб-баром (нижний отступ ≈ их высоте).
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { rootMargin: '0px 0px -140px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [product?.id, isLoading]);

  const productModels = Array.isArray(product?.models) ? product.models : [];

  const breadcrumbs = useMemo(() => {
    const rawCategories = Array.isArray(product?.categories)
      ? product.categories.map((value) => String(value).trim()).filter(Boolean)
      : [];

    const primarySlug = resolvePrimaryCategorySlug(rawCategories, categoriesById);

    if (primarySlug) {
      const trail = getCategoryAncestors(primarySlug, categoriesById);
      if (trail.length) {
        return trail.map((category) => ({
          name: category.name,
          slug: category.slug,
          url: `/catalog?cats=${encodeURIComponent(category.slug)}`,
        }));
      }
    }

    return rawCategories.map((slug) => ({
      name: findCategoryLabel(slug, categoriesById),
      slug,
      url: `/catalog?cats=${encodeURIComponent(slug)}`,
    }));
  }, [product, categoriesById]);

  const categoryChips = useMemo(() => {
    const rawCategories = Array.isArray(product?.categories)
      ? product.categories.map((value) => String(value).trim()).filter(Boolean)
      : [];

    return [...new Set(rawCategories)].map((slug) => ({
      slug,
      name: findCategoryLabel(slug, categoriesById),
    }));
  }, [product, categoriesById]);

  const ratingValue = toNumber(product?.rating?.avg ?? product?.rating);
  const ratingCount = toNumber(product?.rating?.count ?? product?.reviews_count);

  const digitalFile = filesView.find((file) => {
    const role = String(file.role || '').toLowerCase();
    const url = String(file.url || '');
    return ['digital', 'stl', 'file', 'download'].includes(role) || /\.(stl|3mf|zip|rar)$/i.test(url);
  });

  const rawLicense =
    getProductValue(product, 'license') ||
    filesView.find((file) => String(file.role || '').toLowerCase() === 'license');

  const licenseInfo = isRecord(rawLicense) ? rawLicense : null;
  const licenseText = !licenseInfo && rawLicense ? String(rawLicense) : null;

  const rawPrintSettings = getProductValue(product, 'print_settings', 'printing_params');
  const printSettings = isRecord(rawPrintSettings) ? rawPrintSettings : null;
  const printSettingsNote = !printSettings && rawPrintSettings ? String(rawPrintSettings) : null;

  const dimsSource = getProductValue(product, 'dimensions', 'size');
  const dims = isRecord(dimsSource) ? dimsSource : null;
  const weight = getProductValue(product, 'weight_g', 'weight');

  const selectedMaterialKey = orderedOptionKeys.find(
    (key) => /матер/i.test(String(key)) || /material/i.test(String(key)),
  );
  const selectedTechnologyKey = orderedOptionKeys.find(
    (key) => /технолог/i.test(String(key)) || /technology/i.test(String(key)) || /процес/i.test(String(key)),
  );

  const selectedMaterialVal = selectedMaterialKey ? selectedOptions[selectedMaterialKey] : null;
  const selectedTechnologyVal = selectedTechnologyKey ? selectedOptions[selectedTechnologyKey] : null;

  const materialsList = normalizeTextList(getProductValue(product, 'materials', 'material'));
  const materialsCell = materialsList.length
    ? materialsList.join(', ')
    : [selectedTechnologyVal, selectedMaterialVal].filter(Boolean).join(' · ') || null;

  const schemaAvailability = getSchemaAvailability(availability);

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: productName,
    sku: product?.sku,
    image: gallery.map((item) => assetUrl(item?.url)).filter(Boolean).slice(0, 10),
    description: shortDescription || fullDescription,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    material: [selectedTechnologyVal, selectedMaterialVal].filter(Boolean).join(' · ') || undefined,
    aggregateRating:
      ratingValue != null
        ? {
            '@type': 'AggregateRating',
            ratingValue: String(ratingValue),
            reviewCount: String(ratingCount || 1),
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'UAH',
      price: String(price || basePrice || 0),
      availability: schemaAvailability,
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
  };

  const printRows = (() => {
    if (!printSettings) return [];
    const rows = [];

    for (const [key, value] of Object.entries(printSettings)) {
      if (isRecord(value)) {
        for (const [materialName, config] of Object.entries(value)) {
          rows.push([`${key} · ${materialName}`, config]);
        }
      } else {
        rows.push([key, value]);
      }
    }

    return rows.length ? rows : Object.entries(printSettings);
  })();

  const printerType = getProductValue(product, 'printer_type');
  const layerHeightMm = getProductValue(product, 'layer_height_mm');
  const infillPercent = getProductValue(product, 'infill_percent');
  const infillPattern = getProductValue(product, 'infill_pattern');
  const toleranceMm = getProductValue(product, 'tolerance_mm');
  const supportsRequired = getProductValue(product, 'supports_required');
  const supportsRequiredValue = normalizeBoolean(supportsRequired);
  const postProcessing = getProductValue(product, 'post_processing');
  const hasTechnicalDetails = Boolean(
    printerType ||
      layerHeightMm ||
      infillPercent ||
      toleranceMm ||
      supportsRequiredValue != null ||
      postProcessing ||
      printSettings ||
      printSettingsNote,
  );
  const finishValue = getProductValue(product, 'finish');
  const colors = normalizeTextList(getProductValue(product, 'colors'));
  const whatsInBox = normalizeTextList(getProductValue(product, 'whats_in_box'));
  const rawAssembly = getProductValue(product, 'assembly');
  const assembly = isRecord(rawAssembly) ? rawAssembly : null;
  const compatibility = getProductValue(product, 'compatibility');
  const faq = Array.isArray(getProductValue(product, 'faq')) ? getProductValue(product, 'faq') : [];
  const tags = normalizeTextList(getProductValue(product, 'tags'));
  const seo = isRecord(getProductValue(product, 'seo')) ? getProductValue(product, 'seo') : null;

  if (isLoading) {
    return (
      <div className="product-detail container">
        <p>Завантаження товару…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="product-detail container">
        <p className="error">Помилка: {err}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="product-detail container">
        <p>Товар не знайдено.</p>
      </div>
    );
  }

  function isChoiceAvailable(key, value) {
    const next = { ...selectedOptions, [key]: value };

    return variants.some((variant) => {
      const options = variant.options || {};
      return Object.entries(next).every(([optionKey, optionValue]) => {
        return optionValue == null || String(options[optionKey]) === String(optionValue);
      });
    });
  }

  function getSelectionSummary() {
    return orderedOptionKeys.length
      ? orderedOptionKeys
          .map((key) => selectedOptions[key] && `${key}: ${selectedOptions[key]}`)
          .filter(Boolean)
          .join(' • ')
      : [
          selectedColor ? `Колір: ${selectedColor}` : null,
          selectedFilament ? `Матеріал: ${selectedFilament}` : null,
        ]
          .filter(Boolean)
          .join(' • ');
  }

  function buildCartProduct(selectedKeys) {
    const selectionSummary = getSelectionSummary();
    const productId = product.id ?? product._id ?? product.sku;
    const variantId = activeVariant?.id ?? activeVariant?._id ?? null;

    const optionsKey = orderedOptionKeys.length
      ? orderedOptionKeys
          .map((key) => `${key}:${selectedOptions[key] ?? ''}`)
          .join('|')
      : [
          selectedColor ? `color:${selectedColor}` : null,
          selectedFilament ? `material:${selectedFilament}` : null,
        ]
          .filter(Boolean)
          .join('|');

    // Ключи выбранных деталей (key||url). Пусто → выбраны все детали.
    const selected =
      Array.isArray(selectedKeys) && selectedKeys.length
        ? normalizeSelectionKeys(productModels, selectedKeys)
        : allSelectionKeys(productModels);

    // Разный набор деталей → разная позиция корзины. Полный выбор не добавляет
    // суффикс, поэтому ведёт себя как раньше (повторное добавление → +qty).
    const partsSig = selectionSignature(productModels, selected);
    const baseLineId = `${productId}:${variantId ?? (optionsKey || 'default')}`;

    return {
      ...product,
      id: productId,
      product_id: productId,
      variant_id: variantId,
      cartLineId: partsSig ? `${baseLineId}#${partsSig}` : baseLineId,
      optionsKey,
      name: selectionSummary ? `${productName} (${selectionSummary})` : productName,
      title: selectionSummary ? `${productName} (${selectionSummary})` : productName,
      // Предварительная цена строки по выбранным деталям (финальную считает бэкенд).
      price: previewPriceForSelection(productModels, selected, price),
      // Полная цена товара — база для пересчёта при смене выбора в корзине.
      base_price: price,
      image: cover,
      image_url: cover,
      // Полный список деталей (для редактирования набора в корзине) и текущий
      // выбор (ключи деталей — уйдут на бэкенд в selected_model_keys).
      models: productModels,
      selected_model_keys: selected,
    };
  }

  function addToCart(selectedKeys) {
    addItem(buildCartProduct(selectedKeys), qty);

    setCartToast(
      qty > 1
        ? `Додано в кошик: ${productName} × ${qty}`
        : `Додано в кошик: ${productName}`
    );
  }

  function buyNow(selectedKeys) {
    addItem(buildCartProduct(selectedKeys), qty);
    navigate('/cart');
  }

  // Перед добавлением в корзину показываем модалку со списком STL-файлов,
  // чтобы покупатель видел, что именно входит в товар. Для товаров без
  // файлов моделей сохраняем прежнее поведение (без лишнего окна).
  function handleAddToCart() {
    // Не даємо додати завідомо недоступну за складом комбінацію (за наявності
    // достовірних даних). У fail-open режимі purchaseBlockedByStock === false.
    if (purchaseBlockedByStock) return;
    if (productModels.length > 0) {
      setPendingBuyNow(false);
      setFilesModalOpen(true);
      return;
    }
    addToCart();
  }

  function handleBuyNow() {
    if (purchaseBlockedByStock) return;
    if (productModels.length > 0) {
      setPendingBuyNow(true);
      setFilesModalOpen(true);
      return;
    }
    buyNow();
  }

  function confirmFilesModal(selectedKeys) {
    setFilesModalOpen(false);
    // Перевіряємо ще раз: користувач міг відкрити модалку поки дані складу
    // вантажились (fail-open — кнопка активна), а поки він обирав деталі —
    // достовірні дані прийшли й пара стала недоступною. Не кладемо таку пару
    // в кошик (гонка confirmFilesModal). У fail-open режимі === false.
    if (purchaseBlockedByStock) return;
    if (pendingBuyNow) {
      buyNow(selectedKeys);
    } else {
      addToCart(selectedKeys);
    }
  }

  async function toggleFavorite() {
    if (!product?.id || favoriteLoading) return;

    if (!user) {
      navigate('/login', {
        replace: false,
        state: {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        },
      });
      return;
    }

    setFavoriteLoading(true);
    setFavoriteError('');

    try {
      if (isFavorite) {
        await api.removeFavorite(product.id);
        setIsFavorite(false);
      } else {
        await api.addFavorite(product.id);
        setIsFavorite(true);
      }
    } catch (e) {
      setFavoriteError(e?.message || 'Не вдалося оновити обране');
    } finally {
      setFavoriteLoading(false);
    }
  }

  function closeReportForm() {
    setIsReportOpen(false);
    setReportReason(PRODUCT_REPORT_REASONS[0]);
    setReportComment('');
    setReportError('');
    setReportSuccess('');
  }

  async function submitProductReport(event) {
    event.preventDefault();

    const productId = product?.id ?? product?._id ?? product?.sku ?? id;

    if (!productId || reportLoading) return;

    setReportLoading(true);
    setReportError('');
    setReportSuccess('');

    try {
      await api.reportProduct(productId, {
        reason: reportReason,
        comment: reportComment.trim(),
        product_id: productId,
        product_sku: product?.sku ?? '',
        product_name: productName,
        page_url: typeof window !== 'undefined' ? window.location.href : '',
      });

      setReportSuccess('Дякуємо. Скаргу надіслано.');
      setReportComment('');
      setReportReason(PRODUCT_REPORT_REASONS[0]);
    } catch (e) {
      setReportError(e?.message || 'Не вдалося надіслати скаргу');
    } finally {
      setReportLoading(false);
    }
  }

  function updateOption(key, value) {
    setSelectedOptions((state) => ({ ...state, [key]: value }));
  }

  // Вибір кольору. У fail-open режимі — просто виставляємо. Інакше застосовуємо
  // складські правила: якщо поточний матеріал несумісний з новим кольором —
  // беремо перший сумісний (або очищаємо, якщо сумісного немає).
  function selectColor(color) {
    if (stockFailOpen || !stockGatingActive) {
      setSelectedColor(color);
      return;
    }
    const r = resolveAfterColorChange(
      stockIndex,
      materialOptionsFromProduct,
      colorOptionsFromProduct,
      color,
      selectedFilament,
    );
    setSelectedColor(r.color);
    setSelectedFilament(r.material);
  }

  // Вибір матеріалу — симетрично: несумісний колір замінюємо першим сумісним.
  function selectMaterial(materialName) {
    if (stockFailOpen || !stockGatingActive) {
      setSelectedFilament(materialName);
      return;
    }
    const r = resolveAfterMaterialChange(
      stockIndex,
      materialOptionsFromProduct,
      colorOptionsFromProduct,
      materialName,
      selectedColor,
    );
    setSelectedFilament(r.material);
    setSelectedColor(r.color);
  }

  const openLightbox = () => {
    if (!gallery.length) return;

    const activeUrl = assetUrl(mainImage ?? cover);
    const foundIndex = gallery.findIndex(
      (image) => assetUrl(image?.url ?? image?.thumb_url) === activeUrl,
    );

    setLightboxIndex(foundIndex >= 0 ? foundIndex : 0);
  };

  const handleLightboxIndex = (next) => {
    setLightboxIndex(next);
    const image = gallery[next];
    if (image) setMainImage(image.url ?? image.thumb_url);
  };

  const isSoldOut = availability === 'out-of-stock';
  const rangeLabel =
    pricesRange && pricesRange.min !== pricesRange.max
      ? `${uaNumber(pricesRange.min)}–${uaNumber(pricesRange.max)} ₴`
      : null;

  return (
    <div className="product-detail container">
      <nav className="breadcrumbs" aria-label="Хлібні крихти">
        <Link to="/catalog">Каталог</Link>
        {breadcrumbs.map((item, index) => (
          <span key={`${item.slug}-${index}`}>
            <span aria-hidden="true">›</span> <Link to={item.url}>{item.name}</Link>
          </span>
        ))}
        <span aria-hidden="true">›</span> <span className="pd-breadcrumb-current" aria-current="page">{productName}</span>
      </nav>

      <div className="pd-grid">
        <div className="pd-media">
          <div className="pd-media-tabs" role="tablist" aria-label="Медіа">
            <button
              type="button"
              className={activeMediaTab === 'photos' ? 'active' : ''}
              onClick={() => setActiveMediaTab('photos')}
            >
              Фото
            </button>
            {!!videosView.length && (
              <button
                type="button"
                className={activeMediaTab === 'video' ? 'active' : ''}
                onClick={() => setActiveMediaTab('video')}
              >
                Відео
              </button>
            )}
            {!!has3d && (
              <button
                type="button"
                className={activeMediaTab === '3d' ? 'active' : ''}
                onClick={() => setActiveMediaTab('3d')}
              >
                3D
              </button>
            )}
          </div>

          {activeMediaTab === 'photos' && (
            <>
              <button
                type="button"
                className="pd-cover"
                style={{ '--cover-url': `url("${effectiveCover}")` }}
                onClick={openLightbox}
                disabled={!gallery.length}
                aria-label="Відкрити фото на весь екран"
              >
                <img
                  src={effectiveCover}
                  alt={productName}
                  loading="eager"
                  onError={() => setCoverBroken(true)}
                />
                {gallery.length > 0 && (
                  <span className="pd-cover-zoom" aria-hidden="true">
                    ⤢
                  </span>
                )}
              </button>

              {gallery.length > 1 && (
                <div className="pd-thumbs" role="list">
                  {gallery.map((image) => {
                    const thumb = assetUrl(image?.thumb_url ?? image?.url);
                    if (!thumb) return null;

                    const active = assetUrl(mainImage ?? cover) === assetUrl(image.url ?? image.thumb_url);

                    return (
                      <button
                        type="button"
                        key={image.id ?? thumb}
                        className={`pd-thumb ${active ? 'active' : ''}`}
                        onClick={() => setMainImage(image.url ?? image.thumb_url)}
                        aria-label="Показати фото"
                        title={image.alt || 'Фото'}
                      >
                        <img
                          src={thumb}
                          alt={image.alt ?? 'Фото'}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.src = '/placeholder-product.png';
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {gallery.length > 0 && !coverBroken && (
                <div className="pd-media-notes">
                  <small>Для масштабу на фото може бути монета/лінійка або рука.</small>
                </div>
              )}
            </>
          )}

          {activeMediaTab === 'video' && !!videosView.length && (
            <div className="pd-video">
              {isYoutubeUrl(videosView[0].url) ? (
                <iframe
                  src={getYoutubeEmbedUrl(videosView[0].url)}
                  title={videosView[0].title || 'Відео'}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <video src={assetUrl(videosView[0].url)} controls playsInline />
              )}
            </div>
          )}

          {activeMediaTab === '3d' && has3d && (
            <div className="pd-3d">
              {(() => {
                const model = models3d.find((item) => /(glb|gltf)$/i.test(item.url || ''));
                if (!model) return <p>Модель у форматі GLB/GLTF відсутня.</p>;

                if (viewer3dFailed) {
                  return (
                    <div className="pd-3d-fallback">
                      <p>Не вдалося завантажити 3D-переглядач. Перевірте з'єднання або завантажте модель.</p>
                      <a className="btn-secondary" href={assetUrl(model.url)} download>
                        Завантажити 3D-модель
                      </a>
                    </div>
                  );
                }

                return (
                  <model-viewer
                    src={assetUrl(model.url)}
                    ar
                    camera-controls
                    auto-rotate
                    shadow-intensity="1"
                  />
                );
              })()}
            </div>
          )}
        </div>

        <div className="pd-info">
          <h1 className="pd-title">{productName}</h1>

          {categoryChips.length > 0 && (
            <div className="tags pd-category-tags">
              {categoryChips.map((category) => (
                <Link key={category.slug} className="tag" to={`/catalog?cats=${encodeURIComponent(category.slug)}`}>
                  #{category.name}
                </Link>
              ))}
            </div>
          )}

          {subtitle ? <p className="pd-subtitle">{subtitle}</p> : null}

          <div className="pd-meta-row">
            {typeof ratingValue === 'number' && (
              <div
                className="pd-rating"
                aria-label={`Рейтинг ${ratingValue} з 5`}
                title={`Рейтинг ${ratingValue} з 5`}
              >
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={index} className={index < Math.round(ratingValue) ? 'star filled' : 'star'}>
                    ★
                  </span>
                ))}
                {ratingCount ? <span className="pd-rating-count">({ratingCount})</span> : null}
              </div>
            )}

            {product.sku && (
              <div className="pd-sku">
                <span className="label">SKU:</span> <code>{product.sku}</code>
              </div>
            )}

            {brand && (
              <div className="pd-brand">
                <span className="label">Бренд:</span> <span>{brand}</span>
              </div>
            )}
          </div>

          <div className="pd-price-block">
            {pricesRange && pricesRange.min !== pricesRange.max ? (
              <div className="pd-price-range">
                {uaNumber(pricesRange.min)}–{uaNumber(pricesRange.max)}&nbsp;₴
              </div>
            ) : (
              <div className="pd-price">{uaNumber(price)}&nbsp;₴</div>
            )}

            {getAvailabilityLabel(availability) ? (
              <div className="pd-availability-row">
                <span className={`pd-availability ${availability}`}>
                  {getAvailabilityLabel(availability)}
                </span>
                {getAvailabilityTiming(availability, leadDays) ? (
                  <span className="pd-availability-timing">
                    {getAvailabilityTiming(availability, leadDays)}
                  </span>
                ) : null}
              </div>
            ) : null}

            {orderedOptionKeys.length > 0 && (
              <div className="pd-selected muted" aria-live="polite">
                {[selectedTechnologyVal && `Технологія: ${selectedTechnologyVal}`, selectedMaterialVal && `Матеріал: ${selectedMaterialVal}`]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            )}
          </div>

          <div className="pd-favorite-row">
            <button
              type="button"
              className={`btn-ghost pd-favorite-btn ${isFavorite ? 'active' : ''}`}
              onClick={toggleFavorite}
              disabled={favoriteLoading}
              aria-pressed={isFavorite}
            >
              {isFavorite ? '♥ В обраному' : '♡ До обраного'}
            </button>

            <button
              type="button"
              className="btn-ghost pd-report-btn"
              onClick={() => {
                setIsReportOpen((value) => !value);
                setReportError('');
                setReportSuccess('');
              }}
              aria-expanded={isReportOpen}
              aria-controls="product-report-form"
            >
              Поскаржитися
            </button>

            {favoriteError ? (
              <div className="muted" role="alert">
                {favoriteError}
              </div>
            ) : null}

            {isReportOpen ? (
              <form
                id="product-report-form"
                className="pd-report-panel"
                onSubmit={submitProductReport}
              >
                <label className="pd-report-field">
                  <span>Причина скарги</span>
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    disabled={reportLoading}
                  >
                    {PRODUCT_REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="pd-report-field">
                  <span>Коментар</span>
                  <textarea
                    value={reportComment}
                    onChange={(event) => setReportComment(event.target.value)}
                    placeholder="Опишіть проблему, якщо потрібно"
                    rows={4}
                    maxLength={1000}
                    disabled={reportLoading}
                  />
                </label>

                <div className="pd-report-actions">
                  <button
                    type="submit"
                    className="btn-secondary"
                    disabled={reportLoading}
                  >
                    {reportLoading ? 'Надсилання…' : 'Надіслати скаргу'}
                  </button>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={closeReportForm}
                    disabled={reportLoading}
                  >
                    Скасувати
                  </button>
                </div>

                {reportError ? (
                  <div className="pd-report-message error" role="alert">
                    {reportError}
                  </div>
                ) : null}

                {reportSuccess ? (
                  <div className="pd-report-message success" role="status">
                    {reportSuccess}
                  </div>
                ) : null}
              </form>
            ) : null}
          </div>

          {!!orderedOptionKeys.length && (
            <div className="pd-variants">
              {orderedOptionKeys.map((key) => (
                <div key={key} className="pd-variant">
                  <div className="label">{key}:</div>
                  <div className="choices" role="group" aria-label={key}>
                    {optionValues[key].map((value) => {
                      const active = String(selectedOptions[key]) === String(value);
                      const enabled = isChoiceAvailable(key, value);

                      return (
                        <button
                          type="button"
                          key={value}
                          className={`choice ${active ? 'active' : ''}`}
                          disabled={!enabled}
                          onClick={() => enabled && updateOption(key, value)}
                          aria-pressed={active}
                          aria-disabled={!enabled}
                          title={!enabled ? 'Недоступна комбінація' : String(value)}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pd-actions" ref={actionsRef}>
            <QtyStepper qty={qty} setQty={setQty} />
            <button
              type="button"
              className="btn-primary"
              onClick={handleAddToCart}
              disabled={isSoldOut || purchaseBlockedByStock}
            >
              Додати в кошик
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBuyNow}
              disabled={isSoldOut || purchaseBlockedByStock}
            >
              Купити зараз
            </button>
          </div>

          {!orderedOptionKeys.length && (
            <div className="pd-aux-actions">
              {stockGatingActive && stockLoading && (
                <p className="pd-stock-note checking" role="status">
                  Перевіряємо наявність…
                </p>
              )}
              {stockGatingActive && stockStale && (
                <p className="pd-stock-note warning" role="status">
                  Дані про наявність можуть бути неактуальними.
                </p>
              )}
              {stockGatingActive && stockNoData && (
                <p className="pd-stock-note info" role="status">
                  Не вдалося перевірити актуальну наявність. Наявність уточнюється під час обробки
                  замовлення.
                </p>
              )}
              {noAvailablePairs && (
                <p className="pd-stock-note error" role="alert">
                  Наразі немає доступних комбінацій матеріалу та кольору.
                </p>
              )}

              {colorOptionsFromProduct.length > 0 && (
                <div className="pd-variant">
                  <div className="label">Колір:</div>
                  <div className="choices" role="radiogroup" aria-label="Колір">
                    {colorOptionsFromProduct.map((color) => {
                      const active = selectedColor === color;
                      // Колір доступний, якщо існує ХОЧ ОДИН матеріал товару, що дає
                      // з ним доступну пару (а не лише поточний матеріал). Інакше
                      // користувач замкнеться на поточній парі й не дійде до іншої
                      // доступної (напр. PLA×White + PETG×Black). Клік по такому
                      // кольору авто-переключить матеріал (див. selectColor). У
                      // fail-open режимі — усе доступно.
                      const enabled =
                        !stockGatingActive ||
                        stockFailOpen ||
                        isColorAvailable(stockIndex, color, materialOptionsFromProduct);

                      return (
                        <label
                          key={color}
                          className={`choice ${active ? 'active' : ''} ${enabled ? '' : 'unavailable'}`}
                          title={enabled ? color : 'Немає в наявності'}
                        >
                          <input
                            type="radio"
                            name="color"
                            value={color}
                            checked={active}
                            disabled={!enabled}
                            aria-disabled={!enabled}
                            onChange={() => selectColor(color)}
                          />
                          <span>{color}</span>
                          {!enabled && <span className="sr-only"> (немає в наявності)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {materialOptionsFromProduct.length > 0 && (
                <div className="pd-variant">
                  <div className="label">Матеріал:</div>
                  <div className="choices" role="radiogroup" aria-label="Матеріал">
                    {materialOptionsFromProduct.map((materialName) => {
                      const active = selectedFilament === materialName;
                      // Матеріал доступний, якщо існує ХОЧ ОДИН колір товару, що дає
                      // з ним доступну пару (симетрично до кольору вище). Клік
                      // авто-переключить колір на перший сумісний (selectMaterial).
                      // У fail-open режимі — усе доступно.
                      const enabled =
                        !stockGatingActive ||
                        stockFailOpen ||
                        isMaterialAvailable(stockIndex, materialName, colorOptionsFromProduct);

                      return (
                        <label
                          key={materialName}
                          className={`choice ${active ? 'active' : ''} ${enabled ? '' : 'unavailable'}`}
                          title={enabled ? materialName : 'Немає в наявності'}
                        >
                          <input
                            type="radio"
                            name="material"
                            value={materialName}
                            checked={active}
                            disabled={!enabled}
                            aria-disabled={!enabled}
                            onChange={() => selectMaterial(materialName)}
                          />
                          <span>{materialName}</span>
                          {!enabled && <span className="sr-only"> (немає в наявності)</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {digitalFile && (
                <a className="btn-ghost" href={assetUrl(digitalFile.url)} download>
                  Завантажити цифровий файл{digitalFile.license ? ` • ${digitalFile.license}` : ''}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="pd-sections">
        <div className="pd-section">
          <h2>Опис</h2>
          <div className="content">
            {/* products.description остаётся кратким описанием и запасным
                вариантом: расширенный контент его дополняет, а не заменяет.
                Заглушка «опис буде додано» при живом контенте не показывается —
                описание там уже есть, просто в другом блоке. */}
            {fullDescription ? (
              <p>{fullDescription}</p>
            ) : (
              !productContent && <p>Опис буде додано найближчим часом.</p>
            )}

            {designer && <p className="muted">Дизайн: {designer?.name || designer}</p>}

            {useCases.length > 0 && (
              <ul className="bullets">
                {useCases.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Расширенный контент — отдельная секция без собственного <h2>:
            иерархию заголовков внутри задаёт сам документ (он начинается с h2),
            и навязанный сверху заголовок ломал бы её порядок. Обёртки .content
            здесь тоже нет намеренно: её правила (.pd-section .content p) перебили
            бы отступы компонента по специфичности, а он расставляет их сам через
            flex-gap. Заголовки документа при этом остаются под .pd-section h2 — и
            выглядят как остальные секции страницы. */}
        {productContent && (
          <div className="pd-section pd-section--content">
            <ProductContentRenderer value={productContent} />
          </div>
        )}

        <div className="pd-section">
          <h2>Характеристики виробу</h2>
          <div className="content">
            <div className="table-wrap">
              <table className="specs">
                <tbody>
                  {dims && (dims.l || dims.length || dims.w || dims.width || dims.h || dims.height) && (
                    <tr>
                      <th>Габарити (Д×Ш×В), мм</th>
                      <td>{[dims.l ?? dims.length, dims.w ?? dims.width, dims.h ?? dims.height].filter(Boolean).join(' × ')}</td>
                    </tr>
                  )}

                  {weight !== undefined && weight !== null && weight !== '' && (
                    <tr>
                      <th>Маса виробу</th>
                      <td>{uaNumber(weight)} г</td>
                    </tr>
                  )}

                  {materialsCell && (
                    <tr>
                      <th>Матеріал виробу</th>
                      <td>{materialsCell}</td>
                    </tr>
                  )}

                  {finishValue && (
                    <tr>
                      <th>Покриття/фініш</th>
                      <td>{finishValue}</td>
                    </tr>
                  )}

                  {colors.length > 0 && (
                    <tr>
                      <th>Кольори</th>
                      <td>{colors.join(', ')}</td>
                    </tr>
                  )}

                  {whatsInBox.length > 0 && (
                    <tr>
                      <th>Комплектація</th>
                      <td>{whatsInBox.join(', ')}</td>
                    </tr>
                  )}

                  {assembly && (
                    <tr>
                      <th>Складання</th>
                      <td>
                        {normalizeBoolean(assembly.required) ? 'Потрібне складання' : 'Не потребує складання'}
                        {assembly.hardware
                          ? ` • Потрібні кріплення: ${Array.isArray(assembly.hardware) ? assembly.hardware.join(', ') : String(assembly.hardware)}`
                          : ''}
                      </td>
                    </tr>
                  )}

                  {compatibility && (
                    <tr>
                      <th>Сумісність</th>
                      <td>{Array.isArray(compatibility) ? compatibility.join(', ') : String(compatibility)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {hasTechnicalDetails && (
          <div className="pd-section">
            <details className="pd-tech-details">
              <summary>
                <h2>Технічні деталі</h2>
                <span className="pd-tech-hint">Параметри виробництва та 3D-друку — для тих, кому цікаво</span>
              </summary>
              <div className="content">
                {(printerType || layerHeightMm || infillPercent || toleranceMm || supportsRequiredValue != null || postProcessing) && (
                  <div className="table-wrap">
                    <table className="specs">
                      <tbody>
                        {printerType && (
                          <tr>
                            <th>Тип принтера</th>
                            <td>{printerType}</td>
                          </tr>
                        )}

                        {layerHeightMm && (
                          <tr>
                            <th>Товщина шару</th>
                            <td>{layerHeightMm} мм</td>
                          </tr>
                        )}

                        {infillPercent && (
                          <tr>
                            <th>Заповнення</th>
                            <td>
                              {infillPercent}% {infillPattern ? `• ${infillPattern}` : ''}
                            </td>
                          </tr>
                        )}

                        {toleranceMm && (
                          <tr>
                            <th>Точність / допуски</th>
                            <td>±{toleranceMm} мм</td>
                          </tr>
                        )}

                        {supportsRequiredValue != null && (
                          <tr>
                            <th>Підтримки</th>
                            <td>{supportsRequiredValue ? 'Потрібні' : 'Не потрібні'}</td>
                          </tr>
                        )}

                        {postProcessing && (
                          <tr>
                            <th>Постобробка</th>
                            <td>{postProcessing}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {printSettings ? (
                  <div className="table-wrap">
                    <table className="specs">
                      <thead>
                        <tr>
                          <th>Матеріал</th>
                          <th>Сопло, °C</th>
                          <th>Стіл, °C</th>
                          <th>Шар, мм</th>
                          <th>Заповнення, %</th>
                          <th>Стінки</th>
                          <th>Швидкість, мм/с</th>
                          <th>Підтримки</th>
                        </tr>
                      </thead>
                      <tbody>
                        {printRows.map(([materialName, config]) => (
                          <tr key={materialName}>
                            <td>{materialName}</td>
                            <td>{config?.nozzle_temp ?? config?.nozzle ?? '-'}</td>
                            <td>{config?.bed_temp ?? config?.bed ?? '-'}</td>
                            <td>{config?.layer_height ?? config?.layer ?? '-'}</td>
                            <td>{config?.infill_percent ?? config?.infill ?? '-'}</td>
                            <td>{config?.wall_thickness ?? config?.walls ?? '-'}</td>
                            <td>{config?.print_speed ?? config?.speed ?? '-'}</td>
                            <td>{normalizeBoolean(config?.supports) ? 'так' : 'ні'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : printSettingsNote ? (
                  <p>{printSettingsNote}</p>
                ) : null}
              </div>
            </details>
          </div>
        )}

        <div className="pd-section">
          <h2>Правові та ліцензійні умови</h2>
          <div className="content">
            {licenseInfo ? (
              <div className="muted">
                {licenseInfo.license_name ? (
                  <p>
                    Ліцензія:{' '}
                    {licenseInfo.license_url ? (
                      <a href={licenseInfo.license_url} target="_blank" rel="noreferrer">
                        {licenseInfo.license_name}
                      </a>
                    ) : (
                      licenseInfo.license_name
                    )}
                  </p>
                ) : null}

                {licenseInfo.model_author ? <p>Автор моделі: {licenseInfo.model_author}</p> : null}
                {licenseInfo.model_url ? (
                  <p>
                    Джерело:{' '}
                    <a href={licenseInfo.model_url} target="_blank" rel="noreferrer">
                      посилання
                    </a>
                  </p>
                ) : null}
                {licenseInfo.digital_file_license ? <p>Ліцензія на цифровий файл: {licenseInfo.digital_file_license}</p> : null}
              </div>
            ) : licenseText ? (
              <p className="muted">{licenseText}</p>
            ) : (
              <p>Усі авторські права захищено. Якщо використовується стороння модель — вказано дозвіл на використання.</p>
            )}
          </div>
        </div>

        {faq.length > 0 && (
          <div className="pd-section">
            <h2>Часті питання</h2>
            <div className="content">
              <div className="faq">
                {faq.map((item, index) => (
                  <details key={index}>
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {tags.length > 0 || seo?.meta_description ? (
        <section className="pd-seo">
          {tags.length > 0 && (
            <div className="tags">
              {tags.map((tag, index) => (
                <span className="tag" key={index}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {seo?.meta_description && <p className="muted">SEO: {seo.meta_description}</p>}
        </section>
      ) : null}

      <section className="pd-contact">
        <ProductQuestionChat
          productId={product.id ?? product._id ?? product.sku ?? id}
          productName={productName}
          productSku={product.sku ?? ''}
          productSlug={product.slug ?? ''}
        />
        <span className="muted">Напишіть майстру — відповімо у цьому ж чаті.</span>
      </section>

      <div className="sr-only" aria-live="polite">
        {cartToast}
      </div>

      {cartToast ? (
        <div className="pd-cart-toast" role="status" aria-hidden="true">
          <span>{cartToast}</span>
          <Link to="/cart">До кошика</Link>
        </div>
      ) : null}

      <PurchaseBar
        visible={showStickyBar && !filesModalOpen && lightboxIndex == null}
        priceLabel={`${uaNumber(price)} ₴`}
        rangeLabel={rangeLabel}
        availabilityLabel={
          purchaseBlockedByStock ? 'Немає в наявності' : getAvailabilityLabel(availability)
        }
        availabilityState={purchaseBlockedByStock ? 'out-of-stock' : availability}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        disabled={isSoldOut || purchaseBlockedByStock}
      />

      {lightboxIndex != null && gallery.length > 0 && (
        <Lightbox
          images={gallery}
          index={lightboxIndex}
          productName={productName}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={handleLightboxIndex}
        />
      )}

      <ProductFilesModal
        open={filesModalOpen}
        onClose={() => setFilesModalOpen(false)}
        onConfirm={confirmFilesModal}
        models={productModels}
        fallbackImage={cover}
        productName={productName}
        buyNow={pendingBuyNow}
      />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <ErrorBoundary>
      <ProductDetailPageInner /> 
    </ErrorBoundary>
  );
}