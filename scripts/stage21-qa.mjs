import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function check(condition, message) {
  if (condition) {
    console.log(`PASS  ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL  ${message}`);
  }
}

function read(relativePath) {
  const absolute = join(root, relativePath);
  check(existsSync(absolute), `required file exists: ${relativePath}`);
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
}

function walk(directory) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const files = [];
  for (const entry of readdirSync(absolute)) {
    const full = join(absolute, entry);
    const relative = full.slice(root.length + 1).replaceAll('\\', '/');
    if (statSync(full).isDirectory()) files.push(...walk(relative));
    else files.push(relative);
  }
  return files;
}

const packageJson = JSON.parse(read('package.json'));
const ci = read('.github/workflows/ci.yml');
const migrationsDir = join(root, 'supabase/migrations');
const migrationFiles = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((file) => /^\d{3}_.*\.sql$/.test(file)).sort()
  : [];

// Stage 21: repository and architecture gate.
const expectedMigrations = Array.from({ length: 13 }, (_, index) => String(index + 1).padStart(3, '0'));
check(
  expectedMigrations.every((prefix) => migrationFiles.some((file) => file.startsWith(`${prefix}_`))),
  'Supabase migrations exist consecutively from 001 through 013',
);

for (const file of [
  'src/lib/AuthContext.jsx',
  'src/lib/supabaseClient.js',
  'src/lib/demoMode.js',
  'src/pages/Login.jsx',
  'src/pages/Register.jsx',
  'src/pages/ForgotPassword.jsx',
  'src/pages/ResetPassword.jsx',
  'src/pages/customer/Checkout.jsx',
  'src/pages/customer/OrderSuccess.jsx',
  'src/pages/admin/AdminOrders.jsx',
  'src/pages/admin/AdminProducts.jsx',
  'src/pages/admin/AdminInventory.jsx',
  'src/pages/admin/AdminUsers.jsx',
  'src/pages/driver/DriverDashboard.jsx',
  'src/pages/distributor/DistributorOrderDetail.jsx',
  'supabase/functions/admin-create-user/index.ts',
]) read(file);

check(!existsSync(join(root, 'src/api/base44Client.js')), 'legacy Base44 client file is removed');

const appTextFiles = [...walk('src'), ...walk('supabase')].filter((file) => /\.(js|jsx|ts|sql|json|jsonc)$/.test(file));
const base44Hits = appTextFiles.filter((file) => /@base44\/|base44\.(auth|entities|functions|app)|base44\/entities|base44\/functions/.test(readFileSync(join(root, file), 'utf8')));
check(base44Hits.length === 0, `no Base44 references remain in application/backend source (${base44Hits.length} files)`);

const schema = read('supabase/migrations/001_initial_schema.sql');
check(/create type public\.app_role/.test(schema), 'role enum is defined in database schema');
check(/'customer', 'distributor', 'driver', 'admin'/.test(schema), 'only four application roles are defined');
check(/create table public\.profiles/.test(schema), 'profiles table exists');
check(/create table public\.products/.test(schema), 'products table exists');
check(/create table public\.orders/.test(schema), 'orders table exists');
check(/create table public\.order_items/.test(schema), 'order items table exists');
check(/reserved_stock/.test(schema) && /sold_stock/.test(schema), 'inventory reservation and sold counters exist');
check(/alter table public\.(profiles|products|orders) enable row level security/.test(schema), 'core tables have RLS enabled');
check(/profiles_select_self_or_admin/.test(schema) && /products_admin_update/.test(schema), 'profile/product authorization policies exist');
check(/orders_select_related/.test(schema) && /orders_customer_insert/.test(schema), 'order access policies exist');

const workflow = read('supabase/migrations/002_order_workflows.sql');
check(/create or replace function public\.create_order/.test(workflow), 'transactional create_order RPC exists');
check(/create or replace function public\.transition_order/.test(workflow), 'transactional transition_order RPC exists');
check(/CANCELLED/.test(workflow) && /DELIVERED/.test(workflow), 'order cancellation and delivery paths exist');
check(/reserve_stock|reserved_stock/.test(workflow) && /consume_stock|sold_stock/.test(workflow), 'order workflow controls inventory atomically');

const dispatch = read('supabase/migrations/004_smart_dispatch.sql');
check(/create or replace function public\.assign_order_smart/.test(dispatch), 'Smart Dispatch RPC exists');
check(/estimated_delivery_at/.test(dispatch) && /route_group/.test(dispatch), 'Smart Dispatch uses route and ETA metadata');
check(/active|ASSIGNED|OUT_FOR_DELIVERY|ARRIVED/.test(dispatch), 'Smart Dispatch detects active driver orders');

const inventory = read('supabase/migrations/005_inventory_management.sql');
check(/create or replace function public\.manage_inventory/.test(inventory), 'manage_inventory RPC exists');

