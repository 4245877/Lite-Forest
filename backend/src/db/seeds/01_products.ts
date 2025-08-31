import type { Knex } from 'knex';


export async function seed(knex: Knex): Promise<void> {
await knex('products').del();
await knex('products').insert([
{ sku: 'SKU-001', name: 'Папка А4', description: 'Плотная бумага, печать', price: 120.00, currency: 'UAH', stock: 50 },
{ sku: 'SKU-002', name: 'Визитки 100 шт', description: 'Двусторонние', price: 300.00, currency: 'UAH', stock: 100 }
]);
}