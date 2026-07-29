#!/usr/bin/env node
// my-react-app/dev/product-content-browser.mjs
//
// Проверка расширенного контента в НАСТОЯЩЕМ браузере.
//
//   node dev/product-content-browser.mjs [--shots <каталог>] [--base <url>]
//
// Зачем отдельно от vitest. jsdom не считает раскладку вовсе: у него нет ни
// ширины элемента, ни переполнения, ни прокрутки. Все ловушки вёрстки этого
// контента — именно там: широкая таблица, растягивающая колонку грида за пределы
// экрана; обёртка с overflow-x, у которой прокрутка не включается, потому что она
// не уже своего содержимого; картинка 4000px, выпирающая за край на телефоне.
// Каждую из них видно только в браузере, и каждая уже случалась.
//
// Требования: playwright-core + установленный chromium
// (см. docs/product-content-browser-matrix.md). Скрипт НЕ входит в сборку и не
// является зависимостью пакета: браузер ставится отдельно и не в каждой среде.
//
// Код возврата: 0 — все проверки прошли, 1 — есть отказы.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    'playwright-core',
    'playwright',
    // Каталог, в котором его ставят разово для такой проверки.
    process.env.PLAYWRIGHT_PATH,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      /* пробуем следующий */
    }
  }

  console.error(
    'playwright-core не найден. Установите его разово (браузер уже есть в ~/.cache/ms-playwright):\n' +
      '  npm i --no-save playwright-core\n' +
      'или укажите путь: PLAYWRIGHT_PATH=/путь/к/playwright-core node dev/product-content-browser.mjs',
  );
  process.exit(2);
}

const { chromium } = loadPlaywright();

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = argValue('--base', 'http://127.0.0.1:5173');
const SHOTS = argValue('--shots', '');
const HARNESS = `${BASE}/dev/product-content-harness.html`;

/** Ширины: телефон, планшет, десктоп. */
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
];

/**
 * Сценарии. Порядок и нумерация — как в docs/product-content-browser-matrix.md.
 *
 * `check` получает страницу и возвращает список отказов (пустой — всё хорошо).
 */
const SCENARIOS = [
  { id: 'paragraph_only', title: '1. Только paragraph' },
  { id: 'all_blocks', title: '2. Все семь типов блоков' },
  { id: 'long_list', title: '3. Длинный список' },
  { id: 'steps_30', title: '4. Инструкция на 30 шагов' },
  { id: 'wide_table', title: '5. Широкая таблица' },
  { id: 'table_long_words', title: '6. Таблица с длинными словами' },
  { id: 'image_square', title: '7. Изображение 1:1' },
  { id: 'image_very_wide', title: '8. Очень широкое изображение' },
  { id: 'image_very_tall', title: '9. Очень высокое изображение' },
  { id: 'image_broken', title: '10. Ошибка загрузки изображения' },
  { id: 'step_images', title: '11. Изображение внутри шага' },
  { id: 'no_content', title: '12. Отсутствующий content', expectEmpty: true },
  { id: 'unknown_schema', title: '13. Неизвестная версия схемы', expectEmpty: true },
  { id: 'flag_off', title: '14. Feature flag выключен', expectEmpty: true },
  { id: 'collapsed_long', title: '15a. Свёрнутый блок' },
  { id: 'expanded_short', title: '15b. Раскрытый блок' },
];

const results = [];
const failures = [];

function record(scenario, viewport, status, detail = '') {
  results.push({ scenario, viewport, status, detail });
  if (status === 'FAIL') failures.push(`${scenario} @${viewport}: ${detail}`);
}

/**
 * Общие для всех сценариев инварианты.
 *
 * Проверяются НА КАЖДОЙ ширине и в каждом сценарии: горизонтальная прокрутка
 * страницы — это дефект, который появляется от одного конкретного блока, и
 * ловить его надо там, где он возник, а не «где-то в матрице».
 */
