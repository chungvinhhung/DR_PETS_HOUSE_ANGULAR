# WEB 2 – Đánh giá & Phản hồi: đối chiếu Figma, FE, BE

Date: 2026-11-06
FE branch: `feature/admin-flash-sale-content-management`
Figma file: `vak640d4oft2Azmhu7HoGM`, ADMIN Section `6171:21997`
Scope: `Đánh giá`, `Phản hồi khách hàng`, `Báo cáo vi phạm`, chi tiết phản hồi và chi tiết báo cáo.

## Figma references
- Reviews list: `6171:22000` — search name/order/appointment code, rating 5/4/≤3, status, date range, review table.
- Customer feedback list: `6171:22938` — search, status, date range, table + view-detail.
- Violation reports list: `6171:23402` — search reporter/post, reason, status, date range and details.
- Feedback detail: `6171:23862` — contact summary, feedback content, date/source/status, processing.
- Violation detail: `6171:24183` — reporter, post and report details; dismiss or hide reported post.

## Verified BE source (minhllk24/PET_CLINIC_BACKEND @ dev)
- `GET /api/v1/reviews/admin` and `POST /reviews/:id/hide`, `POST /reviews/:id/show` exist for ADMIN/MANAGER.
- `review.service.formatReview` returns id, targetType, targetId, rating, comment, displayName, hidden, createdAt but **not** sourceType/sourceId or order/appointment code, nor targetName/target display information, hidden reason, flags/reports.
- `GET /reviews/admin` caps at 100 results, has no page/cursor implementation and returns only `items,nextCursor:null`. Do not claim all reviews are loaded if there are >100.
- `GET /api/v1/feedback`, `GET /feedback/:id`, `PATCH /feedback/:id/status` exist for ADMIN/MANAGER.
- `GET /feedback` supports page/limit with real total/totalPages. FE now loads all BE pages for accurate client-side filtering within reasonable data volumes (up to 100 pages).
- Feedback model stores name, phone, email, subject, message, category, status, notes, response; **no gender field**. FE displays `—` rather than fabricating a gender.
- Feedback state transitions: NEW→READ/PROCESSING/REJECTED, READ→PROCESSING/REJECTED, PROCESSING→PROCESSED/REJECTED/NEED_CONTACT, NEED_CONTACT→PROCESSING/REJECTED/PROCESSED; terminal PROCESSED/REJECTED. Figma's immediate `Đánh dấu đã xử lý` from NEW would currently return 409; FE uses valid two-stage transition.
- Backend tree has no dedicated Admin community violation/report model/routes with reporter, post, reason, investigation and decision. Existing content moderation for community posts is **not** the same as a structured user-submitted violation report.

## FE work
1. Correct actual rating filters: 5 stars, 4 stars, <=3 stars, not substring matching; status and 7/30/90/all time filters are functional. Search is scoped to relevant fields instead of JSON dumps.
2. Reviews table opens a compact review moderation dialog (no invented separate Figma detail route). User can hide a visible review after entering reason or restore a hidden review; writes use confirmed BE endpoints and update current list only after success.
3. Feedback list fetches all returned pages. Customer detail now supports inline confirmation and optional processing notes. Invalid status transitions are avoided; statuses returned by BE are validated before showing success.
4. All reporting URLs remain technical/blocked and are NOT backed by mock data or fake moderation controls. Report list and detail still display a technical state until BE API contract exists.
5. Existing shared Admin table, pagination, controls, eye icon and content shell remain in use.

## BE P0 contract to complete this module
1. **Review list richness:** include reference source (`sourceType`, `sourceId`, real order/appointment code), target product/service name, customer display name with role/privacy controls, and actual report/flag indicator if Figma requires `Cần xem xét`. Do not make low rating automatically equal to reported review.
2. **Review pagination:** add `page,limit,total,totalPages` or a working cursor to admin review API. Today only 100 latest can be retrieved.
3. **Feedback gender:** only add if explicitly collected with consent and legitimately required by the form/Figma; otherwise remove Figma gender column in a coordinated product decision. Do not infer.
4. **Feedback status design:** decide whether the Figma direct `Đánh dấu đã xử lý` button is intended from NEW; if yes, update BE transition contract. If not, retain actual PROCESSING→PROCESSED workflow. If customer replies are required, define responseMessage sending and notification workflow (BE currently stores notes but does not guarantee outbound reply).
5. **Violation reports entity and endpoints:** define `Report` schema (reporterId, target community post/comment, post snapshot, reason category, details, status PENDING/UNDER_REVIEW/RESOLVED/NO_VIOLATION, reviewedBy/time/note), `GET /admin/reports` paginated, `GET /admin/reports/:id`, `PATCH /admin/reports/:id/resolve` with reject/dismiss/hide operations, plus authenticated Customer create report endpoint. Decide whether hiding should moderate underlying CommunityPost and update report atomically. Enforce permissions, rate limits, audit fields, conflict codes and notification rules.
6. Provide seeded meaningful QA data (both positive and negative) for each status, including >100 reviews, and a verified staging base URL. FE MUST not insert demo records into real API views.
7. Before signoff verify actual database responses and browser UI on screen widths, filter combinations, pagination, hide/show, feedback processing, report moderation when implemented, and role restrictions.

