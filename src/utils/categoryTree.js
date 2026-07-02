function toSafeString(value) {
  return String(value ?? '').trim();
}

function pickLocalizedName(value, fallback = '') {
  if (typeof value === 'string') {
    return toSafeString(value);
  }

  if (value && typeof value === 'object') {
    const localized =
      value.uk ??
      value.ua ??
      value.ru ??
      value.en ??
      Object.values(value).find((item) => typeof item === 'string');

    return toSafeString(localized ?? fallback);
  }

  return toSafeString(fallback);
}

function sortCategories(a, b) {
  const aOrder = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER;
  const bOrder = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER;

  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a.name || '').localeCompare(String(b.name || ''), 'uk');
}

export function normalizeMetaCategories(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter(Boolean)
    .map((row) => {
      const slug = toSafeString(row.slug ?? row.id);
      const parentSlug = toSafeString(row.parent_slug ?? row.parent) || null;

      let aliases = [];
      if (Array.isArray(row.aliases)) {
        aliases = row.aliases.map((value) => toSafeString(value)).filter(Boolean);
      } else if (typeof row.aliases === 'string') {
        aliases = row.aliases
          .split(',')
          .map((value) => toSafeString(value))
          .filter(Boolean);
      }

      return {
        id: slug,
        slug,
        parent: parentSlug,
        parent_slug: parentSlug,
        name: pickLocalizedName(row.name ?? row.title, slug),
        aliases,
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : Number.MAX_SAFE_INTEGER,
        is_hidden: Boolean(row.is_hidden),
      };
    })
    .filter((row) => row.slug);
}

export function buildCategoryMaps(categories = []) {
  const byId = {};
  const byParent = {};

  categories.forEach((category) => {
    byId[category.id] = category;

    const parentSlug = category.parent || null;
    if (!byParent[parentSlug]) byParent[parentSlug] = [];
    byParent[parentSlug].push(category.id);
  });

  Object.keys(byParent).forEach((key) => {
    byParent[key].sort((leftId, rightId) => {
      const left = byId[leftId];
      const right = byId[rightId];
      return sortCategories(left, right);
    });
  });

  return { byId, byParent };
}

export function buildCategoryTree(categories = []) {
  const visible = categories.filter((category) => !category.is_hidden);
  const map = {};

  visible.forEach((category) => {
    map[category.id] = {
      ...category,
      children: [],
    };
  });

  const tree = [];

  Object.values(map).forEach((category) => {
    const parentSlug = category.parent || null;
    if (parentSlug && map[parentSlug]) {
      map[parentSlug].children.push(category);
    } else {
      tree.push(category);
    }
  });

  function sortNodeList(nodes) {
    nodes.sort(sortCategories);
    nodes.forEach((node) => sortNodeList(node.children || []));
    return nodes;
  }

  return sortNodeList(tree);
}

export function getCategoryDepth(slug, byId = {}) {
  const seen = new Set();
  let current = byId[slug];
  let depth = 0;

  while (current && current.parent && byId[current.parent] && !seen.has(current.parent)) {
    seen.add(current.parent);
    depth += 1;
    current = byId[current.parent];
  }

  return depth;
}

export function resolvePrimaryCategorySlug(categorySlugs = [], byId = {}) {
  const slugs = (Array.isArray(categorySlugs) ? categorySlugs : [])
    .map((slug) => toSafeString(slug))
    .filter(Boolean);

  if (!slugs.length) return null;

  const withKnownMeta = slugs.filter((slug) => byId[slug]);
  const pool = withKnownMeta.length ? withKnownMeta : slugs;

  return [...pool].sort((left, right) => {
    const depthDiff = getCategoryDepth(right, byId) - getCategoryDepth(left, byId);
    if (depthDiff !== 0) return depthDiff;
    return left.localeCompare(right, 'uk');
  })[0];
}

export function getCategoryAncestors(slug, byId = {}) {
  const chain = [];
  const seen = new Set();
  let current = byId[slug];

  while (current && !seen.has(current.slug)) {
    seen.add(current.slug);
    chain.unshift(current);

    if (!current.parent || !byId[current.parent]) break;
    current = byId[current.parent];
  }

  return chain;
}

export function findCategoryLabel(slug, byId = {}) {
  return byId[slug]?.name || String(slug || '');
}