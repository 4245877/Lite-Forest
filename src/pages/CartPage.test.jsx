// Корзина: статус доступности у позиции (Vitest + React Testing Library).
//
// made-to-order — статус всего ассортимента, поэтому в корзине его не пишем
// (об индивидуальном изготовлении говорим на оформлении). Информативные
// статусы («Готово до відправки») остаются.
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// vi.mock поднимается наверх файла, поэтому значения — через vi.hoisted,
// стабильные между рендерами (см. тот же приём в CheckoutPage.test.jsx).
const { cartValue } = vi.hoisted(() => {
  const items = [
    {
      id: 'line-1',
      product_id: 'prod-1',
      name: 'Ваза індивідуальна',
      image: '/img/vase.jpg',
      price: 500,
      qty: 1,
      models: [],
      selected_model_keys: [],
      attributes: { availability: 'made_to_order' },
    },
    {
      id: 'line-2',
      product_id: 'prod-2',
      name: 'Підставка зі складу',
      image: '/img/stand.jpg',
      price: 200,
      qty: 1,
      models: [],
      selected_model_keys: [],
      attributes: { availability: 'in_stock' },
    },
  ];

  return {
    cartValue: {
      items,
      inc: vi.fn(),
      dec: vi.fn(),
      remove: vi.fn(),
      setItemSelection: vi.fn(),
      subtotal: 700,
    },
  };
});

vi.mock('../contexts/CartContext.jsx', () => ({
  useCart: () => cartValue,
}));

vi.mock('../auth/index.jsx', () => ({
  useAuth: () => ({ user: null }),
}));

const { MemoryRouter } = await import('react-router-dom');
const CartPage = (await import('./CartPage.jsx')).default;

describe('статус доступности в строке корзины', () => {
  test('made_to_order — без статуса, in_stock — со статусом', () => {
    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    );

    // Обе позиции на экране.
    expect(screen.getByText('Ваза індивідуальна')).toBeInTheDocument();
    expect(screen.getByText('Підставка зі складу')).toBeInTheDocument();

    // Текстов индивидуального заказа нет ни у одной позиции.
    expect(screen.queryByText(/Індивідуальне замовлення/i)).toBeNull();
    expect(screen.queryByText(/Терміни погоджуємо індивідуально/i)).toBeNull();

    // Информативный статус складской позиции остался.
    expect(screen.getByText('Готово до відправки')).toBeInTheDocument();
  });
});
