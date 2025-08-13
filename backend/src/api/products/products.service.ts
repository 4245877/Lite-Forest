// backend/src/api/products/products.service.ts
import db from '../../db';

export interface ProductInput {
  name: string;
  sku?: string;
  price?: number;
  description?: string;
  photos?: string[]; // публичные URL (после загрузки)
  categories?: string[]; // список имён категорий
  stock?: number;
  // ... другие поля
}

export const createProduct = async (productData: ProductInput) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const insertProductSql = `
      INSERT INTO products (name, sku, base_price, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, sku, base_price;
    `;
    const pRes = await client.query(insertProductSql, [
      productData.name,
      productData.sku || null,
      productData.price || 0,
      productData.description || null
    ]);
    const productId = pRes.rows[0].id;

    const specs = {
      stock: productData.stock ?? 0
      // add more fields if needed
    };

    await client.query(
      `INSERT INTO product_details (product_id, specifications) VALUES ($1, $2)`,
      [productId, specs]
    );

    // categories: ensure categories exist, then insert into product_categories
    if (productData.categories && productData.categories.length) {
      // upsert categories and link them
      for (const catName of productData.categories) {
        const catRes = await client.query(
          `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [catName]
        );
        const categoryId = catRes.rows[0].id;
        await client.query(
          `INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [productId, categoryId]
        );
      }
    }

    // media
    if (productData.photos && productData.photos.length) {
      let order = 0;
      const mediaInsert = `INSERT INTO media (product_id, url, sort_order) VALUES ($1, $2, $3)`;
      for (const url of productData.photos) {
        await client.query(mediaInsert, [productId, url, order++]);
      }
    }

    await client.query('COMMIT');

    return { id: productId, message: 'Товар успешно создан' };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createProduct transaction error', err);
    throw err;
  } finally {
    client.release();
  }
};
