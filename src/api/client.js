// my-react-app/src/api/client.js

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || '';

export const api = {
  /**
   * listProducts(q, limit, filtersOrCursor, cursorOrOpts?, maybeOpts?)
   *
   * Обратная совместимость:
   *  - Старый вызов (cursor 3-м арг):     listProducts('q', 20, 'cursor123')
   *  - Старый вызов (cursor 4-м арг):     listProducts('q', 20, {filters}, 'cursor123')
   *  - Новый вызов (opts 4-м арг):        listProducts('q', 20, {filters}, { signal })
   *  - Новый вызов (cursor+opts):         listProducts('q', 20, {filters}, 'cursor123', { signal })
   */
  async listProducts(q = '', limit = 20, filtersOrCursor = {}, cursorOrOpts = '', maybeOpts = {}) {
    let filters = {};
    let cursor = '';
    let opts = {};

    // 3-й аргумент: либо cursor (старый стиль), либо filters (новый стиль)
    if (typeof filtersOrCursor === 'string') {
      cursor = filtersOrCursor;
    } else if (filtersOrCursor && typeof filtersOrCursor === 'object') {
      filters = filtersOrCursor;
    }

    // 4-й аргумент: либо cursor (старый стиль), либо fetch options (новый стиль)
    if (typeof cursorOrOpts === 'string') {
      cursor = cursorOrOpts || cursor;
      opts = (maybeOpts && typeof maybeOpts === 'object') ? maybeOpts : {};
    } else if (cursorOrOpts && typeof cursorOrOpts === 'object') {
      opts = cursorOrOpts;
    }

    const u = new URL(`${API_BASE}/api/products`);
    if (q) u.searchParams.set('q', q);
    if (limit) u.searchParams.set('limit', String(limit));
    if (cursor) u.searchParams.set('cursor', cursor);

    // --- ФИЛЬТРЫ ---
    const cats = Array.isArray(filters.categories) ? filters.categories.filter(Boolean) : [];
    if (cats.length) u.searchParams.set('categories', cats.join(',')); // decor,lighting,...

    if (filters.minPrice != null && filters.minPrice !== '')
      u.searchParams.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice != null && filters.maxPrice !== '')
      u.searchParams.set('maxPrice', String(filters.maxPrice));

    if (filters.material) u.searchParams.set('material', String(filters.material));
    if (filters.printTech) u.searchParams.set('printTech', String(filters.printTech));

    // popular | new | price_asc | price_desc
    if (filters.sortBy) u.searchParams.set('sort', String(filters.sortBy));

    // Доп. фасеты (если бэк их поддерживает — не мешают, если нет — просто игнор)
    if (filters.franchise) u.searchParams.set('franchise', String(filters.franchise));
    if (filters.scale) u.searchParams.set('scale', String(filters.scale));
    if (filters.finish) u.searchParams.set('finish', String(filters.finish));

    console.log('[api] GET', u.toString());

    const r = await fetch(u, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...(opts && opts.headers ? opts.headers : {}),
      },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      throw new Error(`HTTP ${r.status} ${r.statusText} for ${u}: ${txt}`);
    }
    return r.json();
  },

  async getProduct(id, opts = {}) {
    const u = new URL(`${API_BASE}/api/products/${encodeURIComponent(id)}`);
    console.log('[api] GET', u.toString());
    const r = await fetch(u, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...(opts && opts.headers ? opts.headers : {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      throw new Error(`HTTP ${r.status} ${r.statusText} for ${u}: ${txt}`);
    }
    return r.json();
  },

  async createProduct(payload, opts = {}) {
    const r = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
        ...(opts && opts.headers ? opts.headers : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async updateProduct(id, patch, opts = {}) {
    const r = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
        ...(opts && opts.headers ? opts.headers : {}),
      },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async deleteProduct(id, opts = {}) {
    const r = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      ...opts,
      headers: {
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
        ...(opts && opts.headers ? opts.headers : {}),
      },
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
  }
};
