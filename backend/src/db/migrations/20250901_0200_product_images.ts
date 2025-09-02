import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('product_images');
  if (has) return;

  await knex.schema.createTable('product_images', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('product_id').notNullable()
      .references('id').inTable('products').onDelete('CASCADE');
    t.text('url').notNullable();
    t.text('thumb_url');
    t.text('alt');
    t.integer('width');
    t.integer('height');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(['product_id', 'sort_order']);
  });
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('product_images');
  if (has) await knex.schema.dropTable('product_images');
}
