# WEB 2 – Phase Content 3: Bài đăng cộng đồng (FE/BE handoff)
Updated: 2026-11-06
Branch: `feature/admin-flash-sale-content-management`
Status: FE community list, moderation and Admin composer implemented; Admin create BE integration BLOCKED; browser E2E NOT verified.

## Figma reference
- File: WEB-2 (`vak640d4oft2Azmhu7HoGM`)
- Community Admin list wireframe: node `6161:22085`.
- Figma list shows top-right `+ Tạo bài đăng`, filters `Loại bài` and `Trạng thái`, columns Người đăng / Nội dung / Loại / Lượt thích / Bình luận / Trạng thái / Thao tác.
- Figma has no dedicated create-form frame in this section; the FE creation form derives from existing Content Studio styling. Do not mark its pixel-level Figma acceptance as confirmed.

## Confirmed BE source (minhllk24/PET_CLINIC_BACKEND, dev)
`src/modules/content/adminContent.routes.js`:
- `GET /admin/community/posts`: ADMIN, MANAGER
- `PATCH /admin/community/posts/:id/moderate`: ADMIN, MANAGER
- `DELETE /admin/community/posts/:id`: ADMIN
- **NO** `POST /admin/community/posts` or `PATCH /admin/community/posts/:id`.
`src/modules/content/publicContent.routes.js`:
- `GET /community/posts`: public, APPROVED only
- `POST /community/posts`: CUSTOMER authentication required
`CommunityPost` MongoDB model currently requires `authorCustomerId`, stores `title`, `content`, `imageUrls`, `status`, `likesCount`, `commentsCount`, and moderator fields. It does **not** store post `type`, Admin authorship, or report metadata.

## P0 BE requirements for Admin “Tạo bài đăng”
1. Implement `POST /api/v1/admin/community/posts` for authenticated ADMIN. FE sends:
   ```json
   {
     "title": "Tiêu đề hợp lệ",
     "content": "Nội dung bài đăng",
     "type": "Chia sẻ",
     "imageUrls": ["https://example.com/image.jpg"],
     "status": "APPROVED"
   }
   ```
   `type` may be `Chia sẻ`, `Hỏi đáp`, `Thông báo`. Allow `status: DRAFT` for Save Draft.
2. Support **Admin-originated authors** without a mandatory `authorCustomerId`; store author role/source and display name. Do not create fake Customer identity. Automatically render the actual Admin brand identity in Customer as agreed with product owner.
3. Return `201` with a stable `_id` (or `id`) and **persisted** `status`; FE will not report success without both. For `APPROVED`, the created post must become visible in public `GET /community/posts`; `DRAFT` must never be public.
4. Sanitize and validate title (required), content (required), post type taxonomy, image URLs (up to 5 valid http(s) URLs), request body size and permissions server-side. Reject unauthorized roles with 403; preserve media and type on read.
5. Allow Admin edit of own posts via an agreed `PATCH /admin/community/posts/:id` contract if full editing is expected; current FE intentionally does not expose a nonfunctional edit action.
6. Extend read list/detail to include persisted `type`, Admin/customer authorship, dates and report signals. Figma wants `Bị báo cáo`; backend has no `reportCount`, `isReported` or report status. BE needs an explicit source (e.g. reportCount + status) rather than FE guessing based on text.
7. Document how Figma UI statuses map to API statuses: Bình thường ⇔ APPROVED (without report), Bị báo cáo ⇔ explicit report signal, Ẩn ⇔ HIDDEN; additionally retain PENDING/REJECTED for the actual moderation queue.
8. Expose correct pagination totals on `GET /admin/community/posts` and `GET /community/posts`. FE currently loads up to 100 into the Admin list and paginates those client-side; exhaustive data beyond 100 is not yet proven.
9. Align Customer commenting/liking and Customer compose persistence with dedicated community endpoints; current frontend composer is local-only and comment/like routes target blog posts. Do not claim these flows as working E2E.

