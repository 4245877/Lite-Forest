import React from 'react';
import panel from '../ProfileTabPanel.module.css';
import custom from './CustomPrint.module.css';
import {
  COLOR_OPTIONS,
  INFILL_OPTIONS,
  POSTPROCESS_OPTIONS,
  PRINT_TYPE_OPTIONS,
  QUALITY_OPTIONS,
  getMaterialOptions,
} from '../../utils/customPrintDefaults';

const DEFAULT_VALUES = {
  printType: '',
  material: '',
  color: '',
  quality: '',
  infill: '',
  quantity: 1,
  postprocess: [],
  comment: '',
};

const COMMENT_MAX_LENGTH = 1000;

export default function CustomPrintOptionsForm({
  values = DEFAULT_VALUES,
  errors = {},
  disabled = false,
  busy = false,
  onChange,
  onTogglePostprocess,
  onCalculate,
  onSaveDraft,
}) {
  const formValues = {
    ...DEFAULT_VALUES,
    ...values,
  };

  const materialOptions = getMaterialOptions(formValues.printType);
  const selectedPostprocess = Array.isArray(formValues.postprocess)
    ? formValues.postprocess
    : [];
  const commentLength = String(formValues.comment || '').length;

  // Скидання матеріалу під новий тип друку виконує батьківський обробник,
  // тут лише передаємо вибране значення.
  const handlePrintTypeChange = (nextPrintType) => {
    onChange?.('printType', nextPrintType);
  };

  const getErrorProps = (fieldName) => {
    if (!errors[fieldName]) {
      return {};
    }

    return {
      'aria-invalid': 'true',
      'aria-describedby': `${fieldName}-error`,
    };
  };

  const renderFieldError = (fieldName) => {
    if (!errors[fieldName]) {
      return null;
    }

    return (
      <div id={`${fieldName}-error`} className={panel.fieldError}>
        {errors[fieldName]}
      </div>
    );
  };

  return (
    <section className={panel.card}>
      <h3 className={panel.cardTitle}>2. Параметри друку</h3>

      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (!disabled) {
            onCalculate?.();
          }
        }}
      >
        <div className={panel.controlRow}>
          <div className={`${panel.inputGroup} ${panel.controlRowInput}`}>
            <label className={panel.inputLabel} htmlFor="printType">
              Тип друку
            </label>

            <select
              id="printType"
              className={panel.input}
              value={formValues.printType}
              onChange={(event) => handlePrintTypeChange(event.target.value)}
              disabled={disabled}
              {...getErrorProps('printType')}
            >
              {PRINT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderFieldError('printType')}
          </div>

          <div className={`${panel.inputGroup} ${panel.controlRowInput}`}>
            <label className={panel.inputLabel} htmlFor="material">
              Матеріал
            </label>

            <select
              id="material"
              className={panel.input}
              value={formValues.material}
              onChange={(event) => onChange?.('material', event.target.value)}
              disabled={disabled}
              {...getErrorProps('material')}
            >
              {materialOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderFieldError('material')}
          </div>
        </div>

        <div className={panel.controlRow}>
          <div className={`${panel.inputGroup} ${panel.controlRowInput}`}>
            <label className={panel.inputLabel} htmlFor="color">
              Колір
            </label>

            <select
              id="color"
              className={panel.input}
              value={formValues.color}
              onChange={(event) => onChange?.('color', event.target.value)}
              disabled={disabled}
              {...getErrorProps('color')}
            >
              {COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderFieldError('color')}
          </div>

          <div className={`${panel.inputGroup} ${panel.controlRowInput}`}>
            <label className={panel.inputLabel} htmlFor="quality">
              Якість / висота шару
            </label>

            <select
              id="quality"
              className={panel.input}
              value={formValues.quality}
              onChange={(event) => onChange?.('quality', event.target.value)}
              disabled={disabled}
              {...getErrorProps('quality')}
            >
              {QUALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderFieldError('quality')}
          </div>
        </div>

        <div className={panel.controlRow}>
          <div className={`${panel.inputGroup} ${panel.controlRowInput}`}>
            <label className={panel.inputLabel} htmlFor="infill">
              Заповнення
            </label>

            <select
              id="infill"
              className={panel.input}
              value={formValues.infill}
              onChange={(event) => onChange?.('infill', event.target.value)}
              disabled={disabled}
              {...getErrorProps('infill')}
            >
              {INFILL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {renderFieldError('infill')}
          </div>

          <div className={`${panel.inputGroup} ${panel.controlRowInput}`}>
            <label className={panel.inputLabel} htmlFor="quantity">
              Кількість
            </label>

            <input
              id="quantity"
              className={panel.input}
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              step="1"
              value={formValues.quantity}
              onChange={(event) => onChange?.('quantity', event.target.value)}
              disabled={disabled}
              {...getErrorProps('quantity')}
            />

            {renderFieldError('quantity')}
          </div>
        </div>

        <fieldset className={`${panel.inputGroup} ${panel.fieldset}`}>
          <legend className={panel.inputLabel}>Постобробка</legend>

          <div className={custom.customPrintCheckboxList}>
            {POSTPROCESS_OPTIONS.map((option) => (
              <label key={option.value} className={panel.checkRow}>
                <input
                  type="checkbox"
                  checked={selectedPostprocess.includes(option.value)}
                  onChange={() => onTogglePostprocess?.(option.value)}
                  disabled={disabled}
                />

                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <p className={panel.cardText}>
            Постобробка може змінити вартість і термін виконання після перевірки
            моделі.
          </p>
        </fieldset>

        <div className={panel.inputGroup}>
          <label className={panel.inputLabel} htmlFor="comment">
            Коментар до замовлення
          </label>

          <textarea
            id="comment"
            className={`${panel.input} ${panel.inputTextarea} ${custom.customPrintTextarea}`}
            rows={4}
            maxLength={COMMENT_MAX_LENGTH}
            value={formValues.comment}
            onChange={(event) => onChange?.('comment', event.target.value)}
            placeholder="Наприклад: потрібен акуратний шов, матова поверхня, без логотипів..."
            disabled={disabled}
            {...getErrorProps('comment')}
          />

          <div className={custom.customPrintCharCount}>
            {commentLength}/{COMMENT_MAX_LENGTH}
          </div>

          {renderFieldError('comment')}
        </div>

        <div className={panel.actionsRow}>
          <button type="submit" className={panel.btnPrimary} disabled={disabled}>
            {busy ? 'Розраховую…' : 'Розрахувати'}
          </button>

          <button
            type="button"
            className={panel.btnSmall}
            onClick={() => onSaveDraft?.()}
            disabled={disabled}
          >
            Зберегти чернетку
          </button>
        </div>
      </form>
    </section>
  );
}