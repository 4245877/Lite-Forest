// Стенд браузерной проверки расширенного контента.
//
// Открывается как /dev/product-content-harness.html?scenario=<id> в dev-сервере
// Vite. Компонент и стили берутся ИЗ ИСХОДНИКОВ витрины — не копия и не
// упрощённая версия, иначе проверялся бы не тот код, который поедет на прод.
//
// Окружение повторяет страницу товара ровно в том, что влияет на раскладку:
//   • те же токены оформления (assets/styles/global.css);
//   • тот же контейнер .product-detail .pd-sections (grid), внутри которого
//     рендерер и живёт. Именно грид однажды и растянула широкая таблица.
//
// Сценарии перечислены в SCENARIOS и совпадают со списком в
// docs/product-content-browser-matrix.md.

import React from 'react';
import { createRoot } from 'react-dom/client';

import ProductContentRenderer from '../src/components/product/ProductContentRenderer.jsx';
import { selectProductContent } from '../src/utils/productContent.js';
import '../src/assets/styles/global.css';
import '../src/pages/ProductDetailPage.css';

const ASSET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Картинка, лежащая в public/ — реальный файл, а не заглушка. */
const REAL_IMAGE = '/logo.png';
const MISSING_IMAGE = '/uploads/content/no-such-file.png';

const envelope = (blocks, assets = {}) => ({
  schema_version: 1,
  locale: 'uk',
  document: { blocks },
  assets,
});

const paragraph = (id, text) => ({ id: uuid(id), type: 'paragraph', text });
const heading = (id, level, text) => ({ id: uuid(id), type: 'heading', level, text });

const image = (id, url, extra = {}) => ({
  block: { id: uuid(id), type: 'image', asset_id: ASSET, alt: extra.alt ?? 'Ілюстрація', caption: extra.caption },
  asset: {
    [uuid(id)]: {
      asset_id: ASSET,
      url,
      mime_type: 'image/png',
      width: extra.width ?? null,
      height: extra.height ?? null,
      alt: extra.alt ?? 'Ілюстрація',
      caption: extra.caption ?? null,
    },
  },
});

const LOREM =
  'Деталь друкується шаром 0,2 мм із заповненням 20 %. Після друку зніміть підтримки та зачистіть площину прилягання. ';

function wideTable(columns = 12, rows = 6) {
  return {
    id: uuid(60),
    type: 'table',
    columns: Array.from({ length: columns }, (_, i) => `Параметр ${i + 1}`),
    rows: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: columns }, (_, c) => `Значення ${r + 1}.${c + 1}`),
    ),
  };
}

function steps(count, withImages) {
  const items = [];
  const assets = {};

  for (let index = 0; index < count; index++) {
    const id = uuid(200 + index);
    const step = { id, title: `Крок ${index + 1}`, text: LOREM };

    if (withImages) {
      step.image = { asset_id: ASSET, alt: `Ілюстрація до кроку ${index + 1}` };
      assets[id] = {
        asset_id: ASSET,
        url: REAL_IMAGE,
        mime_type: 'image/png',
        width: 512,
        height: 512,
        alt: `Ілюстрація до кроку ${index + 1}`,
        caption: null,
      };
    }

    items.push(step);
  }

  return { block: { id: uuid(100), type: 'steps', items }, assets };
}

const allBlockTypes = () => {
  const img = image(70, REAL_IMAGE, { width: 512, height: 512, caption: 'Готова деталь' });
  const st = steps(3, false);

  return {
    content: envelope(
      [
        heading(1, 2, 'Перед складанням'),
        paragraph(2, LOREM.repeat(2)),
        { id: uuid(3), type: 'list', style: 'bullet', items: ['Викрутка PH1', 'Наждачний папір P400', 'Клей ПВА'] },
        { id: uuid(4), type: 'list', style: 'ordered', items: ['Зняти підтримки', 'Зачистити', 'Склеїти'] },
        heading(5, 3, 'Порядок робіт'),
        st.block,
        img.block,
        wideTable(4, 3),
        { id: uuid(80), type: 'callout', variant: 'warning', title: 'Увага', text: 'Не сушіть деталь феном.' },
      ],
      { ...img.asset, ...st.assets },
    ),
  };
};

