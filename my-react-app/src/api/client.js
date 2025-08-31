export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export const api = {
  async listProducts(q = '', limit = 20, cursor = '') {
    const u = new URL(`${API_BASE}/api/products`);
    if (q) u.searchParams.set('q', q);
    if (limit) u.searchParams.set('limit', limit);
    if (cursor) u.searchParams.set('cursor', cursor);

    console.log('[api] GET', u.toString()); // 👈 покажет куда реально идёт запрос

    const r = await fetch(u, { headers: { Accept: 'application/json' } });

    if (!r.ok) {
      const txt = await r.text().catch(() => '<no body>');
      throw new Error(`HTTP ${r.status} ${r.statusText} for ${u}: ${txt}`);
    }
    return r.json();
  }
};
