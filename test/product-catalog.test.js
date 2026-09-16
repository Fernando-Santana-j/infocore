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

test('product images accept HTTPS and map local uploads to the safe media route', () => {
  assert.equal(normalizePublicProduct({ id: '1', name: 'Mouse', image: '/uploads/mouse.png' }).image, '/catalog-media/mouse.png');
  assert.equal(normalizePublicProduct({ id: '2', name: 'Teclado', image: 'https://cdn.example.com/keyboard.webp' }).image, 'https://cdn.example.com/keyboard.webp');
  assert.equal(normalizePublicProduct({ id: '3', name: 'Cabo', image: 'javascript:alert(1)' }).image, '/catalog-media/javascript%3Aalert(1)');
});
