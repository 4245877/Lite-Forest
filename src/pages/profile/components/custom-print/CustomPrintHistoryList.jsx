import React from 'react';
import panel from '../ProfileTabPanel.module.css';
import custom from './CustomPrint.module.css';

const STATUS_LABELS = {
  draft: 'Чернетка',
  queued: 'У черзі',
  processing: 'В обробці',
  quoted: 'Розраховано',
  calculated: 'Розраховано',
  ready: 'Розраховано',
  pending: 'У черзі',
  failed: 'Помилка',
  error: 'Помилка',
};

const OK_STATUSES = new Set(['quoted', 'calculated', 'ready']);
const PROCESSING_STATUSES = new Set(['queued', 'processing', 'pending']);
const ERROR_STATUSES = new Set(['failed', 'error']);

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('uk-UA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return '—';
  }
}

function formatMoney(value, currency = 'UAH') {
  if (value == null || Number.isNaN(Number(value))) return '—';

  try {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${value} ${currency}`;
  }
}

function getStatusKey(status) {
  return String(status || 'draft').toLowerCase();
}

function mapStatus(status) {
  const statusKey = getStatusKey(status);

  return STATUS_LABELS[statusKey] || 'Чернетка';
}

function getStatusClassName(status) {
  const statusKey = getStatusKey(status);

  if (OK_STATUSES.has(statusKey)) {
    return `${panel.status} ${panel.statusOk}`;
  }

  if (ERROR_STATUSES.has(statusKey)) {
    return `${panel.status} ${panel.statusError}`;
  }

  return `${panel.status} ${panel.statusNeutral}`;
}

export default function CustomPrintHistoryList({
  items = [],
  activeId = '',
  onSelect,
  onDelete,
}) {
  return (
    <section className={`${panel.card} ${custom.customPrintHistoryCard}`}>
      <h3 className={panel.cardTitle}>5. Мої моделі</h3>

      {!items.length ? (
        <div className={panel.empty}>
          <div className={panel.emptyTitle}>Ще немає моделей</div>
          <div className={panel.emptyText}>
            Тут будуть з’являтися твої чернетки та попередні розрахунки.
          </div>
        </div>
      ) : (
        <div className={panel.list}>
          {items.map((item, index) => {
            const itemId = item.id || `${item.originalFilename || 'model'}-${index}`;
            const isActive = itemId === activeId;
            const title = item.originalFilename || 'Без назви';
            const totalPrice = item.quote?.totalPrice;
            const currency = item.quote?.currency || 'UAH';
            const statusKey = getStatusKey(item.status || item.quote?.state);
            const statusLabel = mapStatus(statusKey);
            const statusClassName = getStatusClassName(statusKey);
            const slicerError = item.slicerError || item.quote?.slicerError || '';
            const hasAnyQuoteData =
              totalPrice != null ||
              item.quote?.unitPrice != null ||
              item.quote?.materialG != null ||
              item.quote?.materialMl != null ||
              item.quote?.printTimeMin != null;

            return (
              <div key={itemId} className={custom.customPrintHistoryItem}>
                <button
                  type="button"
                  onClick={() => onSelect?.(item)}
                  className={[
                    custom.customPrintHistoryMain,
                    isActive ? custom.customPrintHistoryMainActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={isActive}
                >
                  <div className={custom.customPrintHistoryHead}>
                    <div className={custom.customPrintHistoryTitle}>{title}</div>

                    <span className={statusClassName}>
                      {statusLabel}
                    </span>
                  </div>

                  <div className={custom.customPrintHistoryMuted}>
                    Оновлено: {formatDate(item.updatedAt)}
                    <br />
                    {totalPrice != null
                      ? `Сума: ${formatMoney(totalPrice, currency)}`
                      : PROCESSING_STATUSES.has(statusKey)
                        ? 'Очікує серверного розрахунку'
                        : ERROR_STATUSES.has(statusKey)
                          ? `Помилка слайсингу${slicerError ? `: ${slicerError}` : ''}`
                          : hasAnyQuoteData
                            ? 'Дані слайсера отримано, ціна ще не сформована'
                            : 'Ще без розрахунку'}
                  </div>
                </button>

                <button
                  type="button"
                  className={`${panel.btnSmall} ${custom.customPrintDeleteBtn}`}
                  onClick={() => item.id && onDelete?.(item.id)}
                  disabled={!item.id}
                  aria-label={`Видалити модель ${title}`}
                >
                  Видалити
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}