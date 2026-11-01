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
