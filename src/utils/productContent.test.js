// Модульные тесты разбора расширенного контента товара (Vitest). Запуск: pnpm test
//
// Проверяется то, ради чего разбор вынесен из компонента: что витрина не верит
// пришедшим данным. Каждый кейс — это способ, которым документ может оказаться
// кривым (старый backend, кеш, ручная правка в psql, злонамеренный ответ), и
// ожидание всегда одно: страница остаётся целой, а теряется ровно сломанный кусок.
import { describe, expect, test } from 'vitest';

import {
  isSafeContentImageUrl,
  isShortProductContent,
  measureContentWeight,
  normalizeProductContent,
  PRODUCT_CONTENT_BLOCK_TYPES,
  PRODUCT_CONTENT_SHORT_WEIGHT,
  selectProductContent,
} from './productContent.js';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';
const BLOCK_ID = '22222222-2222-4222-8222-222222222222';
const STEP_ID = '33333333-3333-4333-8333-333333333333';

/** Минимальный корректный конверт контента. */
const content = (blocks, assets = {}) => ({
  schema_version: 1,
  locale: 'uk',
  document: { blocks },
  assets,
});

const imageAsset = (overrides = {}) => ({
  asset_id: ASSET_ID,
  url: '/uploads/content/photo.png',
  mime_type: 'image/png',
  width: 800,
  height: 600,
  alt: 'Готова деталь',
  caption: 'Після шліфування',
  ...overrides,
});

const paragraph = (id = BLOCK_ID, text = 'Текст') => ({ id, type: 'paragraph', text });

describe('конверт контента', () => {
  test('пустой/непонятный вход — это отсутствие контента, а не исключение', () => {
    expect(normalizeProductContent(undefined)).toBeNull();
    expect(normalizeProductContent(null)).toBeNull();
    expect(normalizeProductContent('строка')).toBeNull();
    expect(normalizeProductContent([])).toBeNull();
    expect(normalizeProductContent({})).toBeNull();
  });

  test('чужая версия формата не разбирается правилами v1', () => {
    expect(normalizeProductContent({ ...content([paragraph()]), schema_version: 2 })).toBeNull();
    expect(normalizeProductContent({ ...content([paragraph()]), schema_version: '1' })).not.toBeNull();
  });

  test('документ без единого пригодного блока = контента нет', () => {
    expect(normalizeProductContent(content([]))).toBeNull();
    expect(normalizeProductContent(content([{ id: BLOCK_ID, type: 'paragraph', text: '   ' }]))).toBeNull();
    expect(normalizeProductContent(content('не массив'))).toBeNull();
  });

  test('локаль пробрасывается для атрибута lang', () => {
    expect(normalizeProductContent(content([paragraph()])).locale).toBe('uk');
    expect(normalizeProductContent({ ...content([paragraph()]), locale: 42 }).locale).toBeNull();
  });
});

describe('allowlist блоков', () => {
  test('список типов закрыт и содержит ровно поддерживаемые блоки', () => {
    expect([...PRODUCT_CONTENT_BLOCK_TYPES].sort()).toEqual([
      'callout',
      'heading',
      'image',
      'list',
      'paragraph',
      'sections',
      'steps',
      'table',
    ]);
  });

  test('неизвестный тип блока пропускается, соседние блоки остаются', () => {
    const result = normalizeProductContent(
      content([
        { id: 'a1', type: 'script', text: 'alert(1)' },
        { id: 'a2', type: 'html', html: '<img onerror=alert(1)>' },
        paragraph('a3', 'Живой абзац'),
      ]),
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({ type: 'paragraph', text: 'Живой абзац' });
  });

  test('блок без id, не-объект и дубликат id пропускаются', () => {
    const result = normalizeProductContent(
      content([
        null,
        'paragraph',
        { type: 'paragraph', text: 'без id' },
        paragraph('dup', 'первый'),
        paragraph('dup', 'второй'),
      ]),
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].text).toBe('первый');
  });
});

