// Карточка товара: блок статуса доступности (Vitest + React Testing Library).
//
// Пропсы считаем теми же хелперами, что и страницы (HomePage/CatalogPage), —
// тест закрепляет цепочку целиком: made-to-order даёт пустой label, а карточка
// при пустом label не рендерит ряд статуса вовсе (ни пустых span, ни отступов).
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../auth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../../api/client', () => ({
  api: {},
}));

import ProductCard from './ProductCard.jsx';
import {
  normalizeAvailabilityState,
  getAvailabilityLabel,
  getAvailabilityTiming,
} from '../../utils/availability';

function renderCard(availabilityRaw, extraProps = {}) {
  const state = normalizeAvailabilityState(availabilityRaw);
  return render(
    <MemoryRouter>
      <ProductCard
        productId="p-1"
        title="Ваза"
        titleText="Ваза"
        price={500}
        availabilityState={state}
        availabilityLabel={getAvailabilityLabel(state)}
        availabilityTiming={getAvailabilityTiming(state)}
        {...extraProps}
      />
    </MemoryRouter>,
  );
}

describe('ряд статуса в карточке', () => {
  test('made_to_order: ряда нет совсем, текстов индивидуального заказа нет', () => {
    const { container } = renderCard('made_to_order');

    expect(container.querySelector('.product-availability-row')).toBeNull();
    expect(screen.queryByText(/Індивідуальне замовлення/i)).toBeNull();
    expect(screen.queryByText(/Терміни погоджуємо індивідуально/i)).toBeNull();
  });

  test('in_stock: статус и сроки показываются как раньше', () => {
    const { container } = renderCard('in_stock');

    expect(container.querySelector('.product-availability-row')).not.toBeNull();
    expect(screen.getByText('Готово до відправки')).toBeInTheDocument();
    expect(screen.getByText(/Підготовка до відправки/)).toBeInTheDocument();
  });

  test('unavailable: «Тимчасово недоступно» показывается как раньше', () => {
    renderCard('unavailable');
    expect(screen.getByText('Тимчасово недоступно')).toBeInTheDocument();
  });
});
