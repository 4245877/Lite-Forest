import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCategories = await knex.schema.hasColumn('products', 'categories');
  const hasAttributes = await knex.schema.hasColumn('products', 'attributes');

  if (hasCategories && hasAttributes) return;

  await knex.schema.alterTable('products', (t) => {
    if (!hasCategories) t.specificType('categories', 'text[]').notNullable().defaultTo('{}');
    if (!hasAttributes) t.jsonb('attributes').notNullable().defaultTo('{}');
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasCategories = await knex.schema.hasColumn('products', 'categories');
  const hasAttributes = await knex.schema.hasColumn('products', 'attributes');

  await knex.schema.alterTable('products', (t) => {
    if (hasCategories) t.dropColumn('categories');
    if (hasAttributes) t.dropColumn('attributes');
  });
}
