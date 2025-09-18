// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './assets/styles/global.css';

// если используешь AuthProvider: уточни путь к провайдеру при необходимости
import { AuthProvider } from './auth/index.jsx';
import { CartProvider } from './contexts/CartContext.jsx'; // ⬅️ добавлено

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
