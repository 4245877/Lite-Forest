import React from 'react';
import panel from '../ProfileTabPanel.module.css';
import custom from './CustomPrint.module.css';
import {
  COLOR_OPTIONS,
  PRINT_TYPE_OPTIONS,
  getMaterialOptions,
} from '../../utils/customPrintDefaults';
import { formatFileSize } from '../../utils/customPrintValidation';

const FALLBACK_COLOR_LABELS = {
  black: 'Чорний',
  white: 'Білий',
  gray: 'Сірий',
  grey: 'Сірий',
  red: 'Червоний',
  blue: 'Синій',
  green: 'Зелений',
  yellow: 'Жовтий',
  orange: 'Помаранчевий',
  transparent: 'Прозорий',
  natural: 'Натуральний',
  custom: 'Інший',
};

const FALLBACK_MATERIAL_LABELS = {
  pla: 'PLA',
  petg: 'PETG',
  abs: 'ABS',
  asa: 'ASA',
  tpu: 'TPU',
  resin: 'Фотополімерна смола',
  standard_resin: 'Стандартна смола',
};

function getFileExt(filename = '') {
  const normalizedFilename = String(filename).trim();
  const lastDotIndex = normalizedFilename.lastIndexOf('.');

  if (lastDotIndex <= 0 || lastDotIndex === normalizedFilename.length - 1) {
    return '—';
  }

  return normalizedFilename.slice(lastDotIndex + 1).toUpperCase();
}

function getOptionLabel(options = [], value, fallbackLabels = {}) {
  if (value == null || value === '') return '—';

  const normalizedValue = String(value).trim().toLowerCase();

  if (!normalizedValue) return '—';

  const option = options.find(
    (item) => String(item.value).trim().toLowerCase() === normalizedValue,
  );

  return option?.label || fallbackLabels[normalizedValue] || String(value);
}

function formatPreviewFileSize(size) {
  if (size == null || Number(size) <= 0 || Number.isNaN(Number(size))) {
    return '—';
  }

  return formatFileSize(Number(size));
}

function formatQuantity(quantity) {
  if (quantity == null || quantity === '') return '1';

  const numberValue = Number(quantity);

  if (!Number.isInteger(numberValue) || numberValue <= 0) return '—';

  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function PreviewMetaRow({ label, children }) {
  return (
    <div className={custom.customPrintMetaRow}>
      <dt className={custom.customPrintMetaKey}>{label}</dt>
      <dd className={custom.customPrintMetaValue}>{children}</dd>
    </div>
  );
}

export default function CustomPrintFilePreview({ values }) {
  const filename = String(values?.originalFilename ?? values?.file?.name ?? '');
  const fileSize = values?.fileSize ?? values?.file?.size ?? 0;
  const hasFile = Boolean(values?.file || values?.originalFilename);
  const materialOptions = getMaterialOptions(values?.printType);

  return (
    <section className={`${panel.card} ${custom.customPrintPreviewCard}`}>
      <h3 className={panel.cardTitle}>2. Дані моделі</h3>

      {!hasFile ? (
        <p className={panel.cardText}>
          Тут з’явиться коротка інформація про обраний файл і параметри чернетки.
        </p>
      ) : (
        <dl className={custom.customPrintMeta}>
          <PreviewMetaRow label="Назва">
            {filename || 'Без назви'}
          </PreviewMetaRow>

          <PreviewMetaRow label="Формат">
            {getFileExt(filename)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Розмір">
            {formatPreviewFileSize(fileSize)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Тип друку">
            {getOptionLabel(PRINT_TYPE_OPTIONS, values?.printType)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Матеріал">
            {getOptionLabel(
              materialOptions,
              values?.material,
              FALLBACK_MATERIAL_LABELS,
            )}
          </PreviewMetaRow>

          <PreviewMetaRow label="Колір">
            {getOptionLabel(COLOR_OPTIONS, values?.color, FALLBACK_COLOR_LABELS)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Кількість">
            {formatQuantity(values?.quantity)}
          </PreviewMetaRow>
        </dl>
      )}

      {Boolean(
        values?.originalFilename &&
          !values?.file &&
          !values?.storageKey &&
          !values?.fileId,
      ) ? (
        <p className={panel.cardText}>
          Це локальна чернетка. Для серверного розрахунку файл може знадобитися
          завантажити ще раз.
        </p>
      ) : null}
    </section>
  );
}