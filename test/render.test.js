const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');
const business = require('../config/business');
const serviceShowcase = require('../config/service-showcase');

const shared = {
  business,
  serviceShowcase,
  siteUrl: 'https://infocoretech.com.br',
  canonicalUrl: 'https://infocoretech.com.br/',
  ogImageUrl: 'https://infocoretech.com.br/public/img/og-share.png',
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
  assert.match(html, /Diagnosticar este PC/);
  assert.match(html, /Um clique para descobrir/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /id="consent"/);
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

test('business data is centralized and does not claim unverified hours', () => {
  assert.equal(business.phoneE164, '+5579991343921');
  assert.equal(business.address.city, 'Simão Dias');
  assert.equal(business.hours, null);
});
