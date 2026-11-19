# WEB 2 — BE handoff: Create / manage MANAGER accounts across branches

**Date:** 2026-11-06  
**FE branch:** `feature/admin-flash-sale-content-management`  
**Screen:** `/admin/staff/new` (Admin → Vận hành → Nhân sự → Thêm nhân viên / Thêm quản lý)  
**Status:** FE UX ready; **BE not integrated — manager save is deliberately blocked**.

## 1. Business rule (approved FE direction)
- `MANAGER` is a **User.systemRole**, not a `StaffProfile.staffSubRole`.
- `STAFF` alone has `staffSubRole = RECEPTIONIST | CARE_STAFF_GROOMER | VETERINARIAN | NURSE`.
- A Manager may manage **one or many branches** via `User.assignedBranchIds`. These IDs determine authorization scope and MUST be validated server-side for every operation.
- In the form, managers have **Chi nhánh quản lý** (required multi-select), but **do not have “Chi nhánh chính”** or per-week staff shift assignment. `homeBranchId` belongs to StaffProfile, not to manager permission scope.
- Only **ADMIN** may create/edit/change the branch scope of a Manager. MANAGER must not grant MANAGER privileges to anyone.
- A future default branch preference is optional UX only and **must never** restrict or extend permissions.

## 2. Evidence from current BE/dev source
- `src/models/User.js` already defines `systemRole: 'MANAGER'` and `assignedBranchIds: ObjectId[]`.
- `src/modules/staff/models/StaffProfile.js` supports only four staff sub-roles.
- `POST /api/v1/staff` (in `src/modules/staff/staff.service.js`) explicitly validates four staffSubRoles and persists `systemRole:'STAFF'`. **Never send a manager through this endpoint.**
- A verified `POST /api/v1/admin/users` manager creation route was **not found** in the current `src/app.js` mounts in BE/dev. Do not assume FE AdminUsersService's scaffolded route is implemented.
- List at `GET /api/v1/staff` reads only StaffProfile. Accounts with `systemRole:'MANAGER'` alone will not be listed there without an additional endpoint or list integration.

## 3. P0 API proposal (must agree URI and DTO with FE before integration)

### A. Create manager (ADMIN only)
Suggested `POST /api/v1/admin/users` or `POST /api/v1/admin/managers`.

Request (proposed, no client-generated role grant):
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "09xxxxxxxx",
  "email": "manager@example.com",
  "systemRole": "MANAGER",
  "assignedBranchIds": ["<branchId1>", "<branchId2>"]
}
```

Contract:
- Check authenticated actor has `systemRole:ADMIN` on BE, not only FE.
- Validate fullName required; valid and unique phone/email; at least one distinct existing and active Branch ID; reject duplicate and invalid IDs with clear 400/409 codes.
- Manager's `systemRole=MANAGER`, `staffSubRole=null`, `assignedBranchIds` exactly as authorized by ADMIN; no StaffProfile required.
- Generate secure login credentials using the agreed enterprise onboarding/activation flow. Do not expose plaintext passwords in list/detail responses, logs or subsequent GET; only return once if absolutely necessary.
- Create account and branch assignment atomically and idempotently. Return public-safe profile with `id, fullName, phone, email, systemRole, assignedBranchIds, accountStatus, createdAt` and an explicit success response.
- Never downgrade to `STAFF` if caller requested MANAGER. Reject unsupported role with explicit error.

### B. List/get/update managers
Suggested `GET /api/v1/admin/managers?page=...&limit=...&branchId=...`, `GET /api/v1/admin/managers/:id`, `PATCH /api/v1/admin/managers/:id`, `PUT /api/v1/admin/managers/:id/branches`.
- Return proper total/pagination and the real manager record, with current branch IDs resolved to names via Branch API.
- Add manager rows into Admin Nhân sự management list (or provide dedicated Manager tab by product agreement). Current `GET /staff` excludes users with Manager role.
- Update manager branch scope through Admin-only endpoint with branch-existence validation, audit log, and race-safe updates. Remove revoked access immediately (including token/session scope refresh).
- Be explicit whether existing manager accounts can be converted to/from STAFF; **do not silently mutate a StaffProfile**.

### C. Authorization and branch scope
- Read actor from verified bearer token/DB. Enforce Manager `assignedBranchIds` on all branch-bound Customer, Staff, Order, Appointment, Inventory, Shift and operational endpoints. Deny cross-branch read/writes (403 or 404 per resource protection policy).
- `assignedBranchIds` in JWT must not override revoked DB permissions; define how authorization cache/session is invalidated.
- A Manager cannot create/edit another Manager or assign themselves a new branch, even by crafting requests manually.
- Manager must not receive global Admin powers for Product, Service catalog, Voucher, Customer account blocking, etc.

## 4. Current FE behavior and missing integration
- Admin-only selection `Quản lý` appears in `admin-staff-form.component.html`.
- Form displays **Chi nhánh quản lý** multi-select; hides staff **Chi nhánh chính** and **Tạo và phân ca**, no homeBranch validation for manager.
- Form validates name, optional email/phone, and at least one branch. Pressing `Tạo quản lý` currently shows a **BE not available** notice without calling `POST /staff` or claiming account creation.
- Once contract is implemented, FE must create via the agreed Manager endpoint, refresh manager list, show accurate success, and provide safe edit/manage options.

## 5. Mandatory UAT / proof
1. Admin creates Manager A with branch B1+B2. BE returns and stores `systemRole:MANAGER`, `staffSubRole:null`, `assignedBranchIds:[B1,B2]`.
2. Manager A logs in: can access only B1 and B2 operational data; accessing B3 directly receives 403/404.
3. Manager A cannot create Manager B or assign themselves B3 even with crafted POST/PATCH.
4. Admin revokes B2: Manager A loses B2 scope immediately; page reload and new tokens show B1 only.
5. Empty/unknown/duplicate branch ID and duplicate email/phone are rejected; no partial account record.
6. Manager account is visible in the intended Admin personnel list with correct branch names and status; edits survive reload.
7. Existing STAFF create/edit, home branch and shift assignment continue working unchanged.
8. Verify actual DB and integration in deployed/staging environment (not mock data, not only API route checks).

**BE handoff artifacts required:** endpoint OpenAPI/Swagger, migrations/indexes, deployment base URL/commit, test accounts and 8 UAT test logs, documented error codes. **FE does not currently have an end-to-end Manager creation workflow.**
