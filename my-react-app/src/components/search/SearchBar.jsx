import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce, getSuggestions, highlightMatch } from '../../utils/searchUtils';
import styles from './SearchBar.module.css';

// Иконки (можно использовать библиотеку типа react-icons, но для простоты вставим SVG)
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);

const ClearIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
);


const SearchBar = ({ onSearch, allProducts }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const searchContainerRef = useRef(null);

  // Debounced функция для получения подсказок
  const debouncedGetSuggestions = useCallback(
    debounce((currentQuery) => {
      if (currentQuery.length >= 2) {
        const results = getSuggestions(allProducts, currentQuery);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
      setIsLoading(false);
    }, 300),
    [allProducts]
  );
  
  // Эффект для скрытия подсказок при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsLoading(true); // Показываем загрузку сразу
    debouncedGetSuggestions(newQuery);
  };
  
  const handleSearch = (searchQuery) => {
    setQuery(searchQuery);
    setSuggestions([]); // Скрываем подсказки
    onSearch(searchQuery); // Вызываем основную функцию поиска
  };

  const handleClear = () => {
    handleSearch(''); // Очищаем и выполняем "пустой" поиск
  };

  const handleKeyDown = (e) => {
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex !== -1) {
        handleSearch(suggestions[activeIndex].name);
      } else {
        handleSearch(query);
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  return (
    <div 
        className={styles.searchContainer} 
        ref={searchContainerRef}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-haspopup="listbox"
    >
      <div className={styles.searchIcon}>
        <SearchIcon />
      </div>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Поиск товаров..."
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        aria-controls="suggestions-list"
        aria-activedescendant={activeIndex > -1 ? `suggestion-${activeIndex}` : undefined}
      />
      {isLoading && <div className={styles.loader}></div>}
      {query && !isLoading && (
        <button className={styles.clearButton} onClick={handleClear} aria-label="Очистить поиск">
          <ClearIcon />
        </button>
      )}

      {suggestions.length > 0 && (
        <ul id="suggestions-list" className={styles.suggestionsList} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`suggestion-${index}`}
              className={`${styles.suggestionItem} ${index === activeIndex ? styles.active : ''}`}
              onClick={() => handleSearch(suggestion.name)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              aria-selected={index === activeIndex}
            >
              {highlightMatch(suggestion.name, suggestion.query)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBar;