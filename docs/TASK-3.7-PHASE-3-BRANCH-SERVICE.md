# Task 3.7 — Phase 3: BranchService Configuration (FE preview)

## Figma reference
- ADMIN compact modal: WEB-2 node 7152:21715, Service Catalog / Admin Cấu hình tại chi nhánh.
- MANAGER branch-scoped modal: WEB-2 node 6847:32373, Manager / Dịch vụ tại chi nhánh / Cấu hình.
- Reuses the Product branch AdminCatalogShell and Design System expand_more SVG.

## Manual test
1. Sign in to the Admin FE and visit http://localhost:3001/admin/services.
2. Open a row's three-dot menu → Cấu hình tại chi nhánh.
3. With Tất cả chi nhánh filter select one allowed branch; with a single branch filter, use that branch automatically.
4. Edit enabled, capacity or availability. Lưu cấu hình validates **only**, with an explicit 'not saved to Backend' message.
5. Check Hủy, Escape, discard confirmation and role-specific layouts.

## Validation and authorization
- ADMIN uses compact horizontal fields, MANAGER uses vertically stacked Figma fields.
- ADMIN sees all illustrative demo branches; MANAGER sees only the demo first branch; STAFF cannot configure.
- Real role/branch enforcement MUST come from BE; never treat this demo scope as security.
- Service Master inactive → branch enable disabled.
- Capacity 0 → automatically turn off, cannot toggle on; capacity stepper currently 0–100 pending BE validation contract.
- CONTACT_ONLY → availability CONTACT only. Other modes offer BY_SHIFT and CONTACT pending API/PO confirmation.
- No branch can be switched after draft changes without explicitly cancelling the draft.

## Phase boundary
- These are local Figma-based preview controls. No BranchService write API is wired, no mock database mutation or fake save success.
- Branch master management and real persistence require the Backend contract.
- Assets use repository-owned SVGs (Design System expand_more) instead of expiring Figma URLs.

## QA checklist
- [ ] Match ADMIN and MANAGER modal visual layouts.
- [ ] Capacity-zero and Master-inactive controls prevent invalid enabling.
- [ ] CONTACT_ONLY cannot select BY_SHIFT.
- [ ] Filtered branch opens matching context.
- [ ] Close/escape confirmation keeps unsaved data from being accidentally discarded.
- [ ] No write requests or false successful saves.
