# WEB 2 — Audit & FE integration status for Tasks 4.2–4.6

**Date:** 2026-10-26  
**FE branch:** `feature/admin-order-management-phase1` (PR #29 — Draft)  
**BE inspected:** `minhllk24/PET_CLINIC_BACKEND:feat/foundation-v6`  
**User-provided contract:** `FE-GUIDE-ORDER-E2E-RETURN-REFUND.md` (Task 4.2 only)

## Evidence and release status

- BE **source** includes routes and matching source-level test suites for all 4.2–4.6:
  - 4.2: `order.routes.js`, `return.routes.js`, `tests/order-e2e.test.js`
  - 4.3: `booking.routes.js`, `bookingRefund.routes.js`, `tests/appointment-e2e.test.js`
  - 4.4: `execution.routes.js`, `tests/execution.test.js`
  - 4.5: `guest.routes.js`, `tests/guest-activation.test.js`
  - 4.6: `feedback.routes.js`, `review.routes.js`, `tests/review.test.js`
- Existing source and test cases **do not prove deployment, data seeding, correct RBAC in every route or E2E interoperability with Angular**.
- BE guide declares `https://api.drpetshouse.lat/api/v1` while FE currently points to `https://pet-clinic-backend-a4lj.onrender.com/api/v1` in both Angular environments. Do not change URL without environment/commit confirmation.
- FE Angular `/admin/orders` & return workflows exist; customer `/orders`, customer `/booking`, and Admin `/admin/appointments` are **placeholder views**, not integrated business features. No FE module for Task 4.4/4.5/4.6 was found in the inspected feature branch.

## Critical BE risk to resolve before releasing Task 4.2

1. `GET /orders` and `GET /orders/:id` still use `optionalAuth`; `listOrders` starts with `filter={}` and an absent actor does not constrain result scope. `getOrderById` has a guest verification TODO. **Anonymous users may read orders** in this inspected source.
2. `GET /order-returns` and `GET /order-returns/:id` still use `optionalAuth`; service permits absent actors and does not consistently constrain staff/manager by branch. **Return details/refund amounts may be exposed**.
3. Order staff/manager branch restrictions can fail open when `assignedBranchIds`/`authorizedBranchIds` is an empty array (condition is `if (branches.length > 0)`). Empty scope must mean no records.
4. Order and Return lists cap at 100 and return `nextCursor:null`; client-side pagination is not complete server pagination.
5. `formatOrder` does not return persisted `statusHistory`, and `formatOrderReturn` does not return evidenceUrls/createdAt/fulfillmentBranchId. Figma details cannot be completely populated.
6. Return `receive` has no per-SKU actual received quantity; `approve` applies requestedQty. Any partial receipt/acceptance or restock decision requires an explicit audited BE contract. FE must not invent adjusted refund amounts.

**Mandatory BE acceptance:** anonymous GET 401; guest valid and bound lookup token; other customer forbidden; receptionist or manager with no authorized branches sees zero records; forged branchId/customerId cannot broaden scope; detail scoped exactly like list.

## Task-by-task FE assessment

| Task | BE source found | FE status | Next safe action |
|---|---|---|---|
| 4.2 Order E2E | Checkout, fulfillment, mock payment, return, refund, two-tier pricing + source tests | Admin Order/Return screens implemented; public Customer Orders is placeholder | Map RFC9457 errors, test actual signed-in staging requests; block release until authorization fixed |
| 4.3 Appointment E2E | Appointment/booking-refund routes + source tests | Admin Appointments & Customer Booking placeholders | Obtain response schema/permission docs, inspect confirmed deployment and implement dedicated booking FE phase |
| 4.4 Material Consumption & Service Record | `/service-records` routes + source tests | No service-record operations UI in inspected FE branch | Request sample JSON: Record, Materials, revisions, professional, reviewer workflow; build after contract signoff |
| 4.5 Guest Checkout / OTP / Account Activation | `/guest/lookup/*`, `/guest/transactions`, `/activation/*` + source tests | Public account activation and guest transaction flow not implemented | Require safe OTP/activation contract, no hardcoded OTP/password, verify token privacy |
| 4.6 Feedback & Product/Service Review | `/feedback`, `/reviews`, `/reviews/admin` routes + source tests | No FE review or feedback screens in inspected FE branch | Request status enums, filter/pagination schema, proof and masking rules before UI implementation |

## FE changes applied in this pass

- Added `admin-order-error-message.ts` mapping RFC 9457 code values for Order/Return while using the shared toast system. Never show raw backend detail.
- Fixed admin shipping address to read `shippingAddress.line1` as documented in 4.2.
- Preserved the cancellation Idempotency-Key for repeated submission of the **same open dialog**, preventing a new key after a transient network error.
- Removed raw technical terminology from return success and confirmation texts.
- **Not changed:** API base URL, live data, Guest account state, payment/refund provider, stock/booking business logic, BE source.

## Correct Task 4.2 BE invariants (confirmed by supplied guide)

- Automatic whole-cart fulfillment priority; **no split order**.
- Price: Product finalPrice discount first; Voucher discount second; BE snapshots `lineNet`.
- COD payment remains PENDING until `mark-delivered`.
- Return window 7 days after delivery; shipping is not refunded; Return/Refund actions are role-scoped.
- Create Order/Return, cancel Order, process Refund use an Idempotency-Key and must remain atomic on the server.
- `ONLINE_MOCK` is a **simulated** payment/refund. Never claim transfer of real money to the customer.

## Suggested BE delivery bundle before further FE coding

1. Exact repo branch/SHA deployed at `api.drpetshouse.lat` and at Render; environment mapping and CORS.
2. Actual sanitized JSON examples for list/detail and writes of 4.3, 4.4, 4.5, 4.6, including auth/role/sub-role/status enum and RFC9457 errors.
3. Pass/fail test evidence for anonymous read, branch-scope, customer/guest ownership, duplicate POST/cancel/refund, partial Return quantities, data consistency.
4. UAT identities **via secure channel**, branch assignments, seeded test orders/appointments/feedback; do not send credentials in documentation.
5. Notify FE on response contract changes. The PR must stay draft until security and live browser E2E tests pass.

## Next release gates

- [x] Audited source endpoints and checked BE 4.2 handoff guide.
- [x] Order FE code hardening and Angular build check (consult GitHub Actions for last SHA).
- [ ] BE P0 unauthorized reads + branch isolation fixed and deployed.
- [ ] Confirm BE base URL and latest deployed commit.
- [ ] Obtain contracts for 4.3–4.6, build their dedicated FE views.
- [ ] Test user roles in browser and staging using real but safe data.
- [ ] Figma screenshot comparison/feedback regression pass.
- [ ] Only after gates: merge into develop then main.
