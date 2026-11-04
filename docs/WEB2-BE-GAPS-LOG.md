# WEB2 — BE Gaps Log

> Accumulated during FE/Figma reconciliation. Keep this file as the source for the final BE handoff.

## Order / Inventory

1. **ONLINE_MOCK fail / cancel / expire compensation**
   - Business rule requires: Order → `CANCELLED` + Inventory `RECEIPT` compensation + voucher quota restore, idempotently.
   - `cancelOrder()` currently contains compensation logic, but the automatic payment fail/cancel/expire paths still need confirmation that they all execute the same full compensation flow.

2. **Shared inventory transaction code for multi-SKU business transactions**
   - Figma/FE expects one business transaction code (e.g. TXK/PNK) shared by all SKU movement rows in the same operation.
   - Current inventory response exposes movement row IDs but does not reliably expose a shared `transactionCode/groupCode`.
   - FE supports `transactionCode/groupCode` when BE provides it and intentionally does not fabricate business IDs.

3. **Admin Create Order branch-selection consistency**
   - Business rule: fulfillment uses `fulfillmentBranchPriority`, selecting the first ACTIVE branch that can fulfill the entire cart; no split order.
   - `checkoutCreateOrder()` follows this rule.
   - `createAdminOrder()` currently appears to default to the first priority branch when branchId is omitted rather than iterating to the first branch with sufficient stock. Confirm whether Admin Create Order must follow the same rule; if yes, BE needs alignment.

## Admin Appointment Create

4. **Admin appointment quote / create-on-behalf contract**
   - Figma A02/A03/A13/A15 requires Admin/Receptionist to prepare and persist appointments on behalf of an existing Customer or GuestContact.
   - Current FE keeps write disabled because the inspected BE contract does not yet provide a verified, secure side-effect-free Admin quote plus authoritative create-on-behalf flow with idempotency.
   - Success screen A15 must only render after persisted appointment(s) are confirmed by BE.

5. **Customer-scoped pets for internal staff**
   - Create Appointment needs the selected customer's saved pets.
   - Current Customer detail DTO may not embed pets and FE must not call `/my-pets` under an Admin token.
   - BE should expose an authorized customer-pets read or embed safe pet summaries in the customer lookup/detail response.

6. **Multi-pet availability and atomic reservation**
   - Figma A13 supports two selected pets in one create flow.
   - Current `GET /availability` is suitable for service/date availability but does not prove atomic multi-pet capacity/staff reservation.
   - BE needs an authoritative multi-pet quote/reservation contract; FE must not fabricate an available slot for two pets.

7. **Authoritative Appointment pricing / voucher / payment split**
   - Figma shows subtotal, surcharge, discount, total and PAY_AT_STORE / ONLINE_MOCK payment choices.
   - FE can only show catalog reference pricing until BE returns an authoritative quote including voucher validation and 30/70 split.
   - Voucher preview must not consume quota.

## Appointment ↔ ServiceRecord — correction from report 3.5.4

8. **Receptionist must not manually complete an IN_PROGRESS appointment**
   - Appointment Management is the Receptionist/Manager operational screen.
   - When service starts, the system must create the corresponding ServiceRecord(s).
   - Staff/Veterinarian update and finalize records in the ServiceRecord module.
   - Appointment transitions to `COMPLETED` automatically only after all service segments are complete and the required ServiceRecord finalization succeeds.

9. **Start-service operation must create ServiceRecord atomically**
   - The action that moves an appointment into service cannot be a plain status PATCH.
   - BE must atomically mark the relevant segment/appointment as in service and create/link the ServiceRecord snapshot(s), including material-template snapshot where applicable.
   - Retrying the action must not create duplicate ServiceRecords.

10. **MEDICAL finalization ownership**
   - Every MEDICAL record must have a Veterinarian responsible for final closure.
   - If a Veterinarian already performs a medical segment, prefer an assigned Vet from that appointment.
   - If all relevant work is performed by Nurse, BE must auto-select an eligible Veterinarian (current shift, then next earliest shift, then lowest pending workload) or mark the record as requiring assignment.
   - This reviewer/finalizer assignment does not consume appointment capacity/time.

