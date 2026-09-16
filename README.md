# Gazak Go

Responsive RTL gas-cylinder delivery application built with React/Vite and Supabase.

## Stack
- React + Vite
- Supabase Auth + PostgreSQL + RLS + Realtime
- Supabase Edge Functions for privileged operations

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies: `npm install`.
4. Apply SQL migrations in `supabase/migrations/` to your Supabase project.
5. Deploy the Edge Functions in `supabase/functions/`.
6. Run `npm run dev`.

## Order workflow
`NEW → ACCEPTED → PREPARING → READY → ASSIGNED → OUT_FOR_DELIVERY → ARRIVED → DELIVERED`

Cancellation is supported before delivery. Inventory is reserved transactionally when an order is created, released on cancellation, and consumed on delivery.

## Smart Dispatch
- Prevents assigning an active driver when it could conflict with an ongoing delivery.
- Same-route batching is allowed only when the new delivery ETA is not earlier than the driver's latest existing ETA.
- If no safe driver is available, dispatch is rejected rather than risking a delivery delay.

## Security
Browser clients use only the Supabase anon key. Service-role credentials belong only in Supabase Edge Functions and must never be committed to the repository.

## CI
GitHub Actions runs dependency installation, linting and production build checks on pushes and pull requests to `main`.
