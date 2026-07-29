import React from 'react';
import './Button.css'; // Подключаем стили для нашей кнопки

/**
 * Универсальный компонент кнопки.
 *
 * @param {object} props - Свойства компонента.
 * @param {React.Node} props.children - Содержимое кнопки (текст или иконки).
 * @param {function} props.onClick - Функция, вызываемая при клике.
 * @param {'primary' | 'secondary'} [props.variant='primary'] - Вариант стиля кнопки.
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Размер кнопки.
 * @param {string} [props.className=''] - Дополнительные CSS-классы.
 * @param {boolean} [props.disabled=false] - Флаг, делающий кнопку неактивной.
 * @returns {React.ReactElement}
 */
const Button = ({
  children,
  onClick,
  variant = 'primary', // Стиль по умолчанию
  size = 'md',         // Размер по умолчанию
  className = '',
  ...props // Все остальные свойства (например, type, disabled)
}) => {
  // Собираем все классы в одну строку:
  // 1. 'btn' - базовый класс для всех кнопок.
  // 2. `btn-${variant}` - класс для стилевого варианта (например, 'btn-primary').
  // 3. `btn-${size}` - класс для размера (например, 'btn-md').
  // 4. `className` - любые дополнительные классы, переданные извне.
  const buttonClasses = `btn btn-${variant} btn-${size} ${className}`;

  return (
    <button className={buttonClasses} onClick={onClick} {...props}>
      {children}
    </button>
  );
};

export default Button;