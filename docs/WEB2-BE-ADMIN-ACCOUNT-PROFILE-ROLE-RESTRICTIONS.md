# WEB 2 – Admin-only account profile: BE verification and UAT

Date: 2026-11-06
FE branch: `feature/admin-flash-sale-content-management`
Screen: `/admin/profile`
Figma reference: `6059:19324` (avatar dropdown); new account page reuses AdminCatalogShell.

## Leader-approved business scope
- ADMIN seeded by developer: can authenticate, view account, update **own** fullName/email, and change **own** password after verifying current password.
- MANAGER and STAFF: do **not** have the account profile screen and cannot change their own passwords through this workflow. Initial and reset passwords are controlled by ADMIN as in the provided matrix.
- ADMIN must not self-delete, self-change its role, or edit immutable login identifier/phone on this page.
- Password hashes and tokens must never be exposed by GET /auth/me, logged, or returned after mutation.

## Source evidence vs deployed verification
- BE/dev `src/modules/auth/auth.routes.js` currently registers authenticated GET /auth/me, PUT /auth/me and POST /auth/change-password.
- `src/modules/auth/auth.service.js` implements password-current verification and hashing but routes are authenticated rather than restricted to ADMIN. This **does not yet establish** BE enforcement of the requested ADMIN-only profile/password policy.
- FE now hides account dropdown action for non-ADMIN, hides legacy demo link, and protects `/admin/profile` with authGuard + roleGuard ADMIN. This is necessary UX but is **not security authorization**.

## P0 BE contract/behavior required
1. Ensure authenticated `GET /auth/me` returns safe id, fullName, email, phone, systemRole, status. Session data must match the persisted current user.
2. `PUT /auth/me` for `ADMIN`: whitelist fullName and nullable email only (plus avatarUrl if product-approved). Never accept systemRole, phone/login ID, passwordHash, assignedBranchIds, accountStatus via request. Validate email uniqueness and clearing with `email:null`.
3. `POST /auth/change-password`: require actor.systemRole === ADMIN according to leader matrix. Validate old password, confirmPassword match, strong new password, hash persisted (never plain), invalidate or rotate sessions per policy.
4. For MANAGER/STAFF direct PUT /auth/me or POST /auth/change-password, return 403 if leader policy applies to all self-edit APIs; GET /auth/me may remain usable for session identity/role. Clarify scope with BA if profile PUT is used by other modules, to avoid breaking essential auth functionality.
5. ADMIN cannot self-delete or self-change role. Keep initial password provisioning/reset capabilities exclusively ADMIN or developer seed, with audit actor/time; no self-service reset page for MANAGER/STAFF.
6. Error shape: non-200 on invalid old password / weak password / email duplicate / forbidden actor, with code and correlationId; no fake success.

## UAT
- UAT-AC01 ADMIN logs in, avatar menu shows “Thông tin tài khoản” above “Đăng xuất”; navigates to /admin/profile in WEB 2 shell.
- UAT-AC02 Profile displays real fullName/email/phone and read-only ADMIN role. Reload keeps updated fullName/email after successful PUT.
- UAT-AC03 Admin correct oldPassword and strong newPassword: persisted password hash changes; login with old/new follows session policy.
- UAT-AC04 Wrong oldPassword, mismatch, weak password → clear error, no DB mutation.
- UAT-AC05 MANAGER/STAFF avatar menu only has Đăng xuất; direct /admin/profile is forbidden; crafted PUT/POST cannot bypass BE role policy.
- UAT-AC06 Admin crafted payload trying systemRole/phone/delete own account cannot change immutable fields.
- UAT-AC07 Authenticated logout clears session, opens login; accessing profile after logout requires login.

**Handoff:** BE deployed SHA/environment, example sanitized DTOs/errors, UAT logs, seed ADMIN account evidence. Do not mark E2E PASS until FE browser UAT on the same deployed API.
