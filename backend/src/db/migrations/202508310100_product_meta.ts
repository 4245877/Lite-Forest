import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (t) => {
    t.specificType('categories', 'text[]').notNullable().defaultTo('{}');
    t.jsonb('attributes').notNullable().defaultTo('{}');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (t) => {
    t.dropColumn('categories');
    t.dropColumn('attributes');
  });
}
