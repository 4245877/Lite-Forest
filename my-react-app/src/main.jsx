// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// import { HelmetProvider } from 'react-helmet-async'; // <-- УДАЛИТЕ ЭТУ СТРОКУ
import App from './App.jsx';
import './index.css';

// импорт глобальных стилей — ровно 1 раз в точке входа
import './assets/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* <HelmetProvider> <-- УДАЛИТЕ ЭТУ ОБЕРТКУ */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    {/* </HelmetProvider> <-- И ЭТУ ТОЖЕ */}
  </React.StrictMode>
);