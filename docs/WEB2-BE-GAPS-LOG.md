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
