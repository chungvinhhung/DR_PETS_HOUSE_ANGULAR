# Appointment FE ↔ BE integration audit — 2026-10-28
**FE**: `chungvinhhung/DR_PETS_HOUSE_ANGULAR`, branch `feature/admin-appointments-figma`, PR #33 (Draft).
**BE inspected**: `minhllk24/PET_CLINIC_BACKEND`, `feat/foundation-v6`, revision `d2c18b5`. Review is source-only; deployed commit, role-specific staging integration and end-to-end test results remain UNVERIFIED.
**BE default branch** `dev` is not foundation-v6 and does not contain the new `src/modules/booking`/`execution` tree. Confirm Render deploy branch and git SHA before staging QA.

## Confirmed BE endpoints / implemented FE corrections
| BE source | Endpoint (under /api/v1) | FE state |
|---|---|---|
| `booking/booking.routes.js` | GET `/appointments`, GET `/appointments/:id` | Legacy status `PENDING_CONFIRMATION` (must be removed per 2026-11-01 product decision), date `scheduledStart`, customer/contact snapshots, `services[].serviceName`, pricing `finalAmount`, `balanceAmount` |
| `booking/availability.routes.js` | GET `/availability?branchId=&date=&serviceIds=` | Corrected CREATE lookup; duration/remaining/status from actual response. Multi-service one-pet supported; do NOT claim slot reserved |
| `booking/internalBooking.routes.js` | POST `/internal/appointments` | Source exists but FE intentionally DOES NOT submit until BE fixes owner/guest contract and branch authorization |
| `execution/execution.routes.js` | GET `/service-records`, `/service-records/:id`, `/:id/revisions` | FE list/detail uses these confirmed reads; Appointment detail queries `/service-records?appointmentId=:id` |
| `execution/execution.routes.js` | PUT `/:id/materials`, PUT `/:id/professional`, POST `/:id/submit-review`, POST `/:id/finalize`, POST `/:id/reopen` | Not enabled: authorization, CAS/version and UAT needed |
| `booking/bookingRefund.routes.js` | GET/POST `/booking-refunds`, POST `/:id/receive`, `/:id/approve`, `/:id/reject`, `/:id/override` | Not enabled in FE until ownership/branch security is addressed |

## Canonical data differences observed
- `Appointment`: `scheduledStart`, `services: [{serviceName,serviceId,...}]`, `customerSnapshot.name`, `contactSnapshot.name`, `petSnapshot.name`, `pricing.finalAmount`, `pricing.balanceAmount`, status `PENDING_CONFIRMATION`.
- `ServiceRecord`: `recordType`, `status: DRAFT|IN_PROGRESS|WAITING_VET_REVIEW|FINALIZED|REOPENED`; `plannedMaterials`, `actualMaterials` reference inventory IDs, `professional.result`, `professional.professionalNote`. Backend does **not** return ready-made `petName`, `serviceName`, `primaryStaffName` in current serializer: UI shows missing labels rather than inventing names. BE should add safe read-only summaries or approved lookup API.
- BE record serializer exposes `reviewerStaffId` but not `veterinarianReview.status`; a reviewer assignment is **not** proof of approval. FE doesn't grant finalize automatically.
- BE Appointments and ServiceRecords list implementations accept `limit` (up to 100) but **do not** implement `page`, `search`, `total`. FE shows local filter/page on a capped 100 result subset, prominently labeled, not pretending to be server-side results.
- BE `GET /appointments` supports `status`, `branchId`, `from`, `to`. BE `GET /service-records` supports `recordType`, `status`, `appointmentId`, `branchId`; pagination and text search should be added.
- `POST /appointments/preview-pricing` is absent from inspected v6 booking routes; FE disabled calls to this nonexistent endpoint. FE may show **catalog unit-price reference only**. BE must supply a side-effect-free quote / price preview including surcharge, voucher validation and 30/70 split before FE can show exact amount.
- Existing `POST /appointments` supports **one pet** per Appointment and `serviceIds[]` sequential. Multi-pet Admin draft requires separate appointment transactions or an authorized atomic group booking contract; never silently send as one booking.

