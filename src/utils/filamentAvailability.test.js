// Тесты чистой логики доступности филаментов (Vitest).
// Запуск: pnpm test
import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildAvailabilityIndex,
  isPairAvailable,
  isMaterialAvailable,
  isColorAvailable,
  availableColorsForMaterial,
  availableMaterialsForColor,
  hasAnyAvailablePair,
  pickInitialPair,
  resolveAfterMaterialChange,
  resolveAfterColorChange,
  isFilamentMaterial,
} from './filamentAvailability.js';

// Типовой снимок склада: PLA доступен в Black/White, PETG в Gold, TPU:Black — нет.
const ITEMS = [
  { material: 'PLA', color: 'Black', available: true, available_weight_g: 4800, status: 'ok' },
  { material: 'PLA', color: 'White', available: true, available_weight_g: 900, status: 'low' },
  { material: 'PETG', color: 'Gold', available: true, available_weight_g: 1500, status: 'ok' },
  { material: 'TPU', color: 'Black', available: false, available_weight_g: 0, status: 'critical' },
];

const MATERIALS = ['PLA', 'PETG', 'TPU'];
const COLORS = ['Black', 'White', 'Gold'];

// 1. Первая доступная пара выбирается корректно.
test('pickInitialPair: первая доступная пара', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.deepEqual(pickInitialPair(index, MATERIALS, COLORS), { material: 'PLA', color: 'Black' });
});

test('pickInitialPair: пропускает недоступные пары в начале', () => {
  const index = buildAvailabilityIndex(ITEMS);
  // Для TPU нет ни одной доступной пары → первый доступный материал PETG:Gold,
  // но при порядке [TPU, PETG] первым доступным будет PETG:Gold.
  assert.deepEqual(pickInitialPair(index, ['TPU', 'PETG'], ['Black', 'Gold']), {
    material: 'PETG',
    color: 'Gold',
  });
});

// 2. Недоступная пара считается недоступной (для disabled-состояния кнопок).
test('isPairAvailable: доступные и недоступные пары', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.equal(isPairAvailable(index, 'PLA', 'Black'), true);
  assert.equal(isPairAvailable(index, 'PLA', 'White'), true);
  assert.equal(isPairAvailable(index, 'PETG', 'Gold'), true);
  // TPU:Black есть в ответе, но available:false
  assert.equal(isPairAvailable(index, 'TPU', 'Black'), false);
});

// 3. Выбор материала фильтрует цвета.
test('availableColorsForMaterial: материал фильтрует цвета', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.deepEqual(availableColorsForMaterial(index, 'PLA', COLORS), ['Black', 'White']);
  assert.deepEqual(availableColorsForMaterial(index, 'PETG', COLORS), ['Gold']);
  assert.deepEqual(availableColorsForMaterial(index, 'TPU', COLORS), []);
});

// 4. Выбор цвета фильтрует материалы.
test('availableMaterialsForColor: цвет фильтрует материалы', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.deepEqual(availableMaterialsForColor(index, 'Black', MATERIALS), ['PLA']);
  assert.deepEqual(availableMaterialsForColor(index, 'Gold', MATERIALS), ['PETG']);
  assert.deepEqual(availableMaterialsForColor(index, 'White', MATERIALS), ['PLA']);
});

// 5. При несовместимом старом выборе выбирается первая совместимая опция.
test('resolveAfterMaterialChange: несовместимый цвет → первый доступный', () => {
  const index = buildAvailabilityIndex(ITEMS);
  // Был выбран PLA:White. Меняем материал на PETG. White с PETG недоступен →
  // берём первый доступный цвет для PETG (Gold).
  const r = resolveAfterMaterialChange(index, MATERIALS, COLORS, 'PETG', 'White');
  assert.deepEqual(r, { material: 'PETG', color: 'Gold', compatible: true });
});

test('resolveAfterColorChange: несовместимый материал → первый доступный', () => {
  const index = buildAvailabilityIndex(ITEMS);
  // Был выбран PETG:Gold. Меняем цвет на Black. PETG:Black недоступен →
  // первый доступный материал для Black (PLA).
  const r = resolveAfterColorChange(index, MATERIALS, COLORS, 'Black', 'PETG');
  assert.deepEqual(r, { material: 'PLA', color: 'Black', compatible: true });
});

test('resolveAfterMaterialChange: совместимый цвет сохраняется', () => {
  const index = buildAvailabilityIndex(ITEMS);
  const r = resolveAfterMaterialChange(index, MATERIALS, COLORS, 'PLA', 'White');
  assert.deepEqual(r, { material: 'PLA', color: 'White', compatible: true });
});

