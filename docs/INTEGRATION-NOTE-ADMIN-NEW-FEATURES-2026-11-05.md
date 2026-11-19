# WEB 2 — Temporary integration baseline for new Admin features

Date: 2026-11-05

## Purpose
Continue new features (Admin Flash Sale, Content Management, and approved Admin improvements) **without** merging PR #33 into `main` while waiting for BE to implement and verify the FE–BE handoff/UAT requirements.

## Exact source baselines
- Base `main`: `b167e09e436d6f7dff067032c44b6cd1c4621534`
- Admin/Appointment feature snapshot: `feature/admin-appointments-figma` at `35a4ecc2b740da7721161d1a529c5077bd0a3f65`
- Temporary integration: `feature/admin-flash-sale-content-management`, initially populated by commit `94ef2bac33c4e8668d2c5bedcbc45c0ffbce25ee`.

The integration copies **152 non-overlapping changed files** from the Appointment feature onto the latest `main` base. It is **not** a Git merge of the Appointment branch, and PR #33 remains open.

## Deliberately deferred customer booking conflicts
The following files differ between `main` and the Appointment feature and are intentionally kept exactly as they exist on `main`:

1. `src/app/core/customer/services/api/booking-api.service.ts`
2. `src/app/features/customer/booking/pages/booking/booking-page.component.ts`

Do not silently cherry-pick or overwrite these files from either branch. The two variants include different backend contracts, ID handling, fallback behavior, booking submission data and idempotency. Multi-pet booking / one Appointment vs multiple Appointments requires the BE handoff and, if needed, Product/Lead approval.

## Scope of new development
- Admin: Flash Sale list, create, edit, publish, scheduler and product/variant selection (subject to API contract).
- Admin: Content Management and other approved FE improvements.
- Shared FE: related customer displays **only** after BE contract and QA are agreed.

## Required gates
1. Do not merge PR #33 or this branch to `main` based on compilation alone.
2. Run Angular development/production build plus Customer booking and Admin E2E regression after integrating BE.
3. Check idempotent appointment submission, real service/branch IDs, no fake slots, staff/branch scope, single/multi-pet behavior and payment/hold scenarios.
4. Validate Flash Sale pricing and quotas against persisted BE data and checkout—not FE-only discounted UI.
5. Confirm git ancestry and file-level diffs when the BE gap resolution is available. Reconcile the two deferred booking files explicitly before final merge.

## Rollback / provenance
Both original branches are untouched. The original Appointment snapshot remains available in `feature/admin-appointments-figma`; current Customer booking behavior is inherited from `main`. Any later integration decision must be recorded alongside a test result and BE contract version.
