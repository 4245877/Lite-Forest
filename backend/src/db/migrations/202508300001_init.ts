import type { Knex } from 'knex';


export async function up(knex: Knex): Promise<void> {
await knex.schema.createTable('products', (t) => {
t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
t.string('sku').notNullable().unique();
t.string('name').notNullable();
t.text('description');
t.decimal('price', 12, 2).notNullable().defaultTo(0);
t.string('currency').notNullable().defaultTo('UAH');
t.integer('stock').notNullable().defaultTo(0);
t.string('image_url');
t.timestamps(true, true);
t.index(['name']);
});
}


export async function down(knex: Knex): Promise<void> {
await knex.schema.dropTableIfExists('products');
}