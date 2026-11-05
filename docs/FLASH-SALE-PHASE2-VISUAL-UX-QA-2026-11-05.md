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

## Related work
BE contract and end-to-end acceptance: `docs/BE-HANDOFF-ADMIN-FLASH-SALE-2026-11-05.md`.
Do not merge this branch into main or sign off Phase 3/4 while BE contract and CI/runtime checks remain pending.
