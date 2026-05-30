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
import ProfilePage from '../pages/ProfilePage';
import ResetPasswordPage from '../pages/ResetPasswordPage';

const AppRouter = () => {
  return (
    <Routes>
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

        {/* новые */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="reset" element={<ResetPasswordPage />} />

        {/* редиректы на якоря */}
        <Route path="privacy" element={<Navigate to="/legal#privacy" replace />} />
        <Route path="terms"   element={<Navigate to="/legal#terms" replace />} />
        <Route path="cookies" element={<Navigate to="/legal#cookies" replace />} />

        {/* админ */}
        <Route path="admin/products" element={<AdminProducts />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