describe('текстовые блоки', () => {
  test('абзац сохраняет переводы строк, но чистит управляющие символы', () => {
    const result = normalizeProductContent(
      content([paragraph(BLOCK_ID, ' Первая строка\r\nВторая\u0000 строка ')]),
    );

    expect(result.blocks[0].text).toBe('Первая строка\nВторая строка');
  });

  test('заголовок: уровень из 2–4, непонятный прижимается к 3, перевод строки схлопывается', () => {
    const result = normalizeProductContent(
      content([
        { id: 'h2', type: 'heading', level: 2, text: 'Второй' },
        { id: 'h9', type: 'heading', level: 9, text: 'Девятый' },
        { id: 'h1', type: 'heading', level: 1, text: 'Первый' },
        { id: 'hn', type: 'heading', level: 3, text: 'С переводом\nстроки' },
        { id: 'he', type: 'heading', level: 2, text: '  ' },
      ]),
    );

    expect(result.blocks.map((block) => [block.id, block.level, block.text])).toEqual([
      ['h2', 2, 'Второй'],
      ['h9', 3, 'Девятый'],
      ['h1', 3, 'Первый'],
      ['hn', 3, 'С переводом строки'],
    ]);
  });

  test('список: стиль по умолчанию bullet, пустые пункты выброшены, пустой список пропущен', () => {
    const result = normalizeProductContent(
      content([
        { id: 'l1', type: 'list', style: 'ordered', items: ['Раз', '  ', 'Два', 42] },
        { id: 'l2', type: 'list', style: 'диковинный', items: ['Пункт'] },
        { id: 'l3', type: 'list', style: 'bullet', items: [] },
        { id: 'l4', type: 'list', style: 'bullet', items: 'не массив' },
      ]),
    );

    expect(result.blocks).toEqual([
      { type: 'list', id: 'l1', ordered: true, items: ['Раз', 'Два'] },
      { type: 'list', id: 'l2', ordered: false, items: ['Пункт'] },
    ]);
  });

  test('выноска: неизвестный вариант становится info, без текста блока нет', () => {
    const result = normalizeProductContent(
      content([
        { id: 'c1', type: 'callout', variant: 'danger', title: 'Небезпечно', text: 'Не чіпайте' },
        { id: 'c2', type: 'callout', variant: 'rainbow', text: 'Текст' },
        { id: 'c3', type: 'callout', variant: 'info', text: '' },
      ]),
    );

    expect(result.blocks).toEqual([
      { type: 'callout', id: 'c1', variant: 'danger', title: 'Небезпечно', text: 'Не чіпайте' },
      { type: 'callout', id: 'c2', variant: 'info', title: null, text: 'Текст' },
    ]);
  });
});

