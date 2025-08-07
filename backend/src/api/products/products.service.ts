// backend/src/api/products/products.service.ts

import db from '../../db';

// Определим интерфейс для вариации товара
export interface ProductVariation {
  name: string; // Например, "Цвет" или "Размер"
  value: string; // Например, "Красный" или "XL"
  priceModifier?: number; // Изменение цены для этой вариации
  sku?: string; // Уникальный артикул для вариации
  stock: number; // Количество на складе для этой вариации
}

// Определим, какие данные мы ожидаем для создания товара
export interface ProductInput {
  // --- Основная информация ---
  name: string;
  price: number;
  sku: string; // Артикул
  description?: string;
  
  // --- Медиа ---
  photos?: string[]; // Массив ссылок на фотографии
  videoUrl?: string; // Ссылка на видео
  model3dUrl?: string; // Ссылка на 3D-модель
  
  // --- Характеристики ---
  material?: string;
  colors?: string[];
  sizes?: string[];
  weight?: number; // Вес в граммах или килограммах
  details?: string; // Детализация, текстовое описание
  postProcessing?: string; // Пост-обработка
  
  // --- Логистика и организация ---
  categories?: string[];
  tags?: string[];
  stock: number; // Общее количество на складе, если нет вариаций
  productionTime?: string; // Сроки изготовления, например "3-5 дней"
  
  // --- Дополнительно ---
  manualUrl?: string; // Ссылка на инструкцию
  authorId?: number; // ID автора или создателя
  license?: string; // Тип лицензии
  
  // --- Вариации ---
  variations?: ProductVariation[];
}

// Функция для получения всех товаров (у вас она уже может быть)
export const getProducts = async () => {
  const result = await db.query('SELECT id, name, price FROM products LIMIT 20');
  return result.rows;
};

// ✅ ОБНОВЛЕННАЯ ФУНКЦИЯ: Создание товара
export const createProduct = async (productData: ProductInput) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN'); // Начинаем транзакцию

    // 1. Вставляем основной товар
    const productQuery = `
      INSERT INTO products (name, sku, base_price, description)
      VALUES ($1, $2, $3, $4) RETURNING id;
    `;
    const productResult = await client.query(productQuery, [
      productData.name,
      productData.sku,
      productData.price,
      productData.description,
    ]);
    const newProductId = productResult.rows[0].id;

    // 2. Собираем остальные характеристики в один JSON-объект
    const specifications = {
      material: productData.material,
      weight: productData.weight,
      details: productData.details,
      postProcessing: productData.postProcessing,
      productionTime: productData.productionTime,
      license: productData.license,
      // ... и другие поля
    };
    
    // Вставляем этот JSON в таблицу product_details
    const detailsQuery = `
      INSERT INTO product_details (product_id, specifications) VALUES ($1, $2);
    `;
    await client.query(detailsQuery, [newProductId, specifications]);
    
    // 3. Вставляем вариации (если они есть)
    if (productData.variations && productData.variations.length > 0) {
      for (const variant of productData.variations) {
        const variantQuery = `
          INSERT INTO product_variants (product_id, variant_sku, stock_quantity, attributes, price_modifier)
          VALUES ($1, $2, $3, $4, $5);
        `;
        // 'attributes' в нашей схеме это JSON, который описывает вариацию
        const attributes = { [variant.name]: variant.value }; 
        await client.query(variantQuery, [
          newProductId,
          variant.sku,
          variant.stock,
          attributes,
          variant.priceModifier,
        ]);
      }
    }
    
    // (Здесь будет код для сохранения фото, категорий и т.д.)

    await client.query('COMMIT'); // Завершаем транзакцию

    return { id: newProductId }; // Возвращаем ID созданного товара

  } catch (e) {
    await client.query('ROLLBACK'); // Откатываем в случае ошибки
    throw e;
  } finally {
    client.release(); // Возвращаем соединение в пул
  }
};