/** id сценария → что показать. */
const SCENARIOS = {
  // 1
  paragraph_only: () => ({ content: envelope([paragraph(1, LOREM)]) }),
  // 2
  all_blocks: allBlockTypes,
  // 3
  long_list: () => ({
    content: envelope([
      { id: uuid(1), type: 'list', style: 'bullet', items: Array.from({ length: 80 }, (_, i) => `Пункт списку номер ${i + 1}`) },
    ]),
  }),
  // 4
  steps_30: () => {
    const st = steps(30, false);
    return { content: envelope([st.block], st.assets) };
  },
  // 5
  wide_table: () => ({ content: envelope([wideTable(12, 8)]) }),
  // 6
  table_long_words: () => ({
    content: envelope([
      {
        id: uuid(1),
        type: 'table',
        columns: ['Ключ', 'Значення'],
        rows: [
          ['Артикул', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
          ['Найдовше', 'найдовшеслововякеможебутивтаблицібезжоднихпробіліввзагалі'],
        ],
      },
    ]),
  }),
  // 7
  image_square: () => {
    const img = image(1, REAL_IMAGE, { width: 512, height: 512, caption: 'Квадратне зображення 1:1' });
    return { content: envelope([img.block], img.asset) };
  },
  // 8
  image_very_wide: () => {
    const img = image(1, REAL_IMAGE, { width: 4000, height: 400, caption: 'Дуже широке зображення' });
    return { content: envelope([img.block], img.asset) };
  },
  // 9
  image_very_tall: () => {
    const img = image(1, REAL_IMAGE, { width: 400, height: 4000, caption: 'Дуже високе зображення' });
    return { content: envelope([img.block], img.asset) };
  },
  // 10 — файла нет: <img> даст ошибку загрузки, страница обязана уцелеть.
  image_broken: () => {
    const img = image(1, MISSING_IMAGE, { width: 800, height: 600, caption: 'Файл відсутній' });
    return { content: envelope([paragraph(2, 'Текст поруч із битим зображенням.'), img.block], img.asset) };
  },
  // 11
  step_images: () => {
    const st = steps(4, true);
    return { content: envelope([st.block], st.assets) };
  },
  // 12
  no_content: () => ({ content: null }),
  // 13
  unknown_schema: () => ({ content: { ...envelope([paragraph(1, 'Текст')]), schema_version: 2 } }),
  // 14 — флаг выключен: рендерер не монтируется вовсе.
  flag_off: () => ({ content: envelope([paragraph(1, LOREM)]), enabled: false }),
  // 15
  collapsed_long: () => ({ content: envelope([heading(1, 2, 'Складання'), paragraph(2, LOREM.repeat(12))]) }),
  expanded_short: () => ({ content: envelope([paragraph(1, 'Короткий опис товару.')]) }),
};

function Harness() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('scenario') || 'all_blocks';
  const build = SCENARIOS[name] ?? SCENARIOS.all_blocks;
  const { content, enabled = true } = build();

  // Тот же путь, что на странице товара: флаг решает, разбирать ли документ.
  const value = selectProductContent({ content }, { enabled });

  return (
    <div className="product-detail" data-scenario={name}>
      <div className="pd-container">
        <h1>Тестовий товар</h1>

        <section className="pd-sections">
          <div className="pd-section">
            <h2>Опис</h2>
            <div className="content">
              <p>Коротке описання з products.description — воно є завжди.</p>
            </div>
          </div>

          {value && (
            <div className="pd-section pd-section--content">
              <ProductContentRenderer value={value} />
            </div>
          )}

          <div className="pd-section">
            <h2>Характеристики виробу</h2>
            <div className="content">
              <div className="table-wrap">
                <table className="specs">
                  <tbody>
                    <tr>
                      <th>Матеріал</th>
                      <td>PLA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