describe('таблица', () => {
  test('прямоугольная таблица проходит как есть', () => {
    const result = normalizeProductContent(
      content([
        {
          id: 't1',
          type: 'table',
          columns: ['Параметр', 'Значення'],
          rows: [['Шар', '0,2 мм'], ['Заповнення', '20%']],
        },
      ]),
    );

    expect(result.blocks[0]).toEqual({
      type: 'table',
      id: 't1',
      columns: ['Параметр', 'Значення'],
      rows: [['Шар', '0,2 мм'], ['Заповнення', '20%']],
    });
  });

  test('рваная таблица достраивается до прямоугольника, а не теряет данные', () => {
    const result = normalizeProductContent(
      content([
        {
          id: 't2',
          type: 'table',
          columns: ['A', 'B'],
          rows: [['1'], ['1', '2', '3'], 'не строка'],
        },
      ]),
    );

    expect(result.blocks[0].columns).toEqual(['A', 'B', '']);
    expect(result.blocks[0].rows).toEqual([
      ['1', '', ''],
      ['1', '2', '3'],
    ]);
  });

  test('таблица без колонок или без строк пропускается', () => {
    const result = normalizeProductContent(
      content([
        { id: 't3', type: 'table', columns: [], rows: [['1']] },
        { id: 't4', type: 'table', columns: ['A'], rows: [] },
        { id: 't5', type: 'table', columns: 'A', rows: [['1']] },
        paragraph('ok', 'Живой'),
      ]),
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('paragraph');
  });
});

describe('картинки', () => {
  test('image-блок берёт файл из карты assets по id блока', () => {
    const result = normalizeProductContent(
      content([{ id: BLOCK_ID, type: 'image', asset_id: ASSET_ID, alt: 'Готова деталь' }], {
        [BLOCK_ID]: imageAsset(),
      }),
    );

    expect(result.blocks[0]).toEqual({
      type: 'image',
      id: BLOCK_ID,
      image: {
        url: '/uploads/content/photo.png',
        alt: 'Готова деталь',
        caption: 'Після шліфування',
        width: 800,
        height: 600,
      },
    });
  });

  test('image-блок без пригодной картинки выбрасывается целиком', () => {
    const cases = [
      {},
      { [BLOCK_ID]: imageAsset({ url: '' }) },
      { [BLOCK_ID]: imageAsset({ url: 'https://evil.example/pixel.png' }) },
      { [BLOCK_ID]: imageAsset({ url: '//evil.example/pixel.png' }) },
      { [BLOCK_ID]: imageAsset({ url: 'javascript:alert(1)' }) },
      { [BLOCK_ID]: imageAsset({ url: 'data:image/svg+xml,<svg onload=alert(1)>' }) },
      // связь указывает на другой файл, чем документ — стороны разъехались
      { [BLOCK_ID]: imageAsset({ asset_id: 'другой-файл' }) },
      { [BLOCK_ID]: 'строка вместо объекта' },
    ];

    for (const assets of cases) {
      const result = normalizeProductContent(
        content([{ id: BLOCK_ID, type: 'image', asset_id: ASSET_ID, alt: 'alt' }], assets),
      );

      expect(result).toBeNull();
    }
  });

  test('пустой alt сохраняется как пустой (декоративная картинка)', () => {
    const result = normalizeProductContent(
      content([{ id: BLOCK_ID, type: 'image', asset_id: ASSET_ID, alt: '' }], {
        [BLOCK_ID]: imageAsset({ alt: '', caption: null }),
      }),
    );

    expect(result.blocks[0].image.alt).toBe('');
    expect(result.blocks[0].image.caption).toBeNull();
  });

  test('нечисловые размеры не превращаются в атрибуты', () => {
    const result = normalizeProductContent(
      content([{ id: BLOCK_ID, type: 'image', asset_id: ASSET_ID, alt: 'a' }], {
        [BLOCK_ID]: imageAsset({ width: null, height: 'широкая' }),
      }),
    );

    expect(result.blocks[0].image).toMatchObject({ width: null, height: null });
  });

  test('isSafeContentImageUrl пропускает только собственный путь от корня', () => {
    expect(isSafeContentImageUrl('/uploads/a.png')).toBe(true);
    expect(isSafeContentImageUrl('//cdn.example/a.png')).toBe(false);
    expect(isSafeContentImageUrl('https://cdn.example/a.png')).toBe(false);
    expect(isSafeContentImageUrl('uploads/a.png')).toBe(false);
    expect(isSafeContentImageUrl(null)).toBe(false);
  });
});

describe('инструкция (steps)', () => {
  const stepsBlock = (items) => ({ id: BLOCK_ID, type: 'steps', items });

  test('картинка шага ищется по id ШАГА, а не блока', () => {
    const result = normalizeProductContent(
      content(
        [
          stepsBlock([
            {
              id: STEP_ID,
              title: 'Крок 1',
              text: 'Зніміть підпори',
              image: { asset_id: ASSET_ID, alt: 'Підпори' },
            },
          ]),
        ],
        { [STEP_ID]: imageAsset({ alt: 'Підпори', caption: null }) },
      ),
    );

    expect(result.blocks[0].items[0]).toMatchObject({
      title: 'Крок 1',
      text: 'Зніміть підпори',
      image: { url: '/uploads/content/photo.png', alt: 'Підпори' },
    });
  });

  test('недоступная картинка снимает только поле image — текст шага остаётся', () => {
    const result = normalizeProductContent(
      content(
        [
          stepsBlock([
            { id: STEP_ID, text: 'Важлива інструкція', image: { asset_id: ASSET_ID, alt: 'x' } },
          ]),
        ],
        {},
      ),
    );

    expect(result.blocks[0].items).toHaveLength(1);
    expect(result.blocks[0].items[0].text).toBe('Важлива інструкція');
    expect(result.blocks[0].items[0].image).toBeNull();
  });

  test('шаг без текста пропускается; блок без единого шага — тоже', () => {
    const result = normalizeProductContent(
      content([
        stepsBlock([{ text: '  ' }, null, { text: 'Живой шаг' }]),
        { id: 'empty', type: 'steps', items: [{ text: '' }] },
        { id: 'broken', type: 'steps', items: 'не массив' },
      ]),
    );

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].items).toHaveLength(1);
    expect(result.blocks[0].items[0].text).toBe('Живой шаг');
  });

  test('шаг без id получает стабильный key от блока и позиции', () => {
    const result = normalizeProductContent(content([stepsBlock([{ text: 'Раз' }, { text: 'Два' }])]));

    expect(result.blocks[0].items.map((step) => step.key)).toEqual([`${BLOCK_ID}:0`, `${BLOCK_ID}:1`]);
  });
});

