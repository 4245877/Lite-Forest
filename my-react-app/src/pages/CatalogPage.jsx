import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import './CatalogPage.css';

const staticCategories = [
    '3D принтеры',
    '3D сканеры',
    'ЧПУ станки',
    'Расходные материалы',
    'Аксессуары',
    'Программное обеспечение',
    'Запчасти',
];

const CatalogPage = () => {
    // --- Состояния компонента ---
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalProducts, setTotalProducts] = useState(0);
    
    // Состояния для фильтров
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [sortBy, setSortBy] = useState('popular');
    const [isFiltersVisible, setIsFiltersVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Состояния для пагинации
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [totalPages, setTotalPages] = useState(1);

    // --- Логика получения данных с бэкенда ---
    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            setError(null);
            
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (selectedCategories.length > 0) params.append('categories', selectedCategories.join(','));
            if (minPrice) params.append('minPrice', minPrice);
            if (maxPrice) params.append('maxPrice', maxPrice);
            if (sortBy) params.append('sortBy', sortBy);
            params.append('page', currentPage);
            params.append('limit', itemsPerPage);

            try {
                const response = await fetch(`/api/products?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('Сетевой ответ был не в порядке');
                }
                const data = await response.json();
                setProducts(data.products || data);
                setTotalProducts(data.total || data.length);
                setTotalPages(Math.ceil((data.total || data.length) / itemsPerPage));
            } catch (err) {
                setError(err.message);
                console.error("Ошибка при получении товаров:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, [searchQuery, selectedCategories, minPrice, maxPrice, sortBy, currentPage, itemsPerPage]); 

    // --- Обработчики событий ---
    const handleCategoryChange = (category) => {
        setSelectedCategories(prev =>
            prev.includes(category)
            ? prev.filter(c => c !== category)
            : [...prev, category]
        );
        setCurrentPage(1); // Сброс на первую страницу при изменении фильтров
    };

    const handleMinPriceChange = (event) => {
        setMinPrice(event.target.value);
        setCurrentPage(1);
    };

    const handleMaxPriceChange = (event) => {
        setMaxPrice(event.target.value);
        setCurrentPage(1);
    };
    
    const handleSortChange = (event) => {
        setSortBy(event.target.value);
        setCurrentPage(1);
    };

    const handleSearchChange = (query) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };

    const toggleFiltersVisibility = () => setIsFiltersVisible(!isFiltersVisible);

    const clearAllFilters = () => {
        setSelectedCategories([]);
        setMinPrice('');
        setMaxPrice('');
        setSortBy('popular');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const handlePageChange = (page) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Компонент-обертка для подсветки ---
    const ProductCardWithHighlight = useCallback(({ product, query }) => {
        const highlightedName = useMemo(() => highlightMatch(product.name, query), [product.name, query]);
        const productForCard = { 
            ...product, 
            name: highlightedName, 
            price: product.base_price,
            image: product.media?.find(m => m.media_type === 'image')?.url || 'https://placehold.co/300x300'
        };
        return <ProductCard product={productForCard} />;
    }, []);

    // --- Генерация номеров страниц для пагинации ---
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }
        
        return pages;
    };

    // --- Рендеринг контента ---
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Загружаем товары...</p>
                </div>
            );
        }
        
        if (error) {
            return (
                <div className="error-container">
                    <p>⚠️ Ошибка загрузки: {error}</p>
                    <button className="retry-button" onClick={() => window.location.reload()}>
                        Попробовать снова
                    </button>
                </div>
            );
        }
        
        if (products.length > 0) {
            return products.map(product => (
                <ProductCardWithHighlight key={product.id} product={product} query={searchQuery} />
            ));
        }
        
        return (
            <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>По вашему запросу ничего не найдено</h3>
                <p>Попробуйте изменить параметры поиска или фильтры</p>
                <button className="clear-filters-button" onClick={clearAllFilters}>
                    Сбросить все фильтры
                </button>
            </div>
        );
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pageNumbers = getPageNumbers();

        return (
            <div className="pagination">
                <button 
                    className="pagination-arrow" 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    ←
                </button>
                
                <div className="page-numbers">
                    {pageNumbers.map((page, index) => (
                        page === '...' ? (
                            <span key={index} className="page-ellipsis">...</span>
                        ) : (
                            <button
                                key={page}
                                className={`page-number ${currentPage === page ? 'active' : ''}`}
                                onClick={() => handlePageChange(page)}
                            >
                                {page}
                            </button>
                        )
                    ))}
                </div>
                
                <button 
                    className="pagination-arrow" 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    →
                </button>
            </div>
        );
    };

    return (
        <>
            <title>Каталог товаров - DRUKARNYA</title>
            {isFiltersVisible && <div className="filters-overlay" onClick={toggleFiltersVisibility}></div>}
            
            <div className="catalog-page">
                <div className="catalog-header">
                    <div>
                        <h1>Каталог товаров</h1>
                    </div>
                    <button 
                        className="mobile-filters-toggle" 
                        onClick={toggleFiltersVisibility}
                        aria-label="Открыть фильтры"
                    >
                        <span className="filter-icon">⚙️</span>
                        Фильтры
                    </button>
                </div>
                
                <SearchBar onSearch={handleSearchChange} allProducts={[]} />

                <div className="catalog-content">
                    <aside className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`}>
                        <div className="filters-header">
                            <h2>Фильтры</h2>
                            <button 
                                className="close-filters" 
                                onClick={toggleFiltersVisibility}
                                aria-label="Закрыть фильтры"
                            >
                                ×
                            </button>
                        </div>

                        {/* Активные фильтры */}
                        {(selectedCategories.length > 0 || minPrice || maxPrice || searchQuery) && (
                            <div className="active-filters">
                                <div className="active-filters-header">
                                    <h4>Активные фильтры</h4>
                                    <button className="clear-all" onClick={clearAllFilters}>
                                        Очистить все
                                    </button>
                                </div>
                                <div className="filter-tags">
                                    {selectedCategories.map(category => (
                                        <span key={category} className="filter-tag">
                                            {category}
                                            <button onClick={() => handleCategoryChange(category)}>×</button>
                                        </span>
                                    ))}
                                    {minPrice && (
                                        <span className="filter-tag">
                                            от {minPrice} ₴
                                            <button onClick={() => setMinPrice('')}>×</button>
                                        </span>
                                    )}
                                    {maxPrice && (
                                        <span className="filter-tag">
                                            до {maxPrice} ₴
                                            <button onClick={() => setMaxPrice('')}>×</button>
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Фильтр по категориям */}
                        <div className="filter-group">
                            <h3>Категории</h3>
                            <div className="category-list">
                                {staticCategories.map(category => (
                                    <label key={category} className="category-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(category)}
                                            onChange={() => handleCategoryChange(category)}
                                        />
                                        <div className="custom-checkbox"></div>
                                        <span>{category}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Фильтр по цене */}
                        <div className="filter-group">
                            <h3>Цена, ₴</h3>
                            <div className="price-filter">
                                <div className="price-inputs">
                                    <input 
                                        type="number" 
                                        placeholder="от" 
                                        value={minPrice}
                                        onChange={handleMinPriceChange}
                                        className="price-input"
                                        min="0"
                                    />
                                    <span className="price-separator">—</span>
                                    <input 
                                        type="number" 
                                        placeholder="до" 
                                        value={maxPrice}
                                        onChange={handleMaxPriceChange}
                                        className="price-input"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </aside>

                    <main className="product-grid">
                        <div className="products-header">
                            <div className="products-info">
                                <span className="products-count">
                                    {isLoading ? 'Загрузка...' : `Найдено товаров: ${totalProducts}`}
                                </span>
                                {totalPages > 1 && (
                                    <span className="page-info">
                                        Страница {currentPage} из {totalPages}
                                    </span>
                                )}
                            </div>
                            <div className="products-controls">
                                <select className="sort-by" value={sortBy} onChange={handleSortChange}>
                                    <option value="popular">Сначала популярные</option>
                                    <option value="new">Сначала новые</option>
                                    <option value="price_asc">Сначала дешевые</option>
                                    <option value="price_desc">Сначала дорогие</option>
                                    <option value="name_asc">По алфавиту (А-Я)</option>
                                    <option value="name_desc">По алфавиту (Я-А)</option>
                                </select>
                            </div>
                        </div>

                        <div className="products-grid">
                            {renderContent()}
                        </div>

                        {renderPagination()}
                    </main>
                </div>
            </div>
        </>
    );
};

export default CatalogPage;