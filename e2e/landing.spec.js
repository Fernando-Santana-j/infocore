const { test, expect } = require('@playwright/test');

test('landing page is responsive, functional and free of runtime errors', async ({ page }, testInfo) => {
  const errors = [];
  const failed = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`));
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
  for (const selector of ['#servicos', '#diferenciais', '#processo', '#trabalhos', '#avaliacoes', '#produtos']) {
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

test('PowerShell bridge receives hardware and adapts the recommendation', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.locator('[data-consent="reject"]').click();
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#diag-configure')).toBeHidden();
    await expect(page.locator('#device-stage')).toHaveClass(/is-phone/);
    return;
  }
  await page.locator('#diag-configure').click();
  await expect(page.locator('#diagnostic-dialog')).toBeVisible();
  await expect(page.locator('#diagnostic-download')).toHaveAttribute('href', /device-diagnostics\/[^/]+\/launcher/);
  const launcher = await page.locator('#diagnostic-download').getAttribute('href');
  const token = launcher.split('/')[3];
  const endpoint = `/api/device-diagnostics/${token}/script`;
  const script = await page.evaluate((url) => fetch(url).then((response) => response.text()), endpoint);
  expect(script).toContain('Win32_Processor');
  expect(script).not.toContain('SerialNumber');
  expect(launcher).toContain('/launcher');
  await page.evaluate(async (diagnosticToken) => {
    await fetch(`/api/device-diagnostics/${diagnosticToken}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpu: 'Processador de teste', cores: 4, logicalProcessors: 8, ramGb: 4, os: 'Windows de teste', disks: [{ model: 'Hard Disk', mediaType: 'Fixed hard disk media', sizeGb: 500 }], gpus: ['Vídeo de teste'] }) });
  }, token);
  await page.locator('#diagnostic-check-now').click();
  await expect(page.locator('#diagnostic-dialog')).toBeHidden();
  await expect(page.locator('#diag-headline')).toContainText('SSD');
  await expect(page.locator('#diag-memory')).toContainText('4 GB');
  await expect(page.locator('#diag-cta')).toHaveAttribute('href', /upgrade%20de%20SSD/);
  const events = await page.evaluate(() => window.dataLayer.filter((item) => item?.event).map((item) => item.event));
  expect(events).toContain('diagnostic_start');
  expect(events).toContain('diagnostic_complete');
});
