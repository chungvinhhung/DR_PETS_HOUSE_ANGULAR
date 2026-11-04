# WEB2 — BE Gaps Log

> Accumulated during FE/Figma reconciliation. Keep this file as the source for the final BE handoff.

## Order / Inventory

1. **ONLINE_MOCK fail / cancel / expire compensation**
   - Business rule requires: Order → `CANCELLED` + Inventory `RECEIPT` compensation + voucher quota restore, idempotently.
   - `cancelOrder()` currently contains compensation logic, but the automatic payment fail/cancel/expire paths still need confirmation that they all execute the same full compensation flow.

2. **Shared inventory transaction code and structured reference for business transactions**
   - Figma/FE expects one business transaction code (e.g. TXK/PNK) shared by all SKU movement rows in the same operation.
   - Current inventory response exposes movement row IDs but does not expose a shared `transactionCode/groupCode`.
   - Order ISSUE/cancellation RECEIPT calls also omit `orderCode`, so `referenceCode/sourceCode` is empty. Return restock is stored as `sourceType=ORDER` while the Return ID exists only inside the free-text reason.
   - FE groups rows by persisted source/type/reason as a compatibility fallback, but intentionally does not fabricate business IDs. BE should expose a stable shared transaction code plus structured reference type/id/code.

3. **Admin Create Order branch-selection consistency**
   - Business rule: fulfillment uses `fulfillmentBranchPriority`, selecting the first ACTIVE branch that can fulfill the entire cart; no split order.
   - `checkoutCreateOrder()` follows this rule.
   - `quoteAdminOrder()` and `createAdminOrder()` currently default to the first priority branch when `branchId` is omitted rather than iterating to the first branch with sufficient stock.
   - For Manager/Receptionist this can also select a global priority branch outside the actor's branch scope and then return 403 instead of selecting an eligible authorized branch.
   - BE should make quote and commit use the same scoped, whole-cart fulfillment algorithm.

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


## Catalog / Operations — Phase 2 audit

26. **Branch and Service branch-config read APIs do not enforce Manager branch scope**
   - `branch.service.listBranches()` returns every branch to any internal actor and `getBranchById()` does not reject an out-of-scope Manager.
   - `GET /services/:id/branch-configs` is also mounted with optional auth and currently returns configs across branches without Manager scope enforcement.
   - FE now filters by canonical `branchScope` from `/auth/me` and blocks direct out-of-scope branch navigation, but this is only presentation-layer protection. BE must enforce the same scope before returning data.

27. **Permanent Product delete is still not implemented**
   - FE has an archived-product permanent-delete action for the approved UI flow.
   - Inspected Catalog routes provide archive and restore but no `DELETE /products/:id`.
   - FE keeps the action non-fabricated and surfaces the technical unsupported notice only when the missing endpoint is actually invoked.

28. **Phase 2 UAT seed exists, but environment execution is not guaranteed**
   - `npm run seed:uat-prod` provisions realistic branches, staff/shifts, categories, products, services and inventory data.
   - Therefore an empty deployed/local Phase 2 screen should be treated first as an environment/seed execution issue, not automatically as a missing API.
   - FE does not inject demo rows when APIs return an empty dataset.


## Orders / Voucher / Return — Phase 3 audit

29. **Admin Order voucher integration calls the Voucher service with the wrong contract**
   - `quoteAdminOrder()` / `createAdminOrder()` call `validateVoucherEligibility()` with fields such as `targetType` and `orderAmount`, while the imported Voucher service expects `scope`, `subtotal`, `customerId`, and `productIds`.
   - They also call `calculateDiscount(appliedVoucher, merchandiseSubtotal)`, while the Voucher helper expects one object argument containing `voucher` and `subtotal`.
   - This can make a valid voucher resolve to zero discount or fail eligibility in the internal Create Order flow.
   - FE must continue trusting only the authoritative quote and must not calculate voucher discounts locally; BE needs to align the function calls.

30. **Receptionist can create an Admin Order but cannot search existing Customers**
   - Order operator routes allow `STAFF:RECEPTIONIST` to quote/create and process orders.
   - `GET /customers` currently allows only `ADMIN` and `MANAGER`.
   - Therefore the Figma phone lookup flow fails for Receptionist even though Receptionist is an intended order operator.
   - BE needs a scoped internal customer lookup contract for Receptionist (at minimum exact-phone lookup with safe fields).

