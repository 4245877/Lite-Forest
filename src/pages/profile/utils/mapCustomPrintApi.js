import { createEmptyCustomPrintDraft } from './customPrintDefaults';
import { normalizeCustomPrintValues } from './customPrintValidation';

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function roundMoney(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function normalizeCustomPrintStatus(status) {
  const value = String(status || '').toLowerCase();

  if (value === 'ready') return 'quoted';
  if (value === 'calculated') return 'quoted';
  if (value === 'pending') return 'queued';
  if (value === 'error') return 'failed';

  if (['draft', 'queued', 'processing', 'quoted', 'ordered', 'failed'].includes(value)) {
    return value;
  }

  return value || 'draft';
}

export const CUSTOM_PRINT_POLL_STATUSES = new Set(['queued', 'processing']);

function getSlicerResult(item) {
  return firstDefined(
    item?.slicer_result,
    item?.slicerResult,
    item?.slicer,
    item?.metrics,
    null,
  );
}

// Превью модели рендерит воркер слайсинга. Бэкенд отдаёт его и верхним полем
// preview_url, и внутри slicer_result — читаем оба варианта на всякий случай.
function getPreviewUrl(item) {
  const slicerResult = getSlicerResult(item);

  return String(
    firstDefined(
      item?.preview_url,
      item?.previewUrl,
      slicerResult?.preview_url,
      slicerResult?.previewUrl,
      '',
    ) || '',
  );
}

function getSlicerError(item) {
  const slicerResult = getSlicerResult(item);

  return String(
    firstDefined(
      item?.slicer_error,
      item?.slicerError,
      item?.error_message,
      item?.errorMessage,
      item?.failure_reason,
      item?.failureReason,
      slicerResult?.error,
      slicerResult?.error_message,
      slicerResult?.message,
      '',
    ) || '',
  );
}

export function buildCustomPrintPayload(values = {}) {
  const next = normalizeCustomPrintValues(values);

  const payload = {
    original_filename: next.originalFilename,
    file_type: next.fileType || null,
    file_size: next.fileSize || null,
    print_type: next.printType,
    material: next.material,
    color: next.color,
    layer_height_mm: Number(next.quality),
    infill_pct: Number(next.infill),
    quantity: next.quantity,
    postprocess: next.postprocess,
    comment: next.comment,
  };

  if (next.fileId) payload.file_id = next.fileId;
  if (next.storageKey) payload.storage_key = next.storageKey;

  return payload;
}

export function buildCustomPrintFormData(values = {}) {
  const payload = buildCustomPrintPayload(values);
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value) || typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });

  if (values.file) {
    formData.append('file', values.file, values.file.name);
  }

  return formData;
}

