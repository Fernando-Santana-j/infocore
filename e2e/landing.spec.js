const { test, expect } = require('@playwright/test');

test('landing page is responsive, functional and free of runtime errors', async ({ page }, testInfo) => {
  const errors = [];
  const failed = [];
  const isGoogleEmbedError = (value) => /maps\.gstatic\.com\/maps-api-v3\/embed/i.test(String(value || ''));
  page.on('console', (message) => { if (message.type() === 'error' && !isGoogleEmbedError(message.location().url)) errors.push(message.text()); });
  page.on('pageerror', (error) => { if (!isGoogleEmbedError(error.stack)) errors.push(error.message); });
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'media' && request.failure()?.errorText === 'net::ERR_ABORTED') return;
    failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toContainText('Seu equipamento');
  await expect(page.locator('.hero-actions .button-primary')).toHaveAttribute('href', /wa\.me\/5579991343921/);
  await expect(page.locator('main')).toHaveJSProperty('scrollWidth', await page.locator('main').evaluate((node) => node.clientWidth));
  const missingAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((link) => link.getAttribute('href')).filter((href) => href !== '#' && !document.querySelector(href)));
  expect(missingAnchors).toEqual([]);

  if (testInfo.project.name === 'mobile') {
    await page.locator('.menu-toggle').click();
    await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#nav-menu')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  }

  await page.locator('[data-consent="reject"]').click();
  await expect(page.locator('#consent')).toBeHidden();
  for (const selector of ['#servicos', '#processo', '#trabalhos', '#avaliacoes']) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
  }
  await page.locator('#faq').scrollIntoViewIfNeeded();
  await page.locator('.faq-item').first().locator('summary').click();
  await expect(page.locator('.faq-item').first()).toHaveAttribute('open', '');
  await page.locator('#contato').scrollIntoViewIfNeeded();
  await page.locator('.final-cta').scrollIntoViewIfNeeded();
  await expect(page.locator('.reveal').last()).toHaveClass(/is-visible/);

  const events = await page.evaluate(() => window.dataLayer.filter((item) => item && item.event).map((item) => item.event));
  expect(events).toContain('service_view');
  expect(events).toContain('portfolio_view');
  expect(events).toContain('faq_open');
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await page.screenshot({ path: `/tmp/infocore-${testInfo.project.name}.png`, fullPage: true });
});

test('product catalog filters items and builds a product-specific WhatsApp message', async ({ page }) => {
  const products = Array.from({ length: 30 }, (_, index) => ({
    id: `product-${index}`,
    name: index === 0 ? 'SSD NVMe 512 GB' : `Produto ${index + 1}`,
    description: index === 0 ? 'Armazenamento rápido para computadores e notebooks.' : 'Acessório disponível na InfoCore.',
    category: index % 2 ? 'cell' : 'pc',
    categoryLabel: index % 2 ? 'Celulares' : 'Computadores',
    price: 10 + index,
    emoji: index % 2 ? '📱' : '🖥️',
    availability: index === 2 ? 'out_of_stock' : index === 1 ? 'low_stock' : 'available',
    quantity: index === 1 ? 2 : 8,
  }));
  await page.route('**/api/catalog/products', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ available: true, count: 30, inStockCount: 29, categories: [{ id: 'pc', label: 'Computadores', count: 15 }, { id: 'cell', label: 'Celulares', count: 15 }], products }) }));
  await page.goto('/catalogo');
  await expect(page.locator('.catalog-card')).toHaveCount(24);
  await expect(page.locator('#catalog-total')).toHaveText('30');
  await page.locator('#catalog-search').fill('SSD NVMe');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  const whatsapp = page.locator('.catalog-product-whatsapp');
  await expect(whatsapp).toHaveAttribute('href', /wa\.me\/5579991343921/);
  expect(decodeURIComponent(await whatsapp.getAttribute('href'))).toContain('SSD NVMe 512 GB');
  await expect(page.locator('main')).toHaveJSProperty('scrollWidth', await page.locator('main').evaluate((node) => node.clientWidth));
});

test('analytics does not include personal form values', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-consent="accept"]').click();
  await page.locator('#contact-form').scrollIntoViewIfNeeded();
  await page.locator('[name="name"]').fill('Pessoa Teste');
  await page.locator('[name="email"]').fill('privado@example.com');
  await page.locator('[name="phone"]').fill('79999999999');
  await page.locator('[name="message"]').fill('Mensagem privada que não pode ir ao analytics');
  await page.locator('[name="startedAt"]').evaluate((element) => { element.value = '1'; });
  await page.locator('#contact-form button[type="submit"]').click();
  await expect(page.locator('#form-status')).toContainText('ainda não está conectado');
  const serialized = await page.evaluate(() => JSON.stringify(window.dataLayer));
  expect(serialized).not.toContain('Pessoa Teste');
  expect(serialized).not.toContain('privado@example.com');
  expect(serialized).not.toContain('79999999999');
  expect(serialized).not.toContain('Mensagem privada');
  expect(serialized).toContain('contact_form_submit');
  expect(serialized).toContain('contact_form_error');
});