11. **ServiceRecord mutation payloads still need exact schema**
   - Report v7 identifies: `PUT /service-records/{id}/materials`, `PUT /service-records/{id}/professional`, `POST /service-records/{id}/submit-review`, `POST /service-records/{id}/finalize`.
   - FE still needs the exact request/response DTOs, optimistic-concurrency/idempotency fields, allowedActions and error codes before enabling write mutations.

## Appointment lifecycle — leader update: remove PENDING_CONFIRMATION

12. **Remove manual `PENDING_CONFIRMATION` state**
   - Latest product decision removes the store-manual "Chờ xác nhận" step.
   - Required lifecycle for ordinary BOOKABLE appointments: `PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED`, with terminal `CANCELLED/NO_SHOW`.
   - If the required payment amount is zero, the appointment may be created directly as `CONFIRMED`.
   - Current BE `booking.service.js` still creates `PENDING_CONFIRMATION` for `ONLINE_MOCK`, zero-value PAY_AT_STORE, and after successful deposit payment. It also exposes `confirmAppointment()`. These paths need migration/removal.
   - FE no longer exposes "Chờ xác nhận"; legacy `PENDING_CONFIRMATION` responses are temporarily normalized to `CONFIRMED`.

13. **Auto-confirm must happen only after required payment succeeds**
   - ONLINE_MOCK full payment success → `CONFIRMED`.
   - PAY_AT_STORE deposit success (30%) → `CONFIRMED`; failed/expired payment must cancel/release holds and restore voucher quota as applicable.
   - Confirmation must atomically convert resource reservations from HELD to CONFIRMED so two customers cannot own the same staff/capacity.

14. **Capacity overlap check is currently segment-incorrect**
   - Verified in `src/modules/booking/booking.service.js`: during each service segment, BE runs `Appointment.countDocuments` using appointment-level `scheduledStart/scheduledEnd` overlap plus `services.serviceId`.
   - This can count an appointment as occupying a service during the whole appointment merely because that service appears somewhere in its service list.
   - Capacity must be checked against the matching service segment's own `scheduledStart/scheduledEnd` (for example via an element-level query/aggregation), together with active holds/reservations.

15. **Hold duration mismatch**
   - Latest documented/leader flow uses a 15-minute payment hold.
   - Current `booking.service.js` creates SlotReservation and Appointment `holdExpiresAt` with 10 minutes.
   - BE contract, cleanup job and UI countdown must use one authoritative duration.

16. **REQUEST_ONLY remains a separate review flow**
   - Removing `PENDING_CONFIRMATION` from ordinary BOOKABLE appointments must not auto-confirm REQUEST_ONLY services.
   - Current BE rejects REQUEST_ONLY from normal createAppointment and routes them to `/appointment-requests`; retain a separate review/approval lifecycle there.

## ServiceRecord cardinality / appointment completion

17. **BE currently allows only one ServiceRecord per Appointment, but Figma/flow requires multiple**
   - Figma shows `SR-0042-A` (MEDICAL / Max) and `SR-0042-B` (GROOMING / Luna) linked to the same `APT-0042`.
   - Current `ServiceRecord` schema on `feat/foundation-v6` declares `appointmentId: { unique: true }`, and `createRecord()` aggregates all appointment services into one record.
   - BE needs a stable record cardinality key, e.g. `appointmentId + petId + serviceGroup/segmentGroup`, and must remove appointment-only uniqueness.

18. **Appointment auto-complete must wait for all required ServiceRecords, not one finalized record**
   - Current `finalizeRecord()` sets Appointment `COMPLETED` immediately after finalizing the current record when all appointment segments have executionStatus `COMPLETED`.
   - With multiple ServiceRecords per Appointment, BE must additionally verify every required linked ServiceRecord is `FINALIZED` before completing the Appointment.
   - Finalizing SR-A must never complete the appointment while SR-B is still IN_PROGRESS/WAITING_VET_REVIEW.

