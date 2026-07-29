// Компонентные тесты рендерера расширенного контента (Vitest + Testing Library).
// Запуск: pnpm test
//
// Модульные тесты разбора лежат в utils/productContent.test.js — здесь проверяется
// то, что видно в DOM: семантические теги, доступность (роли, alt, подписи,
// клавиатура), ленивая загрузка картинок, прокручиваемая таблица и то, что
// ничего похожего на разметку из документа в DOM не превращается.
import React from 'react';
import { describe, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProductContentRenderer from './ProductContentRenderer.jsx';

const ASSET_ID = '11111111-1111-4111-8111-111111111111';
const STEP_ID = '33333333-3333-4333-8333-333333333333';

const content = (blocks, assets = {}) => ({
  schema_version: 1,
  locale: 'uk',
  document: { blocks },
  assets,
});

const renderContent = (blocks, assets) =>
  render(<ProductContentRenderer content={content(blocks, assets)} />);

describe('пустой и непригодный контент', () => {
  test('не рисует ничего — даже обёртки', () => {
    const { container } = render(<ProductContentRenderer content={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('документ чужой версии не рисуется', () => {
    const { container } = render(
      <ProductContentRenderer content={{ ...content([{ id: 'p', type: 'paragraph', text: 'Т' }]), schema_version: 2 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('семантическая разметка блоков', () => {
  test('абзац печатается как <p>, а разметка внутри текста остаётся текстом', () => {
    const dangerous = 'Ширина <b>200</b> мм <script>alert(1)</script>';
    const { container } = renderContent([{ id: 'p1', type: 'paragraph', text: dangerous }]);

    const paragraph = screen.getByText(dangerous);
    expect(paragraph.tagName).toBe('P');
    // Ни одного настоящего тега из текста: React печатает его как текст, а
    // dangerouslySetInnerHTML в компоненте нет вовсе.
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  test('заголовки печатаются своим уровнем (h1 занят названием товара)', () => {
    renderContent([
      { id: 'h1', type: 'heading', level: 2, text: 'Опис' },
      { id: 'h2', type: 'heading', level: 3, text: 'Матеріали' },
      { id: 'h3', type: 'heading', level: 4, text: 'Деталі' },
    ]);

    expect(screen.getByRole('heading', { level: 2, name: 'Опис' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Матеріали' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Деталі' })).toBeInTheDocument();
    // h1 рендерер не печатает никогда — иначе на странице два первых заголовка.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  test('списки: ul для маркированного, ol для нумерованного', () => {
    const { container } = renderContent([
      { id: 'l1', type: 'list', style: 'bullet', items: ['Раз', 'Два'] },
      { id: 'l2', type: 'list', style: 'ordered', items: ['Крок'] },
    ]);

    expect(container.querySelector('ul.pc-list--bullet')).toBeInTheDocument();
    expect(container.querySelector('ol.pc-list--ordered')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  test('выноска — <aside> с текстовой подписью варианта, а не одним цветом', () => {
    renderContent([
      { id: 'c1', type: 'callout', variant: 'danger', text: 'Не мийте в посудомийці' },
      { id: 'c2', type: 'callout', variant: 'warning', title: 'Обережно', text: 'Гострі краї' },
    ]);

    // Вариант без своего заголовка получает подпись по смыслу: человек, который
    // не различает цвета, обязан понять, что это предупреждение.
    const danger = screen.getByRole('complementary', { name: 'Важливо' });
    expect(within(danger).getByText('Не мийте в посудомийці')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Обережно' })).toBeInTheDocument();
  });
});

describe('картинки', () => {
  const asset = (overrides = {}) => ({
    asset_id: ASSET_ID,
    url: '/uploads/content/photo.png',
    mime_type: 'image/png',
    width: 800,
    height: 600,
    alt: 'Готова деталь',
    caption: 'Після шліфування',
    ...overrides,
  });

  test('картинка ленивая, с alt, подписью и размерами', () => {
    renderContent([{ id: 'i1', type: 'image', asset_id: ASSET_ID, alt: 'Готова деталь' }], {
      i1: asset(),
    });

    const img = screen.getByRole('img', { name: 'Готова деталь' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    // width/height — резерв места: без них страница прыгает по мере загрузки.
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '600');
    expect(img.getAttribute('src')).toContain('/uploads/content/photo.png');

    // Подпись — <figcaption> внутри <figure>, а не абзац рядом.
    const figure = img.closest('figure');
    expect(within(figure).getByText('Після шліфування')).toBeInTheDocument();
  });

  test('декоративная картинка получает alt="" и не попадает в дерево доступности', () => {
    renderContent([{ id: 'i1', type: 'image', asset_id: ASSET_ID, alt: '' }], {
      i1: asset({ alt: '', caption: null }),
    });

    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('img')).toHaveAttribute('alt', '');
  });

  test('чужой адрес картинки не превращается в src', () => {
    const { container } = renderContent([{ id: 'i1', type: 'image', asset_id: ASSET_ID, alt: 'a' }], {
      i1: asset({ url: 'https://evil.example/pixel.png' }),
    });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('инструкция', () => {
  test('шаги — нумерованный список; заголовок шага не создаёт лишний уровень заголовков', () => {
    const { container } = renderContent([
      {
        id: 'st',
        type: 'steps',
        items: [
          { id: STEP_ID, title: 'Крок 1', text: 'Зніміть підпори', image: { asset_id: ASSET_ID, alt: 'Підпори' } },
          { text: 'Відшліфуйте зріз' },
        ],
      },
    ], {
      [STEP_ID]: {
        asset_id: ASSET_ID,
        url: '/uploads/content/step.png',
        alt: 'Підпори',
        caption: null,
        width: null,
        height: null,
      },
    });

    const steps = container.querySelector('ol.pc-steps');
    expect(steps).toBeInTheDocument();
    expect(within(steps).getAllByRole('listitem')).toHaveLength(2);

    // Порядок шагов несёт <ol>, поэтому заголовок шага НЕ является <h*>:
    // произвольный h3 внутри документа с собственной иерархией ломал бы её.
    expect(screen.queryByRole('heading', { name: 'Крок 1' })).toBeNull();
    expect(screen.getByText('Крок 1')).toBeInTheDocument();

    // Картинка шага берётся по id ШАГА и тоже ленивая.
    const img = screen.getByRole('img', { name: 'Підпори' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img.getAttribute('src')).toContain('/uploads/content/step.png');
    // Размеров нет — атрибуты не выдумываются.
    expect(img).not.toHaveAttribute('width');
  });

  test('шаг с недоступной картинкой сохраняет текст инструкции', () => {
    renderContent([
      { id: 'st', type: 'steps', items: [{ id: STEP_ID, text: 'Важлива дія', image: { asset_id: ASSET_ID, alt: 'x' } }] },
    ]);

    expect(screen.getByText('Важлива дія')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('таблица', () => {
  const table = {
    id: 't1',
    type: 'table',
    columns: ['Параметр', 'Значення'],
    rows: [['Шар', '0,2 мм'], ['Заповнення', '20%']],
  };

  test('заголовки колонок — <th scope="col">', () => {
    renderContent([table]);

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((cell) => cell.textContent)).toEqual(['Параметр', 'Значення']);
    for (const header of headers) expect(header).toHaveAttribute('scope', 'col');
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  test('таблица прокручивается по горизонтали и доступна с клавиатуры', () => {
    renderContent([table]);

    // Прокручиваемая область, до которой нельзя добраться табом, — недоступный
    // кусок страницы, поэтому region + tabIndex + подпись обязательны вместе.
    const region = screen.getByRole('region', { name: 'Таблиця: Параметр, Значення' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.className).toContain('pc-table-wrap');
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });
});

describe('секции', () => {
  const sections = (items) => ({ id: 'sec', type: 'sections', items });

  const section = (overrides = {}) => ({
    id: 'sec-1',
    title: 'Догляд',
    blocks: [{ id: 'inner-1', type: 'paragraph', text: 'Мийте теплою водою' }],
    ...overrides,
  });

  test('раскрытая секция открыта, свёрнутая — закрыта', () => {
    const { container } = renderContent([
      sections([
        section({ id: 'a', title: 'Відкрита', collapsed: false }),
        section({ id: 'b', title: 'Згорнута', collapsed: true }),
      ]),
    ]);

    // Именно .pc-sections__item, а не любой <details>: весь расширенный опис
    // теперь тоже лежит в раскрывающейся обёртке, и «первый details на странице»
    // — это она, а не секция документа.
    const [open, collapsed] = container.querySelectorAll('details.pc-sections__item');
    expect(open).toHaveAttribute('open');
    expect(collapsed).not.toHaveAttribute('open');
    // Управление раскрытием — родное <summary>: работает с клавиатуры, попадает
    // во встроенный поиск по странице и не требует JS.
    expect(open.querySelector('summary').textContent).toBe('Відкрита');
  });

  test('свёрнутая секция раскрывается активацией <summary>', async () => {
    const user = userEvent.setup();
    const { container } = renderContent([sections([section({ collapsed: true })])]);

    const details = container.querySelector('details.pc-sections__item');
    const summary = screen.getByText('Догляд');

    // Проверяется именно ЭЛЕМЕНТ управления, а не самодельная кнопка: клавиатура
    // (Enter/Space), фокус и попадание свёрнутого текста во встроенный поиск по
    // странице у <summary> берутся от браузера. Сама фокусировка <summary> в
    // jsdom не реализована (это не про компонент, а про среду), поэтому здесь —
    // тег, вложенность и то, что активация действительно раскрывает секцию.
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.parentElement).toBe(details);
    expect(details.open).toBe(false);

    await user.click(summary);

    expect(details.open).toBe(true);
    expect(screen.getByText('Мийте теплою водою')).toBeInTheDocument();
  });

  test('вложенные блоки рисуются тем же allowlist-ом', () => {
    const { container } = renderContent([
      sections([
        section({
          blocks: [
            { id: 'evil', type: 'iframe', src: 'https://evil.example' },
            { id: 'ok', type: 'list', style: 'bullet', items: ['Пункт'] },
          ],
        }),
      ]),
    ]);

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('listitem')).toHaveTextContent('Пункт');
  });
});

describe('доступность документа в целом', () => {
  test('контент — размеченная область с подписью и языком', () => {
    renderContent([{ id: 'p', type: 'paragraph', text: 'Текст' }]);

    const region = screen.getByRole('region', { name: 'Детальний опис товару' });
    expect(region.tagName).toBe('SECTION');
    expect(region).toHaveAttribute('lang', 'uk');
  });

  test('уровни заголовков идут без пропусков сверху вниз', () => {
    renderContent([
      { id: 'h1', type: 'heading', level: 2, text: 'Розділ' },
      { id: 'p1', type: 'paragraph', text: 'Текст' },
      { id: 'h2', type: 'heading', level: 3, text: 'Підрозділ' },
      { id: 'h3', type: 'heading', level: 4, text: 'Дрібниця' },
    ]);

    const levels = screen
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)));

    // Страница даёт h1 (название товара), документ начинается с h2 — и ни один
    // переход вниз не перепрыгивает уровень.
    expect(levels).toEqual([2, 3, 4]);
    levels.forEach((level, index) => {
      if (index === 0) return;
      expect(level - levels[index - 1]).toBeLessThanOrEqual(1);
    });
  });

  test('в разметке контента нет ни одного исполняемого или внешнего узла', () => {
    const { container } = renderContent(
      [
        { id: 'p', type: 'paragraph', text: '<script>alert(1)</script>' },
        { id: 'c', type: 'callout', variant: 'info', text: '<iframe src="https://evil.example"></iframe>' },
      ],
    );

    for (const selector of ['script', 'iframe', 'object', 'embed', 'style', 'link', 'form', 'a']) {
      expect(container.querySelector(selector)).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Раскрывающаяся обёртка.
//
// Проверяется не «есть класс», а поведение: чем управляется раскрытие, что
// видно до и после, и что документ ничего не теряет ни в одном из состояний.
// ─────────────────────────────────────────────────────────────────────────────
describe('раскрывающийся расширенный опис', () => {
  const long = (mark) => 'Довгий опис. '.repeat(120) + mark; // > 1200 символов

  test('короткий документ раскрыт сразу', () => {
    const { container } = renderContent([{ id: 'p', type: 'paragraph', text: 'Коротко про товар' }]);

    const details = container.querySelector('details.pc-disclosure');
    expect(details).toBeInTheDocument();
    expect(details.open).toBe(true);
    expect(screen.getByText('Коротко про товар')).toBeInTheDocument();
  });

  test('длинный документ свёрнут', () => {
    const { container } = renderContent([{ id: 'p', type: 'paragraph', text: long('кінець') }]);

    expect(container.querySelector('details.pc-disclosure').open).toBe(false);
  });

  test('инструкция с картинками свёрнута, даже когда текста в ней немного', () => {
    // Картинка не несёт символов, но занимает высоту — иначе инструкция на
    // 30 шагов раскрывалась бы во весь экран.
    const steps = Array.from({ length: 12 }, (_, index) => ({
      id: `${STEP_ID.slice(0, -2)}${String(index).padStart(2, '0')}`,
      text: `Крок ${index + 1}`,
      image: { asset_id: ASSET_ID, alt: '' },
    }));

    const assets = Object.fromEntries(
      steps.map((step) => [step.id, { asset_id: ASSET_ID, url: '/uploads/images/s.jpg', alt: '' }]),
    );

    const { container } = renderContent([{ id: 'st', type: 'steps', items: steps }], assets);

    expect(container.querySelector('details.pc-disclosure').open).toBe(false);
  });

  test('свёрнутое содержимое остаётся в разметке (поиск по странице и скринридер его находят)', () => {
    const { container } = renderContent([
      { id: 'h', type: 'heading', level: 2, text: 'Складання' },
      { id: 'p', type: 'paragraph', text: long('таємний рядок') },
    ]);

    expect(container.querySelector('details.pc-disclosure').open).toBe(false);
    // Узлы на месте: <details> прячет их средствами браузера, а не удалением из
    // DOM — иначе Ctrl+F не нашёл бы ни слова, а разметка теряла бы заголовки.
    expect(screen.getByRole('heading', { level: 2, name: 'Складання' })).toBeInTheDocument();
    expect(container.textContent).toContain('таємний рядок');
  });

  test('управление — родное <summary> с понятной подписью', () => {
    const { container } = renderContent([{ id: 'p', type: 'paragraph', text: long('x') }]);

    const details = container.querySelector('details.pc-disclosure');
    const summary = details.querySelector('summary');

    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.parentElement).toBe(details);
    expect(summary.textContent).toBe('Докладний опис');
    // aria-expanded у summary быть НЕ должно: состояние раскрытия несёт сам
    // элемент, и дублирующий атрибут скринридер зачитывает вторым.
    expect(summary).not.toHaveAttribute('aria-expanded');
  });

  test('подпись не является заголовком разметки — порядок h2–h4 документа не меняется', () => {
    renderContent([
      { id: 'h2', type: 'heading', level: 2, text: 'Розділ' },
      { id: 'h3', type: 'heading', level: 3, text: 'Підрозділ' },
    ]);

    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)));
    expect(levels).toEqual([2, 3]);
  });

  test('активация раскрывает и закрывает', async () => {
    const user = userEvent.setup();
    const { container } = renderContent([{ id: 'p', type: 'paragraph', text: long('x') }]);

    const details = container.querySelector('details.pc-disclosure');
    const summary = details.querySelector('summary');

    await user.click(summary);
    expect(details.open).toBe(true);

    await user.click(summary);
    expect(details.open).toBe(false);
  });

  test('перерисовка страницы не схлопывает то, что раскрыл посетитель', async () => {
    const user = userEvent.setup();
    const blocks = [{ id: 'p', type: 'paragraph', text: long('x') }];
    const value = content(blocks);

    const { container, rerender } = render(<ProductContentRenderer content={value} />);
    const details = container.querySelector('details.pc-disclosure');

    await user.click(details.querySelector('summary'));
    expect(details.open).toBe(true);

    // Тот же content, новый рендер: так ведёт себя страница товара при выборе
    // цвета или количества. React обязан не трогать уже выставленный open.
    rerender(<ProductContentRenderer content={value} />);
    expect(container.querySelector('details.pc-disclosure').open).toBe(true);
  });

  test('вложенные sections не получают второго уровня сворачивания', () => {
    const { container } = renderContent([
      {
        id: 'sec',
        type: 'sections',
        items: [
          { id: 'sec-1', title: 'Догляд', blocks: [{ id: 'inner', type: 'paragraph', text: 'Мийте' }] },
        ],
      },
    ]);

    // Обёртка одна, и внутри неё секции документа остаются такими же, как были.
    expect(container.querySelectorAll('details.pc-disclosure')).toHaveLength(1);
    expect(container.querySelectorAll('details.pc-sections__item')).toHaveLength(1);
    expect(container.querySelector('.pc-disclosure__body > .pc-sections')).toBeInTheDocument();
  });

  test('без контента нет и кнопки раскрытия', () => {
    const { container } = render(<ProductContentRenderer content={null} />);
    expect(container.querySelector('details')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  test('collapsible={false} печатает документ без обёртки (предпросмотр, печать)', () => {
    const { container } = render(
      <ProductContentRenderer content={content([{ id: 'p', type: 'paragraph', text: long('x') }])} collapsible={false} />,
    );

    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('.product-content > .pc-paragraph')).toBeInTheDocument();
  });

  test('defaultOpen перебивает расчёт по объёму', () => {
    const { container } = render(
      <ProductContentRenderer content={content([{ id: 'p', type: 'paragraph', text: long('x') }])} defaultOpen />,
    );

    expect(container.querySelector('details.pc-disclosure').open).toBe(true);
  });
});
