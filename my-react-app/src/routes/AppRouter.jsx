// src/routes/AppRouter.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage'; 
import CatalogPage from '../pages/CatalogPage';
import PromotionsPage from '../pages/PromotionsPage'; 
import AboutPage from '../pages/AboutPage';
import LoginPage from '../pages/LoginPage';

 


const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/promotions" element={<PromotionsPage />} /> {/* Новый маршрут */}
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />






      {/* Здесь в будущем будут другие маршруты: /product/:id, /cart и т.д. */}
    </Routes>
  );
};

export default AppRouter;