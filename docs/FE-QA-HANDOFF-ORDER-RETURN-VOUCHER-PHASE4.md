# WEB 2 — Phase 4 QA / BE Handoff: Order, Return/Refund, Voucher

**Status:** DO NOT MERGE TO MAIN/DEVELOP YET. This document is an audit of source at `feature/admin-order-management-phase1` against BE `minhllk24/PET_CLINIC_BACKEND:feat/foundation-v6`. Compilation does not prove deployed integrations work.

## 1. Critical Backend blockers (must be addressed before production)

### P0-A — Unauthenticated Order and Return listing/details

**Evidence (BE source):**
- `src/modules/order/order.routes.js`: `GET /` and `GET /:id` use `optionalAuth`.
- `src/modules/order/order.service.js`: `listOrders(query, actor)` begins with an unrestricted `filter = {}`; for missing actor it does not apply authorization constraints.
- `getOrderById(id, actor, guestToken)` only checks owner/branch for an existing actor. The guest token branch is a TODO comment, and without an actor or guest token it returns an order.
- `src/modules/order/return.routes.js`: `GET /` and `GET /:id` use `optionalAuth`.
- `src/modules/order/return.service.js`: `listReturns` constrains only CUSTOMER actors; anonymous actors receive the unscoped list. `getReturnById` likewise does not reject absent actor.

**Required BE behavior:**
- Never expose order/return records, contact snapshots, addresses, item details or refund amounts to unauthenticated callers.
- Require authenticated admin, manager, authorized receptionist, or the order's owning customer as appropriate.
- Guest lookups must require AND verify a valid guest lookup token bound to the target order; missing/wrong token -> 401/403. Do not leave the verification TODO.
- For all staff/manager reads, enforce server-side allowed branch IDs, including detail endpoints; no assigned branches -> zero records, not all records.
- Reject role-inappropriate users. Client-side guards are UX only.
- Prevent query params such as `customerId` or `branchId` from broadening access outside the actor's authorized scope. Intersect with authorization after parsing query.
- For Returns, scope by parent Order fulfillment branch or embed `fulfillmentBranchId` and enforce it in BE query.
- Acceptance tests: anonymous 401; other customer 403; receptionist assigned branch A sees only A; receptionist no branches sees zero; manager assigned branch B sees only B; forged branchId/customerId cannot bypass scope.

### P0-B — Branch-filter integrity

**Current:** `GET /order-returns` returns no `branchId`; FE looks up each parent Order as a temporary workaround. If the query fails, FE omits those rows from a branch-specific view and warns the user.

**Required:** Include `fulfillmentBranchId` and `createdAt` (ISO 8601) in Return summaries, implement server-side `branchId`, status, date range filters AND authenticated cursor pagination. Calculate authorized branch scope on BE. For list KPI/alerts return totals independently from the loaded page.

## 2. Other BE requests

| Priority | Module | Current source contract | Required implementation |
|---|---|---|---|
| P1 | Order | `GET /orders` capped at 100, `nextCursor:null` | Stable cursor pagination (newest first), status/date/branch/search filters, accurate `totalCount` and summary KPI |
| P1 | Return | `GET /order-returns` capped at 100, `nextCursor:null` | Cursor pagination, status/date/branch/search; keep `history`, add `createdAt` |
| P1 | Order detail | `formatOrder` omits `statusHistory` | Return timeline events (status, at, actor id/display name, note); FE currently shows no fabricated timestamps |
| P1 | Return detail | `formatOrderReturn` omits evidence URLs | Return `evidenceUrls` after secure authorization; preserve evidence storage/ownership checks |
| P1 | Voucher | `formatVoucherResponse` omits `minOrderAmount`, `maxDiscountAmount`, description, timestamps | Return persisted conditions so FE can safely view and edit; define whether editing used vouchers is restricted |
| P1 | Return approval | Approve API does not accept actual received quantities/adjusted refund | If Figma requires partial receiving/approval, specify and implement an audited BE endpoint that recalculates item refund; do not let FE calculate money |
| P1 | Admin order creation | Source supports checkout via cart, not standalone admin create | Agree an admin order creation flow and API or hide/disable `Đơn hàng mới`; current button explains missing support |
| P2 | Voucher status note | PATCH supports status, not status-change note | Optional reason/audit trail; FE note input is disabled to avoid pretending it saves |
| P2 | Return return-to-stock | Receiving return does not restock | Provide explicit tested restock decision/endpoint with audit and idempotency if required by checklist |