## FE implementation details
- Admin route: `/admin/content/community/new` restricted to ADMIN.
- Figma button `Tạo bài đăng` routes to dedicated Content Studio form.
- Form validates title, content, optional images, type, and has Draft / Publish actions.
- FE calls proposed `POST /admin/community/posts`; 404/405 shows explicit BE missing endpoint error and never shows fake success.
- Moderation remains on existing confirmed API. Customer feed now uses `GET /community/posts` rather than generic blog `GET /posts?type=community`; fake featured/seed cards were removed from successful Customer read.
- Existing BE returns no `type`, so Admin Type filter is disabled until real typed data is returned.

## QA / acceptance (not yet completed)
- Admin creates DRAFT: stable ID and status returned, not visible in Customer, visible in Admin list.
- Admin creates APPROVED with 0 and 3 valid images; post appears once in Customer feed with correct type, author, body and images.
- Customer-created PENDING is invisible publicly until Admin/Manager approves; REJECTED requires a reason and stays hidden; APPROVED → HIDDEN removes post from public feed; HIDDEN → APPROVED restores it.
- Proper status and report filtering, real likes/comments counts, pagination across >100 posts.
- Admin cannot create post as MANAGER; Manager can moderate, not delete.
- 4xx/5xx API failures never report success or insert fabricated records.
- Production Angular CI + browser UI QA on actual deployed API/DB must both pass before phase sign-off.


## UX correction after user visual QA (2026-11-06)
- On the Admin community list, **Tạo bài đăng** now opens the existing Customer page `https://drpetshouse.lat/bai-viet/cong-dong` in a new tab. The separate Admin composer route built earlier remains a technical draft but is **not linked from the Admin list**; do not describe it as the current Add flow.
- The Admin review modal has one contextual primary action (approve/restore) and an overflow menu for hide/reject/delete. Reject and delete confirmations are embedded in the modal.
- **Xem trên trang web** goes to `/bai-viet/cong-dong?postId=<id>` for `APPROVED` posts. It is disabled for `PENDING`, `REJECTED`, `HIDDEN`, since the BE public endpoint returns only approved posts. The Customer route reads the ID and opens the matching public post from the loaded feed.
- Customer composer now submits text posts to the existing authenticated `POST /community/posts`. Backend requires a title; FE derives it from the first nonempty content line and verifies returned `PENDING` status. Failed requests keep the draft; approved-feed items are not fabricated.
- Uploading local images/videos in the Customer composer is **still blocked** pending a real public media upload endpoint; the UI shows a clear message rather than uploading a blob/object URL or claiming success.
- Customer post type selection is forwarded as metadata but is not currently persisted in the backend `CommunityPost` schema. Add schema/storage/read mapping.
- Link opening the **production** Customer site and direct-post navigation will show the new behavior there only after this FE branch is reviewed and deployed. Local code updates alone do not modify the existing production page.
- Authentication for the Customer composer uses a CUSTOMER login, not an ADMIN session; BE should decide whether an Admin-originated public announcement feature needs a separate contract.

## Moderation actions refined after QA (2026-11-06)
- The Admin `Tạo bài đăng` link is now inside the list **filter bar** (after the two filter selectors), matching the other management modules. It still opens the Customer Community page.
- The pending moderation modal offers **Duyệt bài** and **Từ chối**. The latter records `REJECTED` and a mandatory reason, leaving the original row searchable/auditable; permanent deletion is not offered for pending posts.
- `APPROVED` shows **Ẩn bài**. `HIDDEN` offers **Hiện bài** and Admin-only **Xóa vĩnh viễn**. `REJECTED` offers **Duyệt lại** and Admin-only **Xóa vĩnh viễn**.
- FE requires `REJECTED` or `HIDDEN` for permanent deletion and requires an inline confirmation. BE currently allows deletion for any status from Admin. **BE should enforce** the same status rule if the workflow must hold across all API clients (reject invalid DELETE attempts with 409); retain rejection reason and moderation timestamps when rejecting.
