const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', '.cache', 'google-reviews.json');
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 15 * 1000;
const MAX_REVIEWS = 100;

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

function createGoogleReviewStore(business) {
  const cacheFile = process.env.GOOGLE_REVIEWS_CACHE_FILE === 'memory' ? null : path.resolve(process.env.GOOGLE_REVIEWS_CACHE_FILE || CACHE_FILE);
  const mapsUrl = business.googleReviewsUrl || business.mapsUrl;
  const seedReviews = (business.googleReviewSnapshot?.reviews || []).map((review) => normalizeReview({ ...review, rating: 5 }, mapsUrl));
  let snapshot = {
    available: true,
    source: 'public_maps_cache',
    order: 'google',
    rating: Number(String(business.googleReviewSnapshot?.score || '5').replace(',', '.')) || 5,
    count: Number(business.googleReviewSnapshot?.count) || seedReviews.length,
    mapsUrl,
    reviews: seedReviews,
    lastSuccessAt: null,
  };
  let running = null;
  let timer = null;

  try {
    if (!cacheFile) throw new Error('memory_cache');
    const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const reviews = Array.isArray(stored.reviews) ? stored.reviews.map((review) => normalizeReview(review, mapsUrl)).filter((review) => review.name) : [];
    if (reviews.length >= snapshot.reviews.length) snapshot = { ...snapshot, ...stored, available: true, mapsUrl, reviews };
  } catch (_) { /* O cache é criado na primeira sincronização válida. */ }

  const publicSnapshot = () => ({ ...snapshot, reviews: snapshot.reviews.map((review) => ({ ...review })) });

  async function persist(next) {
    if (!cacheFile) return;
    const directory = path.dirname(cacheFile);
    await fs.promises.mkdir(directory, { recursive: true });
    const temporary = `${cacheFile}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await fs.promises.rename(temporary, cacheFile);
  }

  async function scrapeAttempt(chromium) {
    const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer'] });
    try {
      const page = await browser.newPage({
        viewport: { width: 760, height: 700 },
        locale: 'pt-BR',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      });
      await page.route('**/*', (route) => ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
      page.setDefaultTimeout(12000);
      await page.goto(business.googleReviewsPageUrl || `https://www.google.com/maps?cid=${encodeURIComponent(business.googleMapsCid)}&hl=pt-BR`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(9000);

      const pageText = await page.locator('body').innerText().catch(() => '');
      const countMatch = pageText.match(/([\d.]+)\s+avalia(?:ç|c)[õo]es/i);
      const ratingMatch = pageText.match(/(?:^|\n)([1-5][,.]\d)(?:\n|$)/);
      const totalCount = Number(String(countMatch?.[1] || '').replace(/\D/g, '')) || snapshot.count;
      const averageRating = Number(String(ratingMatch?.[1] || snapshot.rating).replace(',', '.')) || snapshot.rating;

      const more = page.getByRole('button', { name: /Mais avaliações/i });
      const countControl = page.getByText(new RegExp(`${totalCount}\\s+avalia`, 'i'));
      const reviewsTab = page.getByRole('tab', { name: /Avaliações/i });
      if (await more.count()) await more.first().click();
      else if (await countControl.count()) await countControl.first().click();
      else if (await reviewsTab.count()) await reviewsTab.first().click();
      await page.waitForTimeout(9000);

      const collected = new Map();
      let unchanged = 0;
      for (let step = 0; step < 32 && collected.size < Math.min(totalCount, MAX_REVIEWS); step += 1) {
        const expanders = page.locator('.jJc9Ad button.w8nwRe');
        for (let index = 0; index < Math.min(await expanders.count(), 12); index += 1) await expanders.nth(index).click().catch(() => {});
        const visible = await page.locator('.jJc9Ad').evaluateAll((cards) => cards.map((card) => ({
          id: card.getAttribute('data-review-id') || card.querySelector('[data-review-id]')?.getAttribute('data-review-id') || '',
          name: card.querySelector('.d4r55')?.textContent?.trim() || '',
          rating: card.querySelector('[aria-label*="estrela"]')?.getAttribute('aria-label') || '',
          date: card.querySelector('.rsqaWe')?.textContent?.trim() || '',
          text: card.querySelector('.wiI7pd')?.textContent?.trim() || '',
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
          const panes = [...document.querySelectorAll('.m6QErb')].filter((element) => element.scrollHeight > element.clientHeight + 100);
          const pane = panes.find((element) => element.querySelector('.jJc9Ad')) || panes.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
          if (!pane) return false;
          const beforeScroll = pane.scrollTop;
          pane.scrollTop = Math.min(pane.scrollHeight, pane.scrollTop + Math.max(600, pane.clientHeight * 0.8));
          pane.dispatchEvent(new Event('scroll', { bubbles: true }));
          return pane.scrollTop > beforeScroll;
        });
        if ((!moved && unchanged >= 5) || unchanged >= 12) break;
        await page.waitForTimeout(650);
      }
      return { rating: averageRating, count: totalCount, reviews: [...collected.values()] };
    } finally {
      await browser.close().catch(() => {});
    }
  }

  async function refresh() {
    if (running) return running;
    running = (async () => {
      try {
        const { chromium } = require('playwright');
        let scraped = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          scraped = await scrapeAttempt(chromium);
          if (scraped.reviews.length > snapshot.reviews.length || scraped.reviews.length >= scraped.count) break;
        }
        if (!scraped?.reviews.length) throw new Error('no_public_reviews');

        const merged = new Map(snapshot.reviews.map((review) => [review.id, review]));
        scraped.reviews.forEach((review) => {
          for (const [key, cachedReview] of merged) {
            if (cachedReview.name.toLocaleLowerCase('pt-BR') === review.name.toLocaleLowerCase('pt-BR')) merged.delete(key);
          }
          merged.set(review.id, review);
        });
        const reviews = [...merged.values()].slice(0, MAX_REVIEWS);
        const next = {
          available: true,
          source: 'public_maps_cache',
          order: 'google',
          rating: scraped.rating || snapshot.rating,
          count: Math.max(scraped.count || 0, snapshot.count, reviews.length),
          mapsUrl,
          reviews,
          lastSuccessAt: new Date().toISOString(),
        };
        await persist(next);
        snapshot = next;
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
      timer = setTimeout(runAndSchedule, REFRESH_INTERVAL_MS);
      timer.unref();
    };
    timer = setTimeout(runAndSchedule, INITIAL_DELAY_MS);
    timer.unref();
  }

  return { getSnapshot: publicSnapshot, refresh, start };
}

module.exports = createGoogleReviewStore;
