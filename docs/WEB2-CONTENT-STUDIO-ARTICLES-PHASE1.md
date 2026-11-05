# WEB 2 — Content Studio: Phase 1 (Bài viết kiến thức)
Updated: 2026-11-05
Branch: feature/admin-flash-sale-content-management

## Scope completed in FE
- `/admin/content/articles/new` and `/admin/content/articles/:id/edit` (ADMIN only).
- List Create/Edit now routes to dedicated editor; First Aid/Community/Rescue remain untouched.
- Knowledge article editor: title, category, summary, cover URL, tags; block editor with paragraph/heading/list/quote/image/video URL, reorder/delete/add; choose STANDARD or FEATURED card layout.
- Live card/detail preview plus Desktop/Mobile sizing; preview is indicative, not guaranteed pixel-identical before BE contract finalization.
- Draft and publish actions preserve existing admin API convention; a generated ID is retained after a partial publish failure to avoid duplicate creation on retry.
- Customer blog normalization and article detail support `contentBlocks` when BE persists them; old plain-text articles still use the unchanged fallback renderer.
- Featured card can use `layoutType=FEATURED` when persisted in published Customer API response.

## Existing API used
- `GET /admin/posts?postType=OFFICIAL_BLOG`
- `GET /admin/posts/:id` (new FE lookup, **BE contract not yet verified**; FE uses existing list row first)
- `POST /admin/posts`
- `PATCH /admin/posts/:id`
- `PATCH /admin/posts/:id/status`

## Required BE verification / gaps
1. **P0** Confirm and persist `postType:'OFFICIAL_BLOG'`, `title`, `category`, `excerpt`, `content`, `status`, `thumbnail_url`, `hashtags` for create/edit. Normalize read/write naming consistently.
2. **P0** Persist structured `contentBlocks:[{type,text,alt}]` and `layoutType:'STANDARD'|'FEATURED'`; return these fields in Admin GET/list and published `GET /posts`, `GET /posts/:slug`. If fields are discarded by BE, preview cannot match Customer. FE also submits `content` plain-text fallback.
3. **P0** Ensure published post is publicly readable only after status update; return real stable ID and status. Verify permission checks ADMIN only for create/edit/status and correct backend author attribution.
4. **P1** Add proper Content media upload endpoint (image/video) with file type, size, storage, and moderation rules. Current FE accepts **URLs only** because the existing verified upload endpoint is product-specific, not Content. Do not reuse `/uploads/products` for article media.
5. **P1** Provide category taxonomy IDs or map category strings to correct Customer category labels. FE currently suggests categories from existing posts; no synthetic IDs.
6. **P1** Define deterministic FEATURED selection when multiple published articles request this layout, and clarify whether featured state is an editorial selection or a card frame type.
7. **P1** Make post creation + publish idempotent or transactional if required. Current implementation uses POST draft followed by PATCH status; partial failure is surfaced, not disguised as success.

## UAT checklist (must verify on deployed API)
- Create draft; reload; reopen edit; validate title/category/summary/cover/blocks/tags/layout are identical.
- Publish; refresh Customer blog list and detail; confirm media and headings actually render from persisted structured payload.
- Edit published article; verify status remains published on content update (no accidental downgrade to draft).
- Check both normal/featured card choices, mobile and desktop previews, and same images on Customer.
- Test backend errors on POST/PATCH status, missing ID, unauthorized MANAGER/STAFF and deep-link edit.
- Existing published articles without `contentBlocks` still display unchanged.
- Angular production build and browser screenshot UAT must run; static source checks alone are insufficient.

## Scope boundary
Do not start First Aid, Community posts, or Rescue/Adoption editor work until the user approves the Knowledge Articles tab.


## Customer card preview visual correction (2026-11-06)

- Previous handmade preview differed from Customer BlogCard: category/badge was beneath the image, the title and excerpt did not use Customer's exact dimensions, and the date/Read more row was missing.
- Replaced preview CARD rendering with the existing **BlogCardComponent** for STANDARD and **FeaturedPostComponent** for FEATURED. The preview gets a computed post derived from current editor fields and the Customer Blog category set.
- The Customer category badge (including the actual category icon) now sits at the top-left of the cover image. Standard preview keeps the 288×343 Customer card frame, two-line title/excerpt limits, published-date row, and “Đọc tiếp” affordance.
- Actual Customer UI uses Customer lazy-loaded CSS; scoped preview CSS supplies the matching geometry within the Admin layout. Preview links are non-interactive and Desktop/Mobile sizing stays available.
- Source/HTML static QA passed. **Still needs browser build and visual screenshot QA** before claiming pixel-level matching. Status for unsaved articles says “Chưa xuất bản” rather than inventing a publication date.


