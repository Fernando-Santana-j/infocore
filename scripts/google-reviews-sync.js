require('dotenv').config({ quiet: true });
if (process.argv.includes('--debug')) process.env.GOOGLE_REVIEWS_DEBUG = '1';
const store = require('../services/google-review-store')(require('../config/business'));
const startedAt = Date.now();
store.refresh().then((snapshot) => {
  console.log(JSON.stringify({ source: snapshot.source, loaded: snapshot.loadedCount, total: snapshot.count, complete: snapshot.complete, collectedNow: snapshot.lastCollectionCount || 0, lastSuccessAt: snapshot.lastSuccessAt }, null, 2));
  if (!snapshot.complete || (snapshot.lastCollectionCount || 0) < snapshot.count || Date.parse(snapshot.lastSuccessAt) < startedAt) process.exitCode = 1;
}).catch((error) => { console.error(error.message); process.exitCode = 1; });
