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

const AppRouter = () => {
  return (
    <Routes>
      {/* Главная страница */}
      <Route path="/" element={<HomePage />} />

      {/* Другие страницы */}
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/promotions" element={<PromotionsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/contacts" element={<ContactPage />} />

      {/* Любой неизвестный путь — перенаправляем на главную */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
