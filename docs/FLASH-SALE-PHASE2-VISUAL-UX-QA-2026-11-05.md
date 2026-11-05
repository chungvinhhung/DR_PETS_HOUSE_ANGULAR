# Flash Sale — Phase 2 Visual/UX QA (WEB 2 Admin)

Date: 2026-11-05  
Branch: `feature/admin-flash-sale-content-management`  
Reference Figma file: `vak640d4oft2Azmhu7HoGM` (WEB UI Copy)  
Reference nodes reviewed: Product list `6037:20512`, Add product `6495:26844`.

## Design intent / scope
The Flash Sale Admin follows existing WEB 2 Admin UI, not a new dashboard language:
- white Admin content surface, Roboto, #0D47A1 brand actions
- thin gray-blue borders and rounded Admin panels, no decorative KPI/gradient
- local tabs Voucher | Flash Sale, aligned filter bar, table, pagination
- single main information panel, simple product table, SKU picker modal
- status is inferred from BE/clock; only publish/draft and the pause switch are controls
- **no branch-specific Flash Sale settings**

## Fixes applied in this QA pass
1. Removed the standalone status right column that wasted space; moved badge + pause switch into main information header.
2. Matched the existing Figma 56x32 switch geometry; placed switch before “Tạm ngừng chương trình”.
3. Restored clear primary/secondary button hierarchy: only the main submit/publish action is primary.
4. Simplified Flash Sale list actions to the same single eye/view icon used by Admin tables; edit remains available on Detail.
5. Standardized list pagination to `ADMIN_TABLE_PAGE_SIZE=6`, with shared numbered-page window and cursor-safe jumps.
6. Removed awkward “tổng số chưa xác định” text when BE omits total; no pagination UI on empty/error/loading views.
7. Added focus to modal SKU search, Tab-key focus cycling, focus restoration when closing and a focusable unsaved-changes confirmation.
8. Updated create Idempotency-Key after draft content changes while keeping the key stable for an unchanged retry.
9. Made editing lock respond to the current time when a published campaign ends while the page is open.
10. Corrected error text to distinguish an unknown Flash Sale ID (404) from unsupported management capability.
11. Revised filter-bar breakpoint so the sidebar/content split does not cut off dropdowns on small laptops.
12. Preserved actual API-driven status, media and SKU details; did not add FE mock records or simulate a successful save.

## Code/source QA performed
- Source inspection against Figma Product List and Add Product frames.
- 17/17 static checks passed after edits: template tag nesting, status/pause placement, icon reuse, pagination and empty state, routes, focus, reactive expiry, key safety, lack of branch selector/mock data, API lifecycle and CSS braces.
- Asset file paths for search, close, delete and eye icons were verified against repository paths.
- Flash Sale component styles remain below Angular 8 kB per-component style budget; the feature's scoped visual declarations live in `src/styles.scss`.
- Existing Voucher page was not restyled beyond its previously created shared local tabs.

## Explicit unverified gates
**Not yet a runtime/visual screenshot PASS**:
- Angular production build and actual browser render of `/admin/flash-sales`, `/new`, `/:id`, `/:id/edit` have not been run in this environment, which does not have a checkout of the repository.
- No GitHub CI workflow run has been confirmed on this latest head.
- BE still needs to mount/implement the Flash Sale CRUD/publish/pause contract; the actual save and Customer/Checkout impact cannot pass E2E yet.
- Review rendered screenshots after pulling locally to verify horizontal/vertical overflow, mobile widths 1440/1280/1024/768/390, focus navigation, exact spacing and typography.

## Manual UAT checklist for FE before visual sign-off
- Desktop widths 1440 and 1280: header/sidebar stable; tabs same as Voucher; search/filter/button fit; table first/last columns align; icon view-only.
- 1024 / 768 / 390: filter bar wraps before clipping; table scrolls horizontally; controls stay visible; modal fits viewport and can be dismissed by Escape.
- Create: only mandatory markers alongside labels; all fields editable; 6-row numbered list stable; SKU picker search, select, load more; no duplicate variants.
- Edit: correct values loaded from BE; cancel warns on dirty changes; pause switch returns to previous state on failed request; end time locks editing.
- Detail: clean info + status header and product table, no separate giant status panel, no dashboard charts.
- API error: no fake empty dataset/success; loading/error/empty use existing shared Admin component; toast wording is user-facing.
- Security: Manager read-only; Admin create/edit/publish/pause; BE independently enforces RBAC, stock and quota.

