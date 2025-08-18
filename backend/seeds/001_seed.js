/** @param {import('knex').Knex} knex */
exports.seed = async function(knex) {
  await knex('product_media').del();
  await knex('media').del();
  await knex('products').del();
  await knex('categories').del();

  const [rootId] = await knex('categories').insert({ name: 'Root' }).returning('id');
  const [catA] = await knex('categories').insert({ name: 'Books', parent_id: rootId.id || rootId }).returning('id');
  const [catB] = await knex('categories').insert({ name: 'Gadgets', parent_id: rootId.id || rootId }).returning('id');

  const now = new Date();
  const products = [];
  for (let i = 1; i <= 25; i++) {
    products.push({
      sku: `SKU-${1000 + i}`,
      title: `Sample Product ${i}`,
      short_description: `Short description ${i}`,
      description: `Long description for product ${i}`,
      price_cents: 1000 + i * 37,
      currency: 'UAH',
      category_id: i % 2 ? (catA.id || catA) : (catB.id || catB),
      brand: i % 2 ? 'BrandA' : 'BrandB',
      attributes: JSON.stringify({ color: i % 2 ? 'red' : 'blue', size: i % 3 ? 'M' : 'L' }),
      created_at: new Date(now.getTime() - i * 3600_000),
      updated_at: new Date(now.getTime() - i * 3600_000)
    });
  }
  const inserted = await knex('products').insert(products).returning('id');

  // простые медиа для первых 5 товаров
  for (let i = 0; i < 5; i++) {
    const pid = inserted[i].id || inserted[i];
    const [mid] = await knex('media').insert({
      product_id: pid,
      filename: `p${pid}.jpg`,
      content_type: 'image/jpeg',
      size_bytes: 123456,
      s3_key: `media/p${pid}.jpg`,
      processing_status: 'ready',
      width: 800, height: 800,
      variants: JSON.stringify([{ type: 'large', width: 800, height: 800, url: '' }, { type: 'thumb', width: 240, height: 240, url: '' }])
    }).returning('id');

    await knex('product_media').insert({ product_id: pid, media_id: mid.id || mid, position: 0, role: 'primary' });
  }
};