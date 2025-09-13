import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/Layout.jsx';

import HomePage from '../pages/HomePage';
import CatalogPage from '../pages/CatalogPage';
import PromotionsPage from '../pages/PromotionsPage';
import AboutPage from '../pages/AboutPage';
import LoginPage from '../pages/LoginPage';
import CartPage from '../pages/CartPage';
import ContactPage from '../pages/ContactPage';
import AdminProducts from '../pages/AdminProducts';
import LegalPages from '../pages/LegalPages';
import ProductDetailPage from '../pages/ProductDetailPage';

const AppRouter = () => {
  return (
    <Routes>
      {/* Вся публичная часть сайта под общим лейаутом */}
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="promotions" element={<PromotionsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="contacts" element={<ContactPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="legal" element={<LegalPages />} />

        {/* Редиректы на якоря */}
        <Route path="privacy" element={<Navigate to="/legal#privacy" replace />} />
        <Route path="terms"   element={<Navigate to="/legal#terms" replace />} />
        <Route path="cookies" element={<Navigate to="/legal#cookies" replace />} />

        {/* Админ, если нужен — можно обернуть в RequireAuth */}
        <Route path="admin/products" element={<AdminProducts />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
