# FE → BE handoff: Admin Appointment Phase 4 (2026-10-28)

**Status:** Proposed contract, **NOT** an existing verified API. Track for WBS 4.3.
**Code:** `feature/admin-appointments-figma`, PR #33. Do not merge until verified.

## 1. Current FE/BE evidence
- Customer Angular code uses `POST /appointments/preview-pricing` with `{pet_id?,pet_data:{weight_kg?},service_ids:[{service_id,quantity}]}`. It is a **read-only hint** and does not quote Admin-created appointments, validate vouchers, or reserve capacity.
- Customer code also calls `POST /appointments/book` and `POST /appointments/:id/checkout`. Their existence does **not** establish permission or DTO for Admin creating on behalf of a different Customer/GuestContact.
- Admin FE now previews pricing per selected pet and aggregates server-returned totals, but it never submits a booking or labels mock payment as paid.
- Staff roster on FE can prefilter by role/branch/account ACTIVE. This does not confirm shifts, free capacity, or conflict with bookings.
- `/appointments/slots` is a coarse date / branch / service_type lookup, insufficient for multiple segments/pets or MEDICAL nurse review.

## 2. Required P0 stateless quote API (proposed)
`POST /api/v1/admin/appointments/quote` (authorized ADMIN, or explicitly permitted MANAGER/RECEPTIONIST scoped by branch)

Example input:
```json
{
  "customerId": "customer-id-or-null",
  "guestContact": {"fullName":"Tên khách", "phone":"09...", "email":null},
  "branchId": "branch-id",
  "appointmentDate": "2026-11-01",
  "pets": [
    {"clientPetKey":"pet-1","petId":"server-id-or-null",
     "draft":{"name":"Luna","speciesId":"cat-id","weightKg":4.5},
     "segments":[
       {"serviceId":"service-a","sequence":1,"requestedStaffId":null},
       {"serviceId":"service-b","sequence":2,"requestedStaffId":"staff-id"}
     ]}
  ],
  "paymentMethod": "PAY_AT_STORE",
  "voucherCode": "OPTIONAL",
  "note": "..."
}
```
Inputs are illustrative, not verified route schemas. Existing customer ID and GuestContact are mutually exclusive; no implicit account creation.

Quote response requires:
- `eligible`, `quoteId`, `expiresAt`, `branchId`, per-pet and per-service segment schedule with start/end/staff or explicit failure reasons.
- `pricing.subtotal`, `pricing.surcharge`, `pricing.discount`, `pricing.voucherDiscount`, `pricing.tax` if applicable, `pricing.finalAmount`, **all authoritative**.
- `payment.dueNow`, `payment.dueAtStore`, `payment.method`, `payment.status` (pre-commit should not claim paid).
- Voucher `valid` and reason; quote must not consume quota.
- Error codes such as `VOUCHER_INVALID`, `SLOT_UNAVAILABLE`, `CAPACITY_EXCEEDED`, `STAFF_SHIFT_CONFLICT`, `MEDICAL_REVIEW_REQUIRED`, `CUSTOMER_BLOCKED`, and `QUOTE_EXPIRED`.

BE must revalidate availability, capacity, staff shifts, role, no-show/cancellation eligibility and prices at commit. Do not trust FE-provided subtotal, slot availability, quote or calculated payment split.

## 3. Booking creation on behalf (proposed)
`POST /api/v1/admin/appointments` with `Idempotency-Key`, `quoteId` or canonical request fields. Require actor authorization and branch scope, GuestContact reuse/activation, per-pet service segments, and transactional slot reservation/quotas. Repeated keys cannot produce duplicate bookings/payments. Success response includes real appointment codes per pet if two pets create separate Appointment entities, and a real payment outcome.

The Figma A15 success screen must be rendered **only after** the backend confirms persisted appointment(s), not after FE validation or a price preview.

## 4. WBS 4.3 payment rules to enforce
- `ONLINE_MOCK`: settle **100% of finalAmount** through simulated payment. Never claim genuine payment-provider transfer.
- `PAY_AT_STORE`: mock online deposit of **30%** of finalAmount; remaining **70%** collected at clinic. BE owns rounding and lifecycle transitions, not the FE display estimate.
- No arbitrary payment ratio overrides by service/branch. The visible FE 30/70 split is only a preview until server confirms.
- Payment failure: no false `PAID` state, no consumed voucher quota/slot after transaction rollback; honor retry/idempotency semantics.
- Quote/apply-voucher must not consume quota. Voucher quota is applied atomically at committed transaction and compensated on eligible cancellation/failure.
- Price changes / slot expiration between quote and commit return explicit actionable error and require refreshing quote.

## 5. Acceptance examples
1. One pet + BOOKABLE service → eligible quote and valid segment.
2. Two pets with overlapping starts → capacity/shift checks across both; no double-assigned staff.
3. Multiple services on one pet → sequence segments end-to-start; all roles and resource constraints checked.
4. MEDICAL Nurse segment → Veterinarian review rule evaluated; no bypass.
5. REQUEST_ONLY/CONTACT_ONLY → never accidentally self-booked as BOOKABLE.
6. Invalid, expired, exhausted, or out-of-scope voucher → exact reason shown; no quota consumed by preview.
7. PAY_AT_STORE with finalAmount 500,000 → dueNow about 150,000 / dueAtStore about 350,000, rounding authoritative BE.
8. ONLINE_MOCK with finalAmount 500,000 → charge 500,000 mock; no clinic balance.
9. Parallel booking same last slot/quota=1 → exactly one successful commit.
10. Duplicate Submit / network retry → idempotent, no duplicate Appointment or Payment.
11. Manager/Receptionist out-of-scope branch → HTTP 403 and no private customer/pet data.
12. Failure / timeout → no success screen unless reconciled as persisted.

## 6. Required FE follow-up after contract arrives
- Replace hint preview with verified quote endpoint; show exact voucher, surcharge, tax, total and deposit based on response.
- Bind appointment creation, payment result and success A15 to persisted response.
- Add loading/retry/errors and expired quote recovery.
- Validate booking + payment lifecycle E2E with BE seeded data and real role accounts in staging.