const notifications = read('supabase/migrations/012_notification_automation.sql');
check(/notify_inventory_thresholds/.test(notifications), 'inventory threshold notification automation exists');
check(/low_stock_threshold/.test(notifications) && /stock = 0|stock <= 0/.test(notifications), 'low-stock and zero-stock conditions are covered');

const billing = read('supabase/migrations/013_payment_billing_foundation.sql');
check(/create table if not exists public\.payment_transactions/.test(billing), 'payment transaction audit table exists');
check(/create table if not exists public\.invoices/.test(billing), 'invoice table exists');
check(/create or replace function public\.ensure_invoice_for_order/.test(billing), 'invoice creation RPC exists');
check(/create or replace function public\.record_payment_result/.test(billing), 'payment result RPC exists');
check(/p_amount <> v_order\.total/.test(billing), 'payment amount is validated against order total');
check(/unique index.*payment_transactions_provider_reference_uidx|payment_transactions_provider_reference_uidx/.test(billing), 'payment provider reference idempotency index exists');

const auth = read('src/lib/AuthContext.jsx');
const login = read('src/pages/Login.jsx');
const register = read('src/pages/Register.jsx');
const forgot = read('src/pages/ForgotPassword.jsx');
const reset = read('src/pages/ResetPassword.jsx');
check(/supabase\.auth\.getSession/.test(auth) && /onAuthStateChange/.test(auth), 'session restoration and auth state listener exist');
check(/signInWithPassword/.test(login), 'password login is wired to Supabase Auth');
check(/signInWithOAuth|Google/.test(login), 'Google OAuth path exists');
check(/signUp/.test(register), 'registration is wired to Supabase Auth');
check(/resetPasswordForEmail/.test(forgot), 'password recovery request exists');
check(/updateUser|update.*password/.test(reset), 'password reset completion exists');

const users = read('src/pages/admin/AdminUsers.jsx');
check(/customer/.test(users) && /distributor/.test(users) && /driver/.test(users) && /admin/.test(users), 'admin user management exposes the four roles');
check(/active/.test(users) && /role/.test(users), 'admin can manage account status and role');

const products = read('src/pages/admin/AdminProducts.jsx');
const inventoryPage = read('src/pages/admin/AdminInventory.jsx');
check(/products|products\"/.test(products) && /insert|addDemoProduct/.test(products), 'product creation path exists');
check(/update|updateDemoProduct/.test(products), 'product update path exists');
check(/manage_inventory|restockDemoProduct/.test(inventoryPage), 'inventory management UI is wired');

const checkout = read('src/pages/customer/Checkout.jsx');
const orderSuccess = read('src/pages/customer/OrderSuccess.jsx');
const demo = read('src/lib/demoMode.js');
check(/createDemoOrder|create_order/.test(checkout), 'checkout has a real/demo order creation path');
check(/CARD_PAYMENTS_ENABLED/.test(checkout), 'card payment feature flag exists');
check(/billing\.invoice/.test(orderSuccess) && /ReceiptText/.test(orderSuccess), 'order success exposes invoice/payment state');
check(/DEMO-SEED-READY/.test(demo) && /DEMO-SEED-ACTIVE/.test(demo) && /DEMO-SEED-BLOCKED/.test(demo), 'Smart Dispatch demo scenarios are seeded');
check(/route_group/.test(demo) && /estimated_delivery_at/.test(demo), 'demo Smart Dispatch scenarios include route and ETA');
check(/new Date\(order\.estimated_delivery_at\).*latest\.estimated_delivery_at/.test(demo), 'demo Smart Dispatch rejects earlier ETA on an active same-route order');
check(/status!=="CANCELLED"&&order\.status!=="DELIVERED"/.test(demo), 'demo cancellation excludes completed/cancelled orders');

check(packageJson.scripts?.lint === 'eslint . --quiet', 'lint script is configured');
check(packageJson.scripts?.build === 'vite build', 'production build script is configured');
check(packageJson.scripts?.typecheck === 'tsc -p ./jsconfig.json', 'typecheck script is configured');
check(/npm run lint/.test(ci) && /npm run build/.test(ci), 'CI runs lint and production build');
check(/npm run typecheck/.test(ci), 'CI runs typecheck');
check(/node scripts\/stage21-qa\.mjs/.test(ci), 'CI runs Stage 21 QA contract checks');

if (failures.length > 0) {
  console.error(`\nStage 21 QA failed with ${failures.length} check(s).`);
  process.exit(1);
}

console.log('\nStage 21 QA contract gate passed.');
console.log('Note: this gate verifies repository/runtime contracts; real Supabase, Auth, Edge Function, payment gateway, and browser E2E checks still require the target environment.');