## Backend P0 blockers for enabling writes
1. **Read security**: `booking.routes.js` has `optionalAuth` on GET list/detail; `booking.service.getAppointments` filters only when actor exists and `getAppointmentById` checks Customer owner but not Manager/Staff branch or Guest ownership. This can expose appointment information. Require authenticated internal reads and guest verified ownership, enforce branch scope for all internal roles and return 401/403.
2. **Refund security**: `bookingRefund.routes.js` uses `optionalAuth` on GET list/detail; `bookingRefund.service.getRefundById` has NO ownership/scope check. `listRefunds` without actor is unfiltered. Lock down before FE presents refund details or actions.
3. **ServiceRecord security**: `execution.service.listRecords` / `getRecordById` allow MANAGER with no branch assignments to bypass scope; CUSTOMER access on routes lacks corresponding owner check in read service. All staff/manager actions must validate branch/assignment in the service, not role alone.
4. **Internal create-on-behalf semantics**: `createInternalAppointment` simply calls `createAppointment(data, actor, null)` and underlying function treats non-CUSTOMER actor as Guest. It does not consume `data.customerId` reliably. Require correct authenticated Customer vs GuestContact handling and authorized branch.
5. **Audit**: Backend has a full `src/models/AuditLog.js` and `src/utils/auditLogger.js` but core `booking.service.js` and `execution.service.js` do not call audit logger for overrides/actions. `src/modules/audit/models/AuditLog.js` is TODO-only. Implement and expose immutable audit event retrieval (not just record revisions), at least actor/time/reason/old/new/version.
6. **Mutation concurrency**: ServiceRecord `updateMaterials` and `reopen` compare expectedVersion then save (check CAS under concurrent writes). Refund `approve` has payment transaction but other refund actions require idempotency/scope testing. Confirm 24h/2-count and availability recheck for all segments under simultaneous requests.
7. **Quote and DTO**: Provide GET/POST side-effect-free price/availability quote, `total`/cursor and summary labels, payment/refund references, `ServiceRecord` reviewer review state and audit. Distinguish `CANCELLED` from `REFUNDED`.

## Explicit BE evidence needed before enabling FE mutations
- Deployed environment URL **and git SHA** matching fixed BE commit; whether Render or api.drpetshouse.lat is canonical.
- UAT actor tokens for Admin/Manager/Receptionist/Groomer/Nurse/Vet/Customer and allowed branch coverage (share credentials securely, not in docs).
- Pass/fail evidence for anonymous list/detail 401, cross-customer/guest ownership, Manager 0-branch cannot list/read or mutate, Staff outside branch 403, duplicate writes/slot race, 24h overrides and 2 reschedule limit.
- Sample live JSON (sanitized) for Appointment list/detail, ServiceRecord list/detail, Revisions, BookingRefund, Availability and internal booking.
- Once P0 pass, FE can wire authorized mutations with idempotency and version, and complete staging E2E. Until then, keep PR #33 Draft and do not merge.


## Superseding product decision — 2026-11-01
The earlier audit documented BE as-is, including `PENDING_CONFIRMATION`. That is no longer the target behavior.

Required changes:
1. Remove manual `PENDING_CONFIRMATION` and the ordinary BOOKABLE confirm step.
2. Successful required payment must transition the Appointment directly to `CONFIRMED`; zero-value valid bookings may be confirmed immediately.
3. Confirm the held SlotReservation resources in the same authoritative transaction/idempotent operation.
4. Retain REQUEST_ONLY as a separate review workflow.
5. Fix capacity checking to evaluate the matching service segment time range, not the appointment-wide time range merely because the appointment contains that service.
6. Align the configured hold duration with the agreed 15-minute rule; current foundation-v6 source uses 10 minutes.
