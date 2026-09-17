import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(`[Stage 21] ${message}`); };

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const sourceFiles = walk(path.join(root, 'src')).filter((file) => /\.(js|jsx|ts|tsx)$/.test(file));
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!/@base44\/|base44\./i.test(source), `Base44 reference remains in ${path.relative(root, file)}`);
}

const migrationsDir = path.join(root, 'supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter((name) => /^\d{3}_.*\.sql$/.test(name));
const numbers = migrations.map((name) => Number(name.slice(0, 3)));
for (let n = 1; n <= 13; n += 1) assert(numbers.includes(n), `Migration ${String(n).padStart(3, '0')} is missing`);

const initial = read('supabase/migrations/001_initial_schema.sql');
const workflows = read('supabase/migrations/002_order_workflows.sql');
const dispatch = read('supabase/migrations/004_smart_dispatch.sql');
const inventory = read('supabase/migrations/005_inventory_management.sql');
const billing = read('supabase/migrations/013_payment_billing_foundation.sql');

for (const role of ['customer', 'distributor', 'driver', 'admin']) assert(initial.includes(`'${role}'`), `Role ${role} missing`);
for (const table of ['profiles', 'products', 'orders', 'order_items', 'order_history', 'notifications']) {
  assert(initial.includes(`create table public.${table}`), `Table ${table} missing`);
  assert(initial.includes(`alter table public.${table} enable row level security`), `RLS missing for ${table}`);
}
for (const fn of ['public.create_order', 'public.transition_order']) assert(workflows.includes(`function ${fn}`), `${fn} missing`);
assert(dispatch.includes('function public.assign_order_smart'), 'Smart Dispatch RPC missing');
assert(inventory.includes('function public.manage_inventory'), 'Inventory RPC missing');
assert(billing.includes('function public.ensure_invoice_for_order'), 'Invoice RPC missing');
assert(billing.includes('function public.record_payment_result'), 'Payment RPC missing');
assert(billing.includes('if p_amount <> v_order.total then raise exception'), 'Payment amount guard missing');
assert(billing.includes('on conflict (provider, provider_reference)'), 'Payment idempotency path missing');

const checkout = read('src/pages/customer/Checkout.jsx');
assert(checkout.includes('VITE_CARD_PAYMENTS_ENABLED'), 'Card feature flag missing');
assert(checkout.includes('الدفع الإلكتروني غير مفعّل حالياً'), 'Card-disabled guard missing');

const demo = read('src/lib/demoMode.js');
for (const role of ['customer', 'distributor', 'driver', 'admin']) assert(demo.includes(`${role}:`), `Demo role ${role} missing`);
assert(demo.includes('assignDemoOrderSmart'), 'Demo Smart Dispatch missing');
assert(demo.includes('cancelDemoOrder'), 'Demo cancellation missing');

console.log(`[Stage 21] Source validation passed (${sourceFiles.length} source files).`);
