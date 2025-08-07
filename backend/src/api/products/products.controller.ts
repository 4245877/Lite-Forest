// backend/src/api/products/products.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import * as ProductService from './products.service';

// ✅ ИЗМЕНЕНИЕ: Контроллер для получения товаров теперь принимает параметры
export const getProductsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // request.query будет содержать все параметры из URL (например, ?search=...&sortBy=...)
    const queryParams = request.query as ProductService.GetProductsQuery;
    const products = await ProductService.getProducts(queryParams);
    // Отправляем обратно как есть, без обертки { products }
    return reply.send(products);
  } catch (error) {
    console.error('Ошибка при получении товаров:', error);
    return reply.status(500).send({ message: 'Внутренняя ошибка сервера' });
  }
};

// Контроллер создания товара остается без изменений
export const createProductHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const product = await ProductService.createProduct(request.body as any); 
    return reply.status(201).send(product);
  } catch (error) {
    console.error('Ошибка при создании товара:', error);
    return reply.status(500).send({ message: 'Ошибка при создании товара' });
  }
};