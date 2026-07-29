import React from 'react';
import { assetUrl } from '../../utils/assetUrl';
import { isShortProductContent, normalizeProductContent } from '../../utils/productContent';
import './ProductContentRenderer.css';

// Рендерер расширенного контента товара (schema_version = 1).
//
// Компонент намеренно изолирован: он ничего не знает ни про страницу товара, ни
// про корзину, ни про галерею — на входе поле `content` из detail-ручки, на
// выходе разметка. Отсюда и его тестируемость, и то, что при выключенном флаге
// его можно просто не монтировать.
//
// Безопасность держится тремя правилами:
//
//   1. dangerouslySetInnerHTML не используется НИГДЕ — весь текст печатается как
//      текст, React экранирует его сам;
//   2. рисуются только блоки из allowlist'а (см. utils/productContent.js),
//      неизвестный тип не доезжает сюда вовсе;
//   3. единственный внешний ресурс — картинка, и её адрес обязан быть нашим
//      путём от корня, иначе картинка не рисуется.
//
// Разметка семантическая: абзац — <p>, список — <ul>/<ol>, инструкция — <ol>,
// картинка — <figure>/<figcaption>, таблица — <table> с <th scope>, выноска —
// <aside>, секция — <details>/<summary>. Это не «красиво», а единственный способ
// дать скринридеру структуру, которую зрячий видит по оформлению.

const HEADING_TAGS = { 2: 'h2', 3: 'h3', 4: 'h4' };

const CALLOUT_LABELS = {
  info: 'Інформація',
  warning: 'Увага',
  danger: 'Важливо',
  success: 'Порада',
};

/**
 * Картинка контента.
 *
 * loading="lazy" + decoding="async" — потому что инструкция на 30 шагов иначе
 * тянет 30 файлов до первого экрана. width/height проставляются, когда известны:
 * без них страница прыгает по мере загрузки (CLS), а с ними место под картинку
 * зарезервировано заранее.
 *
 * alt печатается всегда, в том числе пустой: alt="" — это «картинка
 * декоративная, пропусти её», а отсутствие атрибута заставляет скринридер
 * зачитывать имя файла.
 */
function ContentImage({ image, className }) {
  const img = (
    <img
      className={`pc-image__img${className ? ` ${className}` : ''}`}
      src={assetUrl(image.url)}
      alt={image.alt}
      loading="lazy"
      decoding="async"
      {...(image.width ? { width: image.width } : null)}
      {...(image.height ? { height: image.height } : null)}
    />
  );

  if (!image.caption) return img;

  return (
    <figure className="pc-image__figure">
      {img}
      <figcaption className="pc-image__caption">{image.caption}</figcaption>
    </figure>
  );
}

function ParagraphBlock({ block }) {
  // white-space: pre-line в CSS, а не <br/> в цикле: перевод строки внутри
  // абзаца — это оформление текста, а не отдельный элемент разметки.
  return <p className="pc-paragraph">{block.text}</p>;
}

function HeadingBlock({ block }) {
  // h1 на странице занят названием товара, поэтому документ начинается с h2 —
  // так порядок заголовков остаётся непрерывным.
  const Tag = HEADING_TAGS[block.level] ?? 'h3';
  return <Tag className={`pc-heading pc-heading--${block.level}`}>{block.text}</Tag>;
}

function ListBlock({ block }) {
  const Tag = block.ordered ? 'ol' : 'ul';

  return (
    <Tag className={`pc-list pc-list--${block.ordered ? 'ordered' : 'bullet'}`}>
      {block.items.map((item, index) => (
        <li key={index} className="pc-list__item">
          {item}
        </li>
      ))}
    </Tag>
  );
}

/**
 * Инструкция: нумерованный список шагов.
 *
 * Заголовок шага — НЕ заголовок разметки (<h*>): шаги стоят внутри документа с
 * собственной иерархией h2–h4, и вставленный h3/h4 ломал бы её порядок в самом
 * частом случае. Роль «подпись шага» здесь несёт номер списка, который
 * скринридер зачитывает сам.
 */
