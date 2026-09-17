// Business Profile returns at most 50 reviews per page. Follow every token.
module.exports = async function listReviews(parent, accessToken, fetchWithTimeout) {
  const allReviews = [];
  const seenTokens = new Set();
  let pageToken = '';
  let payload;
  do {
    const query = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
    if (pageToken) query.set('pageToken', pageToken);
    const profileResponse = await fetchWithTimeout(`https://mybusiness.googleapis.com/v4/${parent}/reviews?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!profileResponse.ok) throw new Error('google_business_profile_failed');
    const page = await profileResponse.json();
    payload ||= page;
    allReviews.push(...(page.reviews || []));
    pageToken = page.nextPageToken || '';
    if (pageToken && seenTokens.has(pageToken)) throw new Error('google_reviews_repeated_page');
    seenTokens.add(pageToken);
  } while (pageToken);
  return { ...payload, reviews: allReviews };
};