## 3. FE corrections in Phase 4

- Added `orderOperatorGuard` for ADMIN, MANAGER and STAFF/RECEPTIONIST screens, including session-restoration support. BE must enforce identical rights.
- Voucher list: ignore stale list responses when the user changes cursor/status/scope rapidly.
- Order list/detail and Return list: ignore older API responses after a newer request.
- Preserved shared Admin sidebar, Design System assets, responsive toolbar, toast and no mock business records.

## 4. Manual acceptance test matrix — requires authenticated BE and browser

| ID | Area | Test case | Expected result |
|---|---|---|---|
| O-01 | Order list | Admin login, 0 records | Correct empty state, no invented KPI |
| O-02 | Order list | 1–100 and >100 records | No false claim of full data; beyond 100 blocked pending BE pagination |
| O-03 | Order list | Search, status, 7/30/90 days, export CSV | Correct subset; dates local to Asia/Ho_Chi_Minh |
| O-04 | Order lifecycle | PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> COMPLETED | No invalid transitions; COD payment changes only on BE confirmation |
| O-05 | Order cancellation | Cancel from allowed states; try cancel twice | No duplicate inventory receipt or voucher quota restoration |
| O-06 | Order auth | Admin/Manager/receptionist/other staff/guest | Correct UI and BE permissions; branch isolation |
| R-01 | Return list | Change tab; search, status, branch, date range | Toolbar matches Figma, correct filtered subset |
| R-02 | Date picker | Select start then end; reversed order; cross-month; clear; close; Esc/outside | Exactly two-click selection; clear removes date filter; no clipping |
| R-03 | Return workflow | REQUESTED -> PROCESSING -> RECEIVED -> APPROVED -> COMPLETED | Receptionist processes/receives; manager approves; mock refund processed once |
| R-04 | Return reject | Reject PROCESSING/RECEIVED with reason | Reserved quantities released; no double refund |
| R-05 | Return amounts | Return one SKU / partial qty of discounted order | Refund uses BE allocated net paid; shipping not refunded; no client recalculation |
| R-06 | Return auth | Guest/customer other than owner; manager other branch | No exposure, 401/403 as appropriate |
| V-01 | Voucher list | Search/scope/status/availability, 20+ records | Cursor works, no stale result overwrites, filter scope clearly disclosed |
| V-02 | Voucher create | FIXED/PERCENTAGE, quota, min/max, duplicate code | Validation Vietnamese; create once via Idempotency-Key |
| V-03 | Voucher edit | Update existing voucher with hidden persisted conditions | No overwrite of min/max; BE verifies |
| V-04 | Voucher toggle | Disable, reenable, expired/exhausted cases | On/off independent of time/quota; toast and count correct |
| V-05 | Voucher integration | Checkout success, cancellation, payment failed, delivered refund | Quota consumed/restored ONLY per BE transaction rules |
| UI-01 | All | 1366px, 1440px, narrow desktop and mobile | Table gutters, controls aligned, no overlapping/hidden menu |
| UI-02 | All | BE 400/401/403/409/422/5xx, slow server, retry | No raw error leaks, no duplicate writes, correct loading/error state |

## 5. Release checklist

- [x] Angular compile/build on PR (verify final HEAD CI after latest commits).
- [x] Source audit against BE `feat/foundation-v6`.
- [x] FE route subrole guard and stale-response protection.
- [ ] **BE P0 anonymous-read/authorization vulnerabilities remediated and independently tested.**
- [ ] BE returns pagination, branch scopes and missing DTO fields resolved or documented as accepted limitations.
- [ ] Login E2E + write operations tested on a safe staging database. DO NOT execute test refunds/payments against production without authorization.
- [ ] Visual browser regression screenshots approved for all Figma frames.
- [ ] PR reviewed; merge to develop/main only after explicit approval.
