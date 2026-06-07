import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';

import panel from '../components/ProfileTabPanel.module.css';
import custom from '../components/custom-print/CustomPrint.module.css';

import CustomPrintUploader from '../components/custom-print/CustomPrintUploader';
import CustomPrintFilePreview from '../components/custom-print/CustomPrintFilePreview';
import CustomPrintOptionsForm from '../components/custom-print/CustomPrintOptionsForm';
import CustomPrintQuoteCard from '../components/custom-print/CustomPrintQuoteCard';
import CustomPrintHistoryList from '../components/custom-print/CustomPrintHistoryList';

import {
  CUSTOM_PRINT_REMOTE_ENABLED,
  LOCAL_STORAGE_KEYS,
  createEmptyCustomPrintDraft,
  getDefaultMaterialForPrintType,
  getMaterialOptions,
} from '../utils/customPrintDefaults';

import {
  hasCustomPrintErrors,
  normalizeCustomPrintValues,
  validateCustomPrintDraft,
} from '../utils/customPrintValidation';

import {
  CUSTOM_PRINT_POLL_STATUSES,
  buildCustomPrintPayload,
  createLocalHistoryItem,
  createLocalQuoteFromDraft,
  mapCustomPrintHistoryItem,
  normalizeCustomPrintStatus,
} from '../utils/mapCustomPrintApi';

function safeReadJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function safeReadString(key) {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeWriteString(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {}
}

function sortHistory(items = []) {
  return [...items].sort((a, b) => {
    const left = new Date(b.updatedAt || 0).getTime();
    const right = new Date(a.updatedAt || 0).getTime();
    return left - right;
  });
}

function mergeHistoryLists(current = [], incoming = []) {
  const map = new Map();
  [...current, ...incoming].forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return sortHistory(Array.from(map.values()));
}

function getLocalFallbackHistory() {
  return safeReadJson(LOCAL_STORAGE_KEYS.history, []).filter((item) =>
    String(item?.id || '').startsWith('local-'),
  );
}

function errorMessage(error) {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Невідома помилка';
  return text.replace(/^Error:\s*/i, '').trim();
}

export default function CustomPrintTab() {
  const [values, setValues] = useState(createEmptyCustomPrintDraft());
  const [quote, setQuote] = useState(null);
  const [errors, setErrors] = useState({});
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [warning, setWarning] = useState('');

  const activeItem = useMemo(
    () => history.find((item) => item.id === activeId) || null,
    [history, activeId],
  );

  const activeSlicerError =
    activeItem?.slicerError ||
    quote?.slicerError ||
    values?.slicerResult?.error ||
    values?.slicerResult?.error_message ||
    '';

  const canAddToCart =
    CUSTOM_PRINT_REMOTE_ENABLED &&
    Boolean(activeId) &&
    !String(activeId).startsWith('local-') &&
    normalizeCustomPrintStatus(activeItem?.status || quote?.state) === 'quoted' &&
    Boolean(quote?.totalPrice);

  function persistHistory(nextItems) {
    const sorted = sortHistory(nextItems);
    setHistory(sorted);
    safeWriteJson(LOCAL_STORAGE_KEYS.history, sorted);
  }

  function activateItem(item, file = null) {
    if (!item) return;

    setActiveId(item.id);
    safeWriteString(LOCAL_STORAGE_KEYS.activeId, item.id);
    setValues({
      ...createEmptyCustomPrintDraft(),
      ...(item.values || {}),
      id: item.id,
      file,
    });
    setQuote(item.quote || null);
    setErrors({});
  }

  function resetForm() {
    setValues(createEmptyCustomPrintDraft());
    setQuote(null);
    setErrors({});
    setActiveId('');
    safeWriteString(LOCAL_STORAGE_KEYS.activeId, '');
  }

  function storeAndActivate(item, file = null) {
    const next = mergeHistoryLists(history, [item]);
    persistHistory(next);
    activateItem(item, file);
  }

  const refreshRemoteHistory = async () => {
    if (!CUSTOM_PRINT_REMOTE_ENABLED) return;

    const response = await api.getMyCustomPrintRequests();
    const list = Array.isArray(response)
      ? response
      : response?.items || response?.results || response?.requests || [];

    const mapped = list.map(mapCustomPrintHistoryItem).filter(Boolean);
    const merged = mergeHistoryLists(getLocalFallbackHistory(), mapped);

    persistHistory(merged);

    const currentId = safeReadString(LOCAL_STORAGE_KEYS.activeId) || activeId;
    const current = merged.find((item) => item.id === currentId);

    if (current) {
      activateItem(current, null);
    }
  };

  useEffect(() => {
    const localHistory = sortHistory(safeReadJson(LOCAL_STORAGE_KEYS.history, []));
    setHistory(localHistory);

    const savedId = safeReadString(LOCAL_STORAGE_KEYS.activeId);
    const initialItem =
      localHistory.find((item) => item.id === savedId) ||
      localHistory[0] ||
      null;

    if (initialItem) activateItem(initialItem, null);
  }, []);

  useEffect(() => {
    if (!CUSTOM_PRINT_REMOTE_ENABLED) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const response = await api.getMyCustomPrintRequests();
        const list = Array.isArray(response)
          ? response
          : response?.items || response?.results || response?.requests || [];

        const mapped = list.map(mapCustomPrintHistoryItem).filter(Boolean);

        if (cancelled || !mapped.length) return;

        const merged = mergeHistoryLists(getLocalFallbackHistory(), mapped);
        persistHistory(merged);

        const storedId = safeReadString(LOCAL_STORAGE_KEYS.activeId);
        if (!storedId && merged[0]) activateItem(merged[0], null);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!CUSTOM_PRINT_REMOTE_ENABLED) return undefined;

    const hasActiveProcessing = history.some((item) =>
      CUSTOM_PRINT_POLL_STATUSES.has(
        normalizeCustomPrintStatus(item.status || item.quote?.state),
      ),
    );

    if (!hasActiveProcessing) return undefined;

    const timer = window.setInterval(() => {
      refreshRemoteHistory().catch(() => {});
    }, 4000);

    return () => window.clearInterval(timer);
  }, [history, activeId]);

  const handleFieldChange = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };

      if (name === 'printType') {
        const allowed = getMaterialOptions(value);
        if (!allowed.some((option) => option.value === next.material)) {
          next.material = getDefaultMaterialForPrintType(value);
        }
      }

      return next;
    });

    setErrors((prev) => ({ ...prev, [name]: '' }));
    setNotice('');
    setWarning('');
  };

  const handleTogglePostprocess = (value) => {
    setValues((prev) => {
      const current = Array.isArray(prev.postprocess) ? prev.postprocess : [];
      const hasValue = current.includes(value);

      return {
        ...prev,
        postprocess: hasValue
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });

    setNotice('');
    setWarning('');
  };

  const handleFileSelect = (file) => {
    setValues((prev) => ({
      ...prev,
      id: '',
      file,
      originalFilename: file?.name || '',
      fileType: file?.type || '',
      fileSize: file?.size || 0,
      fileId: '',
      storageKey: '',
      slicerResult: null,
    }));
    setActiveId('');
    setQuote(null);
    setErrors((prev) => ({ ...prev, file: '' }));
    setNotice('');
    setWarning('');
  };

  const handleClearFile = () => {
    setValues((prev) => ({
      ...prev,
      id: '',
      file: null,
      originalFilename: '',
      fileType: '',
      fileSize: 0,
      fileId: '',
      storageKey: '',
      slicerResult: null,
    }));
    setActiveId('');
    setQuote(null);
    setErrors((prev) => ({ ...prev, file: '' }));
    setNotice('');
    setWarning('');
  };

  const handleSelectHistory = (item) => {
    activateItem(item, null);
    setNotice('Чернетку завантажено з історії.');
    setWarning('');
  };

  const handleDeleteHistory = async (id) => {
    const next = history.filter((item) => item.id !== id);
    persistHistory(next);

    if (CUSTOM_PRINT_REMOTE_ENABLED && !String(id).startsWith('local-')) {
      try {
        await api.deleteCustomPrintRequest(id);
      } catch {}
    }

    if (id === activeId) {
      if (next[0]) activateItem(next[0], null);
      else resetForm();
    }

    setNotice('Чернетку видалено.');
    setWarning('');
  };

  const handleSaveDraft = () => {
    const normalized = normalizeCustomPrintValues(values);
    const nextErrors = validateCustomPrintDraft(normalized, { requireFile: true });

    if (hasCustomPrintErrors(nextErrors)) {
      setErrors(nextErrors);
      setNotice('');
      setWarning('Будь ласка, виправ помилки перед збереженням.');
      return;
    }

    const item = createLocalHistoryItem(
      normalized,
      quote,
      {
        id: activeId || normalized.id || undefined,
        status: quote?.state === 'ready' ? 'quoted' : 'draft',
        createdAt: activeItem?.createdAt,
      },
    );

    storeAndActivate(item, normalized.file || null);
    setNotice('Чернетку збережено локально в браузері.');
    setWarning(
      CUSTOM_PRINT_REMOTE_ENABLED
        ? ''
        : 'Поки що історія працює без сервера і зберігається лише в цьому браузері.',
    );
  };

  const handleCalculate = async () => {
    const normalized = normalizeCustomPrintValues(values);
    const nextErrors = validateCustomPrintDraft(normalized, { requireFile: true });

    if (hasCustomPrintErrors(nextErrors)) {
      setErrors(nextErrors);
      setNotice('');
      setWarning('Будь ласка, перевір форму перед розрахунком.');
      return;
    }

    setBusy(true);
    setErrors({});
    setNotice('');
    setWarning('');

    try {
      if (CUSTOM_PRINT_REMOTE_ENABLED) {
        let working = { ...normalized };

        if (working.file && !working.fileId && !working.storageKey) {
          const uploadResponse = await api.uploadCustomPrintFile(working.file);

          working = {
            ...working,
            fileId: String(uploadResponse?.fileId || uploadResponse?.file_id || uploadResponse?.id || ''),
            storageKey: String(uploadResponse?.storageKey || uploadResponse?.storage_key || ''),
            originalFilename:
              uploadResponse?.filename ||
              uploadResponse?.original_filename ||
              working.originalFilename,
            fileType:
              uploadResponse?.fileType ||
              uploadResponse?.file_type ||
              working.fileType,
            fileSize:
              uploadResponse?.size ||
              uploadResponse?.file_size ||
              working.fileSize,
          };
        }

        const payload = buildCustomPrintPayload(working);

        const response =
          working.id && !String(working.id).startsWith('local-')
            ? await api.recalculateCustomPrintQuote(working.id, payload)
            : await api.createCustomPrintRequest(payload);

        const mapped = mapCustomPrintHistoryItem(response);

        if (!mapped) {
          throw new Error('Сервер не повернув коректну відповідь для розрахунку.');
        }

        const fullItem = {
          ...mapped,
          values: {
            ...createEmptyCustomPrintDraft(),
            ...(mapped.values || {}),
            file: null,
          },
        };

        storeAndActivate(fullItem, working.file || null);
        setQuote(fullItem.quote || null);

        const itemStatus = normalizeCustomPrintStatus(fullItem.status || fullItem.quote?.state);

        if (CUSTOM_PRINT_POLL_STATUSES.has(itemStatus)) {
          setNotice('Файл прийнято. Слайсинг виконується, результат оновиться автоматично.');

          window.setTimeout(() => {
            refreshRemoteHistory().catch(() => {});
          }, 1200);
        } else {
          setNotice('Розрахунок оновлено за даними сервера.');
        }
      } else {
        const localQuote = createLocalQuoteFromDraft(normalized);
        const localItem = createLocalHistoryItem(
          normalized,
          localQuote,
          {
            id: activeId || normalized.id || undefined,
            status: 'quoted',
            createdAt: activeItem?.createdAt,
          },
        );

        storeAndActivate(localItem, normalized.file || null);
        setQuote(localQuote);
        setNotice('Показано попередній локальний розрахунок.');
        setWarning('Точна ціна буде визначатися після підключення серверного слайсингу.');
      }
    } catch (error) {
      if (CUSTOM_PRINT_REMOTE_ENABLED) {
        setQuote(null);
        setNotice('');
        setWarning(errorMessage(error));

        await refreshRemoteHistory().catch(() => {});
        return;
      }

      const fallbackQuote = createLocalQuoteFromDraft(normalized);
      const fallbackItem = createLocalHistoryItem(
        normalized,
        fallbackQuote,
        {
          id: activeId || normalized.id || undefined,
          status: 'quoted',
          createdAt: activeItem?.createdAt,
        },
      );

      storeAndActivate(fallbackItem, normalized.file || null);
      setQuote(fallbackQuote);
      setNotice('Показано попередній локальний розрахунок.');
      setWarning('Точна ціна буде визначатися після підключення серверного слайсингу.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddToCart = async () => {
    if (!canAddToCart) {
      setNotice('');
      setWarning('Інтеграція з кошиком ще не підключена для локального режиму.');
      return;
    }

    setBusy(true);
    setNotice('');
    setWarning('');

    try {
      await api.addCustomPrintRequestToCart(activeId);
      setNotice('Позицію додано в кошик.');
    } catch (error) {
      setWarning(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={panel.section}>
      <h2 className={panel.sectionTitle}>3D-друк по файлу</h2>
      <p className={custom.customPrintLead}>
        Завантаж свою модель у форматі STL або 3MF, обери параметри друку й отримай
        попередній розрахунок вартості.
      </p>

      {!CUSTOM_PRINT_REMOTE_ENABLED ? (
        <div className={panel.serverError}>
          Зараз вкладка працює у локальному режимі. Чернетки та історія зберігаються
          в браузері, а ціна розраховується приблизно.
        </div>
      ) : null}

      {notice ? <div className={panel.serverOk}>{notice}</div> : null}
      {warning ? <div className={panel.serverError}>{warning}</div> : null}

      <div className={custom.customPrintTopGrid}>
        <CustomPrintUploader
          file={values.file}
          currentFilename={values.originalFilename}
          currentFileSize={values.fileSize}
          error={errors.file}
          slicerError={activeSlicerError}
          disabled={busy}
          onFileSelect={handleFileSelect}
          onClear={handleClearFile}
        />

        <CustomPrintFilePreview values={values} />
      </div>

      <div className={custom.customPrintMainGrid}>
        <CustomPrintOptionsForm
          values={values}
          errors={errors}
          disabled={busy}
          onChange={handleFieldChange}
          onTogglePostprocess={handleTogglePostprocess}
          onCalculate={handleCalculate}
          onSaveDraft={handleSaveDraft}
        />

        <CustomPrintQuoteCard
          quote={quote}
          disabled={busy}
          onRecalculate={handleCalculate}
          onAddToCart={handleAddToCart}
          canAddToCart={canAddToCart}
        />
      </div>

      <CustomPrintHistoryList
        items={history}
        activeId={activeId}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
      />
    </section>
  );
}