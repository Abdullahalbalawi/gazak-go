import { test, expect } from '@playwright/test';

async function resetDemo(page) {
  page.on('pageerror', (error) => console.log(`[STAGE21_PAGEERROR] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`[STAGE21_CONSOLE] ${message.text()}`);
  });

  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('gazak_demo_role', 'customer');
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  console.log(`[STAGE21_URL] ${page.url()}`);
  console.log(`[STAGE21_TITLE] ${await page.title()}`);
  console.log(`[STAGE21_BODY] ${(await page.locator('body').innerText()).slice(0, 3000)}`);
  console.log(`[STAGE21_ROOT_HTML] ${(await page.locator('#root').innerHTML()).slice(0, 3000)}`);
  await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('المنتجات', { exact: true })).toBeVisible({ timeout: 15_000 });
}

async function switchRole(page, label, path) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll('/', '\\/')}$`));
}

async function createCashOrder(page) {
  await page.getByRole('button', { name: 'أضف للسلة', exact: true }).first().click();
  await page.getByRole('link', { name: 'السلة', exact: true }).click();
  await expect(page.getByText('سلة التسوق', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /إتمام الطلب/ }).click();
  await page.getByLabel('رقم الجوال', { exact: true }).fill('0500000000');
  await page.getByLabel('الاسم', { exact: true }).fill('عميل اختبار Stage 21');
  await page.locator('#address').fill('العلا - عنوان اختبار Stage 21');
  await expect(page.getByText('نقداً عند الاستلام', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /تأكيد الطلب/ }).click();
  await expect(page.getByText('تم استلام طلبك بنجاح!', { exact: true })).toBeVisible();
  return page.url().split('/').pop();
}

test.describe('Stage 21 - final demo end-to-end', () => {
  test('customer checkout, invoice, tracking and cancellation release', async ({ page }) => {
    await resetDemo(page);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gazak_demo_inventory')));

    const orderId = await createCashOrder(page);
    expect(orderId).toMatch(/^DEMO-/);

    await expect(page.getByText('الفاتورة', { exact: true })).toBeVisible();
    await expect(page.getByText('قيد الانتظار', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: /متابعة الطلب/ }).click();
    await expect(page).toHaveURL(new RegExp(`/track-order/${orderId}$`));
    await expect(page.getByText('متابعة الطلب', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'طلباتي', exact: true }).click();
    await expect(page.getByText('طلباتي', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء', exact: true }).first().click();
    await expect(page.getByText('تم إلغاء الطلب', { exact: true })).toBeVisible();

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('gazak_demo_inventory')));
    expect(after['demo-gas-11']).toBe(before['demo-gas-11']);
  });

  test('distributor lifecycle accepts, prepares and marks ready', async ({ page }) => {
    await resetDemo(page);
    await createCashOrder(page);

    await page.getByRole('link', { name: 'الرئيسية', exact: true }).click();
    await switchRole(page, 'الموزع', '/distributor');

    const card = page.locator('div.border.rounded-xl.p-4').filter({ hasText: 'عميل اختبار Stage 21' }).first();
    await expect(card.getByText('جديد', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'قبول الطلب', exact: true }).click();
    await expect(card.getByText('مقبول', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'بدء التجهيز', exact: true }).click();
    await expect(card.getByText('قيد التجهيز', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'جاهز للتوصيل', exact: true }).click();
    await expect(card.getByText('جاهز', { exact: true })).toBeVisible();
  });

  test('Smart Dispatch rejects a conflicting ETA and accepts a safe same-route assignment', async ({ page }) => {
    await resetDemo(page);
    await switchRole(page, 'المدير', '/admin');

    const blocked = page.locator('div.border.rounded-xl.p-4').filter({ hasText: 'طلب يجب رفض إسناده' }).first();
    await blocked.getByRole('combobox').selectOption('demo-driver-001');
    await blocked.getByRole('button', { name: 'إسناد', exact: true }).click();
    await expect(page.getByText('تم رفض الإسناد الذكي', { exact: true })).toBeVisible();
    await expect(blocked.getByText('جاهز', { exact: true })).toBeVisible();

    const safe = page.locator('div.border.rounded-xl.p-4').filter({ hasText: 'عميل تجريبي 2' }).first();
    await safe.getByRole('combobox').selectOption('demo-driver-001');
    await safe.getByRole('button', { name: 'إسناد', exact: true }).click();
    await expect(page.getByText('تم الإسناد الذكي', { exact: true })).toBeVisible();
    await expect(safe.getByText('مسند', { exact: true })).toBeVisible();
  });

  test('driver sees only assigned orders and completes delivery lifecycle', async ({ page }) => {
    await resetDemo(page);
    await switchRole(page, 'المدير', '/admin');

    const safe = page.locator('div.border.rounded-xl.p-4').filter({ hasText: 'عميل تجريبي 2' }).first();
    await safe.getByRole('combobox').selectOption('demo-driver-001');
    await safe.getByRole('button', { name: 'إسناد', exact: true }).click();
    await expect(safe.getByText('مسند', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'السائق', exact: true }).click();
    await expect(page).toHaveURL(/\/driver$/);
    await expect(page.getByText('عميل تجريبي 2', { exact: true })).toBeVisible();
    await expect(page.getByText('طلب يجب رفض إسناده', { exact: true })).toHaveCount(0);

    const assigned = page.locator('div.border.rounded-xl.p-4').filter({ hasText: 'عميل تجريبي 2' }).first();
    await assigned.getByRole('button', { name: 'بدء التوصيل', exact: true }).click();
    await expect(assigned.getByText('خرج للتوصيل', { exact: true })).toBeVisible();
    await assigned.getByRole('button', { name: 'وصلت للعميل', exact: true }).click();
    await expect(assigned.getByText('وصل السائق', { exact: true })).toBeVisible();
    await assigned.getByRole('button', { name: 'تم التسليم', exact: true }).click();
    await expect(assigned.getByText('تم التسليم', { exact: true })).toBeVisible();
    await expect(assigned.getByText('اكتملت دورة الطلب التجريبية', { exact: true })).toBeVisible();
  });
});