async function checkCommon(page, viewport) {
  const problems = [];

  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
    body: document.body.scrollWidth,
  }));

  // 1px запаса на округление subpixel-раскладки.
  if (overflow.doc > overflow.win + 1) {
    problems.push(`горизонтальная прокрутка страницы: scrollWidth=${overflow.doc} > ${overflow.win}`);
  }

  // dangerouslySetInnerHTML и любые исполняемые/внешние узлы внутри контента.
  const dangerous = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="product-content"]');
    if (!root) return [];
    return ['script', 'iframe', 'object', 'embed', 'form', 'link'].filter((tag) => root.querySelector(tag));
  });
  if (dangerous.length) problems.push(`в контенте есть узлы: ${dangerous.join(', ')}`);

  return problems;
}

/** Прокручиваемая таблица: прокрутка ВНУТРИ обёртки, а не у страницы. */
async function checkTables(page) {
  return page.evaluate(() => {
    const problems = [];

    for (const wrap of document.querySelectorAll('.pc-table-wrap')) {
      const table = wrap.querySelector('table');
      if (!table) continue;

      const parentWidth = wrap.parentElement.getBoundingClientRect().width;
      const wrapWidth = wrap.getBoundingClientRect().width;

      // Обёртка не имеет права быть шире своего места: именно это и растягивало
      // колонку грида за пределы экрана.
      if (wrapWidth > parentWidth + 1) {
        problems.push(`.pc-table-wrap шире родителя: ${wrapWidth} > ${parentWidth}`);
      }

      // Если таблица не помещается — обёртка обязана прокручиваться.
      if (table.scrollWidth > wrap.clientWidth + 1 && wrap.scrollWidth <= wrap.clientWidth + 1) {
        problems.push('таблица не помещается, но обёртка не прокручивается');
      }

      // Прокручиваемая область обязана быть достижима с клавиатуры.
      if (wrap.scrollWidth > wrap.clientWidth + 1 && wrap.tabIndex < 0) {
        problems.push('прокручиваемая таблица недоступна с клавиатуры (нет tabindex)');
      }
    }

    return problems;
  });
}

/** Картинки: не выпирают, ленивые, с alt, с зарезервированным местом. */
async function checkImages(page) {
  return page.evaluate(() => {
    const problems = [];
    const root = document.querySelector('[data-testid="product-content"]');
    if (!root) return problems;

    for (const img of root.querySelectorAll('img')) {
      const box = img.getBoundingClientRect();
      const parentBox = img.parentElement.getBoundingClientRect();

      if (box.width > parentBox.width + 1) {
        problems.push(`картинка шире контейнера: ${Math.round(box.width)} > ${Math.round(parentBox.width)}`);
      }
      if (img.getAttribute('loading') !== 'lazy') problems.push('картинка без loading="lazy"');
      // alt обязателен КАК АТРИБУТ; пустое значение законно (декоративная).
      if (!img.hasAttribute('alt')) problems.push('картинка без атрибута alt');
      if (img.src.startsWith('data:') || img.src.startsWith('javascript:')) {
        problems.push(`опасный src: ${img.src.slice(0, 40)}`);
      }
    }

    return problems;
  });
}

/** Порядок заголовков внутри документа: h2 → h3 → h4, без скачков. */
async function checkHeadings(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="product-content"]');
    if (!root) return [];

    const levels = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((node) => Number(node.tagName.slice(1)));
    const problems = [];

    if (levels.includes(1)) problems.push('в документе есть h1 — он занят названием товара');

    for (let index = 1; index < levels.length; index++) {
      if (levels[index] - levels[index - 1] > 1) {
        problems.push(`скачок уровней заголовков: h${levels[index - 1]} → h${levels[index]}`);
      }
    }

    return problems;
  });
}

