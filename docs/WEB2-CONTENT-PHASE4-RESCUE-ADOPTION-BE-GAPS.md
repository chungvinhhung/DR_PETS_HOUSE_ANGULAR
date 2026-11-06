# WEB 2 – Phase Content 4: Cứu trợ & Nhận nuôi (FE/BE QA handoff)

**Date:** 2026-11-06
**FE branch:** `feature/admin-flash-sale-content-management`
**Scope:** Admin rescue listing/editor, adoption applications listing/detail/review, Customer Rescue feed and Customer applications.

## Figma design reference

- `6161:22560`: Cứu trợ & Nhận nuôi / Wireframe, seven-column table, filters Loài vật and Trạng thái, + Thêm hồ sơ.
- `6161:23049`: Đơn đăng ký nhận nuôi / Wireframe, filters Trạng thái and Ngày gửi (7/30/90 ngày/tất cả), columns Mã đơn/Người đăng ký/Thú cưng/Loại nhà ở/Ở một mình/Ngày gửi/Trạng thái/Thao tác.
- `6161:23538`: Chi tiết đơn nhận nuôi / Wireframe, sections Thông tin liên hệ, Điều kiện sống, Mức độ cam kết; duyệt hoặc từ chối.
- No separate rescue create/edit form frame was found within the above Content group. New FE rescue editor reuses the established Content Studio design instead of claiming a pixel-perfect dedicated Figma target.

## Confirmed BE routes and model (PET_CLINIC_BACKEND/dev)

- `GET /api/v1/admin/rescue/pets` (ADMIN/MANAGER), `POST /admin/rescue/pets` (ADMIN/MANAGER), `GET/PATCH /admin/rescue/pets/:id` (ADMIN/MANAGER), `DELETE /admin/rescue/pets/:id` (ADMIN only).
- `GET /api/v1/admin/rescue/requests` (ADMIN/MANAGER), `PATCH /admin/rescue/requests/:id/review` (ADMIN/MANAGER).
- `GET /api/v1/adoptions/pets` for Customer rescue gallery, `POST /api/v1/adoptions/requests` optional Customer authentication, `GET /api/v1/adoptions/my-requests` authenticated.
- `RescuePet` stores petCode, petName, species, breed, gender, ageDescription, healthStatus, rescueStory, images[], status LOOKING_FOR_HOME/ADOPTED, branchId and adopted-by metadata. `createRescuePet` inserts a **stock Unsplash image** when no image supplied.
- `AdoptionRequest` stores requestCode, rescuePetId, customerId, applicantInfo(fullName,phone,email,address,housingType,hasPetExperience,message), status PENDING/APPROVED/REJECTED/CANCELLED, reviewNote, reviewer and reviewedAt.
- Backend approval currently sets rescue pet status to ADOPTED. Review endpoint presently lacks an explicit PENDING-only precondition or atomic conflict guard.

## FE changes in Phase 4

1. **Rescue Admin**: full-page `/admin/content/rescue/new` and `/admin/content/rescue/:id/edit` use confirmed BE create/get/update routes. The form includes canonical required fields, optional gender and branch selection, image URL list, card preview, input validation and navigation with unsaved-change guard. Status is read-only in the editor because the adoption approval workflow is the authoritative transition.
2. **List**: species/health/location/date columns are mapped to real BE fields; saved date shows createdAt. Filtered list loads BE pages rather than truncating at the first 100.
3. **Adoption Admin**: Figma date filter (7, 30, 90 days, all), correct **Ở một mình** label/data (no false substitution with hasPetExperience), real status filtering, detail page with inline approve/reject confirmation, required rejection reason, review note and persisted status validation.
4. **Customer**: list no longer falls back to sample rescue pets when the API is empty or fails, and displays loading/error/empty states. My adoption requests normalize real Mongo `_id`, `rescuePetId`, uppercase status and applicant message.

## P0: BE changes required to complete Figma and E2E

