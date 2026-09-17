const { test } = require('node:test');
const assert = require('node:assert/strict');
const listReviews = require('../services/google-business-reviews');

test('loads all pages including reviews without comments and duplicate author names', async () => {
  let calls = 0;
  const result = await listReviews('accounts/a/locations/l', 'test-token', async (url) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get('pageSize'), '50');
    assert.equal(query.get('pageToken'), calls ? `page-${calls}` : null);
    const offset = calls++ * 50;
    return { ok: true, json: async () => ({ averageRating: 4.8, totalReviewCount: 123,
      reviews: Array.from({ length: Math.min(50, 123 - offset) }, (_, i) => ({ reviewId: String(offset + i), reviewer: { displayName: 'Cliente' }, starRating: 'FIVE' })),
      nextPageToken: calls < 3 ? `page-${calls}` : undefined,
    }) };
  });
  assert.equal(calls, 3);
  assert.equal(result.reviews.length, 123);
  assert.equal(new Set(result.reviews.map(r => r.reviewId)).size, 123);
});

test('rejects a failed later page rather than returning a partial list', async () => {
  let calls = 0;
  await assert.rejects(listReviews('accounts/a/locations/l', 'test-token', async () =>
    ++calls === 1 ? { ok: true, json: async () => ({ reviews: [{ reviewId: '1' }], nextPageToken: 'next' }) } : { ok: false }
  ), /google_business_profile_failed/);
});

test('stops repeated pagination tokens', async () => {
  await assert.rejects(listReviews('accounts/a/locations/l', 'test-token', async () => ({ ok: true, json: async () => ({ reviews: [], nextPageToken: 'same' }) })), /google_reviews_repeated_page/);
});
