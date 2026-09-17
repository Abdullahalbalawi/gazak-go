import { test, expect } from '@playwright/test';

const CUSTOMER = 'عميل Stage 21';
const FLOW_CUSTOMER = 'عميل دورة الطلب';

async function startDemo(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'المنتجات' })).toBeVisible();
}

async function createCashOrder(page, customerName) {
  await page.locator('[aria-label="أضف للسلة"]').first().click();
  await page.goto('/cart');
  await page.getByText(/^إتمام الطلب \(/).click();
  await expect(page.getByRole('heading', { name: 'إتمام الطلب' })).toBeVisible();
  await page.locator('form input[type="tel"]').fill('0500000099');
  await page.locator('form input').nth(1).fill(customerName);
  await page.locator('#address').fill('العلا - حي الاختبار - شارع الاختبار');
  await expect(page.getByText('الدفع الإلكتروني سيظهر بعد ربط بوابة الدفع.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'بطاقة' })).toHaveCount(0);
  await page.getByRole('button', { name: /تأكيد الطلب/ }).click();
  await expect(page.getByText('تم استلام طلبك بنجاح!')).toBeVisible();
  const id = page.url().split('/').pop();
  const stored = await page.evaluate((orderId) => JSON.parse(localStorage.getItem('gazak_demo_orders') || '[]').find((order) => order.id === orderId), id);
  expect(stored?.customer_name).toBe(customerName);
  return id;
}

function orderCard(page, customerName) {
  return page.getByText(customerName).locator('xpath=ancestor::div[contains(@class,"rounded-")][1]');
}

test('Stage 21: customer cancellation, order lifecycle, smart dispatch and driver delivery', async ({ page }) => {
  await startDemo(page);

  const inventoryBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gazak_demo_inventory'))['demo-gas-11']);
  const cancelledId = await createCashOrder(page, CUSTOMER);
  await page.goto('/my-orders');
  await expect(page.getByRole('heading', { name: 'طلباتي' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'إلغاء' })).toHaveCount(1);
  await page.getByRole('button', { name: 'إلغاء' }).click();
  await expect(page.getByText('تم إلغاء الطلب', { exact: true })).toBeVisible();
  const cancelledOrder = await page.evaluate((id) => JSON.parse(localStorage.getItem('gazak_demo_orders') || '[]').find((order) => order.id === id), cancelledId);
  expect(cancelledOrder.status).toBe('CANCELLED');
  const inventoryAfterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('gazak_demo_inventory'))['demo-gas-11']);
  expect(inventoryAfterCancel).toBe(inventoryBefore);

  await page.goto('/');
  const orderId = await createCashOrder(page, FLOW_CUSTOMER);
  await page.goto('/');

  await page.getByRole('button', { name: 'الموزع' }).click();
  await expect(page.getByText('لوحة الموزع التجريبية')).toBeVisible();
  const distributorCard = orderCard(page, FLOW_CUSTOMER);
  await distributorCard.getByRole('button', { name: 'قبول الطلب' }).click();
  await distributorCard.getByRole('button', { name: 'بدء التجهيز' }).click();
  await distributorCard.getByRole('button', { name: 'جاهز للتوصيل' }).click();

  await page.goto('/');
  await page.getByRole('button', { name: 'المدير' }).click();
  await expect(page.getByText('لوحة الإدارة التجريبية')).toBeVisible();
  const adminCard = orderCard(page, FLOW_CUSTOMER);
  await adminCard.locator('select').selectOption('demo-driver-001');
  await adminCard.getByRole('button', { name: 'إسناد' }).click();
  await expect(page.getByText('تم الإسناد الذكي', { exact: true })).toBeVisible();

  await page.goto('/driver');
  await expect(page.getByText(FLOW_CUSTOMER)).toBeVisible();
  await expect(page.getByText('عميل تجريبي 2')).toHaveCount(0);
  await page.getByRole('button', { name: 'قبول الطلب وبدء التوصيل' }).click();
  await expect(page.getByRole('button', { name: 'وصلت للعميل' })).toBeVisible();
  await page.getByRole('button', { name: 'وصلت للعميل' }).click();
  await expect(page.getByRole('button', { name: 'تم التسليم' })).toBeVisible();
  await page.getByRole('button', { name: 'تم التسليم' }).click();

  const finalOrder = await page.evaluate((id) => JSON.parse(localStorage.getItem('gazak_demo_orders')).find((order) => order.id === id), orderId);
  expect(finalOrder.status).toBe('DELIVERED');
});

test('Stage 21: products, inventory, users and Smart Dispatch edge cases', async ({ page }) => {
  await startDemo(page);
  await page.getByRole('button', { name: 'المدير' }).click();
  await expect(page.getByText('لوحة الإدارة التجريبية')).toBeVisible();

  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'المنتجات' })).toBeVisible();
  await page.getByPlaceholder('اسم المنتج').fill('منتج اختبار Stage 21');
  await page.getByPlaceholder('السعر', { exact: true }).fill('35');
  await page.getByPlaceholder('المخزون', { exact: true }).fill('7');
  await page.getByPlaceholder('حد المخزون', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('منتج اختبار Stage 21')).toBeVisible();

  await page.goto('/admin/inventory');
  const seedInventoryCard = page.getByText('أسطوانة غاز 11 كجم').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await expect(seedInventoryCard.getByText(/متاح: 18/)).toBeVisible();
  await seedInventoryCard.locator('input[type="number"]').fill('3');
  await seedInventoryCard.getByRole('button', { name: 'إضافة' }).click();
  await expect(seedInventoryCard.getByText(/متاح: 21/)).toBeVisible();

  await page.goto('/admin/users');
  await expect(page.getByText('مدير تجريبي')).toBeVisible();
  await expect(page.getByText('موزع تجريبي')).toBeVisible();
  await expect(page.getByText('سائق تجريبي')).toBeVisible();
  await expect(page.getByText('عميل تجريبي')).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'الطلبات', exact: true })).toBeVisible();

  await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('gazak_demo_orders') || '[]');
    const active = orders.find((order) => order.id === 'DEMO-SEED-ACTIVE');
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
  await expect(page.getByText('تم رفض الإسناد الذكي', { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const orders = JSON.parse(localStorage.getItem('gazak_demo_orders') || '[]');
    const active = orders.find((order) => order.id === 'DEMO-SEED-ACTIVE');
    if (active) {
      active.driver_id = 'demo-driver-002';
      active.route_group = 'ALULA-CENTER';
      active.status = 'OUT_FOR_DELIVERY';
      active.estimated_delivery_at = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    }
    const ready = orders.find((order) => order.id === 'DEMO-SEED-READY');
    if (ready) ready.estimated_delivery_at = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const blocked = orders.find((order) => order.id === 'DEMO-SEED-BLOCKED');
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
  await expect(page.getByText('تم الإسناد الذكي', { exact: true })).toBeVisible();

  const blockedCard = orderCard(page, 'طلب يجب رفض إسناده');
  await blockedCard.locator('select').selectOption('demo-driver-002');
  await blockedCard.getByRole('button', { name: 'إسناد' }).click();
  await expect(page.getByText('تم رفض الإسناد الذكي', { exact: true })).toBeVisible();
});

test('Stage 21: authentication entry points render cleanly', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/register');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading').first()).toBeVisible();
});
