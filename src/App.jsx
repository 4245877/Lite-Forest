// src/App.jsx
// Простой и корректный App компонент — без BrowserRouter (он уже в main.jsx)
// ВАЖНО: не импортируем App из './App' внутри этого файла и оставляем экспорт по умолчанию.

import React from 'react';
import AppRouter from './routes/AppRouter.jsx';

export default function App() {
  return <AppRouter />;
}
