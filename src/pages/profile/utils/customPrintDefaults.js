export const CUSTOM_PRINT_REMOTE_ENABLED =
  String(import.meta.env.VITE_CUSTOM_PRINT_REMOTE || '').trim() === '1';

export const MAX_CUSTOM_PRINT_FILE_SIZE_MB = Number.parseInt(
  import.meta.env.VITE_CUSTOM_PRINT_MAX_FILE_MB || '100',
  10,
);

export const ACCEPTED_CUSTOM_PRINT_EXTENSIONS = ['stl', '3mf'];

export const LOCAL_STORAGE_KEYS = {
  history: 'lite-forest.custom-print.history.v1',
  activeId: 'lite-forest.custom-print.active-id.v1',
};

export const PRINT_TYPE_OPTIONS = [
  { value: 'fdm', label: 'FDM / пластик' },
  { value: 'resin', label: 'Resin / фотополімер' },
];

export const MATERIAL_OPTIONS = [
  { value: 'pla', label: 'PLA', printTypes: ['fdm'] },
  { value: 'petg', label: 'PETG', printTypes: ['fdm'] },
  { value: 'abs', label: 'ABS', printTypes: ['fdm'] },
  { value: 'tpu', label: 'TPU', printTypes: ['fdm'] },
  { value: 'resin-standard', label: 'Стандартна смола', printTypes: ['resin'] },
  { value: 'resin-tough', label: 'Міцна смола', printTypes: ['resin'] },
];

export const COLOR_OPTIONS = [
  { value: 'black', label: 'Чорний' },
  { value: 'white', label: 'Білий' },
  { value: 'gray', label: 'Сірий' },
  { value: 'red', label: 'Червоний' },
  { value: 'blue', label: 'Синій' },
  { value: 'green', label: 'Зелений' },
  { value: 'yellow', label: 'Жовтий' },
  { value: 'transparent', label: 'Прозорий' },
  { value: 'other', label: 'Інший' },
];

export const QUALITY_OPTIONS = [
  { value: '0.12', label: 'Детально — 0.12 мм' },
  { value: '0.16', label: 'Висока якість — 0.16 мм' },
  { value: '0.20', label: 'Стандарт — 0.20 мм' },
  { value: '0.28', label: 'Швидко — 0.28 мм' },
  { value: '0.32', label: 'Чернетка — 0.32 мм' },
];

export const INFILL_OPTIONS = [
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: '40', label: '40%' },
  { value: '60', label: '60%' },
  { value: '80', label: '80%' },
  { value: '100', label: '100%' },
];

export const POSTPROCESS_OPTIONS = [
  { value: 'support-removal', label: 'Видалення підтримок' },
  { value: 'sanding', label: 'Шліфування' },
  { value: 'priming', label: 'Ґрунтування' },
  { value: 'painting', label: 'Фарбування' },
  { value: 'assembly', label: 'Збірка' },
];

// Єдина мапа підписів статусів, щоб картка розрахунку та історія відображали
// той самий стан однаковим текстом.
export const CUSTOM_PRINT_STATUS_LABELS = {
  draft: 'Чернетка',
  queued: 'У черзі',
  pending: 'У черзі',
  processing: 'Слайсинг виконується',
  quoted: 'Розраховано',
  calculated: 'Розраховано',
  ready: 'Розраховано',
  ordered: 'Замовлено',
  failed: 'Помилка',
  error: 'Помилка',
};

export function formatCustomPrintStatus(state, fallback = 'Невідомий статус') {
  const key = String(state || 'draft').toLowerCase();
  return CUSTOM_PRINT_STATUS_LABELS[key] || fallback;
}

export const CUSTOM_PRINT_DEFAULTS = {
  id: '',
  file: null,
  originalFilename: '',
  fileId: '',
  storageKey: '',
  fileType: '',
  fileSize: 0,
  previewUrl: '',
  slicerResult: null,
  printType: 'fdm',
  material: 'pla',
  color: 'black',
  quality: '0.20',
  infill: '15',
  quantity: 1,
  postprocess: [],
  comment: '',
  currency: 'UAH',
};

export function getMaterialOptions(printType = 'fdm') {
  return MATERIAL_OPTIONS.filter((option) => option.printTypes.includes(printType));
}

export function getDefaultMaterialForPrintType(printType = 'fdm') {
  return getMaterialOptions(printType)[0]?.value || 'pla';
}

export function createEmptyCustomPrintDraft() {
  return {
    ...CUSTOM_PRINT_DEFAULTS,
    postprocess: [...CUSTOM_PRINT_DEFAULTS.postprocess],
  };
}