const { test, expect } = require('@playwright/test');

test('diagnostic cards never intersect and connectors terminate on components', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.locator('[data-consent="reject"]').click();
  const mobile = testInfo.project.name === 'mobile';
  const notebook = testInfo.project.name === 'reduced-motion';
  if (mobile) await expect(page.locator('#device-stage')).toHaveClass(/is-phone/);
  if (!mobile) {
    await page.locator('#diag-configure').click();
    await expect(page.locator('#diagnostic-download')).toHaveAttribute('href', /launcher/);
    const url = await page.locator('#diagnostic-download').getAttribute('href');
    await page.request.post(url.replace('/launcher', ''), { data: {
      cpu: 'Intel Core i7-14700K 20-Core Processor with a deliberately long description',
      ramGb: 32, gpus: ['NVIDIA GeForce RTX 4070 Ti SUPER 16 GB GDDR6X'],
      disks: [{ model: 'Samsung SSD 990 PRO NVMe', sizeGb: 2000 }], model: notebook ? 'Dell Inspiron 15 3530' : 'Custom workstation', deviceType: notebook ? 'notebook' : 'pc',
    } });
    await page.locator('#diagnostic-check-now').click();
    await expect(page.locator('#diag-cta')).toContainText('Enviar diagnóstico');
    await expect(page.locator('#diagnostic-dialog')).toBeHidden();
    expect(decodeURIComponent(await page.locator('#diag-cta').getAttribute('href'))).toContain('NVIDIA GeForce');
  }
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('#diagnostic').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => {
      const stage = document.querySelector('#device-stage');
      const boxes = [...stage.querySelectorAll('.diag-node')].filter(n => getComputedStyle(n).display !== 'none').map(n => n.getBoundingClientRect());
      const bounds = stage.getBoundingClientRect();
      return boxes.every((a, i) => a.left >= bounds.left && a.right <= bounds.right && boxes.slice(i + 1).every(b => a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
    })).toBe(true);
    if (!mobile) {
      await expect.poll(() => page.evaluate(() => {
        const stage = document.querySelector('#device-stage').getBoundingClientRect();
        const notebook = document.querySelector('#device-stage').classList.contains('is-notebook');
        return [['cpu','.socket'],['memory','.ram-b'],['gpu','.gpu'],['storage','.m2']].every(([name, selector]) => {
          const target = document.querySelector(notebook ? '.notebook-screen' : selector).getBoundingClientRect();
          const dot = document.querySelector(`path[data-component="${name}"]`).nextElementSibling;
          const x = notebook ? (['cpu','gpu'].includes(name) ? .3 : .7) : name === 'gpu' ? .25 : name === 'storage' ? .9 : .5;
          const y = notebook ? (['cpu','memory'].includes(name) ? .3 : .7) : .5;
          return Math.abs(Number(dot.getAttribute('cx')) - (target.x + target.width * x - stage.x)) < 1 && Math.abs(Number(dot.getAttribute('cy')) - (target.y + target.height * y - stage.y)) < 1;
        });
      })).toBe(true);
    }
    if ([390, 1440].includes(width)) await page.locator('#diagnostic').screenshot({ path: `/tmp/diagnostic-${testInfo.project.name}-${width}.png` });
  }
});