export function mapCustomPrintApiQuote(payload, fallbackQuantity = 1) {
  const quantity = Math.max(1, Number(fallbackQuantity) || 1);

  const unitPrice = toNumber(
    firstDefined(
      payload?.quote?.unit_price,
      payload?.quote?.unitPrice,
      payload?.pricing?.unit_price,
      payload?.pricing?.unitPrice,
      payload?.unit_price,
      payload?.unitPrice,
      payload?.price,
    ),
    null,
  );

  const totalPriceRaw = toNumber(
    firstDefined(
      payload?.quote?.total_price,
      payload?.quote?.totalPrice,
      payload?.pricing?.total_price,
      payload?.pricing?.totalPrice,
      payload?.total_price,
      payload?.totalPrice,
    ),
    null,
  );

  const totalPrice =
    totalPriceRaw != null
      ? totalPriceRaw
      : unitPrice != null
        ? unitPrice * quantity
        : null;

  const materialG = toNumber(
    firstDefined(
      payload?.slicer_result?.material_g,
      payload?.slicerResult?.materialG,
      payload?.metrics?.material_g,
      payload?.metrics?.materialG,
      payload?.material_g,
      payload?.materialG,
    ),
    null,
  );

  const materialMl = toNumber(
    firstDefined(
      payload?.slicer_result?.material_ml,
      payload?.slicer_result?.material_cm3,
      payload?.slicerResult?.materialMl,
      payload?.slicerResult?.materialCm3,
      payload?.metrics?.material_ml,
      payload?.metrics?.materialMl,
      payload?.material_ml,
      payload?.materialMl,
    ),
    null,
  );

  const printTimeMin = toNumber(
    firstDefined(
      payload?.slicer_result?.print_time_total_min,
      payload?.slicer_result?.print_time_min,
      payload?.slicerResult?.printTimeTotalMin,
      payload?.slicerResult?.printTimeMin,
      payload?.metrics?.print_time_min,
      payload?.metrics?.printTimeMin,
      payload?.print_time_min,
      payload?.printTimeMin,
    ),
    null,
  );

  const leadTimeDays = toNumber(
    firstDefined(
      payload?.quote?.lead_time_days,
      payload?.quote?.leadTimeDays,
      payload?.lead_time_days,
      payload?.leadTimeDays,
    ),
    null,
  );

  const state = normalizeCustomPrintStatus(
    firstDefined(
      payload?.quote?.state,
      payload?.pricing?.state,
      payload?.quote_state,
      payload?.status,
      payload?.state,
      unitPrice != null || totalPrice != null ? 'quoted' : '',
    ),
  );

  const currency = String(
    firstDefined(
      payload?.quote?.currency,
      payload?.pricing?.currency,
      payload?.quote_currency,
      payload?.currency,
      'UAH',
    ),
  );

  const note = String(
    firstDefined(payload?.quote?.note, payload?.pricing?.note, payload?.note, ''),
  );

  const source = String(
    firstDefined(payload?.quote?.source, payload?.pricing?.source, payload?.source, 'server'),
  );

  const hasAnyData =
    Boolean(state && state !== 'draft') ||
    unitPrice != null ||
    totalPrice != null ||
    materialG != null ||
    materialMl != null ||
    printTimeMin != null;

  if (!hasAnyData) return null;

  return {
    state: state || 'queued',
    currency,
    unitPrice: unitPrice != null ? roundMoney(unitPrice) : null,
    totalPrice: totalPrice != null ? roundMoney(totalPrice) : null,
    materialG,
    materialMl,
    printTimeMin,
    leadTimeDays,
    source,
    note,
    slicerResult: getSlicerResult(payload),
    slicerError: getSlicerError(payload),
  };
}

export function createLocalQuoteFromDraft(values = {}) {
  const next = normalizeCustomPrintValues(values);
  const sizeMb = Math.max(0.2, (next.fileSize || 0) / (1024 * 1024) || 0.8);
  const infillPct = Math.max(0, Math.min(100, Number(next.infill) || 15));
  const quantity = Math.max(1, Number(next.quantity) || 1);

  const materialFactor = {
    pla: 1.0,
    petg: 1.12,
    abs: 1.18,
    tpu: 1.3,
    'resin-standard': 1.28,
    'resin-tough': 1.45,
  }[next.material] || 1;

  const density = {
    pla: 1.24,
    petg: 1.27,
    abs: 1.04,
    tpu: 1.21,
    'resin-standard': 1.12,
    'resin-tough': 1.15,
  }[next.material] || 1.2;

  const qualityFactor = {
    '0.12': 1.2,
    '0.16': 1.1,
    '0.20': 1.0,
    '0.28': 0.9,
    '0.32': 0.84,
  }[next.quality] || 1;

  const printTypeFactor = next.printType === 'resin' ? 1.4 : 1;
  const postFactor = 1 + next.postprocess.length * 0.08;

  const materialG = Math.round(
    Math.max(
      10,
      (sizeMb * 18 + 8) * (0.7 + infillPct / 25) * printTypeFactor,
    ),
  );

  const materialMl = Number((materialG / density).toFixed(1));

  const printTimeMin = Math.round(
    Math.max(
      35,
      materialG * (next.printType === 'resin' ? 1.9 : 2.6) * qualityFactor,
    ),
  );

  const baseUnitPrice =
    materialG * 2.2 +
    printTimeMin * 0.6 +
    (next.printType === 'resin' ? 55 : 35);

  const unitPrice = Math.max(
    70,
    Math.round((baseUnitPrice * materialFactor * qualityFactor * postFactor) / 5) * 5,
  );

  const totalPrice = unitPrice * quantity;
  const leadTimeDays = printTimeMin > 700 || quantity > 3 ? 4 : 2;

  return {
    state: 'ready',
    currency: 'UAH',
    unitPrice,
    totalPrice,
    materialG,
    materialMl,
    printTimeMin,
    leadTimeDays,
    source: 'local',
    note:
      'Попередній локальний розрахунок. Точна ціна підтверджується після серверного слайсингу моделі.',
  };
}

