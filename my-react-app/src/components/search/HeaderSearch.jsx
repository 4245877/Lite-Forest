import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { api } from '../../api/client';

const normalizeProducts = (data) => {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

const mapForSuggestions = (list) =>
  list.map((p, i) => {
    const image =
      p.image_url ??
      p.image ??
      p.media?.find?.((m) => m.media_type === 'image')?.url ??
      'https://placehold.co/80x80';
    const priceRaw = typeof p.price === 'number' ? p.price : Number(p.price ?? p.base_price ?? 0);
    return {
      id: p.id ?? p._id ?? p.sku ?? p.slug ?? `item-${i}`,
      name: p.name ?? '',
      image,
      price: Number.isFinite(priceRaw) ? priceRaw : undefined,
    };
  });

export default function HeaderSearch({ onClose, autoFocus = false }) {
  const [allProducts, setAllProducts] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Подтянуть небольшой индекс товаров для подсказок
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.listProducts('', 300, {}); // легкий индекс для автокомплита
        if (!alive) return;
        setAllProducts(mapForSuggestions(normalizeProducts(data)));
      } catch (e) {
        // тихо падаем, поиск всё равно сработает по Enter
        console.warn('HeaderSearch preload failed:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const commit = (q) => {
    const query = String(q || '').trim();

    // Если уже на /catalog — обновляем состояние каталога сразу + URL
    if (location.pathname === '/catalog') {
      window.dispatchEvent(new CustomEvent('lf:applySearch', { detail: query }));
      const usp = new URLSearchParams(location.search);
      if (query) usp.set('q', query);
      else usp.delete('q');
      navigate({ pathname: '/catalog', search: `?${usp.toString()}` }, { replace: true });
    } else {
      navigate(`/catalog?q=${encodeURIComponent(query)}`);
    }

    onClose?.();
  };

  return (
    <SearchBar
      onSearch={commit}
      allProducts={allProducts}
      autoFocus={autoFocus}
    />
  );
}
