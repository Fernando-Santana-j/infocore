const path = require('path');

const CATEGORY_LABELS = Object.freeze({
  pc: 'Computadores',
  cell: 'Celulares',
  laptop: 'Notebooks',
  others: 'Acessórios',
});

const clean = (value, max = 500) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function publicImage(value) {
  const image = clean(value, 1200);
  if (/^https:\/\//i.test(image)) return image;
  if (!image) return '';
  const filename = path.basename(image);
  return filename && filename !== '.' ? `/catalog-media/${encodeURIComponent(filename)}` : '';
}

function normalizePublicProduct(row) {
  if (!row || row.active === false || String(row.itemType || 'product').toLowerCase() === 'service') return null;
  const id = clean(row.id, 160);
  const name = clean(row.name || row.title || row.nome, 180);
  if (!id || !name) return null;
  const category = Object.hasOwn(CATEGORY_LABELS, clean(row.category, 40)) ? clean(row.category, 40) : 'others';
  const tracksStock = row.trackStock !== false;
  const quantity = tracksStock ? Math.max(0, Math.trunc(number(row.qty))) : null;
  const availability = !tracksStock || quantity > 3 ? 'available' : quantity > 0 ? 'low_stock' : 'out_of_stock';
  const rawUpdatedAt = row.updatedAt?.toDate?.() || row.updatedAt;
  const updatedAt = rawUpdatedAt instanceof Date ? rawUpdatedAt.toISOString() : '';
  return {
    id,
    name,
    description: clean(row.description, 600),
    category,
    categoryLabel: CATEGORY_LABELS[category],
    price: Math.max(0, number(row.price ?? row.preco)),
    image: publicImage(row.image || row.imageUrl || row.imagem),
    emoji: clean(row.emoji, 8) || (category === 'cell' ? '📱' : category === 'laptop' ? '💻' : category === 'pc' ? '🖥️' : '📦'),
    availability,
    quantity,
    updatedAt,
  };
}

function buildPublicCatalog(rows) {
  const products = (Array.isArray(rows) ? rows : []).map(normalizePublicProduct).filter(Boolean).sort((a, b) => {
    const stockOrder = { available: 0, low_stock: 1, out_of_stock: 2 };
    return stockOrder[a.availability] - stockOrder[b.availability]
      || a.categoryLabel.localeCompare(b.categoryLabel, 'pt-BR')
      || a.name.localeCompare(b.name, 'pt-BR');
  });
  const categories = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label, count: products.filter((product) => product.category === id).length })).filter((category) => category.count);
  const updatedAt = products.map((product) => product.updatedAt).filter(Boolean).sort().at(-1) || new Date().toISOString();
  return { available: true, count: products.length, inStockCount: products.filter((product) => product.availability !== 'out_of_stock').length, categories, products, updatedAt };
}

module.exports = { CATEGORY_LABELS, normalizePublicProduct, buildPublicCatalog };
