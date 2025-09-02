import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import { api } from '../api/client';
import './CatalogPage.css';

// Категории — структурированные (slug/id, name, parent)
// Категорії — структуровані (slug/id, name, parent)
// v2 (уніфікована ієрархія на базі двох списків + практики MakerWorld/Creality)
// Принципи: 1) послідовні слаги (latin-kebab), 2) максимум 2 рівні, 3) тільки те, що доречно для магазину готових друків.
// Примітка: позначив кілька гілок як optional — вмикайте лише якщо реально продаєте ці товари.

const structuredCategories = [
  // Meta
  { id: 'all', name: 'Усі категорії', parent: null },
  { id: 'novelties', name: 'Новинки та хіти', parent: null },
  { id: 'custom-print', name: 'Друк на замовлення', parent: null },

  // Дім та інтерʼєр
  { id: 'home', name: 'Будинок та інтерʼєр', parent: null },
  { id: 'decor', name: 'Декор', parent: 'home' },
  { id: 'lighting', name: 'Освітлення', parent: 'home' },
  { id: 'kitchen', name: 'Кухня', parent: 'home' },
  { id: 'storage', name: 'Зберігання та організація', parent: 'home' },
  { id: 'office', name: 'Офіс та робоче місце', parent: 'home' },
  { id: 'garden', name: 'Сад і двір', parent: 'home' },
  { id: 'appliance-accessories', name: 'Аксесуари для побутової техніки', parent: 'home' }, // туди як теги: fridge, washer, coffee

  // Іграшки та ігри
  { id: 'toys', name: 'Іграшки та настільні ігри', parent: null },
  { id: 'board-games', name: 'Настільні ігри', parent: 'toys' },
  { id: 'puzzles', name: 'Пазли', parent: 'toys' },
  { id: 'construction-sets', name: 'Конструктори', parent: 'toys' },
  { id: 'characters', name: 'Персонажі', parent: 'toys' },
  { id: 'outdoor-toys', name: 'Вуличні іграшки', parent: 'toys' },

  // Мініатюри (окремий топ-рівень)
  { id: 'miniatures', name: 'Мініатюри та колекційні моделі', parent: null },
  { id: 'min-animals', name: 'Тварини', parent: 'miniatures' },
  { id: 'min-architecture', name: 'Архітектура та діорами', parent: 'miniatures' },
  { id: 'min-creatures', name: 'Істоти та фантастика', parent: 'miniatures' },
  { id: 'min-people', name: 'Люди та фігурки', parent: 'miniatures' },
  { id: 'min-wargame', name: 'Варґеймінг: терен і аксесуари', parent: 'miniatures' },
  { id: 'min-vehicles', name: 'Техніка та машинерія', parent: 'miniatures' },

  // Пропси та косплей
  { id: 'props-cosplay', name: 'Пропси та косплей', parent: null },
  { id: 'cos-costumes', name: 'Костюми та елементи', parent: 'props-cosplay' },
  { id: 'cos-masks', name: 'Маски та шоломи', parent: 'props-cosplay' },
  { id: 'cos-weapons', name: 'Реквізит та зброя для косплею', parent: 'props-cosplay' },
  { id: 'cos-badges', name: 'Значки, логотипи та емблеми', parent: 'props-cosplay' },

  // Одяг і мерч
  { id: 'wearables', name: 'Одяг, прикраси та мерч', parent: null },
  { id: 'bags', name: 'Сумки та чохли', parent: 'wearables' },
  { id: 'clothes', name: 'Одяг', parent: 'wearables' },
  { id: 'footwear', name: 'Взуття', parent: 'wearables' },
  { id: 'jewelry', name: 'Прикраси', parent: 'wearables' },
  { id: 'glasses', name: 'Окуляри', parent: 'wearables' },
  { id: 'keychains', name: 'Брелоки та дрібний мерч', parent: 'wearables' }, // Кільця як підтип jewelry

  // Електроніка та гаджети
  { id: 'electronics', name: 'Електроніка та гаджети', parent: null },
  { id: 'device-cases', name: 'Корпуси та чохли', parent: 'electronics' },
  { id: 'holders', name: 'Тримачі та підставки', parent: 'electronics' },
  { id: 'cable-management', name: 'Кабель-менеджмент', parent: 'electronics' },
  { id: 'accessories-gadgets', name: 'Аксесуари для гаджетів', parent: 'electronics' }, // RC/роботи → як теги (rc, robotics)

  // Інструменти та майстерня
  { id: 'tools', name: 'Інструменти, оснащення та майстерня', parent: null },
  { id: 'fixtures', name: 'Пристосування/фікстури', parent: 'tools' },
  { id: 'hand-tools', name: 'Ручний інструмент', parent: 'tools' },
  { id: 'measuring-tools', name: 'Вимірювальний інструмент', parent: 'tools' },
  { id: 'organizers', name: 'Органайзери для інструментів', parent: 'tools' },

  // Частини та кріплення
  { id: 'parts-fasteners', name: 'Запчастини та кріплення', parent: null },
  { id: 'brackets', name: 'Кронштейни та кріплення', parent: 'parts-fasteners' },
  { id: 'replacement-parts', name: 'Запчастини та ремонт', parent: 'parts-fasteners' }, // без printer-parts

  // Транспорт
  { id: 'auto-moto', name: 'Авто та мото', parent: null },
  { id: 'car-interior', name: 'Інтерʼєр та органайзери', parent: 'auto-moto' },
  { id: 'car-exterior', name: 'Екстерʼєр та тюнінг', parent: 'auto-moto' },
  { id: 'mounts-car', name: 'Кріплення та тримачі', parent: 'auto-moto' },

  // Спорт і аутдор
  { id: 'sport-outdoor', name: 'Спорт, туризм та відпочинок', parent: null },
  { id: 'camping', name: 'Кемпінг та туризм', parent: 'sport-outdoor' },
  { id: 'sport-gear', name: 'Спортивне спорядження', parent: 'sport-outdoor' },
  { id: 'cycling', name: 'Велоспорядження', parent: 'sport-outdoor' },

  // Освіта
  { id: 'education', name: 'Освіта, наука та STEM', parent: null },
  { id: 'edu-stationery', name: 'Канцелярія та навчальні інструменти', parent: 'education' },
  { id: 'edu-biology', name: 'Біологія', parent: 'education' },
  { id: 'edu-chemistry', name: 'Хімія', parent: 'education' },
  { id: 'edu-engineering', name: 'Інженерія', parent: 'education' },
  { id: 'edu-geography', name: 'Географія', parent: 'education' },
  { id: 'edu-math', name: 'Математика', parent: 'education' },
  { id: 'edu-physics', name: 'Фізика та астрономія', parent: 'education' },

  // Домашні тварини
  { id: 'pets', name: 'Товари для тварин', parent: null },
  { id: 'pet-toys', name: 'Іграшки та аксесуари', parent: 'pets' },
  { id: 'pet-housing', name: 'Будиночки та утримання', parent: 'pets' },

  // Медицина та реабілітація
  { id: 'medical', name: 'Медицина та реабілітація', parent: null },
  { id: 'med-equipment', name: 'Обладнання та допоміжні засоби', parent: 'medical' },
  { id: 'personal-care', name: 'Пристрої для догляду', parent: 'medical' }, // сюди йдуть pill-boxes, massage-tools
  { id: 'medical-tools', name: 'Медичні інструменти', parent: 'medical' },

  // Свята та подарунки
  { id: 'gifts', name: 'Свята, подарунки та сувеніри', parent: null },
  { id: 'holiday-xmas', name: 'Новорічні та різдвяні', parent: 'gifts' },
  { id: 'holiday-halloween', name: 'Хелловін', parent: 'gifts' },
  { id: 'holiday-wedding', name: 'Весілля', parent: 'gifts' },
  { id: 'holiday-birthday', name: 'День народження', parent: 'gifts' },

  // Матеріали (optional — якщо продаєте)
  { id: 'materials', name: 'Матеріали та витратні', parent: null },
  { id: 'filaments', name: 'Філаменти', parent: 'materials' },
  { id: 'resins', name: 'Смоли', parent: 'materials' },
  { id: 'build-plates', name: 'Поверхні/підкладки', parent: 'materials' },
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

    // гарантируем корректные поля
    const image =
      product.image_url
      ?? product.image
      ?? product.media?.find(m => m.media_type === 'image')?.url
      ?? 'https://placehold.co/300x300';

    const priceRaw = typeof product.price === 'number'
      ? product.price
      : Number(product.price ?? product.base_price ?? 0);

    const price = Number.isFinite(priceRaw) ? priceRaw : 0;

    return (
      <ProductCard
        image={image}
        title={highlightedName}
        price={price}
        // oldPrice={...} // если появится
        onAddToCart={() => {}}
      />
    );
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
