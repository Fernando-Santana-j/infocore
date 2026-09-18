const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const business = require('../config/business');
const serviceShowcase = require('../config/service-showcase');

const shared = {
  business,
  serviceShowcase,
  googleReviewSnapshot: {
    rating: Number(business.googleReviewSnapshot.score.replace(',', '.')),
    count: business.googleReviewSnapshot.count,
    reviews: business.googleReviewSnapshot.reviews.map((review) => ({ ...review, rating: 5 })),
  },
  siteUrl: 'https://infocoretech.com.br',
  canonicalUrl: 'https://infocoretech.com.br/',
  ogImageUrl: 'https://infocoretech.com.br/public/img/og-share.png',
  assetVersion: 'test',
  googleMapsEmbedUrl: 'https://www.google.com/maps/embed?pb=InfoCore',
  pageTitle: 'Teste InfoCore',
  pageDescription: 'Descrição de teste',
  analytics: { gtmId: '', ga4Id: '', clarityId: '', metaPixelId: '' },
  integrations: { googleReviews: false, instagram: false, contact: false },
};

test('landing page renders core conversion and SEO content', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '../views/index.ejs'), shared);
  assert.match(html, /<h1[^>]*>Seu equipamento/);
  assert.match(html, /Solicitar orçamento/);
  assert.match(html, /Troca de tela/);
  assert.match(html, /class="visual-services service-catalog"/);
  assert.match(html, /class="services-catalog-link reveal"/);
  assert.match(html, /href="\/catalogo"/);
  assert.doesNotMatch(html, /Upgrades e soluções|class="section products"/);
  assert.match(html, /class="process-journey"/);
  assert.doesNotMatch(html, /class="service-bento"|class="why-us"/);
  assert.match(html, /Diagnosticar este computador/);
  assert.equal((html.match(/id="diag-action"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="diag-configure"|id="diag-cta"|class="psu"/);
  assert.match(html, /Um clique para descobrir/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /rel="icon" href="\/favicon\.ico" sizes="48x48 192x192"/);
  assert.match(html, /href="\/public\/favicon-48\.png" sizes="48x48"/);
  assert.match(html, /id="consent"/);
  assert.match(html, /id="instagram-feed"/);
  assert.match(html, /class="google-embed-card"/);
  assert.match(html, /google\.com\/maps\/embed\?pb=/);
  assert.match(html, /5,0/);
  assert.match(html, /19 avaliações/);
  assert.match(html, /data-review-rotator/);
  assert.match(html, /Leonardo Silva/);
  assert.match(html, /Ler todas as avaliações/);
  assert.match(html, /Praça Abel Jacó dos Santos, 889/);
  assert.match(html, /CEP 49480-000/);
  assert.match(html, /Segunda a sábado · 08:00–18:00/);
  assert.match(html, /Domingo · Fechado/);
  assert.doesNotMatch(html, /2500\+|98%|100% Satisfação|10\+ Anos/);
  assert.doesNotMatch(html, /unsplash\.com|customer-assets\.emergentagent\.com/);
});

test('legal pages render with business contact', async () => {
  for (const view of ['privacy.ejs', 'cookies.ejs']) {
    const html = await ejs.renderFile(path.join(__dirname, '../views', view), shared);
    assert.match(html, /InfoCore/);
    assert.match(html, /Voltar para a InfoCore/);
  }
});

test('catalog page renders dynamic controls and WhatsApp entry points', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '../views/catalog.ejs'), { ...shared, canonicalUrl: 'https://infocoretech.com.br/catalogo' });
  assert.match(html, /Catálogo conectado ao estoque/);
  assert.match(html, /id="catalog-grid"/);
  assert.match(html, /id="catalog-search"/);
  assert.match(html, /api\/catalog\/products|catalog\.js/);
  assert.match(html, /wa\.me\/5579991343921/);
});

test('business contact data and Google opening hours are centralized', () => {
  assert.equal(business.phoneE164, '+5579991343921');
  assert.equal(business.address.city, 'Simão Dias');
  assert.equal(business.address.postalCode, '49480-000');
  assert.equal(business.hours.mondayToSaturday, '08:00–18:00');
  assert.equal(business.hours.sunday, 'Fechado');
});
