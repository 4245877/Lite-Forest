// src/components/product/ProductFilesModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '../../utils/assetUrl';
import {
  allSelectionKeys,
  modelRowId,
  modelSelectionKey,
  modelsForSelection,
  normalizeSelectionKeys,
} from '../../utils/productModels';
import './ProductFilesModal.css';

const PLACEHOLDER_SRC = '/placeholder-product.png';

const formatUAH = (n) => `${Number(n || 0).toLocaleString('uk-UA')} грн`;

// preview_url у файлов появится позже (рендер STL — отдельный этап ingester).
// Пока его нет — показываем обложку товара, а если и её нет — заглушку.
function resolvePreviewSrc(model, fallbackImage) {
  const raw = model?.preview_url;
  if (raw) return assetUrl(raw);
  return fallbackImage || PLACEHOLDER_SRC;
}

export default function ProductFilesModal({
  open,
  onClose,
  onConfirm,
  models = [],
  fallbackImage = '',
  productName = '',
  buyNow = false,
  // Ключи изначально выбранных деталей (key||url). null/[] → выбраны все детали.
  initialSelected = null,
  // Текст кнопки подтверждения (для режима редактирования в корзине).
  confirmLabel = '',
}) {
  // Состояние выбора — множество ключей деталей (key, иначе url). Так же, как на
  // бэкенде (selected_model_keys), а не «сырые» url.
  const [selected, setSelected] = useState(() => new Set());

  // При открытии (или смене набора деталей) восстанавливаем выбор: переданный
  // initialSelected (нормализованный к текущим деталям), иначе — все детали.
  useEffect(() => {
    if (!open) return;
    const initial = normalizeSelectionKeys(models, initialSelected);
    setSelected(new Set(initial.length ? initial : allSelectionKeys(models)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, models]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const hasPrices = useMemo(
    () => models.some((m) => Number.isFinite(Number(m?.price))),
    [models],
  );

  // Все валидные ключи деталей — для «Обрати всі» и подсчёта «X з Y».
  const selectableKeys = useMemo(() => allSelectionKeys(models), [models]);

  const selectedSummary = useMemo(() => {
    const chosen = modelsForSelection(models, [...selected]);
    return {
      count: chosen.length,
      items: chosen.reduce((acc, m) => acc + (Number(m?.qty) || 1), 0),
      sum: chosen.reduce((acc, m) => acc + (Number(m?.price) || 0), 0),
    };
  }, [models, selected]);

  if (!open) return null;

  const toggle = (rowKey) => {
    if (!rowKey) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(selectableKeys));
  const clearAll = () => setSelected(new Set());

  const allSelected = selectableKeys.length > 0 && selectedSummary.count === selectableKeys.length;
  const noneSelected = selectedSummary.count === 0;
  // Массовые действия имеют смысл только когда деталей больше одной.
  const showBulkActions = selectableKeys.length > 1;

  const canConfirm = selectedSummary.count > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    // Отдаём только валидные ключи (key||url) выбранных деталей, в порядке списка.
    onConfirm?.(normalizeSelectionKeys(models, [...selected]));
  };

  const primaryLabel = confirmLabel || (buyNow ? 'Купити зараз' : 'Додати в кошик');

  return (
    <div
      className="pfm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Склад замовлення"
      onClick={onClose}
    >
      <div className="pfm-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="pfm-header">
          <h2 className="pfm-title">Оберіть деталі для друку</h2>
          <button type="button" className="pfm-close" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
        </div>

        {productName ? <p className="pfm-subtitle">{productName}</p> : null}

        {showBulkActions ? (
          <div className="pfm-bulk">
            <span className="pfm-bulk-info">
              Обрано {selectedSummary.count} з {selectableKeys.length} деталей
            </span>
            <div className="pfm-bulk-actions">
              <button type="button" className="pfm-bulk-btn" onClick={selectAll} disabled={allSelected}>
                Обрати всі
              </button>
              <button type="button" className="pfm-bulk-btn" onClick={clearAll} disabled={noneSelected}>
                Зняти вибір
              </button>
            </div>
          </div>
        ) : null}

        {models.length > 0 ? (
          <ul className="pfm-list">
            {models.map((model, index) => {
              const src = resolvePreviewSrc(model, fallbackImage);
              const qty = Number(model?.qty) || 1;
              const rowKey = modelSelectionKey(model);
              const rowId = modelRowId(model, index);
              // Деталь без key/url нельзя выбрать как валидную — показываем
              // отмеченной, но заблокированной (в заказ она не уйдёт).
              const checked = rowKey ? selected.has(rowKey) : true;

              return (
                <li className="pfm-item" key={rowId}>
                  <label className="pfm-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!rowKey}
                      onChange={() => toggle(rowKey)}
                      aria-label={`Друкувати ${model?.filename || 'деталь'}`}
                    />
                    <span className="pfm-checkbox" aria-hidden />
                  </label>

                  <div className="pfm-thumb">
                    <img
                      src={src}
                      alt={model?.filename || 'Модель'}
                      loading="lazy"
                      onError={(event) => {
                        if (!String(event.currentTarget.src).includes(PLACEHOLDER_SRC)) {
                          event.currentTarget.src = PLACEHOLDER_SRC;
                        }
                      }}
                    />
                  </div>

                  <div className="pfm-info">
                    <span className="pfm-name" title={model?.filename}>
                      {model?.filename || 'Без назви'}
                    </span>
                    {model?.type ? (
                      <span className="pfm-type">{String(model.type).toUpperCase()}</span>
                    ) : null}
                  </div>

                  {hasPrices ? (
                    <div className="pfm-price">{formatUAH(model?.price)}</div>
                  ) : null}
                  <div className="pfm-qty">×{qty}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pfm-empty">Для цього товару немає окремих файлів моделі.</p>
        )}

        <div className="pfm-footer">
          <div className="pfm-total">
            {noneSelected && models.length > 0 ? (
              <span className="pfm-hint" role="alert">
                Оберіть хоча б одну деталь для друку
              </span>
            ) : (
              <>
                Обрано: <strong>{selectedSummary.count}</strong> з {selectableKeys.length || models.length}
                {hasPrices ? (
                  <>
                    {' • '}
                    <strong>{formatUAH(selectedSummary.sum)}</strong>
                    {!allSelected ? <span className="pfm-approx"> (попередньо)</span> : null}
                  </>
                ) : null}
              </>
            )}
          </div>

          <div className="pfm-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Скасувати
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
