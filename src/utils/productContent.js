// Разбор расширенного контента товара (schema_version = 1) для витрины.
//
// Здесь нет ни React, ни DOM — только приведение того, что пришло с сервера, к
// форме, которую рендереру остаётся напечатать. Разделение не косметическое: всё
// решающее (что показать, что выбросить, откуда взять картинку) проверяется
// обычными unit-тестами, а компонентные тесты проверяют разметку и доступность.
//
// Почему фронт разбирает документ ЗАНОВО, хотя сервер уже проверил его Zod'ом:
//
//   • ответ приходит не только от нашей текущей сборки — между витриной и БД
//     стоят кеши, прокси и старые/новые версии backend'а;
//   • «показать чуть меньше» здесь всегда дешевле, чем белый экран: страница
//     товара — это витрина магазина, и один кривой блок не должен её ронять.
//
// Правило безопасности ровно одно, и оно структурное: в документе НЕТ полей с
// произвольным URL и НЕТ полей с разметкой. Картинка адресуется id узла в карте
// content.assets, текст печатается как текст (React экранирует его сам), и во
// всём рендерере нет dangerouslySetInnerHTML. Поэтому санитайзер HTML не нужен —
// вставлять HTML попросту неоткуда.

/** Версия формата, которую понимает этот рендерер. */
export const PRODUCT_CONTENT_SCHEMA_VERSION = 1;

/**
 * Allowlist блоков. Тип, которого здесь нет, не рисуется никогда — даже если
 * сервер когда-нибудь начнёт его отдавать.
 *
 * `sections` в контракте v1 на сервере ПОКА НЕТ (backend отдаёт paragraph,
 * heading, list, steps, image, table, callout). Поддержка здесь сделана заранее
 * и по той же схеме, что остальные блоки: до появления блока на сервере эта
 * ветка просто никогда не срабатывает, а когда появится — витрину не придётся
 * выкатывать следом.
 */
export const PRODUCT_CONTENT_BLOCK_TYPES = Object.freeze([
  'paragraph',
  'heading',
  'list',
  'steps',
  'image',
  'table',
  'callout',
  'sections',
]);

const BLOCK_TYPES = new Set(PRODUCT_CONTENT_BLOCK_TYPES);

const HEADING_LEVELS = new Set([2, 3, 4]);
const LIST_STYLES = new Set(['bullet', 'ordered']);
const CALLOUT_VARIANTS = new Set(['info', 'warning', 'danger', 'success']);

/** Вложенность блоков внутри `sections`: секции в секциях не рисуем. */
const MAX_BLOCK_DEPTH = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Текстовое поле документа → строка, которую можно печатать.
 *
 * Управляющие символы вычищаются (кроме перевода строки и табуляции): в jsonb
 * они попасть не должны, но приходят из дампов и ручных правок, а в DOM дают
 * невидимый мусор. Однострочные поля дополнительно схлопывают переводы строк —
 * иначе заголовок или ячейка таблицы разъезжают вёрстку.
 */
function cleanText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';

  const source = value.replace(/\r\n?/g, '\n');

  // Посимвольно, а не регуляркой: регулярка с управляющими символами — это либо
  // сырые байты в исходнике, либо ругань линтера (no-control-regex). Ровно та же
  // причина и та же реализация, что в backend/src/core/productContent.ts.
  let text = '';
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index);
    if (code === 9) {
      text += ' ';
      continue;
    }
    if (code === 10) {
      text += multiline ? '\n' : ' ';
      continue;
    }
    if (code < 0x20 || code === 0x7f) continue;
    text += source[index];
  }

  return text.trim();
}

/** Непустой однострочный текст либо null (для необязательных полей). */
function optionalLine(value) {
  const text = cleanText(value);
  return text || null;
}

function positiveIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * Адрес картинки, которому можно доверить атрибут src.
 *
 * Принимается ТОЛЬКО собственный путь от корня («/uploads/...»): сервер обещает
 * ровно это, а всё остальное — либо чужой хост (утечка адреса покупателя и битая
 * картинка, когда хост исчезнет), либо схема вроде data:/javascript:. Проверять
 * дешевле, чем доверять: сюда же попадает ответ из кеша и от старого backend'а.
 *
 * Отдельно отсекается «//host» — это не путь, а протокол-относительный адрес.
 */
