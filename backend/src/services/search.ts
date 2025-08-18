export function toTsQuery(input: string): string {
  // преобразуем "red phone case" -> 'red & phone & case'
  return input.trim().split(/\s+/).map(w => w.replace(/[:&|!()]/g, '')).join(' & ');
}

export function normalizeAttrFilter(attr?: string): Record<string, unknown> | null {
  if (!attr) return null;
  try { return JSON.parse(attr); } catch { return null; }
}