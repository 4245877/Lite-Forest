// backend/src/api/products/products.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import * as ProductService from './products.service'; // Импортируем наш сервис

// Контроллер для получения товаров
export const getProductsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const products = await ProductService.getProducts();
  return reply.send({ products });
};

// ✅ НОВЫЙ КОНТРОЛЛЕР: Обработчик создания товара
export const createProductHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // request.body содержит данные, отправленные в теле POST-запроса
    const product = await ProductService.createProduct(request.body as any); 
    
    // Отправляем ответ с кодом 201 Created — это стандарт для успешного создания
    return reply.status(201).send(product);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: 'Ошибка при создании товара' });
  }
};