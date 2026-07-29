import React from 'react';
import panel from '../ProfileTabPanel.module.css';
import custom from './CustomPrint.module.css';
import CustomPrintModelThumb from './CustomPrintModelThumb';
import {
  COLOR_OPTIONS,
  CUSTOM_PRINT_REMOTE_ENABLED,
  INFILL_OPTIONS,
  POSTPROCESS_OPTIONS,
  PRINT_TYPE_OPTIONS,
  QUALITY_OPTIONS,
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
  tpu: 'TPU',
  'resin-standard': 'Стандартна смола',
  'resin-tough': 'Міцна смола',
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

function formatPostprocess(postprocess) {
  if (!Array.isArray(postprocess) || postprocess.length === 0) {
    return 'Без постобробки';
  }

  return postprocess
    .map((value) => getOptionLabel(POSTPROCESS_OPTIONS, value))
    .filter((label) => label && label !== '—')
    .join(', ') || '—';
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
  const previewUrl = values?.previewUrl || '';
  const materialOptions = getMaterialOptions(values?.printType);

  return (
    <section className={`${panel.card} ${custom.customPrintPreviewCard}`}>
      <h3 className={panel.cardTitle}>Дані моделі</h3>

      {!hasFile ? (
        <p className={panel.cardText}>
          Тут з’явиться коротка інформація про обраний файл і параметри чернетки.
        </p>
      ) : (
        <>
          <div className={custom.customPrintPreviewMedia}>
            <CustomPrintModelThumb
              previewUrl={previewUrl}
              filename={filename}
              size="md"
            />
          </div>

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

          <PreviewMetaRow label="Якість / висота шару">
            {getOptionLabel(QUALITY_OPTIONS, values?.quality)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Заповнення">
            {getOptionLabel(INFILL_OPTIONS, values?.infill)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Постобробка">
            {formatPostprocess(values?.postprocess)}
          </PreviewMetaRow>

          <PreviewMetaRow label="Кількість">
            {formatQuantity(values?.quantity)}
          </PreviewMetaRow>
        </dl>
        </>
      )}

      {CUSTOM_PRINT_REMOTE_ENABLED &&
      values?.originalFilename &&
      !values?.file &&
      !values?.storageKey &&
      !values?.fileId ? (
        <p className={panel.cardText}>
          Це локальна чернетка. Для серверного розрахунку файл може знадобитися
          завантажити ще раз.
        </p>
      ) : null}
    </section>
  );
}