## Follow-up refinement — 05/11/2026 (screenshots 1–6)
- Search Flash Sale cố định tối đa 360px bên trái; dropdown trạng thái và nút Tạo Flash Sale dồn phải, dùng shared `web2-add-icon` / `web2-add-button` như Voucher.
- Ba CTA của màn tạo/bản nháp khác biệt: Hủy bỏ (trung tính), Lưu bản nháp (outline), Lưu chương trình (primary). Tạo/sửa chương trình đã đăng thì dùng Cập nhật chương trình (primary).
- Lưu chương trình sẽ publish nhưng trạng thái hiển thị **theo lịch**: UPCOMING trước giờ, RUNNING khi tới giờ; không ép RUNNING khi chưa tới giờ. Chặn publish nếu đã quá `endAt`.
- Khôi phục section Trạng thái chương trình riêng theo bố cục form Figma cho PUBLISHED đang trong thời gian chạy; switch ON = đang hoạt động, OFF = tạm ngừng. DRAFT, UPCOMING và ENDED không hiện switch.
- Modal SKU search dùng một container cao 44px, input lấp đầy chiều cao mà không có outline lồng nhau; footer rút ngắn thành “Đã chọn: N sản phẩm”; nút “Tải thêm sản phẩm” đổi sang tertiary nhẹ.
- 20/20 điều kiện static QA đã kiểm tra trên source sau thay đổi. Angular build/render/E2E vẫn phải xác minh tại môi trường local/CI có repo đầy đủ.

## Follow-up refinement — date rules, price controls and WEB2 typography (05/11/2026)

- Breadcrumbs in Create/Edit/Detail start from **Flash Sale**; remove the redundant “Khuyến mãi” parent.
- The main information card is centered with a 1020px maximum width when no operating-status card is needed, avoiding extremely long form fields. The SKU pricing table remains full-width below, so SKU/price columns do not get cramped.
- The operating-status panel appears instantly when the Admin selects **today in Vietnam** for the start date, including a future hour today; also remains available for a currently running PUBLISHED program. The switch is staged on DRAFT, persisted through `isPaused` in create/update, and passed to publish atomically. For a future start time today, the enabled label reads “Sẽ hoạt động theo lịch”, not “Đang hoạt động”. Selection of a future date hides the panel and resets any hidden pause choice.
- Start `datetime-local` has a minimum of **the next Vietnam-local minute**, not just midnight. Out-of-range manual input is clamped and saving is blocked if the start has become past. A PUBLISHED campaign already started has its original start timestamp locked during editing. End must be after start and for an active PUBLISHED edit cannot be in the past.
- Price input follows Product Add/Edit: native number arrow-step `1000` VND, selected value on focus, preserving strict positive integer and below-retail validation.
- Both **Voucher** and **Flash Sale** headings now use 28px/36px, weight 700; both local tabs use 16px/24px with 46px tab height and three-pixel active underline, aligning with Orders local tabs.
- Static source QA passed for these changes, but local Angular production build and browser-render UAT remain pending. Do not mark BE integration or E2E complete.

## Related work
BE contract and end-to-end acceptance: `docs/BE-HANDOFF-ADMIN-FLASH-SALE-2026-11-05.md`.
Do not merge this branch into main or sign off Phase 3/4 while BE contract and CI/runtime checks remain pending.

## Latest visual refinement — full-width inline switch (05/11/2026)

- Flash Sale program-information panel now fills **100% of the Admin content area**, with 3 aligned fields in the time row: Start time, End time, and the inline scheduled activation switch. No separate activation panel remains; product section retains a clean vertical gap.
- Voucher retains its existing benefit/time two-column arrangement. The activation switch is placed **inside Thời gian & giới hạn**, aligned to the right of the date/time controls; it no longer consumes a separate full-width card.
- Both forms show the switch **before any date has been selected**, defaulting ON with **Tự động kích hoạt theo lịch**; OFF displays **Kích hoạt thủ công**. Once the selected start time is reached, the same switch changes labels to **Đang hoạt động / Tạm ngừng**.
- An expired promotion's switch is disabled. On narrow screens the 3-column layouts wrap to 2 and then 1 column without truncating labels.
- Source QA checked template structure, absence of separate status cards, default state, API contract and responsive CSS. Browser screenshot review and build remain unverified.

## Follow-up UX revision — two-stage activation, shared with Voucher (05/11/2026)

This section supersedes older screenshots/notes about switches only showing for today's start and about the large status sidebar.

- **Before startAt (today or future date):** one compact switch with ON **Tự động hoạt động theo lịch** and OFF **Kích hoạt thủ công**. OFF persists in DB and remains paused when startAt arrives; no background cron may turn it on.
- **During startAt ≤ now < endAt:** the same switch reads ON **Đang hoạt động** / OFF **Tạm ngừng**; Manager cannot mutate, Admin can.
- **After endAt:** hide/disable mutation switch, never reactivate expired promotion.
- **Flash Sale:** use `activationMode:'AUTO'|'MANUAL'` plus `isPaused` in create/edit/publish/pause and enforce atomic persistence by BE.
- **Voucher:** existing BE `ACTIVE/INACTIVE` is enough to represent the two modes, provided checkout checks both status and effective dates and no scheduler enables an INACTIVE voucher automatically. The form/view now share a 2-phase switch.
- **Layout:** no tall right status panel. A compact horizontal strip (max width 1020px, minimum height 88px) sits below the program-information panel with a clean 18–26px gap before the next section. Voucher status moved out of the 3-column details layout, which now uses 2 balanced columns.
- **Acceptance tests:** create AUTO and MANUAL promotions, save, reload, reach startAt, reload again, purchase attempt. MANUAL must remain unavailable until an explicit Admin toggle. Confirm response state before success toast; failed API call restores switch.

Manual browser render and end-to-end BE checkout integration are still pending; static code review does not establish E2E PASS.

