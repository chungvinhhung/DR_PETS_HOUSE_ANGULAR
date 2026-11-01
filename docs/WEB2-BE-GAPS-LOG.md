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
