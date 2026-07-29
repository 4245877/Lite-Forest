// Общая настройка для тестов фронта (Vitest + React Testing Library).
//
// jest-dom добавляет матчеры вида toBeInTheDocument/toBeDisabled — без них
// проверка «кнопка задизейблена» пишется через сырой DOM и читается хуже.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom не реализует scrollIntoView (это layout, а его в jsdom нет вовсе) — и
// падает не тест, а сам компонент: чат прокручивает список к последнему
// сообщению. Заглушка, а не правка компонента: в браузере метод есть, прятать
// его за проверкой ради тестов незачем.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// jsdom один на файл, а localStorage переживает тесты: чат «Питання майстру»
// хранит там треды, и не почищенное хранилище протекало бы между кейсами — ровно
// тот баг, который эти тесты и проверяют.
afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    // хранилище недоступно — чистить нечего
  }
});
