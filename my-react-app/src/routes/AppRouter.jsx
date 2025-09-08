// src/routes/AppRouter.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import CatalogPage from '../pages/CatalogPage';
import PromotionsPage from '../pages/PromotionsPage';
import AboutPage from '../pages/AboutPage';
import LoginPage from '../pages/LoginPage';
import CartPage from '../pages/CartPage';
import ContactPage from '../pages/ContactPage';
import AdminProducts from '../pages/AdminProducts';
import LegalPages from '../pages/LegalPages';
import ProductDetailPage from '../pages/ProductDetailPage'; // ⬅️ додано

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/promotions" element={<PromotionsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/contacts" element={<ContactPage />} />

      {/* Сторінка товару */}
      <Route path="/products/:id" element={<ProductDetailPage />} />

      {/* Єдина сторінка з якорями */}
      <Route path="/legal" element={<LegalPages />} />

      {/* Редиректи на відповідні розділи */}
      <Route path="/privacy" element={<Navigate to="/legal#privacy" replace />} />
      <Route path="/terms"   element={<Navigate to="/legal#terms" replace />} />
      <Route path="/cookies" element={<Navigate to="/legal#cookies" replace />} />

      <Route path="/admin/products" element={<AdminProducts />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
