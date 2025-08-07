import React, { useState, useEffect, useMemo } from 'react';
import ProductCard from '../components/product/ProductCard';
// Убедитесь, что пути правильные и файлы существуют
import SearchBar from '../components/search/SearchBar';
import { searchProducts, highlightMatch } from '../utils/searchUtils.jsx'; // Используем .jsx
import './CatalogPage.css';

// Тестовые данные с описаниями и тегами
const mockProducts = [
    { id: 1, name: 'Органайзер для мелочей', category: 'Для дома и быта', price: 99, isNew: true, popularity: 85, image: 'https://placehold.co/300x300/a2d2ff/ffffff?text=Органайзер', description: 'Удобный пластиковый органайзер для хранения мелких предметов: винтов, кнопок, бисера.', tags: ['хранение', 'пластик', 'коробка'] },
    { id: 2, name: 'Подставка под горячее "Соты"', category: 'Кухня', price: 150, isNew: false, popularity: 95, image: 'https://placehold.co/300x300/ffafcc/ffffff?text=Подставка', description: 'Стильная подставка в виде пчелиных сот защитит вашу столешницу. Можно соединять несколько штук.', tags: ['кухня', 'декор', 'соты'] },
    { id: 3, name: 'Подставка для телефона', category: 'Гаджеты и электроника', price: 120, isNew: true, popularity: 92, image: 'https://placehold.co/300x300/bde0fe/ffffff?text=Подставка', description: 'Эргономичная подставка для смартфона. Идеально для видеозвонков и просмотра видео.', tags: ['гаджет', 'телефон', 'стол'] },
    // ...остальные товары...
];

const categories = [
    'Для дома и быта', 'Кухня', 'Гаджеты и электроника', 'Гараж и инструменты', 'Хобби и игры', 'Офис',
];

const CatalogPage = () => {
    // --- Состояния компонента ---
    const [productsToDisplay, setProductsToDisplay] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [priceRange, setPriceRange] = useState('all');
    const [sortBy, setSortBy] = useState('popular');
    const [isFiltersVisible, setIsFiltersVisible] = useState(false);
    
    // ==========================================================
    // НОВОЕ: Состояние для хранения текста из поля поиска
    // ==========================================================
    const [searchQuery, setSearchQuery] = useState('');

    // --- Логика фильтрации, поиска и сортировки ---
    useEffect(() => {
        // ==========================================================
        // ШАГ 1: Поиск выполняется в первую очередь
        // ==========================================================
        let result = searchProducts(mockProducts, searchQuery);

        // ШАГ 2: Фильтрация по категориям
        if (selectedCategories.length > 0) {
            result = result.filter(product => selectedCategories.includes(product.category));
        }

        // ШАГ 3: Фильтрация по цене
        switch (priceRange) {
            case '0-100': result = result.filter(p => p.price <= 100); break;
            case '100-250': result = result.filter(p => p.price > 100 && p.price <= 250); break;
            case '250+': result = result.filter(p => p.price > 250); break;
            default: break;
        }

        // ==========================================================
        // ШАГ 4: Сортировка (только если нет поискового запроса, т.к. поиск уже сортирует по релевантности)
        // ==========================================================
        if (!searchQuery) {
            if (sortBy === 'popular') {
                result.sort((a, b) => b.popularity - a.popularity);
            } else if (sortBy === 'new') {
                result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
            }
        }
    
        setProductsToDisplay(result);
    // ==========================================================
    // Добавляем searchQuery в зависимости, чтобы эффект перезапускался при поиске
    // ==========================================================
    }, [searchQuery, selectedCategories, priceRange, sortBy]); 

    // --- Обработчики событий ---
    const handleCategoryChange = (category) => {
        setSelectedCategories(prev =>
            prev.includes(category)
            ? prev.filter(c => c !== category)
            : [...prev, category]
        );
    };
    const handlePriceChange = (event) => setPriceRange(event.target.value);
    const handleSortChange = (event) => setSortBy(event.target.value);
    const toggleFiltersVisibility = () => setIsFiltersVisible(!isFiltersVisible);
    
    // --- Компонент-обертка для подсветки текста в карточке товара ---
    const ProductCardWithHighlight = ({ product, query }) => {
        const highlightedName = useMemo(() => highlightMatch(product.name, query), [product.name, query]);
        const productWithHighlightedName = { ...product, name: highlightedName };
        return <ProductCard product={productWithHighlightedName} />;
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
                
                {/* ========================================================== */}
                {/* ВОТ ЗДЕСЬ МЫ ДОБАВЛЯЕМ ПОЛЕ ПОИСКА НА СТРАНИЦУ           */}
                {/* `onSearch` передает в SearchBar функцию `setSearchQuery` */}
                {/* `allProducts` нужен для генерации подсказок             */}
                {/* ========================================================== */}
                <SearchBar onSearch={setSearchQuery} allProducts={mockProducts} />

                <div className="catalog-content">
                    <aside className={`filters-panel ${isFiltersVisible ? 'visible' : ''}`}>
                       {/* ... код панели фильтров ... */}
                       <div className="filters-header">
                         <h2>Фильтры</h2>
                         <button className="close-filters" onClick={toggleFiltersVisibility}>&times;</button>
                       </div>
                       <div className="filter-group">
                         <h3>Категории</h3>
                         <div className="category-list">
                           {categories.map(category => (
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
                       <div className="filter-group">
                         <h3>Цена</h3>
                         <div className="category-list">
                           <label className="category-item"><input type="radio" name="price" value="all" checked={priceRange === 'all'} onChange={handlePriceChange} /><span>Все</span></label>
                           <label className="category-item"><input type="radio" name="price" value="0-100" checked={priceRange === '0-100'} onChange={handlePriceChange} /><span>до 100 грн</span></label>
                           <label className="category-item"><input type="radio" name="price" value="100-250" checked={priceRange === '100-250'} onChange={handlePriceChange} /><span>100–250 грн</span></label>
                           <label className="category-item"><input type="radio" name="price" value="250+" checked={priceRange === '250+'} onChange={handlePriceChange} /><span>250 грн и выше</span></label>
                         </div>
                       </div>
                    </aside>

                    <main className="product-grid">
                        <div className="products-header">
                            <span className="products-count">Найдено товаров: {productsToDisplay.length}</span>
                            {/* Прячем сортировку при поиске */}
                            {!searchQuery && (
                                <select className="sort-by" value={sortBy} onChange={handleSortChange}>
                                    <option value="popular">Сначала популярные</option>
                                    <option value="new">Сначала новые</option>
                                </select>
                            )}
                        </div>

                        <div className="products-grid">
                            {productsToDisplay.length > 0 ? (
                                productsToDisplay.map(product => (
                                    // Используем обертку для подсветки
                                    <ProductCardWithHighlight key={product.id} product={product} query={searchQuery} />
                                ))
                            ) : (
                                <p>По вашему запросу ничего не найдено.</p>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
};

export default CatalogPage; 