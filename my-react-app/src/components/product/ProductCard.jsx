// src/components/product/ProductCard.jsx
import React, { useState } from 'react';
import Button from '../ui/Button';
import './ProductCard.css';

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

  const formatPrice = (n) => new Intl.NumberFormat('ru-RU').format(n);

  const handleImgLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setIsPortrait(h >= w * 1.05); // считаем «портретным» с небольшим запасом
    setLoaded(true);
  };

  const handleImgError = (e) => {
    e.currentTarget.src = '/placeholder-product.png';
    setLoaded(true); // чтобы убрать скелет даже при ошибке
  };

  return (
    <div className="product-card">
      <div
        className={`product-image-container ${isPortrait ? 'portrait' : ''} ${loaded ? '' : 'loading'}`}
        style={{ '--image-url': `url("${image}")` }}
      >
        <img
          src={image}
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