function StepsBlock({ block }) {
  return (
    <ol className="pc-steps">
      {block.items.map((step) => (
        <li key={step.key} className="pc-steps__item">
          {step.title && <p className="pc-steps__title">{step.title}</p>}
          <p className="pc-steps__text">{step.text}</p>
          {step.image && (
            <div className="pc-steps__image pc-image">
              <ContentImage image={step.image} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ImageBlock({ block }) {
  return (
    <div className="pc-image">
      <ContentImage image={block.image} />
    </div>
  );
}

/**
 * Таблица характеристик.
 *
 * Обёртка с overflow-x — обязательна: таблица на 12 колонок на телефоне иначе
 * растягивает всю страницу. Обёртке даны role="region", tabIndex и подпись:
 * прокручиваемая область, до которой нельзя добраться с клавиатуры, — это
 * недоступный кусок страницы, а не «мелочь оформления».
 */
function TableBlock({ block }) {
  const caption = block.columns.filter(Boolean).join(', ');

  return (
    <div
      className="pc-table-wrap"
      role="region"
      tabIndex={0}
      aria-label={caption ? `Таблиця: ${caption}` : 'Таблиця'}
    >
      <table className="pc-table">
        <thead>
          <tr>
            {block.columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Выноска.
 *
 * <aside> + подпись варианта текстом: цвет рамки — единственный признак «это
 * предупреждение» для зрячего, и без текстовой подписи он не существует ни для
 * скринридера, ни для человека, который цвета не различает.
 */
function CalloutBlock({ block }) {
  const label = CALLOUT_LABELS[block.variant] ?? CALLOUT_LABELS.info;
  const title = block.title ?? label;

  return (
    <aside className={`pc-callout pc-callout--${block.variant}`} aria-label={title}>
      <p className="pc-callout__title">{title}</p>
      <p className="pc-callout__text">{block.text}</p>
    </aside>
  );
}

/**
 * Секции: <details>/<summary>, без собственного состояния в React.
 *
 * Раскрытие делает сам браузер — это работает без JS, доступно с клавиатуры и
 * находится встроенным поиском по странице. Самодельная кнопка + useState дала
 * бы то же самое хуже. `open` здесь именно НАЧАЛЬНОЕ состояние (defaultOpen):
 * дальше им распоряжается посетитель, и повторный рендер его не сбрасывает.
 */
function SectionsBlock({ block }) {
  return (
    <div className="pc-sections">
      {block.items.map((section) => (
        <details key={section.key} className="pc-sections__item" open={section.defaultOpen}>
          <summary className="pc-sections__summary">{section.title}</summary>
          <div className="pc-sections__body">
            <ContentBlocks blocks={section.blocks} />
          </div>
        </details>
      ))}
    </div>
  );
}

const BLOCK_COMPONENTS = {
  paragraph: ParagraphBlock,
  heading: HeadingBlock,
  list: ListBlock,
  steps: StepsBlock,
  image: ImageBlock,
  table: TableBlock,
  callout: CalloutBlock,
  sections: SectionsBlock,
};

function ContentBlocks({ blocks }) {
  return blocks.map((block) => {
    // Второй заслон после allowlist'а разбора: даже если сюда каким-то образом
    // доедет неизвестный тип, он будет пропущен, а не уронит рендер.
    const Component = BLOCK_COMPONENTS[block.type];
    if (!Component) return null;

    return <Component key={block.id} block={block} />;
  });
}

/**
 * Подпись на кнопке раскрытия.
 *
 * «Опис» на странице уже занят кратким описанием из products.description, и
 * второй заголовок с тем же словом читался бы как дубль. «Докладний опис» — это
 * ровно то, что внутри, независимо от того, инструкция там или таблица.
 */
export const PRODUCT_CONTENT_TITLE = 'Докладний опис';

/**
 * Расширенный опис целиком — раскрывающийся блок.
 *
 * Взято <details>/<summary>, а не кнопка с useState:
 *
 *   • раскрытие работает без JS и с клавиатуры (Enter/Пробел) — браузер сам
 *     ставит роль, состояние и порядок табуляции, а самодельная кнопка + div
 *     повторяли бы это заново и хуже;
 *   • свёрнутое содержимое браузер не размечает и не рисует — то есть
 *     инструкция на 30 шагов не грузит 30 картинок до того, как её открыли
 *     (loading="lazy" внутри закрытого details не срабатывает вовсе);
 *   • aria-expanded проставлять НЕ нужно и НЕЛЬЗЯ: у summary своё состояние
 *     раскрытия, и дублирующий атрибут скринридеры зачитывают дважды.
 *
 * Вложенные `sections` этой обёрткой не затрагиваются: у них своя,
 * ВНУТРЕННЯЯ группировка документа, и оборачивать секцию в секцию — значит
 * заставить посетителя раскрывать два уровня, чтобы дочитать один абзац.
 *
 * `open` здесь — НАЧАЛЬНОЕ состояние: React выставляет атрибут при монтировании
 * и трогает его только при смене значения пропа, поэтому перерисовка страницы
 * (выбор цвета, количество) не схлопывает то, что посетитель раскрыл сам.
 */
function ContentDisclosure({ title, open, children }) {
  return (
    <details className="pc-disclosure" open={open}>
      <summary className="pc-disclosure__summary">
        <span className="pc-disclosure__title">{title}</span>
      </summary>
      <div className="pc-disclosure__body">{children}</div>
    </details>
  );
}

/**
 * @param {object} props
 * @param {object|null} props.content   поле `content` из detail-ручки, как пришло
 * @param {object|null} [props.value]   уже разобранный контент (см. selectProductContent)
 * @param {string} [props.className]
 * @param {string} [props.ariaLabel]
 * @param {string} [props.title]        подпись кнопки раскрытия
 * @param {boolean} [props.collapsible] false — печатать содержимое без обёртки
 * @param {boolean|null} [props.defaultOpen] null — решать по объёму документа
 */
export default function ProductContentRenderer({
  content,
  value = null,
  className = '',
  ariaLabel = 'Детальний опис товару',
  title = PRODUCT_CONTENT_TITLE,
  collapsible = true,
  defaultOpen = null,
}) {
  // Разбор мемоизируем: content лежит в состоянии страницы и при любой её
  // перерисовке (выбор цвета, смена количества) остаётся тем же объектом, а
  // документ на две сотни блоков разбирать заново на каждый клик незачем.
  const normalized = React.useMemo(
    () => value ?? normalizeProductContent(content),
    [value, content],
  );

  // Короткий документ раскрыт, длинный свёрнут. Считается ОДИН раз при разборе и
  // до первой отрисовки: состояние, выставленное эффектом, дало бы прыжок
  // вёрстки ровно в тот момент, когда посетитель начал читать.
  const open = React.useMemo(
    () => (typeof defaultOpen === 'boolean' ? defaultOpen : isShortProductContent(normalized)),
    [defaultOpen, normalized],
  );

  // Нечего показывать — не рисуем НИЧЕГО, даже пустой обёртки и даже кнопки
  // раскрытия: страница обязана выглядеть точно так же, как без контента.
  if (!normalized) return null;

  const blocks = <ContentBlocks blocks={normalized.blocks} />;

  return (
    <section
      className={`product-content${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      lang={normalized.locale || undefined}
      data-testid="product-content"
      data-collapsible={collapsible ? 'true' : 'false'}
    >
      {collapsible ? (
        <ContentDisclosure title={title} open={open}>
          {blocks}
        </ContentDisclosure>
      ) : (
        blocks
      )}
    </section>
  );
}
