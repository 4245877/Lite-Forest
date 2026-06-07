import React, { useId, useRef, useState } from 'react';
import panel from '../ProfileTabPanel.module.css';
import custom from './CustomPrint.module.css';
import {
  ACCEPTED_CUSTOM_PRINT_EXTENSIONS,
  MAX_CUSTOM_PRINT_FILE_SIZE_MB,
} from '../../utils/customPrintDefaults';
import { formatFileSize } from '../../utils/customPrintValidation';

const visuallyHiddenInputStyle = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default function CustomPrintUploader({
  file,
  currentFilename = '',
  currentFileSize = 0,
  error = '',
  slicerError = '',
  disabled = false,
  onFileSelect,
  onClear,
}) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);
  const inputId = useId();

  const activeName = file?.name || currentFilename || '';
  const activeSize = file?.size ?? currentFileSize ?? 0;
  const accept = ACCEPTED_CUSTOM_PRINT_EXTENSIONS.map((ext) => `.${ext}`).join(',');

  const openFileDialog = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleChange = (event) => {
    const nextFile = event.target.files?.[0];

    if (nextFile) {
      onFileSelect?.(nextFile);
    }

    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOver(false);

    if (disabled) return;

    const nextFile = event.dataTransfer?.files?.[0];

    if (nextFile) {
      onFileSelect?.(nextFile);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFileDialog();
    }
  };

  return (
    <section className={panel.card}>
      <h3 className={panel.cardTitle}>1. Завантаження моделі</h3>

      <p className={panel.cardText}>
        Завантаж STL або 3MF, обери параметри друку й отримай попередній
        розрахунок вартості.
      </p>

      <input
        ref={inputRef}
        id={inputId}
        style={visuallyHiddenInputStyle}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Обрати файл моделі"
      />

      <div
        className={`${custom.customPrintDropzone} ${
          isOver ? custom.customPrintDropzoneActive : ''
        }`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled ? 'true' : 'false'}
        aria-label="Завантажити файл моделі"
        onClick={openFileDialog}
        onKeyDown={handleKeyDown}
        onDragEnter={(event) => {
          if (disabled) return;

          event.preventDefault();
          setIsOver(true);
        }}
        onDragOver={(event) => {
          if (disabled) return;

          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setIsOver(true);
        }}
        onDragLeave={(event) => {
          const relatedTarget = event.relatedTarget;

          if (
            relatedTarget instanceof Node &&
            event.currentTarget.contains(relatedTarget)
          ) {
            return;
          }

          event.preventDefault();
          setIsOver(false);
        }}
        onDrop={handleDrop}
      >
        <div className={custom.customPrintDropIcon} aria-hidden="true">
          ⬆
        </div>

        <div className={custom.customPrintDropTitle}>
          {activeName ? 'Файл обрано' : 'Перетягни файл сюди або натисни, щоб обрати'}
        </div>

        <div className={custom.customPrintDropMeta}>
          Підтримуються: {ACCEPTED_CUSTOM_PRINT_EXTENSIONS.join(', ').toUpperCase()}
          <br />
          Максимальний розмір: {MAX_CUSTOM_PRINT_FILE_SIZE_MB} МБ
        </div>
      </div>

      {activeName ? (
        <div className={custom.customPrintCurrentFile}>
          <strong>Обраний файл:</strong> {activeName}
          {activeSize > 0 ? ` · ${formatFileSize(activeSize)}` : ''}
        </div>
      ) : null}

      {slicerError ? (
        <div className={panel.serverError} role="alert">
          Помилка слайсингу: {slicerError}
        </div>
      ) : null}

      {error ? (
        <div className={panel.serverError} role="alert">
          {error}
        </div>
      ) : null}

      <div className={custom.customPrintInlineActions}>
        <button
          type="button"
          className={panel.btnSmall}
          onClick={openFileDialog}
          disabled={disabled}
        >
          {activeName ? 'Замінити файл' : 'Обрати файл'}
        </button>

        {activeName ? (
          <button
            type="button"
            className={panel.btnSmall}
            onClick={() => onClear?.()}
            disabled={disabled}
          >
            Очистити
          </button>
        ) : null}
      </div>
    </section>
  );
}