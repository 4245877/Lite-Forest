// backend/src/api/products/products.service.ts

import db from '../../db';

// ✅ ИНТЕРФЕЙСЫ, КОТОРЫЕ НУЖНЫ ДЛЯ CREATEPRODUCT
export interface ProductVariation {
  name: string;
  value: string;
  priceModifier?: number;
  sku?: string;
  stock: number;
}

export interface ProductInput {
  name: string;
  price: number;
  sku: string;
  description?: string;
  photos?: string[];
  videoUrl?: string;
  model3dUrl?: string;
  material?: string;
  colors?: string[];
  sizes?: string[];
  weight?: number;
  details?: string;
  postProcessing?: string;
  categories?: string[];
  tags?: string[];
  stock: number;
  productionTime?: string;
  manualUrl?: string;
  authorId?: number;
  license?: string;
  variations?: ProductVariation[];
}

// ✅ ИНТЕРФЕЙС ДЛЯ ПАРАМЕТРОВ ФИЛЬТРАЦИИ
export interface GetProductsQuery {
  search?: string;
  categories?: string;
  priceRange?: string;
  sortBy?: 'popular' | 'new';
}

// ✅ ВАША ФУНКЦИЯ CREATEPRODUCT, ВОЗВРАЩЕННАЯ НА МЕСТО
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

    // 2. Собираем и вставляем характеристики в JSON
    const specifications = {
      material: productData.material,
      weight: productData.weight,
      details: productData.details,
      postProcessing: productData.postProcessing,
      productionTime: productData.productionTime,
      license: productData.license,
      authorId: productData.authorId,
    };
    const detailsQuery = `
      INSERT INTO product_details (product_id, specifications) VALUES ($1, $2);
    `;
    await client.query(detailsQuery, [newProductId, specifications]);
    
    // ... (остальная логика вставки вариаций, медиа, категорий и тегов) ...
    // (Я ее сократил для краткости, у вас она уже есть и работает)
    
    await client.query('COMMIT'); // Завершаем транзакцию, сохраняя все изменения

    return { id: newProductId, message: 'Товар успешно создан' };

  } catch (e) {
    await client.query('ROLLBACK'); // Откатываем все изменения в случае любой ошибки
    console.error("Ошибка при создании товара:", e);
    throw new Error("Не удалось создать товар. Транзакция отменена.");
  } finally {
    client.release(); // Всегда возвращаем соединение в пул
  }
};


// ✅ УЛУЧШЕННАЯ ФУНКЦИЯ GETPRODUCTS С ФИЛЬТРАЦИЕЙ
export const getProducts = async (query: GetProductsQuery) => {
    let baseQuery = `
      SELECT
        p.id, p.sku, p.name, p.base_price, p.description, pd.specifications,
        (SELECT json_agg(m.* ORDER BY m.sort_order) FROM media m WHERE m.product_id = p.id) as media,
        (SELECT array_agg(c.name) FROM categories c JOIN product_categories pc ON c.id = pc.category_id WHERE pc.product_id = p.id) as categories
      FROM products p
      LEFT JOIN product_details pd ON p.id = pd.product_id
    `;
  
    const whereClauses = [];
    const queryParams = [];
    let paramIndex = 1;
  
    if (query.search) {
      whereClauses.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      queryParams.push(`%${query.search}%`);
      paramIndex++;
    }
  
    if (query.categories) {
        const categoryList = query.categories.split(',');
        // Используем подзапрос, чтобы не создавать дубликатов из-за JOIN
        whereClauses.push(`p.id IN (
            SELECT pc.product_id FROM product_categories pc
            JOIN categories c ON pc.category_id = c.id
            WHERE c.name = ANY($${paramIndex}::text[])
        )`);
        queryParams.push(categoryList);
        paramIndex++;
    }
  
    if (query.priceRange) {
      switch (query.priceRange) {
        case '0-100':
          whereClauses.push(`p.base_price <= $${paramIndex}`);
          queryParams.push(100);
          paramIndex++;
          break;
        case '100-250':
          whereClauses.push(`p.base_price > $${paramIndex} AND p.base_price <= $${paramIndex + 1}`);
          queryParams.push(100, 250);
          paramIndex += 2;
          break;
        case '250+':
          whereClauses.push(`p.base_price > $${paramIndex}`);
          queryParams.push(250);
          paramIndex++;
          break;
      }
    }
  
    if (whereClauses.length > 0) {
      baseQuery += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    baseQuery += ` GROUP BY p.id, pd.id`;
  
    if (query.sortBy === 'new') {
      baseQuery += ' ORDER BY p.created_at DESC';
    } else {
      baseQuery += ' ORDER BY p.name ASC';
    }
  
    const result = await db.query(baseQuery, queryParams);
    return result.rows;
  };