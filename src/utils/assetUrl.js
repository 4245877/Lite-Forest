// src/utils/assetUrl.js
const CDN = (import.meta.env.VITE_CDN_BASE_URL || '').replace(/\/+$/,'');
const API = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/,'');
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const BASE = CDN || API || ORIGIN;

// Абсолютные: "scheme:" или "//host"
const ABSOLUTE_OR_PROTOCOL_REL = /^([a-z][a-z0-9+.\-]*:|\/\/)/i;

export function assetUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  if (!s) return '';

  // абсолютные URL пропускаем (http:, https:, data:, blob:, //cdn...)
  if (ABSOLUTE_OR_PROTOCOL_REL.test(s)) return s;

  // корневой путь → склеиваем с BASE
  const path = s.startsWith('/') ? s : `/${s.replace(/^(\.\/)+/, '')}`;
  // безопасная склейка без lookbehind
  let out = `${BASE}${path}`.replace(/([^:])\/\/+/g, '$1/'); // двойные слэши, кроме после "http:"
  out = out.replace(/^(https?:)\/(?!\/)/, '$1//'); // вернуть "https://" если сломали выше
  // console.debug('[assetUrl]', { BASE, in: u, out });
  return out;
}
export default assetUrl;
