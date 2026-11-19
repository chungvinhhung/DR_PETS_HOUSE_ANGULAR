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

1. **Rescue Admin**: full-page `/admin/content/rescue/new` and `/admin/content/rescue/:id/edit` use confirmed BE create/get/update routes. After user QA, the form was reduced to the fields needed for partner-owned Customer cards: pet identifier (name/species), rescue story, condition, support needs, responsible rescue partner, and uploaded image. Existing breed/age/branch metadata is preserved on edits; legacy BE requires explicit unknown placeholders on creates. Rescue partner-confirmed adopted/waiting status may be changed on edit. Unsaved-change guard and persisted-data verification remain enabled.
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


## QA change – partner-owned rescue cards (2026-11-06, supersedes earlier rescue-editor assumptions)

**Business owner:** Dr. Pet publishes rescue animals on behalf of the **external rescue partner network**. These animals are **not owned or housed by Dr. Pet**. The public Customer card has no pet-detail navigation. Neither "Nhận nuôi ngay" nor "Liên hệ để hỗ trợ" should create a Dr. Pet adoption request for this content. Both must open **the particular partner's own page** and must not default to some other organization.

**Actual Customer card content:** uploaded cover image; rescue story/description (`rescueStory`); "Tình trạng" (`healthStatus`); "Cần hỗ trợ" (`supportNeeds`); waiting/adopted ribbon (`status`); two contact links to that animal's responsible partner. `petName` is only needed by Admin to identify a profile; `species` is needed by Admin filtering. No Customer detail page exists. Remove unneeded gender/age/breed/branch editor controls.

**FE implementation:**
- Admin full-page studio now has only pet name/species, story/condition/support needs, partner selector and file-upload photo. Partner selector uses the same `RESCUE_PARTNERS` registry already shown at `/cuu-tro` (six partner IDs).
- Upload is an actual authenticated multipart upload, temporarily reusing the existing BE `POST /uploads/products` image service (JPG/PNG/WebP, 5 MB limit), returning a persisted URL stored in RescuePet.images[0]. This is technical debt, not a rescue-specific media contract. FE does not accept image URL pasting.
- Card preview now matches the 3 text sections, ribbon, image and two buttons. Customer both CTA links go to the specific selected partner's existing `href` in a new tab. If there is no valid partner ID, CTA buttons are disabled, never linked to Dr. Pet or arbitrary partner.
- Old Dr. Pet adoption request modal has been disconnected **for partner rescue cards**. Existing adoption-request list/detail remains for legacy requests; do not silently delete past request data.

**P0 BE contract – mandatory before accepting Phase 4 as E2E working:**
1. Extend `RescuePet` Mongoose model with `supportNeeds` (required nonblank string) and `supportPartnerId` (required valid string referencing the chosen partner in registry). Persist on both `POST /admin/rescue/pets` and `PATCH /admin/rescue/pets/:id`; return unchanged in Admin GET list/detail and public `GET /adoptions/pets` / `GET /rescue/pets`. Unknown IDs should be validation errors. Existing records need migration or explicit manual partner assignment, never auto-assignment.
2. `breed`, `ageDescription`, `branchId` and `gender` are not business-required for external-partner cards. Current BE incorrectly requires breed + age even though they are never shown. Make these optional with sensible null/unknown semantics, preserving values on legacy records. FE temporarily sends explicit `Chưa cập nhật` for new records until this is fixed.
3. Add a dedicated rescue-upload route or generic media contract (e.g. `POST /uploads/rescue`) with authorization, persistent object storage and URL response. Product-images upload service works as an interim transport but stores media in the product folder and must not become the long-term rescue media architecture. Avoid ephemeral local disk on production.
4. Scope the status adoption workflow appropriately for partner-owned animals: Dr. Pet must not mark partner cases adopted based on an internal request. Provide partner-verified status changes or a documented manual Admin workflow; existing `PATCH /admin/rescue/pets/:id` can update status but needs audit rules.
5. Request list and detail built in previous Phase 4 are for legacy Dr. Pet adoption submissions. Clarify whether future Customer applications belong to Dr. Pet at all; do not automatically attach a partner rescue card to internal AdoptionRequest without a new approved business contract.
6. FE verifies round-tripped `supportNeeds` and `supportPartnerId` before reporting full save success. On current BE/dev, these fields are ignored: **creating a profile can persist the legacy fields but partner association will not persist**. FE keeps the draft and shows a specific BE gap message; it must not claim the CTA link is ready.

**Acceptance:** upload one actual image → create rescue record for partner A → after refresh Admin details show partner A and need → public Customer card matches description/condition/need, shows real image → both CTA buttons go to partner A only. Repeat with partner B and ensure no cross-linking. Empty partner or unknown partner must not create enabled CTA. Check there is no Customer detail navigation or Dr. Pet internal adoption modal on these cards.

**Access:** FE repository branch can be updated. The attempt to create the matching BE branch returned GitHub 403 `Resource not accessible by integration`; no backend code was edited.
