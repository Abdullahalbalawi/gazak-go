# Gazak Go

Responsive RTL gas-cylinder delivery application.

## Architecture
- React + Vite frontend
- Supabase Auth
- PostgreSQL with RLS
- Supabase RPCs for transactional order, inventory, dispatch and return/exchange workflows
- Supabase Edge Functions for privileged account operations

## Completed migration
- Base44 SDK/plugin and legacy backend removed from the application source.
- Login, registration and password recovery use Supabase Auth.
- Customer catalog, checkout, orders and tracking use Supabase.
- Distributor and driver workflows use Supabase.
- Admin products, inventory, users and orders use Supabase.
- Transactional inventory reservation/release/consumption is implemented.
- Smart Dispatch protects busy-driver routes and prevents an assignment that would move a new delivery ahead of the driver's latest planned ETA on the same route.
- Returns and exchanges use a server-side transactional function.
- GitHub Actions CI is configured for dependency installation, lint and production build.

## Deployment requirements
1. Create a Supabase project.
2. Apply every SQL file in `supabase/migrations/` in numeric order.
3. Deploy `supabase/functions/admin-create-user` and configure the Supabase service-role secret in the function environment.
4. Configure `.env.local`/hosting environment with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Configure email confirmation/reset URLs in Supabase Auth.
6. Configure a payment provider before enabling live CARD payments; CASH works without a payment gateway.

## Important
The repository is code-complete for the migrated application, but a live deployment is not considered operational until the Supabase project, Auth settings, Edge Functions and required environment variables are configured and a production build passes CI.