## Acceptance status
- FE changes have been committed to the feature branch, but visual browser QA and BE end-to-end verification are still pending.
- Angular CI verifies build only; it does not establish complete Customer-to-Admin data flow.
- Never merge or deploy automatically.

## Customer-first source reconciliation (2026-11-06; verified against Customer FE and BE/dev)

**Review creation and display on Customer:**
- `WriteReviewFormComponent` has the fields **Tên của bạn**, **Đánh giá của bạn** (1–5 stars) and free-text review. Product detail renders **author**, **star rating**, **review content**, **like UI**, **created date**. Service review is collected via the appointment-history modal using the same form and `targetType=SERVICE`.
- Real BE review records expose `id,targetType,targetId,rating,comment,displayName,anonymous,hidden,createdAt`. The form's manually entered name is NOT currently stored as the review author; BE chooses the authenticated Customer name. Customer normalization now reads `displayName`, fixing the prior “Khách hàng” fallback for named reviews.
- Admin review details/list should use only these real fields. `sourceId`, `sourceType`, code of order/appointment, target name and like count are **not returned** by current Admin review API (even though the BE Mongoose model stores sourceType/sourceId). Admin must use `—` or a type label instead of inventing values.
- For visible **PRODUCT** reviews only, Admin links directly to `/product-details/:productId?tab=reviews&reviewId=:reviewId`. Customer shows the original review from public `GET /reviews/:id` even if not loaded on page one, and opens the review tab. Hidden reviews intentionally have no public link. For **SERVICE** reviews, there is no per-review Customer destination yet; do not invent one.
- Customer currently has **no staff reply form** in the product detail review card, and BE has no review reply schema or endpoint. The chat suggestion to “trả lời ngay bên Customer” is **not E2E implementable yet**. Required: agree a Customer-facing reply component, Admin/Manager reply permission, stored `replyText/repliedBy/repliedAt`, edit/hide rules, and an API contract. Only then add any “Đã trả lời/Đã giải quyết” labels.
- The Customer review card displays a like affordance; currently there is no confirmed review-like BE route in `review.routes.js`. Its count/like behavior is not validated; no invented likes field should appear in Admin.

**Customer contact form and Admin feedback:**
- Actual form at `/lien-he` collects **Tên của bạn**, **Giới tính** (male/female/other), **Số điện thoại**, **Địa chỉ email**, and **Nội dung**. It does **not** ask the Customer for a `subject` or a sentiment/category.
- Previously the form sent `POST /contacts` while BE/dev exposes `POST /feedback`, requiring `name,subject,message`. FE now routes the form to **POST /feedback** with the Customer's actual fields and a truthful fixed `subject='Liên hệ từ website'`, `category=GENERAL`. This aligns the Customer submission with the Admin `GET /feedback` collection.
- BE Feedback schema/service currently **discard gender**, even though Customer collects it. FE retains the Customer field in the submitted payload, but Admin displays `—` until BE supports `gender`. Add nullable `gender: female|male|other` to schema and persist it in create/list/detail; historical records must remain unspecified.
- Admin details reflect Customer's real `name,gender (if persisted),phone,email,message` and the returned subject. Do NOT invent a Customer-entered subject or “tích cực/tiêu cực” sentiment. BE categories COMPLAINT/SUGGESTION are available for other inputs, but this public form currently submits GENERAL only.
- The Admin feedback state selector now exposes only BE-supported transitions NEW→READ/PROCESSING/REJECTED; READ→PROCESSING/REJECTED; PROCESSING→NEED_CONTACT/PROCESSED/REJECTED; NEED_CONTACT→PROCESSING/PROCESSED/REJECTED. Reject requires reason; actions validate BE response before success.
- `responseMessage` stored in BE is **not proof of an outbound reply to the Customer**. Do not call a notes/status change “Đã trả lời”; add a real reply-and-notify workflow before acceptance.

**Acceptance after BE work:** Submit a Customer contact with gender and message → Admin detail shows exactly those fields after reload; submit a named review → Customer product detail and Admin show identical author/rating/content/date; approved product review deep-link opens correct public card; service review waits for an actual Customer destination. Run manual browser tests plus CI (CI alone does not validate E2E).