export function createLocalHistoryItem(values = {}, quote = null, overrides = {}) {
  const next = normalizeCustomPrintValues(values);
  const now = new Date().toISOString();
  const id =
    overrides.id ||
    next.id ||
    `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    status: normalizeCustomPrintStatus(
      overrides.status || (quote?.state === 'ready' ? 'quoted' : 'draft'),
    ),
    originalFilename: next.originalFilename,
    fileType: next.fileType,
    fileSize: next.fileSize,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    quote: quote || null,
    values: {
      ...createEmptyCustomPrintDraft(),
      ...next,
      id,
      file: null,
    },
  };
}

export function mapCustomPrintHistoryItem(item) {
  if (!item || typeof item !== 'object') return null;

  const id = String(firstDefined(item.id, item.request_id, item.requestId, '') || '');

  const slicerResult = getSlicerResult(item);
  const slicerError = getSlicerError(item);
  const previewUrl = getPreviewUrl(item);

  const status = normalizeCustomPrintStatus(
    firstDefined(
      item.status,
      item.state,
      item.quote_state,
      item.quote?.state,
      item.pricing?.state,
      'draft',
    ),
  );

  const values = {
    ...createEmptyCustomPrintDraft(),
    id,
    originalFilename: String(
      firstDefined(
        item.original_filename,
        item.originalFilename,
        item.filename,
        item.file?.filename,
        item.file?.name,
        '',
      ) || '',
    ),
    fileId: String(firstDefined(item.file_id, item.fileId, item.file?.id, '') || ''),
    storageKey: String(
      firstDefined(item.storage_key, item.storageKey, item.file?.storage_key, item.file?.storageKey, '') || '',
    ),
    fileType: String(
      firstDefined(item.file_type, item.fileType, item.file?.mime, item.file?.type, '') || '',
    ),
    fileSize: Number(
      firstDefined(item.file_size, item.fileSize, item.file?.size, 0) || 0,
    ),
    printType: String(firstDefined(item.print_type, item.printType, 'fdm') || 'fdm'),
    material: String(firstDefined(item.material, 'pla') || 'pla'),
    color: String(firstDefined(item.color, 'black') || 'black'),
    quality: String(
      firstDefined(item.layer_height_mm, item.layerHeightMm, item.quality, '0.20') || '0.20',
    ),
    infill: String(firstDefined(item.infill_pct, item.infillPct, item.infill, '15') || '15'),
    quantity: Math.max(1, Number(firstDefined(item.quantity, 1) || 1)),
    postprocess: toArray(firstDefined(item.postprocess, item.postprocesses, [])),
    comment: String(firstDefined(item.comment, item.notes, '') || ''),
    currency: String(firstDefined(item.quote_currency, item.currency, 'UAH') || 'UAH'),
    slicerResult,
    previewUrl,
    file: null,
  };

  const mappedQuote = mapCustomPrintApiQuote(item, values.quantity);

  const quote =
    mappedQuote ||
    (['queued', 'processing', 'failed'].includes(status)
      ? {
          state: status,
          currency: values.currency || 'UAH',
          unitPrice: null,
          totalPrice: null,
          materialG: null,
          materialMl: null,
          printTimeMin: null,
          leadTimeDays: null,
          source: 'server',
          note: '',
          slicerResult,
          slicerError,
        }
      : null);

  return {
    id: id || `remote-${Date.now().toString(36)}`,
    status,
    orderId: String(firstDefined(item.order_id, item.orderId, '') || ''),
    originalFilename: values.originalFilename,
    fileType: values.fileType,
    fileSize: values.fileSize,
    createdAt: String(firstDefined(item.created_at, item.createdAt, new Date().toISOString())),
    updatedAt: String(
      firstDefined(item.updated_at, item.updatedAt, item.created_at, item.createdAt, new Date().toISOString()),
    ),
    quote,
    slicerResult,
    slicerError,
    previewUrl,
    values,
  };
}