// 6. При полном отсутствии доступных пар — блокировка (нет доступных комбинаций).
test('hasAnyAvailablePair: нет доступных пар → false, add заблокирован', () => {
  const index = buildAvailabilityIndex([
    { material: 'PLA', color: 'Red', available: false, available_weight_g: 0, status: 'critical' },
  ]);
  assert.equal(hasAnyAvailablePair(index, ['PLA'], ['Black', 'White']), false);
  assert.equal(pickInitialPair(index, ['PLA'], ['Black', 'White']), null);
});

// 7. Отсутствующая в ответе пара считается недоступной.
test('isPairAvailable: отсутствующая пара недоступна', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.equal(isPairAvailable(index, 'PETG', 'Black'), false); // такой пары нет в ответе
  assert.equal(isPairAvailable(index, 'ABS', 'Red'), false);
});

// 8. available:false считается недоступным.
test('buildAvailabilityIndex: available:false не попадает в индекс', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.equal(index.availableKeys.has('tpu::black'), false);
  assert.equal(isColorAvailable(index, 'Black', ['TPU']), false);
});

// 9. mapped:false не включает пару (такие позиции backend не отдаёт, но
//    подстрахуемся: без material/color в индекс не попадают).
test('buildAvailabilityIndex: позиции без material/color игнорируются', () => {
  const index = buildAvailabilityIndex([
    { material: null, color: null, available: true, available_weight_g: 100, status: 'ok' },
    { material: 'PLA', color: '', available: true, available_weight_g: 100, status: 'ok' },
    { color: 'Black', available: true, available_weight_g: 100, status: 'ok' },
  ]);
  assert.equal(index.availableKeys.size, 0);
});

// 10. Grey, Silver, Transparent, White, Gold, Bronze не смешиваются.
test('нормализация не сливает разные значения', () => {
  const index = buildAvailabilityIndex([
    { material: 'PLA', color: 'Grey', available: true, available_weight_g: 100, status: 'ok' },
    { material: 'PLA', color: 'Gold', available: true, available_weight_g: 100, status: 'ok' },
  ]);
  assert.equal(isPairAvailable(index, 'PLA', 'Grey'), true);
  assert.equal(isPairAvailable(index, 'PLA', 'Silver'), false); // Grey ≠ Silver
  assert.equal(isPairAvailable(index, 'PLA', 'Transparent'), false); // Transparent ≠ White
  assert.equal(isPairAvailable(index, 'PLA', 'Gold'), true);
  assert.equal(isPairAvailable(index, 'PLA', 'Bronze'), false); // Gold ≠ Bronze
});

test('сравнение устойчиво к регистру и пробелам, но не к содержимому', () => {
  const index = buildAvailabilityIndex([
    { material: ' pla ', color: 'BLACK', available: true, available_weight_g: 100, status: 'ok' },
  ]);
  assert.equal(isPairAvailable(index, 'PLA', 'black'), true);
  assert.equal(isPairAvailable(index, 'Pla', ' Black '), true);
});

// 13. Resin Standard не блокируется filament-проверкой (fail-open).
test('Resin Standard: неканонический материал не гейтится складом', () => {
  const index = buildAvailabilityIndex(ITEMS); // смолы там нет вовсе
  assert.equal(isFilamentMaterial('Resin Standard'), false);
  assert.equal(isPairAvailable(index, 'Resin Standard', 'Black'), true);
  assert.equal(hasAnyAvailablePair(index, ['Resin Standard'], ['Black']), true);
  // Первая доступная пара для смолы — просто первая пара товара (fail-open).
  assert.deepEqual(pickInitialPair(index, ['Resin Standard'], ['Grey']), {
    material: 'Resin Standard',
    color: 'Grey',
  });
});

// 11 (частично, логика fail-open реализуется в компоненте): пустой индекс.
test('пустой индекс: филамент недоступен, смола fail-open', () => {
  const index = buildAvailabilityIndex([]);
  assert.equal(isPairAvailable(index, 'PLA', 'Black'), false);
  assert.equal(isPairAvailable(index, 'Resin Standard', 'Black'), true);
});

test('isMaterialAvailable / isColorAvailable по товару', () => {
  const index = buildAvailabilityIndex(ITEMS);
  assert.equal(isMaterialAvailable(index, 'PLA', COLORS), true);
  assert.equal(isMaterialAvailable(index, 'TPU', COLORS), false);
  assert.equal(isColorAvailable(index, 'Black', MATERIALS), true);
  assert.equal(isColorAvailable(index, 'Gold', MATERIALS), true);
  // Цвет, которого нет ни в одной доступной паре товара.
  assert.equal(isColorAvailable(index, 'Purple', MATERIALS), false);
});
