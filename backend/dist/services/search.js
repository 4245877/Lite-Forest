export function toTsQuery(input) {
    // преобразуем "red phone case" -> 'red & phone & case'
    return input.trim().split(/\s+/).map(w => w.replace(/[:&|!()]/g, '')).join(' & ');
}
export function normalizeAttrFilter(attr) {
    if (!attr)
        return null;
    try {
        return JSON.parse(attr);
    }
    catch {
        return null;
    }
}
