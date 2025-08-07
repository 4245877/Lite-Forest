// src/components/product/ProductCard.jsx
import React from 'react';
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
  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  return (
    <div className="product-card">
      <div className="product-image-container">
        <img 
          src={image} 
          alt={title}
          className="product-image"
          loading="lazy"
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
            {formatPrice(price)} ₽
          </div>
          {oldPrice && (
            <div className="old-price">
              {formatPrice(oldPrice)} ₽
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
          В корзину
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;