async function run() {
  // Явный путь к бинарнику: playwright-core ищет браузер по версии, под которую
  // собран, и на машине с чуть другой версией кэша (chromium-1140 против
  // ожидаемого 1148) падает с «Executable doesn't exist» — при том что рабочий
  // Chromium лежит рядом. Переменная позволяет указать его вручную и не тянуть
  // сотню мегабайт ради минорного расхождения.
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  });

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      for (const scenario of SCENARIOS) {
        const url = `${HARNESS}?scenario=${scenario.id}`;
        await page.goto(url, { waitUntil: 'networkidle' });

        const hasContent = (await page.locator('[data-testid="product-content"]').count()) > 0;

        if (scenario.expectEmpty) {
          if (hasContent) {
            record(scenario.title, viewport.name, 'FAIL', 'блок расширенного контента отрисован, хотя не должен');
          } else {
            // Страница обязана остаться нормальной: краткое описание на месте.
            const fallback = await page.locator('.pd-section .content p').first().innerText();
            record(
              scenario.title,
              viewport.name,
              fallback.trim() ? 'OK' : 'FAIL',
              fallback.trim() ? 'контента нет, показано краткое описание' : 'нет ни контента, ни описания',
            );
          }
          continue;
        }

        if (!hasContent) {
          record(scenario.title, viewport.name, 'FAIL', 'расширенный контент не отрисован');
          continue;
        }

        const details = page.locator('details.pc-disclosure');
        const wasOpen = await details.evaluate((node) => node.open);

        // Снимок делается ДО раскрытия: на нём должно быть видно то, что видит
        // посетитель при первом заходе, а не то, что открыл этот скрипт.
        if (SHOTS) {
          await fs.mkdir(SHOTS, { recursive: true });
          await page.screenshot({
            path: path.join(SHOTS, `${scenario.id}-${viewport.name}${wasOpen ? '' : '-closed'}.png`),
            fullPage: true,
          });
        }

        // Раскрываем — иначе внутренние размеры не посчитаны.
        if (!wasOpen) await details.evaluate((node) => { node.open = true; });
        await page.waitForTimeout(120);

        const problems = [
          ...(await checkCommon(page, viewport)),
          ...(await checkTables(page)),
          ...(await checkImages(page)),
          ...(await checkHeadings(page)),
        ];

        // Начальное состояние обёртки — часть проверяемого поведения.
        if (scenario.id === 'collapsed_long' && wasOpen) problems.push('длинный документ раскрыт по умолчанию');
        if (scenario.id === 'expanded_short' && !wasOpen) problems.push('короткий документ свёрнут по умолчанию');

        // Клавиатура: до summary можно дойти табом и раскрыть пробелом.
        if (scenario.id === 'collapsed_long') {
          await details.evaluate((node) => { node.open = false; });
          await page.locator('summary.pc-disclosure__summary').focus();
          const focused = await page.evaluate(() => document.activeElement?.tagName);
          if (focused !== 'SUMMARY') problems.push(`фокус не на summary, а на ${focused}`);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(80);
          if (!(await details.evaluate((node) => node.open))) problems.push('Enter не раскрывает блок');
        }

        record(scenario.title, viewport.name, problems.length ? 'FAIL' : 'OK', problems.join('; '));

        // Второй снимок — раскрытым: свёрнутый показывает только кнопку, и
        // проверять по нему вёрстку содержимого нечем.
        if (SHOTS && !wasOpen) {
          await details.evaluate((node) => { node.open = true; });
          await page.waitForTimeout(120);
          await page.screenshot({
            path: path.join(SHOTS, `${scenario.id}-${viewport.name}-open.png`),
            fullPage: true,
          });
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // ── Отчёт ──────────────────────────────────────────────────────────────────
  const width = Math.max(...results.map((r) => r.scenario.length));
  let current = '';
  for (const result of results) {
    if (result.scenario !== current) {
      current = result.scenario;
      process.stdout.write(`\n${result.scenario.padEnd(width)} `);
    }
    process.stdout.write(` ${result.viewport}:${result.status === 'OK' ? '✓' : '✗'}`);
  }
  console.log('\n');

  if (failures.length) {
    console.error(`Отказов: ${failures.length}`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }

  console.log(`Все проверки прошли: ${results.length} (${SCENARIOS.length} сценариев × ${VIEWPORTS.length} ширины).`);
  if (SHOTS) console.log(`Скриншоты: ${SHOTS}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