## Phase 1 refinement — categories, hashtags, rich text & step lists (2026-11-06)

- `Chủ đề` is now a strict select sourced from the four existing Customer knowledge categories: **Sức khỏe, Dinh dưỡng, Tâm lý, Vệ sinh & Làm đẹp**. Do not allow arbitrary categories on this form. The chosen label must map to the matching Customer category ID; no fabricated category entries.
- `Thẻ nội dung (Hashtag)` is now a one-at-a-time input. Enter/comma/Add commits a chip, duplicate entries are ignored, individual chips are removable, maximum 12; chips appear at the end of the Customer article as hash tags.
- Fix select chevron position with right padding; match existing Admin focus rules.
- Text block editor now supports bold, italic, underline, http(s) link, numbered/bulleted formatting, and preset font colors. Plain text remains in `content` and `contentBlocks[].text`; block-level rich markup is serialized as `contentBlocks[].html`.
- New `list` blocks default to an **ordered list** with automatic numbering as the user presses Enter. Admin Detail preview and Customer Detail render numbered steps with light-blue circular numbers. Old text-only list blocks are still supported.
- **P0 BE REQUIREMENT:** persist and return sanitized `contentBlocks[].html` for all text blocks on both Admin and public Customer APIs; never store or output unsafe scriptable HTML, event handlers, disallowed URLs, or arbitrary embedded markup. FE Angular binding sanitization is defense-in-depth, not a server security replacement.
- **P0 BE REQUIREMENT:** persist and return the approved category taxonomy and hashtags without converting real categories into fallback values. Validate category against the four options on BE; category name/ID must map to Customer consistently.
- **IMPORTANT:** Rich formatting depends on BE retaining the `html` field. If it strips this field, text falls back safely but loses bold, italic, underline, links and colors after reload/publication. This is a backend gap, not a verified E2E success.
- **QA:** create with 4 categories, 3+ hashtag chips, inline formatting, multiple Enter-generated numbered items, then draft/save/reload/publish and compare preview with Customer detail. Test javascript: URLs, paste, broken HTML and permission checks; verify no XSS.


## Phase 1 polishing — 2026-11-06: inline links, unified lists and spacing

- Chèn liên kết now opens an inline form **inside the editor**, never native `window.prompt`/`window.alert`. The form accepts visible text and a URL, preserves selected text/range, checks `https://` / `http://`, displays errors inline, and inserts the link into the contenteditable document.
- The separate **Danh sách** choice has been removed from **Loại nội dung** for newly added blocks. Ordered-list formatting remains directly in **Đoạn văn** through the 1.≡ toolbar control. Legacy persisted `type:'list'` blocks remain readable and editable.
- Lists authored as rich HTML inside paragraph blocks now share the numbered light-blue circle style with Customer detail. Remove browser default `ol` padding/margins so list content aligns with neighboring text and images in the preview.
- Composite hashtag entry and rich editor now have **one focus outline on the outer control**, not a nested input focus outline.
- Removed the optional `Mô tả hình ảnh` entry (legacy image alt data still renders when present); removed subtitle, hashtag-helper and technical preview notes.
- `Lưu bản nháp` receives the red outlined reject-button treatment (`#de414c` text and `#ed6b72` border, white fill) while action remains save-as-draft, not delete/reject.
- Source/template/CSS static QA checked; **Angular build, inline-link keyboard interaction, focus, screen-size and actual Customer rendering are not yet runtime-verified**.

### UAT specific to this patch
1. Select text, click Liên kết, enter a URL and submit. Check correct selected text is linked; test link validation, cancel and a collapsed selection.
2. Type a numbered list inside an ordinary Đoạn văn, press Enter for multiple items, check the circles align in editor and Detail preview. Save/reload/public Customer may depend on BE retaining `contentBlocks[].html`.
3. Focus the Hashtag entry and contenteditable; confirm there is one outer focus ring only.
4. Check red outline for Lưu bản nháp, and confirm it still saves a draft without affecting published posts.
5. Check no orphan helper notes and that image URL remains functional without a separate alt-description field.