31. **Order mutation endpoints do not re-check branch scope**
   - Order list/detail reads enforce Manager/Staff branch scope.
   - `confirmOrder()`, `processOrder()`, `shipOrder()`, `markDelivered()`, and staff `cancelOrder()` mutate an Order by ID without re-validating that the actor is authorized for the Order's fulfillment branch.
   - Route-level role checks are not enough because a valid Manager/Receptionist from another branch could act on a known Order ID.
   - BE must enforce branch scope inside every mutation service, matching read authorization.

32. **Return DTO fabricates physical-receipt values and timestamps**
   - `formatOrderReturn()` defaults missing `receivedQty` to `requestedQty` and missing `quality` to `RESELLABLE`, even before the RECEIVE step.
   - It also substitutes `new Date().toISOString()` when `createdAt` or a history timestamp is missing.
   - These defaults can make FE show goods as received/resellable or create a timeline time that never actually happened.
   - DTO should preserve unknown values as null/omitted; FE now hides synthetic received quantities before the persisted RECEIVED state.

33. **Return `allowedActions` disagrees with the mutation state machine**
   - `formatOrderReturn()` advertises `REJECT` in `REQUESTED`.
   - `rejectReturn()` accepts only `PROCESSING` or `RECEIVED`.
   - FE intentionally follows the executable service state machine and does not show Reject at REQUESTED until BE contract is reconciled.

34. **Return mutation branch authorization is inconsistent**
   - Return list/detail reads enforce branch scope and `approveReturn()` checks Manager scope.
   - `processReturn()` and `receiveReturn()` do not re-check Staff/Manager branch scope.
   - `rejectReturn()`, `getOrderRefundById()`, and `processOrderRefund()` also do not consistently validate the linked Order's branch against the Manager.
   - BE must apply the linked Order fulfillment-branch authorization to every Return/Refund mutation and sensitive read.

35. **Return API cannot represent the full per-SKU approval/restock model**
   - Product rule distinguishes `requestedQty`, `receivedQty`, `approvedQty`, and `restockedQty`.
   - Current BE persists `receivedQty` plus a binary quality decision; approval effectively refunds all received quantity and restocks either all accepted quantity (`RESELLABLE`) or zero.
   - There is no independent `approvedQty`, arbitrary `restockedQty <= receivedQty`, or per-item final refund amount contract.
   - FE therefore constrains current receive input to 0-or-full restock and does not invent unsupported partial approval data.

36. **Order status note and online payment provider are not persisted**
   - Figma includes a free-form note in the status update modal, but current confirm/process/delivered handlers ignore request-body notes; ship persists only its generated carrier/tracking text.
   - Admin Create Order lets the user choose a visual online provider, but BE stores only `paymentMethod=ONLINE_MOCK` and no provider field.
   - FE keeps these Figma controls but explicitly discloses the BE limitation and does not send an unsupported status-note property.


## Appointments — Phase 4 audit

26. **Appointment model cannot represent multi-pet / per-pet check-in**
   - Current `Appointment` stores one `petId` / `petSnapshot` at appointment level.
   - `services[]` has no `petId`, `checkInStatus`, `checkedInAt` or `checkedInBy`.
   - No check-in endpoint exists in `booking.routes.js`.
   - FE must not infer ARRIVED from appointment `IN_PROGRESS`; multi-pet check-in in current Figma/handover cannot be integrated yet.

27. **Start-segment endpoint does not enforce check-in**
   - `POST /appointments/:id/start` only finds the service segment and sets `executionStatus=IN_PROGRESS`.
   - It does not verify that the corresponding pet has arrived.
   - FE now gates start-service while authoritative per-pet check-in is unavailable instead of bypassing the business rule.

28. **ServiceRecord schema currently allows only one record per Appointment**
   - `ServiceRecord.appointmentId` is declared `unique: true`.
   - This conflicts with the handover model where one Appointment can have multiple independent Service Records (for example SR-A / SR-B).
   - It also prevents reliable per-pet/per-service eye-linking for a multi-pet appointment.

29. **Mixed MEDICAL + GROOMING appointment is rejected by current BE**
   - `createAppointment()` requires every selected service to have exactly the same `serviceType`.
   - Current Figma examples combine Medical and Grooming in one Appointment, so this remains a BE/BA contract decision.

30. **Per-service reschedule/cancel is not implemented**
   - BE exposes reschedule/cancel only at Appointment level.
   - There is no endpoint to split/reschedule/cancel one pet/service after another segment has started.
   - FE must not implement the Figma row menu workflow by mutating the whole appointment.

