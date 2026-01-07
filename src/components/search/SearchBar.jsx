import React, { useState, useCallback, useRef, useEffect, useId, useMemo } from 'react';
import { debounce, getSuggestions, highlightMatch } from '../../utils/searchUtils';
import styles from './SearchBar.module.css';

const MIN_LENGTH = 2;
const RECENT_KEY = 'searchbar_recent_queries';
const RECENT_LIMIT = 5;

// Иконки
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const ClearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9"></circle>
    <path d="M12 7v5l3 2"></path>
  </svg>
);

const ShowAllIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 12h18M3 6h18M3 18h18"></path>
  </svg>
);

const SearchBar = ({ onSearch, allProducts, autoFocus = false, placeholder = "Поиск товаров…" }) => {
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const itemsRef = useRef([]);
  const listboxId = useId();
  const labelId = useId();
  const liveId = useId();

  // мягкое появление
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // recent init
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(saved)) setRecent(saved);
    } catch {}
  }, []);

  const saveRecent = useCallback((q) => {
    if (!q) return;
    setRecent((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, RECENT_LIMIT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Debounced подсказки
  const debouncedGetSuggestions = useCallback(
    debounce((currentQuery) => {
      const text = currentQuery.trim();
      if (text.length >= MIN_LENGTH) {
        const results = getSuggestions(allProducts, text);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
      setIsLoading(false);
      setIsOpen(true);
    }, 300),
    [allProducts]
  );

  const hasTypedEnough = query.trim().length >= MIN_LENGTH;

  const showRecent = useMemo(() => {
    return !hasTypedEnough && recent.length > 0 && isOpen && !isLoading;
  }, [hasTypedEnough, recent.length, isOpen, isLoading]);

  // количество видимых пунктов для клавиатуры
  const visibleItemsCount = useMemo(() => {
    const base = hasTypedEnough ? suggestions.length : showRecent ? recent.length : 0;
    const addShowAll = query.trim().length > 0 ? 1 : 0;
    return base + addShowAll;
  }, [hasTypedEnough, suggestions.length, recent.length, showRecent, query]);

  const handleChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsLoading(true);
    debouncedGetSuggestions(newQuery);
    setActiveIndex(-1);
    setIsOpen(true);
  };

  const commitSearch = (q) => {
    const finalQ = (q ?? query).trim();
    setQuery(finalQ);
    setIsOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    onSearch(finalQ);
    if (finalQ) saveRecent(finalQ);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setActiveIndex(-1);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  // клик вне — закрыть список
  useEffect(() => {
    const onDocClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // клавиатура на input
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && (suggestions.length || showRecent)) setIsOpen(true);
      if (e.key === 'Enter') commitSearch(query);
      return;
    }

    const total = visibleItemsCount;
    if (total === 0 && !showRecent) {
      if (e.key === 'Enter') commitSearch(query);
      return;
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) {
      e.preventDefault();
    }

    const step = 5;

    if (e.key === 'ArrowDown') {
      setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    } else if (e.key === 'Home') {
      setActiveIndex(0);
    } else if (e.key === 'End') {
      setActiveIndex(total - 1);
    } else if (e.key === 'PageDown') {
      setActiveIndex((prev) => Math.min(total - 1, (prev < 0 ? 0 : prev) + step));
    } else if (e.key === 'PageUp') {
      setActiveIndex((prev) => Math.max(0, (prev < 0 ? 0 : prev) - step));
    } else if (e.key === 'Enter') {
      if (activeIndex > -1) {
        const hasShowAll = query.trim().length > 0;
        // индекс "Показать все" — последний
        const isShowAll = activeIndex === total - 1 && hasShowAll;
        if (isShowAll) {
          commitSearch(query);
        } else if (hasTypedEnough && suggestions[activeIndex]) {
          commitSearch(suggestions[activeIndex].name);
        } else if (showRecent && recent[activeIndex]) {
          commitSearch(recent[activeIndex]);
        }
      } else {
        commitSearch(query);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  // автоскролл активного
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = itemsRef.current[activeIndex];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // корректный aria-activedescendant
  const activeDescendant = useMemo(() => {
    if (activeIndex < 0) return undefined;
    const qHas = query.trim().length > 0;
    if (hasTypedEnough) {
      const showAllExists = qHas;
      if (showAllExists && activeIndex === suggestions.length) return 'showall';
      return `suggestion-${activeIndex}`;
    }
    // recent
    if (showRecent) {
      const base = activeIndex;
      const hasShowAll = qHas;
      if (hasShowAll && base === recent.length) return 'showall';
      return `recent-${base}`;
    }
    return undefined;
  }, [activeIndex, hasTypedEnough, suggestions.length, recent.length, showRecent, query]);

  // очистка refs перед отрисовкой списка
  itemsRef.current = [];

  const renderSuggestion = (s, index) => {
    const id = `suggestion-${index}`;
    return (
      <li
        key={s.id ?? s.sku ?? `${s.name}-${index}`}
        id={id}
        ref={(el) => (itemsRef.current[index] = el)}
        className={`${styles.suggestionItem} ${index === activeIndex ? styles.active : ''}`}
        role="option"
        aria-selected={index === activeIndex}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commitSearch(s.name)}
      >
        {s.image && <img src={s.image} alt="" className={styles.thumb} loading="lazy" />}
        <div className={styles.itemText}>
          <div className={styles.itemTitle}>{highlightMatch(s.name, query)}</div>
          {s.price != null && <div className={styles.itemMeta}>{s.price}</div>}
        </div>
      </li>
    );
  };

  const renderRecent = (text, index) => {
    const id = `recent-${index}`;
    return (
      <li
        key={text}
        id={id}
        ref={(el) => (itemsRef.current[index] = el)}
        className={`${styles.suggestionItem} ${styles.recentItem} ${index === activeIndex ? styles.active : ''}`}
        role="option"
        aria-selected={index === activeIndex}
        onMouseEnter={() => setActiveIndex(index)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => commitSearch(text)}
      >
        <span className={styles.leadingIcon}><ClockIcon /></span>
        <div className={styles.itemText}>
          <div className={styles.itemTitle}>{text}</div>
        </div>
      </li>
    );
  };

  const showList = isOpen && (hasTypedEnough ? suggestions.length > 0 || query.trim().length > 0 : showRecent);

  return (
    <div
      className={`${styles.searchContainer} ${mounted ? styles.enter : ''}`}
      ref={searchContainerRef}
    >
      <div id={labelId} className={styles.visuallyHidden}>Поиск товаров</div>

      <div className={styles.searchIcon}><SearchIcon /></div>

      <input
        ref={inputRef}
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
      />

      {!isLoading && query && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={handleClear}
          aria-label="Очистить поиск"
        >
          <ClearIcon />
        </button>
      )}

      {isLoading && <div className={styles.loader} aria-hidden="true"></div>}

      <div id={liveId} className={styles.visuallyHidden} aria-live="polite">
        {hasTypedEnough ? `Подсказок: ${suggestions.length}` : showRecent ? `Недавние запросы: ${recent.length}` : ''}
      </div>

      {showList && (
        <div className={styles.popover} role="region" aria-label="Подсказки поиска">
          {(hasTypedEnough && suggestions.length > 0) && (
            <div className={styles.headerRow}>
              <span className={styles.headerText}>Найдено: {suggestions.length}</span>
            </div>
          )}

          <ul id={listboxId} className={styles.suggestionsList} role="listbox">
            {hasTypedEnough
              ? suggestions.map((s, idx) => renderSuggestion(s, idx))
              : recent.map((r, idx) => renderRecent(r, idx))
            }

            {query.trim().length > 0 && (
              <li
                id="showall"
                ref={(el) => (itemsRef.current[visibleItemsCount - 1] = el)}
                className={`${styles.suggestionItem} ${styles.showAll} ${activeIndex === visibleItemsCount - 1 ? styles.active : ''}`}
                role="option"
                aria-selected={activeIndex === visibleItemsCount - 1}
                onMouseEnter={() => setActiveIndex(visibleItemsCount - 1)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitSearch(query)}
              >
                <span className={styles.leadingIcon}><ShowAllIcon /></span>
                Показать все результаты для «{query.trim()}»
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
