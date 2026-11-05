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
