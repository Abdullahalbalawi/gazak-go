# Gazak Go

Responsive RTL gas-cylinder delivery application.

## Architecture
- React + Vite frontend
- Supabase Auth
- PostgreSQL with RLS
- Supabase RPCs for transactional order, inventory, dispatch, billing and return/exchange workflows
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
- Order lifecycle notifications are emitted by transactional RPCs for creation, status transitions and dispatch.
- Inventory threshold automation notifies active admins when a product crosses its low-stock threshold or reaches zero stock.
- Billing foundation is implemented with invoice records, invoice numbering, payment transaction audit, payment-state RPCs and order billing retrieval.
- New orders automatically receive an invoice record.
- Card payment is intentionally disabled until a real payment provider is configured; the current implementation does not process live card payments.
- GitHub Actions CI is configured for dependency installation, lint and production build.
- GitHub Pages workflow builds a standalone multi-role demo with local demo data and no live payment processing.

## Demo preview
- Demo mode is enabled only by the GitHub Pages workflow via `VITE_DEMO_MODE=true`.
- Demo supports customer, distributor, driver and admin role switching.
- Demo orders are stored in the browser's local storage.
- Demo includes order history, inventory reservation/return-on-cancel, custody transfer, Smart Dispatch checks and role-specific order transitions.
- Order success displays a demo invoice reference and payment state.
- Live Supabase credentials are not embedded in the demo build.

## Deployment requirements
1. The project `gazak-go` is provisioned in Supabase and the repository migrations through `017` have been applied.
2. The Edge Function `admin-create-user` is deployed with JWT verification enabled.
3. Configure the hosting environment with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Configure email confirmation/reset URLs in Supabase Auth.
5. Configure a payment provider before enabling live CARD payments and connect its server-side webhook to the payment-state RPC.

## Important
The repository contains the migrated application code and the Pages demo workflow. A live production deployment is not considered operational until the Supabase project, Auth settings, Edge Functions, payment provider and required environment variables are configured and a production build passes CI.

## GitHub Pages
The repository is configured to publish the demo through GitHub Actions at `/gazak-go/`.

## Stage 22 — Supabase production setup
The repository includes the production setup runbook at `docs/SUPABASE-PRODUCTION-SETUP.md`. The live Supabase project is provisioned and the database migrations through `017` plus `admin-create-user` Edge Function are deployed. Final closure still requires real Auth accounts and end-to-end production validation.
