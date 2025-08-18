export type MediaVariantDTO = {
  id: number;
  role?: 'primary'|'gallery';
  type: 'thumb'|'large'|'webp'|'avif';
  width?: number;
  height?: number;
  url: string;
};

export type ProductDTO = {
  id: number;
  sku: string;
  title: string;
  short_description?: string | null;
  description?: string | null;
  price_cents: number;
  currency: string;
  category_id?: number | null;
  brand?: string | null;
  attributes?: Record<string, unknown> | null;
  media?: MediaVariantDTO[];
  created_at: string;
  updated_at: string;
};