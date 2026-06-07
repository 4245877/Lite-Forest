import {
  ACCEPTED_CUSTOM_PRINT_EXTENSIONS,
  MAX_CUSTOM_PRINT_FILE_SIZE_MB,
  createEmptyCustomPrintDraft,
  getMaterialOptions,
} from './customPrintDefaults';

function getExt(filename = '') {
  const parts = String(filename || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

export function formatFileSize(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '0 Б';
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export function normalizeCustomPrintValues(values = {}) {
  const base = createEmptyCustomPrintDraft();
  const next = {
    ...base,
    ...values,
  };

  const quantity = Number.parseInt(next.quantity, 10);
  const infill = Number.parseInt(next.infill, 10);

  next.quantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  next.infill = String(Number.isFinite(infill) ? Math.min(Math.max(infill, 0), 100) : 15);
  next.quality = String(next.quality || base.quality);
  next.printType = String(next.printType || base.printType);
  next.material = String(next.material || base.material);
  next.color = String(next.color || base.color);
  next.comment = String(next.comment || '').trim().slice(0, 1000);
  next.originalFilename = String(next.originalFilename || next.file?.name || '');
  next.fileType = String(next.fileType || next.file?.type || getExt(next.originalFilename)).trim();
  next.fileSize = Number(next.fileSize || next.file?.size || 0) || 0;
  next.fileId = String(next.fileId || '');
  next.storageKey = String(next.storageKey || '');
  next.postprocess = Array.isArray(next.postprocess)
    ? Array.from(new Set(next.postprocess.map((v) => String(v).trim()).filter(Boolean)))
    : [];

  return next;
}

export function validateCustomPrintFile(file) {
  if (!file) return 'Оберіть файл STL або 3MF.';

  const filename = file.name || '';
  const ext = getExt(filename);

  if (!ACCEPTED_CUSTOM_PRINT_EXTENSIONS.includes(ext)) {
    return 'Підтримуються лише файли STL та 3MF.';
  }

  const maxBytes = MAX_CUSTOM_PRINT_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Файл завеликий. Максимум — ${MAX_CUSTOM_PRINT_FILE_SIZE_MB} МБ.`;
  }

  return '';
}

export function validateCustomPrintDraft(values, { requireFile = true } = {}) {
  const next = normalizeCustomPrintValues(values);
  const errors = {};

  const hasStoredReference =
    Boolean(next.originalFilename) || Boolean(next.fileId) || Boolean(next.storageKey);

  if (requireFile && !next.file && !hasStoredReference) {
    errors.file = 'Завантаж, будь ласка, STL або 3MF.';
  }

  if (next.file) {
    const fileError = validateCustomPrintFile(next.file);
    if (fileError) errors.file = fileError;
  } else if (next.originalFilename) {
    const ext = getExt(next.originalFilename);
    if (!ACCEPTED_CUSTOM_PRINT_EXTENSIONS.includes(ext)) {
      errors.file = 'Підтримуються лише файли STL та 3MF.';
    }
  }

  if (!next.printType) {
    errors.printType = 'Оберіть тип друку.';
  }

  const materialOptions = getMaterialOptions(next.printType);
  if (!materialOptions.some((option) => option.value === next.material)) {
    errors.material = 'Оберіть матеріал, сумісний з типом друку.';
  }

  if (!next.color) {
    errors.color = 'Оберіть колір.';
  }

  if (!next.quality) {
    errors.quality = 'Оберіть якість друку.';
  }

  if (!next.infill) {
    errors.infill = 'Оберіть заповнення.';
  }

  if (!Number.isFinite(next.quantity) || next.quantity < 1 || next.quantity > 100) {
    errors.quantity = 'Кількість має бути від 1 до 100.';
  }

  if (next.comment.length > 1000) {
    errors.comment = 'Коментар занадто довгий.';
  }

  return errors;
}

export function hasCustomPrintErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}