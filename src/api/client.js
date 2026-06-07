const RAW_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ??
  import.meta.env.VITE_API_BASE ??
  '';

function normalizeOrigin(value) {
  const s = String(value || '').trim();
  if (!s || s === '/') return '';
  return s.replace(/\/+$/, '');
}

export const API_ORIGIN = normalizeOrigin(RAW_ORIGIN);
export const API_PREFIX = '/api';
export const API_BASE = API_ORIGIN;

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || '';

function makeUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${API_PREFIX}${normalizedPath}`;
}

function headersToObject(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  return headers;
}

async function readErrorBody(response) {
  try {
    const text = await response.text();
    return text || '<no body>';
  } catch {
    return '<no body>';
  }
}

async function fetchJson(url, init = {}, { allowNoContent = false } = {}) {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
  });

  if (allowNoContent && response.status === 204) return null;

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${body}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeListFilter(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (value == null || value === '') return [];
  return [String(value).trim()].filter(Boolean);
}

export const api = {
  async getCategories(opts = {}) {
    const url = makeUrl('/meta/categories');
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async listProducts(q = '', limit = 20, filtersOrCursor = {}, cursorOrOpts = '', maybeOpts = {}) {
    let filters = {};
    let cursor = '';
    let opts = {};

    if (typeof filtersOrCursor === 'string') {
      cursor = filtersOrCursor;
    } else if (filtersOrCursor && typeof filtersOrCursor === 'object') {
      filters = filtersOrCursor;
      if (filters.cursor != null && filters.cursor !== '') {
        cursor = String(filters.cursor);
      }
    }

    if (typeof cursorOrOpts === 'string') {
      cursor = cursorOrOpts || cursor;
      opts = maybeOpts && typeof maybeOpts === 'object' ? maybeOpts : {};
    } else if (cursorOrOpts && typeof cursorOrOpts === 'object') {
      opts = cursorOrOpts;
    }

    const qs = new URLSearchParams();
    const page =
      filters.page != null && filters.page !== ''
        ? String(filters.page)
        : '';

    if (q) qs.set('q', q);
    if (limit) qs.set('limit', String(limit));
    if (page) qs.set('page', page);
    else if (cursor) qs.set('cursor', cursor);

    const categories = normalizeListFilter(filters.categories);
    if (categories.length) qs.set('categories', categories.join(','));

    const materials = normalizeListFilter(filters.material);
    if (materials.length) qs.set('material', materials.join(','));

    if (filters.minPrice != null && filters.minPrice !== '') qs.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice != null && filters.maxPrice !== '') qs.set('maxPrice', String(filters.maxPrice));

    if (filters.printTech) qs.set('printTech', String(filters.printTech));
    if (filters.sortBy) qs.set('sort', String(filters.sortBy));
    if (filters.franchise) qs.set('franchise', String(filters.franchise));
    if (filters.scale) qs.set('scale', String(filters.scale));
    if (filters.finish) qs.set('finish', String(filters.finish));

    const baseUrl = makeUrl('/products');
    const url = qs.toString() ? `${baseUrl}?${qs.toString()}` : baseUrl;

    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async getProduct(id, opts = {}) {
    const url = makeUrl(`/products/${encodeURIComponent(id)}`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async reportProduct(productId, payload, opts = {}) {
    const url = makeUrl(`/products/${encodeURIComponent(productId)}/reports`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });
  },

  async createProduct(payload, opts = {}) {
    const url = makeUrl('/products');
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(id, patch, opts = {}) {
    const url = makeUrl(`/products/${encodeURIComponent(id)}`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'PATCH',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(patch),
    });
  },

  async deleteProduct(id, opts = {}) {
    const url = makeUrl(`/products/${encodeURIComponent(id)}`);
    const extraHeaders = headersToObject(opts.headers);

    await fetchJson(
      url,
      {
        method: 'DELETE',
        ...opts,
        headers: {
          ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}),
          ...extraHeaders,
        },
      },
      { allowNoContent: true },
    );
  },

  async getNovaPostCities(q, opts = {}) {
    const qs = new URLSearchParams();

    if (q) qs.set('q', String(q));

    const url = `${makeUrl('/shipping/nova-post/cities')}?${qs.toString()}`;
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async getNovaPostWarehouses(params = {}, opts = {}) {
    const qs = new URLSearchParams();

    if (params.cityRef) qs.set('cityRef', String(params.cityRef));
    if (params.q) qs.set('q', String(params.q));

    const url = `${makeUrl('/shipping/nova-post/warehouses')}?${qs.toString()}`;
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async getFavorites(opts = {}) {
    const url = makeUrl('/favorites');
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async addFavorite(productId, opts = {}) {
    const url = makeUrl(`/favorites/${encodeURIComponent(productId)}`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async removeFavorite(productId, opts = {}) {
    const url = makeUrl(`/favorites/${encodeURIComponent(productId)}`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'DELETE',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async updateFavoritePrefs(productId, prefs, opts = {}) {
    const url = makeUrl(`/favorites/${encodeURIComponent(productId)}/prefs`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'PUT',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(prefs),
    });
  },

  async uploadCustomPrintFile(file, opts = {}) {
    const url = makeUrl('/custom-print/uploads');
    const extraHeaders = headersToObject(opts.headers);
    const body = new FormData();

    body.append('file', file);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
      body,
    });
  },

  async createCustomPrintRequest(payload, opts = {}) {
    const url = makeUrl('/custom-print/requests');
    const extraHeaders = headersToObject(opts.headers);
    const isFormData =
      typeof FormData !== 'undefined' && payload instanceof FormData;

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
      },
      body: isFormData ? payload : JSON.stringify(payload),
    });
  },

  async getMyCustomPrintRequests(opts = {}) {
    const url = makeUrl('/custom-print/requests');
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async getCustomPrintRequest(id, opts = {}) {
    const url = makeUrl(`/custom-print/requests/${encodeURIComponent(id)}`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async updateCustomPrintRequest(id, payload, opts = {}) {
    const url = makeUrl(`/custom-print/requests/${encodeURIComponent(id)}`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'PATCH',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });
  },

  async requoteCustomPrintRequest(id, opts = {}) {
    const url = makeUrl(`/custom-print/requests/${encodeURIComponent(id)}/recalculate`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async recalculateCustomPrintQuote(id, payload, opts = {}) {
    await api.updateCustomPrintRequest(id, payload, opts);
    return api.requoteCustomPrintRequest(id, opts);
  },

  async addCustomPrintRequestToCart(id, opts = {}) {
    const url = makeUrl(`/custom-print/requests/${encodeURIComponent(id)}/add-to-cart`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        ...extraHeaders,
      },
    });
  },

  async deleteCustomPrintRequest(id, opts = {}) {
    const url = makeUrl(`/custom-print/requests/${encodeURIComponent(id)}`);
    const extraHeaders = headersToObject(opts.headers);

    await fetchJson(
      url,
      {
        method: 'DELETE',
        ...opts,
        headers: {
          Accept: 'application/json',
          ...extraHeaders,
        },
      },
      { allowNoContent: true },
    );
  },

  async payOrderWithGooglePay(orderId, payload, opts = {}) {
    const url = makeUrl(`/orders/${encodeURIComponent(orderId)}/payments/google-pay`);
    const extraHeaders = headersToObject(opts.headers);

    return fetchJson(url, {
      method: 'POST',
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });
  },
};