describe('секции (open/collapsed)', () => {
  const section = (overrides = {}) => ({
    id: 'sec-1',
    title: 'Догляд',
    blocks: [paragraph('inner', 'Мийте теплою водою')],
    ...overrides,
  });

  const sectionsBlock = (items) => ({ id: BLOCK_ID, type: 'sections', items });

  test('collapsed и open задают только НАЧАЛЬНОЕ состояние', () => {
    const result = normalizeProductContent(
      content([
        sectionsBlock([
          section({ id: 's-open', collapsed: false }),
          section({ id: 's-collapsed', collapsed: true }),
          section({ id: 's-open-flag', open: true }),
          section({ id: 's-state', state: 'collapsed' }),
          section({ id: 's-default' }),
        ]),
      ]),
    );

    expect(result.blocks[0].items.map((item) => [item.key, item.defaultOpen])).toEqual([
      ['s-open', true],
      ['s-collapsed', false],
      ['s-open-flag', true],
      ['s-state', false],
      ['s-default', true],
    ]);
  });

  test('секция без заголовка или без пригодных блоков пропускается', () => {
    const result = normalizeProductContent(
      content([
        sectionsBlock([
          section({ title: '   ' }),
          section({ blocks: [] }),
          section({ blocks: [{ id: 'x', type: 'script', text: 'alert(1)' }] }),
        ]),
      ]),
    );

    expect(result).toBeNull();
  });

  test('вложенные блоки проходят тот же allowlist и находят свои картинки', () => {
    const result = normalizeProductContent(
      content(
        [
          sectionsBlock([
            section({
              blocks: [
                { id: 'evil', type: 'iframe', src: 'https://evil.example' },
                { id: BLOCK_ID, type: 'image', asset_id: ASSET_ID, alt: 'Деталь' },
              ],
            }),
          ]),
        ],
        { [BLOCK_ID]: imageAsset({ alt: 'Деталь' }) },
      ),
    );

    const inner = result.blocks[0].items[0].blocks;
    expect(inner).toHaveLength(1);
    expect(inner[0]).toMatchObject({ type: 'image', image: { url: '/uploads/content/photo.png' } });
  });

  test('секция внутри секции не рисуется (защита от бесконечной вложенности)', () => {
    const result = normalizeProductContent(
      content([
        sectionsBlock([
          section({
            blocks: [
              { id: 'nested', type: 'sections', items: [section({ id: 'deep' })] },
              paragraph('flat', 'Плоский абзац'),
            ],
          }),
        ]),
      ]),
    );

    const inner = result.blocks[0].items[0].blocks;
    expect(inner).toHaveLength(1);
    expect(inner[0].type).toBe('paragraph');
  });
});

describe('selectProductContent (фича-флаг)', () => {
  const product = { id: 1, description: 'Краткое описание', content: content([paragraph()]) };

  test('при выключенном флаге контент не разбирается вовсе', () => {
    expect(selectProductContent(product, { enabled: false })).toBeNull();
    expect(selectProductContent(product, { enabled: undefined })).toBeNull();
  });

  test('при включённом флаге отдаёт разобранный документ', () => {
    expect(selectProductContent(product, { enabled: true }).blocks).toHaveLength(1);
  });

  test('товар без контента не ломает выбор', () => {
    expect(selectProductContent(null, { enabled: true })).toBeNull();
    expect(selectProductContent({ id: 1 }, { enabled: true })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Объём документа — по нему решается, раскрывать ли расширенный опис сразу.
// ─────────────────────────────────────────────────────────────────────────────
describe('измерение объёма', () => {
  const weightOf = (blocks, assets) => {
    const normalized = normalizeProductContent(content(blocks, assets));
    return normalized ? measureContentWeight(normalized.blocks) : 0;
  };

  test('пустой и непонятный вход считается нулём, а не падает', () => {
    expect(measureContentWeight(null)).toBe(0);
    expect(measureContentWeight([])).toBe(0);
    expect(measureContentWeight([{ type: 'unknown-from-the-future' }])).toBe(0);
  });

  test('текст блоков складывается', () => {
    expect(weightOf([{ id: BLOCK_ID, type: 'paragraph', text: 'а'.repeat(50) }])).toBe(50);
  });

  test('в счёт идут все места, где автор пишет текст', () => {
    const weight = weightOf([
      { id: BLOCK_ID, type: 'table', columns: ['аб', 'вг'], rows: [['де', 'єж']] },
    ]);
    expect(weight).toBe(8);
  });

  test('картинка весит, хотя символов не несёт', () => {
    const assets = { [BLOCK_ID]: { asset_id: ASSET_ID, url: '/uploads/images/a.jpg', alt: '' } };
    const weight = weightOf([{ id: BLOCK_ID, type: 'image', image: { asset_id: ASSET_ID, alt: '' } }], assets);

    // Иначе галерея из десятка фотографий считалась бы «коротким документом» и
    // разворачивалась на весь экран.
    expect(weight).toBeGreaterThan(0);
  });

  test('короткий раскрыт, длинный свёрнут — граница ровно на пороге', () => {
    const short = normalizeProductContent(
      content([{ id: BLOCK_ID, type: 'paragraph', text: 'а'.repeat(PRODUCT_CONTENT_SHORT_WEIGHT) }]),
    );
    const long = normalizeProductContent(
      content([{ id: BLOCK_ID, type: 'paragraph', text: 'а'.repeat(PRODUCT_CONTENT_SHORT_WEIGHT + 1) }]),
    );

    expect(isShortProductContent(short)).toBe(true);
    expect(isShortProductContent(long)).toBe(false);
  });

  test('пустой результат разбора — не «короткий документ»', () => {
    expect(isShortProductContent(null)).toBe(false);
    expect(isShortProductContent({})).toBe(false);
  });
});
