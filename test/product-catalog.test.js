const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePublicProduct, buildPublicCatalog } = require('../services/product-catalog');

test('public catalog removes services, inactive records and private inventory fields', () => {
  const catalog = buildPublicCatalog([
    { id: 'p1', name: 'SSD 480 GB', itemType: 'product', active: true, category: 'pc', price: 199.9, qty: 2, cost: 80, sku: 'secret', min: 4 },
    { id: 's1', name: 'Formatação', itemType: 'service', active: true, price: 50 },
    { id: 'p2', name: 'Produto oculto', itemType: 'product', active: false, price: 10 },
  ]);
  assert.equal(catalog.count, 1);
  assert.equal(catalog.products[0].availability, 'low_stock');
  assert.equal(catalog.products[0].categoryLabel, 'Computadores');
  assert.equal('cost' in catalog.products[0], false);
  assert.equal('sku' in catalog.products[0], false);
  assert.equal('min' in catalog.products[0], false);
});

test('product images accept HTTPS and map uploads to the public inventory media origin', () => {
  assert.equal(normalizePublicProduct({ id: '1', name: 'Mouse', image: '/uploads/mouse.png' }).image, 'https://system.infocoretech.com.br/uploads/mouse.png');
  assert.equal(normalizePublicProduct({ id: '2', name: 'Teclado', image: 'https://cdn.example.com/keyboard.webp' }).image, 'https://cdn.example.com/keyboard.webp');
  assert.equal(normalizePublicProduct({ id: '3', name: 'Cabo', image: 'javascript:alert(1)' }).image, 'https://system.infocoretech.com.br/uploads/javascript%3Aalert(1)');
});

test('product images can use an explicitly configured media origin or the local safe route', () => {
  const previous = process.env.PRODUCT_MEDIA_BASE_URL;
  try {
    process.env.PRODUCT_MEDIA_BASE_URL = 'https://media.example.com/';
    assert.equal(normalizePublicProduct({ id: '1', name: 'Mouse', image: '/uploads/mouse.png' }).image, 'https://media.example.com/uploads/mouse.png');
    process.env.PRODUCT_MEDIA_BASE_URL = 'local';
    assert.equal(normalizePublicProduct({ id: '2', name: 'Mouse', image: '/uploads/mouse.png' }).image, '/catalog-media/mouse.png');
  } finally {
    if (previous === undefined) delete process.env.PRODUCT_MEDIA_BASE_URL;
    else process.env.PRODUCT_MEDIA_BASE_URL = previous;
  }
});
