// backend/src/api/products/products.service.ts

import db from '../../db';

// Определим, какие данные мы ожидаем для создания товара
export interface ProductInput {
  name: string;
  price: number;
  description?: string; // необязательное поле
  image_url?: string;
}

// Функция для получения всех товаров (у вас она уже может быть)
export const getProducts = async () => {
  const result = await db.query('SELECT id, name, price, image_url FROM products LIMIT 20');
  return result.rows;
};

// ✅ НОВАЯ ФУНКЦИЯ: Создание товара
export const createProduct = async (productData: ProductInput) => {
  const { name, price, description, image_url } = productData;

  // Используем параметризованный запрос (с $1, $2) — это
  // КРИТИЧЕСКИ ВАЖНО для защиты от SQL-инъекций!
  const query = `
    INSERT INTO products (name, price, description, image_url)
    VALUES ($1, $2, $3, $4)
    RETURNING *; 
  `;
  
  const values = [name, price, description, image_url];

  const result = await db.query(query, values);
  
  // Возвращаем созданный товар
  return result.rows[0];
};