31. **Appointment branch scope is incomplete on BE detail/create/mutations**
   - List scoping exists, but GET `/appointments/:id` checks CUSTOMER ownership only.
   - `createInternalAppointment` delegates directly to `createAppointment` and does not explicitly verify the Manager/Receptionist branch scope.
   - Start/reschedule/cancel/no-show flows do not consistently re-check branch scope.
   - FE now applies branchScope defensively to create/list/detail, but BE remains authoritative and must enforce the same scope.

32. **Receptionist list scoping uses `authorizedBranchIds` while other modules use assigned branch scope**
   - `getAppointments()` checks `actor.authorizedBranchIds` for RECEPTIONIST and `actor.assignedBranchIds` for MANAGER.
   - Auth/session contract currently exposes normalized `branchScope` to FE; BE actor-field consistency should be verified to avoid unscoped Receptionist reads.

33. **Appointment serializer does not expose a real lifecycle timeline**
   - `formatAppointment()` returns current state, segments and cancel metadata, but not status/history events.
   - FE cannot reproduce the Figma timeline (created, confirmed, per-pet arrived, segment started/completed, etc.) without persisted event data.

34. **Whole-appointment completion is currently coupled to one ServiceRecord finalization**
   - `finalizeRecord()` first requires every appointment segment to be COMPLETED, then sets Appointment status to COMPLETED.
   - This guards against completing while segments remain unfinished, which is correct at appointment level.
   - However, because ServiceRecord is currently unique per Appointment, this does not match the handover model of independent records per pet/service.


## Service Records — Phase 5 audit

35. **P0 — ServiceRecord creation currently defaults actual usage to planned usage**
   - `createRecord()` sets `actualMaterials = data.actualMaterials || data.plannedMaterials || []`.
   - This means a newly created record can report planned quantities as if they were actually consumed.
   - Business rule requires planned/template quantity and actual usage to remain independent.
   - BE should initialize `actualMaterials` only from explicit actual usage (normally empty at creation), never copy planned values implicitly.

36. **ServiceRecord serializer drops material notes**
   - The model stores `notes` on material rows and update endpoints accept it.
   - `formatServiceRecord()` currently serializes planned/actual material quantities and units but omits `notes`.
   - FE therefore cannot reliably display or preserve the material note after a reload/update.

37. **Inventory transaction API has no human-readable transaction code**
   - ServiceRecord finalize creates a real InventoryTransaction and groups all material lines in its `items[]`.
   - The transaction serializer exposes Mongo `id`, source/reference code and recordVersion, but no canonical `TXK-xxxx`/transactionCode.
   - FE now uses the persisted transaction id as fallback and does not invent a TXK code.
   - If Figma-style TXK codes are required, BE must persist and return a canonical transaction code.

38. **Executing STAFF cannot read ServiceRecord inventory transactions**
   - `GET /inventory/transactions` is currently limited to MANAGER / ADMIN.
   - STAFF (NURSE, VETERINARIAN, CARE_STAFF_GROOMER) can update/finalize ServiceRecords and cause inventory ISSUE/ADJUSTMENT, but cannot read the resulting transaction for the drawer.
   - This prevents the executing staff UI from showing the persisted stock-after and transaction link after finalize.
   - BE should either allow scoped read access for assigned execution staff or expose related transaction data through the ServiceRecord detail contract.

39. **ServiceRecord inventory transaction is grouped, but FE legacy contract treated it as one top-level SKU**
   - `applyServiceRecordDelta()` creates one InventoryTransaction with multiple material lines in `items[]`.
   - The shared FE drawer has been corrected to render nested `items[]`, with top-level movement as backward-compatible fallback.
   - No BE change required for this point.

40. **Material availability should be branch-scoped**
   - ServiceRecord extra material must be selected from inventory of the ServiceRecord branch.
   - FE now intersects ACTIVE MATERIAL catalog items with branch stock rows before offering them in the modal.
   - BE remains authoritative for stock and must reject insufficient inventory at finalize.

41. **Initial finalize vs correction transaction behavior is confirmed in BE**
   - Initial ServiceRecord finalize (`recordVersion <= 1`) creates an `ISSUE` when there is actual material delta.
   - Reopened/corrected versions create an `ADJUSTMENT` for the delta and preserve prior ledger transactions.
   - FE now lists all persisted transactions related to the ServiceRecord/material instead of replacing prior links.

42. **One ServiceRecord per Appointment still blocks the target per-pet/per-service architecture**
   - `ServiceRecord.appointmentId` remains `unique: true`, while the approved Web 2 flow expects independent records such as SR-A and SR-B under one Appointment.
   - Until this is changed, the desired one-record/one-service transaction separation cannot be represented end-to-end.
