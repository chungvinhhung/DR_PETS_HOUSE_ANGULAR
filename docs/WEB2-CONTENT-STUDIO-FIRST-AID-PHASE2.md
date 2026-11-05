# WEB 2 — Phase Content 2: Cẩm nang sơ cứu
Updated: 2026-11-06
Branch: feature/admin-flash-sale-content-management
Status: FE implemented, static source QA only; BE E2E and deployed visual QA NOT confirmed.

## Scope in this phase
- Dedicated First Aid editor routes:
  - `/admin/content/first-aid/new`
  - `/admin/content/first-aid/:id/edit`
  - Only ADMIN can enter the routes; the existing list remains ADMIN/MANAGER read access.
- The old First Aid create/edit modal is no longer opened. Rescue/Adoption and Community tabs are unchanged.
- Form: title, one of four fixed groups (Tai nạn, Ngộ độc, Khó thở, Chấn thương), normal/urgent mode, situation description, optional banner title, cover image URL and emergency hotline.
- Structured steps: title + instruction for each step; add, reorder, delete; each step needs nonempty fields to publish/save.
- Optional video: source URL, title, description, highlight lines.
- Preview: actual Customer FirstAidCard component for regular/urgent cards, plus detail banner, optional hotline, numbered steps and video summary. No fake play action.
- Draft/publish flow: POST draft then PATCH status, or PATCH existing. The created ID remains in page state if publish fails so retry cannot silently create a second draft.
- Customer normalization: category mapping, explicit urgency rather than guessed from position/title, persisted real steps, cover, banner title, optional video and hotline. No fabricated medical steps if fields are missing.

## Current FE API calls (verify BE implementation)
- `GET /admin/posts?postType=FIRST_AID&page=1&limit=100`
- `GET /admin/posts/:id` fallback when editing a record absent from list
- `POST /admin/posts` with `postType:'FIRST_AID'`
- `PATCH /admin/posts/:id`
- `PATCH /admin/posts/:id/status`
- Public Customer: `GET /first-aid/guides` and `GET /first-aid/guides/:slug`.

## P0 backend requirements
1. **Single source of truth:** `FIRST_AID` created/edited in Admin must appear through public `/first-aid/guides` and detail endpoint after publishing. Existing generic post vs dedicated guide collections may currently be disconnected; BE must unify or implement a verified mapping. Never claim public publication based solely on the Admin status response.
2. **Field persistence:** create/edit/read must preserve `title`, `category` or canonical category ID, `excerpt`/`situation_description`, `heroTitle`, `thumbnail_url`, `urgencyLevel`, `urgent`, `steps`, `emergency_phone`, `video_url`, `video_title`, `video_description`, `video_highlights`, `status`. Return stable canonical record ID and slug.
3. **Step schema:** `steps: [{step_number:1,title,step_content},...]`, ordered ascending and preserved exactly across create/update/list/detail reload. Do not auto-populate missing steps with invented advice.
4. **Urgency:** explicit NORMAL/URGENT (or documented enum mapping); public Customer must not infer urgent status from position in search results or keywords in title.
5. **Category taxonomy:** accept exactly the four Customer category IDs/labels and map consistently across Admin lists, filters, public search and detail: accident / poisoning / breathing / injury.
6. **Publish lifecycle:** DRAFT is not public; PUBLISHED is public; status PATCH response must reflect persisted status. Prevent duplicate create requests; authorize writes/status changes to ADMIN on BE.
7. **Video:** persist safe http(s) URL and metadata. Play direct media files via native video; for hosted platforms open verified external page. Never fake a playing state. Validate links server-side.
8. **Hotline:** agree on central fallback `0868686868` currently used by existing Customer emergency widget and override from guide data if provided. Confirm the actual hotline before production.
9. **Data:** seed/fixtures must include multiple real-looking entries for all four categories, both severity modes, differing step counts, valid media/no-media entries, draft and published records. No dummy phone numbers masquerading as working hotlines.

## UAT acceptance tests
- Create NORMAL guide with 2 steps; save draft; reload; confirm no public listing. Edit, reorder steps, attach cover and publish. Confirm list + detail content match Admin preview.
- Create URGENT guide with 3 steps; confirm badge and wide Customer card; change to NORMAL and confirm badge removed after public reload.
- Test category filtering each of four values; ensure no unknown category created.
- Test video mp4 link, external video link, no-video case; check no dead play control.
- Test missing/invalid URL, blank title, blank situation, missing step title/instructions, invalid category.
- Test genuine hotline data and tel: link, including fallback when no guide hotline provided.
- Test backend 401/403 for MANAGER/STAFF editing via direct route and REST; read-only list remains functional for permitted roles.
- Test partial failure POST success / status PATCH failure: state must not show false publication or create duplicate on retry.
- Test existing guides without structured steps: do not display invented instructions.
- Verify angular production build, actual Chrome visual UAT and deployed API database data. Source checks are insufficient.

## Out of scope
No modifications to Community-post composer or Rescue/Adoption editor in this phase. Wait for user approval before next tab.
