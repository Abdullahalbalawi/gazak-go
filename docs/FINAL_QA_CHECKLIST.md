# Gazak Go — Final QA Checklist

## Automated checks
- [x] Base44 references removed from application source.
- [x] Supabase migrations are present in numeric order through migration 013.
- [x] GitHub Actions CI runs install, lint and production build.
- [x] GitHub Pages workflow builds the standalone demo preview.

## Customer flow
- [ ] Open catalog and verify active products and live demo inventory.
- [ ] Add a cylinder to cart and complete checkout with CASH.
- [ ] Verify order creation, order number, payment status and invoice access.
- [ ] Verify the customer can view and track the created order.
- [ ] Verify cancellation releases locally reserved demo inventory.

## Distributor flow
- [ ] Accept NEW order.
- [ ] Move ACCEPTED order to PREPARING.
- [ ] Move PREPARING order to READY.
- [ ] Verify invalid status transitions are rejected.

## Smart Dispatch
- [ ] Assign a READY order to an idle driver.
- [ ] Verify an active driver on a different route is rejected.
- [ ] Verify a same-route assignment is rejected when its ETA would be earlier than the driver's latest active ETA.
- [ ] Verify a same-route assignment with no ETA delay is accepted.

## Driver flow
- [ ] Driver sees only assigned orders.
- [ ] Move ASSIGNED → OUT_FOR_DELIVERY → ARRIVED → DELIVERED.
- [ ] Verify an unassigned driver cannot progress another driver's order.
- [ ] Verify delivery opens the return/exchange workflow.

## Inventory and notifications
- [ ] Creating an order reserves stock atomically.
- [ ] Delivery consumes reserved stock.
- [ ] Cancellation releases reserved stock.
- [ ] Low-stock threshold creates an admin notification.
- [ ] Zero stock creates an admin notification.
- [ ] Order creation, transition and dispatch create role-targeted notifications.

## Payment and billing
- [ ] CASH order remains supported without a payment gateway.
- [ ] CARD is unavailable until `VITE_CARD_PAYMENTS_ENABLED=true`.
- [ ] Payment amount must exactly match the order total.
- [ ] Payment provider reference is idempotent via the unique provider/reference index.
- [ ] Invoice payment status follows the recorded payment result.

## Production gate
A production release is approved only after the automated CI workflow is green and the Supabase/Auth/Edge Function/payment configuration has been verified in the target environment.