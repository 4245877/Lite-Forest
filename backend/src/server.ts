// backend/src/server.ts

import Fastify from 'fastify';
import productRoutes from './api/products/products.routes';

const server = Fastify({ logger: true });

// ✅ ПРАВИЛЬНО: Регистрируем все маршруты для продуктов,
// которые мы определили в `products.routes.ts`.
// Все запросы, начинающиеся с /api/products, будут переданы туда.
server.register(productRoutes, { prefix: '/api/products' });

// ❌ Старый обработчик `server.get('/api/products', ...)` нужно удалить отсюда,
// так как теперь эта логика находится внутри `products.routes.ts` и `products.controller.ts`.


// Функция для запуска сервера
const start = async () => {
  try {
    // Убедитесь, что вы используете другой порт, если фронтенд на 3000
    await server.listen({ port: 3001, host: '0.0.0.0' }); 
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();