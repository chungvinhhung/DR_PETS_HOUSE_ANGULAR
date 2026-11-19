# FE Admin — Internal BE dependency / E2E log
**Source:** FEEDBACK (8).docx, 6 pages, received 18 Nov 2026.
**Scope:** `integration/admin-customer-backtotop-20261116` only. Internal working log; **not yet a request sent to BE**.
**Interpretation:** Do not label a BE issue confirmed until verified against the deployed Render environment.

## Items blocked or requiring cross-team E2E

1. **Species “Khác” must persist as a distinct, human-readable species name.**
   - BE `src/modules/customer/models/Pet.js` uses an enum (`DOG/CAT/BIRD/RABBIT/OTHER`) with no `speciesDetail/speciesName` persistence field; `pet.routes.js` normalizes arbitrary species to `OTHER`.
   - Internal appointment FE now has an input for species detail; to avoid losing the detail entirely, the booking draft also preserves `Loài cụ thể: …` in `medicalNotes`. This is **not equivalent** to storing an independent species field in the master Pet profile.
   - BE decision required: define field/schema and create/update/get/list contracts, preserve on `POST /internal/appointments` and pet endpoints, return it for edit/detail; coordinate Customer implementation as well.
   - Verification: create and edit an OTHER pet, reload, verify exact text survives; ordinary species must remain normalized.

2. **Branch-level shift-template CRUD — BE contract found; verify deployment.**
   - Source BE `feat/foundation-v6` has `GET/POST /branches/:branchId/shift-templates` and `PATCH/DELETE /branches/:branchId/shift-templates/:id`, with `ShiftTemplate` DTO and role checks. The FE previously displayed a disabled placeholder; this round connects the actual CRUD API to the branch tab.
   - No BE API addition is requested until tested. Verify the Render deployment includes these routes, permissions for Admin/Manager and real data persistence.
   - BE gap if deployed route 404/405: deploy relevant branch routes; FE must not generate mock shift rows.

3. **Customer submitted review absent in Admin.**
   - Admin calls `GET /reviews/admin`; BE does define that route. FE was updated to fetch all pages (up to 100 pages, 100 items/page), not just first 100 items.
   - Still requires E2E with a newly submitted review against the **same database**: compare `POST /reviews` response id and Admin list `GET /reviews/admin` including targetType, sourceId, status/visibility. Verify authorization for Manager branch scope. If the API does not include the review, BE/Customer must investigate create/persistence or environment mismatch. No claim of a BE defect yet.

4. **Flash Sale shown to Customer before startAt.**
   - Admin helper and BE `deriveFlashSaleState` already distinguish `UPCOMING` from `RUNNING` using the server timestamps; local frontend editor tracks Asia/Ho_Chi_Minh time.
   - Capture actual `startAt`, `endAt`, `activationMode`, `isPaused`, `derivedStatus` and Customer banner API response from the screenshot scenario. Determine if Customer is presenting UPCOMING as RUNNING or server wrongly exposes the sale. Cross-team BE + FE Customer E2E; do not change dates blindly.

5. **Admin Customer detail — address, review linkage and medical history.**
   - FE customer-detail and pet-detail previously displayed backend-contract notes to end-users; these have been replaced by neutral empty states.
   - Still verify whether BE returns address history, linked reviews, and medical records for customer/pet detail; if not, provide necessary read APIs/contracts before showing those sections as complete.

6. **Internal booking scope / pricing.**
   - BE currently accepts `serviceIds[]` and sequential availability for a **single** pet. FE exposes extra services for one selected pet only. Multi-pet atomic booking and a non-mutating authoritative total pricing preview are not supported/confirmed.
   - Email is optional in `createAppointment` guest contact on inspected BE source; FE no longer forces email for Admin internal booking.
   - E2E needed for 1 pet + multiple services, slot availability, final price, duplicate prevention, idempotent retry.

