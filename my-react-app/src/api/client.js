export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || '';

export const api = {
  async listProducts(q = '', limit = 20, cursor = '') {
    const u = new URL(`${API_BASE}/api/products`);
    if (q) u.searchParams.set('q', q);
    if (limit) u.searchParams.set('limit', String(limit));
    if (cursor) u.searchParams.set('cursor', cursor);

    console.log('[api] GET', u.toString()); // 👈 покаже куди реально йде запит

    const r = await fetch(u, { headers: { Accept: 'application/json' } });

    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      throw new Error(`HTTP ${r.status} ${r.statusText} for ${u}: ${txt}`);
    }
    return r.json();
  },

  async getProduct(id) {
    const u = new URL(`${API_BASE}/api/products/${encodeURIComponent(id)}`);
    console.log('[api] GET', u.toString());
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      throw new Error(`HTTP ${r.status} ${r.statusText} for ${u}: ${txt}`);
    }
    return r.json();
  },

  async createProduct(payload) {
    const r = await fetch(`${API_BASE}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {})
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async updateProduct(id, patch) {
    const r = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {})
      },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },

  async deleteProduct(id) {
    const r = await fetch(`${API_BASE}/api/products/${id}`, {
      method: 'DELETE',
      headers: { ...(ADMIN_TOKEN ? { 'x-admin-token': ADMIN_TOKEN } : {}) }
    });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
  }
};
