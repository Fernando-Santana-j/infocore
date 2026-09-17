const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', '.cache', 'google-reviews.json');
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 15 * 1000;
const RETRY_INTERVAL_MS = 60 * 1000;

const clean = (value, max = 2000) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const numericRating = (value, fallback = 5) => {
  const match = String(value || '').replace(',', '.').match(/[1-5](?:\.\d)?/);
  return Math.max(1, Math.min(5, Number(match?.[0]) || fallback));
};

function normalizeReview(review, mapsUrl) {
  const name = clean(review?.name, 120) || 'Cliente';
  const text = clean(review?.text);
  const date = clean(review?.date, 100);
  const rating = numericRating(review?.rating, 5);
  const id = clean(review?.id, 240) || `${name}|${date}|${text.slice(0, 160)}`;
  return { id, name, text, date, rating, avatar: clean(review?.avatar, 1000), url: mapsUrl };
}

function createGoogleReviewStore(business, options = {}) {
  const refreshIntervalMs = Math.max(60000, Number(process.env.GOOGLE_REVIEWS_REFRESH_MS) || REFRESH_INTERVAL_MS);
  const cacheFile = options.cacheFile === null || process.env.GOOGLE_REVIEWS_CACHE_FILE === 'memory' ? null : path.resolve(options.cacheFile || process.env.GOOGLE_REVIEWS_CACHE_FILE || CACHE_FILE);
  const mapsUrl = business.googleReviewsUrl || business.mapsUrl;
  const seedReviews = (business.googleReviewSnapshot?.reviews || []).map((review) => normalizeReview(review, mapsUrl));
  let snapshot = {
    available: true,
    source: 'public_maps_cache',
    order: 'google',
    rating: Number(String(business.googleReviewSnapshot?.score || '5').replace(',', '.')) || 5,
    count: Number(business.googleReviewSnapshot?.count) || seedReviews.length,
    mapsUrl,
    reviews: seedReviews,
    lastSuccessAt: business.googleReviewSnapshot?.lastSuccessAt || null,
  };
  let running = null;
  let timer = null;
  let lastRefreshComplete = false;

  try {
    if (!cacheFile) throw new Error('memory_cache');
    const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const reviews = Array.isArray(stored.reviews) ? stored.reviews.map((review) => normalizeReview(review, mapsUrl)).filter((review) => review.name) : [];
    if (reviews.length && Date.parse(stored.lastSuccessAt) >= (Date.parse(snapshot.lastSuccessAt) || 0)) snapshot = { ...snapshot, ...stored, available: true, mapsUrl, reviews };
  } catch (_) { /* O cache é criado na primeira sincronização válida. */ }

  const publicSnapshot = () => ({ ...snapshot, loadedCount: snapshot.reviews.length, complete: snapshot.reviews.length >= snapshot.count, refreshIntervalMs, reviews: snapshot.reviews.map((review) => ({ ...review })) });

  async function persist(next) {
    if (!cacheFile) return;
    const directory = path.dirname(cacheFile);
    await fs.promises.mkdir(directory, { recursive: true });
    const temporary = `${cacheFile}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await fs.promises.rename(temporary, cacheFile);
  }

  async function scrapeAttempt(chromium) {
    const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    const timeout = setTimeout(() => browser.close().catch(() => {}), 120000);
    timeout.unref();
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        locale: 'pt-BR',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      });

      page.setDefaultTimeout(12000);
      await page.goto((business.googleReviewsPageUrl || `https://www.google.com/maps?cid=${encodeURIComponent(business.googleMapsCid)}&hl=pt-BR`).replace('www.google.com/', 'www.google.com.br/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(5000);
      await page.goto(`https://www.google.com/maps?cid=${encodeURIComponent(business.googleMapsCid)}&hl=pt-BR&gl=BR`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(9000);

      const pageText = await page.locator('body').innerText().catch(() => '');
      const countMatch = pageText.match(/([\d.]+)\s+avalia(?:ç|c)[õo]es/i);
      const ratingMatch = pageText.match(/(?:^|\n)([1-5][,.]\d)(?:\n|$)/);
      const totalCount = Number(String(countMatch?.[1] || '').replace(/\D/g, '')) || snapshot.count;
      const averageRating = Number(String(ratingMatch?.[1] || snapshot.rating).replace(',', '.')) || snapshot.rating;

      const more = page.getByRole('button', { name: /Mais avaliações/i });
      const countControl = page.getByText(new RegExp(`${totalCount}\\s+avalia`, 'i'));
      const reviewsTab = page.getByRole('tab', { name: /Avaliações/i });
      if (await reviewsTab.count()) await reviewsTab.first().click();
      else if (await more.count()) await more.first().click();
      else if (!await page.locator('.jJc9Ad').count() && await countControl.count()) await countControl.first().click();
      await page.waitForTimeout(9000);

      const sortButton = page.getByRole('button', { name: /Classificar avaliações|Ordenar/i });
      if (await sortButton.count()) {
        await sortButton.first().click();
        const newest = page.getByRole('menuitemradio', { name: /Mais recentes/i });
        if (await newest.count()) await newest.first().click();
        else await page.keyboard.press('Escape');
        await page.waitForTimeout(2000);
      }

      const collected = new Map();
      let unchanged = 0;
      while (collected.size < totalCount) {
        const expanders = page.locator('.jJc9Ad button.w8nwRe[jsaction*="expandReview"]');
        // Expand in place: locator.click() scrolls back to older cards and stalls pagination.
        await expanders.evaluateAll((buttons) => buttons.forEach((button) => button.click()));
        const visible = await page.locator('.jJc9Ad').evaluateAll((cards) => cards.map((card) => ({
          id: card.getAttribute('data-review-id') || card.querySelector('[data-review-id]')?.getAttribute('data-review-id') || '',
          name: card.querySelector('.d4r55')?.textContent?.trim() || '',
          rating: card.querySelector('[aria-label*="estrela"]')?.getAttribute('aria-label') || '',
          date: card.querySelector('.rsqaWe')?.textContent?.trim() || '',
          text: [...card.querySelectorAll('.wiI7pd')].find((node) => !node.closest('.CDe7pd'))?.textContent?.trim() || '',
          avatar: card.querySelector('img.NBa7we')?.src || '',
        })));
        const before = collected.size;
        visible.forEach((review) => {
          if (!review.name) return;
          const normalized = normalizeReview(review, mapsUrl);
          collected.set(normalized.id, normalized);
        });
        unchanged = collected.size === before ? unchanged + 1 : 0;
        const moved = await page.evaluate(() => {
          const card = document.querySelector('.jJc9Ad');
          let pane = card?.parentElement;
          while (pane && !(pane.scrollHeight > pane.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(pane).overflowY))) pane = pane.parentElement;
          if (!pane) return false;
          const beforeScroll = pane.scrollTop;
          pane.scrollTop = pane.scrollHeight;
          pane.dispatchEvent(new Event('scroll', { bubbles: true }));
          return pane.scrollTop > beforeScroll;
        });
        if ((!moved && unchanged >= 5) || unchanged >= 12) break;
        await page.waitForTimeout(1500);
      }
      if (process.env.GOOGLE_REVIEWS_DEBUG === '1' && collected.size < totalCount) {
        console.log('MAPS DEBUG', (await page.locator('body').innerText()).slice(-2200));
        console.log('SCROLL DEBUG', await page.locator('.m6QErb').evaluateAll((nodes) => nodes.filter(n => n.querySelector('.jJc9Ad')).map(n => [n.className, n.scrollTop, n.scrollHeight, n.clientHeight, getComputedStyle(n).overflowY])));
      }
      process.stdout.write(`[GOOGLE REVIEWS] coleta pública: ${collected.size}/${totalCount}\n`);
      return { rating: averageRating, count: totalCount, reviews: [...collected.values()] };
    } finally {
      clearTimeout(timeout);
      await browser.close().catch(() => {});
    }
  }

  async function refresh() {
    if (running) return running;
    running = (async () => {
      try {
        lastRefreshComplete = false;
        process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(__dirname, '..', '.cache', 'ms-playwright');
        const { chromium } = require('playwright');
        let scraped = null;
        const fetched = new Map();
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const attemptResult = await (options.scrape || scrapeAttempt)(chromium);
            attemptResult.reviews.forEach((review) => fetched.set(review.id, review));
            scraped = { ...attemptResult, reviews: [...fetched.values()] };
            if (scraped.reviews.length >= scraped.count) break;
          } catch (error) {
            if (!scraped?.reviews.length && attempt === 1) throw error;
          }
        }
        if (!scraped?.reviews.length) throw new Error('no_public_reviews');

        const merged = new Map(snapshot.reviews.map((review) => [review.id, review]));
        scraped.reviews.forEach((review) => {
          for (const [key, cachedReview] of merged) {
            if (key.startsWith(`${cachedReview.name}|`) && cachedReview.name.toLocaleLowerCase('pt-BR') === review.name.toLocaleLowerCase('pt-BR')) merged.delete(key);
          }
          merged.set(review.id, review);
        });
        const reviews = scraped.reviews.length >= scraped.count ? scraped.reviews : [...merged.values()];
        const next = {
          available: true,
          source: 'public_maps_cache',
          order: 'google',
          rating: scraped.rating || snapshot.rating,
          count: Math.max(scraped.count || 0, reviews.length),
          mapsUrl,
          reviews,
          lastSuccessAt: new Date().toISOString(),
          lastCollectionCount: scraped.reviews.length,
          lastFullSyncAt: scraped.reviews.length >= scraped.count ? new Date().toISOString() : snapshot.lastFullSyncAt || null,
        };
        await persist(next);
        snapshot = next;
        lastRefreshComplete = scraped.reviews.length >= scraped.count;
        process.stdout.write(`[GOOGLE REVIEWS] cache atualizado: ${reviews.length}/${next.count}\n`);
        return publicSnapshot();
      } catch (error) {
        process.stderr.write(`[GOOGLE REVIEWS] sincronização adiada: ${clean(error?.message, 160)}\n`);
        return publicSnapshot();
      } finally { running = null; }
    })();
    return running;
  }

  function start() {
    if (process.env.GOOGLE_REVIEWS_PUBLIC_SYNC === '0' || !business.googleMapsCid || timer) return;
    const runAndSchedule = async () => {
      await refresh();
      timer = setTimeout(runAndSchedule, lastRefreshComplete ? refreshIntervalMs : RETRY_INTERVAL_MS);
      timer.unref();
    };
    timer = setTimeout(runAndSchedule, INITIAL_DELAY_MS);
    timer.unref();
  }

  return { getSnapshot: publicSnapshot, refresh, start };
}

module.exports = createGoogleReviewStore;
