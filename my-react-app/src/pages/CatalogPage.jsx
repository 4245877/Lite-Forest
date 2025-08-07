// my-react-app/src/pages/CatalogPage.jsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ProductCard from '../components/product/ProductCard';
import SearchBar from '../components/search/SearchBar';
import { highlightMatch } from '../utils/searchUtils';
import './CatalogPage.css';

// ✅ ИЗМЕНЕНИЕ: Обновляем список категорий на более подходящий для магазина "DRUKARNYA"
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
    
    // Состояния для фильтров
    const [selectedCategories, setSelectedCategories] = useState([]);
    
    // ✅ ИЗМЕНЕНИЕ: Заменяем `priceRange` на `minPrice` и `maxPrice`
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');

    const [sortBy, setSortBy] = useState('popular');
    const [isFiltersVisible, setIsFiltersVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Логика получения данных с бэкенда ---
    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            setError(null);
            
            // Собираем параметры для URL
            const params = new URLSearchParams();
            if (searchQuery) params.append('search', searchQuery);
            if (selectedCategories.length > 0) params.append('categories', selectedCategories.join(','));
            
            // ✅ ИЗМЕНЕНИЕ: Добавляем параметры minPrice и maxPrice в запрос
            if (minPrice) params.append('minPrice', minPrice);
            if (maxPrice) params.append('maxPrice', maxPrice);

            if (sortBy) params.append('sortBy', sortBy);

            try {
                // Делаем запрос к нашему API
                const response = await fetch(`/api/products?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('Сетевой ответ был не в порядке');
                }
                const data = await response.json();
                setProducts(data);
            } catch (err) {
                setError(err.message);
                console.error("Ошибка при получении товаров:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    // ✅ ИЗМЕНЕНИЕ: Эффект теперь перезапускается при изменении `minPrice` и `maxPrice`
    }, [searchQuery, selectedCategories, minPrice, maxPrice, sortBy]); 

    // --- Обработчики событий ---
    const handleCategoryChange = (category) => {
        setSelectedCategories(prev =>
            prev.includes(category)
            ? prev.filter(c => c !== category)
            : [...prev, category]
        );
    };

    // ✅ НОВОЕ: Обработчики для полей ввода цены
    const handleMinPriceChange = (event) => setMinPrice(event.target.value);
    const handleMaxPriceChange = (event) => setMaxPrice(event.target.value);
    
    const handleSortChange = (event) => setSortBy(event.target.value);
    const toggleFiltersVisibility = () => setIsFiltersVisible(!isFiltersVisible);
    
    // --- Компонент-обертка для подсветки (без изменений) ---
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

    // --- Рендеринг компонента ---
    const renderContent = () => {
        if (isLoading) {
            return <p>Загрузка товаров...</p>;
        }
        if (error) {
            return <p>Ошибка: {error}</p>;
        }
        if (products.length > 0) {
            return products.map(product => (
                <ProductCardWithHighlight key={product.id} product={product} query={searchQuery} />
            ));
        }
        return <p>По вашему запросу ничего не найдено.</p>;
    };

    return (
        <>
            <title>Каталог товаров - DRUKARNYA</title>
            {isFiltersVisible && <div className="filters-overlay" onClick={toggleFiltersVisibility}></div>}
            <div className="catalog-page">
                <div className="catalog-header">
                    <h1>Каталог</h1>
                    <button className="mobile-filters-toggle" onClick={toggleFiltersVisibility}>Фильтры</button>
                </div>
                
                <SearchBar onSearch={setSearchQuery} allProducts={[]} />

                <div className="catalog-content">
                    <aside className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`}>
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
                                        <span>{category}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* ✅ ИЗМЕНЕНИЕ: Новый блок фильтра по цене */}
                        <div className="filter-group">
                            <h3>Цена, ₴</h3>
                            <div className="price-filter">
                                <input 
                                    type="number" 
                                    placeholder="от" 
                                    value={minPrice}
                                    onChange={handleMinPriceChange}
                                    className="price-input"
                                />
                                <span className="price-separator">–</span>
                                <input 
                                    type="number" 
                                    placeholder="до" 
                                    value={maxPrice}
                                    onChange={handleMaxPriceChange}
                                    className="price-input"
                                />
                            </div>
                        </div>
                        {/* ... здесь могут быть другие фильтры в будущем ... */}
                    </aside>

                    <main className="product-grid">
                        <div className="products-header">
                            <span className="products-count">Найдено товаров: {products.length}</span>
                            <select className="sort-by" value={sortBy} onChange={handleSortChange}>
                                <option value="popular">Сначала популярные</option>
                                <option value="new">Сначала новые</option>
                                <option value="price_asc">Сначала дешевые</option>
                                <option value="price_desc">Сначала дорогие</option>
                            </select>
                        </div>

                        <div className="products-grid">
                            {renderContent()}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
};

export default CatalogPage;