19. **ServiceRecord ↔ Inventory transaction linkage is not exposed**
   - Inventory finalization writes movements with `sourceType=SERVICE_RECORD_REVISION` and `sourceId=revisionId`.
   - Current ServiceRecord detail does not return revision IDs or inventory transaction refs/codes.
   - Current `formatServiceRecordRevision()` also omits the revision document ID.
   - FE therefore cannot safely render/click the Figma TXK code for each material without guessing.
   - BE should expose either `revisionId` + transaction refs on record/revision detail, or a queryable `serviceRecordId/revisionId → inventory transactions` relation, preferably with a shared business transaction code.

20. **Staff assignment ID domain mismatch can break ServiceRecord authorization**
   - Booking `selectBestStaff()` assigns `StaffProfile._id` into `Appointment.services[].assignedStaffId`.
   - Execution authorization helpers such as `isAssignedToAppointment(appointment, actor.id)` compare those values against `actor.id`, while `requireExecutionStaff()` clearly treats `actor.id` as `User._id` and resolves `StaffProfile` via `userId: actor.id`.
   - ServiceRecord `assignedStaffIds` are copied from Appointment segment assignments, but list/detail filters also compare them to `actor.id`.
   - BE must normalize on one identity domain (prefer explicit `staffProfileId` vs `userId`) and compare consistently; otherwise assigned Nurse/Vet/Groomer may receive false 403 or fail to see their records.

21. **ServiceRecord detail response lacks display summaries/code required by Figma**
   - Verified `formatServiceRecord()` on BE `feat/foundation-v6` returns IDs/status/type/materials/professional data but no business `recordCode`, `petName`, `serviceName`, `branchName`, or assigned staff display names.
   - Figma requires values such as `#SR-0042-A`, pet name, service name, branch name and staff name.
   - FE now enriches pet/service/branch from the linked Appointment when possible and hides a raw Mongo ObjectId from the page title instead of presenting it as a fake SR code.
   - BE should expose a stable ServiceRecord business code plus safe display summaries (or a documented expand/include contract). FE must not fabricate `SR-xxxx` codes.


## Auth / RBAC — Phase 1 audit

22. **`/api/v1/admin/users` is documented but not mounted in inspected BE source**
   - Auth handoff documents GET/POST/PUT endpoints under `/api/v1/admin/users`.
   - Inspected `feat/foundation-v6/src/app.js` does not mount an Admin Users router. `/api/v1/admin` currently mounts `adminContentRoutes` only.
   - FE keeps the Admin Users integration contract but must not fabricate account data while the route is unavailable.

23. **403 auth error codes are overwritten by the global BE error handler**
   - Auth service raises specific codes such as `ACCOUNT_NOT_ACTIVATED` and `ACCOUNT_BLOCKED`.
   - Current global `errorHandler.js` rewrites every 403 to `AUTHORIZATION_ERROR`, losing the original auth code.
   - FE now defensively recognizes the returned detail text so login messages remain user-friendly, but BE should preserve specific problem codes.

24. **`rememberMe` is stripped before Auth login reaches the service**
   - `auth.service.login()` supports `rememberMe` and chooses short/long refresh-session TTL accordingly.
   - The ingress normalizer in `app.js` currently deletes `rememberMe`, `remember` and `remember_me` from the login body.
   - Therefore the documented remember-me behavior cannot currently take effect.

25. **Auth serializer and profile update contract have field mismatches**
   - `formatMe()` exposes `branchScope`, `activationStatus`, `accountStatus`, and `lastLogin`; FE now preserves these fields in session state.
   - `formatMe()` currently omits `avatarUrl` even though Auth/Profile contracts and the User model support it.
   - `updateMe()` ignores `email: null`, so FE cannot truly clear an existing email even though the profile request shape allows a nullable email.