## FE-owned fixes staged this round (to QA)
- Create appointment: visible “Dịch vụ bổ sung” UI for one pet; email optional; species detail composite UI with explicit note fallback; map pet ageYears and photoUrl.
- Catalog: serviceType filter using BE server query `serviceType` (resets page); preserve 6 rows/page.
- Reviews: paginate GET /reviews/admin; neutral error copy.
- Customer admin detail: display BE `photoUrl` and `ageYears`, neutral empty states.
- Inventory: wrap long SKU/variant values inside the correct column.
- Text UX: remove BE/Backend/API/contract references from user-visible messages throughout key Admin modules, with more specific actionable copy.
- Flash Sale editor: copy updates only; timeline/activation behavior remains unchanged pending evidence.
- Branch shift templates: list/create/edit/delete wired to the BE OPS-03 endpoints; still needs live Render E2E.
- Customer app files untouched; `main` untouched.

## QA / handoff checklist
- Verify Angular production build and Vercel Preview after commit.
- Use real Admin, Manager, receptionist, clinical staff, and Customer accounts with safe test data on the matching Render environment.
- Compare API contracts, screenshots, and preserved data. Tick each original feedback item only after UI + BE end-to-end verification.
- When owner requests, turn this internal log into a separate BE request DOCX; **do not send before then**.


## 19 Nov 2026 — Inventory history + branch-shift assignment (6 screenshot feedbacks)

1. **Inventory transaction code/structured reference:** FE now shows `[transactionCode || —] / [sourceCode || referenceCode || sourceId || —]`, with navigable links only for recognized order/return/service-record source types. Verify live `GET` inventory-transactions consistently returns public `transactionCode` and meaningful `sourceCode/referenceCode`, not only Mongo ObjectId. If fields are missing, BE must return stable display codes and source type/ID; FE must not invent them.
2. **Branch shift templates must be shared and durable:** FE assignment modal now loads `GET /branches/:branchId/shift-templates`, and the Create dialog calls `POST` on the same branch. It does **not** create an employee's actual shift until Lưu phân công submits `POST /shifts`. Validate that templates created on either branch or schedule screen appear in both, after reload, for other employees/dates in the same branch; no cross-branch leaks. If the deployed GET stays empty despite a successful POST, collect request/response logs and investigate BE storage or RBAC.
3. **Shift assignment payload contract:** `POST /shifts` currently accepts `{staffId,branchId,startAt,endAt}` and has no templateId link. FE deliberately uses selected template's hours to construct a dated assignment; confirm that server returns consistent staff shifts across date boundaries and checks overlapping assignments. Template creation does not save an assignment.
4. **No BE change assumed for UI issues:** search icon/input layout, column alignment, cell rendering and icon buttons are FE-only fixes. Re-test against responsive widths and production data.


## 19 Nov 2026 — Slot status confusion (Branch operating hours)
- FE correction: Previously interpreted all `remaining = 0` slots as "Đầy" even for `bookedCount = 0 / totalCount = 51`. BE `availability.service.js` sets `FULL` if there is no qualified staff shift or outside an availability window, not just due to occupied bookings. FE now uses "Chưa khả dụng" for zero-bookable, non-saturated slots and "Đầy" only when `bookedCount + heldCount >= totalCount`; modal and summary agree; the columns distinguish nominal configured capacity from real bookable spots.
- **BE follow-up:** Provide `reasonCode` in each slot for `NO_QUALIFIED_STAFF`, `OUTSIDE_SERVICE_HOURS`, `CAPACITY_EXHAUSTED`, `BLOCKED_WINDOW`, `HELD_CAPACITY`; avoid overloading `FULL` for staffing issues. Verify the specific branch/date in the user screenshot where 0/51 booked but remaining=0, and confirm if staff shifts, required roles, or availability windows are missing. FE cannot assert the root reason without real API response.
- E2E needed: unstaffed (0% + Chưa khả dụng), full with holds (Đầy), blocked (Tạm khóa), mixed multi-service windows (aggregated state), and matching detail modal.
