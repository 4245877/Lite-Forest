import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import { api } from '../api/client';
import {
  buildCategoryMaps,
  buildCategoryTree,
  findCategoryLabel,
  normalizeMetaCategories,
  resolvePrimaryCategorySlug,
} from '../utils/categoryTree';
import {
  normalizeAvailabilityState,
  getAvailabilityLabel,
  getAvailabilityTiming,
} from '../utils/availability';
import './CatalogPage.css';

const normalizeProducts = (data) => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

const normalizePositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function buildPagination(currentPage, totalPages) {
  if (totalPages <= 1) return [1];

  const pages = new Set([
    1,
    totalPages,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ]);

  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const result = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    if (i > 0 && current - previous > 1) {
      result.push(`ellipsis-${previous}-${current}`);
    }

    result.push(current);
  }

  return result;
}

const uaNumber = (value) => new Intl.NumberFormat('uk-UA').format(value);
const formatUah = (value) => `${uaNumber(value)} ₴`;

// Скільки кореневих категорій показуємо до натискання «Більше».
const COLLAPSE_THRESHOLD = 7;

// Єдині джерела істини для контролів фільтра: і <option>, і чипи активних
// фільтрів читаються звідси, тож підписи не розходяться при правках.
const SORT_OPTIONS = [
  { value: 'popular', label: 'Спочатку популярні', short: 'Популярні' },
  { value: 'new', label: 'Спочатку нові', short: 'Нові' },
  { value: 'price_asc', label: 'Спершу дешеві', short: 'Дешевші' },
  { value: 'price_desc', label: 'Спочатку дорогі', short: 'Дорожчі' },
];

const MATERIAL_OPTIONS = [
  { value: 'PLA', label: 'PLA' },
  { value: 'PETG', label: 'PETG' },
  { value: 'ABS', label: 'ABS' },
  { value: 'Resin', label: 'Смола (Resin)' },
  { value: 'Nylon', label: 'Нейлон (Nylon)' },
];

const SCALE_OPTIONS = [
  { value: '1/6', label: '1/6' },
  { value: '1/7', label: '1/7' },
  { value: '1/8', label: '1/8' },
  { value: '1/10', label: '1/10' },
  { value: '1/12', label: '1/12' },
  { value: '1/35', label: '1/35' },
  { value: 'SD', label: 'SD/Chibi' },
];

const FINISH_OPTIONS = [
  { value: 'painted', label: 'Готові/пофарбовані' },
  { value: 'kit', label: 'Набір для фарбування' },
  { value: 'stl', label: 'STL-файл' },
];
const FINISH_LABELS = Object.fromEntries(FINISH_OPTIONS.map((item) => [item.value, item.label]));

const PRICE_PRESETS = [
  { min: '', max: '500', label: 'до 500 ₴' },
  { min: '500', max: '1500', label: '500–1 500 ₴' },
  { min: '1500', max: '3000', label: '1 500–3 000 ₴' },
];

// Відкладений (debounced) знімок значення: для полів, що змінюються по символу
// (ціна, франшиза), щоб не слати запит на кожне натискання клавіші.
function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

const encodeList = (items) => (items && items.length ? items.join(',') : '');
const decodeList = (value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []);

const normalizeTextList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

function pickMainImage(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  const firstImage = images[0];

  return (
    (firstImage && (firstImage.url || firstImage.thumb_url || firstImage)) ||
    product?.image_url ||
    product?.main_image_url ||
    product?.image?.url ||
    null
  );
}

function getAvailabilityState(product) {
  const attrs = product?.attributes && typeof product.attributes === 'object'
    ? product.attributes
    : {};

  return normalizeAvailabilityState(attrs.availability ?? product?.availability);
}

function getProductLeadDays(product) {
  const attrs = product?.attributes ?? {};
  return Number(attrs.lead_time_days ?? product?.lead_time_days ?? 0);
}

function getAttributeBadges(product) {
  const attrs = product?.attributes ?? {};
  const badges = [];

  const materials = normalizeTextList(attrs.materials);
  const finish = attrs.finish || '';
  const scale = attrs.scale || '';

  // Тип принтера/технологію друку (FDM, SLA…) у вітрині не показуємо —
  // це технічна деталь сервісу, а не характеристика готового виробу.
  if (materials.length) badges.push(materials.slice(0, 2).join(', '));
  if (finish) badges.push(String(finish));
  if (scale) badges.push(`Масштаб ${scale}`);

  return badges.slice(0, 3);
}

