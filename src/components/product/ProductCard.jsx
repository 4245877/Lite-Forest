// src/components/product/ProductCard.jsx
import React, { useMemo, useState } from 'react';
import Button from '../ui/Button';
import './ProductCard.css';

const PLACEHOLDER_SRC = '/placeholder-product.png';

// image может быть строкой или объектом { url, thumb_url, ... }
const resolveImageSrc = (image) => {
  if (!image) return null;
  if (typeof image === 'string') return image || null;
  if (typeof image === 'object') return image.thumb_url || image.url || null;
  return null;
};

const ProductCard = ({
  image,
  title,
  price,
  oldPrice,
  ecoFlag = false,
  onAddToCart
}) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const imgSrc = useMemo(() => resolveImageSrc(image) || PLACEHOLDER_SRC, [image]);

  const formatPrice = (n) => new Intl.NumberFormat('ru-RU').format(n);

  const handleImgLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setIsPortrait(h >= w * 1.05);
    setLoaded(true);
  };

  const handleImgError = (e) => {
    const el = e.currentTarget;
    // защита от бесконечного onError, если placeholder не найден
    if (String(el.src).includes(PLACEHOLDER_SRC)) {
      setLoaded(true);
      return;
    }
    el.src = PLACEHOLDER_SRC;
    setLoaded(true);
  };

  return (
    <div className="product-card">
      <div
        className={`product-image-container ${isPortrait ? 'portrait' : ''} ${loaded ? '' : 'loading'}`}
        style={{ '--image-url': `url("${imgSrc}")` }}
      >
        <img
          src={imgSrc}
          alt={title}
          className={`product-image ${isPortrait ? 'is-portrait' : ''}`}
          loading="lazy"
          onLoad={handleImgLoad}
          onError={handleImgError}
        />

        {ecoFlag && (
          <div className="eco-badge">
            <span className="eco-icon">🌱</span>
            ЭКО
          </div>
        )}

        {oldPrice && (
          <div className="discount-badge">
            -{Math.round(((oldPrice - price) / oldPrice) * 100)}%
          </div>
        )}
      </div>

      <div className="product-info">
        <h3 className="product-title" title={title}>
          {title}
        </h3>

        <div className="product-pricing">
          <div className="current-price">
            {formatPrice(price)} ₴
          </div>
          {oldPrice && (
            <div className="old-price">
              {formatPrice(oldPrice)} ₴
            </div>
          )}
        </div>

        {ecoFlag && oldPrice && (
          <div className="eco-discount-text">
            ЭКО-скидка
          </div>
        )}
      </div>

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
    </div>
  );
};

export default ProductCard;
