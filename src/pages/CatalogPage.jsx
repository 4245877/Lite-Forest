import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
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

  const raw = String(attrs.availability ?? product?.availability ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('_', '-');

  if (
    raw === 'unavailable' ||
    raw === 'disabled' ||
    raw === 'archived' ||
    raw === 'out-of-stock'
  ) {
    return 'out-of-stock';
  }

  if (raw === 'in-stock') {
    return 'in-stock';
  }

  return 'made-to-order';
}

function getAvailabilityLabel(product, availabilityState) {
  const attrs = product?.attributes ?? {};
  const leadDays = Number(attrs.lead_time_days ?? product?.lead_time_days ?? 0);

  if (availabilityState === 'in-stock') return 'Є в наявності';
  if (availabilityState === 'made-to-order') {
    return leadDays > 0 ? `Під замовлення • ${leadDays} дн.` : 'Під замовлення';
  }
  return 'Тимчасово недоступно';
}

function getAttributeBadges(product) {
  const attrs = product?.attributes ?? {};
  const badges = [];

  const materials = normalizeTextList(attrs.materials);
  const printType = attrs.print_type || attrs.printTech || '';
  const finish = attrs.finish || '';
  const scale = attrs.scale || '';

  if (materials.length) badges.push(materials.slice(0, 2).join(', '));
  if (printType) badges.push(String(printType).toUpperCase());
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
    availabilityLabel: getAvailabilityLabel(product, availabilityState),
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
      categoryLabel={product.primaryCategoryLabel}
      availabilityLabel={product.availabilityLabel}
      availabilityState={product.availabilityState}
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
    try {
      return JSON.parse(localStorage.getItem('lf.openCats') || '{}');
    } catch {
      return {};
    }
  });
  const [isMobile, setIsMobile] = useState(false);

  const [catExpanded, setCatExpanded] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lf.catExpanded') || 'false');
    } catch {
      return false;
    }
  });
  const [shouldCollapse, setShouldCollapse] = useState(false);
  const [collapsedMaxHeight, setCollapsedMaxHeight] = useState(0);

  const debounceTimer = useRef(null);

  const categoryListRef = useRef(null);
  const moreBtnRef = useRef(null);

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

  const displayProducts = useMemo(
    () => dedupeProducts(products).map((product) => adaptProduct(product, categoriesById)),
    [products, categoriesById],
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    count += selectedCatsForQuery.length;
    if (minPrice) count += 1;
    if (maxPrice) count += 1;
    if (material) count += 1;
    if (printTech) count += 1;
    if (franchise) count += 1;
    if (scale) count += 1;
    if (finish) count += 1;
    if (searchQuery) count += 1;
    return count;
  }, [selectedCatsForQuery, minPrice, maxPrice, material, printTech, franchise, scale, finish, searchQuery]);

  const filtersSignature = useMemo(() => JSON.stringify({
    q: searchQuery,
    cats: selectedCatsForQuery,
    minPrice,
    maxPrice,
    material,
    printTech,
    sortBy,
    franchise,
    scale,
    finish,
  }), [
    searchQuery,
    selectedCatsForQuery,
    minPrice,
    maxPrice,
    material,
    printTech,
    sortBy,
    franchise,
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

    if (minPrice) tags.push({ type: 'minPrice', label: `від ₴${uaNumber(Number(minPrice))}` });
    if (maxPrice) tags.push({ type: 'maxPrice', label: `до ₴${uaNumber(Number(maxPrice))}` });
    if (material) tags.push({ type: 'material', label: `Матеріал: ${material}` });
    if (printTech) tags.push({ type: 'printTech', label: `Технологія: ${printTech}` });
    if (franchise) tags.push({ type: 'franchise', label: `Франшиза: ${franchise}` });
    if (scale) tags.push({ type: 'scale', label: `Масштаб: ${scale}` });
    if (finish) {
      tags.push({
        type: 'finish',
        label:
          finish === 'painted'
            ? 'Готові/пофарбовані'
            : finish === 'kit'
              ? 'Набір для фарбування'
              : finish === 'stl'
                ? 'STL-файл'
                : `Фініш: ${finish}`,
      });
    }
    if (searchQuery) tags.push({ type: 'search', label: `Пошук: "${searchQuery}"` });

    return tags;
  }, [selectedCatsForQuery, categoriesById, minPrice, maxPrice, material, printTech, franchise, scale, finish, searchQuery]);

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
      case 'printTech':
        setPrintTech('');
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
    if (minPrice) nextParams.set('min', minPrice);
    if (maxPrice) nextParams.set('max', maxPrice);
    if (material) nextParams.set('mat', material);
    if (printTech) nextParams.set('tech', printTech);
    if (franchise) nextParams.set('franchise', franchise);
    if (scale) nextParams.set('scale', scale);
    if (finish) nextParams.set('finish', finish);
    if (sortBy && sortBy !== 'popular') nextParams.set('sort', sortBy);
    if (page > 1) nextParams.set('page', String(page));

    const current = searchParams.toString();
    const next = nextParams.toString();

    if (current !== next) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchQuery, selectedCategories, minPrice, maxPrice, material, printTech, franchise, scale, finish, sortBy, page, searchParams, setSearchParams]);

  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    const urlCats = decodeList(searchParams.get('cats') || '').filter((value) => value !== 'all');
    const urlMin = searchParams.get('min') || '';
    const urlMax = searchParams.get('max') || '';
    const urlMaterial = searchParams.get('mat') || '';
    const urlTech = searchParams.get('tech') || '';
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
    if (urlTech !== printTech) setPrintTech(urlTech);
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
          minPrice,
          maxPrice,
          material,
          printTech,
          sortBy,
          franchise,
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
    minPrice,
    maxPrice,
    material,
    printTech,
    sortBy,
    franchise,
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

  const adjustCollapsedHeightFor = useCallback((categoryId, willOpen) => {
    if (!(shouldCollapse && !catExpanded) || !categoryListRef.current) return;

    const blocks = categoryListRef.current.querySelectorAll(':scope > .category-block');
    if (!blocks || blocks.length < 7) return;

    const firstRect = blocks[0].getBoundingClientRect();
    const seventhRect = blocks[6].getBoundingClientRect();
    let height = Math.ceil(seventhRect.bottom - firstRect.top);

    const index = Array.from(blocks).findIndex((block) => block.querySelector(`#children-${categoryId}`));
    if (index !== -1 && index <= 6) {
      const childContainer = categoryListRef.current.querySelector(`#children-${categoryId}`);
      if (childContainer) {
        const delta = childContainer.scrollHeight;
        height = willOpen ? height + delta : Math.max(height - delta, 0);
      }
    }

    setCollapsedMaxHeight(height);
  }, [shouldCollapse, catExpanded]);

  const toggleCat = useCallback((id) => {
    setOpenCats((prev) => {
      const willOpen = !prev[id];
      adjustCollapsedHeightFor(id, willOpen);
      return { ...prev, [id]: willOpen };
    });
  }, [adjustCollapsedHeightFor]);

  const handleMinPriceChange = (event) => setMinPrice(event.target.value);
  const handleMaxPriceChange = (event) => setMaxPrice(event.target.value);
  const handleMaterialChange = (event) => setMaterial(event.target.value);
  const handlePrintTechChange = (event) => setPrintTech(event.target.value);
  const handleSortChange = (event) => setSortBy(event.target.value);
  const toggleFiltersVisibility = () => setIsFiltersVisible((value) => !value);

  useEffect(() => {
    document.title = 'Каталог товарів - Lite Forest';
  }, []);

  const recomputeCollapsedHeight = useCallback(() => {
    if (!categoryListRef.current) {
      setCollapsedMaxHeight(0);
      setShouldCollapse(false);
      return;
    }

    if (categorySearch.trim()) {
      setShouldCollapse(false);
      setCollapsedMaxHeight(0);
      return;
    }

    const blocks = categoryListRef.current.querySelectorAll(':scope > .category-block');

    if (!blocks || blocks.length <= 7) {
      setShouldCollapse(false);
      setCollapsedMaxHeight(0);
      return;
    }

    const firstRect = blocks[0].getBoundingClientRect();
    const seventhRect = blocks[6].getBoundingClientRect();
    const height = Math.ceil(seventhRect.bottom - firstRect.top);

    setCollapsedMaxHeight(height);
    setShouldCollapse(true);
  }, [categorySearch]);

  useLayoutEffect(() => {
    recomputeCollapsedHeight();
  }, [filteredCategoryTree, recomputeCollapsedHeight]);

  useEffect(() => {
    if (!(shouldCollapse && !catExpanded)) return;

    let frame1;
    let frame2;

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => recomputeCollapsedHeight());
    });

    return () => {
      if (frame1) cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
    };
  }, [openCats, shouldCollapse, catExpanded, recomputeCollapsedHeight]);

  useEffect(() => {
    const onResize = () => recomputeCollapsedHeight();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [recomputeCollapsedHeight]);

  useEffect(() => {
    const onApplySearch = (event) => {
      const value = String(event.detail ?? '');
      setSearchInput(value);
      setSearchQuery(value);
    };

    window.addEventListener('lf:applySearch', onApplySearch);
    return () => window.removeEventListener('lf:applySearch', onApplySearch);
  }, []);

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
          <label
            className={`category-item ${depth > 0 ? 'child' : ''} ${selected ? 'selected' : ''}`}
            style={depth > 0 ? { paddingInlineStart: `${depth * 16}px` } : undefined}
          >
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
              <span className="disclosure-icon" aria-hidden="true">
                {open ? '▼' : '▶'}
              </span>
            </button>
          )}
        </div>

        {category.children?.length > 0 && (
          <div id={`children-${category.id}`} className={`category-children ${open ? 'open' : ''}`}>
            {category.children.map((child) => renderCategoryNode(child, depth + 1))}
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
        <div className="empty-icon" aria-hidden>🕵️‍♂️</div>
        <h3>Нічого не знайдено</h3>
        <p>Спробуйте змінити фільтри або скинути їх.</p>
      </li>
    );
  };

  const categoryListStyle = (shouldCollapse && !catExpanded)
    ? { overflow: 'hidden', maxHeight: `${collapsedMaxHeight}px`, transition: 'max-height 260ms ease' }
    : { transition: 'max-height 260ms ease' };

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

            <div id="categoryListTop" className="category-list" ref={categoryListRef} style={categoryListStyle}>
              {filteredCategoryTree.map((category) => renderCategoryNode(category, 0))}
            </div>

            {shouldCollapse && !categorySearch.trim() && (
              <div className="category-more">
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
                <button onClick={() => { setMinPrice('500'); setMaxPrice('1500'); }}>₴500–₴1 500</button>
                <button onClick={() => { setMinPrice('1500'); setMaxPrice('3000'); }}>₴1 500–₴3 000</button>
              </div>
            </div>
          </div>

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
            <select value={finish} onChange={(event) => setFinish(event.target.value)} aria-label="Фільтр за фінішем">
              <option value="">— будь-який —</option>
              <option value="painted">Готові/пофарбовані</option>
              <option value="kit">Набір для фарбування</option>
              <option value="stl">STL-файл</option>
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
          <div className="catalog-toolbar" role="region" aria-label="Панель каталогу">
            <div className="toolbar-left">
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
                Фільтри
                {activeFiltersCount > 0 && (
                  <span className="badge" aria-label={`Активні фільтри: ${activeFiltersCount}`}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <select className="sort-by" value={sortBy} onChange={handleSortChange} aria-label="Сортування">
                <option value="popular">Спочатку популярні</option>
                <option value="new">Спочатку нові</option>
                <option value="price_asc">Спершу дешеві</option>
                <option value="price_desc">Спочатку дорогі</option>
              </select>

              <span className="products-count inline" aria-live="polite">
                {`Знайдено: ${uaNumber(total)}`}
                {totalPages > 1 ? ` • Сторінка ${page} з ${uaNumber(totalPages)}` : ''}
              </span>
            </div>
          </div>

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