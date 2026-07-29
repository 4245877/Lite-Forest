// Тесты идентичности строк корзины (Vitest).
// Запуск: pnpm test
import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  applySelectionToLines,
  baseLineIdOf,
  lineIdFor,
  mergeSameLines,
} from './cartLines.js';
import { allSelectionKeys } from './productModels.js';

// Товар из двух деталей: A (корпус) и B (крышка), по 100 грн каждая.
const MODELS = [
  { key: 'a', url: '/uploads/a.stl', name: 'corpus', price: 100 },
  { key: 'b', url: '/uploads/b.stl', name: 'lid', price: 100 },
];

const BASE = 'prod-1:default';

const line = (over = {}) => ({
  id: BASE,
  base_line_id: BASE,
  product_id: 'prod-1',
  name: 'Товар',
  price: 200,
  base_price: 200,
  qty: 1,
  models: MODELS,
  selected_model_keys: allSelectionKeys(MODELS),
  ...over,
});

test('baseLineIdOf отделяет базу от сигнатуры набора', () => {
  assert.equal(baseLineIdOf('prod-1:default#abc123'), 'prod-1:default');
  assert.equal(baseLineIdOf('prod-1:default'), 'prod-1:default');
  assert.equal(baseLineIdOf(''), '');
  assert.equal(baseLineIdOf(undefined), '');
});

test('lineIdFor: полный набор — id без суффикса (поведение как раньше)', () => {
  assert.equal(lineIdFor(BASE, MODELS, allSelectionKeys(MODELS)), BASE);
});

test('lineIdFor: частичный набор — свой id; разные наборы — разные id', () => {
  const idA = lineIdFor(BASE, MODELS, ['a']);
  const idB = lineIdFor(BASE, MODELS, ['b']);

  assert.notEqual(idA, BASE);
  assert.notEqual(idA, idB);
  assert.ok(idA.startsWith(`${BASE}#`));
});

test('lineIdFor: тот же набор — тот же id (порядок ключей не важен)', () => {
  assert.equal(lineIdFor(BASE, MODELS, ['a', 'b']), lineIdFor(BASE, MODELS, ['b', 'a']));
});

// Сценарий из аудита: добавить A → изменить строку на B → снова добавить A.
// Раньше id строки не менялся вместе с набором, поэтому повторное добавление A
// находило ту же строку и получалось B×2 вместо A + B.
test('редактирование набора меняет id строки — повторное добавление не сливается с чужим набором', () => {
  const items = [line({ id: lineIdFor(BASE, MODELS, ['a']), selected_model_keys: ['a'], qty: 1 })];

  const afterEdit = applySelectionToLines(items, items[0].id, ['b']);

  assert.equal(afterEdit.length, 1);
  assert.deepEqual(afterEdit[0].selected_model_keys, ['b']);
  assert.equal(afterEdit[0].id, lineIdFor(BASE, MODELS, ['b']), 'id обязан следовать за набором');
  assert.notEqual(afterEdit[0].id, lineIdFor(BASE, MODELS, ['a']));

  // Теперь строки с набором A в корзине нет — добавление A заведёт новую позицию.
  assert.equal(
    afterEdit.some((it) => it.id === lineIdFor(BASE, MODELS, ['a'])),
    false,
  );
});

test('редактирование в набор, который уже есть в корзине, сливает позиции', () => {
  const idA = lineIdFor(BASE, MODELS, ['a']);
  const idB = lineIdFor(BASE, MODELS, ['b']);

  const items = [
    line({ id: idA, selected_model_keys: ['a'], qty: 2 }),
    line({ id: idB, selected_model_keys: ['b'], qty: 3 }),
  ];

  // Меняем строку A на набор B — это та же позиция, что уже лежит в корзине.
  const next = applySelectionToLines(items, idA, ['b']);

  assert.equal(next.length, 1);
  assert.equal(next[0].id, idB);
  assert.equal(next[0].qty, 5, 'количества складываются');
});

test('цена строки пересчитывается пропорционально выбранным деталям', () => {
  const items = [line()];
  const next = applySelectionToLines(items, BASE, ['a']);

  assert.equal(next[0].price, 100, 'половина деталей по весу — половина цены');
  assert.equal(next[0].base_price, 200, 'полная цена сохраняется для обратимости');
});

test('пустой/невалидный выбор игнорируется: хотя бы одна деталь остаётся', () => {
  const items = [line()];

  assert.equal(applySelectionToLines(items, BASE, []), items);
  assert.equal(applySelectionToLines(items, BASE, ['nope']), items);
});

test('неизвестный id и товар без деталей не меняют корзину', () => {
  const items = [line()];

  assert.equal(applySelectionToLines(items, 'missing', ['a']), items);
  assert.equal(applySelectionToLines([line({ models: [] })], BASE, ['a'])[0].models.length, 0);
});

test('mergeSameLines складывает количества строк с одинаковым id', () => {
  const merged = mergeSameLines([
    line({ id: 'x', qty: 1 }),
    line({ id: 'y', qty: 2 }),
    line({ id: 'x', qty: 3 }),
  ]);

  assert.equal(merged.length, 2);
  assert.equal(merged.find((i) => i.id === 'x').qty, 4);
  assert.equal(merged.find((i) => i.id === 'y').qty, 2);
});

test('mergeSameLines не мутирует исходные объекты', () => {
  const a = line({ id: 'x', qty: 1 });
  const b = line({ id: 'x', qty: 3 });
  mergeSameLines([a, b]);

  assert.equal(a.qty, 1);
  assert.equal(b.qty, 3);
});
