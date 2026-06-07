import React from 'react';
import './Input.css'; // Подключаем стили для нашего поля ввода

/**
 * Универсальный компонент поля ввода.
 *
 * @param {object} props - Свойства компонента.
 * @param {string} [props.label] - Текст для метки <label> над полем ввода.
 * @param {string} [props.type='text'] - Тип поля ввода (например, 'text', 'number', 'password').
 * @param {string} [props.className=''] - Дополнительные CSS-классы для контейнера.
 * @param {any} props.value - Текущее значение поля.
 * @param {function} props.onChange - Функция, вызываемая при изменении значения.
 * @returns {React.ReactElement}
 */
const Input = ({ label, type = 'text', className = '', ...props }) => {
  // Генерируем уникальный ID для связи <label> и <input>
  // Это важно для доступности (accessibility)
  const inputId = React.useId();

  // Собираем классы для внешнего контейнера
  const wrapperClasses = `input-wrapper ${className}`;

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className="input-field"
        {...props} // Передаем все остальные свойства (value, onChange, placeholder, и т.д.)
      />
    </div>
  );
};

export default Input;