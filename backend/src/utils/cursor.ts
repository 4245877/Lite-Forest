export function encodeCursor(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString('base64url');
}

export function decodeCursor<T = any>(cursor?: string | null): T | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}