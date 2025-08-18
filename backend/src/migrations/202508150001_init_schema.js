/** @param {import('knex').Knex} knex */
exports.up = async function(knex) {
  await knex.schema.createTable('categories', (t) => {
    t.bigIncrements('id').primary();
    t.text('name').notNullable();
    t.bigInteger('parent_id').nullable().references('categories.id');
  });

  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id').primary();
    t.text('sku').notNullable().unique();
    t.text('title').notNullable();
    t.text('short_description');
    t.text('description');
    t.integer('price_cents').notNullable();
    t.text('currency').notNullable().defaultTo('UAH');
    t.bigInteger('category_id').references('categories.id');
    t.text('brand');
    t.jsonb('attributes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // generated tsvector column
  await knex.raw(`ALTER TABLE products ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(short_description,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description,'')), 'C')
  ) STORED`);

  await knex.schema.createTable('media', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('product_id').nullable().references('products.id').onDelete('SET NULL');
    t.text('filename').notNullable();
    t.text('content_type').notNullable();
    t.bigInteger('size_bytes').notNullable();
    t.text('s3_key').notNullable();
    t.enu('processing_status', ['queued','processing','ready','failed']);
    t.integer('width');
    t.integer('height');
    t.jsonb('variants').defaultTo('[]');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('product_media', (t) => {
    t.bigInteger('product_id').references('products.id').onDelete('CASCADE');
    t.bigInteger('media_id').references('media.id').onDelete('CASCADE');
    t.integer('position').defaultTo(0);
    t.enu('role', ['primary','gallery']);
    t.primary(['product_id','media_id']);
  });

  // indexes
  await knex.raw('CREATE INDEX products_created_at_id_idx ON products (created_at DESC, id DESC)');
  await knex.raw('CREATE INDEX products_price_asc_id_idx ON products (price_cents ASC, id ASC)');
  await knex.raw('CREATE INDEX products_price_desc_id_idx ON products (price_cents DESC, id DESC)');
  await knex.raw('CREATE INDEX products_category_price_idx ON products (category_id, price_cents)');
  await knex.raw('CREATE INDEX products_brand_idx ON products (brand)');
  await knex.raw('CREATE INDEX products_attributes_gin ON products USING GIN (attributes jsonb_path_ops)');
  await knex.raw('CREATE INDEX products_search_tsv_gin ON products USING GIN (search_tsv)');
};

/** @param {import('knex').Knex} knex */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('product_media');
  await knex.schema.dropTableIfExists('media');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
};