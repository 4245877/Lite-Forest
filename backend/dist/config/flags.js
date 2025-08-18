export const flags = {
    enableAvif: String(process.env.ENABLE_AVIF).toLowerCase() === 'true',
    enableUnaccent: String(process.env.ENABLE_UNACCENT).toLowerCase() === 'true',
    // будущие флаги
    enableElastic: String(process.env.ENABLE_ELASTIC).toLowerCase() === 'true',
};