test('Instagram posts render from API data and Google uses the free embed', async ({ page }, testInfo) => {
  await page.clock.install();
  let reviewCount = 19;
  await page.route('**/', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace('"instagram":false', '"instagram":true');
    await route.fulfill({ response, body });
  });
  await page.route('**/api/instagram', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ available: true, posts: Array.from({ length: 6 }, (_, index) => ({ id: `post-${index}`, caption: `Trabalho recente ${index + 1} da InfoCore`, mediaType: index === 1 ? 'VIDEO' : 'IMAGE', mediaUrl: index === 1 ? '/public/img/showcase.webp' : '', thumbnailUrl: '/public/img/showcase.webp', imageUrl: '/public/img/showcase.webp', permalink: 'https://www.instagram.com/infocore_tech/', timestamp: '2026-09-10T12:00:00Z' })) }),
  }));
  await page.route('**/api/reviews', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ available: true, rating: 5, count: reviewCount, mapsUrl: 'https://www.google.com/maps', reviews: Array.from({ length: reviewCount }, (_, index) => ({ id: `review-${index}`, name: index === 1 ? 'Lucas Gabriel' : `Cliente ${index + 1}`, rating: 5, text: `Avaliação pública ${index + 1}`, date: 'recentemente' })) }),
  }));
  await page.goto('/');
  await expect(page.locator('#instagram-feed')).toHaveClass(/has-posts/);
  await expect(page.locator('.instagram-post')).toHaveCount(5);
  await expect(page.locator('.instagram-post').first()).toHaveClass(/featured/);
  if (testInfo.project.name !== 'reduced-motion') await expect(page.locator('.instagram-post video')).toHaveCount(1);
  await expect(page.locator('.google-embed-card iframe')).toHaveAttribute('src', /google\.com\/maps\/embed\?pb=/);
  await expect(page.locator('.embed-rating')).toContainText('5,0');
  await expect(page.locator('.embed-rating')).toContainText('19 avaliações');
  await expect(page.locator('.google-review-slide')).toHaveCount(19);
  await expect(page.locator('.google-review-slide.is-active')).toHaveCount(1);
  await page.locator('[data-review-next]').click();
  await expect(page.locator('[data-review-current]')).toHaveText('02');
  await expect(page.locator('.google-review-slide.is-active')).toContainText('Lucas Gabriel');
  await page.clock.fastForward(30000);
  await expect(page.locator('[data-review-current]')).toHaveText('02');
  reviewCount = 23;
  await page.clock.fastForward(30000);
  await expect(page.locator('.google-review-slide')).toHaveCount(23);
  await expect(page.locator('.embed-rating')).toContainText('23 avaliações');
  await expect(page.locator('#reviews-link')).toContainText('Ler todas as avaliações');
  await expect(page.locator('main')).toHaveJSProperty('scrollWidth', await page.locator('main').evaluate((node) => node.clientWidth));
});

test('PowerShell bridge receives hardware and adapts the recommendation', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('[data-consent="reject"]').click();
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#diag-action')).toHaveAttribute('data-mode', 'whatsapp');
    await expect(page.locator('#device-stage')).toHaveClass(/is-phone/);
    return;
  }
  await page.locator('#diag-action').click();
  await expect(page.locator('#diagnostic-dialog')).toBeVisible();
  await expect(page.locator('#diagnostic-download')).toHaveAttribute('href', /device-diagnostics\/[^/]+\/launcher/);
  const launcher = await page.locator('#diagnostic-download').getAttribute('href');
  const token = launcher.split('/')[3];
  const endpoint = `/api/device-diagnostics/${token}/script`;
  const script = await page.evaluate((url) => fetch(url).then((response) => response.text()), endpoint);
  expect(script).toContain('Win32_Processor');
  expect(script).toContain('Win32_SystemEnclosure');
  expect(script).toContain('Win32_Battery');
  expect(script).toContain('$isNotebook');
  expect(script).toContain('$system.Manufacturer');
  expect(script).not.toContain('SerialNumber');
  expect(launcher).toContain('/launcher');
  await page.evaluate(async (diagnosticToken) => {
    await fetch(`/api/device-diagnostics/${diagnosticToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpu: 'Processador de teste', cores: 4, logicalProcessors: 8, ramGb: 4, os: 'Windows de teste', disks: [{ model: 'Hard Disk', mediaType: 'Fixed hard disk media', sizeGb: 500 }], gpus: ['Vídeo de teste'] }) });
  }, token);
  await page.locator('#diagnostic-check-now').click();
  await expect(page.locator('#diagnostic-dialog')).toBeHidden();
  await expect(page.locator('#diag-headline')).toContainText('SSD');
  await expect(page.locator('#diag-memory')).toContainText('4 GB');
  await expect(page.locator('#diag-action')).toHaveAttribute('href', /upgrade%20de%20SSD/);
  const events = await page.evaluate(() => window.dataLayer.filter((item) => item?.event).map((item) => item.event));
  expect(events).toContain('diagnostic_start');
  expect(events).toContain('diagnostic_complete');
});
