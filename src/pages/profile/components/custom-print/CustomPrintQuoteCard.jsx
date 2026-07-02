import React from 'react';
import panel from '../ProfileTabPanel.module.css';
import custom from './CustomPrint.module.css';
import { formatCustomPrintStatus } from '../../utils/customPrintDefaults';

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

function formatDecimal(value, maximumFractionDigits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';

  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number(value));
}

function formatMaterialAmount(materialG, materialMl) {
  const parts = [];

  if (materialG != null) {
    parts.push(`${formatDecimal(materialG, 2)} г`);
  }

  if (materialMl != null) {
    parts.push(`${formatDecimal(materialMl, 2)} мл`);
  }

  return parts.length ? parts.join(' / ') : '—';
}

function formatMinutes(totalMinutes) {
  if (totalMinutes == null || Number.isNaN(Number(totalMinutes))) return '—';

  const roundedMinutes = Math.max(0, Math.round(Number(totalMinutes)));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (!hours) return `${minutes} хв`;
  if (!minutes) return `${hours} год`;

  return `${hours} год ${minutes} хв`;
}

function formatLeadTimeDays(days) {
  if (days == null || Number.isNaN(Number(days))) return '—';

  const roundedDays = Math.max(0, Math.round(Number(days)));

  if (roundedDays === 0) {
    return 'менше дня';
  }

  const mod10 = roundedDays % 10;
  const mod100 = roundedDays % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${roundedDays} день`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${roundedDays} дні`;
  }

  return `${roundedDays} днів`;
}

export default function CustomPrintQuoteCard({
  quote,
  disabled = false,
  busy = false,
  ordered = false,
  onRecalculate,
  onPurchase,
  canPurchase = false,
}) {
  const hasQuoteData = Boolean(
    quote &&
      (
        quote.totalPrice != null ||
        quote.unitPrice != null ||
        quote.materialG != null ||
        quote.materialMl != null ||
        quote.printTimeMin != null ||
        quote.leadTimeDays != null
      ),
  );

  const hasQuoteStatus = Boolean(quote?.state);
  const hasQuoteError = Boolean(quote?.slicerError);
  const hasQuote = hasQuoteData || hasQuoteStatus || hasQuoteError;

  return (
    <section className={panel.card}>
      <h3 className={panel.cardTitle}>3. Попередній розрахунок</h3>

      {!hasQuote ? (
        <p className={panel.cardText}>
          Після заповнення форми натисни «Розрахувати». Тут з’явиться попередня ціна,
          витрата матеріалу та орієнтовний час друку.
        </p>
      ) : (
        <>
          {quote.source === 'server' || quote.source === 'local' ? (
            <div
              className={
                quote.source === 'server'
                  ? `${panel.status} ${panel.statusOk} ${custom.customPrintQuoteSource}`
                  : `${panel.status} ${panel.statusNeutral} ${custom.customPrintQuoteSource}`
              }
            >
              {quote.source === 'server'
                ? 'Розраховано сервером'
                : 'Попередня локальна оцінка'}
            </div>
          ) : null}

          {hasQuoteData || hasQuoteStatus ? (
            <div className={custom.customPrintMeta}>
              <div className={custom.customPrintMetaRow}>
                <span className={custom.customPrintMetaKey}>Ціна за 1 шт.</span>
                <strong className={custom.customPrintMetaValue}>
                  {formatMoney(quote.unitPrice, quote.currency)}
                </strong>
              </div>

              <div className={custom.customPrintMetaRow}>
                <span className={custom.customPrintMetaKey}>Загальна ціна</span>
                <strong className={custom.customPrintMetaValue}>
                  {formatMoney(quote.totalPrice, quote.currency)}
                </strong>
              </div>

              <div className={custom.customPrintMetaRow}>
                <span className={custom.customPrintMetaKey}>Витрата матеріалу</span>
                <strong className={custom.customPrintMetaValue}>
                  {formatMaterialAmount(quote.materialG, quote.materialMl)}
                </strong>
              </div>

              <div className={custom.customPrintMetaRow}>
                <span className={custom.customPrintMetaKey}>Час друку</span>
                <strong className={custom.customPrintMetaValue}>
                  {formatMinutes(quote.printTimeMin)}
                </strong>
              </div>

              <div className={custom.customPrintMetaRow}>
                <span className={custom.customPrintMetaKey}>Орієнтовний термін</span>
                <strong className={custom.customPrintMetaValue}>
                  {formatLeadTimeDays(quote.leadTimeDays)}
                </strong>
              </div>

              <div className={custom.customPrintMetaRow}>
                <span className={custom.customPrintMetaKey}>Статус</span>
                <strong className={custom.customPrintMetaValue}>
                  {formatCustomPrintStatus(quote.state)}
                </strong>
              </div>
            </div>
          ) : null}

          {quote.note ? <p className={panel.cardText}>{quote.note}</p> : null}

          {quote.slicerError ? (
            <div className={panel.serverError}>
              Помилка слайсингу: {quote.slicerError}
            </div>
          ) : null}
        </>
      )}

      {ordered ? (
        <div className={`${panel.status} ${panel.statusOk}`}>
          Замовлення оформлено. Деталі та оплата — у розділі «Замовлення».
        </div>
      ) : null}

      <div className={panel.actionsRow}>
        {ordered ? null : hasQuote && canPurchase ? (
          <>
            <button
              type="button"
              className={panel.btnPrimary}
              onClick={onPurchase}
              disabled={disabled || !canPurchase || !onPurchase}
            >
              {busy ? 'Зачекай…' : 'Оформити замовлення'}
            </button>

            <button
              type="button"
              className={panel.btnSmall}
              onClick={onRecalculate}
              disabled={disabled || !onRecalculate}
            >
              {busy ? 'Розраховую…' : 'Оновити розрахунок'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={panel.btnPrimary}
              onClick={onRecalculate}
              disabled={disabled || !onRecalculate}
            >
              {busy ? 'Розраховую…' : hasQuote ? 'Оновити розрахунок' : 'Розрахувати'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}