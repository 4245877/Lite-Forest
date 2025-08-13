import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import './CatalogPage.css';

// Категории — структурированные (slug/id, name, parent)
const structuredCategories = [
  { id: 'all', name: 'Все категории', parent: null },
  { id: 'novelties', name: 'Новинки и хиты', parent: null },
  { id: 'custom-print', name: 'Печать на заказ', parent: null },

  { id: 'dom-i-interer', name: 'Дом и интерьер', parent: null },
  { id: 'decor', name: 'Декор', parent: 'dom-i-interer' },
  { id: 'lighting', name: 'Освещение', parent: 'dom-i-interer' },
  { id: 'kitchen', name: 'Кухня', parent: 'dom-i-interer' },
  { id: 'storage', name: 'Хранение и организация', parent: 'dom-i-interer' },

  { id: 'toys-gaming', name: 'Игрушки и настольные игры', parent: null },
  { id: 'miniatures', name: 'Миниатюры и коллекционные модели', parent: 'toys-gaming' },

  { id: 'electronics', name: 'Электроника и гаджеты', parent: null },
  { id: 'gadgets-accessories', name: 'Аксессуары для гаджетов', parent: 'electronics' },

  { id: 'wearables-merch', name: 'Одежда, украшения и мерч', parent: null },
  { id: 'hobby-diy', name: 'Хобби, модели и DIY', parent: null },
  { id: 'auto-moto', name: 'Авто и мото', parent: null },
  { id: 'sport-outdoor', name: 'Спорт, туризм и отдых', parent: null },
  { id: 'tools-workshop', name: 'Инструменты, оснастка и мастерская', parent: null },
  { id: 'parts-fasteners', name: 'Запчасти и крепёж', parent: null },
  { id: 'pets', name: 'Товары для животных', parent: null },
  { id: 'medical', name: 'Медицина и реабилитация', parent: null },
  { id: 'gifts', name: 'Праздники, подарки и сувениры', parent: null },
  { id: 'materials', name: 'Материалы и расходные (filament и пр.)', parent: null },
  { id: 'education-stem', name: 'Образование, наука и STEM', parent: null },
];

const buildCategoryTree = (cats) => {
  const map = {};
  cats.forEach(c => { map[c.id] = { ...c, children: [] }; });
  const tree = [];
  Object.values(map).forEach(item => {
    if (item.parent && map[item.parent]) map[item.parent].children.push(item);
    else tree.push(item);
  });
  tree.sort((a, b) => {
    if (a.id === 'all') return -1;
    if (b.id === 'all') return 1;
    if (a.id === 'novelties') return -1;
    if (b.id === 'novelties') return 1;
    return a.name.localeCompare(b.name, 'ru');
  });
  return tree;
};

const normalizeProducts = (data) => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  // если пришёл объект с ключом results / products
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

const CatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [material, setMaterial] = useState('');
  const [printTech, setPrintTech] = useState('');

  const [sortBy, setSortBy] = useState('popular');
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceTimer = useRef(null);

  const categoryTree = useMemo(() => buildCategoryTree(structuredCategories), []);

  // fetch с AbortController
  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategories.length > 0) params.append('categories', selectedCategories.join(','));
      if (minPrice !== '') params.append('minPrice', Number(minPrice));
      if (maxPrice !== '') params.append('maxPrice', Number(maxPrice));
      if (material) params.append('material', material);
      if (printTech) params.append('printTech', printTech);
      if (sortBy) params.append('sortBy', sortBy);

      try {
        const response = await fetch(`/api/products?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Сервер вернул ${response.status}`);
        const data = await response.json();
        setProducts(normalizeProducts(data));
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Ошибка загрузки');
        console.error('Ошибка при получении товаров:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();

    return () => controller.abort();
  }, [searchQuery, selectedCategories, minPrice, maxPrice, material, printTech, sortBy]);

  // debounce для поиска
  const handleSearch = useCallback((value) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(value.trim());
      debounceTimer.current = null;
    }, 450);
  }, []);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  // handlers
  const handleCategoryChange = (categoryId) => {
    if (categoryId === 'all') {
      setSelectedCategories(prev => (prev.includes('all') ? [] : ['all']));
      return;
    }
    setSelectedCategories(prev => {
      const cleaned = prev.filter(p => p !== 'all');
      return cleaned.includes(categoryId) ? cleaned.filter(c => c !== categoryId) : [...cleaned, categoryId];
    });
  };

  const handleMinPriceChange = (e) => setMinPrice(e.target.value);
  const handleMaxPriceChange = (e) => setMaxPrice(e.target.value);
  const handleMaterialChange = (e) => setMaterial(e.target.value);
  const handlePrintTechChange = (e) => setPrintTech(e.target.value);
  const handleSortChange = (e) => setSortBy(e.target.value);
  const toggleFiltersVisibility = () => setIsFiltersVisible(v => !v);

  // wrapper для подсветки
  const ProductCardWithHighlight = React.memo(function ProductCardWithHighlight({ product, query }) {
    const highlightedName = useMemo(() => highlightMatch(product.name, query), [product.name, query]);
    const productForCard = useMemo(() => ({
      ...product,
      name: highlightedName,
      price: product.base_price ?? product.price ?? 0,
      image: product.media?.find(m => m.media_type === 'image')?.url || 'https://placehold.co/300x300'
    }), [product, highlightedName]);

    return <ProductCard product={productForCard} />;
  });

  const renderContent = () => {
    if (isLoading) return <p>Загрузка товаров...</p>;
    if (error) return <p className="error">Ошибка: {error}</p>;
    if (products.length > 0) {
      return products.map(p => (
        <div role="listitem" key={p.id ?? p._id ?? JSON.stringify(p)}>
          <ProductCardWithHighlight product={p} query={searchQuery} />
        </div>
      ));
    }
    return <p>По вашему запросу ничего не найдено.</p>;
  };

  useEffect(() => { document.title = 'Каталог товаров - DRUKARNYA'; }, []);

  return (
    <div className="catalog-page">
      {isFiltersVisible && <div className="filters-overlay" onClick={toggleFiltersVisibility} aria-hidden="true" />}

      <header className="catalog-header">
        <h1>Каталог</h1>
        <button className="mobile-filters-toggle" onClick={toggleFiltersVisibility} aria-expanded={isFiltersVisible}>Фильтры</button>
      </header>

      <SearchBar onSearch={handleSearch} allProducts={products} />

      <div className="catalog-content">
        <aside className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`} aria-label="Фильтры каталога">
          <div className="filter-group">
            <h3>Категории</h3>
            <div className="category-list">
              {categoryTree.map(cat => (
                <div key={cat.id} className="category-block">
                  <label className="category-item">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => handleCategoryChange(cat.id)}
                      aria-checked={selectedCategories.includes(cat.id)}
                    />
                    <span>{cat.name}</span>
                  </label>

                  {cat.children?.length > 0 && (
                    <div className="category-children">
                      {cat.children.map(child => (
                        <label key={child.id} className="category-item child">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(child.id)}
                            onChange={() => handleCategoryChange(child.id)}
                          />
                          <span>{child.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h3>Цена, ₴</h3>
            <div className="price-filter">
              <input type="number" placeholder="от" value={minPrice} onChange={handleMinPriceChange} className="price-input" />
              <span className="price-separator">–</span>
              <input type="number" placeholder="до" value={maxPrice} onChange={handleMaxPriceChange} className="price-input" />
            </div>
          </div>

          <div className="filter-group">
            <h3>Материал</h3>
            <select value={material} onChange={handleMaterialChange} aria-label="Фильтр по материалу">
              <option value="">— любой —</option>
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="Resin">Resin</option>
              <option value="Nylon">Nylon</option>
            </select>
          </div>

          <div className="filter-group">
            <h3>Технология печати</h3>
            <select value={printTech} onChange={handlePrintTechChange} aria-label="Фильтр по технологии печати">
              <option value="">— любая —</option>
              <option value="FDM">FDM</option>
              <option value="SLA">SLA</option>
              <option value="SLS">SLS</option>
              <option value="MJF">MJF</option>
            </select>
          </div>

          <div className="filter-actions">
            <button onClick={() => {
              setSelectedCategories([]);
              setMinPrice('');
              setMaxPrice('');
              setMaterial('');
              setPrintTech('');
              setSearchInput('');
              setSearchQuery('');
            }}>Сбросить фильтры</button>
          </div>
        </aside>

        <main className="product-grid">
          <div className="products-header">
            <span className="products-count">Найдено товаров: {products.length}</span>
            <select className="sort-by" value={sortBy} onChange={handleSortChange} aria-label="Сортировка">
              <option value="popular">Сначала популярные</option>
              <option value="new">Сначала новые</option>
              <option value="price_asc">Сначала дешёвые</option>
              <option value="price_desc">Сначала дорогие</option>
            </select>
          </div>

          <div className="products-grid" role="list">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CatalogPage;