export function isSafeContentImageUrl(value) {
  if (typeof value !== 'string') return false;

  const url = value.trim();
  return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Картинка узла (id image-блока либо id шага) из карты content.assets.
 *
 * Инвариант контракта: image есть в документе ⟺ есть запись в assets[id]. Здесь
 * он ПРОВЕРЯЕТСЯ, а не предполагается, и дополнительно сверяется asset_id: если
 * документ говорит про один файл, а карта — про другой, значит стороны
 * разъехались, и верить нельзя ни одной из них.
 */
function resolveImage(assets, nodeId, declared) {
  if (!nodeId || !isPlainObject(assets)) return null;

  const entry = assets[nodeId];
  if (!isPlainObject(entry)) return null;

  const url = typeof entry.url === 'string' ? entry.url.trim() : '';
  if (!isSafeContentImageUrl(url)) return null;

  const declaredAssetId = isPlainObject(declared) ? declared.asset_id : null;
  if (declaredAssetId && entry.asset_id && String(entry.asset_id) !== String(declaredAssetId)) {
    return null;
  }

  return {
    url,
    // alt — обязательный ключ, но пустая строка законна: у декоративной картинки
    // alt="" правильнее любого выдуманного текста.
    alt: cleanText(entry.alt ?? (isPlainObject(declared) ? declared.alt : '')),
    caption: optionalLine(entry.caption ?? (isPlainObject(declared) ? declared.caption : null)),
    width: positiveIntOrNull(entry.width),
    height: positiveIntOrNull(entry.height),
  };
}

// ─── Блоки ───────────────────────────────────────────────────────────────────
// Каждая функция возвращает готовый к печати блок либо null («показывать
// нечего»). null — это всегда пропуск ОДНОГО блока, а не отказ от документа.

function normalizeParagraph(block) {
  const text = cleanText(block.text, { multiline: true });
  return text ? { type: 'paragraph', id: block.id, text } : null;
}

function normalizeHeading(block) {
  const text = cleanText(block.text);
  if (!text) return null;

  const level = Number(block.level);
  // h1 на странице занят названием товара. Непонятный уровень не выбрасывает
  // заголовок (текст автор написал), а прижимается к середине допустимого.
  return { type: 'heading', id: block.id, level: HEADING_LEVELS.has(level) ? level : 3, text };
}

function normalizeList(block) {
  if (!Array.isArray(block.items)) return null;

  const items = block.items.map((item) => cleanText(item)).filter(Boolean);
  if (!items.length) return null;

  const style = LIST_STYLES.has(block.style) ? block.style : 'bullet';
  return { type: 'list', id: block.id, ordered: style === 'ordered', items };
}

function normalizeSteps(block, assets) {
  if (!Array.isArray(block.items)) return null;

  const items = block.items
    .map((step, index) => {
      if (!isPlainObject(step)) return null;

      const text = cleanText(step.text, { multiline: true });
      if (!text) return null;

      const stepId = typeof step.id === 'string' ? step.id : '';

      return {
        // key для React: id шага необязателен, пока у шага нет картинки.
        key: stepId || `${block.id}:${index}`,
        title: optionalLine(step.title),
        text,
        // Недоступная картинка стоит ровно себя: инструкция остаётся, из шага
        // пропадает только иллюстрация. Ровно так же поступает и сервер.
        image: step.image ? resolveImage(assets, stepId, step.image) : null,
      };
    })
    .filter(Boolean);

  return items.length ? { type: 'steps', id: block.id, items } : null;
}

function normalizeImage(block, assets) {
  const image = resolveImage(assets, block.id, block);
  // Блок-картинка без картинки — это дыра на странице, которую автор не писал.
  return image ? { type: 'image', id: block.id, image } : null;
}

function normalizeTable(block) {
  if (!Array.isArray(block.columns) || !Array.isArray(block.rows)) return null;

  const columns = block.columns.map((column) => cleanText(column));
  const rows = block.rows.filter(Array.isArray).map((row) => row.map((cell) => cleanText(cell)));

  if (!columns.length || !rows.length) return null;

  // Ширину берём по самой длинной строке, а не по заголовкам: сервер обещает
  // прямоугольник, но если обещание нарушено, лучше показать пустую ячейку, чем
  // потерять данные или разъехаться вёрсткой.
  const width = rows.reduce((max, row) => Math.max(max, row.length), columns.length);
  const pad = (cells) => Array.from({ length: width }, (_, index) => cells[index] ?? '');

  return { type: 'table', id: block.id, columns: pad(columns), rows: rows.map(pad) };
}

function normalizeCallout(block) {
  const text = cleanText(block.text, { multiline: true });
  if (!text) return null;

  return {
    type: 'callout',
    id: block.id,
    variant: CALLOUT_VARIANTS.has(block.variant) ? block.variant : 'info',
    title: optionalLine(block.title),
    text,
  };
}

/**
 * Секции: заголовок + вложенные блоки, раскрытые или свёрнутые.
 *
 * Состояние читается из `collapsed`/`open` (что найдётся) и означает только
 * НАЧАЛЬНОЕ состояние: дальше им распоряжается посетитель, а не документ.
 */
function normalizeSections(block, assets, depth) {
  if (!Array.isArray(block.items)) return null;

  const items = block.items
    .map((section, index) => {
      if (!isPlainObject(section)) return null;

      const title = optionalLine(section.title);
      // Без заголовка у свёрнутой секции нет подписи на кнопке раскрытия —
      // посетитель (и скринридер) не узнает, что внутри.
      if (!title) return null;

      const blocks = normalizeBlocks(section.blocks, assets, depth + 1);
      if (!blocks.length) return null;

      const sectionId = typeof section.id === 'string' ? section.id : '';

      return {
        key: sectionId || `${block.id}:${index}`,
        title,
        blocks,
        defaultOpen: readOpenState(section),
      };
    })
    .filter(Boolean);

  return items.length ? { type: 'sections', id: block.id, items } : null;
}

function readOpenState(section) {
  if (typeof section.collapsed === 'boolean') return !section.collapsed;
  if (typeof section.open === 'boolean') return section.open;

  const state = typeof section.state === 'string' ? section.state.trim().toLowerCase() : '';
  if (state === 'collapsed') return false;
  if (state === 'open') return true;

  // Умолчание — раскрыто: контент, который никто не открыл, для покупателя не
  // существует, а прятать его должен автор осознанно.
  return true;
}

const NORMALIZERS = {
  paragraph: (block) => normalizeParagraph(block),
  heading: (block) => normalizeHeading(block),
  list: (block) => normalizeList(block),
  steps: (block, assets) => normalizeSteps(block, assets),
  image: (block, assets) => normalizeImage(block, assets),
  table: (block) => normalizeTable(block),
  callout: (block) => normalizeCallout(block),
  sections: (block, assets, depth) => normalizeSections(block, assets, depth),
};

/**
 * Список сырых блоков → список блоков, готовых к печати.
 *
 * Битый блок пропускается молча и в одиночку: соседи от него не страдают.
 */
function normalizeBlocks(rawBlocks, assets, depth = 0) {
  if (!Array.isArray(rawBlocks)) return [];

  const blocks = [];
  // Один и тот же id — это два узла, претендующих на одну запись в assets.
  // Сервер такое запрещает; здесь просто оставляем первый.
  const seenIds = new Set();

  for (const rawBlock of rawBlocks) {
    if (!isPlainObject(rawBlock)) continue;

    const id = typeof rawBlock.id === 'string' ? rawBlock.id.trim() : '';
    const type = typeof rawBlock.type === 'string' ? rawBlock.type : '';

    if (!id || seenIds.has(id)) continue;
    if (!BLOCK_TYPES.has(type)) continue;
    if (type === 'sections' && depth >= MAX_BLOCK_DEPTH) continue;

    let normalized = null;
    try {
      normalized = NORMALIZERS[type]({ ...rawBlock, id }, assets, depth);
    } catch {
      // Разбор одного блока не имеет права уронить страницу товара.
      normalized = null;
    }

    if (!normalized) continue;

    seenIds.add(id);
    blocks.push(normalized);
  }

  return blocks;
}

// ─── Объём документа ─────────────────────────────────────────────────────────

/**
 * Во сколько печатных символов обходится картинка.
 *
 * Картинка не несёт ни одного символа, но занимает высоту наравне с большим
 * абзацем, а решение «свернуть или нет» принимается именно про высоту. Число —
 * порядок величины (крупное фото ≈ экран текста), а не результат замера: точнее
 * его знать неоткуда, и уточнение ничего не изменит.
 */
const WEIGHT_PER_IMAGE = 400;

/**
 * «Сколько тут всего» одним числом — суммарная длина текста документа плюс
 * WEIGHT_PER_IMAGE за каждую картинку.
 *
 * Одна мера вместо набора правил («больше N блоков ИЛИ есть таблица ИЛИ…»)
 * выбрана намеренно: набор правил разъезжается с тем, что видит человек, и его
 * невозможно объяснить. Здесь же вопрос ровно один — много ли текста, и ответ
 * считается по тому же документу, который будет напечатан.
 */
export function measureContentWeight(blocks) {
  if (!Array.isArray(blocks)) return 0;

  let weight = 0;

  const addImage = (image) => {
    if (!image) return;
    weight += WEIGHT_PER_IMAGE + (image.caption?.length ?? 0);
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        weight += block.text.length;
        break;
      case 'callout':
        weight += block.text.length + (block.title?.length ?? 0);
        break;
      case 'list':
        for (const item of block.items) weight += item.length;
        break;
      case 'steps':
        for (const step of block.items) {
          weight += step.text.length + (step.title?.length ?? 0);
          addImage(step.image);
        }
        break;
      case 'image':
        addImage(block.image);
        break;
      case 'table':
        for (const column of block.columns) weight += column.length;
        for (const row of block.rows) for (const cell of row) weight += cell.length;
        break;
      case 'sections':
        for (const section of block.items) {
          weight += section.title.length + measureContentWeight(section.blocks);
        }
        break;
      default:
        break;
    }
  }

  return weight;
}

