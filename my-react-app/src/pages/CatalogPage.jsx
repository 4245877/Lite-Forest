import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import { api } from '../api/client';
import './CatalogPage.css';

// Категории — структурированные (slug/id, name, parent)
const structuredCategories = [
  { id: 'all', name: 'Усі категорії', parent: null },
  { id: 'novelties', name: 'Новинки та хіти', parent: null },
  { id: 'custom-print', name: 'Печать на заказ', parent: null },

  { id: 'dom-i-interer', name: "Будинок та інтерʼєр", parent: null },
  { id: 'decor', name: 'Декор', parent: 'dom-i-interer' },
  { id: 'lighting', name: 'Освітлення', parent: 'dom-i-interer' },
  { id: 'kitchen', name: 'Кухня', parent: 'dom-i-interer' },
  { id: 'storage', name: 'Зберігання та організація', parent: 'dom-i-interer' },

  { id: 'toys-gaming', name: 'Іграшки та настільні ігри', parent: null },
  { id: 'miniatures', name: 'Мініатюри та колекційні моделі', parent: 'toys-gaming' },

  { id: 'electronics', name: 'Електроніка та гаджети', parent: null },
  { id: 'gadgets-accessories', name: 'Аксесуари для гаджетів', parent: 'electronics' },

  { id: 'wearables-merch', name: 'Одяг, прикраси та мерч', parent: null },
  { id: 'hobby-diy', name: 'Хобі, моделі та DIY', parent: null },
  { id: 'auto-moto', name: 'Авто та мото', parent: null },
  { id: 'sport-outdoor', name: 'Спорт, туризм та відпочинок', parent: null },
  { id: 'tools-workshop', name: 'Інструменти, оснащення та майстерня', parent: null },
  { id: 'parts-fasteners', name: 'Запчастини та кріплення', parent: null },
  { id: 'pets', name: 'Товари для тварин', parent: null },
  { id: 'medical', name: 'Медицина та реабілітація', parent: null },
  { id: 'gifts', name: 'Свята, подарунки та сувеніри', parent: null },
  { id: 'materials', name: 'Матеріали та видаткові (filament та ін.)', parent: null },
  { id: 'education-stem', name: 'Освіта, наука та STEM', parent: null },
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
    return a.name.localeCompare(b.name, 'uk');
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

  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.listProducts(searchQuery, 50);
        setProducts(normalizeProducts(data)); // заберёт data.items
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
  }, [searchQuery]);

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
      price: product.price ?? product.base_price ?? 0,
      image: product.image_url
          ?? product.media?.find(m => m.media_type === 'image')?.url
          ?? 'https://placehold.co/300x300'
    }), [product, highlightedName]);

    return <ProductCard product={productForCard} />;
  });

  const renderContent = () => {
    if (isLoading) return <p>Завантаження товарів...</p>;
    if (error) return <p className="error">Помилка: {error}</p>;
    if (products.length > 0) {
      return products.map(p => (
        <div role="listitem" key={p.id ?? p._id ?? JSON.stringify(p)}>
          <ProductCardWithHighlight product={p} query={searchQuery} />
        </div>
      ));
    }
    return <p>По вашему запросу ничего не найдено.</p>;
  };

  useEffect(() => { document.title = 'Каталог товарів - Lite Forest'; }, []);

  return (
    <div className="catalog-page">
      {isFiltersVisible && <div className="filters-overlay" onClick={toggleFiltersVisibility} aria-hidden="true" />}

      <header className="catalog-header">
        <h1>Каталог</h1>
        <button className="mobile-filters-toggle" onClick={toggleFiltersVisibility} aria-expanded={isFiltersVisible}>Фільтри</button>
      </header>

      <SearchBar onSearch={handleSearch} allProducts={products} />

      <div className="catalog-content">
        <aside className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`} aria-label="Фільтри каталогу">
          <div className="filter-group">
            <h3>Категорії</h3>
            <div className="category-list">
              {categoryTree.map(cat => (
                <div key={cat.id} className="category-block">
                  <label className="category-item">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => handleCategoryChange(cat.id)}
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
            <h3>Ціна, ₴</h3>
            <div className="price-filter">
              <div className="price-inputs">
                <input type="number" placeholder="від" value={minPrice} onChange={handleMinPriceChange} className="price-input" />
                <span className="price-separator">–</span>
                <input type="number" placeholder="до" value={maxPrice} onChange={handleMaxPriceChange} className="price-input" />
              </div>
            </div>
          </div>

          <div className="filter-group">
            <h3>Матеріал</h3>
            <select value={material} onChange={handleMaterialChange} aria-label="Фільтр по матеріалу">
              <option value="">— будь-який —</option>
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="Resin">Resin</option>
              <option value="Nylon">Nylon</option>
            </select>
          </div>

          <div className="filter-group">
            <h3>Технологія друку</h3>
            <select value={printTech} onChange={handlePrintTechChange} aria-label="Фільтр по технології друку">
              <option value="">— будь-яка —</option>
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
            }}>Скинути фільтри</button>
          </div>
        </aside>

        <main className="product-grid">
          <div className="products-header">
            <span className="products-count">Знайдено товарів: {products.length}</span>
            <select className="sort-by" value={sortBy} onChange={handleSortChange} aria-label="Сортировка">
              <option value="popular">Спочатку популярні</option>
              <option value="new">Спочатку нові</option>
              <option value="price_asc">Спершу дешеві</option>
              <option value="price_desc">Спочатку дорогі</option>
            </select>
          </div>

        <div className="products-list-grid" role="list">
          {isLoading || error || products.length === 0
            ? renderContent()
            : products.map((p, idx) => (
                <div role="listitem" key={p.id ?? p._id ?? p.sku ?? p.slug ?? idx}>
                  <ProductCardWithHighlight product={p} query={searchQuery} />
                  </div>
                ))
          }
        </div>

        </main>
      </div>
    </div>
  );
};

export default CatalogPage;