1. **Adoption living conditions missing**: persist and return `gender`, `birthYear`, `householdAgreement` (family consent), `currentPets`, `aloneTime` (alone-home hours), `contingencyPlan` (if circumstances change), and preferably structured `adoptionReason`/follow-up notes. The Customer FE currently submits some values under `housing_info` and other payload keys, but BE discards them. Align the exact canonical DTO and validation for both Customer POST and Admin GET/detail.
2. **Detail endpoint absent**: add `GET /api/v1/admin/rescue/requests/:id` (ADMIN/MANAGER) with populated rescuePet, customer and applicant fields. FE currently discovers details by retrieving the full Admin requests list, which does not scale.
3. **Safe review transitions**: `PATCH /admin/rescue/requests/:id/review` must reject repeated/stale/terminal review states, ensure pet is still LOOKING_FOR_HOME, and atomically update request + pet status, recording moderator, time and note. If multiple applications for one pet exist, define how other PENDING requests are affected. Document rejections and conflict HTTP codes (e.g. 409).
4. **Support and adoption statuses are different**: Figma lists rescue health/support case `Cần hỗ trợ`, whereas BE only stores adoption status LOOKING_FOR_HOME/ADOPTED. Add a dedicated support-status or severity attribute (e.g. NEEDS_SUPPORT, STABLE, RECOVERED) if filtering `Cần hỗ trợ` is required. Do not map this to ADOPTED or LOOKING_FOR_HOME.
5. **Geographic region**: Figma table uses `Khu vực` like Quận 1/Bình Thạnh. BE has optional branchId only; provide district/locality or a canonical branch address field for these rows. FE currently shows branch name only, otherwise “—”.
6. **Photo upload and placeholder policy**: BE already exposes `/api/v1/uploads/products` for product images, but has no dedicated rescue/adoption-media contract (with proper storage scope and lifecycle). Add `/api/v1/uploads/rescue` (or an agreed generic media endpoint) with upload, sanitization, URL persistence, permissions and deletion. Do not silently place rescue media in the product folder. Avoid replacing missing rescue images with unrelated stock photos. FE currently requires real HTTP(S) URLs; rescue browser local-file upload is not connected.
7. **Paginated list and sorting**: return real `total`, `totalPages` and stable ordering. BE already emits these. For larger datasets, implement server-side search/status/date filtering and paginated table, rather than fetching every page client-side.
8. **Enforce adoption status consistency**: BE currently allows direct PATCH of RescuePet.status. Guard transitions so a record cannot become ADOPTED independently of an approved application without explicit documented administrative override.
9. **Availability of adoption requests**: guest-created applications currently have `customerId=null`, so cannot appear in `GET /adoptions/my-requests` for a later Customer login unless linked. Define the desired claim/linking process if guest applications must be tracked.
10. **Role and audit checks**: ADMIN/MANAGER may create/update rescue profiles and review requests; only ADMIN may delete rescue profiles. Ensure backend authorization and audit logs are enforced.

## E2E acceptance criteria – pending BE and browser validation

- Admin creates and edits rescue profile with valid image URLs and selected branch; Customer gallery shows the actual pet, photo and updated details without stock records. Blank or invalid URLs cannot silently produce unrelated imagery.
- Customer sends adoption request with all Figma fields; Admin list and detail show identical persisted applicant, home, hours-alone, commitment values after refresh.
- PENDING → APPROVED updates Customer pet to ADOPTED exactly once; PENDING → REJECTED preserves reason and leaves pet adoptable. Repeated approval or conflicting approval does not corrupt adoption status.
- 7/30/90-day filtering matches the request createdAt dates; status, paginated results, branch filters and data totals are consistent beyond 100 records.
- API failures show explicit error messages with no fake success/data. Test MANAGER review/ADMIN delete, expired sessions and repeated requests.
- Passing Angular CI does not imply browser or BE E2E acceptance; both still need verification.
