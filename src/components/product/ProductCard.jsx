// src/components/product/ProductCard.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { useAuth } from '../../auth';
import { api } from '../../api/client';
import './ProductCard.css';

const PLACEHOLDER_SRC = '/placeholder-product.png';

function resolveImageSrc(image) {
  if (!image) return null;
  if (typeof image === 'string') return image || null;
  if (typeof image === 'object') return image.thumb_url || image.url || null;
  return null;
}

function formatPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return 'Ціну уточнюй';
  return `${new Intl.NumberFormat('uk-UA').format(price)} ₴`;
}

const ProductCard = ({
  productId,
  image,
  title,
  titleText,
  price,
  oldPrice,
  ecoFlag = false,
  onAddToCart,
  showAddToCart = true,
  categoryLabel = '',
  availabilityLabel = '',
  availabilityState = '',
  attributesList = [],
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isPortrait, setIsPortrait] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const imgSrc = useMemo(() => resolveImageSrc(image) || PLACEHOLDER_SRC, [image]);
  const safeTitleText =
    String(titleText ?? (typeof title === 'string' ? title : 'Товар')).trim() || 'Товар';

  const currentPrice = Number(price);
  const previousPrice = Number(oldPrice);
  const hasOldPrice =
    Number.isFinite(previousPrice) &&
    Number.isFinite(currentPrice) &&
    previousPrice > currentPrice;

  useEffect(() => {
    let cancelled = false;

    if (!user || !productId) {
      setIsFavorite(false);
      return;
    }

    (async () => {
      try {
        const data = await api.getFavorites();
        if (cancelled) return;

        const exists = (data?.items || []).some(
          (item) => String(item.id) === String(productId)
        );

        setIsFavorite(exists);
      } catch {
        // тихо
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, productId]);

  const handleImgLoad = (event) => {
    const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
    setIsPortrait(height >= width * 1.05);
    setLoaded(true);
  };

  const handleImgError = (event) => {
    const element = event.currentTarget;
    if (String(element.src).includes(PLACEHOLDER_SRC)) {
      setLoaded(true);
      return;
    }
    element.src = PLACEHOLDER_SRC;
    setLoaded(true);
  };

  const handleFavoriteClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!productId || favoriteLoading) return;

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

    try {
      if (isFavorite) {
        await api.removeFavorite(productId);
        setIsFavorite(false);
      } else {
        await api.addFavorite(productId);
        setIsFavorite(true);
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <div className="product-card">
      <div
        className={`product-image-container ${isPortrait ? 'portrait' : ''} ${loaded ? '' : 'loading'}`}
        style={{ '--image-url': `url("${imgSrc}")` }}
      >
        <img
          src={imgSrc}
          alt={safeTitleText}
          className={`product-image ${isPortrait ? 'is-portrait' : ''}`}
          loading="lazy"
          onLoad={handleImgLoad}
          onError={handleImgError}
        />

        <button
          type="button"
          className={`favorite-btn ${isFavorite ? 'active' : ''}`}
          onClick={handleFavoriteClick}
          disabled={!productId || favoriteLoading}
          aria-label={isFavorite ? 'Видалити з обраного' : 'Додати до обраного'}
          aria-pressed={isFavorite}
        >
          {isFavorite ? '♥' : '♡'}
        </button>

        {ecoFlag && (
          <div className="eco-badge">
            <span className="eco-icon">🌱</span>
            ЕКО
          </div>
        )}

        {hasOldPrice && (
          <div className="discount-badge">
            -{Math.round(((previousPrice - currentPrice) / previousPrice) * 100)}%
          </div>
        )}
      </div>

      <div className="product-info">
        {categoryLabel ? <div className="product-category">{categoryLabel}</div> : null}

        <h3 className="product-title" title={safeTitleText}>
          {title}
        </h3>

        {availabilityLabel ? (
          <div className={`product-availability ${availabilityState || ''}`}>
            {availabilityLabel}
          </div>
        ) : null}

        {attributesList.length > 0 ? (
          <div className="product-attributes">{attributesList.join(' • ')}</div>
        ) : null}

        <div className="product-pricing">
          <div className="current-price">{formatPrice(price)}</div>
          {hasOldPrice && <div className="old-price">{formatPrice(previousPrice)}</div>}
        </div>

        {ecoFlag && hasOldPrice && <div className="eco-discount-text">ЕКО-знижка</div>}
      </div>

      {showAddToCart && typeof onAddToCart === 'function' ? (
        <div className="product-actions">
          <Button
            variant="primary"
            size="md"
            onClick={onAddToCart}
            className="add-to-cart-btn"
          >
            У кошик
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default ProductCard;