import { test, expect } from '@playwright/test';

const CUSTOMER = 'عميل Stage 21';
const FLOW_CUSTOMER = 'عميل دورة الطلب';

async function startDemo(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText('المنتجات')).toBeVisible();
}

async function createCashOrder(page, customerName) {
  await page.locator('[aria-label="أضف للسلة"]').first().click();
  await page.getByRole('button', { name: /إتمام الطلب/ }).click();
  await expect(page.getByText('إتمام الطلب')).toBeVisible();
  await page.locator('input[type="tel"]').fill('0500000099');
  await page.locator('input').nth(1).fill(customerName);
  await page.locator('#address').fill('العلا - حي الاختبار - شارع الاختبار');
  await expect(page.getByText('الدفع الإلكتروني سيظهر بعد ربط بوابة الدفع.')).toBeVisible();
  await expect(page.getByText('بطاقة')).toHaveCount(0);
  await page.getByRole('button', { name: /تأكيد الطلب/ }).click();
  await expect(page.getByText('تم استلام طلبك بنجاح!')).toBeVisible();
  return page.url().split('/').pop();
}

function orderCard(page, customerName) {
  return page.getByText(customerName).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
}

test('Stage 21: customer cancellation, order lifecycle, smart dispatch and driver delivery', async ({ page }) => {
  await startDemo(page);

  const inventoryBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gazak_demo_inventory'))['demo-gas-11']);
  await createCashOrder(page, CUSTOMER);
  await page.goto('/my-orders');
  await expect(page.getByText(CUSTOMER)).toBeVisible();
  await page.getByText(CUSTOMER).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').getByRole('button', { name: 'إلغاء' }).click();
  await expect(page.getByText('تم إلغاء الطلب')).toBeVisible();
  const inventoryAfterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('gazak_demo_inventory'))['demo-gas-11']);
  expect(inventoryAfterCancel).toBe(inventoryBefore);

  await page.goto('/');
  const orderId = await createCashOrder(page, FLOW_CUSTOMER);

  await page.goto('/distributor');
  const distributorCard = orderCard(page, FLOW_CUSTOMER);
  await distributorCard.getByRole('button', { name: 'قبول الطلب' }).click();
  await distributorCard.getByRole('button', { name: 'بدء التجهيز' }).click();
  await distributorCard.getByRole('button', { name: 'جاهز للتوصيل' }).click();

  await page.getByRole('button', { name: 'المدير' }).click();
  await expect(page.getByText('لوحة الإدارة التجريبية')).toBeVisible();
  const adminCard = orderCard(page, FLOW_CUSTOMER);
  await adminCard.locator('select').selectOption('demo-driver-001');
  await adminCard.getByRole('button', { name: 'إسناد' }).click();
  await expect(page.getByText('تم الإسناد الذكي')).toBeVisible();

  await page.getByRole('button', { name: 'السائق' }).click();
  await expect(page.getByText(FLOW_CUSTOMER)).toBeVisible();
  await expect(page.getByText('طلب يجب رفض إسناده')).toHaveCount(0);
  const driverCard = orderCard(page, FLOW_CUSTOMER);
  await driverCard.getByRole('button', { name: 'بدء التوصيل' }).click();
  await driverCard.getByRole('button', { name: 'وصلت للعميل' }).click();
  await driverCard.getByRole('button', { name: 'تم التسليم' }).click();
  await expect(driverCard.getByText('اكتملت دورة الطلب التجريبية')).toBeVisible();

  const finalOrder = await page.evaluate((id) => JSON.parse(localStorage.getItem('gazak_demo_orders')).find((o) => o.id === id), orderId);
  expect(finalOrder.status).toBe('DELIVERED');
});

test('Stage 21: products, inventory, users and Smart Dispatch edge cases', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('button', { name: 'المدير' }).click();
  await expect(page.getByText('لوحة الإدارة التجريبية')).toBeVisible();

  await page.goto('/admin/products');
  await expect(page.getByText('المنتجات')).toBeVisible();
  await page.getByPlaceholder('اسم المنتج').fill('منتج اختبار Stage 21');
  await page.getByPlaceholder('السعر').fill('35');
  await page.getByPlaceholder('المخزون').fill('7');
  await page.getByPlaceholder('حد المخزون').fill('2');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('منتج اختبار Stage 21')).toBeVisible();

  await page.goto('/admin/inventory');
  const productCard = page.getByText('منتج اختبار Stage 21').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await expect(productCard.getByText(/متاح: 7/)).toBeVisible();
  await productCard.locator('input[type="number"]').fill('3');
  await productCard.getByRole('button', { name: 'إضافة' }).click();
  await expect(productCard.getByText(/متاح: 10/)).toBeVisible();

  await page.goto('/admin/users');
  await expect(page.getByText('مدير تجريبي')).toBeVisible();
  await expect(page.getByText('موزع تجريبي')).toBeVisible();
  await expect(page.getByText('سائق تجريبي')).toBeVisible();
  await expect(page.getByText('عميل تجريبي')).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByText('الطلبات')).toBeVisible();

  // Different-route conflict must be rejected.
  await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('gazak_demo_orders') || '[]');
    const active = orders.find((o) => o.id === 'DEMO-SEED-ACTIVE');
    if (active) {
      active.driver_id = 'demo-driver-001';
      active.route_group = 'ALULA-SOUTH';
      active.estimated_delivery_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
    localStorage.setItem('gazak_demo_orders', JSON.stringify(orders));
  });
  await page.reload();
  const differentRoute = orderCard(page, 'عميل تجريبي 2');
  await differentRoute.locator('select').selectOption('demo-driver-001');
  await differentRoute.getByRole('button', { name: 'إسناد' }).click();
  await expect(page.getByText('تم رفض الإسناد الذكي')).toBeVisible();

  // Same-route with later ETA is allowed.
  await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('gazak_demo_orders') || '[]');
    const active = orders.find((o) => o.id === 'DEMO-SEED-ACTIVE');
    if (active) {
      active.driver_id = 'demo-driver-002';
      active.route_group = 'ALULA-CENTER';
      active.status = 'OUT_FOR_DELIVERY';
      active.estimated_delivery_at = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    }
    const ready = orders.find((o) => o.id === 'DEMO-SEED-READY');
    if (ready) ready.estimated_delivery_at = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const blocked = orders.find((o) => o.id === 'DEMO-SEED-BLOCKED');
    if (blocked) {
      blocked.driver_id = undefined;
      blocked.status = 'READY';
      blocked.route_group = 'ALULA-CENTER';
      blocked.estimated_delivery_at = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    }
    localStorage.setItem('gazak_demo_orders', JSON.stringify(orders));
  });
  await page.reload();

  const readyCard = orderCard(page, 'عميل تجريبي 2');
  await readyCard.locator('select').selectOption('demo-driver-002');
  await readyCard.getByRole('button', { name: 'إسناد' }).click();
  await expect(page.getByText('تم الإسناد الذكي')).toBeVisible();

  const blockedCard = orderCard(page, 'طلب يجب رفض إسناده');
  await blockedCard.locator('select').selectOption('demo-driver-002');
  await blockedCard.getByRole('button', { name: 'إسناد' }).click();
  await expect(page.getByText('تم رفض الإسناد الذكي')).toBeVisible();
});

test('Stage 21: authentication entry points render cleanly', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/register');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading').first()).toBeVisible();
});
