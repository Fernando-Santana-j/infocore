const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const createStore = require('../services/google-review-store');
const business = { mapsUrl: 'https://www.google.com/maps', googleReviewSnapshot: { score: 5, count: 19, reviews: [] } };
const review = i => ({ id: `google-${i}`, name: i < 2 ? 'Mesmo nome' : `Cliente ${i}`, text: i % 2 ? `Comentário ${i}` : '', rating: 5, date: 'recentemente' });
const result = count => ({ count, rating: 5, reviews: Array.from({ length: count }, (_, i) => review(i)) });

test('public scraping refresh adds new reviews and retains ratings without comments and duplicate names', async () => {
  let count = 19;
  const store = createStore(business, { cacheFile: null, scrape: async () => result(count) });
  assert.equal((await store.refresh()).loadedCount, 19);
  count = 20;
  const next = await store.refresh();
  assert.equal(next.count, 20);
  assert.equal(next.reviews.length, 20);
  assert.equal(next.reviews.filter(r => r.name === 'Mesmo nome').length, 2);
  assert.equal(next.reviews[0].text, '');
  assert.equal(next.complete, true);
  assert.equal(next.refreshIntervalMs, 300000);
});

test('incomplete collection and network failure preserve the last complete list', async () => {
  let response = result(19);
  const store = createStore(business, { cacheFile: null, scrape: async () => { if (response instanceof Error) throw response; return response; } });
  await store.refresh();
  response = { ...result(10), count: 19 };
  assert.equal((await store.refresh()).reviews.length, 19);
  response = new Error('network unavailable');
  assert.equal((await store.refresh()).reviews.length, 19);
  response = result(18);
  assert.equal((await store.refresh()).reviews.length, 18);
});

test('complete cache survives process restart and concurrent refreshes share one scrape', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'infocore-reviews-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const cacheFile = path.join(directory, 'reviews.json');
  let calls = 0;
  const store = createStore(business, { cacheFile, scrape: async () => { calls++; return result(19); } });
  await Promise.all([store.refresh(), store.refresh()]);
  assert.equal(calls, 1);
  const restarted = createStore(business, { cacheFile });
  assert.equal(restarted.getSnapshot().reviews.length, 19);
});

test('a fresh installation already contains all 19 captured public reviews', () => {
  const configuredBusiness = require('../config/business');
  const snapshot = createStore(configuredBusiness, { cacheFile: null }).getSnapshot();
  assert.equal(snapshot.reviews.length, 19);
  assert.equal(new Set(snapshot.reviews.map(r => r.id)).size, 19);
  assert.equal(snapshot.reviews.filter(r => !r.text).length, 6);
});

test('combines distinct partial collections instead of discarding reviews from the next attempt', async () => {
  let calls = 0;
  const all = result(19);
  const store = createStore(business, { cacheFile: null, scrape: async () => ({ ...all, reviews: ++calls === 1 ? all.reviews.slice(0, 10) : all.reviews.slice(10) }) });
  const snapshot = await store.refresh();
  assert.equal(calls, 2);
  assert.equal(snapshot.reviews.length, 19);
  assert.equal(new Set(snapshot.reviews.map(r => r.id)).size, 19);
});
