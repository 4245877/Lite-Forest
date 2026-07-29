// Тесты страницы товара вокруг расширенного контента (Vitest + Testing Library).
// Запуск: pnpm test
//
// Проверяется ровно то, что нельзя проверить на самом рендерере:
//
//   • при ВЫКЛЮЧЕННОМ флаге страница ведёт себя точно как до появления фичи;
//   • при включённом — контент показан, а products.description остаётся на месте
//     как краткое описание;
//   • картинки контента НЕ попадают в галерею товара ни при каком флаге.
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { getProduct, getCategories, getFavorites, getFilamentAvailability } = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getCategories: vi.fn(),
  getFavorites: vi.fn(),
  getFilamentAvailability: vi.fn(),
}));

vi.mock('../api/client', () => ({
  api: {
    getProduct: (...args) => getProduct(...args),
    getCategories: (...args) => getCategories(...args),
    getFavorites: (...args) => getFavorites(...args),
    getFilamentAvailability: (...args) => getFilamentAvailability(...args),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    reportProduct: vi.fn(),
  },
}));

// Провайдеры мокаем, а не поднимаем: настоящий AuthProvider на монтировании
// ходит в /api/me, а проверяем мы не его.
vi.mock('../auth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('../contexts/CartContext.jsx', () => ({
  useCart: () => ({ addItem: vi.fn(), items: [], orderItems: [], totalQty: 0 }),
}));

const ASSET_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_BLOCK_ID = '22222222-2222-4222-8222-222222222222';

/** Товар с галереей из ДВУХ картинок и отдельной картинкой внутри контента. */
const PRODUCT = {
  id: 'prod-1',
  sku: 'SKU-1',
  name: 'Ваза',
  description: 'Краткое описание вазы',
  price: 500,
  images: [
    { url: '/uploads/products/SKU-1/images/main.jpg', role: 'primary' },
    { url: '/uploads/products/SKU-1/images/second.jpg' },
  ],
  content: {
    schema_version: 1,
    locale: 'uk',
    document: {
      blocks: [
        { id: 'h-1', type: 'heading', level: 2, text: 'Як доглядати' },
        { id: 'p-1', type: 'paragraph', text: 'Мийте теплою водою.' },
        { id: CONTENT_BLOCK_ID, type: 'image', asset_id: ASSET_ID, alt: 'Ваза в інтер’єрі' },
      ],
    },
    assets: {
      [CONTENT_BLOCK_ID]: {
        asset_id: ASSET_ID,
        url: '/uploads/content/interior.png',
        mime_type: 'image/png',
        width: 900,
        height: 600,
        alt: 'Ваза в інтер’єрі',
        caption: 'Фото покупця',
      },
    },
  },
};

const ProductDetailPage = (await import('./ProductDetailPage.jsx')).default;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/product/prod-1']}>
      <Routes>
        <Route path="/product/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Все адреса картинок, которые страница действительно нарисовала. */
const renderedImageSources = (container) =>
  [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') || '');

beforeEach(() => {
  vi.unstubAllEnvs();
  getProduct.mockResolvedValue(structuredClone(PRODUCT));
  getCategories.mockResolvedValue([]);
  getFavorites.mockResolvedValue({ items: [] });
  getFilamentAvailability.mockResolvedValue({ items: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('флаг выключен (умолчание)', () => {
  test('страница показывает описание и не рисует контент вовсе', async () => {
    const { container } = renderPage();

    expect(await screen.findByText('Краткое описание вазы')).toBeInTheDocument();

    // Ни обёртки контента, ни единого его блока: при выключенном флаге витрина
    // документ даже не разбирает.
    expect(screen.queryByTestId('product-content')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Як доглядати' })).toBeNull();
    expect(screen.queryByText('Мийте теплою водою.')).toBeNull();

    // Картинка контента не нарисована нигде на странице.
    expect(renderedImageSources(container).some((src) => src.includes('/uploads/content/'))).toBe(false);
  });
});

describe('флаг включён', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PRODUCT_CONTENT_V1', '1');
  });

  test('контент показан, а description остаётся кратким описанием', async () => {
    renderPage();

    const content = await screen.findByTestId('product-content');

    expect(within(content).getByRole('heading', { level: 2, name: 'Як доглядати' })).toBeInTheDocument();
    expect(within(content).getByText('Мийте теплою водою.')).toBeInTheDocument();

    // description никуда не делся: расширенный контент его дополняет, а не
    // заменяет — и остаётся запасным вариантом, когда контента нет.
    const description = screen.getByText('Краткое описание вазы');
    expect(description).toBeInTheDocument();
    expect(content.contains(description)).toBe(false);
  });

  test('картинка контента не попадает в галерею товара', async () => {
    const { container } = renderPage();

    const content = await screen.findByTestId('product-content');
    const contentImage = within(content).getByRole('img', { name: 'Ваза в інтер’єрі' });
    expect(contentImage.getAttribute('src')).toContain('/uploads/content/interior.png');

    // Галерея собирается из product.images, контент — из product.content:
    // на сервере это разные таблицы (product_assets и product_content_assets),
    // и смешаться они не могут. Проверяем именно это: единственная картинка из
    // /uploads/content/ на странице — та, что внутри контента.
    const contentSources = renderedImageSources(container).filter((src) =>
      src.includes('/uploads/content/'),
    );
    expect(contentSources).toHaveLength(1);

    const galleryThumbs = container.querySelectorAll('.pd-thumbs img');
    // Галерея должна быть непустой, иначе проверка ниже ничего не значит.
    expect(galleryThumbs.length).toBe(PRODUCT.images.length);
    for (const thumb of galleryThumbs) {
      expect(thumb.getAttribute('src')).not.toContain('/uploads/content/');
    }
  });

  test('битый контент не мешает странице: остаётся описание', async () => {
    getProduct.mockResolvedValue({
      ...structuredClone(PRODUCT),
      content: { schema_version: 1, document: { blocks: [{ id: 'x', type: 'unknown' }] }, assets: {} },
    });

    renderPage();

    expect(await screen.findByText('Краткое описание вазы')).toBeInTheDocument();
    expect(screen.queryByTestId('product-content')).toBeNull();
  });

  test('товар без контента показывает страницу как раньше', async () => {
    const { content: _dropped, ...withoutContent } = structuredClone(PRODUCT);
    getProduct.mockResolvedValue(withoutContent);

    renderPage();

    expect(await screen.findByText('Краткое описание вазы')).toBeInTheDocument();
    expect(screen.queryByTestId('product-content')).toBeNull();
  });
});

describe('переключение параметром адреса', () => {
  // MemoryRouter держит свою историю и window.location не трогает, а флаг читает
  // именно её — поэтому строку запроса ставим на уровне окна, ровно как браузер.
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  test('?product_content=1 включает контент без пересборки фронта', async () => {
    window.history.replaceState({}, '', '/product/prod-1?product_content=1');

    renderPage();

    expect(await screen.findByTestId('product-content')).toBeInTheDocument();
  });

  test('?product_content=0 выключает контент, даже когда сборочный флаг включён', async () => {
    vi.stubEnv('VITE_PRODUCT_CONTENT_V1', '1');
    window.history.replaceState({}, '', '/product/prod-1?product_content=0');

    renderPage();

    expect(await screen.findByText('Краткое описание вазы')).toBeInTheDocument();
    expect(screen.queryByTestId('product-content')).toBeNull();
  });
});
