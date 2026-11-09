import { test, expect } from '@playwright/test';

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test('開始畫面與 3D 場景正常載入', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('台北市長選戰');
  await expect(page.locator('#app canvas')).toBeVisible();
  await expect(page.locator('.tile-label', { hasText: '台北101' })).toHaveCount(1);
  await expect(page.locator('.party')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('完整玩完一局並看到開票結果', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?speed=8');
  await page.fill('#in-name', '測試員');
  await page.selectOption('#in-ai', '1');
  await page.selectOption('#in-rounds', '10');
  await page.click('#btn-start');
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('.pcard')).toHaveCount(2);

  const winner = page.locator('#el-final .winner');
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline && !(await winner.isVisible())) {
    const roll = page.locator('#action-bar.show #act-roll');
    if (await roll.isVisible()) await roll.click().catch(() => {});
    const opt = page.locator(
      '.modal-wrap.show .opt:not([disabled]), .modal-wrap.show #card-ok, .modal-wrap.show #poll-ok, .modal-wrap.show .dpick',
    ).first();
    if (await opt.isVisible()) await opt.click().catch(() => {});
    await page.waitForTimeout(150);
  }

  await expect(winner).toContainText('當選台北市長');
  await expect(page.locator('.el-cell')).toHaveCount(12);
  await expect(page.locator('#week')).toContainText('投票日');
  expect(errors).toEqual([]);
});
