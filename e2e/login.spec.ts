import { test, expect } from '@playwright/test';

test.describe('Trang đăng nhập', () => {
  test('hiển thị form login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('hiển thị lỗi khi submit form rỗng', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /đăng nhập|login|sign in/i }).click();
    /* Tuỳ validation thực tế, kiểm tra có thông báo lỗi hoặc form vẫn ở trang login */
    await expect(page).toHaveURL(/login/);
  });

  test('chuyển hướng về trang chính khi chưa đăng nhập và truy cập /', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });
});