function hasSelectedDescendant(node, selectedSet) {
  if (!node?.children?.length) return false;

  return node.children.some((child) => {
    if (selectedSet.has(child.id)) return true;
    return hasSelectedDescendant(child, selectedSet);
  });
}

function adaptProduct(product, categoriesById) {
  const id = product.id ?? product._id ?? product.product_id ?? product.sku;
  const routeKey = product.sku ?? id;
  const attrs = product.attributes ?? {};

  const rawCategories = Array.isArray(product.categories)
    ? product.categories.map((value) => String(value).trim()).filter(Boolean)
    : [];

  const primaryCategorySlug = resolvePrimaryCategorySlug(rawCategories, categoriesById);
  const availabilityState = getAvailabilityState(product);

  const priceRaw =
    typeof product.price === 'number'
      ? product.price
      : Number(product.price ?? product.price_min_printed ?? product.base_price ?? 0);

  return {
    ...product,
    id,
    routeKey,
    attributes: attrs,
    name: product.name ?? product.name_uk ?? product.title ?? '',
    price: Number.isFinite(priceRaw) ? priceRaw : 0,
    image_url:
      pickMainImage(product) ??
      (Array.isArray(product.media) ? product.media.find((item) => item.media_type === 'image')?.url : null) ??
      null,
    categories: rawCategories,
    primaryCategorySlug,
    primaryCategoryLabel: primaryCategorySlug ? findCategoryLabel(primaryCategorySlug, categoriesById) : '',
    availabilityState,
    availabilityLabel: getAvailabilityLabel(availabilityState),
    availabilityTiming: getAvailabilityTiming(availabilityState, getProductLeadDays(product)),
    attributeBadges: getAttributeBadges(product),
  };
}

function getProductKey(product) {
  const key =
    product?.sku
    ?? product?.slug
    ?? product?.path
    ?? product?.url_key
    ?? product?.id
    ?? product?._id
    ?? product?.product_id;

  return key ? String(key) : '';
}

function dedupeProducts(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = getProductKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const ProductCardWithHighlight = React.memo(function ProductCardWithHighlight({ product, query }) {
  const { addItem } = useCart();

  const titleText = product.name ?? '';

  const highlightedName = useMemo(
    () => highlightMatch(titleText, query),
    [titleText, query],
  );

  const image =
    product.image_url
    ?? product.main_image_url
    ?? product.image
    ?? product.media?.find((item) => item.media_type === 'image')?.url
    ?? 'https://placehold.co/300x300';

  const handleAddToCart = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    addItem({
      ...product,
      id: product.id ?? product._id ?? product.product_id ?? product.sku,
      product_id: product.product_id ?? product.id ?? product._id ?? product.sku,
      name: titleText || 'Товар',
      title: titleText || 'Товар',
      price: product.price,
      image,
      image_url: image,
    }, 1);
  }, [addItem, product, titleText, image]);

  return (
    <ProductCard
      productId={product.id}
      image={image}
      title={highlightedName}
      titleText={titleText}
      price={product.price}
      oldPrice={product.old_price ?? product.oldPrice}
      categoryLabel={product.primaryCategoryLabel}
      availabilityLabel={product.availabilityLabel}
      availabilityState={product.availabilityState}
      availabilityTiming={product.availabilityTiming}
      attributesList={product.attributeBadges}
      showAddToCart={product.availabilityState !== 'out-of-stock'}
      onAddToCart={handleAddToCart}
    />
  );
});

const CatalogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);

  const pageSize = 36;
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => normalizePositiveInt(searchParams.get('page'), 1));
  const [totalPages, setTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState(() => decodeList(searchParams.get('cats') || '').filter((value) => value !== 'all'));
  const [minPrice, setMinPrice] = useState(searchParams.get('min') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max') || '');
  const [material, setMaterial] = useState(searchParams.get('mat') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'popular');

  const [franchise, setFranchise] = useState(searchParams.get('franchise') || '');
  const [scale, setScale] = useState(searchParams.get('scale') || '');
  const [finish, setFinish] = useState(searchParams.get('finish') || '');

  // Поля, які користувач набирає по символу, застосовуємо із затримкою —
  // інакше кожне натискання клавіші породжує мережевий запит.
  const debouncedMinPrice = useDebouncedValue(minPrice, 400);
  const debouncedMaxPrice = useDebouncedValue(maxPrice, 400);
  const debouncedFranchise = useDebouncedValue(franchise, 400);

  // Підказка, коли «від» більше за «до»: інакше тихо приходить порожній список.
  const priceRangeInvalid =
    minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice);

  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [categorySearch, setCategorySearch] = useState('');
  const [openCats, setOpenCats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lf.openCats') || '{}');
    } catch {
      return {};
    }
  });
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  );
  const [headerSlot, setHeaderSlot] = useState(null);

  const [catExpanded, setCatExpanded] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lf.catExpanded') || 'false');
    } catch {
      return false;
    }
  });
  const debounceTimer = useRef(null);

  const categoryListRef = useRef(null);
  const moreBtnRef = useRef(null);
  const filtersPanelRef = useRef(null);
  const filtersOpenerRef = useRef(null);

  useEffect(() => {
    let alive = true;

    api.getCategories()
      .then((rows) => {
        if (!alive) return;
        const normalized = normalizeMetaCategories(rows).filter((item) => !item.is_hidden);
        setCategories(normalized);
        setCategoriesError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setCategories([]);
        setCategoriesError(err?.message || 'Не вдалося завантажити категорії');
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isMobile || !isFiltersVisible) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      return;
    }

    const hasScrollbar = window.innerWidth > document.documentElement.clientWidth;
    if (hasScrollbar) {
      const paddingRight = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${paddingRight}px`;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isFiltersVisible, isMobile]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mediaQuery.matches);

    update();

    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', update);
    else mediaQuery.addListener(update);

    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', update);
      else mediaQuery.removeListener(update);
    };
  }, []);

  useEffect(() => {
    if (!isMobile && isFiltersVisible) {
      setIsFiltersVisible(false);
    }
  }, [isMobile, isFiltersVisible]);

  // На мобільному контроли каталогу рендеряться в шапку (portal),
  // щоб звільнити вертикальний простір під сітку товарів.
  useLayoutEffect(() => {
    if (!isMobile) {
      setHeaderSlot(null);
      return;
    }
    setHeaderSlot(document.getElementById('header-catalog-slot'));
  }, [isMobile]);

  const categoryMaps = useMemo(() => buildCategoryMaps(categories), [categories]);
  const categoriesById = categoryMaps.byId;
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const selectedCatsForQuery = useMemo(
    () => selectedCategories.filter(Boolean).filter((value) => value !== 'all'),
    [selectedCategories],
  );

  const selectedCategorySet = useMemo(
    () => new Set(selectedCatsForQuery),
    [selectedCatsForQuery],
  );

  const filteredCategoryTree = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categoryTree;

    const filterNode = (node) => {
      const matchesSelf =
        node.name.toLowerCase().includes(query) ||
        (node.aliases || []).some((alias) => alias.toLowerCase().includes(query));

      const children = (node.children || [])
        .map(filterNode)
        .filter(Boolean);

      if (matchesSelf || children.length) {
        return { ...node, children };
      }

      return null;
    };

    return categoryTree.map(filterNode).filter(Boolean);
  }, [categorySearch, categoryTree]);

  // Згортаємо список лише коли кореневих категорій справді більше за поріг
  // і користувач не шукає (під час пошуку показуємо всі збіги).
  const shouldCollapse = !categorySearch.trim() && filteredCategoryTree.length > COLLAPSE_THRESHOLD;

  const displayProducts = useMemo(
    () => dedupeProducts(products).map((product) => adaptProduct(product, categoriesById)),
    [products, categoriesById],
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    count += selectedCatsForQuery.length;
    if (debouncedMinPrice) count += 1;
    if (debouncedMaxPrice) count += 1;
    if (material) count += 1;
    if (debouncedFranchise) count += 1;
    if (scale) count += 1;
    if (finish) count += 1;
    return count;
  }, [selectedCatsForQuery, debouncedMinPrice, debouncedMaxPrice, material, debouncedFranchise, scale, finish]);

  const filtersSignature = useMemo(() => JSON.stringify({
    q: searchQuery,
    cats: selectedCatsForQuery,
    minPrice: debouncedMinPrice,
    maxPrice: debouncedMaxPrice,
    material,
    sortBy,
    franchise: debouncedFranchise,
    scale,
    finish,
  }), [
    searchQuery,
    selectedCatsForQuery,
    debouncedMinPrice,
    debouncedMaxPrice,
    material,
    sortBy,
    debouncedFranchise,
    scale,
    finish,
  ]);

  const previousFiltersSignatureRef = useRef(filtersSignature);

  useEffect(() => {
    if (previousFiltersSignatureRef.current !== filtersSignature) {
      previousFiltersSignatureRef.current = filtersSignature;
      setPage(1);
    }
  }, [filtersSignature]);

  const activeTags = useMemo(() => {
    const tags = [];

    selectedCatsForQuery.forEach((slug) => {
      tags.push({
        type: 'category',
        id: slug,
        label: findCategoryLabel(slug, categoriesById),
      });
    });

    if (debouncedMinPrice) tags.push({ type: 'minPrice', label: `від ${formatUah(Number(debouncedMinPrice))}` });
    if (debouncedMaxPrice) tags.push({ type: 'maxPrice', label: `до ${formatUah(Number(debouncedMaxPrice))}` });
    if (material) tags.push({ type: 'material', label: `Матеріал: ${material}` });
    if (debouncedFranchise) tags.push({ type: 'franchise', label: `Франшиза: ${debouncedFranchise}` });
    if (scale) tags.push({ type: 'scale', label: `Масштаб: ${scale}` });
    if (finish) tags.push({ type: 'finish', label: FINISH_LABELS[finish] || `Фініш: ${finish}` });
    if (searchQuery) tags.push({ type: 'search', label: `Пошук: "${searchQuery}"` });

    return tags;
  }, [selectedCatsForQuery, categoriesById, debouncedMinPrice, debouncedMaxPrice, material, debouncedFranchise, scale, finish, searchQuery]);

  const clearAll = useCallback(() => {
    setSelectedCategories([]);
    setMinPrice('');
    setMaxPrice('');
    setMaterial('');
    setFranchise('');
    setScale('');
    setFinish('');
    setSearchInput('');
    setSearchQuery('');
    setCategorySearch('');
  }, []);

  const removeTag = useCallback((tag) => {
    switch (tag.type) {
      case 'category':
        setSelectedCategories((prev) => prev.filter((value) => value !== tag.id));
        break;
      case 'minPrice':
        setMinPrice('');
        break;
      case 'maxPrice':
        setMaxPrice('');
        break;
      case 'material':
        setMaterial('');
        break;
      case 'franchise':
        setFranchise('');
        break;
      case 'scale':
        setScale('');
        break;
      case 'finish':
        setFinish('');
        break;
      case 'search':
        setSearchInput('');
        setSearchQuery('');
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (searchQuery) nextParams.set('q', searchQuery);
    if (selectedCategories.length) nextParams.set('cats', encodeList(selectedCategories));
    if (debouncedMinPrice) nextParams.set('min', debouncedMinPrice);
    if (debouncedMaxPrice) nextParams.set('max', debouncedMaxPrice);
    if (material) nextParams.set('mat', material);
    if (debouncedFranchise) nextParams.set('franchise', debouncedFranchise);
    if (scale) nextParams.set('scale', scale);
    if (finish) nextParams.set('finish', finish);
    if (sortBy && sortBy !== 'popular') nextParams.set('sort', sortBy);
    if (page > 1) nextParams.set('page', String(page));

    const current = searchParams.toString();
    const next = nextParams.toString();

    if (current !== next) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchQuery, selectedCategories, debouncedMinPrice, debouncedMaxPrice, material, debouncedFranchise, scale, finish, sortBy, page, searchParams, setSearchParams]);

  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    const urlCats = decodeList(searchParams.get('cats') || '').filter((value) => value !== 'all');
    const urlMin = searchParams.get('min') || '';
    const urlMax = searchParams.get('max') || '';
    const urlMaterial = searchParams.get('mat') || '';
    const urlSort = searchParams.get('sort') || 'popular';
    const urlFranchise = searchParams.get('franchise') || '';
    const urlScale = searchParams.get('scale') || '';
    const urlFinish = searchParams.get('finish') || '';
    const urlPage = normalizePositiveInt(searchParams.get('page'), 1);

    if (urlQuery !== searchInput) setSearchInput(urlQuery);
    if (urlQuery !== searchQuery) setSearchQuery(urlQuery);
    if (encodeList(urlCats) !== encodeList(selectedCategories)) setSelectedCategories(urlCats);
    if (urlMin !== minPrice) setMinPrice(urlMin);
    if (urlMax !== maxPrice) setMaxPrice(urlMax);
    if (urlMaterial !== material) setMaterial(urlMaterial);
    if (urlSort !== sortBy) setSortBy(urlSort);
    if (urlFranchise !== franchise) setFranchise(urlFranchise);
    if (urlScale !== scale) setScale(urlScale);
    if (urlFinish !== finish) setFinish(urlFinish);
    if (urlPage !== page) setPage(urlPage);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      localStorage.setItem('lf.openCats', JSON.stringify(openCats));
    } catch {
      //
    }
  }, [openCats]);

  useEffect(() => {
    try {
      localStorage.setItem('lf.catExpanded', JSON.stringify(catExpanded));
    } catch {
      //
    }
  }, [catExpanded]);

  const fetchProducts = useCallback(async (controller) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.listProducts(
        searchQuery,
        pageSize,
        {
          categories: selectedCatsForQuery,
          minPrice: debouncedMinPrice,
          maxPrice: debouncedMaxPrice,
          material,
          sortBy,
          franchise: debouncedFranchise,
          scale,
          finish,
          page,
        },
        { signal: controller?.signal },
      );

      const items = dedupeProducts(normalizeProducts(data));
      const nextTotalRaw = Number(data?.total);
      const resolvedTotal = Number.isFinite(nextTotalRaw) ? nextTotalRaw : items.length;
      const resolvedPageSize = normalizePositiveInt(
        data?.pageSize ?? data?.page_size,
        pageSize,
      );
      const resolvedTotalPages = Math.max(
        1,
        Number(
          data?.totalPages
          ?? data?.total_pages
          ?? Math.ceil(resolvedTotal / resolvedPageSize),
        ) || 1,
      );
      const resolvedPage = Math.min(
        normalizePositiveInt(data?.page, page),
        resolvedTotalPages,
      );

      setProducts(items);
      setTotal(resolvedTotal);
      setTotalPages(resolvedTotalPages);

      if (resolvedPage !== page) {
        setPage(resolvedPage);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;

      setError(err?.message || 'Помилка завантаження');
      setProducts([]);
      setTotal(0);
      setTotalPages(1);

      console.error('Помилка під час отримання товарів:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    pageSize,
    selectedCatsForQuery,
    debouncedMinPrice,
    debouncedMaxPrice,
    material,
    sortBy,
    debouncedFranchise,
    scale,
    finish,
    page,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller);
    return () => controller.abort();
  }, [fetchProducts]);

  const handleSearch = useCallback((value) => {
    setSearchInput(value);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(value.trim());
      debounceTimer.current = null;
    }, 450);
  }, []);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const handleCategoryChange = useCallback((categoryId) => {
    setSelectedCategories((prev) => (
      prev.includes(categoryId)
        ? prev.filter((value) => value !== categoryId)
        : [...prev, categoryId]
    ));
  }, []);

  const isCatOpen = useCallback((category) => {
    if (categorySearch.trim()) return true;
    return Boolean(openCats[category.id] || hasSelectedDescendant(category, selectedCategorySet));
  }, [openCats, selectedCategorySet, categorySearch]);

  const toggleCat = useCallback((id) => {
    setOpenCats((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleMinPriceChange = (event) => setMinPrice(event.target.value);
  const handleMaxPriceChange = (event) => setMaxPrice(event.target.value);
  const handleMaterialChange = (event) => setMaterial(event.target.value);
  const handleSortChange = (event) => setSortBy(event.target.value);
  const toggleFiltersVisibility = () => setIsFiltersVisible((value) => !value);

  useEffect(() => {
    document.title = 'Каталог товарів - Lite Forest';
  }, []);

  useEffect(() => {
    const onApplySearch = (event) => {
      const value = String(event.detail ?? '');
      setSearchInput(value);
      setSearchQuery(value);
    };

    window.addEventListener('lf:applySearch', onApplySearch);
    return () => window.removeEventListener('lf:applySearch', onApplySearch);
  }, []);

  // Доступність мобільного дровера фільтрів: пастка фокуса, Escape на закриття
  // і повернення фокуса на елемент, що відкрив панель.
  useEffect(() => {
    if (!isMobile || !isFiltersVisible) return undefined;

    const panel = filtersPanelRef.current;
    if (!panel) return undefined;

    filtersOpenerRef.current = document.activeElement;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    const focusables = getFocusable();
    (focusables[0] || panel).focus?.();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsFiltersVisible(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const items = getFocusable();
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);

    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      const opener = filtersOpenerRef.current;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [isMobile, isFiltersVisible]);

  const onToggleMore = useCallback(() => {
    setCatExpanded((prev) => {
      const next = !prev;

      if (next) {
        setTimeout(() => {
          const eighth = categoryListRef.current?.querySelectorAll(':scope > .category-block')[7];
          const checkbox = eighth?.querySelector('input[type="checkbox"]');
          if (checkbox) checkbox.focus();
        }, 0);
      } else {
        setTimeout(() => {
          moreBtnRef.current?.focus();
        }, 0);
      }

      return next;
    });
  }, []);

  const paginationItems = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages],
  );

  const handlePageChange = useCallback((nextPage) => {
    const normalizedPage = Math.max(1, Math.min(nextPage, totalPages));
    if (normalizedPage === page) return;

    setPage(normalizedPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, totalPages]);

  const renderCategoryNode = useCallback((category, depth = 0) => {
    const open = isCatOpen(category);
    const selected = selectedCategorySet.has(category.id);

    return (
      <div key={category.id} className={depth === 0 ? 'category-block' : 'category-node'}>
        <div className="category-header">
          <label className={`category-item ${depth > 0 ? 'child' : ''} ${selected ? 'selected' : ''}`}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => handleCategoryChange(category.id)}
            />
            <span className="custom-checkbox" aria-hidden />
            <span>{category.name}</span>
          </label>

          {category.children?.length > 0 && (
            <button
              className={`category-disclosure ${open ? 'open' : ''}`}
              onClick={() => toggleCat(category.id)}
              aria-label={`${open ? 'Згорнути' : 'Розгорнути'} ${category.name}`}
              aria-expanded={open}
              aria-controls={`children-${category.id}`}
            >
              <svg
                className="disclosure-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          )}
        </div>

        {category.children?.length > 0 && (
          <div id={`children-${category.id}`} className={`category-children ${open ? 'open' : ''}`}>
            <div className="category-children-inner">
              {category.children.map((child) => renderCategoryNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  }, [handleCategoryChange, isCatOpen, selectedCategorySet, toggleCat]);

  const renderContent = () => {
    if (isLoading && !displayProducts.length) {
      return (
        <li className="loading-container">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Завантаження товарів...</p>
        </li>
      );
    }

    if (error && !displayProducts.length) {
      return (
        <li className="error-container" aria-live="assertive">
          <p className="error">Помилка: {error}</p>
          <button
            className="btn btn--secondary"
            onClick={() => {
              setError(null);
              const controller = new AbortController();
              fetchProducts(controller);
            }}
          >
            Повторити
          </button>
        </li>
      );
    }

    if (displayProducts.length > 0) {
      return displayProducts.map((product) => (
        <li key={product.id ?? product.routeKey}>
          <Link
            to={`/products/${encodeURIComponent(product.routeKey)}`}
            className="product-card-link"
            aria-label={`Відкрити ${product.name}`}
          >
            <ProductCardWithHighlight product={product} query={searchQuery} />
          </Link>
        </li>
      ));
    }

    return (
      <li className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="28" cy="28" r="17" />
            <path d="m40 40 13 13" />
            <path d="M21 28h14M28 21v14" />
          </svg>
        </div>
        <h3>Нічого не знайдено</h3>
        <p>Спробуйте змінити запит або послабити фільтри.</p>
        {activeTags.length > 0 && (
          <button className="btn btn--secondary" onClick={clearAll}>Скинути фільтри</button>
        )}
      </li>
    );
  };

  const sortOptionEls = SORT_OPTIONS.map((option) => (
    <option key={option.value} value={option.value}>{option.label}</option>
  ));
  const currentSortShort = (SORT_OPTIONS.find((option) => option.value === sortBy) || SORT_OPTIONS[0]).short;

  // Єдиний інстанс поля пошуку: на десктопі живе в тулбарі, на мобільному —
  // у шапці (через portal). Рендериться лише в одному місці за раз.
  const searchEl = (
    <SearchBar
      onSearch={handleSearch}
      value={searchInput}
      placeholder="Пошук товарів"
      mobile
    />
  );

  // Компактні контроли каталогу, що вбудовуються в шапку на мобільному.
  const mobileHeaderControls = (
    <div className="catalog-header-controls" role="search" aria-label="Пошук і фільтри каталогу">
      <div className="che-search">{searchEl}</div>

      <div className="che-actions">
        <label className="che-sort-wrap">
          <svg
            className="che-sort-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m3 16 4 4 4-4" />
            <path d="M7 20V4" />
            <path d="m21 8-4-4-4 4" />
            <path d="M17 4v16" />
          </svg>
          <span className="che-sort-current">{currentSortShort}</span>
          <select
            className="che-sort"
            value={sortBy}
            onChange={handleSortChange}
            aria-label="Сортування"
          >
            {sortOptionEls}
          </select>
        </label>

        <button
          type="button"
          className="che-filters"
          onClick={toggleFiltersVisibility}
          aria-expanded={isFiltersVisible}
          aria-controls="filtersDrawer"
          aria-label={activeFiltersCount > 0 ? `Фільтри, активних: ${activeFiltersCount}` : 'Фільтри'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <line x1="21" y1="4" x2="14" y2="4" />
            <line x1="10" y1="4" x2="3" y2="4" />
            <line x1="21" y1="12" x2="12" y2="12" />
            <line x1="8" y1="12" x2="3" y2="12" />
            <line x1="21" y1="20" x2="16" y2="20" />
            <line x1="12" y1="20" x2="3" y2="20" />
            <line x1="14" y1="2" x2="14" y2="6" />
            <line x1="8" y1="10" x2="8" y2="14" />
            <line x1="16" y1="18" x2="16" y2="22" />
          </svg>
          {activeFiltersCount > 0 && (
            <span className="che-badge" aria-hidden="true">{activeFiltersCount}</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="catalog-page">
      {isFiltersVisible && <div className="filters-overlay visible" onClick={toggleFiltersVisibility} aria-hidden="true" />}

      {isMobile && headerSlot && createPortal(mobileHeaderControls, headerSlot)}

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
            {activeTags.map((tag, index) => (
              <span key={`${tag.type}-${tag.id || index}`} className="filter-tag">
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

          <div className="filter-group">
            <h3>Категорії</h3>

            <input
              className="input input--sm category-search"
              type="search"
              placeholder="Пошук у категоріях"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              aria-label="Пошук у категоріях"
            />

            {categoriesError ? (
              <p className="error">{categoriesError}</p>
            ) : null}

            <div
              id="categoryListTop"
              className={`category-list ${shouldCollapse ? 'is-collapsible' : ''} ${shouldCollapse && !catExpanded ? 'is-collapsed' : ''}`}
              ref={categoryListRef}
            >
              {filteredCategoryTree.map((category) => renderCategoryNode(category, 0))}
            </div>

            {shouldCollapse && (
              <div className="category-more">
                <button
                  ref={moreBtnRef}
                  className="btn btn--secondary category-more-btn"
                  onClick={onToggleMore}
                  aria-controls="categoryListTop"
                  aria-expanded={catExpanded}
                >
                  {catExpanded ? 'Згорнути' : `Більше категорій (${filteredCategoryTree.length - COLLAPSE_THRESHOLD})`}
                </button>
              </div>
            )}
          </div>

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
                  aria-invalid={priceRangeInvalid || undefined}
                  aria-label="Мінімальна ціна"
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
                  aria-invalid={priceRangeInvalid || undefined}
                  aria-label="Максимальна ціна"
                />
              </div>

              {priceRangeInvalid && (
                <p className="price-hint" role="alert">«Від» більше за «до» — звузьте діапазон.</p>
              )}

              <div className="price-presets" aria-label="Швидкі діапазони цін">
                {PRICE_PRESETS.map((preset) => {
                  const active = minPrice === preset.min && maxPrice === preset.max;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={active ? 'is-active' : ''}
                      aria-pressed={active}
                      onClick={() => { setMinPrice(preset.min); setMaxPrice(preset.max); }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="filter-group">
            <h3>Матеріал</h3>
            <select value={material} onChange={handleMaterialChange} aria-label="Фільтр за матеріалом">
              <option value="">— будь-який —</option>
              {MATERIAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <h3>Франшиза</h3>
            <input
              className="input"
              type="search"
              placeholder="Напр., One Piece, Naruto, Genshin…"
              value={franchise}
              onChange={(event) => setFranchise(event.target.value)}
              aria-label="Фільтр за франшизою"
            />
          </div>

          <div className="filter-group">
            <h3>Масштаб</h3>
            <select value={scale} onChange={(event) => setScale(event.target.value)} aria-label="Фільтр за масштабом">
              <option value="">— будь-який —</option>
              {SCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <h3>Фініш</h3>
            <select value={finish} onChange={(event) => setFinish(event.target.value)} aria-label="Фільтр за фінішем">
              <option value="">— будь-який —</option>
              {FINISH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button className="btn btn--secondary" onClick={clearAll}>Скинути фільтри</button>
          </div>

          {isMobile && (
            <div className="filters-footer">
              <button className="btn btn--secondary" onClick={clearAll}>Скинути</button>
              <button className="btn btn--primary" onClick={toggleFiltersVisibility}>
                Показати {uaNumber(total)}
              </button>
            </div>
          )}
        </aside>

        <main className="product-grid">
          {!isMobile && (
          <div className="catalog-toolbar" role="region" aria-label="Панель каталогу">
            <div className="toolbar-left">
              {searchEl}
            </div>

            <div className="toolbar-right">
              <select className="sort-by" value={sortBy} onChange={handleSortChange} aria-label="Сортування">
                {sortOptionEls}
              </select>

              <span className="products-count inline" aria-live="polite">
                {`Знайдено: ${uaNumber(total)}`}
                {totalPages > 1 ? ` • Сторінка ${page} з ${uaNumber(totalPages)}` : ''}
              </span>
            </div>
          </div>
          )}

          {error && displayProducts.length > 0 ? (
            <div className="catalog-inline-error" aria-live="assertive">
              <p className="error">Помилка: {error}</p>
            </div>
          ) : null}

          <ul className="products-list-grid">
            {renderContent()}

            {isLoading && displayProducts.length > 0 && (
              <li className="list-loading-more" aria-live="polite">
                <p>Завантаження сторінки…</p>
              </li>
            )}
          </ul>

          {!error && displayProducts.length > 0 && totalPages > 1 && (
            <nav
              className="catalog-pagination"
              aria-label="Посторінкова навігація"
            >
              <button
                className="btn btn--secondary pagination-nav-btn"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                ← Назад
              </button>

              <div className="pagination-pages">
                {paginationItems.map((item, index) => (
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      className={`btn pagination-page-btn ${item === page ? 'btn--primary is-active' : 'btn--secondary'}`}
                      onClick={() => handlePageChange(item)}
                      aria-current={item === page ? 'page' : undefined}
                      disabled={item === page}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={`${item}-${index}`}
                      className="pagination-ellipsis"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  )
                ))}
              </div>

              <button
                className="btn btn--secondary pagination-nav-btn"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Далі →
              </button>
            </nav>
          )}
        </main>
      </div>
    </div>
  );
};

export default CatalogPage;