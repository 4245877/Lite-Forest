/** @param {import('knex').Knex} knex */
exports.up = async function(knex) {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await knex.raw("CREATE EXTENSION IF NOT EXISTS unaccent");

  // updated_at триггер
  await knex.raw(`CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`);

  await knex.raw(`DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);

  // триграмма для fallback поиска (ILIKE)
  await knex.raw('CREATE INDEX IF NOT EXISTS products_title_trgm ON products USING GIN (title gin_trgm_ops)');
};

/** @param {import('knex').Knex} knex */
exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS products_title_trgm');
  await knex.raw('DROP TRIGGER IF EXISTS trg_products_updated_at ON products');
  await knex.raw('DROP FUNCTION IF EXISTS set_updated_at');
  // расширения оставляем (no-op на down)
};