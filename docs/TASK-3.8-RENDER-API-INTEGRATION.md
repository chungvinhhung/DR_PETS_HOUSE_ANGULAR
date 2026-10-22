# Task 3.8 — Staff / Shift Render integration (2026-10-22)

## Config
- Development and production FE already point to `https://pet-clinic-backend-a4lj.onrender.com/api/v1`; no new base URL was required.
- Shared `ApiClientService` provides credentials and existing authentication interceptors.

## Connected read paths
- `GET /staff`: staff profiles (handles raw array or `items` cursor pagination).
- `GET /admin/users?page&limit`: ADMIN-only account names/contacts/account status when available; this is optional enrichment, not a substitute for profiles.
- `GET /branches`: map authorized/home branch IDs to display names.
- `GET /shifts?dateFrom&dateTo&limit&cursor`: live weekly shifts / today's shifts, formatted in `Asia/Ho_Chi_Minh`.
- Staff List, Staff Detail, Weekly Schedule, Staff Edit initial values, and Shift Assignment **existing-shift** rows now read through `AdminStaffApiService`.
- Failed requests display errors. Never substitute Figma demo staff/shift rows after an API failure.
- StaffProfile `status` (ACTIVE/INACTIVE) is **not** the login account `accountStatus`. If account status is not included and cannot be joined to an account, display `Chưa có dữ liệu`.

## Not yet wired as writes
- Staff Create: BE `src/modules/staff/staff.routes.js` POST currently expects existing `userId`, while FE requires atomic account+staff-profile creation. OpenAPI v6 describes a different `StaffCreate` payload. Do not send a fabricated write.
- Staff Edit, block/unblock, reset password: no verified implemented Staff endpoints matching the FE operations; existing P0 Admin Users operations are **not** sufficient to update StaffProfile fields and branch scope atomically.
- Shift Assignment: `POST /shifts` exists in backend `feat/foundation-v6` but Figma's shift templates are examples; branch template API/permission and behavior on the deployed revision have not been validated. Existing shifts are live; draft validation does not persist.
- Role scope: the inspected foundation-v6 `GET /staff` handler uses `StaffProfile.find()` without Manager assigned-branch filtering. Until BE enforces scope, FE intentionally blocks Manager/STAFF profile listing to avoid presenting unscoped personal data.

## Verification status
- GitHub Angular build/CI verifies TypeScript and templates.
- Live Render smoke test is **not verified** in this run: the external URL could not be reached from the execution environment. Do not interpret successful CI as successful backend authentication or a confirmed deployment version.
- The Render service must be checked by an authenticated ADMIN in browser DevTools for HTTP 200 on `/staff`, `/admin/users`, `/branches`, and `/shifts`; if 404, BE must redeploy a revision that mounts Staff/Shift routes.
- Confirm Manager branch scope, Staff create/update contract, error mapping, and CORS/refresh-token cookie behavior with BE before release.

## Suggested smoke checks
1. ADMIN login on localhost:3001 (API base Render). Open `/admin/staff` and check that rows come from Network `/staff`.
2. Open a real staff ID; compare identity and branch against Backend response, then change weeks and inspect `/shifts`.
3. Use search/role/branch filters and paginate six rows at a time.
4. Verify that staff/shift request failures show error messages and **never** show `NV001` fixture rows.
5. Test MANAGER scope only after BE confirms authorization; Manager currently receives a protective warning.
6. Verify create/edit/account controls do not display a fake "saved" success.

This implementation is a **read integration**, not an assertion that all Task 3.8 writes are end-to-end ready.
