export function encodeCursor(obj) {
    const json = JSON.stringify(obj);
    return Buffer.from(json).toString('base64url');
}
export function decodeCursor(cursor) {
    if (!cursor)
        return null;
    try {
        const json = Buffer.from(cursor, 'base64url').toString('utf8');
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