/**
 * Порог «короткого» документа.
 *
 * ~1200 символов — это два-три абзаца: столько читается как продолжение
 * страницы, а не как отдельный документ. Всё, что больше (инструкция на 30
 * шагов, таблица характеристик, галерея), сворачивается — иначе карточка товара
 * превращается в простыню, по которой нельзя добраться до отзывов и похожих
 * товаров.
 */
export const PRODUCT_CONTENT_SHORT_WEIGHT = 1200;

/**
 * Раскрывать ли расширенный опис при первом показе.
 *
 * Решение принимается ОДИН раз, из уже разобранного документа, и только на
 * этапе рендера — не в эффекте: состояние, выставленное после первой отрисовки,
 * дало бы прыжок вёрстки ровно там, где его больнее всего видно.
 */
export function isShortProductContent(normalized) {
  if (!normalized || !Array.isArray(normalized.blocks)) return false;
  return measureContentWeight(normalized.blocks) <= PRODUCT_CONTENT_SHORT_WEIGHT;
}

/**
 * Поле `content` из ответа detail-ручки → то, что рисует ProductContentRenderer,
 * либо null («показывать нечего, страница обходится products.description»).
 *
 * null возвращается одинаково и для «контента нет», и для «контент невозможно
 * показать»: для витрины это одно состояние.
 */
export function normalizeProductContent(content) {
  if (!isPlainObject(content)) return null;

  // Версия формата — первым делом. Документ версии 2 нельзя разбирать правилами
  // версии 1: получится не «частично прочитанный контент», а произвольно
  // покалеченный.
  if (Number(content.schema_version) !== PRODUCT_CONTENT_SCHEMA_VERSION) return null;

  const document = isPlainObject(content.document) ? content.document : null;
  if (!document) return null;

  const assets = isPlainObject(content.assets) ? content.assets : {};
  const blocks = normalizeBlocks(document.blocks, assets);
  if (!blocks.length) return null;

  const locale = typeof content.locale === 'string' && content.locale.trim() ? content.locale.trim() : null;

  return { schemaVersion: PRODUCT_CONTENT_SCHEMA_VERSION, locale, blocks };
}

/**
 * Контент товара для страницы — с учётом фича-флага.
 *
 * Флаг проверяется ЗДЕСЬ, а не внутри компонента: при выключенном флаге витрина
 * не должна даже разбирать документ, и страница обязана вести себя ровно так,
 * как вела до появления рендерера.
 */
export function selectProductContent(product, { enabled }) {
  if (!enabled) return null;
  return normalizeProductContent(product?.content);
}
