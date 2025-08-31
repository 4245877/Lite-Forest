export function encodeCursor(v: unknown): string {
return Buffer.from(JSON.stringify(v), 'utf8').toString('base64url');
}
export function decodeCursor<T = any>(v?: string | null): T | null {
if (!v) return null;
try { return JSON.parse(Buffer.from(v, 'base64url').toString('utf8')) as T; } catch { return null; }
}