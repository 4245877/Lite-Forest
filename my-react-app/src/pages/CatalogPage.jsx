import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import { api } from '../api/client';
import './CatalogPage.css';

/**
 * ✅ Mobile-first improvements in this version:
 * - Sticky drawer header & footer on mobile (Apply / Reset)
 * - Visible custom checkboxes, larger touch targets
 * - Collapsible category groups with caret
 * - Category search inside the drawer
 * - Active filter chips with one-tap removal
 * - Quick price presets (<=500, 500–1500, 1500–3000)
 * - Filter toggle shows a badge with active counter
 * - Body-scroll lock while drawer is open
 */

// --- Categories -----------------------------------------------------------------
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
  { id: 'appliance-accessories', name: 'Аксесуари для побутової техніки', parent: 'home' },

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
  { id: 'keychains', name: 'Брелоки та дрібний мерч', parent: 'wearables' },

  // Електроніка та гаджети
  { id: 'electronics', name: 'Електроніка та гаджети', parent: null },
  { id: 'device-cases', name: 'Корпуси та чохли', parent: 'electronics' },
  { id: 'holders', name: 'Тримачі та підставки', parent: 'electronics' },
  { id: 'cable-management', name: 'Кабель-менеджмент', parent: 'electronics' },
  { id: 'accessories-gadgets', name: 'Аксесуари для гаджетів', parent: 'electronics' },

  // Інструменти та майстерня
  { id: 'tools', name: 'Інструменти, оснащення та майстерня', parent: null },
  { id: 'fixtures', name: 'Пристосування/фікстури', parent: 'tools' },
  { id: 'hand-tools', name: 'Ручний інструмент', parent: 'tools' },
  { id: 'measuring-tools', name: 'Вимірювальний інструмент', parent: 'tools' },
  { id: 'organizers', name: 'Органайзери для інструментів', parent: 'tools' },

  // Частини та кріплення
  { id: 'parts-fasteners', name: 'Запчастини та кріплення', parent: null },
  { id: 'brackets', name: 'Кронштейни та кріплення', parent: 'parts-fasteners' },
  { id: 'replacement-parts', name: 'Запчастини та ремонт', parent: 'parts-fasteners' },

  // Транспорт (fixed parent id typo: 'auto-мото' -> 'auto-moto')
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
  { id: 'personal-care', name: 'Пристрої для догляду', parent: 'medical' },
  { id: 'medical-tools', name: 'Медичні інструменти', parent: 'medical' },

  // Свята та подарунки
  { id: 'gifts', name: 'Свята, подарунки та сувеніри', parent: null },
  { id: 'holiday-xmas', name: 'Новорічні та різдвяні', parent: 'gifts' },
  { id: 'holiday-halloween', name: 'Хелловін', parent: 'gifts' },
  { id: 'holiday-wedding', name: 'Весілля', parent: 'gifts' },
  { id: 'holiday-birthday', name: 'День народження', parent: 'gifts' },

  // Матеріали (optional)
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
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

