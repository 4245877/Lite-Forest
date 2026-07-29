import React, { useEffect, useState } from 'react';
import { Box } from 'lucide-react';
import { assetUrl } from '../../../../utils/assetUrl';
import styles from './CustomPrintModelThumb.module.css';

// Превью 3D-модели з fallback. preview_url рендерить воркер слайсингу; поки його
// немає (модель ще ріжеться / формат не підтримується рендером) або картинка не
// завантажилась — показуємо нейтральну іконку, а не «биту» картинку. Той самий
// підхід, що й у модалці «Що ви отримаєте» (ProductFilesModal).
export default function CustomPrintModelThumb({
  previewUrl = '',
  filename = '',
  size = 'md',
  className = '',
}) {
  const src = previewUrl ? assetUrl(previewUrl) : '';
  const [failed, setFailed] = useState(false);

  // Скидаємо помилку, якщо змінився URL (модель дорізалась і превʼю зʼявилось).
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;
  const sizeClass = styles[size] || styles.md;

  return (
    <div className={[styles.thumb, sizeClass, className].filter(Boolean).join(' ')}>
      {showImage ? (
        <img
          src={src}
          alt={filename ? `Превʼю моделі ${filename}` : 'Превʼю 3D-моделі'}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.placeholder} aria-hidden="true">
          <Box strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
