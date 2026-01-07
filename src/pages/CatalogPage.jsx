import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import { api } from '../api/client';
import './CatalogPage.css';

/**
 * CatalogPage – filter UX (+ аніме фігурки)
 *
 * ✔ Категорії: перші 7, потім «Більше/Згорнути» з aria-атрибутами та анімацією
 * ✔ Моб: тулбар «Пошук + Фільтри + Сортування»; футер «Скинути/Показати» з safe-area
 * ✔ Розкривач підкатегорій (▶/▼) з aria-controls/expanded
 * ✔ Пін важливих топ-груп угорі (all, novelties, miniatures, props-cosplay, toys)
 * ✔ Нове: категорія «Аніме фігурки» + пошук категорій з синонімами (aliases)
 * ✔ Нове: фасети для колекціонерів — «Франшиза», «Масштаб», «Фініш (painted/kit/STL)»
 * ✔ Нове: збереження стану відкритих категорій/expand у localStorage
 * ✔ Нове: глибокі посилання на фільтри через URLSearchParams (deeplink/шаринг)
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

  // ➕ НОВЕ: Аніме фігурки (колекційний сегмент)
  { id: 'anime-figures', name: 'Аніме фігурки', parent: 'miniatures', aliases: ['аниме', 'anime', 'манга', 'манґа'] },

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

  const PINNED = ['all', 'novelties', 'miniatures', 'props-cosplay', 'toys'];
  tree.sort((a, b) => {
    const ai = PINNED.indexOf(a.id);
    const bi = PINNED.indexOf(b.id);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
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

// --- helpers для URL-параметрів -------------------------------------------------
const encodeList = (arr) => (arr && arr.length ? arr.join(',') : '');
const decodeList = (str) => (str ? str.split(',').map(s => s.trim()).filter(Boolean) : []);

// ВНЕ компонента файла:
export const ProductCardWithHighlight = React.memo(function ProductCardWithHighlight({ product, query }) {
  const highlightedName = useMemo(
    () => highlightMatch(product.name ?? product.name_uk ?? product.title ?? '', query),
    [product.name, product.name_uk, product.title, query]
  );

  const image =
    product.image_url
    ?? product.main_image_url
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

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 36;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState(() => decodeList(searchParams.get('cats') || ''));
  const [minPrice, setMinPrice] = useState(searchParams.get('min') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max') || '');
  const [material, setMaterial] = useState(searchParams.get('mat') || '');
  const [printTech, setPrintTech] = useState(searchParams.get('tech') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'popular');

  const [franchise, setFranchise] = useState(searchParams.get('franchise') || '');
  const [scale, setScale] = useState(searchParams.get('scale') || '');
  const [finish, setFinish] = useState(searchParams.get('finish') || '');

  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categorySearch, setCategorySearch] = useState('');
  const [openCats, setOpenCats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lf.openCats') || '{}'); } catch { return {}; }
  });
  const [isMobile, setIsMobile] = useState(false);

  // Collapsible categories (desktop + mobile)
  const [catExpanded, setCatExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lf.catExpanded') || 'false'); } catch { return false; }
  });
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(0);

  const debounceTimer = useRef(null);

  // Refs
  const panelRef = useRef(null);
  const headerRef = useRef(null);
  const categoryListRef = useRef(null);
  const moreBtnRef = useRef(null);
  const sentinelRef = useRef(null);

  // Скролл-лок без дёрганья при відкритих фільтрах
  useEffect(() => {
    if (!isFiltersVisible) { document.body.style.overflow=''; document.body.style.paddingRight=''; return; }
    const hasScrollbar = window.innerWidth > document.documentElement.clientWidth;
    if (hasScrollbar) {
      const pr = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${pr}px`;
    }
    document.body.style.overflow='hidden';
    return () => { document.body.style.overflow=''; document.body.style.paddingRight=''; };
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
      const matchesSelf =
        node.name.toLowerCase().includes(q) ||
        (node.aliases?.some(a => a.toLowerCase().includes(q)));
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
    if (franchise) count++;
    if (scale) count++;
    if (finish) count++;
    if (searchQuery) count++;
    return count;
  }, [selectedCatsForQuery.length, minPrice, maxPrice, material, printTech, franchise, scale, finish, searchQuery]);

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
    if (franchise) tags.push({ type: 'franchise', label: `Франшиза: ${franchise}` });
    if (scale) tags.push({ type: 'scale', label: `Масштаб: ${scale}` });
    if (finish) tags.push({
      type: 'finish',
      label: finish === 'painted' ? 'Готові/пофарбовані' :
             finish === 'kit' ? 'Набір для фарбування' :
             finish === 'stl' ? 'STL-файл' : `Фініш: ${finish}`
    });
    if (searchQuery) tags.push({ type: 'search', label: `Пошук: "${searchQuery}"` });
    return tags;
  }, [selectedCatsForQuery, minPrice, maxPrice, material, printTech, franchise, scale, finish, searchQuery]);

  const clearAll = useCallback(() => {
    setSelectedCategories([]);
    setMinPrice('');
    setMaxPrice('');
    setMaterial('');
    setPrintTech('');
    setFranchise('');
    setScale('');
    setFinish('');
    setSearchInput('');
    setSearchQuery('');
    setCategorySearch('');
  }, []);

  const removeTag = useCallback((tag) => {
    switch (tag.type) {
      case 'category': setSelectedCategories(prev => prev.filter(c => c !== tag.id)); break;
      case 'minPrice': setMinPrice(''); break;
      case 'maxPrice': setMaxPrice(''); break;
      case 'material': setMaterial(''); break;
      case 'printTech': setPrintTech(''); break;
      case 'franchise': setFranchise(''); break;
      case 'scale': setScale(''); break;
      case 'finish': setFinish(''); break;
      case 'search': setSearchInput(''); setSearchQuery(''); break;
      default: break;
    }
  }, []);

  // --- Синхронізація з URL (deeplink) ------------------------------------------
  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (searchQuery) nextParams.set('q', searchQuery);
    if (selectedCategories.length) nextParams.set('cats', encodeList(selectedCategories));
    if (minPrice) nextParams.set('min', minPrice);
    if (maxPrice) nextParams.set('max', maxPrice);
    if (material) nextParams.set('mat', material);
    if (printTech) nextParams.set('tech', printTech);
    if (franchise) nextParams.set('franchise', franchise);
    if (scale) nextParams.set('scale', scale);
    if (finish) nextParams.set('finish', finish);
    if (sortBy && sortBy !== 'popular') nextParams.set('sort', sortBy);

    const current = searchParams.toString();
    const next = nextParams.toString();
    if (current !== next) setSearchParams(nextParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategories, minPrice, maxPrice, material, printTech, franchise, scale, finish, sortBy]);

  // Збереження розкритих категорій / expanded у localStorage
  useEffect(() => {
    try { localStorage.setItem('lf.openCats', JSON.stringify(openCats)); } catch {}
  }, [openCats]);
  useEffect(() => {
    try { localStorage.setItem('lf.catExpanded', JSON.stringify(catExpanded)); } catch {}
  }, [catExpanded]);

  // --- ВРЕМЕННО: защита, чтобы не падало из-за разных форматов картинок ----------
  function pickMainImage(p) {
    const imgs = Array.isArray(p?.images) ? p.images : [];
    const first = imgs[0];
    // підтримка різних форматів: рядок або обʼєкт { url }
    return (first && (first.url || first)) || p?.image_url || null;
  }

  // Нормалізатор продуктів (для UI)
  const adaptProduct = (p) => ({
    ...p,
    id: p.id ?? p._id ?? p.product_id ?? p.sku,
    name: p.name ?? p.name_uk ?? p.title ?? '',
    price: (typeof p.price === 'number')
      ? p.price
      : Number(p.price ?? p.price_min_printed ?? p.base_price ?? 0),
    image_url: pickMainImage(p)
      ?? p.main_image_url
      ?? p.image?.url
      ?? (Array.isArray(p.images) ? (p.images[0]?.thumb_url ?? p.images[0]?.url) : null)
      ?? (Array.isArray(p.media) ? p.media.find(m => m.media_type === 'image')?.url : null)
      ?? null,
  });


  // --- cursorRef: чтобы cursor не пересоздавал fetchProducts и не триггерил reset-эффект ---
  const cursorRef = useRef(null);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  // Products fetch (cursor-based)
  const fetchProducts = useCallback(async (mode = 'reset', controller) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.listProducts(
        searchQuery,
        pageSize,
        {
          categories: selectedCatsForQuery,
          minPrice,
          maxPrice,
          material,
          printTech,
          sortBy,
          franchise,
          scale,
          finish,
          cursor: mode === 'more' ? cursorRef.current : null, // ✅ берём из ref
        },
        { signal: controller?.signal }
      );

      const items = normalizeProducts(data).map(adaptProduct);
      setTotal(Number(data.total ?? 0));

      if (mode === 'more') setProducts(prev => [...prev, ...items]);
      else setProducts(items);

      const next =
        (typeof data?.nextCursor === 'string' && data.nextCursor)
          ? data.nextCursor
          : null;

      setCursor(next);
      setHasMore(!!next);
    } catch (err) {
      if (err?.name === 'AbortError') return;

      setError(err?.message || 'Помилка завантаження');
      setHasMore(false);
      setCursor(null);
      setTotal(0);
      console.error('Помилка під час отримання товарів:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    pageSize,
    selectedCatsForQuery,
    minPrice,
    maxPrice,
    material,
    printTech,
    sortBy,
    franchise,
    scale,
    finish
    // cursor убран из зависимостей
  ]);


  // Перезагрузка при изменении фильтров/поиска
  useEffect(() => {
    const controller = new AbortController();
    fetchProducts('reset', controller);
    return () => controller.abort();
  }, [fetchProducts]);

  // Debounced search
  const handleSearch = useCallback((value) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(value.trim());
      debounceTimer.current = null;
    }, 450);
  }, []);
  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  // Category selection
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

  // Підганяємо висоту «перших 7», щоб бачити дітей відкритої категорії
  const adjustCollapsedHeightFor = useCallback((catId, willOpen) => {
    if (!(shouldCollapse && !catExpanded) || !categoryListRef.current) return;

    const blocks = categoryListRef.current.querySelectorAll(':scope > .category-block');
    if (!blocks || blocks.length < 7) return;

    const firstRect = blocks[0].getBoundingClientRect();
    const seventhRect = blocks[6].getBoundingClientRect();
    let height = Math.ceil(seventhRect.bottom - firstRect.top);

    const idx = Array.from(blocks).findIndex(b => b.querySelector(`#children-${catId}`));
    if (idx !== -1 && idx <= 6) {
      const child = categoryListRef.current.querySelector(`#children-${catId}`);
      if (child) {
        const delta = child.scrollHeight;
        height = willOpen ? height + delta : Math.max(height - delta, 0);
      }
    }
    setCollapsedMaxHeight(height);
  }, [shouldCollapse, catExpanded]);

  const toggleCat = (id) => {
    setOpenCats(prev => {
      const willOpen = !prev[id];
      adjustCollapsedHeightFor(id, willOpen);
      return { ...prev, [id]: willOpen };
    });
  };

  const handleMinPriceChange = (e) => setMinPrice(e.target.value);
  const handleMaxPriceChange = (e) => setMaxPrice(e.target.value);
  const handleMaterialChange = (e) => setMaterial(e.target.value);
  const handlePrintTechChange = (e) => setPrintTech(e.target.value);
  const handleSortChange = (e) => setSortBy(e.target.value);
  const toggleFiltersVisibility = () => setIsFiltersVisible(v => !v);

  useEffect(() => { document.title = 'Каталог товарів - Lite Forest'; }, []);

  // --- Collapse (both desktop & mobile) ---
  const recomputeCollapsedHeight = useCallback(() => {
    if (!categoryListRef.current) { setCollapsedMaxHeight(0); setShouldCollapse(false); return; }
    if (categorySearch.trim()) { setShouldCollapse(false); setCollapsedMaxHeight(0); return; }

    const blocks = categoryListRef.current.querySelectorAll(':scope > .category-block');
    if (!blocks || blocks.length <= 7) { setShouldCollapse(false); setCollapsedMaxHeight(0); return; }

    const firstRect = blocks[0].getBoundingClientRect();
    const seventhRect = blocks[6].getBoundingClientRect();
    const height = Math.ceil(seventhRect.bottom - firstRect.top);
    setCollapsedMaxHeight(height);
    setShouldCollapse(true);
  }, [categorySearch]);

  useLayoutEffect(() => { recomputeCollapsedHeight(); }, [filteredCategoryTree, recomputeCollapsedHeight]);

  // Перерахунок після DOM-ізмен (стабільно з анімацією max-height)
  useEffect(() => {
    if (!(shouldCollapse && !catExpanded)) return;
    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => recomputeCollapsedHeight());
    });
    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [openCats, shouldCollapse, catExpanded, recomputeCollapsedHeight]);

  useEffect(() => {
    const onResize = () => recomputeCollapsedHeight();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }, [recomputeCollapsedHeight]);

  // --- Применение поиска из хедера (событие) ---
  useEffect(() => {
    const onApplySearch = (e) => {
      const v = String(e.detail ?? '');
      setSearchInput(v);
      setSearchQuery(v);
    };
    window.addEventListener('lf:applySearch', onApplySearch);
    return () => window.removeEventListener('lf:applySearch', onApplySearch);
  }, []);

  // Если URL ?q=... изменился извне (history/back)
  useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    if (urlQ !== searchInput) {
      setSearchInput(urlQ);
      setSearchQuery(urlQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onToggleMore = useCallback(() => {
    setCatExpanded(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          const eighth = categoryListRef.current?.querySelectorAll(':scope > .category-block')[7];
          const label = eighth?.querySelector('label.category-item');
          if (label) label.focus();
        }, 0);
      } else {
        setTimeout(() => { moreBtnRef.current?.focus(); }, 0);
      }
      return next;
    });
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <li className="loading-container">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Завантаження товарів...</p>
        </li>
      );
    }
    if (error) {
      return (
        <li className="error-container" aria-live="assertive">
          <p className="error">Помилка: {error}</p>
          <button
            className="btn btn--secondary"
            onClick={() => {
              setError(null);
              setHasMore(true);
              setCursor(null);
              const controller = new AbortController();
              fetchProducts('reset', controller);
            }}
          >
            Повторити
          </button>
        </li>
      );
    }
    if (products.length > 0) {
      return products.map((p) => (
        <li key={p.id ?? p._id ?? p.sku ?? p.slug}>
          <Link to={`/products/${p.id ?? p._id}`} className="product-card-link" aria-label={`Відкрити ${p.name}`}>
            <ProductCardWithHighlight product={p} query={searchQuery} />
          </Link>
        </li>
      ));
    }
    return (
      <li className="empty-state">
        <div className="empty-icon" aria-hidden>🕵️‍♂️</div>
        <h3>Нічого не знайдено</h3>
        <p>Спробуйте змінити фільтри або скинути їх.</p>
      </li>
    );
  };

  // List style when collapsed
  const categoryListStyle = (shouldCollapse && !catExpanded)
    ? { overflow: 'hidden', maxHeight: `${collapsedMaxHeight}px`, transition: 'max-height 260ms ease' }
    : { transition: 'max-height 260ms ease' };

  // Кнопка і «сторож» (IntersectionObserver) для підвантаження
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || !!error) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !isLoading) {
        const controller = new AbortController();
        fetchProducts('more', controller);
      }
    }, { rootMargin: '600px 0px' });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasMore, isLoading, error, cursor, searchQuery, selectedCatsForQuery, sortBy, fetchProducts]);

  return (
    <div className="catalog-page">
      {isFiltersVisible && <div className="filters-overlay visible" onClick={toggleFiltersVisibility} aria-hidden="true" />}

      <header className="catalog-header">
        <h1>Каталог</h1>
      </header>

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
          ref={panelRef}
          className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`}
          role={isMobile ? 'dialog' : undefined}
          aria-modal={isMobile ? true : undefined}
          aria-label="Фільтри каталогу"
          style={isMobile ? { paddingTop: 0, paddingBottom: 0 } : undefined}
        >
          <div className="filters-header" ref={headerRef} style={isMobile ? { position:'sticky', top:0, zIndex:2, background:'var(--color-surface)', paddingTop:'env(safe-area-inset-top, 0px)' } : undefined}>
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

            <div id="categoryListTop" className="category-list" ref={categoryListRef} style={categoryListStyle}>
              {filteredCategoryTree.map(cat => (
                <div key={cat.id} className="category-block">
                  <div className="category-header">
                    <label tabIndex={0} className={`category-item ${selectedCategories.includes(cat.id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => handleCategoryChange(cat.id)}
                      />
                      <span className="custom-checkbox" aria-hidden />
                      <span>{cat.name}</span>
                    </label>

                    {cat.children?.length > 0 && (
                      <button
                        className={`category-disclosure ${isCatOpen(cat) ? 'open' : ''}`}
                        onClick={() => toggleCat(cat.id)}
                        aria-label={`${isCatOpen(cat) ? 'Згорнути' : 'Розгорнути'} ${cat.name}`}
                        aria-expanded={isCatOpen(cat)}
                        aria-controls={`children-${cat.id}`}
                      >
                        <span className="disclosure-icon" aria-hidden="true">
                          {isCatOpen(cat) ? '▼' : '▶'}
                        </span>
                      </button>
                    )}
                  </div>

                  {cat.children?.length > 0 && (
                    <div id={`children-${cat.id}`} className={`category-children ${isCatOpen(cat) ? 'open' : ''}`}>
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
                  )}
                </div>
              ))}
            </div>

            {/* Кнопка Більше/Згорнути — і на ПК, і на мобілі */}
            {shouldCollapse && !categorySearch.trim() && (
              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <button
                  ref={moreBtnRef}
                  className="btn btn--secondary"
                  onClick={onToggleMore}
                  aria-controls="categoryListTop"
                  aria-expanded={catExpanded}
                >
                  {catExpanded ? 'Згорнути' : 'Більше'}
                </button>
              </div>
            )}
          </div>

          {/* Ціна */}
          <div className="filter-group">
            <h3>Ціна, ₴</h3>
            <div className="price-filter">
              <div className="price-inputs">
                <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="від" value={minPrice} onChange={handleMinPriceChange} className="price-input input" min={0} step={1} />
                <span className="price-separator">–</span>
                <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="до" value={maxPrice} onChange={handleMaxPriceChange} className="price-input input" min={0} step={1} />
              </div>
              <div className="price-presets" aria-label="Швидкі діапазони цін">
                <button onClick={() => { setMinPrice(''); setMaxPrice('500'); }}>до ₴500</button>
                <button onClick={() => { setMinPrice('500'); setMaxPrice('1500'); }}>₴500–₴1 500</button>
                <button onClick={() => { setMinPrice('1500'); setMaxPrice('3000'); }}>₴1 500–₴3 000</button>
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

          {/* ➕ Нові фасети для фігурок */}
          <div className="filter-group">
            <h3>Франшиза</h3>
            <input
              className="input"
              type="search"
              placeholder="Напр., One Piece, Naruto, Genshin…"
              value={franchise}
              onChange={(e) => setFranchise(e.target.value)}
              aria-label="Фільтр за франшизою"
            />
          </div>

          <div className="filter-group">
            <h3>Масштаб</h3>
            <select value={scale} onChange={(e) => setScale(e.target.value)} aria-label="Фільтр за масштабом">
              <option value="">— будь-який —</option>
              <option value="1/6">1/6</option>
              <option value="1/7">1/7</option>
              <option value="1/8">1/8</option>
              <option value="1/10">1/10</option>
              <option value="1/12">1/12</option>
              <option value="1/35">1/35</option>
              <option value="SD">SD/Chibi</option>
            </select>
          </div>

          <div className="filter-group">
            <h3>Фініш</h3>
            <select value={finish} onChange={(e) => setFinish(e.target.value)} aria-label="Фільтр за фінішем">
              <option value="">— будь-який —</option>
              <option value="painted">Готові/пофарбовані</option>
              <option value="kit">Набір для фарбування</option>
              <option value="stl">STL-файл</option>
            </select>
          </div>

          {/* Desktop-only clear */}
          <div className="filter-actions">
            <button className="btn btn--secondary" onClick={clearAll}>Скинути фільтри</button>
          </div>

          {/* Мобільний нижній футер */}
          {isMobile && (
            <div className="filters-footer">
              <button className="btn btn--secondary" onClick={clearAll}>Скинути</button>
              <button className="btn btn--primary" onClick={toggleFiltersVisibility}>Показати {uaNumber(products.length)}</button>
            </div>
          )}

        </aside>

        <main className="product-grid">
          {/* Липкая панель: Поиск + Фильтры (моб) + Сортировка + Счётчик */}
          <div className="catalog-toolbar" role="region" aria-label="Панель каталога">
            <div className="toolbar-left">
              {/* поиск не от «всех товаров»; автофокус на мобилке выключаем */}
              <SearchBar
                onSearch={handleSearch}
                value={searchInput}
                placeholder="Пошук товарів"
                mobile
              />
            </div>
            <div className="toolbar-right">
              <button
                className="btn btn--secondary toolbar-filters-btn"
                onClick={toggleFiltersVisibility}
                aria-expanded={isFiltersVisible}
                aria-controls="filtersDrawer"
              >
                <span aria-hidden>⚙️</span>
                Фільтри{activeFiltersCount > 0 && (
                  <span className="badge" aria-label={`Активні фільтри: ${activeFiltersCount}`}>{activeFiltersCount}</span>
                )}
              </button>
              <select className="sort-by input" value={sortBy} onChange={handleSortChange} aria-label="Сортування">
                <option value="popular">Спочатку популярні</option>
                <option value="new">Спочатку нові</option>
                <option value="price_asc">Спершу дешеві</option>
                <option value="price_desc">Спочатку дорогі</option>
              </select>
              <span className="products-count inline" aria-live="polite">{`Знайдено: ${uaNumber(total)}`}</span>
            </div>
          </div>

          <div className="products-header" aria-hidden="true"></div>

          <ul className="products-list-grid">
            {renderContent()}
            {hasMore && !isLoading && !error && (
              <li className="list-load-more">
                <button className="btn btn--secondary" onClick={() => {
                  const controller = new AbortController();
                  fetchProducts('more', controller);
                }}>Показати ще</button>
              </li>
            )}
            {!error && (
              <li aria-hidden>
                <div ref={sentinelRef} />
              </li>
            )}
          </ul>

        </main>
      </div>
    </div>
  );
};

export default CatalogPage;