const uaNumber = (n) => new Intl.NumberFormat('uk-UA').format(n);

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
  const [categorySearch, setCategorySearch] = useState('');
  const [openCats, setOpenCats] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  const debounceTimer = useRef(null);

  // body scroll lock while drawer open (mobile)
  useEffect(() => {
    if (isFiltersVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFiltersVisible]);

  // watch viewport
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update); else mq.addListener(update);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', update); else mq.removeListener(update); };
  }, []);

  const categoryTree = useMemo(() => buildCategoryTree(structuredCategories), []);

  const selectedCatsForQuery = useMemo(
    () => selectedCategories.filter(c => c !== 'all'),
    [selectedCategories]
  );

  const filteredCategoryTree = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categoryTree;

    const filterNode = (node) => {
      const matchesSelf = node.name.toLowerCase().includes(q);
      const children = (node.children || []).map(filterNode).filter(Boolean);
      if (matchesSelf || children.length) return { ...node, children };
      return null;
    };
    return categoryTree.map(filterNode).filter(Boolean);
  }, [categorySearch, categoryTree]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    count += selectedCatsForQuery.length;
    if (minPrice) count++;
    if (maxPrice) count++;
    if (material) count++;
    if (printTech) count++;
    if (searchQuery) count++;
    return count;
  }, [selectedCatsForQuery.length, minPrice, maxPrice, material, printTech, searchQuery]);

  const activeTags = useMemo(() => {
    const tags = [];
    selectedCatsForQuery.forEach(id => {
      const cat = structuredCategories.find(c => c.id === id);
      if (cat) tags.push({ type: 'category', id, label: cat.name });
    });
    if (minPrice) tags.push({ type: 'minPrice', label: `від ₴${uaNumber(Number(minPrice))}` });
    if (maxPrice) tags.push({ type: 'maxPrice', label: `до ₴${uaNumber(Number(maxPrice))}` });
    if (material) tags.push({ type: 'material', label: `Матеріал: ${material}` });
    if (printTech) tags.push({ type: 'printTech', label: `Технологія: ${printTech}` });
    if (searchQuery) tags.push({ type: 'search', label: `Пошук: "${searchQuery}"` });
    return tags;
  }, [selectedCatsForQuery, minPrice, maxPrice, material, printTech, searchQuery]);

  const clearAll = useCallback(() => {
    setSelectedCategories([]);
    setMinPrice('');
    setMaxPrice('');
    setMaterial('');
    setPrintTech('');
    setSearchInput('');
    setSearchQuery('');
    setCategorySearch('');
  }, []);

  const removeTag = useCallback((tag) => {
    switch (tag.type) {
      case 'category':
        setSelectedCategories(prev => prev.filter(c => c !== tag.id));
        break;
      case 'minPrice': setMinPrice(''); break;
      case 'maxPrice': setMaxPrice(''); break;
      case 'material': setMaterial(''); break;
      case 'printTech': setPrintTech(''); break;
      case 'search': setSearchInput(''); setSearchQuery(''); break;
      default: break;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.listProducts(searchQuery, 50, {
          categories: selectedCatsForQuery,
          minPrice,
          maxPrice,
          material,
          printTech,
          sortBy,
        });
        setProducts(normalizeProducts(data));
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Помилка завантаження');
        console.error('Помилка під час отримання товарів:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
    return () => controller.abort();
  }, [searchQuery, selectedCatsForQuery, minPrice, maxPrice, material, printTech, sortBy]);

  const handleSearch = useCallback((value) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(value.trim());
      debounceTimer.current = null;
    }, 450);
  }, []);

  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

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

  const isCatOpen = useCallback((cat) => {
    return !!(openCats[cat.id] || (cat.children && cat.children.some(ch => selectedCategories.includes(ch.id))));
  }, [openCats, selectedCategories]);

  const toggleCat = (id) => setOpenCats(prev => ({ ...prev, [id]: !prev[id] }));

  const handleMinPriceChange = (e) => setMinPrice(e.target.value);
  const handleMaxPriceChange = (e) => setMaxPrice(e.target.value);
  const handleMaterialChange = (e) => setMaterial(e.target.value);
  const handlePrintTechChange = (e) => setPrintTech(e.target.value);
  const handleSortChange = (e) => setSortBy(e.target.value);
  const toggleFiltersVisibility = () => setIsFiltersVisible(v => !v);

  const ProductCardWithHighlight = React.memo(function ProductCardWithHighlight({ product, query }) {
    const highlightedName = useMemo(() => highlightMatch(product.name, query), [product.name, query]);

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
        onAddToCart={() => {}}
      />
    );
  });

  const renderContent = () => {
    if (isLoading) return <div className="loading-container"><div className="loading-spinner" aria-hidden="true" /><p>Завантаження товарів...</p></div>;
    if (error) return <div className="error-container"><p className="error">Помилка: {error}</p></div>;
    if (products.length > 0) {
      return products.map((p, idx) => (
        <div role="listitem" key={p.id ?? p._id ?? p.sku ?? p.slug ?? idx}>
          <Link to={`/products/${p.id ?? p._id}`} className="product-card-link" aria-label={`Відкрити ${p.name}`}>
            <ProductCardWithHighlight product={p} query={searchQuery} />
          </Link>
        </div>
      ));
    }
    return <div className="empty-state"><div className="empty-icon" aria-hidden>🕵️‍♂️</div><h3>Нічого не знайдено</h3><p>Спробуйте змінити фільтри або скинути їх.</p></div>;
  };

  useEffect(() => { document.title = 'Каталог товарів - Lite Forest'; }, []);

  return (
    <div className="catalog-page">
      {isFiltersVisible && <div className="filters-overlay" onClick={toggleFiltersVisibility} aria-hidden="true" />}

      <header className="catalog-header">
        <h1>Каталог</h1>
        <button
          className="btn btn--secondary mobile-filters-toggle"
          onClick={toggleFiltersVisibility}
          aria-expanded={isFiltersVisible}
          aria-controls="filtersDrawer"
        >
          <span className="filter-icon" aria-hidden>⚙️</span>
          Фільтри{activeFiltersCount > 0 && <span className="badge" aria-label={`Активні фільтри: ${activeFiltersCount}`}>{activeFiltersCount}</span>}
        </button>
      </header>

      <SearchBar onSearch={handleSearch} allProducts={products} />

      {/* Active filter chips (always visible above the grid) */}
      {activeTags.length > 0 && (
        <div className="active-filters" role="region" aria-label="Активні фільтри">
          <div className="active-filters-header">
            <h4>Активні фільтри</h4>
            <button className="clear-all" onClick={clearAll}>Очистити все</button>
          </div>
          <div className="filter-tags">
            {activeTags.map((tag, i) => (
              <span key={`${tag.type}-${tag.id || i}`} className="filter-tag">
                {tag.label}
                <button aria-label={`Прибрати ${tag.label}`} onClick={() => removeTag(tag)}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="catalog-content">
        <aside
          id="filtersDrawer"
          className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`}
          role={isMobile ? 'dialog' : undefined}
          aria-modal={isMobile ? true : undefined}
          aria-label="Фільтри каталогу"
        >
          <div className="filters-header">
            <h2>Фільтри</h2>
            <button className="close-filters" onClick={toggleFiltersVisibility} aria-label="Закрити фільтри">×</button>
          </div>

          {/* Категорії */}
          <div className="filter-group">
            <h3>Категорії</h3>

            <input
              className="input input--sm category-search"
              type="search"
              placeholder="Пошук у категоріях"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              aria-label="Пошук у категоріях"
            />

            <div className="category-list">
              {filteredCategoryTree.map(cat => (
                <div key={cat.id} className="category-block">
                  <label className={`category-item ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => handleCategoryChange(cat.id)}
                    />
                    <span className="custom-checkbox" aria-hidden />
                    <span>{cat.name}</span>
                  </label>

                  {cat.children?.length > 0 && (
                    <>
                      <button className={`category-toggle ${isCatOpen(cat) ? 'open' : ''}`} onClick={() => toggleCat(cat.id)} aria-label={`Розгорнути ${cat.name}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
                      </button>
                      <div className={`category-children ${isCatOpen(cat) ? 'open' : ''}`}>
                        {cat.children.map(child => (
                          <label key={child.id} className={`category-item child ${selectedCategories.includes(child.id) ? 'selected' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(child.id)}
                              onChange={() => handleCategoryChange(child.id)}
                            />
                            <span className="custom-checkbox" aria-hidden />
                            <span>{child.name}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Ціна */}
          <div className="filter-group">
            <h3>Ціна, ₴</h3>
            <div className="price-filter">
              <div className="price-inputs">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="від"
                  value={minPrice}
                  onChange={handleMinPriceChange}
                  className="price-input input"
                  min={0}
                  step={1}
                />
                <span className="price-separator">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="до"
                  value={maxPrice}
                  onChange={handleMaxPriceChange}
                  className="price-input input"
                  min={0}
                  step={1}
                />
              </div>
              <div className="price-presets" aria-label="Швидкі діапазони цін">
                <button onClick={() => { setMinPrice(''); setMaxPrice('500'); }}>до ₴500</button>
                <button onClick={() => { setMinPrice('500'); setMaxPrice('1500'); }}>₴500–₴1 500</button>
                <button onClick={() => { setMinPrice('1500'); setMaxPrice('3000'); }}>₴1 500–₴3 000</button>
              </div>
            </div>
          </div>

          {/* Матеріал */}
          <div className="filter-group">
            <h3>Матеріал</h3>
            <select value={material} onChange={handleMaterialChange} aria-label="Фільтр за матеріалом">
              <option value="">— будь-який —</option>
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="Resin">Resin</option>
              <option value="Nylon">Nylon</option>
            </select>
          </div>

          {/* Технологія друку */}
          <div className="filter-group">
            <h3>Технологія друку</h3>
            <select value={printTech} onChange={handlePrintTechChange} aria-label="Фільтр за технологією друку">
              <option value="">— будь-яка —</option>
              <option value="FDM">FDM</option>
              <option value="SLA">SLA</option>
              <option value="SLS">SLS</option>
              <option value="MJF">MJF</option>
            </select>
          </div>

          {/* Desktop-only clear actions (mobile has sticky footer) */}
          <div className="filter-actions">
            <button className="btn btn--secondary" onClick={clearAll}>Скинути фільтри</button>
          </div>

          {/* Mobile sticky footer */}
          {isMobile && (
            <div className="filters-footer">
              <button className="btn btn--secondary" onClick={clearAll}>Скинути</button>
              <button className="btn btn--primary" onClick={toggleFiltersVisibility}>
                Показати {uaNumber(products.length)}
              </button>
            </div>
          )}
        </aside>

        <main className="product-grid">
          <div className="products-header">
            <span className="products-count">Знайдено товарів: {uaNumber(products.length)}</span>
            <select className="sort-by input" value={sortBy} onChange={handleSortChange} aria-label="Сортування">
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
                    <Link
                      to={`/products/${p.id ?? p._id}`}
                      className="product-card-link"
                      aria-label={`Відкрити ${p.name}`}
                    >
                      <ProductCardWithHighlight product={p} query={searchQuery} />
                    </Link>
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
