// backend/src/api/products/products.routes.ts

import { FastifyInstance } from 'fastify';
import * as ProductController from './products.controller';

async function productRoutes(server: FastifyInstance) {
  // Маршрут для получения товаров
  server.get('/', ProductController.getProductsHandler);

  // ✅ НОВЫЙ МАРШРУТ: для создания товара методом POST
  server.post('/', ProductController.createProductHandler);
}

export default productRoutes;